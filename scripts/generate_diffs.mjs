#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../lib/core.mjs";
import { buildChangelogFromDiff, buildResumeDiff } from "../lib/resume-diff.mjs";
import { ensureRunInputs } from "../lib/run-inputs.mjs";

const root = process.cwd();
const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/generate_diffs.mjs <run_id>");
  process.exit(2);
}

const runDir = path.join(root, "output", runId);
const jobsDir = path.join(runDir, "jobs");
const { resume } = ensureRunInputs(root, runDir);
let count = 0;

for (const entry of fs.readdirSync(jobsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(jobsDir, entry.name);
  const job = JSON.parse(fs.readFileSync(path.join(dir, "job.json"), "utf8"));
  const tailored = fs.readFileSync(path.join(dir, "resume.md"), "utf8");
  const diff = buildResumeDiff(resume, tailored);
  writeJsonAtomic(path.join(dir, "diff.json"), diff);
  fs.writeFileSync(path.join(dir, "changelog.md"), buildChangelogFromDiff(job, diff));
  count += 1;
}

console.log(`OK: generated verified diffs and changelogs for ${count} job(s)`);
