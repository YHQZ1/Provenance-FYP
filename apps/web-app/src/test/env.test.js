import { describe, expect, it } from "vitest";
import { readEnv } from "../lib/env";

describe("runtime environment", () => {
  it("prefers values injected at startup over those baked into the build", () => {
    expect(
      readEnv("VITE_API_URL", { VITE_API_URL: "http://runtime" }, { VITE_API_URL: "http://build" }),
    ).toBe("http://runtime");
  });

  it("falls back to the build, then to an empty string", () => {
    expect(readEnv("VITE_API_URL", {}, { VITE_API_URL: "http://build" })).toBe("http://build");
    expect(readEnv("VITE_API_URL", {}, {})).toBe("");
  });
});
