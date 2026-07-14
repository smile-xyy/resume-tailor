#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { contentHash } from "../lib/core.mjs";
import { validateAtsHtml } from "../lib/ats-html.mjs";
import { validateCoverLetterFinal } from "../lib/cover-letter.mjs";
import { buildChangelogFromDiff, changelogOperationIds } from "../lib/resume-diff.mjs";
import { resolveProjectRoot } from "../lib/project-root.mjs";

const root = process.cwd();
const projectRoot = resolveProjectRoot(root, "config/scoring.json", import.meta.url);
const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/validate_run.mjs <run_id>");
  process.exit(2);
}

const runDir = path.join(root, "output", runId);
const jobsDir = path.join(runDir, "jobs");
const required = ["job.json", "analysis.json", "analysis.md", "resume.md", "opener.md", "changelog.md", "diff.json", "diagrams.md"];
let failures = 0;
const scoringPath = path.join(projectRoot, "config", "scoring.json");
const scoring = JSON.parse(fs.readFileSync(scoringPath, "utf8"));
const manifestPath = path.join(runDir, "inputs", "manifest.json");
const auditPath = path.join(runDir, "resume-audit.json");
let manifest = null;

function openerSection(markdown, heading) {
  const source = String(markdown || "");
  const marker = `## ${heading}`;
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) return "";
  const contentStart = source.indexOf("\n", markerStart + marker.length);
  if (contentStart < 0) return "";
  const remainder = source.slice(contentStart + 1);
  const nextHeading = remainder.search(/^##\s+/m);
  return (nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder).trim();
}

if (!fs.existsSync(jobsDir)) {
  console.error(`Missing jobs directory: ${jobsDir}`);
  process.exit(1);
}

const statePath = path.join(runDir, "state.json");
if (!fs.existsSync(statePath)) {
  failures += 1;
  console.error(`Missing: ${path.relative(root, statePath)}`);
}

if (!fs.existsSync(manifestPath)) {
  failures += 1;
  console.error(`Missing: ${path.relative(root, manifestPath)}`);
} else {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const inputsDir = path.dirname(manifestPath);
    const resume = fs.readFileSync(path.join(inputsDir, "resume.md"), "utf8");
    const bank = fs.readFileSync(path.join(inputsDir, "experience-bank.md"), "utf8");
    const profile = fs.readFileSync(path.join(inputsDir, "profile.md"), "utf8");
    const expected = {
      resume_hash: contentHash(resume),
      experience_bank_hash: contentHash(bank),
      profile_hash: contentHash(profile),
      combined_evidence_hash: contentHash(`${resume}\n${bank}`)
    };
    for (const [key, value] of Object.entries(expected)) {
      if (manifest[key] !== value) {
        failures += 1;
        console.error(`Input snapshot hash mismatch: ${key}`);
      }
    }
  } catch (error) {
    failures += 1;
    console.error(`Invalid input snapshot: ${error.message}`);
  }
}

if (Number.parseInt(String(scoring.version).split(".")[0], 10) >= 2 && !fs.existsSync(auditPath)) {
  failures += 1;
  console.error(`Missing: ${path.relative(root, auditPath)}`);
}

const jobIds = [];
for (const entry of fs.readdirSync(jobsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  jobIds.push(entry.name);
  const dir = path.join(jobsDir, entry.name);
  for (const file of required) {
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) {
      failures += 1;
      console.error(`Missing: ${path.relative(root, target)}`);
    }
  }

  const jobPath = path.join(dir, "job.json");
  const analysisJsonPath = path.join(dir, "analysis.json");
  const analysisMdPath = path.join(dir, "analysis.md");
  const resumePath = path.join(dir, "resume.md");
  const diffPath = path.join(dir, "diff.json");
  const changelogPath = path.join(dir, "changelog.md");
  if (
    fs.existsSync(jobPath) &&
    fs.existsSync(analysisJsonPath) &&
    fs.existsSync(analysisMdPath) &&
    fs.existsSync(resumePath) &&
    fs.existsSync(diffPath) &&
    fs.existsSync(changelogPath)
  ) {
    try {
      const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
      const analysis = JSON.parse(fs.readFileSync(analysisJsonPath, "utf8"));
      const markdown = fs.readFileSync(analysisMdPath, "utf8");
      const tailoredResume = fs.readFileSync(resumePath, "utf8");
      const diff = JSON.parse(fs.readFileSync(diffPath, "utf8"));
      const changelog = fs.readFileSync(changelogPath, "utf8");
      const markdownScore = markdown.match(/(?:Overall score|总分)\s*[：:]\s*(\d{1,3})\/100/i);
      if (!job.content_hash) {
        failures += 1;
        console.error(`Missing content_hash: ${path.relative(root, jobPath)}`);
      }
      if (!analysis.resume_hash || !analysis.job_hash || !analysis.scoring_version) {
        failures += 1;
        console.error(`Incomplete analysis metadata: ${path.relative(root, analysisJsonPath)}`);
      }
      if (analysis.job_hash !== job.content_hash) {
        failures += 1;
        console.error(`Job hash mismatch: ${entry.name}`);
      }
      if (manifest && analysis.resume_hash !== manifest.combined_evidence_hash) {
        failures += 1;
        console.error(`Resume evidence hash mismatch: ${entry.name}`);
      }
      const dimensions = Object.keys(scoring.weights);
      for (const dimension of dimensions) {
        const value = analysis.scores?.[dimension];
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          failures += 1;
          console.error(`Invalid ${dimension} score in ${entry.name}: ${value}`);
        }
      }
      // Job quality evaluates the vacancy, not the candidate.  New analyses
      // therefore keep it visible but exclude it from the candidate-fit total.
      const fitDimensions = dimensions.filter((dimension) => dimension !== "job_quality");
      const fitWeight = fitDimensions.reduce((sum, dimension) => sum + scoring.weights[dimension], 0);
      const weightedTotal = Math.round(fitDimensions.reduce(
        (sum, dimension) => sum + analysis.scores[dimension] * scoring.weights[dimension],
        0
      ) / fitWeight);
      if (analysis.scores.total !== weightedTotal) {
        failures += 1;
        console.error(`Weighted total mismatch: ${entry.name} expected=${weightedTotal} actual=${analysis.scores.total}`);
      }
      let expectedTier = analysis.scores.total >= scoring.tiers.strong
        ? "strong"
        : analysis.scores.total >= scoring.tiers.viable
          ? "viable"
          : analysis.scores.total >= scoring.tiers.stretch
            ? "stretch"
            : "skip";
      const experience = analysis.experience_assessment;
      if (experience?.gap && experience.required_months) {
        const ratio = experience.relevant_months / experience.required_months;
        if (ratio < 0.5 && (expectedTier === "strong" || expectedTier === "viable")) expectedTier = "stretch";
        else if (ratio < 0.8 && expectedTier === "strong") expectedTier = "viable";
      }
      if (analysis.recommendation?.tier !== expectedTier) {
        failures += 1;
        console.error(`Tier mismatch: ${entry.name} expected=${expectedTier} actual=${analysis.recommendation?.tier}`);
      }
      if (Number.parseInt(String(analysis.scoring_version).split(".")[0], 10) >= 2) {
        const atsPath = path.join(dir, "resume.html");
        if (!fs.existsSync(atsPath)) {
          failures += 1;
          console.error(`Missing ATS HTML: ${entry.name}`);
        } else {
          const atsErrors = validateAtsHtml(fs.readFileSync(atsPath, "utf8"));
          if (atsErrors.length) {
            failures += 1;
            console.error(`Invalid ATS HTML in ${entry.name}: ${atsErrors.join("; ")}`);
          }
        }
      }
      if (markdownScore && Number(markdownScore[1]) !== analysis.scores?.total) {
        failures += 1;
        console.error(
          `Score mismatch: ${entry.name} markdown=${markdownScore[1]} json=${analysis.scores?.total}`
        );
      }
      if (manifest && diff.base_resume_hash !== manifest.resume_hash) {
        failures += 1;
        console.error(`Diff base hash mismatch: ${entry.name}`);
      }
      if (diff.tailored_resume_hash !== contentHash(tailoredResume)) {
        failures += 1;
        console.error(`Diff tailored hash mismatch: ${entry.name}`);
      }
      const diffIds = new Set((diff.operations || []).map((operation) => operation.id));
      const changelogIds = new Set(changelogOperationIds(changelog));
      if (
        diffIds.size !== changelogIds.size ||
        [...diffIds].some((id) => !changelogIds.has(id))
      ) {
        failures += 1;
        console.error(`Changelog/diff operation mismatch: ${entry.name}`);
      }
      const expectedChangelog = buildChangelogFromDiff(job, diff);
      if (changelog !== expectedChangelog) {
        failures += 1;
        console.error(`Changelog is not generated from current diff: ${entry.name}`);
      }
      for (const value of manifest?.immutable_values || []) {
        if (!tailoredResume.includes(value)) {
          failures += 1;
          console.error(`Immutable resume value missing in ${entry.name}: ${value}`);
        }
      }
      const openerPath = path.join(dir, "opener.md");
      if (fs.existsSync(openerPath)) {
        const openerMarkdown = fs.readFileSync(openerPath, "utf8");
        const structuredBody = openerSection(openerMarkdown, "可直接发送");
        const opener = (structuredBody || openerMarkdown
          .replace(/^# .+$/m, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .trim());
        if ([...opener].length > 200) {
          failures += 1;
          console.error(`Opener exceeds 200 characters: ${entry.name}`);
        }
        if (/\[请填写/.test(opener)) {
          failures += 1;
          console.error(`Opener contains an unresolved placeholder: ${entry.name}`);
        }
        if (structuredBody) {
          const preview = openerSection(openerMarkdown, "前 15 字预览").replace(/^`|`$/g, "");
          const expectedPreview = [...opener].slice(0, 15).join("");
          if (preview !== expectedPreview) {
            failures += 1;
            console.error(`Opener 15-character preview mismatch: ${entry.name}`);
          }
          if (/^(您好|你好|我关注到|看到岗位)/.test(opener)) {
            failures += 1;
            console.error(`Opener wastes the first 15 characters on a greeting: ${entry.name}`);
          }
          if (!openerSection(openerMarkdown, "为什么这样写")) {
            failures += 1;
            console.error(`Opener rationale missing: ${entry.name}`);
          }
        }
      }
      const coverLetterPath = path.join(dir, "cover-letter.md");
      if (fs.existsSync(coverLetterPath)) {
        const coverInputPath = path.join(dir, "cover-letter-input.json");
        const coverDraftPath = path.join(dir, "cover-letter-draft.md");
        const coverStatusPath = path.join(dir, "cover-letter-status.json");
        if (![coverInputPath, coverDraftPath, coverStatusPath].every((file) => fs.existsSync(file))) {
          failures += 1;
          console.error(`Incomplete Cover Letter approval record: ${entry.name}`);
        } else {
          const coverErrors = validateCoverLetterFinal({
            answers: JSON.parse(fs.readFileSync(coverInputPath, "utf8")),
            draft: fs.readFileSync(coverDraftPath, "utf8"),
            final: fs.readFileSync(coverLetterPath, "utf8"),
            status: JSON.parse(fs.readFileSync(coverStatusPath, "utf8")),
          });
          if (coverErrors.length) {
            failures += 1;
            console.error(`Invalid Cover Letter in ${entry.name}: ${coverErrors.join("; ")}`);
          }
        }
      }
    } catch (error) {
      failures += 1;
      console.error(`Invalid JSON or analysis data in ${entry.name}: ${error.message}`);
    }
  }
}

if (fs.existsSync(statePath)) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const known = new Set(jobIds);
    for (const field of ["imported", "analyzed", "tailored"]) {
      const values = Array.isArray(state[field]) ? state[field] : [];
      if (new Set(values).size !== values.length) {
        failures += 1;
        console.error(`Duplicate job id(s) in state.${field}`);
      }
      const unknown = values.filter((id) => !known.has(id));
      if (unknown.length) {
        failures += 1;
        console.error(`Unknown job id(s) in state.${field}: ${unknown.join(", ")}`);
      }
    }
    if (state.pdf_export?.status === "complete") {
      const manifestPath = path.join(runDir, "pdf", "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        failures += 1;
        console.error("PDF export is complete but pdf/manifest.json is missing");
      } else {
        const pdfManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const manifestJobs = new Set((pdfManifest.files || []).map((item) => item.job_id));
        if (pdfManifest.count !== jobIds.length || manifestJobs.size !== jobIds.length) {
          failures += 1;
          console.error(`PDF manifest count mismatch: expected=${jobIds.length} actual=${pdfManifest.count}`);
        }
        for (const jobId of jobIds) {
          const jobDir = path.join(jobsDir, jobId);
          const metadataPath = path.join(jobDir, "resume-pdf.json");
          if (!fs.existsSync(metadataPath)) {
            failures += 1;
            console.error(`Missing PDF metadata: ${jobId}`);
            continue;
          }
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
          const filename = path.basename(String(metadata.filename || ""));
          const pdfPath = path.join(runDir, "pdf", filename);
          if (!filename.endsWith(".pdf") || filename !== metadata.filename || !fs.existsSync(pdfPath)) {
            failures += 1;
            console.error(`Missing or unsafe PDF path: ${jobId}`);
            continue;
          }
          const pdf = fs.readFileSync(pdfPath);
          const digest = crypto.createHash("sha256").update(pdf).digest("hex");
          const resume = fs.readFileSync(path.join(jobDir, "resume.md"), "utf8");
          const job = JSON.parse(fs.readFileSync(path.join(jobDir, "job.json"), "utf8"));
          if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
            failures += 1;
            console.error(`Invalid PDF header: ${jobId}`);
          }
          if (metadata.sha256 !== digest) {
            failures += 1;
            console.error(`PDF hash mismatch: ${jobId}`);
          }
          if (metadata.source_resume_hash !== contentHash(resume)) {
            failures += 1;
            console.error(`PDF source resume hash mismatch: ${jobId}`);
          }
          if (metadata.job_content_hash !== job.content_hash) {
            failures += 1;
            console.error(`PDF job hash mismatch: ${jobId}`);
          }
          if (!Number.isInteger(metadata.page_count) || metadata.page_count < 1) {
            failures += 1;
            console.error(`Invalid PDF page count: ${jobId}`);
          }
        }
      }
    }
  } catch (error) {
    failures += 1;
    console.error(`Invalid state.json: ${error.message}`);
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`OK: run ${runId} has all required files`);
