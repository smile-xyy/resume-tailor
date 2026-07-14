import assert from "node:assert/strict";
import test from "node:test";
import {
  auditResume,
  buildStarResume,
  cleanResumeFormatting,
  inspectResumeFormat
} from "../lib/resume-preprocess.mjs";

const goodResume = `# 张三

## 教育背景

### 示例大学 | 计算机

- 时间：2020.09 - 2024.06
- GPA：3.8/4

## 实习经历

### 示例公司 | 开发实习生

- 面向内部业务系统，负责接口开发任务。
- 使用 FastAPI 设计并实现查询接口，使响应时间降低 20%。

## 项目经历

### RAG 项目

- 基于 Milvus 构建向量检索并完成上线。
- 使用 BM25 与向量召回融合，提高复杂技术需求下的候选结果相关性。
- 设计 FastAPI 查询接口并完成业务系统联调，支持分页查询和状态流转。
`;

test("well-structured resume passes format inspection", () => {
  assert.equal(inspectResumeFormat(goodResume).valid, true);
});

test("format cleaning removes zero-width chars and normalizes bullets", () => {
  const cleaned = cleanResumeFormatting("# 张\u200B三\n\n## 项目经历\n\n● 使用 FastAPI\n\n\n\n· 完成上线");
  assert.doesNotMatch(cleaned, /\u200B|●|·/);
  assert.match(cleaned, /- 使用 FastAPI/);
});

test("STAR extraction only processes experience sections", () => {
  const star = buildStarResume(goodResume);
  assert.equal(star.experiences.length, 2);
  assert.equal(star.experiences.some((entry) => entry.heading.includes("示例大学")), false);
  const internship = star.experiences.find((entry) => entry.heading.includes("示例公司"));
  assert.ok(internship.action.length);
  assert.ok(internship.result.length);
});

test("resume audit flags empty shells without reporting education", () => {
  const resume = `# 张三

## 教育背景

### 示例大学 | 本科

- 时间：2020.09 - 2024.06

## 工作经历

### 空壳公司 | 工程师
`;
  const star = buildStarResume(resume);
  const audit = auditResume(resume, star);
  assert.ok(audit.issues.some((issue) => issue.type === "empty_shell" && issue.target.includes("空壳公司")));
  assert.equal(audit.issues.some((issue) => issue.target.includes("示例大学")), false);
});
