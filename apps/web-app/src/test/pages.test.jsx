import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import { filingFixture } from "./fixtures";

const workspace = { current: null };

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            email: "owner@acme.in",
            app_metadata: { provider: "email" },
            user_metadata: { full_name: "Asha" },
          },
        },
      }),
    },
  },
}));
vi.mock("../lib/workspace", () => ({ useWorkspace: () => workspace.current }));
vi.mock("../lib/api", () => ({
  reviewAPI: {
    approve: vi.fn().mockResolvedValue({ data: {} }),
    queue: vi.fn().mockResolvedValue({
      data: [
        {
          id: "c1",
          document_id: "d1",
          document_filename: "invoice-001.pdf",
          document_type: "purchase_invoice",
          line_description: "Reliance Polypet 3020 bottle grade",
          material_code: "PET",
          quantity_kg: 500,
          confidence_score: 0.93,
          reasoning: "POLYPET is a PET trade name.",
          suggested: true,
        },
      ],
    }),
  },
  documentAPI: {
    get: vi.fn().mockResolvedValue({ data: { raw_text: "", file_url: null } }),
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
  filingAPI: {},
  companyAPI: { update: vi.fn().mockResolvedValue({ data: {} }) },
  systemAPI: {
    status: vi.fn().mockResolvedValue({
      data: {
        mock_services: false,
        services: [
          { name: "ocr", status: "up" },
          {
            name: "classifier",
            status: "down",
            detail: "No response within 4s",
          },
          { name: "regulatory", status: "up" },
        ],
        features: { finalization: true, category_tracking: false },
        checked_at: "2026-10-07T10:00:00Z",
      },
    }),
  },
  regulatoryAPI: {
    sources: vi.fn().mockResolvedValue({
      data: [
        {
          title: "CPCB Environmental Compensation Regime for Plastic Waste",
          category: "plastic_epr",
          url: "https://example.org/ec.pdf",
          passages: 383,
          ingested: true,
        },
      ],
    }),
    query: vi.fn().mockResolvedValue({
      data: {
        answer:
          "Compensation is levied per ton:\n* Rs. 5,000 the first time\n* Rs. 10,000 the second time",
        sources: [
          {
            name: "CPCB Environmental Compensation Regime for Plastic Waste",
            category: "plastic_epr",
            url: "https://example.org/ec.pdf",
            score: 0.74,
            pages: [27],
          },
        ],
      },
    }),
  },
}));

const renderPage = (ui) =>
  render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  workspace.current = {
    fy: 2026,
    filing: filingFixture(),
    filingError: null,
    refreshFiling: vi.fn(),
    company: { company_name: "Acme Packaging" },
    profileComplete: true,
  };
});

describe("Home", () => {
  it("points the user at the next step", async () => {
    const { default: Home } = await import("../pages/Home");
    renderPage(<Home />);
    expect(screen.getByText("Review 3 line item(s)")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: /start review/i })[0]
        .getAttribute("href"),
    ).toBe("/review");
  });

  it("asks for the company profile first", async () => {
    workspace.current.profileComplete = false;
    const { default: Home } = await import("../pages/Home");
    renderPage(<Home />);
    expect(screen.getByText("Complete your company profile")).toBeTruthy();
  });

  it("flags months without purchase invoices", async () => {
    const { default: Home } = await import("../pages/Home");
    renderPage(<Home />);
    expect(screen.getByText(/No purchase invoices dated in/)).toBeTruthy();
  });
});

describe("Filing", () => {
  it("blocks finalizing while items are open", async () => {
    const { default: Filing } = await import("../pages/Filing");
    renderPage(<Filing />);
    expect(
      screen.getByText("3 line item(s) are waiting for review."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /finalize fy 2026-27/i }).disabled,
    ).toBe(true);
  });

  it("shows the signed-off snapshot once finalized", async () => {
    const snapshot = filingFixture({
      totals: {
        introduced: { by_material: { PET: 999 }, total_kg: 999 },
        recycled: { by_material: {}, total_kg: 0 },
        collected: { by_material: {}, total_kg: 0 },
      },
    });
    workspace.current.filing = filingFixture({
      status: "FINALIZED",
      finalized_at: "2026-10-01T10:00:00Z",
      snapshot,
    });
    const { default: Filing } = await import("../pages/Filing");
    renderPage(<Filing />);
    expect(screen.getAllByText("999 kg").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /finalize fy/i })).toBeNull();
  });
});

describe("Review", () => {
  it("shows the invoice line being reviewed", async () => {
    const { default: Review } = await import("../pages/Review");
    renderPage(<Review />);
    expect(
      (await screen.findAllByText("Reliance Polypet 3020 bottle grade")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /approve 1 suggested/i }),
    ).toBeTruthy();
    expect(screen.getAllByText("500 kg").length).toBeGreaterThan(0);
  });
});

describe("Documents upload", () => {
  it("shows the upload action only once files are queued", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { default: Documents } = await import("../pages/Documents");
    renderPage(<Documents />);

    expect(screen.queryByRole("button", { name: /^upload$/i })).toBeNull();

    const input = document.querySelector('input[type="file"]');
    const file = new File(["%PDF-1.4"], "invoice.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("1 file ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^upload$/i })).toBeTruthy();
  });
});

describe("Review shortcuts", () => {
  it("approves exactly one line per key press", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const { reviewAPI } = await import("../lib/api");
    const line = (id, text) => ({
      id,
      document_id: "d1",
      document_filename: "invoice-001.pdf",
      document_type: "purchase_invoice",
      line_description: text,
      material_code: "PET",
      quantity_kg: 500,
      confidence_score: 0.95,
      reasoning: "",
      suggested: true,
    });
    reviewAPI.queue.mockResolvedValue({
      data: [line("c1", "First line"), line("c2", "Second line")],
    });
    reviewAPI.approve.mockClear();

    const { default: Review } = await import("../pages/Review");
    renderPage(<Review />);
    expect((await screen.findAllByText("First line")).length).toBeGreaterThan(
      0,
    );

    fireEvent.keyDown(document, { key: "a" });

    // Wait for the approval itself, then for the next line to open, then make sure nothing else fired.
    await waitFor(() => expect(reviewAPI.approve).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText("Second line")).length).toBeGreaterThan(
      0,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(reviewAPI.approve).toHaveBeenCalledTimes(1);
    expect(reviewAPI.approve).toHaveBeenCalledWith("c1", "");
  });
});

describe("Regulatory research", () => {
  it("answers a suggested question with page citations", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { default: RegulatoryResearch } = await import(
      "../pages/RegulatoryResearch"
    );
    renderPage(<RegulatoryResearch />);

    expect(await screen.findByText("383 passages indexed")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: /environmental compensation calculated/i,
      }),
    );

    expect(await screen.findByText("Rs. 5,000 the first time")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open page 27" }).getAttribute("href"),
    ).toBe("https://example.org/ec.pdf#page=27");
  });
});

describe("Settings", () => {
  it("validates the GSTIN before saving", async () => {
    const { fireEvent } = await import("@testing-library/react");
    workspace.current.company = {
      company_name: "Acme Packaging",
      gst_number: "",
      Pibo_category: [],
    };
    workspace.current.refreshAccount = vi.fn();
    const { default: Settings } = await import("../pages/Settings");
    renderPage(<Settings />);

    fireEvent.change(screen.getByLabelText("GSTIN"), {
      target: { value: "27ABC" },
    });
    expect(screen.getByText(/Enter a valid 15-character GSTIN/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save profile" }).disabled).toBe(
      true,
    );
  });

  it("shows which services are running and what fixes missing features", async () => {
    workspace.current.company = {
      company_name: "Acme Packaging",
      gst_number: "27ABCDE1234F1Z5",
      Pibo_category: ["BRAND_OWNER"],
    };
    const { default: Settings } = await import("../pages/Settings");
    renderPage(<Settings />);

    expect(await screen.findByText("Material classification")).toBeTruthy();
    expect(screen.getByText("No response within 4s")).toBeTruthy();
    expect(screen.getByText(/002_classification_category.sql/)).toBeTruthy();
    expect(await screen.findByDisplayValue("owner@acme.in")).toBeTruthy();
  });
});

describe("Forgot password", () => {
  it("asks for the email on its own screen and confirms the link was sent", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { supabase } = await import("../lib/supabase");
    const { default: Auth } = await import("../pages/Auth");
    renderPage(<Auth />);

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "owner@acme.in" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(
      await screen.findByRole("heading", { name: "Reset your password" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Email").value).toBe("owner@acme.in");

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(
      await screen.findByRole("heading", { name: "Reset link sent" }),
    ).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "owner@acme.in",
      expect.any(Object),
    );
  });

  it("explains an undeliverable address in plain words", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { supabase } = await import("../lib/supabase");
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: {
        code: "email_address_invalid",
        message: 'Email address "abcd@gmail.com" is invalid',
      },
    });
    window.history.replaceState({}, "", "/auth?mode=forgot");
    const { default: Auth } = await import("../pages/Auth");
    renderPage(<Auth />);

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "abcd@gmail.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText(/We can't send email to this address/),
    ).toBeTruthy();
    expect(screen.queryByText(/is invalid/)).toBeNull();
    window.history.replaceState({}, "", "/");
  });
});

describe("Trace assistant", () => {
  it("opens from the launcher, says it's coming soon, and closes on Escape", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { default: Assistant } = await import("../components/Assistant");
    renderPage(<Assistant />);

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /open trace/i }));
    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    expect(screen.getByText("Coming soon")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Not found", () => {
  it("explains the missing page and offers a way back", async () => {
    const { default: NotFound } = await import("../pages/NotFound");
    renderPage(<NotFound />);
    expect(screen.getByRole("heading", { name: "This page doesn't exist" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Home" }).getAttribute("href")).toBe("/dashboard");
  });
});
