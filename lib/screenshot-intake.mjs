const allowedFields = new Set([
  "title",
  "company",
  "salary",
  "location",
  "education",
  "experience",
  "description",
  "requirements",
  "tags",
  "benefits",
  "hr_name",
  "hr_active_status",
  "url"
]);

export function validateScreenshotJob(job) {
  const errors = [];
  const warnings = [];
  const source = job?.source;

  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return { errors: ["截图解析结果必须是 JSON 对象。"], warnings };
  }
  if (source?.type !== "screenshot") {
    errors.push("source.type 必须为 screenshot。");
  }
  if (!Array.isArray(source?.files) || source.files.length === 0) {
    errors.push("source.files 必须记录至少一个截图文件名。");
  }
  if (!String(job.title || "").trim()) {
    errors.push("截图中无法确认岗位名称，请用户补充后再导入。");
  }
  if (!String(job.description || "").trim() && !String(job.requirements || "").trim()) {
    errors.push("岗位职责和任职要求不能同时缺失。");
  }
  if (!Array.isArray(job.needs_confirmation)) {
    errors.push("needs_confirmation 必须是字段名数组。");
  } else {
    for (const field of job.needs_confirmation) {
      if (!allowedFields.has(field)) errors.push(`needs_confirmation 包含未知字段：${field}`);
      if (job[field] !== null && job[field] !== "") {
        warnings.push(`字段 ${field} 已有值但仍标记为待确认。`);
      }
    }
  }

  for (const field of allowedFields) {
    if (!(field in job)) continue;
    if (job[field] === null && !job.needs_confirmation?.includes(field)) {
      warnings.push(`字段 ${field} 为 null，建议加入 needs_confirmation。`);
    }
  }
  if (job.excluded_content && !Array.isArray(job.excluded_content)) {
    errors.push("excluded_content 必须是字符串数组。");
  }
  return { errors, warnings };
}

export function screenshotEnvelope(job) {
  return {
    format: "resume-tailor-jobs",
    version: 1,
    exported_at: new Date().toISOString(),
    jobs: [job]
  };
}
