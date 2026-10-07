import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-key";
process.env.PORT ||= "3000";
process.env.CORS_ORIGIN ||= "http://app.test";

const { default: app } = await import("../src/app.js");

const withServer = async (fn) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("health endpoint is public", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  });
});

test("gateway headers no longer authenticate a request", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/documents`, {
      headers: {
        "X-Gateway-Verified": "true",
        "X-User-ID": "00000000-0000-0000-0000-000000000000",
      },
    });
    assert.equal(response.status, 401);
  });
});

test("unknown routes return 404 JSON", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/nope`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).success, false);
  });
});
