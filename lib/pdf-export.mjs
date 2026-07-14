import crypto from "node:crypto";

export const PDF_EXPORT_SCHEMA_VERSION = "1.0.0";

function truncateCharacters(value, limit) {
  return [...String(value)].slice(0, limit).join("");
}

export function normalizePdfFilenamePart(value, fallback, limit = 48) {
  const normalized = String(value || fallback || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\s_]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");
  return truncateCharacters(normalized || fallback || "未知", limit)
    .replace(/[.\s-]+$/g, "") || "未知";
}

export function shortJobIdentity(job = {}, jobId = "") {
  const supplied = String(job.content_hash || "").toLowerCase();
  if (/^[a-f0-9]{8,}$/.test(supplied)) return supplied.slice(0, 8);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ jobId, company: job.company || "", title: job.title || "" }))
    .digest("hex")
    .slice(0, 8);
}

export function buildResumePdfFilename({ candidateName, company, title, runId, jobId, jobHash }) {
  const identity = /^[a-f0-9]{8,}$/i.test(String(jobHash || ""))
    ? String(jobHash).toLowerCase().slice(0, 8)
    : shortJobIdentity({ company, title }, jobId);
  const parts = [
    normalizePdfFilenamePart(candidateName, "候选人", 24),
    "定制简历",
    normalizePdfFilenamePart(company, "未知公司", 36),
    normalizePdfFilenamePart(title, "未知岗位", 52),
    normalizePdfFilenamePart(runId, "未标记批次", 24),
    identity,
  ];
  return `${parts.join("-")}.pdf`;
}
