import assert from "node:assert/strict";
import test from "node:test";
import { inspectProjectBrief, renderProjectDiagram } from "../lib/diagram-brief.mjs";

test("diagram brief asks focused questions when information is thin", () => {
  const inspection = inspectProjectBrief("做了一个内容运营项目。");
  assert.equal(inspection.sufficient, false);
  assert.ok(inspection.questions.length >= 1);
  assert.ok(inspection.questions.length <= 3);
});

test("diagram brief renders user-provided ordered steps", () => {
  const source = `项目从用户需求开始，最终完成复盘。

- 收集用户需求
- 制定内容计划
- 执行发布
- 数据复盘
`;
  const inspection = inspectProjectBrief(source);
  assert.equal(inspection.sufficient, true);
  const output = renderProjectDiagram("内容项目", source, inspection);
  assert.match(output, /mindmap/);
  assert.match(output, /收集用户需求/);
  assert.match(output, /数据复盘/);
  assert.match(output, /## 项目讲解稿/);
  assert.match(output, /Mermaid Live/);
  assert.doesNotMatch(output, /N1 --> N2 --> N3/);
});
