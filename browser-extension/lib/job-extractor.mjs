import { extractBossJob, validateExtractedBossJob } from "./boss-extractor.mjs";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const platformConfigs = {
  zhaopin: {
    host: /zhaopin\.com$/i,
    title: [".job-header h1", ".summary-plane h1", ".job-name", "h1"],
    company: [".company-name", ".company-title", ".company-info a"],
    salary: [".summary-plane .salary", ".job-summary .salary", ".salary"],
    location: [".summary-plane .job-address", ".job-address", ".location"],
    body: [".describtion__detail", ".job-description", ".job-content", ".job-detail"],
    requirements: ["任职要求", "职位要求", "岗位要求"],
    platform: "zhaopin",
  },
  qiancheng: {
    host: /(?:51job\.com|51jobcdn\.com)$/i,
    title: [".cn", ".job-title", ".tHeader h1", "h1"],
    company: [".cname", ".com_name", ".tCompany_name", ".company-name"],
    salary: [".cn strong", ".sal", ".tHeader .sal"],
    location: [".msg.ltype", ".sp4", ".job-location"],
    body: [".job_msg", ".tCompany_main", ".job-detail"],
    requirements: ["任职要求", "职位要求", "岗位要求"],
    platform: "qiancheng",
  },
  liepin: {
    host: /liepin\.com$/i,
    title: [".job-title", ".job-header h1", "h1"],
    company: [".company-name", ".company-info-name", ".company-card-name"],
    salary: [".job-salary", ".salary"],
    location: [".job-properties .location", ".job-location", ".location"],
    body: [".job-intro-container", ".job-description", ".job-detail"],
    requirements: ["任职要求", "职位要求", "岗位要求"],
    platform: "liepin",
  },
};

function platformForUrl(pageUrl) {
  try {
    const hostname = new URL(pageUrl).hostname;
    if (/zhipin\.com$/i.test(hostname)) return "boss";
    return Object.entries(platformConfigs).find(([, config]) => config.host.test(hostname))?.[0] || "unknown";
  } catch {
    return "unknown";
  }
}

function externalId(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return url.searchParams.get("jobId") || url.searchParams.get("job_id") || url.pathname.match(/(?:job_detail|jobs|job)\/([^./?]+)/i)?.[1] || "";
  } catch {
    return "";
  }
}

function extractGenericJob(reader, pageUrl, config) {
  const title = clean(reader.text(config.title));
  const company = clean(reader.text(config.company));
  const salary = clean(reader.text(config.salary));
  const location = clean(reader.text(config.location));
  const description = clean(reader.section(["职位描述", "岗位职责", "工作内容", "岗位介绍"]));
  const requirements = clean(reader.section(config.requirements));
  const fallback = clean(reader.text(config.body));
  const body = description || fallback;
  return {
    source: { type: "browser-extension", page_type: reader.pageType(), captured_at: new Date().toISOString() },
    platform: config.platform,
    external_id: externalId(pageUrl),
    url: pageUrl,
    title,
    company: company || null,
    salary: salary || null,
    location: location || null,
    description: body || null,
    requirements: requirements || null,
    tags: [],
    benefits: [],
    needs_confirmation: [
      ...(!company ? ["company"] : []),
      ...(!salary ? ["salary"] : []),
      ...(!location ? ["location"] : []),
      ...(!description && !fallback ? ["description"] : []),
      ...(!requirements ? ["requirements"] : []),
    ],
  };
}

export function extractJob(reader, pageUrl) {
  const platform = platformForUrl(pageUrl);
  if (platform === "boss") return extractBossJob(reader, pageUrl);
  const config = platformConfigs[platform];
  if (!config) return { platform: "unknown", url: pageUrl, title: "", description: null, requirements: null, needs_confirmation: ["platform"] };
  return extractGenericJob(reader, pageUrl, config);
}

export function validateExtractedJob(job) {
  if (job.platform === "boss") return validateExtractedBossJob(job);
  const errors = [];
  if (job.platform === "unknown") errors.push("暂不支持当前招聘平台，请使用截图或直接粘贴岗位信息。 ");
  if (!job.title) errors.push("未识别到岗位名称，请打开岗位详情页后重试，或改用截图/复制文本输入。 ");
  if (!job.description && !job.requirements) errors.push("未识别到岗位正文，请确认页面已加载；也可以改用截图或复制岗位信息。 ");
  return errors;
}

export function supportedPlatforms() {
  return ["boss", ...Object.keys(platformConfigs)];
}
