import { decodeBossSalary, jobStorageKey } from "./boss-extractor.mjs";

function normalized(value) {
  return String(value || "").replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
}

function legacyMatch(job, incoming) {
  if (job.external_id || !incoming.source?.page_url) return false;
  return job.url === incoming.source.page_url
    && normalized(job.title) === normalized(incoming.title);
}

export function normalizeStoredJobs(jobs) {
  return (jobs || []).map((job) => {
    if (job.platform !== "boss" || !job.salary) return job;
    const salary = decodeBossSalary(job.salary);
    return salary === job.salary ? job : { ...job, salary };
  });
}

export function upsertJob(jobs, incoming) {
  const prepared = normalizeStoredJobs([incoming])[0];
  const key = jobStorageKey(prepared);
  const next = normalizeStoredJobs(jobs);
  let index = next.findIndex((job) => jobStorageKey(job) === key);
  if (index < 0) index = next.findIndex((job) => legacyMatch(job, prepared));
  if (index >= 0) {
    next[index] = { ...next[index], ...prepared, saved_at: new Date().toISOString() };
    return { jobs: next, updated: true };
  }
  next.push({ ...prepared, saved_at: new Date().toISOString() });
  return { jobs: next, updated: false };
}

export function exportEnvelope(jobs) {
  return {
    format: "resume-tailor-jobs",
    version: 1,
    exported_at: new Date().toISOString(),
    jobs: normalizeStoredJobs(jobs)
  };
}
