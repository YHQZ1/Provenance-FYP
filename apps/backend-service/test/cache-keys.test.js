import assert from "node:assert/strict";
import test from "node:test";

import {
  answerSourceTag,
  classificationCacheText,
  questionCacheText,
} from "../src/lib/cache-keys.js";

test("the same product shares a classification whatever the quantity", () => {
  const may = { description: "PET Preform  25g Neck 1810", quantity: 500, unit: "kg" };
  const june = { description: "pet preform 25g neck 1810", quantity: 1250, unit: "KG" };
  assert.equal(classificationCacheText(may), classificationCacheText(june));
});

test("a different unit or product is a different classification", () => {
  const film = { description: "BOPP film", unit: "kg" };
  assert.notEqual(classificationCacheText(film), classificationCacheText({ ...film, unit: "rolls" }));
  assert.notEqual(classificationCacheText(film), classificationCacheText({ description: "BOPP bags", unit: "kg" }));
});

test("questions differing only in case, spacing or punctuation share an answer", () => {
  assert.equal(
    questionCacheText("How is environmental compensation calculated?"),
    questionCacheText("  how is environmental   compensation calculated "),
  );
  assert.notEqual(questionCacheText("What is a PIBO?"), questionCacheText("What is a PRO?"));
});

test("the answer source tag changes with the model or sources, and is null when unknown", () => {
  const base = answerSourceTag(["llama3.2:3b", "all-MiniLM-L6-v2", 26]);
  assert.match(base, /^[0-9a-f]{12}$/);
  assert.equal(base, answerSourceTag(["llama3.2:3b", "all-MiniLM-L6-v2", 26]));
  assert.notEqual(base, answerSourceTag(["llama3.1:8b", "all-MiniLM-L6-v2", 26]));
  assert.notEqual(base, answerSourceTag(["llama3.2:3b", "all-MiniLM-L6-v2", 27]));
  assert.equal(answerSourceTag(["llama3.2:3b", undefined, 26]), null);
});
