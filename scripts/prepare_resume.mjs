#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../lib/core.mjs";
import {
  auditResume,
  buildStarResume,
  cleanResumeFormatting,
  inspectResumeFormat,
  renderAuditMarkdown,
  renderStarMarkdown
} from "../lib/resume-preprocess.mjs";

const root = process.cwd();
const runId = process.argv[2];
if (!runId) {
  console.error("用法：node scripts/prepare_resume.mjs <run_id>");
  process.exit(2);
}

const resumePath = path.join(root, "data", "resume.md");
const rawPath = path.join(root, "data", "resume.raw.md");
const starPath = path.join(root, "data", "resume.star.md");
const hashPath = path.join(root, "data", "resume.md.hash");
const runDir = path.join(root, "output", runId);
let resume = fs.readFileSync(resumePath, "utf8");
const format = inspectResumeFormat(resume);

if (!format.valid) {
  if (!fs.existsSync(rawPath)) fs.writeFileSync(rawPath, resume);
  const cleaned = cleanResumeFormatting(resume);
  if (cleaned !== resume) {
    fs.writeFileSync(resumePath, cleaned);
    resume = cleaned;
  }
}

const star = buildStarResume(resume);
const cachedHash = fs.existsSync(hashPath) ? fs.readFileSync(hashPath, "utf8").trim() : "";
const cacheHit = cachedHash === star.resume_hash && fs.existsSync(starPath);
if (!cacheHit) {
  fs.writeFileSync(starPath, renderStarMarkdown(star));
  fs.writeFileSync(hashPath, `${star.resume_hash}\n`);
}

const audit = { ...auditResume(resume, star), format, star_cache_hit: cacheHit };
fs.mkdirSync(runDir, { recursive: true });
writeJsonAtomic(path.join(runDir, "resume-audit.json"), audit);
fs.writeFileSync(path.join(runDir, "resume-audit.md"), renderAuditMarkdown(audit));
console.log(`OK: resume prepared; STAR cache ${cacheHit ? "hit" : "refreshed"}`);
