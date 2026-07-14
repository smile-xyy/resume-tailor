import { contentHash } from "./core.mjs";
import { extractKeywords } from "./candidate-profile.mjs";
import { parseResume } from "./resume-diff.mjs";

const experienceSections = /工作经历|实习经历|项目经历|实践经历|校园经历/;
const actionPattern = /搭建|构建|设计|实现|开发|优化|分析|制定|推动|协调|管理|封装|接入|维护|完成|组织|策划|执行|建立|负责|参与|协助/;
const strongActionPattern = /搭建|构建|设计|实现|开发|优化|分析|制定|推动|协调|管理|封装|接入|维护|完成|组织|策划|执行|建立/;
const resultPattern = /提升|降低|减少|增长|节省|达到|完成|落地|上线|获奖|排名|覆盖|支持|缩短|\d+(?:\.\d+)?(?:%|万|亿|人|个|次|小时|分钟|秒|K|k|\+)/;
const situationPattern = /面向|针对|背景|场景|业务|项目描述|为了解决|基于/;

export function inspectResumeFormat(markdown) {
  const lines = markdown.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const sectionCount = nonEmpty.filter((line) => /^(?:#{1,3}\s+|\d+[.、]\s*)/.test(line)).length;
  const listCount = nonEmpty.filter((line) => /^[-*·●▪]\s*/.test(line)).length;
  const averageLineLength = nonEmpty.length
    ? nonEmpty.reduce((sum, line) => sum + line.length, 0) / nonEmpty.length
    : 0;
  let shortRun = 0;
  let maxShortRun = 0;
  for (const line of nonEmpty) {
    shortRun = line.length <= 3 ? shortRun + 1 : 0;
    maxShortRun = Math.max(maxShortRun, shortRun);
  }
  const checks = {
    enough_sections: sectionCount >= 2,
    enough_lists: listCount >= 2,
    acceptable_line_length: averageLineLength >= 15,
    no_fragment_run: maxShortRun < 5
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    metrics: { section_count: sectionCount, list_count: listCount, average_line_length: averageLineLength, max_short_run: maxShortRun }
  };
}

export function cleanResumeFormatting(markdown) {
  const visible = markdown.replace(/[\u200B-\u200D\uFEFF]/g, "").replaceAll("\t", "  ");
  const normalizedBullets = visible.replace(/^(\s*)[·●▪]\s*/gm, "$1- ");
  const compact = normalizedBullets.replace(/\n{3,}/g, "\n\n");
  return compact.endsWith("\n") ? compact : `${compact}\n`;
}

function classifyItem(item) {
  return {
    situation: situationPattern.test(item),
    task: /负责|职责|目标|任务|参与|协助/.test(item),
    action: strongActionPattern.test(item),
    result: resultPattern.test(item)
  };
}

export function buildStarResume(markdown) {
  const document = parseResume(markdown);
  const experiences = [];
  for (const section of document.sections.filter((entry) => experienceSections.test(entry.heading))) {
    for (const block of section.blocks) {
      const content = [...block.paragraphs, ...block.items];
      if (!content.length) {
        experiences.push({
          section: section.heading,
          heading: block.heading,
          situation: [],
          task: [],
          action: [],
          result: [],
          skills: [],
          empty_shell: true
        });
        continue;
      }
      const classified = content.map((text) => ({ text, ...classifyItem(text) }));
      const skillMatches = extractKeywords(content.join(" "));
      experiences.push({
        section: section.heading,
        heading: block.heading,
        situation: classified.filter((item) => item.situation).map((item) => item.text),
        task: classified.filter((item) => item.task).map((item) => item.text),
        action: classified.filter((item) => item.action).map((item) => item.text),
        result: classified.filter((item) => item.result).map((item) => item.text),
        skills: [...new Set(skillMatches)],
        empty_shell: false
      });
    }
  }
  return { resume_hash: contentHash(markdown), experiences };
}

export function renderStarMarkdown(star) {
  const output = ["# 简历 STAR 拆解"];
  for (const experience of star.experiences) {
    output.push(`## ${experience.heading}`, `来源章节：${experience.section}`);
    if (experience.empty_shell) {
      output.push("- S：❌ 缺失", "- T：❌ 缺失", "- A：❌ 缺失", "- R：❌ 缺失", "技能关键词：无");
      continue;
    }
    for (const [label, values] of [
      ["S", experience.situation],
      ["T", experience.task],
      ["A", experience.action],
      ["R", experience.result]
    ]) {
      output.push(`- ${label}：${values.length ? values.join("；") : "⚠️ 缺失"}`);
    }
    output.push(`技能关键词：${experience.skills.length ? experience.skills.join("、") : "未识别"}`);
  }
  return `${output.join("\n\n")}\n`;
}

export function auditResume(markdown, star) {
  const issues = [];
  for (const experience of star.experiences) {
    if (experience.empty_shell) {
      issues.push({ severity: "error", type: "empty_shell", target: experience.heading, message: "该经历只有标题，没有工作或项目内容。" });
      continue;
    }
    if (!experience.action.length) issues.push({ severity: "warning", type: "missing_action", target: experience.heading, message: "缺少具体行动或方法。" });
    if (!experience.result.length) issues.push({ severity: "warning", type: "missing_result", target: experience.heading, message: "缺少结果或量化成果。" });
  }
  const passiveCount = (markdown.match(/负责|参与|协助/g) || []).length;
  if (passiveCount >= 5) issues.push({ severity: "info", type: "passive_language", target: "全文", message: `被动职责词出现 ${passiveCount} 次，建议优先补充具体行动。` });
  for (const marker of ["[请填写", "[需确认", "[需用户确认]"]) {
    const count = markdown.split(marker).length - 1;
    if (count) issues.push({ severity: "warning", type: "unconfirmed_marker", target: "全文", message: `${marker} 类标记共 ${count} 处。` });
  }
  const skillSection = parseResume(markdown).sections.find((section) => /技能/.test(section.heading));
  if (skillSection) {
    const broad = [...skillSection.items, ...skillSection.paragraphs].filter((item) => /熟悉|掌握|精通/.test(item) && !/[A-Za-z]{2,}/.test(item));
    if (broad.length) issues.push({ severity: "info", type: "broad_skill", target: skillSection.heading, message: "存在缺少具体工具名的宽泛技能表述。" });
  }
  return {
    resume_hash: star.resume_hash,
    summary: {
      experiences: star.experiences.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      information: issues.filter((issue) => issue.severity === "info").length
    },
    issues
  };
}

export function renderAuditMarkdown(audit) {
  const output = [
    "# 简历质量评估",
    `经历数量：${audit.summary.experiences}`,
    `严重问题：${audit.summary.errors} · 警告：${audit.summary.warnings} · 建议：${audit.summary.information}`
  ];
  if (!audit.issues.length) output.push("## 结果", "未发现规则可识别的明显问题。");
  for (const severity of ["error", "warning", "info"]) {
    const entries = audit.issues.filter((issue) => issue.severity === severity);
    if (!entries.length) continue;
    const title = severity === "error" ? "必须处理" : severity === "warning" ? "建议补充" : "优化建议";
    output.push(`## ${title}`, ...entries.map((issue) => `- **${issue.target}**：${issue.message}`));
  }
  return `${output.join("\n\n")}\n`;
}
