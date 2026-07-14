#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildCoverLetterStatus,
  normalizeCoverLetterAnswers,
  renderCoverLetterDraft,
  renderCoverLetterQuestions,
} from "../lib/cover-letter.mjs";
import { contentHash, writeJsonAtomic } from "../lib/core.mjs";

const root = process.cwd();
const [runId, jobId, third, fourth] = process.argv.slice(2);

if (!runId || !jobId) {
  console.error("Usage: node scripts/cover_letter.mjs <run-id> <job-id> [answers.json | --approve <draft-hash>]");
  process.exit(2);
}

const jobDir = path.join(root, "output", runId, "jobs", jobId);
const jobPath = path.join(jobDir, "job.json");
const inputPath = path.join(jobDir, "cover-letter-input.json");
const questionsPath = path.join(jobDir, "cover-letter-questions.md");
const draftPath = path.join(jobDir, "cover-letter-draft.md");
const finalPath = path.join(jobDir, "cover-letter.md");
const statusPath = path.join(jobDir, "cover-letter-status.json");

if (!fs.existsSync(jobPath)) {
  console.error(`Unknown run job: ${runId}/${jobId}`);
  process.exit(1);
}

const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));

function write(file, content) {
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

function clearUnapprovedArtifacts() {
  for (const file of [inputPath, draftPath, finalPath]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

if (third === "--approve") {
  if (!fourth) {
    console.error("Approval requires the exact draft hash.");
    process.exit(2);
  }
  if (!fs.existsSync(inputPath) || !fs.existsSync(draftPath) || !fs.existsSync(statusPath)) {
    console.error("Create a complete draft before approval.");
    process.exit(1);
  }
  const answers = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const draft = fs.readFileSync(draftPath, "utf8");
  const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
  const draftHash = contentHash(draft);
  if (
    fourth !== draftHash ||
    status.state !== "awaiting_approval" ||
    status.answers_hash !== contentHash(answers) ||
    status.draft_hash !== draftHash
  ) {
    console.error("Approval rejected: draft or answers changed, or hash does not match.");
    process.exit(1);
  }
  write(finalPath, draft);
  writeJsonAtomic(statusPath, buildCoverLetterStatus({
    state: "approved",
    answers,
    draft,
    final: draft,
    approvedDraftHash: draftHash,
  }));
  console.log(`APPROVED: ${path.relative(root, finalPath)}`);
  process.exit(0);
}

if (!third) {
  clearUnapprovedArtifacts();
  write(questionsPath, renderCoverLetterQuestions(job));
  writeJsonAtomic(statusPath, buildCoverLetterStatus({ state: "needs_answers" }));
  console.log(`NEEDS_ANSWERS: ${path.relative(root, questionsPath)}`);
  process.exit(0);
}

const answersSource = path.resolve(third);
const rawAnswers = JSON.parse(fs.readFileSync(answersSource, "utf8"));
const { answers, missing } = normalizeCoverLetterAnswers(rawAnswers);
if (missing.length) {
  clearUnapprovedArtifacts();
  write(questionsPath, renderCoverLetterQuestions(job, missing));
  writeJsonAtomic(statusPath, buildCoverLetterStatus({ state: "needs_answers", answers }));
  console.log(`NEEDS_ANSWERS: ${missing.join(", ")}`);
  process.exit(0);
}

const draft = renderCoverLetterDraft(job, answers);
writeJsonAtomic(inputPath, answers);
write(draftPath, draft);
if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
writeJsonAtomic(statusPath, buildCoverLetterStatus({ state: "awaiting_approval", answers, draft }));
console.log(`AWAITING_APPROVAL: ${path.relative(root, draftPath)}`);
console.log(`DRAFT_HASH: ${contentHash(draft)}`);
