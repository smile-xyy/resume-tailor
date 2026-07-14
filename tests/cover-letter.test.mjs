import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { contentHash } from "../lib/core.mjs";
import { validateCoverLetterFinal } from "../lib/cover-letter.mjs";

const script = path.resolve("scripts/cover_letter.mjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-cover-"));
  const jobDir = path.join(root, "output", "run-1", "jobs", "job-1");
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify({
    id: "job-1",
    company: "远山咨询",
    title: "数据分析师",
  }));
  return { root, jobDir };
}

function run(root, args) {
  return spawnSync("node", [script, ...args], { cwd: root, encoding: "utf8" });
}

test("Cover Letter requires answers, draft review, and exact-hash approval", () => {
  const { root, jobDir } = fixture();
  const questions = run(root, ["run-1", "job-1"]);
  assert.equal(questions.status, 0, questions.stderr);
  assert.ok(fs.existsSync(path.join(jobDir, "cover-letter-questions.md")));
  assert.ok(!fs.existsSync(path.join(jobDir, "cover-letter.md")));

  const answers = {
    motivation: "贵公司的公共服务数据项目与我的研究方向一致。",
    relevant_experience: "我完成过社区公共服务调研和数据看板。",
    problem_to_solve: "提升调研数据到业务决策的转化效率。",
    contact: "广州，邮箱 user@example.com。",
  };
  const answersPath = path.join(root, "answers.json");
  fs.writeFileSync(answersPath, JSON.stringify(answers));
  const drafted = run(root, ["run-1", "job-1", answersPath]);
  assert.equal(drafted.status, 0, drafted.stderr);
  assert.ok(fs.existsSync(path.join(jobDir, "cover-letter-draft.md")));
  assert.ok(!fs.existsSync(path.join(jobDir, "cover-letter.md")));

  const rejected = run(root, ["run-1", "job-1", "--approve", "wrong-hash"]);
  assert.notEqual(rejected.status, 0);
  assert.ok(!fs.existsSync(path.join(jobDir, "cover-letter.md")));

  const draft = fs.readFileSync(path.join(jobDir, "cover-letter-draft.md"), "utf8");
  const approved = run(root, ["run-1", "job-1", "--approve", contentHash(draft)]);
  assert.equal(approved.status, 0, approved.stderr);
  const final = fs.readFileSync(path.join(jobDir, "cover-letter.md"), "utf8");
  const status = JSON.parse(fs.readFileSync(path.join(jobDir, "cover-letter-status.json"), "utf8"));
  const savedAnswers = JSON.parse(fs.readFileSync(path.join(jobDir, "cover-letter-input.json"), "utf8"));
  assert.equal(final, draft);
  assert.deepEqual(validateCoverLetterFinal({ answers: savedAnswers, draft, final, status }), []);
});

test("changing answers invalidates a prior approval", () => {
  const { root, jobDir } = fixture();
  const firstPath = path.join(root, "first.json");
  const secondPath = path.join(root, "second.json");
  const base = {
    motivation: "方向匹配。",
    relevant_experience: "完成过数据分析。",
    problem_to_solve: "提升分析效率。",
    contact: "广州，user@example.com。",
  };
  fs.writeFileSync(firstPath, JSON.stringify(base));
  fs.writeFileSync(secondPath, JSON.stringify({ ...base, motivation: "新的申请原因。" }));
  assert.equal(run(root, ["run-1", "job-1", firstPath]).status, 0);
  const firstDraft = fs.readFileSync(path.join(jobDir, "cover-letter-draft.md"), "utf8");
  assert.equal(run(root, ["run-1", "job-1", "--approve", contentHash(firstDraft)]).status, 0);
  assert.ok(fs.existsSync(path.join(jobDir, "cover-letter.md")));

  assert.equal(run(root, ["run-1", "job-1", secondPath]).status, 0);
  assert.ok(!fs.existsSync(path.join(jobDir, "cover-letter.md")));
  const staleApproval = run(root, ["run-1", "job-1", "--approve", contentHash(firstDraft)]);
  assert.notEqual(staleApproval.status, 0);
});
