import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function contentHash(value) {
  const text = typeof value === "string" ? value : stableStringify(value);
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function slug(value, fallback = "unknown") {
  const text = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || fallback;
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

export function readRunState(runDir, runId) {
  const file = path.join(runDir, "state.json");
  if (!fs.existsSync(file)) {
    return {
      run_id: runId,
      phase: "created",
      imported: [],
      analyzed: [],
      tailored: [],
      analysis_errors: [],
      sorted_ids: [],
      checkpoint_at: null
    };
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function updateRunState(runDir, runId, patch) {
  const next = {
    ...readRunState(runDir, runId),
    ...patch,
    checkpoint_at: new Date().toISOString()
  };
  writeJsonAtomic(path.join(runDir, "state.json"), next);
  return next;
}

export function validateJob(job) {
  const errors = [];
  if (!job || typeof job !== "object") errors.push("job must be an object");
  if (!String(job?.title || "").trim()) errors.push("title is required");
  if (!String(job?.description || job?.requirements || "").trim()) {
    errors.push("description or requirements is required");
  }
  return errors;
}
