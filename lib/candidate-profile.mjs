import { contentHash } from "./core.mjs";
import { parseResume } from "./resume-diff.mjs";

const experienceSectionPattern = /工作|实习|项目|实践|校园|志愿|研究|经历|experience|project|employment|work/i;
const educationSectionPattern = /教育|学历|education/i;
const skillSectionPattern = /技能|能力|技术|skill|competenc/i;
const resultPattern = /提升|降低|减少|增长|节省|达到|完成|落地|上线|获奖|排名|覆盖|支持|缩短|\d+(?:\.\d+)?(?:%|万|亿|人|个|次|小时|分钟|秒|k|\+)/i;
const actionPattern = /搭建|构建|设计|实现|开发|优化|分析|制定|推动|协调|管理|封装|接入|维护|完成|组织|策划|执行|建立|负责|参与|协助|built|created|designed|developed|implemented|improved|managed|led/i;
const softTerms = ["沟通", "协作", "协调", "组织", "管理", "领导", "独立", "分析", "表达", "communication", "collaboration", "leadership", "management"];
const stopWords = new Set([
  "and", "the", "with", "from", "for", "this", "that", "using", "used", "into",
  "负责", "参与", "进行", "相关", "以及", "工作", "项目", "能力", "经验", "熟悉", "掌握",
  "岗位", "职位", "职责", "要求", "描述", "方向", "领域", "业务", "公司", "团队", "平台",
  "开发", "工程师", "实习", "应届", "本科", "硕士", "研究生", "时间", "地点",
  "基于", "构建", "实现", "完成", "了解", "使用", "熟练使用", "具备", "包括", "通过",
  "推动", "优化", "设计", "维护", "支持", "应用", "系统", "方案", "需求", "主要",
  "广州", "深圳", "北京", "上海", "杭州", "成都", "武汉", "南京", "苏州", "西安",
  "天河", "番禺", "海珠", "越秀", "白云", "黄埔", "南山", "福田", "朝阳", "浦东",
  "use", "used", "basic", "common", "good", "strong", "familiar", "experience",
  "engineering", "context", "business", "system", "systems", "platform", "project",
]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function evidenceId(source, section, block, text) {
  return `ev-${contentHash({ source, section, block, text }).slice(0, 12)}`;
}

function keywordTokens(text) {
  const latin = clean(text).match(/[A-Za-z][A-Za-z0-9+#./-]{1,30}/g) || [];
  const chinese = clean(text).match(/[\u4e00-\u9fff]{2,8}/g) || [];
  return [...latin, ...chinese]
    .map((value) => value.toLowerCase())
    .filter((value) => !stopWords.has(value) && !/^\d+$/.test(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectDocument(markdown, source) {
  const document = parseResume(markdown);
  const evidence = [];
  const add = (section, block, text, type) => {
    const normalized = clean(text);
    if (!normalized) return null;
    const record = {
      id: evidenceId(source, section, block, normalized),
      source,
      section,
      block,
      type,
      text: normalized,
    };
    evidence.push(record);
    return record.id;
  };

  for (const text of document.head) add("", "", text.replace(/^#+\s*/, ""), "header");
  for (const section of document.sections) {
    for (const text of [...section.paragraphs, ...section.items]) {
      add(section.heading, "", text, "section-item");
    }
    for (const block of section.blocks) {
      add(section.heading, block.heading, block.heading, "block-heading");
      for (const text of [...block.paragraphs, ...block.items]) {
        add(section.heading, block.heading, text, "block-item");
      }
    }
  }
  return { document, evidence };
}

function buildExperiences(documents, evidence) {
  const recordsByLocation = new Map();
  for (const record of evidence) {
    recordsByLocation.set(`${record.source}\0${record.section}\0${record.block}`, [
      ...(recordsByLocation.get(`${record.source}\0${record.section}\0${record.block}`) || []),
      record,
    ]);
  }
  const experiences = [];
  for (const { source, document } of documents) {
    for (const section of document.sections.filter((entry) => experienceSectionPattern.test(entry.heading))) {
      for (const block of section.blocks) {
        const records = recordsByLocation.get(`${source}\0${section.heading}\0${block.heading}`) || [];
        const items = records.filter((record) => record.type === "block-item");
        experiences.push({
          id: `exp-${contentHash({ source, section: section.heading, heading: block.heading }).slice(0, 12)}`,
          source,
          section: section.heading,
          heading: block.heading,
          evidence_ids: records.map((record) => record.id),
          keywords: unique(records.flatMap((record) => keywordTokens(record.text))),
          action_count: items.filter((record) => actionPattern.test(record.text)).length,
          result_count: items.filter((record) => resultPattern.test(record.text)).length,
          items: items.map((record) => ({ text: record.text, evidence_id: record.id })),
        });
      }
    }
  }
  return experiences;
}

function firstResumeName(document) {
  const value = document.head.find((line) => /^#\s+/.test(line));
  return value ? clean(value.replace(/^#+\s*/, "")) : null;
}

export function extractKeywords(text) {
  return unique(keywordTokens(text));
}

export function buildCandidateProfile(resume, bank = "", profile = "") {
  const resumeData = collectDocument(resume, "resume.md");
  const bankData = collectDocument(bank, "experience-bank.md");
  const profileData = collectDocument(profile, "profile.md");
  const documents = [
    { source: "resume.md", document: resumeData.document },
    { source: "experience-bank.md", document: bankData.document },
    { source: "profile.md", document: profileData.document },
  ];
  const evidence = [...resumeData.evidence, ...bankData.evidence, ...profileData.evidence];
  const experiences = buildExperiences(documents, evidence);
  const education = resumeData.document.sections
    .filter((section) => educationSectionPattern.test(section.heading))
    .flatMap((section) => section.blocks.map((block) => {
      const headingEvidence = evidence.find((record) =>
        record.source === "resume.md" &&
        record.section === section.heading &&
        record.block === block.heading &&
        record.type === "block-heading"
      );
      return { text: block.heading, evidence_ids: headingEvidence ? [headingEvidence.id] : [] };
    }));
  const skillEvidence = evidence.filter((record) => skillSectionPattern.test(record.section));
  const skills = unique(skillEvidence.flatMap((record) => keywordTokens(record.text))).map((name) => ({
    name,
    evidence_ids: skillEvidence.filter((record) => keywordTokens(record.text).includes(name)).map((record) => record.id),
  }));
  const softSkills = softTerms
    .filter((term) => evidence.some((record) => record.text.toLowerCase().includes(term)))
    .map((name) => ({
      name,
      evidence_ids: evidence.filter((record) => record.text.toLowerCase().includes(name)).map((record) => record.id),
    }));
  return {
    schema_version: "1.0.0",
    evidence_hash: contentHash(`${resume}\n${bank}`),
    candidate: {
      name: firstResumeName(resumeData.document),
      name_evidence_ids: resumeData.evidence.filter((record) => record.type === "header").slice(0, 1).map((record) => record.id),
    },
    education,
    skills,
    soft_skills: softSkills,
    experiences,
    evidence,
  };
}

export function evidenceIndex(candidateProfile) {
  return new Map(candidateProfile.evidence.map((record) => [record.id, record]));
}

export function rankExperiences(candidateProfile, jobText) {
  const wanted = new Set(extractKeywords(jobText));
  return candidateProfile.experiences
    .map((experience) => ({
      ...experience,
      relevance: experience.keywords.filter((keyword) => wanted.has(keyword)).length,
    }))
    .sort((left, right) =>
      right.relevance - left.relevance ||
      right.result_count - left.result_count ||
      right.action_count - left.action_count
    );
}
