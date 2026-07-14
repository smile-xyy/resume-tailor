import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  contentHash,
  readRunState,
  serializeForInlineScript,
  slug,
  updateRunState,
  validateJob
} from "../lib/core.mjs";

test("content hashes are stable across object key order", () => {
  assert.equal(contentHash({ b: 2, a: 1 }), contentHash({ a: 1, b: 2 }));
});

test("inline script serialization neutralizes HTML and line separators", () => {
  const serialized = serializeForInlineScript({
    lower: "</script>",
    mixed: "</ScRiPt>",
    html: "<img src=x onerror=alert(1)>",
    comment: "<!--",
    separators: "\u2028\u2029",
    ampersand: "&"
  });
  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes(">"), false);
  assert.equal(serialized.includes("&"), false);
  assert.equal(serialized.includes("\u2028"), false);
  assert.equal(serialized.includes("\u2029"), false);
  assert.match(serialized, /\\u003c/);
});

test("job validation requires a title and body", () => {
  assert.deepEqual(validateJob({ title: "", description: "", requirements: "" }), [
    "title is required",
    "description or requirements is required"
  ]);
  assert.deepEqual(validateJob({ title: "AI Engineer", requirements: "Python" }), []);
});

test("job validation accepts requirements when description is absent", () => {
  assert.deepEqual(validateJob({ title: "RAG Engineer", requirements: "Milvus" }), []);
});

test("slug supports Chinese names and removes unsafe path characters", () => {
  assert.equal(slug("趣步科技 / AI Agent"), "趣步科技-ai-agent");
});

test("run state updates atomically and preserves prior fields", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-"));
  updateRunState(directory, "test-run", { phase: "imported", imported: ["job-1"] });
  updateRunState(directory, "test-run", { phase: "generated", analyzed: ["job-1"] });
  const state = readRunState(directory, "test-run");
  assert.equal(state.phase, "generated");
  assert.deepEqual(state.imported, ["job-1"]);
  assert.deepEqual(state.analyzed, ["job-1"]);
  assert.ok(state.checkpoint_at);
});
