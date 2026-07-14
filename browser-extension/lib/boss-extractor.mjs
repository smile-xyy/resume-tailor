function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitTags(values) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function externalId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("jobId")
      || parsed.pathname.match(/job_detail\/([^./]+)/)?.[1]
      || "";
  } catch {
    return "";
  }
}

function identityPart(value) {
  return clean(value).toLocaleLowerCase("zh-CN").replace(/[\s·•|/\\_-]+/g, "");
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function decodeBossSalary(value) {
  const raw = clean(value);
  if (!raw) return null;
  let unknownPrivateCharacter = false;
  const decoded = Array.from(raw, (character) => {
    const code = character.codePointAt(0);
    if (code >= 0xE031 && code <= 0xE03A) return String(code - 0xE031);
    if ((code >= 0xE000 && code <= 0xF8FF)
      || (code >= 0xF0000 && code <= 0xFFFFD)
      || (code >= 0x100000 && code <= 0x10FFFD)) {
      unknownPrivateCharacter = true;
      return "";
    }
    return character;
  }).join("");
  return unknownPrivateCharacter ? null : clean(decoded);
}

export function extractBossJob(reader, pageUrl) {
  const activeJob = typeof reader.activeJob === "function" ? (reader.activeJob() || {}) : {};
  const panelText = (selectors) => clean(
    typeof reader.panelText === "function" ? reader.panelText(selectors) : ""
  );
  const title = panelText([".job-name", ".job-title"]) || clean(reader.text([
    ".job-detail-box .job-name",
    ".job-primary .job-name",
    ".job-title",
    ".job-name"
  ])) || clean(activeJob.title);
  const bossInfoAttribute = panelText([".boss-info-attr"])
    || clean(reader.text([".job-detail-box .boss-info-attr", ".boss-info-attr"]));
  const companyFromBossInfo = bossInfoAttribute.split(/\s*[·・]\s*/)[0] || "";
  const company = companyFromBossInfo || clean(reader.text([
    ".job-detail-box .company-name",
    ".job-detail-box .job-company-name",
    ".job-detail-box .company-info-box .company-name",
    ".job-detail-box .company-info-box a",
    ".company-info-box .company-name",
    ".company-info-box h3",
    ".sider-company .company-info a",
    ".company-info .name",
    ".company-name"
  ])) || clean(activeJob.company);
  const salary = decodeBossSalary(panelText([".job-salary", ".salary"]) || reader.text([
    ".job-detail-box .salary",
    ".job-primary .salary",
    ".job-salary",
    ".salary"
  ])) || decodeBossSalary(activeJob.salary);
  const location = clean(reader.text([
    ".job-detail-box .job-area",
    ".job-primary .job-area",
    ".location-address",
    ".job-area"
  ])) || clean(activeJob.location);
  const description = clean(reader.section(["职位描述", "岗位职责", "工作内容"]));
  const requirements = clean(reader.section(["任职要求", "职位要求", "岗位要求"]));
  const fallbackBody = clean(reader.text([
    ".job-detail-box .job-sec-text",
    ".job-detail .job-sec-text",
    ".job-detail-section .text"
  ]));
  const tags = splitTags(reader.texts([
    ".job-detail-box .job-tags span",
    ".job-primary .job-tags span",
    ".job-tags span"
  ]));
  const benefits = splitTags(reader.texts([
    ".job-detail-box .job-benefits span",
    ".job-benefits span",
    ".welfare-list li"
  ]));
  const needsConfirmation = [];
  if (!company) needsConfirmation.push("company");
  if (!salary) needsConfirmation.push("salary");
  if (!location) needsConfirmation.push("location");
  if (!description && !fallbackBody) needsConfirmation.push("description");
  if (!requirements) needsConfirmation.push("requirements");

  const cardUrl = clean(activeJob.url);
  const jobUrl = cardUrl || pageUrl;
  return {
    source: {
      type: "browser-extension",
      page_type: reader.pageType(),
      page_url: pageUrl,
      card_url: cardUrl || null,
      captured_at: new Date().toISOString()
    },
    platform: "boss",
    external_id: clean(activeJob.external_id) || externalId(jobUrl) || externalId(pageUrl),
    url: jobUrl,
    title,
    company: company || null,
    salary: salary || null,
    location: location || null,
    description: description || fallbackBody || null,
    requirements: requirements || null,
    tags,
    benefits,
    education: clean(reader.text([".job-degree", ".degree"])) || null,
    experience: clean(reader.text([".job-experience", ".experience"])) || null,
    hr_name: clean(reader.text([".boss-info-attr .name", ".boss-name"])) || null,
    hr_active_status: clean(reader.text([".boss-info-attr .active-time", ".boss-active-time"])) || null,
    needs_confirmation: needsConfirmation
  };
}

export function validateExtractedBossJob(job) {
  const errors = [];
  if (!job.title) errors.push("未识别到岗位名称，请展开岗位详情后重试。");
  if (!job.description && !job.requirements) errors.push("未识别到岗位正文，请确认当前页面已加载岗位详情。");
  return errors;
}

export function jobStorageKey(job) {
  const platform = identityPart(job.platform || "unknown-platform") || "unknown-platform";
  const id = identityPart(job.external_id) || identityPart(externalId(job.url));
  if (id) return `${platform}:id:${id}`;

  const company = identityPart(job.company);
  const title = identityPart(job.title);
  const location = identityPart(job.location);
  if (company && title) return `${platform}:role:${company}:${title}:${location}`;

  const evidence = [
    platform,
    title,
    location,
    clean(job.description).slice(0, 500),
    clean(job.requirements).slice(0, 500)
  ].join("|");
  return `${platform}:content:${shortHash(evidence)}`;
}
