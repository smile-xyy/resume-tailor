#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { contentHash, serializeForInlineScript, updateRunState } from "../lib/core.mjs";
import { resolveProjectRoot } from "../lib/project-root.mjs";

const root = process.cwd();
const projectRoot = resolveProjectRoot(root, "templates/report.html", import.meta.url);
const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/build_report.mjs <run_id>");
  process.exit(2);
}

const runDir = path.join(root, "output", runId);
const jobsDir = path.join(runDir, "jobs");
const templatePath = path.join(projectRoot, "templates", "report.html");
const outputPath = path.join(runDir, "report.html");
const statePath = path.join(runDir, "state.json");
const auditPath = path.join(runDir, "resume-audit.json");

function readIfExists(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function sanitizeDisplayMarkdown(markdown) {
  return String(markdown || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*-?\s*(?:证据\s*ID|候选人证据)[：:].*$(?:\r?\n)?/gim, "");
}

function readDisplayMarkdown(file) {
  return sanitizeDisplayMarkdown(readIfExists(file));
}

const keywordLabels = new Map([
  ["ai", "AI"],
  ["agent", "Agent"],
  ["rag", "RAG"],
  ["sql", "SQL"],
  ["ci/cd", "CI/CD"],
  ["redis", "Redis"],
  ["python", "Python"],
  ["langgraph", "LangGraph"],
  ["llamaindex", "LlamaIndex"],
  ["llm", "LLM"],
  ["milvus", "Milvus"],
  ["vue", "Vue"],
]);

function usefulDisplayKeyword(keyword) {
  const value = String(keyword || "").trim().toLowerCase();
  if (!value || value === "ai") return false;
  if (/\/$/.test(value)) return false;
  if (/^[a-z]\/[a-z]$/i.test(value)) return false;
  if (/^[^\p{L}\p{N}]+$/u.test(value)) return false;
  return true;
}

function displayTerms(values) {
  return [...new Set((values || [])
    .filter(usefulDisplayKeyword)
    .map((value) => keywordLabels.get(String(value).toLowerCase()) || value))];
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readPdfExport(jobDir, runDir, resumeMarkdown) {
  const metadataPath = path.join(jobDir, "resume-pdf.json");
  if (!fs.existsSync(metadataPath)) return null;
  try {
    const metadata = readJson(metadataPath);
    const filename = path.basename(String(metadata.filename || ""));
    const pdfPath = path.join(runDir, "pdf", filename);
    if (
      !filename.toLowerCase().endsWith(".pdf") ||
      !fs.existsSync(pdfPath) ||
      metadata.source_resume_hash !== contentHash(resumeMarkdown)
    ) return null;
    return {
      filename,
      href: `pdf/${filename}`,
      pageCount: Number(metadata.page_count || 0),
      sha256: metadata.sha256 || "",
    };
  } catch {
    return null;
  }
}

function firstScore(markdown) {
  const match = markdown.match(/(?:overall|总分|score)[^\d]{0,20}(\d{1,3})/i);
  if (!match) return "";
  return Math.max(0, Math.min(100, Number(match[1])));
}

function tierLabel(tier) {
  return {
    strong: "优先投递",
    viable: "可以投递",
    stretch: "谨慎投递",
    skip: "暂缓投递"
  }[tier] || "待评估";
}

if (!fs.existsSync(jobsDir)) {
  console.error(`Missing jobs directory: ${jobsDir}`);
  process.exit(1);
}

if (!fs.existsSync(templatePath)) {
  console.error(`Missing template: ${templatePath}`);
  process.exit(1);
}

const jobs = fs
  .readdirSync(jobsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = path.join(jobsDir, entry.name);
    const job = readJson(path.join(dir, "job.json"));
    const analysis = readIfExists(path.join(dir, "analysis.md"));
    const rawResume = readIfExists(path.join(dir, "resume.md"));
    const resume = sanitizeDisplayMarkdown(rawResume);
    const analysisDataPath = path.join(dir, "analysis.json");
    const analysisData = fs.existsSync(analysisDataPath) ? readJson(analysisDataPath) : null;
    return {
      id: entry.name,
      job,
      score: analysisData?.scores?.total ?? firstScore(analysis),
      tier: analysisData?.recommendation?.tier || "",
      tierLabel: tierLabel(analysisData?.recommendation?.tier),
      scores: analysisData?.scores || {},
      evidence: {
        matched: displayTerms(analysisData?.evidence?.matched || []),
        missing: displayTerms(analysisData?.evidence?.missing || []),
        present_but_buried: displayTerms(analysisData?.evidence?.present_but_buried || [])
      },
      assessment: analysisData?.assessment || {
        fit: [],
        risks: [],
        strategy: [],
        questions: []
      },
      inputConfirmation: Array.isArray(job.needs_confirmation) ? job.needs_confirmation : [],
      pdf: readPdfExport(dir, runDir, rawResume),
      coverLetter: readDisplayMarkdown(path.join(dir, "cover-letter.md")),
      analysis: sanitizeDisplayMarkdown(analysis),
      resume,
      opener: readDisplayMarkdown(path.join(dir, "opener.md")),
      changelog: readDisplayMarkdown(path.join(dir, "changelog.md")),
      diagrams: readDisplayMarkdown(path.join(dir, "diagrams.md")),
    };
  })
  .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

const payload = {
  runId,
  generatedAt: new Date().toISOString(),
  state: fs.existsSync(statePath) ? readJson(statePath) : {},
  resumeAudit: fs.existsSync(auditPath) ? readJson(auditPath) : null,
  jobs,
};

const template = fs.readFileSync(templatePath, "utf8");
const dataJson = serializeForInlineScript(payload);
const html = template.replace(
  "__RESUME_TAILOR_DATA__",
  dataJson
);

fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(outputPath, html);
updateRunState(runDir, runId, { phase: "complete" });
console.log(`OK: ${outputPath}`);
