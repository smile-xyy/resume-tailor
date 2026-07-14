#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { screenshotEnvelope, validateScreenshotJob } from "../lib/screenshot-intake.mjs";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const [runId, inputPath] = process.argv.slice(2);
if (!runId || !inputPath) {
  console.error("用法：node scripts/import_screenshot_job.mjs <run_id> <截图解析JSON路径>");
  process.exit(2);
}

const fullPath = path.resolve(inputPath);
const raw = JSON.parse(fs.readFileSync(fullPath, "utf8"));
const jobs = Array.isArray(raw.jobs) ? raw.jobs : [raw];
const warnings = [];
for (const [index, job] of jobs.entries()) {
  const result = validateScreenshotJob(job);
  warnings.push(...result.warnings.map((warning) => `岗位 ${index + 1}：${warning}`));
  if (result.errors.length) {
    for (const error of result.errors) console.error(`岗位 ${index + 1}：${error}`);
    process.exit(1);
  }
}
for (const warning of warnings) console.warn(warning);

const normalizedInput = path.join(root, "output", runId, "screenshot-intake.json");
fs.mkdirSync(path.dirname(normalizedInput), { recursive: true });
const payload = jobs.length === 1 ? screenshotEnvelope(jobs[0]) : {
  format: "resume-tailor-jobs",
  version: 1,
  exported_at: new Date().toISOString(),
  jobs
};
fs.writeFileSync(normalizedInput, `${JSON.stringify(payload, null, 2)}\n`);

const result = spawnSync("node", [path.join(scriptDir, "import_jobs.mjs"), runId, normalizedInput], {
  stdio: "inherit",
  shell: false
});
process.exit(result.status ?? 1);
