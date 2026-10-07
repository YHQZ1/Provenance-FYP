import assert from "node:assert/strict";
import test from "node:test";

import { hashToken, tokenCacheSeconds } from "../src/lib/tokens.js";

const tokenExpiringAt = (exp) =>
  ["header", Buffer.from(JSON.stringify({ exp })).toString("base64url"), "signature"].join(".");

test("identity is cached for at most a minute", () => {
  assert.equal(tokenCacheSeconds(tokenExpiringAt(10_000), 1_000), 60);
});

test("and never past the token's expiry, with a safety margin", () => {
  assert.equal(tokenCacheSeconds(tokenExpiringAt(1_030), 1_000), 25);
  assert.equal(tokenCacheSeconds(tokenExpiringAt(1_003), 1_000), 0);
  assert.equal(tokenCacheSeconds(tokenExpiringAt(900), 1_000), 0);
});

test("malformed tokens are never cached", () => {
  assert.equal(tokenCacheSeconds("not-a-jwt", 1_000), 0);
  assert.equal(tokenCacheSeconds(tokenExpiringAt("soon"), 1_000), 0);
});

test("cache keys use a hash, not the token", () => {
  const hash = hashToken("secret.token.value");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes("secret"));
});
