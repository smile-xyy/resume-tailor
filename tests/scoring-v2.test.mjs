import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { contentHash } from "../lib/core.mjs";

const generator = path.resolve("scripts/generate_outputs.mjs");
const scoring = fs.readFileSync(path.resolve("config/scoring.json"), "utf8");

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-scoring-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "config", "scoring.json"), scoring);
  fs.writeFileSync(path.join(root, "data", "resume.md"), `# 张三

## 基本信息

- 城市：示例城市

## 专业技能

- Python、LangGraph、FastAPI、RAG、Milvus

## 项目经历

### Agent 项目

- 使用 LangGraph 和 FastAPI 构建 Agent 工作流并完成上线。
`);
  fs.writeFileSync(path.join(root, "data", "experience-bank.md"), "# 经验库\n\n- 使用 RAG 和 Milvus。\n");
  fs.writeFileSync(path.join(root, "data", "profile.md"), "# Profile\n");
  const jobsDir = path.join(root, "output", "run-1", "jobs");
  for (let index = 0; index < 6; index += 1) {
    const job = {
      id: `job-${index}`,
      title: `AI Agent 工程师 ${index}`,
      company: `示例公司 ${index}`,
      description: "负责 Agent 工作流、RAG 知识库、FastAPI 接口和业务系统联调，参与团队协作并完成上线。",
      requirements: "熟悉 Python、LangGraph、Milvus、Redis 和 Docker，具备 1-3 年相关经验。",
      tags: ["Python", "LangGraph", "RAG"],
      content_hash: ""
    };
    job.content_hash = contentHash(job);
    const dir = path.join(jobsDir, job.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
  }
  return root;
}

test("five-dimension scoring, Top N analysis, and cache are operational", () => {
  const root = createFixture();
  const first = spawnSync("node", [generator, "run-1"], { cwd: root, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const jobsDir = path.join(root, "output", "run-1", "jobs");
  const analyses = fs.readdirSync(jobsDir).map((id) =>
    JSON.parse(fs.readFileSync(path.join(jobsDir, id, "analysis.json"), "utf8"))
  );
  for (const analysis of analyses) {
    assert.ok(Number.isFinite(analysis.scores.job_quality));
    assert.ok(Array.isArray(analysis.job_quality.signals));
  }
  assert.equal(analyses.filter((analysis) => analysis.deep_analysis.included).length, 5);

  const second = spawnSync("node", [generator, "run-1"], { cwd: root, encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  const state = JSON.parse(fs.readFileSync(path.join(root, "output", "run-1", "state.json"), "utf8"));
  assert.equal(state.analysis_cache_hits, 6);
  assert.equal(state.deep_analyzed.length, 5);
});
