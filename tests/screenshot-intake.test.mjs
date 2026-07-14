import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateScreenshotJob } from "../lib/screenshot-intake.mjs";

const importer = path.resolve("scripts/import_screenshot_job.mjs");

function validScreenshotJob() {
  return {
    source: { type: "screenshot", files: ["boss-job.png"] },
    platform: "boss",
    title: "AI Agent 开发工程师",
    company: null,
    salary: "20-30K",
    location: "广州",
    education: null,
    experience: "1-3年",
    description: "负责 Agent 工作流开发。",
    requirements: "熟悉 Python 和 LangGraph。",
    tags: ["LangGraph"],
    benefits: [],
    hr_name: null,
    hr_active_status: null,
    url: null,
    needs_confirmation: ["company", "education", "hr_name", "hr_active_status", "url"],
    excluded_content: ["页面右侧推荐岗位"]
  };
}

test("screenshot intake accepts null fields when marked for confirmation", () => {
  assert.deepEqual(validateScreenshotJob(validScreenshotJob()).errors, []);
});

test("screenshot intake rejects missing job title", () => {
  const job = validScreenshotJob();
  job.title = null;
  job.needs_confirmation.push("title");
  const result = validateScreenshotJob(job);
  assert.match(result.errors.join(" "), /无法确认岗位名称/);
});

test("screenshot intake rejects unknown confirmation fields", () => {
  const job = validScreenshotJob();
  job.needs_confirmation.push("recommended_jobs");
  const result = validateScreenshotJob(job);
  assert.match(result.errors.join(" "), /未知字段/);
});

test("screenshot import preserves source files, nulls, and excluded content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-screenshot-"));
  const input = path.join(root, "parsed.json");
  fs.writeFileSync(input, JSON.stringify(validScreenshotJob()));
  const result = spawnSync("node", [importer, "run-1", input], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const jobsDir = path.join(root, "output", "run-1", "jobs");
  const [jobId] = fs.readdirSync(jobsDir);
  const imported = JSON.parse(fs.readFileSync(path.join(jobsDir, jobId, "job.json"), "utf8"));
  assert.equal(imported.source.type, "screenshot");
  assert.deepEqual(imported.source.files, ["boss-job.png"]);
  assert.equal(imported.company, null);
  assert.equal(imported.education, null);
  assert.ok(imported.needs_confirmation.includes("company"));
  assert.deepEqual(imported.excluded_content, ["页面右侧推荐岗位"]);
});
