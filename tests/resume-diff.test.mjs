import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChangelogFromDiff,
  buildResumeDiff,
  changelogOperationIds
} from "../lib/resume-diff.mjs";

const base = `# 张三

## 项目经历

### 项目 A

- 使用 FastAPI 开发接口。
- 响应时间降低 20%。

### 项目 B

- 使用 Milvus 构建检索。
`;

test("resume diff recognizes block moves and rewrites", () => {
  const tailored = `# 张三

## 求职概述

- 聚焦 AI Agent 开发。

## 项目经历

### 项目 B

- 使用 Milvus 构建检索。

### 项目 A

- 使用 FastAPI 完成业务接口开发。
- 响应时间降低 20%。
`;
  const diff = buildResumeDiff(base, tailored);
  assert.ok(diff.operations.some((operation) => operation.type === "move" && operation.block === "项目 A"));
  assert.ok(diff.operations.some((operation) => operation.type === "rewrite"));
  assert.ok(diff.operations.some((operation) => operation.type === "add" && operation.section === "求职概述"));
});

test("changelog is traceable to every diff operation", () => {
  const tailored = `${base}\n## 求职概述\n\n- [需确认] 补充项目规模。\n`;
  const diff = buildResumeDiff(base, tailored);
  const changelog = buildChangelogFromDiff({ company: "示例公司", title: "AI 工程师" }, diff);
  assert.deepEqual(
    new Set(changelogOperationIds(changelog)),
    new Set(diff.operations.map((operation) => operation.id))
  );
  assert.match(changelog, /确认/);
  assert.match(changelog, /岗位定制说明/);
  assert.doesNotMatch(changelog, /新增章节：求职概述/);
});

test("changelog explains JD focus, evidence, actual rewrite, and evidence gaps", () => {
  const tailored = base.replace(
    "使用 FastAPI 开发接口。",
    "后端 API 与系统联调：使用 FastAPI 开发接口。"
  );
  const diff = buildResumeDiff(base, tailored);
  const rewrite = diff.operations.find((operation) => operation.type === "rewrite");
  diff.tailoring = {
    primary_experiences: ["项目 A"],
    matched_keywords: ["FastAPI", "API"],
    focus_areas: [{
      id: "backend_api",
      name: "后端 API 与联调",
      requirement: "使用 Python 开发 API 并完成系统联调",
      reason: "把接口实现与联调范围写清楚，直接回应后端交付要求。",
      evidence: {
        heading: "项目 A",
        text: "使用 FastAPI 开发接口。",
        evidence_id: "ev-example"
      },
      operation_ids: [rewrite.id]
    }],
    evidence_gaps: [{
      id: "testing",
      name: "接口测试与回归",
      requirement: "需要自动化测试经验",
      suggestion: "若真实做过，请补充测试范围和通过结果；否则不要写入。"
    }]
  };
  const changelog = buildChangelogFromDiff({ company: "示例公司", title: "后端工程师" }, diff);
  assert.match(changelog, /岗位定制策略/);
  assert.match(changelog, /JD 关注：.*Python 开发 API/);
  assert.match(changelog, /已有证据：.*项目 A/);
  assert.match(changelog, /实际改写/);
  assert.match(changelog, /为什么这样改/);
  assert.match(changelog, /尚未自动写入的优化建议/);
  assert.match(changelog, /接口测试与回归/);
});

test("resume diff records result bullet reordering", () => {
  const tailored = base.replace(
    "- 使用 FastAPI 开发接口。\n- 响应时间降低 20%。",
    "- 响应时间降低 20%。\n- 使用 FastAPI 开发接口。"
  );
  const diff = buildResumeDiff(base, tailored);
  assert.ok(diff.operations.some((operation) =>
    operation.type === "move" &&
    operation.scope === "item" &&
    operation.before === "响应时间降低 20%。"
  ));
});

test("unchanged resume produces an explicit no-change changelog", () => {
  const diff = buildResumeDiff(base, base);
  assert.equal(diff.operations.length, 0);
  assert.match(buildChangelogFromDiff({}, diff), /未改动正文/);
});
