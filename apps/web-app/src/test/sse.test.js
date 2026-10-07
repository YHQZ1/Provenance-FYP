import { describe, expect, it } from "vitest";
import { createEventParser } from "../lib/sse";

describe("server-sent events", () => {
  it("parses events split across chunks", () => {
    const seen = [];
    const parser = createEventParser((event, data) => seen.push([event, data]));
    parser.push('event: token\ndata: {"text":"Hel');
    parser.push('lo"}\n\nevent: done\r\ndata: {"links":[]}\r\n\r\n');
    parser.end();
    expect(seen).toEqual([
      ["token", { text: "Hello" }],
      ["done", { links: [] }],
    ]);
  });
});
