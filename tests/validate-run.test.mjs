import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { contentHash } from "../lib/core.mjs";
import { buildCoverLetterStatus, renderCoverLetterDraft } from "../lib/cover-letter.mjs";
import { buildChangelogFromDiff, buildResumeDiff } from "../lib/resume-diff.mjs";

const validator = path.resolve("scripts/validate_run.mjs");

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function createValidRun() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-validate-"));
  const runId = "test-run";
  const runDir = path.join(root, "output", runId);
  const inputsDir = path.join(runDir, "inputs");
  const jobDir = path.join(runDir, "jobs", "example-ai-engineer");
  const resume = "# 张三\n\n## 工作经历\n\n### 示例公司 | AI 工程师\n\n- 时间：2024.01 - 2025.01\n- 使用 FastAPI 开发接口。\n";
  const bank = "# Experience Bank\n";
  const profile = "# Profile\n";
  const scoring = {
    version: "1.0.0",
    weights: {
      hard_skills: 0.35,
      experience_depth: 0.25,
      domain_fit: 0.25,
      soft_fit: 0.15
    },
    tiers: { strong: 80, viable: 65, stretch: 50 }
  };
  const job = {
    title: "AI 工程师",
    company: "示例公司",
    description: "FastAPI",
    requirements: "",
    content_hash: contentHash({
      title: "AI 工程师",
      company: "示例公司",
      description: "FastAPI",
      requirements: "",
      url: ""
    })
  };
  const scores = {
    hard_skills: 60,
    experience_depth: 40,
    domain_fit: 50,
    soft_fit: 50,
    total: 51
  };
  const diff = buildResumeDiff(resume, resume);

  write(path.join(root, "config", "scoring.json"), scoring);
  write(path.join(inputsDir, "resume.md"), resume);
  write(path.join(inputsDir, "experience-bank.md"), bank);
  write(path.join(inputsDir, "profile.md"), profile);
  write(path.join(inputsDir, "manifest.json"), {
    resume_hash: contentHash(resume),
    experience_bank_hash: contentHash(bank),
    profile_hash: contentHash(profile),
    combined_evidence_hash: contentHash(`${resume}\n${bank}`),
    immutable_values: ["张三", "示例公司 | AI 工程师", "2024.01 - 2025.01"],
    captured_at: new Date().toISOString()
  });
  write(path.join(jobDir, "job.json"), job);
  write(path.join(jobDir, "analysis.json"), {
    resume_hash: contentHash(`${resume}\n${bank}`),
    job_hash: job.content_hash,
    scoring_version: scoring.version,
    scores,
    recommendation: { tier: "stretch" }
  });
  write(path.join(jobDir, "analysis.md"), "# Analysis\n\nOverall score: 51/100\n");
  write(path.join(jobDir, "resume.md"), resume);
  write(path.join(jobDir, "diff.json"), diff);
  write(path.join(jobDir, "changelog.md"), buildChangelogFromDiff(job, diff));
  write(path.join(jobDir, "opener.md"), "# Opener\n");
  write(path.join(jobDir, "diagrams.md"), "# Diagrams\n");
  write(path.join(runDir, "state.json"), {
    run_id: runId,
    imported: ["example-ai-engineer"],
    analyzed: ["example-ai-engineer"],
    tailored: ["example-ai-engineer"]
  });
  return { root, runId, jobDir };
}

function validate(root, runId) {
  return spawnSync("node", [validator, runId], { cwd: root, encoding: "utf8" });
}

test("run validator accepts a consistent run", () => {
  const fixture = createValidRun();
  const result = validate(fixture.root, fixture.runId);
  assert.equal(result.status, 0, result.stderr);
});

test("run validator rejects immutable resume values being removed", () => {
  const fixture = createValidRun();
  const resumePath = path.join(fixture.jobDir, "resume.md");
  fs.writeFileSync(resumePath, fs.readFileSync(resumePath, "utf8").replace("# 张三", "# 李四"));
  const result = validate(fixture.root, fixture.runId);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Immutable resume value missing/);
});

test("run validator rejects changelog claims not generated from the diff", () => {
  const fixture = createValidRun();
  fs.appendFileSync(path.join(fixture.jobDir, "changelog.md"), "\n1. 不存在的改动。\n");
  const result = validate(fixture.root, fixture.runId);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Changelog is not generated from current diff/);
});

test("run validator rejects a modified approved Cover Letter", () => {
  const fixture = createValidRun();
  const answers = {
    motivation: "岗位方向与我的目标一致。",
    relevant_experience: "完成过相关接口开发。",
    problem_to_solve: "提升系统交付效率。",
    contact: "广州，user@example.com。",
  };
  const job = JSON.parse(fs.readFileSync(path.join(fixture.jobDir, "job.json"), "utf8"));
  const draft = renderCoverLetterDraft(job, answers);
  write(path.join(fixture.jobDir, "cover-letter-input.json"), answers);
  write(path.join(fixture.jobDir, "cover-letter-draft.md"), draft);
  write(path.join(fixture.jobDir, "cover-letter.md"), `${draft}\n未经批准的追加内容。\n`);
  write(path.join(fixture.jobDir, "cover-letter-status.json"), buildCoverLetterStatus({
    state: "approved",
    answers,
    draft,
    final: draft,
    approvedDraftHash: contentHash(draft),
  }));

  const result = validate(fixture.root, fixture.runId);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid Cover Letter/);
});
