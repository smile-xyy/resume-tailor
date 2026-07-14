import assert from "node:assert/strict";
import test from "node:test";
import { resumeMarkdownToAtsHtml, validateAtsHtml } from "../lib/ats-html.mjs";

test("ATS HTML is single-column, textual, and uses standard headings", () => {
  const html = resumeMarkdownToAtsHtml("# 张三\n\n## 工作经历\n\n### 示例公司\n\n- 开发接口\n");
  assert.deepEqual(validateAtsHtml(html), []);
  assert.match(html, /<h1>张三<\/h1>/);
  assert.doesNotMatch(html, /<img|<table|<script/);
});

test("ATS HTML validator rejects hidden text and images", () => {
  assert.ok(validateAtsHtml("<h1>A</h1><h2>B</h2><img><p style='display:none'>x</p>").length >= 1);
});
