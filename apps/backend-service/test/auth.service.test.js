import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-key";
process.env.PORT ||= "3000";
process.env.CORS_ORIGIN ||= "http://app.test";

const { missingProfileFields, signupProfile } = await import("../src/services/auth.service.js");

const user = (metadata, email = "owner@acme.test") => ({ email, user_metadata: metadata });

test("the sign-up details become the company profile", () => {
  assert.deepEqual(
    signupProfile(user({ company_name: "Acme Packaging", gst_number: "27ABCDE1234F1Z5" })),
    { company_name: "Acme Packaging", gst_number: "27ABCDE1234F1Z5" },
  );
});

test("a missing company name falls back to the email's local part", () => {
  assert.deepEqual(signupProfile(user({ company_name: "  " })), {
    company_name: "owner",
    gst_number: null,
  });
  assert.equal(signupProfile({ email: "x@y.test" }).company_name, "x");
});

test("an empty row created by the sign-up trigger gets the sign-up details", () => {
  const existing = { id: "1", company_name: null, gst_number: "" };
  assert.deepEqual(
    missingProfileFields(existing, user({ company_name: "Acme", gst_number: "27ABCDE1234F1Z5" })),
    { company_name: "Acme", gst_number: "27ABCDE1234F1Z5" },
  );
});

test("values the person already set are never overwritten", () => {
  const existing = { id: "1", company_name: "Renamed Ltd", gst_number: "29ABCDE1234F1Z5" };
  assert.deepEqual(
    missingProfileFields(existing, user({ company_name: "Acme", gst_number: "27ABCDE1234F1Z5" })),
    {},
  );
});

test("nothing is patched when there is nothing to add", () => {
  assert.deepEqual(
    missingProfileFields({ id: "1", company_name: "Acme", gst_number: null }, user({})),
    {},
  );
});
