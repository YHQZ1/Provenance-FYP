import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = {
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((callback) => callback({ setContext: vi.fn() })),
};
vi.mock("@sentry/react", () => sentry);

describe("monitoring", () => {
  beforeEach(() => {
    vi.resetModules();
    sentry.init.mockClear();
    sentry.captureException.mockClear();
  });

  afterEach(() => {
    delete window.__ENV__;
  });

  it("does nothing without a DSN", async () => {
    window.__ENV__ = {};
    const { initMonitoring, reportError } = await import("../lib/monitoring");
    expect(await initMonitoring()).toBe(false);
    expect(() => reportError(new Error("ignored"))).not.toThrow();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("starts Sentry once and reports errors when a DSN is set", async () => {
    window.__ENV__ = { VITE_SENTRY_DSN: "https://key@example.ingest.sentry.io/1" };
    const { initMonitoring, reportError } = await import("../lib/monitoring");
    expect(await initMonitoring()).toBe(true);
    expect(await initMonitoring()).toBe(false);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0][0]).toMatchObject({
      dsn: "https://key@example.ingest.sentry.io/1",
      sendDefaultPii: false,
    });

    const error = new Error("server failed");
    reportError(error, { status: 500 });
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });
});
