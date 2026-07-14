#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { contentHash, slug, updateRunState, validateJob, writeJsonAtomic } from "../lib/core.mjs";

const root = process.cwd();
const inboxDir = path.join(root, "data", "jobs", "inbox");
const args = process.argv.slice(2);
const explicitFiles = args.filter((arg) => arg.endsWith(".json"));
const runIdArg = args.find((arg) => !arg.endsWith(".json"));
const runId =
  runIdArg ||
  new Date()
    .toISOString()
    .replaceAll("-", "")
    .replace("T", "-")
    .slice(0, 13)
    .replace(":", "");

const jobsOut = path.join(root, "output", runId, "jobs");
const runDir = path.join(root, "output", runId);

function normalizeJob(job, sourceFile) {
  const company = typeof job.company === "object" && job.company ? job.company : {};
  const salary = typeof job.salary === "object" && job.salary ? job.salary : {};
  const location = typeof job.location === "object" && job.location ? job.location : {};
  const requirements = typeof job.requirements === "object" && job.requirements ? job.requirements : {};
  const hr = typeof job.hr === "object" && job.hr ? job.hr : {};
  const sourceType = typeof job.source === "string" ? job.source : job.source?.type || "local-json";
  const screenshot = sourceType === "screenshot";
  const optional = (value) => value ?? (screenshot ? null : "");
  const descriptionParts = [job.description, job.job_description].filter(Boolean);
  const requirementParts = [job.requirements_text, job.job_requirements].filter(Boolean);
  const description = descriptionParts.length
    ? descriptionParts.join("\n\n")
    : optional(typeof job.description === "string" ? job.description : null);
  const reqText = requirementParts.length
    ? requirementParts.join("\n\n")
    : optional(typeof job.requirements === "string" ? job.requirements : null);

  const normalized = {
    id: job.id || `${slug(company.name || job.company, "unknown-company")}-${slug(job.title, "unknown-role")}`,
    source_id: job.id || job.external_id || null,
    source: {
      type: sourceType,
      file: sourceFile,
      files: Array.isArray(job.source?.files) ? job.source.files : [],
      url: job.url || job.source?.url || null,
      imported_at: new Date().toISOString(),
      run_id: runId
    },
    platform: optional(job.platform),
    external_id: job.external_id || "",
    url: optional(job.url),
    title: job.title || "",
    company: optional(company.name ?? job.company),
    company_size: optional(company.size ?? job.company_size),
    industry: optional(company.industry ?? job.industry),
    company_stage: optional(company.stage ?? job.company_stage),
    salary: optional(salary.range ?? job.salary),
    salary_monthly_count: salary.monthly_count ?? job.salary_monthly_count ?? null,
    location: [location.city, location.district].filter(Boolean).join(" ") || optional(job.location),
    city: optional(location.city ?? job.city),
    district: optional(location.district ?? job.district),
    experience: optional(requirements.experience ?? job.experience),
    education: optional(requirements.education ?? job.education),
    hr_name: optional(hr.name ?? job.hr_name),
    hr_title: optional(hr.title ?? job.hr_title),
    hr_active_status: optional(hr.active_status ?? job.hr_active_status),
    description,
    requirements: reqText,
    company_intro: optional(job.company_intro),
    tags: Array.isArray(job.tags) ? job.tags : [],
    benefits: Array.isArray(job.benefits) ? job.benefits : [],
    needs_confirmation: Array.isArray(job.needs_confirmation) ? job.needs_confirmation : [],
    excluded_content: Array.isArray(job.excluded_content) ? job.excluded_content : [],
    saved_at: job.saved_at || new Date().toISOString(),
    liveness: {
      status: job.liveness?.status || "unverifiable",
      checked_at: job.liveness?.checked_at || null
    },
    status: {
      analyzed: false,
      tailored: false
    }
  };
  normalized.content_hash = contentHash({
    title: normalized.title,
    company: normalized.company,
    description: normalized.description,
    requirements: normalized.requirements,
    url: normalized.url
  });
  return normalized;
}

if (!fs.existsSync(inboxDir) && explicitFiles.length === 0) {
  console.error(`Missing inbox: ${inboxDir}`);
  process.exit(1);
}

const files = explicitFiles.length
  ? explicitFiles
  : fs
      .readdirSync(inboxDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(inboxDir, name))
      .sort();

if (!files.length) {
  console.error(`No job JSON files found in ${inboxDir}`);
  process.exit(1);
}

fs.mkdirSync(jobsOut, { recursive: true });

let count = 0;
let duplicates = 0;
const seenHashes = new Set();
const imported = [];
const existingByHash = new Map();
if (fs.existsSync(jobsOut)) {
  for (const entry of fs.readdirSync(jobsOut, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const existingPath = path.join(jobsOut, entry.name, "job.json");
    if (!fs.existsSync(existingPath)) continue;
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
      if (existing.content_hash) existingByHash.set(existing.content_hash, entry.name);
    } catch {
      // Validator reports malformed existing files; import must not overwrite them.
    }
  }
}
for (const file of files) {
  const fullPath = path.resolve(file);
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const entries = Array.isArray(raw.jobs) ? raw.jobs : [raw];

  for (const entry of entries) {
    const job = normalizeJob(entry, path.relative(root, fullPath));
    const errors = validateJob(job);
    if (errors.length) {
      console.error(`Invalid job in ${fullPath}: ${errors.join("; ")}`);
      continue;
    }
    if (seenHashes.has(job.content_hash) || existingByHash.has(job.content_hash)) {
      duplicates += 1;
      const existingId = existingByHash.get(job.content_hash);
      if (existingId) {
        if (!imported.includes(existingId)) imported.push(existingId);
        const existingPath = path.join(jobsOut, existingId, "job.json");
        const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
        if (!existing.storage_id) {
          existing.storage_id = existingId;
          existing.source_id ??= existing.external_id || existing.id || null;
          writeJsonAtomic(existingPath, existing);
        }
      }
      continue;
    }
    seenHashes.add(job.content_hash);
    const baseId = slug(job.id, `job-${count + 1}`);
    const basePath = path.join(jobsOut, baseId, "job.json");
    let jobId = baseId;
    if (fs.existsSync(basePath)) {
      const existing = JSON.parse(fs.readFileSync(basePath, "utf8"));
      if (existing.content_hash !== job.content_hash) {
        jobId = `${baseId}-${job.content_hash.slice(0, 8)}`;
      }
    }
    job.storage_id = jobId;
    const targetDir = path.join(jobsOut, jobId);
    const targetPath = path.join(targetDir, "job.json");
    if (fs.existsSync(targetPath)) {
      const existing = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      if (existing.content_hash !== job.content_hash) {
        console.error(`Refusing to overwrite conflicting job: ${targetPath}`);
        continue;
      }
    }
    fs.mkdirSync(targetDir, { recursive: true });
    writeJsonAtomic(targetPath, job);
    existingByHash.set(job.content_hash, jobId);
    imported.push(jobId);
    count += 1;
  }
}

updateRunState(runDir, runId, { phase: "imported", imported });
console.log(`OK: imported ${count} job(s), skipped ${duplicates} duplicate(s) into output/${runId}/jobs`);
console.log(`RUN_ID: ${runId}`);
