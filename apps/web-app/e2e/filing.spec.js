import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const stamp = Date.now();
const account = {
  name: "E2E Tester",
  company: `E2E Plastics ${stamp}`,
  gstin: "27ABCDE1234F1Z5",
  email: `e2e-${stamp}@example.com`,
  password: "correct-horse-battery",
};

const lines = [
  { description: "PET Bottles Clear", material: "PET", kg: 500 },
  { description: "HDPE Containers Natural", material: "HDPE", kg: 300 },
  { description: "PP Scrap Mixed", material: "PP", kg: 200 },
];
const totalKg = lines.reduce((sum, line) => sum + line.kg, 0);

test("sign up, upload, review, finalize and export", async ({ page }) => {
  await test.step("create an account", async () => {
    await page.goto("/auth?mode=signup");
    await page.getByLabel("Your name").fill(account.name);
    await page.getByLabel("Company name").fill(account.company);
    await page.getByLabel(/GSTIN/).fill(account.gstin);
    await page.getByLabel("Work email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await test.step("keep the sign-up details and choose a PIBO category", async () => {
    await page.goto("/settings");
    await expect(page.locator("#company-name")).toHaveValue(account.company);
    await expect(page.locator("#gstin")).toHaveValue(account.gstin);
    await page.getByText("Producer", { exact: true }).click();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Company profile saved")).toBeVisible();
  });

  await test.step("upload a purchase invoice", async () => {
    await page.goto("/documents");
    await page.locator('input[type="file"]').setInputFiles({
      name: "invoice.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: /^Upload/ }).click();
    await expect(page.getByText("Uploaded", { exact: true })).toBeVisible();
    await expect(page.getByText("invoice.png").first()).toBeVisible();
  });

  await test.step("review every line", async () => {
    await page.goto("/review");
    for (const line of lines) {
      await expect(page.getByTestId("open-line")).toHaveText(line.description);
      await page.getByLabel("Material", { exact: true }).selectOption(line.material);
      await page.getByRole("button", { name: "Save and approve" }).click();
    }
    await expect(page.getByText("All caught up")).toBeVisible();
  });

  await test.step("finalize the financial year", async () => {
    await page.goto("/filing");
    await expect(page.getByText("Ready to finalize")).toBeVisible();
    await page.getByRole("button", { name: /^Finalize FY/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${totalKg.toLocaleString("en-IN")} kg`);
    await dialog.getByRole("button", { name: "Finalize", exact: true }).click();
    await expect(page.getByText("Finalized", { exact: true }).first()).toBeVisible();
  });

  await test.step("export the signed-off position", async () => {
    await page.getByRole("button", { name: /Export/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /CSV spreadsheet/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const csv = await readFile(await download.path(), "utf8");
    for (const line of lines) {
      expect(csv).toContain(line.material);
    }
    expect(csv).toContain(String(totalKg));
  });
});
