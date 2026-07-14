import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildCandidateProfile } from "../lib/candidate-profile.mjs";
import { contentHash } from "../lib/core.mjs";

const generator = path.resolve("scripts/generate_outputs.mjs");
const scoring = fs.readFileSync(path.resolve("config/scoring.json"), "utf8");

const resume = `# 李梅

## 教育背景

### 城市大学 | 社会学（本科）

- 时间：2020.09 - 2024.06

## 专业技能

- 数据分析：SQL、Tableau、Excel
- 研究方法：用户访谈、问卷设计

## 项目经历

### 社区公共服务调研

- 设计居民问卷并组织用户访谈。
- 使用 SQL 清洗数据并通过 Tableau 制作看板。
- 完成调研报告，为服务点调整提供依据。
`;

const bank = `# 经验库

## 实践经历

### 校园活动满意度分析

- 使用 Excel 汇总问卷结果。
- 向学生组织汇报分析结论。
`;

test("candidate profile is deterministic and traceable to source evidence", () => {
  const first = buildCandidateProfile(resume, bank, "# 偏好\n\n- 目标：数据分析\n");
  const second = buildCandidateProfile(resume, bank, "# 偏好\n\n- 目标：数据分析\n");
  assert.deepEqual(first, second);
  assert.equal(first.candidate.name, "李梅");
  assert.equal(first.education[0].text, "城市大学 | 社会学（本科）");
  assert.ok(first.experiences.some((experience) => experience.heading === "社区公共服务调研"));
  const evidenceIds = new Set(first.evidence.map((record) => record.id));
  for (const experience of first.experiences) {
    for (const id of experience.evidence_ids) assert.ok(evidenceIds.has(id));
  }
});

test("generator uses only the current candidate evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-generic-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "config", "scoring.json"), scoring);
  fs.writeFileSync(path.join(root, "data", "resume.md"), resume);
  fs.writeFileSync(path.join(root, "data", "experience-bank.md"), bank);
  fs.writeFileSync(path.join(root, "data", "profile.md"), "# 偏好\n\n- 目标岗位：数据分析师\n");

  const job = {
    id: "analyst",
    title: "数据分析师",
    company: "远山咨询",
    description: "负责业务数据分析、用户研究和可视化看板，与团队沟通分析结论。",
    requirements: "熟悉 SQL、Tableau 和 Excel，有问卷与访谈经验。",
  };
  job.content_hash = contentHash(job);
  const jobDir = path.join(root, "output", "run-generic", "jobs", job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify(job));

  const marketingJob = {
    id: "marketing-analyst",
    title: "营销数据分析师",
    company: "青屿旅行",
    description: "负责渠道投放、线索收集、转化分析和增长复盘，使用数据看板支持营销决策。",
    requirements: "熟悉 SQL、Tableau，有 A/B 实验或归因分析经验。",
  };
  marketingJob.content_hash = contentHash(marketingJob);
  const marketingJobDir = path.join(root, "output", "run-generic", "jobs", marketingJob.id);
  fs.mkdirSync(marketingJobDir, { recursive: true });
  fs.writeFileSync(path.join(marketingJobDir, "job.json"), JSON.stringify(marketingJob));

  const result = spawnSync("node", [generator, "run-generic"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);

  const profile = JSON.parse(fs.readFileSync(path.join(root, "output", "run-generic", "candidate-profile.json"), "utf8"));
  const output = ["analysis.md", "resume.md", "opener.md", "diagrams.md"]
    .map((file) => fs.readFileSync(path.join(jobDir, file), "utf8"))
    .join("\n");

  assert.equal(profile.candidate.name, "李梅");
  assert.match(output, /社区公共服务调研/);
  assert.match(output, /SQL/i);
  assert.match(output, /证据 ID/);
  const analysis = JSON.parse(fs.readFileSync(path.join(jobDir, "analysis.json"), "utf8"));
  assert.ok(analysis.generated_claims.summary.length > 0);
  assert.ok(analysis.generated_claims.opener.length > 0);
  assert.deepEqual(analysis.evidence.missing, []);
  assert.ok(analysis.matching.capability_requirements.every((entry) => !/开发工程师|远山咨询|负责业务/.test(entry.name)));
  const tailoredResume = fs.readFileSync(path.join(jobDir, "resume.md"), "utf8");
  assert.match(tailoredResume, /求职方向为数据分析师/);
  assert.doesNotMatch(tailoredResume, /岗位相关能力/);
  assert.doesNotMatch(tailoredResume, /方向、|广州、|、方向|、广州/);
  assert.doesNotMatch(tailoredResume, /rag\/|a\/b/i);
  assert.match(tailoredResume, /数据分析与可视化：/);
  const diff = JSON.parse(fs.readFileSync(path.join(jobDir, "diff.json"), "utf8"));
  assert.equal(diff.tailored_resume_hash, contentHash(tailoredResume));
  const changelog = fs.readFileSync(path.join(jobDir, "changelog.md"), "utf8");
  assert.match(changelog, /岗位定制说明/);
  assert.match(changelog, /岗位定制策略/);
  assert.match(changelog, /JD 关注/);
  assert.match(changelog, /已有证据/);
  assert.match(changelog, /实际改写/);
  assert.doesNotMatch(changelog, /新增章节：求职概述/);
  assert.doesNotMatch(changelog, /集中呈现与岗位最相关的教育背景/);
  assert.ok(diff.tailoring.focus_areas.length > 0);
  assert.ok(diff.tailoring.focus_areas.every((focus) => focus.evidence.evidence_id));

  const marketingChangelog = fs.readFileSync(path.join(marketingJobDir, "changelog.md"), "utf8");
  assert.match(marketingChangelog, /营销业务闭环/);
  assert.doesNotMatch(changelog, /营销业务闭环/);
  assert.notEqual(marketingChangelog, changelog);
  const openerMarkdown = fs.readFileSync(path.join(jobDir, "opener.md"), "utf8");
  const visibleOpener = openerMarkdown.split("## 可直接发送")[1]?.split(/^##\s+/m)[0]?.trim() || "";
  assert.ok([...visibleOpener].length <= 200);
  assert.doesNotMatch(visibleOpener, /^(您好|你好|我关注到|看到岗位)/);
  assert.match(openerMarkdown, /## 前 15 字预览/);
  assert.match(openerMarkdown, /## 为什么这样写/);
  const preview = openerMarkdown.match(/^## 前 15 字预览\s*$[\s\S]*?`([^`]+)`/m)?.[1];
  assert.equal(preview, [...visibleOpener].slice(0, 15).join(""));
  const marketingOpener = fs.readFileSync(path.join(marketingJobDir, "opener.md"), "utf8");
  assert.notEqual(marketingOpener, openerMarkdown);
  for (const forbidden of ["LangGraph", "Milvus", "Multi-Agent", "新能源汽车", "产研链", "计算机技术硕士"]) {
    assert.ok(!output.includes(forbidden), `unexpected leaked candidate fact: ${forbidden}`);
  }
});

test("semantic matching reports only bounded, evidence-based capability gaps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-semantic-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "config", "scoring.json"), scoring);
  fs.writeFileSync(path.join(root, "data", "resume.md"), `# 王明\n\n## 专业技能\n\n- Python、LangGraph、FastAPI、RAG、Milvus、Docker\n\n## 项目经历\n\n### 智能客服\n\n- 使用 LangGraph 编排 Agent 工作流，并通过 FastAPI 对接业务 API。\n- 使用 RAG 与 Milvus 构建知识检索服务并完成 Docker 部署。\n`);
  fs.writeFileSync(path.join(root, "data", "experience-bank.md"), "# 经验库\n");
  fs.writeFileSync(path.join(root, "data", "profile.md"), "# 偏好\n");
  const job = {
    id: "agent-role",
    title: "AI Agent 开发工程师",
    company: "示例公司",
    experience: "3-5年",
    description: "负责企业级 Agent 应用研发与系统集成。",
    requirements: "熟悉 Python、LangGraph、RAG、MCP、Prompt 工程、React、Vue、TypeScript、Java、SQL、Docker 与 CI/CD；具备 Agent 工作流、工具调用和后端 API 开发经验。",
  };
  job.content_hash = contentHash(job);
  const jobDir = path.join(root, "output", "run-semantic", "jobs", job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify(job));
  const result = spawnSync("node", [generator, "run-semantic"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const analysis = JSON.parse(fs.readFileSync(path.join(jobDir, "analysis.json"), "utf8"));
  assert.ok(analysis.evidence.matched.includes("Agent 工作流与编排"));
  assert.ok(analysis.evidence.matched.includes("工具调用与系统集成"));
  assert.ok(analysis.evidence.missing.length <= 5);
  assert.ok(analysis.scores.experience_depth < 100);
  assert.equal(analysis.experience_assessment.required_months, 36);
  assert.ok(analysis.experience_assessment.relevant_months <= 12);
  assert.ok(analysis.evidence.missing.every((item) => !/开发工程师|示例公司|负责企业级/.test(item)));
  assert.ok(analysis.matching.capability_requirements
    .filter((entry) => entry.matched)
    .every((entry) => entry.evidence_ids.length > 0));
});

test("humanities evidence is matched and written without engineering defaults", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-humanities-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "config", "scoring.json"), scoring);
  fs.writeFileSync(path.join(root, "data", "resume.md"), resume);
  fs.writeFileSync(path.join(root, "data", "experience-bank.md"), bank);
  fs.writeFileSync(path.join(root, "data", "profile.md"), "# 偏好\n\n- 目标岗位：用户研究\n");
  const job = {
    id: "user-research",
    title: "用户研究专员",
    company: "明川公益",
    description: "通过调研支持公共服务优化，与项目团队沟通研究结论。",
    requirements: "具备用户访谈、问卷设计、调研报告撰写和跨部门协调经验。",
  };
  job.content_hash = contentHash(job);
  const jobDir = path.join(root, "output", "run-humanities", "jobs", job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify(job));
  const result = spawnSync("node", [generator, "run-humanities"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const analysis = JSON.parse(fs.readFileSync(path.join(jobDir, "analysis.json"), "utf8"));
  assert.ok(analysis.evidence.matched.includes("研究与调研分析"));
  const opener = fs.readFileSync(path.join(jobDir, "opener.md"), "utf8");
  assert.match(opener, /做过用户研究与调研分析/);
  assert.doesNotMatch(opener, /相关研发|技术栈|工程交付/);
  const resumeOutput = fs.readFileSync(path.join(jobDir, "resume.md"), "utf8");
  assert.match(resumeOutput, /研究设计与调研分析：/);
});
