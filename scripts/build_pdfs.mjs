#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { contentHash, updateRunState, writeJsonAtomic } from "../lib/core.mjs";
import {
  PDF_EXPORT_SCHEMA_VERSION,
  buildResumePdfFilename,
  shortJobIdentity,
} from "../lib/pdf-export.mjs";
import { resolveProjectRoot } from "../lib/project-root.mjs";

const root = process.cwd();
const projectRoot = resolveProjectRoot(root, "scripts/render_resume_pdf.py", import.meta.url);
const runId = process.argv[2];
const selectedJobId = process.argv[3];
if (!runId) {
  console.error("用法：node scripts/build_pdfs.mjs <run_id> [job_id]");
  process.exit(2);
}

function usablePython(candidate) {
  if (!candidate) return false;
  const check = spawnSync(candidate, ["-c", "import reportlab, pypdf"], { encoding: "utf8" });
  return check.status === 0;
}

function findPython() {
  const candidates = [
    process.env.RESUME_TAILOR_PYTHON,
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "bin", "python3"),
    "python3",
    "python",
  ];
  return candidates.find(usablePython) || "";
}

function findFont() {
  const candidates = [
    process.env.RESUME_TAILOR_PDF_FONT,
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || "";
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const runDir = path.join(root, "output", runId);
const jobsDir = path.join(runDir, "jobs");
const profilePath = path.join(runDir, "candidate-profile.json");
const python = findPython();
if (!python) {
  updateRunState(runDir, runId, {
    pdf_export: { status: "unavailable", generated: 0, reason: "缺少 reportlab/pypdf 渲染环境" },
  });
  console.log("SKIP: PDF 未生成，缺少可用的 reportlab/pypdf Python 环境");
  process.exit(0);
}
if (!fs.existsSync(jobsDir)) {
  console.error(`Missing jobs directory: ${jobsDir}`);
  process.exit(1);
}

const candidateProfile = fs.existsSync(profilePath) ? readJson(profilePath) : {};
const candidateName = candidateProfile?.candidate?.name || "候选人";
const fontPath = findFont();
const pdfDir = path.join(runDir, "pdf");
const tempDir = path.join(root, "tmp", "pdfs", runId);
fs.mkdirSync(pdfDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });
const generated = [];

for (const entry of fs.readdirSync(jobsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || (selectedJobId && entry.name !== selectedJobId)) continue;
  const jobDir = path.join(jobsDir, entry.name);
  const jobPath = path.join(jobDir, "job.json");
  const resumePath = path.join(jobDir, "resume.md");
  if (!fs.existsSync(jobPath) || !fs.existsSync(resumePath)) continue;
  const job = readJson(jobPath);
  const markdown = fs.readFileSync(resumePath, "utf8");
  const jobIdentity = shortJobIdentity(job, entry.name);
  const filename = buildResumePdfFilename({
    candidateName,
    company: job.company,
    title: job.title,
    runId,
    jobId: entry.name,
    jobHash: jobIdentity,
  });
  const inputPath = path.join(tempDir, `${jobIdentity}.json`);
  const temporaryPdf = path.join(tempDir, `${jobIdentity}.pdf`);
  const outputPath = path.join(pdfDir, filename);
  writeJsonAtomic(inputPath, {
    markdown,
    candidate_name: candidateName,
    company: job.company || "未知公司",
    role: job.title || "未知岗位",
    run_id: runId,
    font_path: fontPath || null,
  });
  const result = spawnSync(python, [
    path.join(projectRoot, "scripts", "render_resume_pdf.py"),
    "--input", inputPath,
    "--output", temporaryPdf,
  ], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(`PDF generation failed for ${entry.name}: ${result.stderr || result.stdout}`);
    process.exit(result.status ?? 1);
  }
  const renderMetadata = JSON.parse(result.stdout.trim());
  fs.renameSync(temporaryPdf, outputPath);
  const metadata = {
    schema_version: PDF_EXPORT_SCHEMA_VERSION,
    job_id: entry.name,
    candidate_name: candidateName,
    company: job.company || "未知公司",
    role: job.title || "未知岗位",
    filename,
    report_href: `pdf/${filename}`,
    source_resume_hash: contentHash(markdown),
    job_content_hash: job.content_hash || "",
    generated_at: new Date().toISOString(),
    page_count: renderMetadata.page_count,
    sha256: renderMetadata.sha256,
    selectable_text_characters: renderMetadata.extracted_characters,
    renderer: "reportlab",
  };
  writeJsonAtomic(path.join(jobDir, "resume-pdf.json"), metadata);
  generated.push(metadata);
  fs.rmSync(inputPath, { force: true });
  console.log(`PDF: ${filename}`);
}

const eligibleJobIds = fs.readdirSync(jobsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => fs.existsSync(path.join(jobsDir, entry.name, "resume.md")))
  .map((entry) => entry.name);
const manifest = eligibleJobIds.flatMap((jobId) => {
  const jobDir = path.join(jobsDir, jobId);
  const metadataPath = path.join(jobDir, "resume-pdf.json");
  if (!fs.existsSync(metadataPath)) return [];
  try {
    const metadata = readJson(metadataPath);
    const filename = path.basename(String(metadata.filename || ""));
    const pdfPath = path.join(pdfDir, filename);
    const resume = fs.readFileSync(path.join(jobDir, "resume.md"), "utf8");
    if (!fs.existsSync(pdfPath) || metadata.source_resume_hash !== contentHash(resume)) return [];
    return [metadata];
  } catch {
    return [];
  }
}).sort((a, b) => a.filename.localeCompare(b.filename, "zh-CN"));
const exportStatus = manifest.length === eligibleJobIds.length ? "complete" : "partial";
writeJsonAtomic(path.join(pdfDir, "manifest.json"), {
  schema_version: PDF_EXPORT_SCHEMA_VERSION,
  run_id: runId,
  generated_at: new Date().toISOString(),
  count: manifest.length,
  files: manifest,
});
fs.rmSync(tempDir, { recursive: true, force: true });
updateRunState(runDir, runId, {
  pdf_export: { status: exportStatus, generated: manifest.length, directory: "pdf" },
});
console.log(`OK: generated ${generated.length} PDF(s); ${manifest.length}/${eligibleJobIds.length} current PDF resume(s)`);
