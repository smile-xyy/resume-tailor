#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { resumeMarkdownToAtsHtml, validateAtsHtml } from "../lib/ats-html.mjs";

const root = process.cwd();
const runId = process.argv[2];
const selectedJobId = process.argv[3];
if (!runId) {
  console.error("用法：node scripts/build_ats_html.mjs <run_id> [job_id]");
  process.exit(2);
}
const jobsDir = path.join(root, "output", runId, "jobs");
let count = 0;
for (const entry of fs.readdirSync(jobsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || (selectedJobId && entry.name !== selectedJobId)) continue;
  const dir = path.join(jobsDir, entry.name);
  const job = JSON.parse(fs.readFileSync(path.join(dir, "job.json"), "utf8"));
  const markdown = fs.readFileSync(path.join(dir, "resume.md"), "utf8");
  const html = resumeMarkdownToAtsHtml(markdown, `${job.company || "未知公司"} · ${job.title || "未知职位"}`);
  const errors = validateAtsHtml(html);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  fs.writeFileSync(path.join(dir, "resume.html"), html);
  count += 1;
}
console.log(`OK: generated ${count} ATS HTML resume(s); PDF renderer not invoked`);
