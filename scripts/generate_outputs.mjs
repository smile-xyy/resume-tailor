#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildCandidateProfile, extractKeywords, rankExperiences } from "../lib/candidate-profile.mjs";
import { semanticMatch } from "../lib/semantic-match.mjs";
import { contentHash, readRunState, updateRunState, writeJsonAtomic } from "../lib/core.mjs";
import { buildChangelogFromDiff, buildResumeDiff } from "../lib/resume-diff.mjs";
import { ensureRunInputs } from "../lib/run-inputs.mjs";
import { inspectProjectBrief, renderProjectDiagram } from "../lib/diagram-brief.mjs";
import { resolveProjectRoot } from "../lib/project-root.mjs";

const root = process.cwd();
const projectRoot = resolveProjectRoot(root, "config/scoring.json", import.meta.url);
const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/generate_outputs.mjs <run_id>");
  process.exit(2);
}

const runDir = path.join(root, "output", runId);
const jobsDir = path.join(runDir, "jobs");
const { resume, profile, bank, manifest, projectBriefs } = ensureRunInputs(root, runDir);
const scoring = JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "scoring.json"), "utf8"));
const resumeHash = manifest.combined_evidence_hash;
const candidateProfile = buildCandidateProfile(resume, bank, profile);
writeJsonAtomic(path.join(runDir, "candidate-profile.json"), candidateProfile);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(file, content) {
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const keywordLabels = new Map([
  ["ai", "AI"],
  ["agent", "Agent"],
  ["agent/rag", "Agent/RAG"],
  ["rag", "RAG"],
  ["api", "API"],
  ["tool", "Tool"],
  ["sql", "SQL"],
  ["ci/cd", "CI/CD"],
  ["redis", "Redis"],
  ["react", "React"],
  ["vue", "Vue"],
  ["node", "Node.js"],
  ["node.js", "Node.js"],
  ["python", "Python"],
  ["fastapi", "FastAPI"],
  ["langgraph", "LangGraph"],
  ["llamaindex", "LlamaIndex"],
  ["llm", "LLM"],
  ["tableau", "Tableau"],
  ["excel", "Excel"],
  ["milvus", "Milvus"],
  ["mysql", "MySQL"],
  ["mongodb", "MongoDB"],
]);

function displayKeyword(keyword) {
  const normalized = String(keyword || "").toLowerCase();
  return keywordLabels.get(normalized) || keyword;
}

function usefulDisplayKeyword(keyword) {
  const value = String(keyword || "").trim().toLowerCase();
  if (!value) return false;
  if (value === "ai") return false;
  if (/\/$/.test(value)) return false;
  if (/^[a-z]\/[a-z]$/i.test(value)) return false;
  if (/^[^\p{L}\p{N}]+$/u.test(value)) return false;
  return true;
}

function displayKeywords(keywords, limit = 6) {
  return keywords.filter(usefulDisplayKeyword).slice(0, limit).map(displayKeyword);
}

function keywordText(keywords, limit, fallback) {
  const display = displayKeywords(keywords, limit);
  return display.length ? display.join("、") : fallback;
}

function targetPhrase(title) {
  const value = String(title || "目标岗位").trim();
  return /^[A-Za-z0-9]/.test(value) ? ` ${value}` : value;
}

const tailorRules = [
  {
    id: "agent_orchestration",
    name: "Agent 任务规划与流程编排",
    job: /agent|智能体|任务规划|workflow|工作流|编排|langgraph/i,
    line: /agent|智能体|langgraph|supervisor|节点|编排|意图识别|故障初筛/i,
    lead: "Agent 任务规划与多智能体编排",
    reason: "把已有节点编排、任务流转和业务闭环写成可扫描的 Agent 核心能力，直接回应 JD 对任务规划与工作流设计的要求。"
  },
  {
    id: "tool_integration",
    name: "工具调用与系统集成",
    job: /tool|function calling|函数调用|工具调用|mcp|系统集成|业务闭环|工具集/i,
    line: /toolschema|tool server|tool calling|业务\s*tool|mcp|工具注册|工具调用|调用接口/i,
    lead: "Agent 工具调用与业务系统集成",
    reason: "突出 ToolSchema、MCP 类接口和业务工具接入，使原有项目能够直接回答 JD 的 Tool Use、API 对接和系统闭环要求。"
  },
  {
    id: "rag_retrieval",
    name: "RAG 与知识检索",
    job: /rag|知识库|检索|向量|milvus|llamaindex|embedding|rerank/i,
    line: /rag|检索|知识库|milvus|llamaindex|embedding|rerank|query|召回|重排序/i,
    lead: "RAG 知识检索与可引用生成",
    reason: "将召回、重排和可引用依据前置，展示的不只是使用过 RAG，而是具备完整检索链路和效果优化证据。"
  },
  {
    id: "conversation_memory",
    name: "对话管理与记忆机制",
    job: /对话管理|记忆|memory|多轮|上下文|会话|状态/i,
    line: /redis|多轮|会话|状态|上下文|槽位|摘要|记忆/i,
    lead: "Agent 对话管理与记忆机制",
    reason: "用会话状态、槽位和工具结果管理证明多轮对话能力，避免只写抽象的“记忆机制”。"
  },
  {
    id: "fullstack_delivery",
    name: "全栈与端到端交付",
    job: /全栈|端到端|前端|后端|react|next\.js|vue|node|python|go|postgresql|mysql/i,
    line: /fastapi|springboot|restful|api|接口|联调|docker|部署|ci\/cd|mysql|redis/i,
    lead: "后端服务与端到端联调",
    reason: "优先展示已有后端接口、状态管理和部署联调证据，同时把没有前端证据的部分留在缺口建议中，避免把后端项目包装成完整全栈经验。"
  },
  {
    id: "backend_api",
    name: "后端 API 与联调",
    job: /后端|python|fastapi|api|接口|联调|开发交付|系统集成/i,
    line: /fastapi|api|接口|restful|参数校验|分页查询|状态流转|联调/i,
    lead: "后端 API 与系统联调",
    reason: "把接口设计、参数校验、状态流转和联调范围写清楚，用具体工程动作回应 JD 的 Python/API 开发要求。"
  },
  {
    id: "engineering_delivery",
    name: "工程交付与可观测",
    job: /上线|交付|监控|告警|ci\/cd|docker|可观测|trace|测试|单测|故障降级/i,
    line: /docker|ci\/cd|opentelemetry|trace|日志|超时|异常|降级|上线|部署/i,
    lead: "工程化交付与运行稳定性",
    reason: "将性能、链路追踪、异常隔离和降级结果前置，证明项目考虑过稳定运行，而不止停留在功能原型。"
  },
  {
    id: "data_analysis",
    name: "数据分析与可视化",
    job: /数据分析|可视化|sql|tableau|excel|看板|数据建模/i,
    line: /数据|sql|tableau|excel|看板|数据建模|分析/i,
    lead: "数据分析与可视化",
    reason: "把数据获取、分析工具和决策输出串成完整证据链，回应 JD 对分析方法与可视化交付的要求。"
  },
  {
    id: "research",
    name: "研究与调研分析",
    job: /用户研究|市场调研|行业研究|政策研究|定性研究|访谈|问卷|调研报告/i,
    line: /用户研究|市场调研|行业研究|政策研究|访谈|问卷|调研报告|研究结论/i,
    lead: "研究设计与调研分析",
    reason: "将研究问题、调研方法、分析过程与结论前置，回应 JD 对用户、市场或政策研究能力的要求。"
  },
  {
    id: "content",
    name: "内容策划与写作",
    job: /内容策划|文案|编辑|新媒体|公众号|短视频|选题|稿件|品牌内容/i,
    line: /内容策划|文案|编辑|新媒体|公众号|短视频|选题|稿件|品牌/i,
    lead: "内容策划与文案产出",
    reason: "突出已有选题、内容生产、编辑或传播动作，避免把普通参与经历泛化为内容运营经验。"
  },
  {
    id: "operations",
    name: "运营与活动执行",
    job: /运营|活动策划|社群|用户增长|活动执行|项目运营/i,
    line: /运营|活动策划|社群|用户增长|活动执行|项目运营|组织/i,
    lead: "运营策划与活动执行",
    reason: "前置真实的活动策划、执行、用户触达或复盘动作，回应运营岗位对落地能力的要求。"
  },
  {
    id: "project_coordination",
    name: "项目协调与执行推进",
    job: /项目管理|项目协调|跨部门|进度管理|排期|资源协调|执行推进/i,
    line: /项目管理|项目协调|跨部门|进度管理|排期|资源协调|执行推进|组织|协调/i,
    lead: "项目协调与执行推进",
    reason: "将已有协作、组织和推进动作写清楚，回应项目管理与综合支持岗位的执行要求。"
  },
  {
    id: "education_training",
    name: "课程设计与培训支持",
    job: /教学|课程设计|培训|教研|授课|教育/i,
    line: /教学|课程设计|培训|教研|授课|教育|课堂/i,
    lead: "课程设计与培训支持",
    reason: "突出真实的课程、培训、教研或授课实践，避免将普通分享活动包装为教学经验。"
  }
];

function patternHits(pattern, value) {
  const flags = pattern.flags.includes("i") ? "gi" : "g";
  return (String(value || "").match(new RegExp(pattern.source, flags)) || []).length;
}

function activeTailorRules(job) {
  const title = String(job.title || "");
  const body = [job.description, job.requirements, (job.tags || []).join(" ")].filter(Boolean).join("\n");
  return tailorRules
    .map((rule, index) => {
      const titleScore = patternHits(rule.job, title);
      return {
        ...rule,
        priority: index,
        title_score: titleScore,
        job_score: titleScore * 5 + patternHits(rule.job, body)
      };
    })
    .filter((rule) => rule.job_score > 0)
    .sort((left, right) => right.job_score - left.job_score || left.priority - right.priority);
}

function lineRelevance(line, jobText, rules) {
  const lower = line.toLowerCase();
  const profile = preferredProfileForBody(line, rules);
  const primaryIndex = profile
    ? rules.findIndex((rule) => profile.rule_ids?.includes(rule.id) || profile.lead === rule.lead)
    : -1;
  const ruleScore = primaryIndex >= 0
    ? Math.max(8, 18 - primaryIndex * 2) +
      (profile.specific ? 4 : 0) +
      Math.min(8, (rules[primaryIndex].title_score || 0) * 4)
    : 0;
  const tokenScore = extractKeywords(lower).filter((keyword) => jobText.includes(keyword)).length;
  const resultScore = /提升|降低|减少|增长|节省|上线|落地|\d+(?:\.\d+)?(?:%|万|亿|人|个|次|小时|分钟|秒|k|\+)/i.test(line) ? 2 : 0;
  return ruleScore + tokenScore + resultScore;
}

function stripBullet(line) {
  return line.replace(/^-\s+/, "").trim();
}

const bulletProfiles = [
  {
    rule_ids: ["tool_integration"],
    pattern: /toolschema|tool server|业务\s*tool|mcp|工具注册|发现和调用接口|工具的注册、发现与调用/i,
    lead: "Agent 工具调用与业务系统集成"
  },
  {
    rule_ids: ["agent_orchestration"],
    pattern: /langgraph|supervisor|多智能体任务编排|多智能体协作链路|agent\s*节点|节点编排/i,
    lead: "Agent 任务规划与多智能体编排"
  },
  {
    rule_ids: ["conversation_memory"],
    pattern: /多轮会话|工单闭环|redis.*(?:会话|状态)|故障槽位|压缩摘要|最近对话/i,
    lead: "Agent 对话管理与记忆机制"
  },
  {
    rule_ids: ["fullstack_delivery"],
    pattern: /redis.*(?:会话|状态|缓存)|(?:会话|状态).*redis/i,
    lead: "Redis 会话状态与服务协同"
  },
  {
    rule_ids: ["engineering_delivery"],
    pattern: /可观测|opentelemetry|trace|ci\/cd|docker|部署|超时控制|异常隔离|故障降级/i,
    lead: "工程化交付与运行稳定性"
  },
  {
    rule_ids: ["fullstack_delivery"],
    pattern: /restful|fastapi|springboot|后台业务接口|接口联调|参数校验|分页查询|状态流转/i,
    lead: "后端服务与端到端联调"
  },
  {
    rule_ids: ["backend_api"],
    pattern: /restful|fastapi|springboot|后台业务接口|接口联调|参数校验|分页查询|状态流转/i,
    lead: "后端 API 与系统联调"
  },
  {
    rule_ids: ["rag_retrieval"],
    pattern: /售后知识增强问答|需求拆解与语义检索|混合召回与精排|科研数据检索|候选匹配与重排|rag|milvus|llamaindex|hnsw|bm25|rrf|retrieval|rerank|query rewrite|召回|重排序/i,
    lead: "RAG 知识检索与可引用生成"
  },
  {
    rule_ids: ["data_analysis"],
    pattern: /sql|tableau|excel|看板|数据建模|数据分析/i,
    lead: "数据分析与可视化"
  },
  {
    rule_ids: ["research"],
    pattern: /用户研究|市场调研|行业研究|政策研究|访谈|问卷|调研报告|研究结论/i,
    lead: "研究设计与调研分析"
  },
  {
    rule_ids: ["content"],
    pattern: /内容策划|文案|编辑|新媒体|公众号|短视频|选题|稿件|品牌/i,
    lead: "内容策划与文案产出"
  },
  {
    rule_ids: ["operations"],
    pattern: /运营|活动策划|社群|用户增长|活动执行|项目运营|组织/i,
    lead: "运营策划与活动执行"
  },
  {
    rule_ids: ["project_coordination"],
    pattern: /项目管理|项目协调|跨部门|进度管理|排期|资源协调|执行推进|组织|协调/i,
    lead: "项目协调与执行推进"
  },
  {
    rule_ids: ["education_training"],
    pattern: /教学|课程设计|培训|教研|授课|教育|课堂/i,
    lead: "课程设计与培训支持"
  }
];

function preferredProfileForBody(body, rules) {
  const activeIds = new Set(rules.map((rule) => rule.id));
  const matches = bulletProfiles
    .filter((profile) => profile.rule_ids.some((id) => activeIds.has(id)) && profile.pattern.test(body))
    .map((profile) => ({
      profile,
      strength: patternHits(profile.pattern, body),
      ruleIndex: Math.min(...profile.rule_ids
        .map((id) => rules.findIndex((rule) => rule.id === id))
        .filter((index) => index >= 0))
    }))
    .sort((left, right) => right.strength - left.strength || left.ruleIndex - right.ruleIndex);
  if (matches.length) {
    return { ...matches[0].profile, specific: true };
  }
  const fallback = rules.find((rule) => rule.line.test(body));
  return fallback ? { lead: fallback.lead, rule_ids: [fallback.id], specific: false } : null;
}

function addTailoredLead(line, lead) {
  const body = stripBullet(line);
  if (!body || body.startsWith(`${lead}：`) || /^(时间|项目描述|职责描述|技术栈)[：:]/.test(body)) return line;
  const polished = body.replace(/^基于\s*/, "基于 ");
  const labelled = polished.match(/^([^：:]{2,24})[：:]\s*(.+)$/);
  if (labelled) return `- ${lead}：${labelled[2]}`;
  return `- ${lead}：${polished}`;
}

function tailorBullet(line, rules, usedLeads) {
  const matched = preferredProfileForBody(stripBullet(line), rules);
  if (!matched || usedLeads.has(matched.lead)) return line;
  usedLeads.add(matched.lead);
  return matched ? addTailoredLead(line, matched.lead) : line;
}

function blockHeadingOf(lines) {
  return (lines[0] || "").replace(/^###\s+/, "").trim();
}

function tailorBlockLines(blockLines, jobText, rules) {
  if (!blockLines.length) return blockLines;
  const heading = blockHeadingOf(blockLines);
  const relevant = candidateProfile.experiences.find((experience) => experience.heading === heading);
  if (!relevant) return blockLines;

  const head = [blockLines[0]];
  const spacing = [];
  const meta = [];
  const description = [];
  const content = [];
  const other = [];
  const rest = blockLines.slice(1);
  for (const [offset, line] of rest.entries()) {
    if (!line.trim() && offset === 0) {
      spacing.push(line);
    } else if (!line.trim()) {
      other.push(line);
    } else if (/^-\s+时间[：:]/.test(line)) {
      meta.push(line);
    } else if (/^-\s+(项目描述|职责描述|技术栈)[：:]/.test(line)) {
      description.push(line);
    } else if (/^-\s+/.test(line)) {
      content.push(line);
    } else {
      other.push(line);
    }
  }

  const sortedContent = [...content].sort((left, right) => lineRelevance(right, jobText, rules) - lineRelevance(left, jobText, rules));
  let rewritesLeft = 3;
  const usedLeads = new Set();
  const tailor = (line) => {
    if (!/^-\s+/.test(line) || rewritesLeft <= 0) return line;
    const tailored = tailorBullet(line, rules, usedLeads);
    if (tailored !== line) rewritesLeft -= 1;
    return tailored;
  };
  return [
    ...head,
    ...spacing,
    ...meta,
    ...description,
    ...sortedContent.map(tailor),
    ...other,
  ];
}

function textOfJob(job) {
  return [
    job.title,
    job.company,
    job.description,
    job.requirements,
    (job.tags || []).join(" "),
    job.industry,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function parseRequiredMonths(job) {
  const source = `${job.experience || ""}\n${job.requirements || ""}`;
  const match = source.match(/(\d+)\s*(?:[-~至]\s*\d+)?\s*年(?:以上|经验)?/);
  return match ? Number(match[1]) * 12 : 0;
}

function parseExperienceMonths(experience) {
  const time = experience.items.find((item) => /^时间[：:]/.test(item.text))?.text || "";
  const match = time.match(/(20\d{2})[.\/-](\d{1,2})\s*[-~至]\s*(20\d{2}|至今)[.\/-]?(\d{1,2})?/);
  if (!match) return 0;
  const start = Number(match[1]) * 12 + Number(match[2]);
  const endYear = match[3] === "至今" ? new Date().getFullYear() : Number(match[3]);
  const endMonth = match[3] === "至今" ? new Date().getMonth() + 1 : Number(match[4] || 12);
  return Math.max(0, endYear * 12 + endMonth - start + 1);
}

function semanticExperienceRanking(semantic) {
  const weightsByEvidence = new Map();
  for (const requirement of semantic.matched) {
    for (const id of requirement.evidence_ids) {
      weightsByEvidence.set(id, (weightsByEvidence.get(id) || 0) + requirement.weight);
    }
  }
  return candidateProfile.experiences
    .map((experience) => ({
      ...experience,
      semantic_relevance: experience.evidence_ids.reduce((sum, id) => sum + (weightsByEvidence.get(id) || 0), 0),
      months: parseExperienceMonths(experience),
    }))
    .filter((experience) => experience.semantic_relevance > 0)
    .sort((left, right) => right.semantic_relevance - left.semantic_relevance || right.result_count - left.result_count || right.action_count - left.action_count);
}

function assessExperienceDepth(job, experiences) {
  const requiredMonths = parseRequiredMonths(job);
  // 项目经历常与实习/工作经历描述同一段时间，不能重复累加成工作年限。
  const employmentExperiences = experiences.filter((experience) => /实习|工作|任职|employment|work/i.test(experience.section));
  const relevantMonths = employmentExperiences.reduce((sum, experience) => sum + experience.months, 0);
  const resultCount = experiences.reduce((sum, experience) => sum + experience.result_count, 0);
  const projectScore = Math.min(22, experiences.length * 5 + Math.min(12, resultCount * 3));
  if (!requiredMonths) {
    const score = Math.min(88, 42 + projectScore + Math.min(24, relevantMonths * 2));
    return { score, required_months: 0, relevant_months: relevantMonths, note: "JD 未明确年限；依据相关经历时长、项目数量与可核实结果估算。", gap: null };
  }
  const ratio = Math.min(1, relevantMonths / requiredMonths);
  const score = Math.round(Math.min(92, 24 + ratio * 52 + projectScore));
  const hasNonInternshipWork = employmentExperiences.some((experience) => !/实习/i.test(experience.section));
  const gap = relevantMonths < requiredMonths
    ? `JD 标注至少 ${Math.round(requiredMonths / 12)} 年相关经验；当前材料可识别的相关经历约 ${relevantMonths} 个月，不能按正式工作年限表述。`
    : null;
  return {
    score: hasNonInternshipWork ? score : Math.min(78, score),
    required_months: requiredMonths,
    relevant_months: relevantMonths,
    note: gap || "相关经历时长达到 JD 的最低年限；评分仍以项目与结果证据为限。",
    gap,
  };
}

const domainCatalog = [
  { id: "automotive", name: "汽车售后", pattern: /汽车|车辆|维保|车主|售后/ },
  { id: "research", name: "科研与技术需求对接", pattern: /科研|论文|专利|专家|技术需求/ },
  { id: "marketing", name: "营销增长", pattern: /营销|投放|转化|渠道|归因|增长/ },
  { id: "ecommerce", name: "电商", pattern: /电商|零售|商品|商家/ },
  { id: "finance", name: "金融", pattern: /金融|银行|证券|保险/ },
  { id: "customer_service", name: "客服运营", pattern: /客服(?:场景|业务|系统)|呼叫中心|客户服务/ },
];

function assessDomainFit(job, semanticCoverage) {
  const jobText = `${job.title || ""}\n${job.description || ""}\n${job.requirements || ""}`;
  const evidenceText = candidateProfile.evidence.map((record) => record.text).join("\n");
  const requested = domainCatalog.filter((domain) => domain.pattern.test(jobText));
  const matched = requested.filter((domain) => domain.pattern.test(evidenceText));
  if (!requested.length) return { score: Math.round(58 + semanticCoverage * 18), requested: [], matched: [], note: "JD 未给出明确行业场景；仅评估技术方向的可迁移性。" };
  if (matched.length) return { score: Math.min(92, 76 + matched.length * 8), requested, matched, note: `JD 场景与已有${matched.map((domain) => domain.name).join("、")}经历存在直接证据。` };
  return { score: Math.round(45 + semanticCoverage * 18), requested, matched: [], note: `JD 强调${requested.map((domain) => domain.name).join("、")}场景；当前材料未见同场景直接证据，按可迁移能力评估。` };
}

const softCapabilityCatalog = [
  { name: "沟通表达", job: /沟通|表达|汇报|跨部门/, evidence: /沟通|协同|联调|汇报|推动/ },
  { name: "协作推进", job: /协作|协同|团队合作|跨团队/, evidence: /协作|协同|联调|推动/ },
  { name: "业务理解", job: /业务理解|需求分析|业务场景|产品需求/, evidence: /业务场景|需求解析|需求拆解|需求对接/ },
];

function assessSoftFit(job) {
  const jobText = `${job.description || ""}\n${job.requirements || ""}`;
  const evidence = candidateProfile.evidence;
  const requested = softCapabilityCatalog.filter((capability) => capability.job.test(jobText));
  const matched = requested.filter((capability) => evidence.some((record) => capability.evidence.test(record.text)));
  if (!requested.length) return { score: 60, requested: [], matched: [], note: "JD 未提出可核验的协作或软性要求，给出中性分，不作为推荐的加分依据。" };
  return { score: Math.round(35 + (matched.length / requested.length) * 40), requested, matched, note: matched.length ? `已有${matched.map((item) => item.name).join("、")}的文字证据。` : "JD 提出协作类要求，但当前材料没有可核验的具体事例。" };
}

function scoreJob(job) {
  const text = textOfJob(job);
  const semantic = semanticMatch(candidateProfile, job);
  const jobKeywords = semantic.requirements.map((entry) => entry.name);
  const matchedSkills = semantic.matched.map((entry) => entry.name);
  const missingSkills = semantic.missing.map((entry) => entry.name);
  const rankedExperiences = semanticExperienceRanking(semantic);
  const relevantExperiences = rankedExperiences;
  const coverage = semantic.coverage;
  const hardSkills = Math.round(Math.min(100, 20 + coverage * 80));
  const experienceAssessment = assessExperienceDepth(job, relevantExperiences);
  const domainAssessment = assessDomainFit(job, coverage);
  const softAssessment = assessSoftFit(job);
  const domainRelevance = domainAssessment.score;
  const experienceDepth = experienceAssessment.score;
  const softFit = softAssessment.score;
  const requestedSoft = softAssessment.matched.map((capability) => ({ name: capability.name, evidence_ids: [] }));
  const quality = scoreJobQuality(job, jobKeywords);
  const evidenceIds = unique([...semantic.evidence_ids, ...relevantExperiences.slice(0, 3).flatMap((experience) => experience.evidence_ids)]);
  // 岗位质量是机会风险，不是候选人能力；总匹配分只由四个候选人维度构成。
  const weightedFit =
    hardSkills * scoring.weights.hard_skills +
    experienceDepth * scoring.weights.experience_depth +
    domainRelevance * scoring.weights.domain_fit +
    softFit * scoring.weights.soft_fit;
  const fitWeight = scoring.weights.hard_skills + scoring.weights.experience_depth + scoring.weights.domain_fit + scoring.weights.soft_fit;

  return {
    overall: Math.round(weightedFit / fitWeight),
    hardSkills,
    experienceDepth,
    domainRelevance,
    softFit,
    jobQuality: quality.score,
    jobQualitySignals: quality.signals,
    matchedSkills,
    missingSkills,
    relevantExperiences,
    evidenceIds,
    requestedSoft,
    semanticRequirements: semantic.requirements,
    experienceAssessment,
    domainAssessment,
    softAssessment,
  };
}

function scoreJobQuality(job, jobKeywords) {
  const text = textOfJob(job);
  const body = `${job.description || ""}\n${job.requirements || ""}`.trim();
  const signals = [];
  let score = 100;
  if (jobKeywords.length < 3) {
    score -= 15;
    signals.push({ code: "vague_stack", deduction: 15, message: "JD 中可识别的具体技术栈少于 3 项。" });
  }
  if (!/团队|汇报|协作对象|直属|负责人/.test(text)) {
    score -= 10;
    signals.push({ code: "missing_team_context", deduction: 10, message: "JD 未说明团队、汇报线或主要协作对象。" });
  }
  if (/(应届|实习|初级|junior)/i.test(job.title || "") && /[5-9]\s*年|10\s*年/.test(text)) {
    score -= 20;
    signals.push({ code: "level_conflict", deduction: 20, message: "岗位标题与要求年限可能矛盾。" });
  }
  if (/长期招聘|常年招聘|大量招聘|急招|高薪急聘/.test(text)) {
    score -= 25;
    signals.push({ code: "ghost_risk", deduction: 25, message: "JD 出现长期、批量或急招类风险信号。" });
  }
  if (body.length < 100) {
    score -= 15;
    signals.push({ code: "thin_description", deduction: 15, message: "岗位职责与要求过于简略。" });
  }
  return { score: Math.max(0, score), signals };
}

function tier(score, scoreData = null) {
  let result;
  if (score >= scoring.tiers.strong) result = "strong";
  else if (score >= scoring.tiers.viable) result = "viable";
  else if (score >= scoring.tiers.stretch) result = "stretch";
  else result = "skip";
  const experience = scoreData?.experienceAssessment;
  if (experience?.gap && experience.required_months) {
    const ratio = experience.relevant_months / experience.required_months;
    if (ratio < 0.5 && (result === "strong" || result === "viable")) result = "stretch";
    else if (ratio < 0.8 && result === "strong") result = "viable";
  }
  return result;
}

function recommendation(score, scoreData = null) {
  return { strong: "优先投递", viable: "可以投递", stretch: "谨慎投递", skip: "暂缓投递" }[tier(score, scoreData)];
}

function buildAnalysisJson(job, scoreData) {
  const educationEvidence = candidateProfile.education[0]?.evidence_ids || [];
  const skillEvidence = unique(candidateProfile.skills
    .filter((skill) => scoreData.matchedSkills.includes(skill.name))
    .flatMap((skill) => skill.evidence_ids));
  const experienceEvidence = unique(scoreData.relevantExperiences.slice(0, 2)
    .flatMap((experience) => experience.evidence_ids));
  return {
    job_id: job.id,
    resume_hash: resumeHash,
    job_hash: job.content_hash || contentHash(job),
    scoring_version: scoring.version,
    scores: {
      total: scoreData.overall,
      hard_skills: scoreData.hardSkills,
      experience_depth: scoreData.experienceDepth,
      domain_fit: scoreData.domainRelevance,
      soft_fit: scoreData.softFit,
      job_quality: scoreData.jobQuality
    },
    job_quality: {
      score: scoreData.jobQuality,
      signals: scoreData.jobQualitySignals
    },
    matching: {
      skills: scoreData.matchedSkills,
      missing_keywords: scoreData.missingSkills.slice(0, 20),
      capability_requirements: scoreData.semanticRequirements.map(({ id, name, matched, evidence_ids, requirement }) => ({ id, name, matched, evidence_ids, requirement })),
      relevant_experiences: scoreData.relevantExperiences.slice(0, 5).map((experience) => experience.id),
      evidence_ids: scoreData.evidenceIds,
    },
    experience_assessment: scoreData.experienceAssessment,
    domain_assessment: scoreData.domainAssessment,
    soft_assessment: scoreData.softAssessment,
    score_rationale: {
      hard_skills: `已匹配 ${scoreData.matchedSkills.length}/${scoreData.semanticRequirements.length} 项明确能力要求。`,
      experience_depth: scoreData.experienceAssessment.note,
      domain_fit: scoreData.domainAssessment.note,
      soft_fit: scoreData.softAssessment.note,
      job_quality: scoreData.jobQualitySignals.length ? scoreData.jobQualitySignals.map((signal) => signal.message).join("；") : "JD 信息完整度未触发规则扣分。",
    },
    cache: {
      reused: false
    },
    evidence: {
      matched: scoreData.matchedSkills,
      missing: scoreData.missingSkills.slice(0, 20),
      present_but_buried: scoreData.matchedSkills,
      soft_skill_proofs: scoreData.requestedSoft.flatMap((skill) => skill.evidence_ids),
    },
    generated_claims: {
      summary: unique([...educationEvidence, ...skillEvidence, ...experienceEvidence]),
      opener: experienceEvidence,
      diagram: experienceEvidence,
    },
    assessment: {
      fit: [
        `已匹配能力：${scoreData.matchedSkills.length ? scoreData.matchedSkills.slice(0, 12).join("、") : "暂无可核验的能力匹配"}`,
        `相关经历：${scoreData.relevantExperiences.length ? scoreData.relevantExperiences.slice(0, 3).map((experience) => experience.heading).join("、") : "需要人工核对"}`
      ],
      risks: buildRisks(scoreData),
      strategy: topStrategy(scoreData),
      questions: buildQuestions(scoreData),
    },
    recommendation: {
      tier: tier(scoreData.overall, scoreData),
      summary: recommendation(scoreData.overall, scoreData)
    }
  };
}

function buildRisks(scoreData) {
  const risks = [];
  if (scoreData.experienceAssessment.gap) risks.push(scoreData.experienceAssessment.gap);
  if (scoreData.missingSkills.length) risks.push(`当前材料缺少${scoreData.missingSkills.join("、")}的直接证据；除非补充真实材料，否则不写入简历。`);
  if (scoreData.domainAssessment.requested?.length && !scoreData.domainAssessment.matched?.length) {
    risks.push(`JD 有明确的${scoreData.domainAssessment.requested.map((domain) => domain.name).join("、")}场景要求；现有经历只能作为技术能力迁移，不能改写成同场景经验。`);
  }
  if (scoreData.softAssessment.requested?.length && !scoreData.softAssessment.matched?.length) {
    risks.push("JD 强调协作或业务理解，但当前材料没有可核验的具体事例。" );
  }
  return risks.length ? risks.slice(0, 3) : ["未识别到需要阻止投递的直接证据缺口；仍应如实陈述经历范围和结果。"];
}

function scoreDataFromAnalysis(analysis) {
  return {
    overall: analysis.scores.total,
    hardSkills: analysis.scores.hard_skills,
    experienceDepth: analysis.scores.experience_depth,
    domainRelevance: analysis.scores.domain_fit,
    softFit: analysis.scores.soft_fit,
    jobQuality: analysis.scores.job_quality,
    jobQualitySignals: analysis.job_quality?.signals || [],
    matchedSkills: analysis.matching?.skills || [],
    missingSkills: analysis.matching?.missing_keywords || analysis.evidence?.missing || [],
    relevantExperiences: (analysis.matching?.relevant_experiences || [])
      .map((id) => candidateProfile.experiences.find((experience) => experience.id === id))
      .filter(Boolean),
    evidenceIds: analysis.matching?.evidence_ids || [],
    requestedSoft: candidateProfile.soft_skills.filter((skill) =>
      (analysis.evidence?.soft_skill_proofs || []).some((id) => skill.evidence_ids.includes(id))
    ),
    semanticRequirements: analysis.matching?.capability_requirements || [],
    experienceAssessment: analysis.experience_assessment || { note: "历史缓存未提供经验深度依据。" },
    domainAssessment: analysis.domain_assessment || { note: "历史缓存未提供领域契合依据。" },
    softAssessment: analysis.soft_assessment || { note: "历史缓存未提供软性匹配依据。" },
  };
}

function topStrategy(scoreData) {
  const topExperiences = scoreData.relevantExperiences.slice(0, 2).map((experience) => experience.heading);
  return [
    topExperiences.length ? `优先展示与岗位最相关的经历：${topExperiences.join("、")}。` : "当前证据与岗位重合较少，建议先人工核对岗位方向。",
    displayKeywords(scoreData.matchedSkills, 8).length ? `在概述和技能板块前置已有证据支持的能力：${keywordText(scoreData.matchedSkills, 8, "")}。` : "不要为了匹配岗位新增未被证据支持的技能。",
    displayKeywords(scoreData.missingSkills, 8).length ? `以下能力尚无直接证据，不应直接写入：${keywordText(scoreData.missingSkills, 8, "")}。` : "当前识别出的核心能力均能找到候选人证据。",
  ];
}

function buildQuestions(scoreData) {
  const questions = [];
  const missing = displayKeywords(scoreData.missingSkills, 5);
  if (missing.length) questions.push(`是否有真实材料可以证明这些能力：${missing.join("、")}？`);
  const withoutResults = scoreData.relevantExperiences.find((experience) => experience.result_count === 0);
  if (withoutResults) questions.push(`“${withoutResults.heading}”是否有可核实的结果、规模或效率指标？`);
  if (scoreData.softAssessment.requested?.length && !scoreData.softAssessment.matched?.length) questions.push("是否有可说明协作、沟通或业务理解的具体项目事例？");
  return questions.slice(0, 3);
}

function buildDeepAnalysis(job, scoreData) {
  const credibility = scoreData.jobQuality >= 80
    ? "JD 信息较具体，暂未发现明显结构性风险。"
    : "JD 存在信息缺失或风险信号，投递前建议核实。";
  return `## 定制策略

| # | 改动点 | 当前状态 | 建议方向 | JD 触发原因 |
|---|---|---|---|---|
| 1 | 经历排序 | 当前顺序来自基础简历 | 优先展示最相关经历 | ${scoreData.relevantExperiences.slice(0, 3).map((experience) => experience.heading).join("、") || "待人工核对"} |
| 2 | 技能顺序 | 技能来自当前证据模型 | 前置已有匹配词 | ${keywordText(scoreData.matchedSkills, 8, "待人工核对")} |

## 级别与薪酬参考

- JD 级别判断：${job.experience || "未明确"}
- 候选人证据：${scoreData.evidenceIds.slice(0, 8).join("、") || "未识别到直接证据"}
- JD 薪资原文：${job.salary || "未提供"}
- 市场薪酬：未联网调研
- 压级风险：如 JD 年限明显高于当前经历，应如实沟通，不包装工作年限

## 岗位可信度评估

- JD 质量分：${scoreData.jobQuality}/100
- 结论：${credibility}
${scoreData.jobQualitySignals.length ? scoreData.jobQualitySignals.map((signal) => `- 风险：${signal.message}`).join("\n") : "- 风险：未识别到规则风险"}
`;
}

function buildAnalysis(job, scoreData, deep = false) {
  return `# 匹配分析：${job.company || "未知公司"} · ${job.title || "未知职位"}

## 匹配评分

总分：${scoreData.overall}/100

说明：总分仅反映候选人与岗位的四项匹配；“岗位质量”单独用于判断 JD 信息与机会风险，不会抬高候选人匹配度。

| 维度 | 分数 |
|---|---:|
| 核心能力匹配 | ${scoreData.hardSkills} |
| 经验深度 | ${scoreData.experienceDepth} |
| 业务方向匹配 | ${scoreData.domainRelevance} |
| 协作与软性匹配 | ${scoreData.softFit} |
| 岗位质量 | ${scoreData.jobQuality} |

## 评分依据

- 核心能力匹配：${scoreData.semanticRequirements.length ? `已识别 ${scoreData.semanticRequirements.length} 项明确能力要求，其中 ${scoreData.matchedSkills.length} 项有候选人证据。` : "JD 未识别到可核验的核心能力要求。"}
- 经验深度：${scoreData.experienceAssessment.note}
- 业务方向匹配：${scoreData.domainAssessment.note}
- 协作与软性匹配：${scoreData.softAssessment.note}
- 岗位质量：${scoreData.jobQualitySignals.length ? scoreData.jobQualitySignals.map((signal) => signal.message).join("；") : "JD 信息完整度未触发规则扣分。"}

## 投递建议

${recommendation(scoreData.overall, scoreData)}${scoreData.experienceAssessment.gap ? "（受相关年限差影响，已下调推荐等级）" : ""}

## 匹配依据

- 已匹配能力：${keywordText(scoreData.matchedSkills, 16, "暂无可核验匹配，需要进一步核对 JD。")}
- 相关经历：${scoreData.relevantExperiences.length ? scoreData.relevantExperiences.slice(0, 3).map((experience) => experience.heading).join("、") : "未识别到直接相关经历。"}
- 证据 ID：${scoreData.evidenceIds.length ? scoreData.evidenceIds.slice(0, 12).join("、") : "无"}

## 主要风险

${buildRisks(scoreData).map((risk) => `- ${risk}`).join("\n")}

## 简历调整策略

${topStrategy(scoreData).map((item) => `- ${item}`).join("\n")}

## 需要确认

${buildQuestions(scoreData).map((question) => `- ${question}`).join("\n") || "- 当前没有规则可识别的必要追问。"}

${deep ? buildDeepAnalysis(job, scoreData) : ""}`;
}

function splitSections(markdown) {
  const sections = [];
  const pattern = /^## .+$/gm;
  const matches = [...markdown.matchAll(pattern)];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    sections.push(markdown.slice(start, end).trim());
  }
  const head = markdown.slice(0, matches[0]?.index ?? 0).trim();
  return { head, sections };
}

function buildSummary(job, scoreData) {
  const education = candidateProfile.education[0];
  const experiences = scoreData.relevantExperiences.slice(0, 2);
  if (!education && !scoreData.matchedSkills.length && !experiences.length) return "";
  const matched = displayKeywords(scoreData.matchedSkills, 6);
  const title = job.title || "目标岗位";
  const evidenceText = candidateProfile.experiences
    .flatMap((experience) => experience.items.map((item) => item.text))
    .join("\n");
  const focuses = activeTailorRules(job)
    .filter((rule) => rule.line.test(evidenceText))
    .slice(0, 3)
    .map((rule) => rule.name);
  const lines = [];
  if (education && focuses.length) {
    const focusSpacing = /^[A-Za-z]/.test(focuses[0]) ? " " : "";
    lines.push(`- ${education.text}，求职方向为${targetPhrase(title)}，具备${focusSpacing}${focuses.join("、")}相关实践。`);
  } else if (education) {
    lines.push(`- ${education.text}，求职方向为${targetPhrase(title)}。`);
  } else if (focuses.length) {
    lines.push(`- 求职方向为${targetPhrase(title)}，具备${focuses.join("、")}相关实践。`);
  }
  if (experiences.length) {
    const technology = matched.length ? `，使用 ${matched.join("、")} 等技术` : "";
    lines.push(`- 在${experiences.map((experience) => experience.heading).join("、")}等经历中${technology}完成相关研发与交付。`);
  }
  return `## 求职概述

${lines.join("\n")}
`;
}

function reorderSkillItems(markdown, job) {
  const rules = activeTailorRules(job);
  if (!rules.length) return markdown;
  const jobText = textOfJob(job);
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length;) {
    if (!/^##\s+/.test(lines[index])) {
      index += 1;
      continue;
    }
    const heading = lines[index].replace(/^##\s+/, "").trim();
    const start = index;
    index += 1;
    while (index < lines.length && !/^##\s+/.test(lines[index])) index += 1;
    if (!/技能|技术能力|核心能力|skill|competenc/i.test(heading)) continue;
    const bulletIndexes = [];
    for (let cursor = start + 1; cursor < index; cursor += 1) {
      if (/^[-*]\s+/.test(lines[cursor])) bulletIndexes.push(cursor);
    }
    const sorted = bulletIndexes
      .map((lineIndex, originalIndex) => ({
        line: lines[lineIndex],
        originalIndex,
        score: lineRelevance(lines[lineIndex], jobText, rules)
      }))
      .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
      .map((entry) => entry.line);
    bulletIndexes.forEach((lineIndex, sortedIndex) => {
      lines[lineIndex] = sorted[sortedIndex];
    });
  }
  return lines.join("\n");
}

function reorderProjects(markdown, scoreData) {
  const rank = new Map(scoreData.relevantExperiences.map((experience, index) => [experience.heading, index]));
  const lines = markdown.split(/\r?\n/);
  const output = [];
  for (let index = 0; index < lines.length;) {
    if (!/^##\s+/.test(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }
    const sectionStart = index;
    index += 1;
    while (index < lines.length && !/^##\s+/.test(lines[index])) index += 1;
    const sectionLines = lines.slice(sectionStart, index);
    const heading = sectionLines[0].replace(/^##\s+/, "").trim();
    if (!/工作|实习|项目|实践|校园|志愿|研究|经历|experience|project|employment|work/i.test(heading)) {
      output.push(...sectionLines);
      continue;
    }
    const prefix = [];
    const blocks = [];
    let block = null;
    for (const line of sectionLines.slice(1)) {
      if (/^###\s+/.test(line)) {
        block = [line];
        blocks.push(block);
      } else if (block) {
        block.push(line);
      } else {
        prefix.push(line);
      }
    }
    blocks.sort((left, right) => {
      const leftHeading = left[0].replace(/^###\s+/, "").trim();
      const rightHeading = right[0].replace(/^###\s+/, "").trim();
      return (rank.get(leftHeading) ?? Number.MAX_SAFE_INTEGER) - (rank.get(rightHeading) ?? Number.MAX_SAFE_INTEGER);
    });
    output.push(sectionLines[0], ...prefix, ...blocks.flat());
  }
  return output.join("\n");
}

function tailorExperienceBullets(markdown, job, scoreData) {
  const jobText = textOfJob(job);
  const rules = activeTailorRules(job);
  if (!rules.length || !scoreData.relevantExperiences.length) return markdown;
  const relevant = new Set(scoreData.relevantExperiences.slice(0, 3).map((experience) => experience.heading));
  const lines = markdown.split(/\r?\n/);
  const output = [];
  for (let index = 0; index < lines.length;) {
    if (!/^###\s+/.test(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    while (index < lines.length && !/^#{2,3}\s+/.test(lines[index])) index += 1;
    const blockLines = lines.slice(start, index);
    const heading = blockHeadingOf(blockLines);
    output.push(...(relevant.has(heading) ? tailorBlockLines(blockLines, jobText, rules) : blockLines));
  }
  return output.join("\n");
}

function buildResume(job, scoreData) {
  const { head, sections } = splitSections(resume);
  const summary = buildSummary(job, scoreData);
  const withoutOldSummary = [head, summary, ...sections].filter(Boolean).join("\n\n");
  const withRankedSkills = reorderSkillItems(withoutOldSummary, job);
  const reordered = reorderProjects(withRankedSkills, scoreData);
  const tailored = tailorExperienceBullets(reordered, job, scoreData);
  return tailored.endsWith("\n") ? tailored : `${tailored}\n`;
}

const evidenceGapChecks = [
  {
    id: "prompt_evaluation",
    name: "Prompt 设计与效果评估",
    priority: 92,
    job: /prompt|提示词/i,
    evidence: /prompt|提示词|few-shot|prompt\s*评估/i,
    suggestion: (target) => `当前材料未说明 Prompt 模板、输出约束或迭代评估方法。若在“${target}”中真实做过，建议补充“如何设计 Prompt → 用什么样例或指标验证 → 如何迭代”；否则不要写入。`
  },
  {
    id: "structured_output",
    name: "结构化输出与生成约束",
    priority: 55,
    job: /结构化输出|json\s*输出|schema\s*输出/i,
    evidence: /结构化输出|json\s*输出|schema\s*输出|输出格式约束/i,
    suggestion: (target) => `当前材料未说明模型输出如何约束和校验。若“${target}”使用过 JSON Schema、字段校验或失败重试，请补充约束方式、异常处理和验证结果。`
  },
  {
    id: "frontend_delivery",
    name: "前端交互与全栈闭环",
    priority: 90,
    job: /react|next\.js|vue|前端|交互界面|工作台/i,
    evidence: /react|next\.js|vue|前端开发|交互界面开发/i,
    suggestion: (target) => `当前证据只支持后端与 Agent 侧能力，未证明 React/Vue 等前端交付。若“${target}”确实包含前端工作台，请补充页面范围、本人负责部分和联调方式；没有做过就保留为岗位缺口。`
  },
  {
    id: "agent_evaluation",
    name: "Agent 测试、回归与评测",
    priority: 86,
    job: /agent.{0,20}(?:评估|测试|效果指标)|测试用例|回归|评测|可验证/i,
    evidence: /agent.{0,30}(?:评估|测试|回归|评测)|测试用例|评测集|通过率|任务成功率/i,
    suggestion: (target) => `当前材料有运行链路与检索指标，但没有 Agent 级测试或回归证据。若“${target}”做过用例集、任务成功率或人工评审，请补充评测对象、指标与迭代结果。`
  },
  {
    id: "domain_marketing",
    name: "营销业务闭环",
    priority: 96,
    job: /marketing\s*agent|旅游.{0,12}营销|营销.{0,12}agent|渠道投放|线索收集|转化分析|增长闭环|a\/b\s*实验|归因/i,
    evidence: /营销|渠道投放|线索|转化|归因|a\/b\s*实验/i,
    suggestion: (target) => `当前项目场景与营销业务不同。可把“${target}”中的工作流、工具调用和结果回收能力作为可迁移证据，但不能写成营销经验；如有真实投放、线索或转化项目，请单独补充。`
  },
  {
    id: "ai_coding_workflow",
    name: "AI 编码与可验证开发流程",
    priority: 89,
    job: /claude code|opencode|ai\s*coding|代码生成|单测补齐|bug\s*定位|性能剖析/i,
    evidence: /claude code|opencode|ai\s*coding|代码生成|单测补齐|性能剖析/i,
    suggestion: (target) => `JD 明确要求可验证的 AI 编码工作流，当前简历没有相关过程证据。若开发“${target}”时真实使用过，请补充具体工具、任务环节以及如何通过测试或评审校验输出。`
  },
  {
    id: "production_feedback",
    name: "线上监控与反馈迭代",
    priority: 88,
    job: /线上.*(?:监控|运行效果|用户反馈)|收集用户反馈|持续优化迭代/i,
    evidence: /线上.*(?:监控|用户反馈)|用户反馈.*迭代|灰度|告警闭环/i,
    suggestion: (target) => `当前材料证明了链路追踪和异常降级，但没有线上用户反馈闭环。若“${target}”已经上线，请补充监控对象、反馈来源和一次真实迭代；尚未上线则不要包装成生产经验。`
  }
];

function cleanPlanText(value) {
  return String(value || "")
    .replace(/^\s*(?:[-*]\s*|\d+[.、)]\s*|[一二三四五六七八九十]+[、.])/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortPlanText(value, limit = 132) {
  const text = cleanPlanText(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function jobRequirementLines(job) {
  return [job.description, job.requirements]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n|(?<=[。；])/)
    .map(cleanPlanText)
    .filter((line) => line.length >= 8);
}

function bestRequirementForRule(job, rule) {
  const candidates = jobRequirementLines(job)
    .filter((line) => rule.job.test(line))
    .map((line) => ({ line, score: patternHits(rule.job, line) * 10 + Math.min(6, line.length / 24) }))
    .sort((left, right) => right.score - left.score);
  return shortPlanText(candidates[0]?.line || job.title || rule.name);
}

function bestEvidenceForRule(rule, job, scoreData, preferredHeading = "") {
  const relevantIds = new Set(scoreData.relevantExperiences.map((experience) => experience.id));
  const experiences = [
    ...scoreData.relevantExperiences,
    ...candidateProfile.experiences.filter((experience) => !relevantIds.has(experience.id))
  ];
  const matches = [];
  experiences.forEach((experience, experienceIndex) => {
    for (const item of experience.items) {
      if (/^(时间|技术栈)[：:]/.test(item.text) || !rule.line.test(item.text)) continue;
      const result = /提升|降低|增长|减少|节省|\d+(?:\.\d+)?(?:%|万|亿|k|\+)/i.test(item.text) ? 3 : 0;
      const specificity = patternHits(rule.line, item.text) * 2;
      matches.push({
        heading: experience.heading,
        text: shortPlanText(item.text),
        evidence_id: item.evidence_id,
        score: 30 - Math.min(20, experienceIndex) + specificity + result +
          lineRelevance(item.text, textOfJob(job), [rule]) +
          (experience.heading === preferredHeading ? 40 : 0)
      });
    }
  });
  return matches.sort((left, right) => right.score - left.score)[0] || null;
}

function operationRuleId(operation, rules) {
  const text = `${operation.before || ""}\n${operation.after || ""}`;
  const explicit = rules.find((rule) => text.includes(rule.lead));
  if (explicit) return explicit.id;
  const profile = preferredProfileForBody(text, rules);
  if (!profile) return "";
  return rules.find((rule) => profile.rule_ids?.includes(rule.id))?.id || "";
}

function requiredExperienceGap(job) {
  const label = String(job.experience || "").trim();
  const match = label.match(/(\d+)\s*(?:[-~至]\s*\d+)?\s*年/);
  const minimum = match ? Number(match[1]) : 0;
  const hasNonInternshipWork = candidateProfile.experiences.some((experience) =>
    /工作|任职|职业/.test(experience.section) && !/实习/.test(experience.section)
  );
  if (minimum < 2 || hasNonInternshipWork) return null;
  return {
    id: "experience_years",
    name: "工作年限与独立负责范围",
    requirement: `岗位标注 ${label}`,
    suggestion: `当前材料以实习和项目经历为主，不能通过措辞改成 ${label} 工作经验。建议投递时突出项目深度、真实负责边界和可核实结果，并如实说明年限。`
  };
}

function buildTailoringPlan(job, scoreData, diff) {
  const rules = activeTailorRules(job);
  const operationRules = new Map(diff.operations.map((operation) => [
    operation.id,
    operationRuleId(operation, rules)
  ]));
  const focuses = rules
    .map((rule) => {
      const changedOperations = diff.operations.filter((operation) =>
        operation.block && operationRules.get(operation.id) === rule.id
      );
      const changedHeading = (
        changedOperations.find((operation) => String(operation.after || "").includes(rule.lead)) ||
        changedOperations[0]
      )?.block;
      const evidence = bestEvidenceForRule(rule, job, scoreData, changedHeading);
      if (!evidence) return null;
      return {
        id: rule.id,
        name: rule.name,
        requirement: bestRequirementForRule(job, rule),
        reason: rule.reason,
        evidence,
        operation_ids: diff.operations
          .filter((operation) => operationRules.get(operation.id) === rule.id)
          .map((operation) => operation.id)
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  const candidateText = `${resume}\n${bank}`;
  const gaps = evidenceGapChecks
    .filter((check) => check.job.test(textOfJob(job)) && !check.evidence.test(candidateText))
    .map((check) => {
      const target = scoreData.relevantExperiences[0]?.heading || "最相关项目";
      const matchingLine = jobRequirementLines(job).find((line) => check.job.test(line));
      return {
        id: check.id,
        name: check.name,
        priority: check.priority,
        requirement: shortPlanText(matchingLine || job.title),
        suggestion: check.suggestion(target)
      };
    });
  const experienceGap = requiredExperienceGap(job);
  if (experienceGap) gaps.push({ ...experienceGap, priority: 100 });

  gaps.sort((left, right) => right.priority - left.priority);
  const focusHeadings = unique(focuses.map((focus) => focus.evidence.heading))
    .sort((left, right) => {
      const leftSection = candidateProfile.experiences.find((experience) => experience.heading === left)?.section || "";
      const rightSection = candidateProfile.experiences.find((experience) => experience.heading === right)?.section || "";
      return Number(/项目/.test(rightSection)) - Number(/项目/.test(leftSection));
    });
  const primaryExperiences = unique([
    ...focusHeadings,
    ...scoreData.relevantExperiences.map((experience) => experience.heading)
  ]).slice(0, 2);

  return {
    version: "1.0",
    primary_experiences: primaryExperiences,
    matched_keywords: displayKeywords(scoreData.matchedSkills, 8),
    focus_areas: focuses,
    evidence_gaps: gaps.slice(0, 4)
  };
}

function buildOpener(job, scoreData) {
  const company = job.company || "贵公司";
  const title = job.title || "目标岗位";
  const matched = new Set(scoreData.matchedSkills);
  const jobText = textOfJob(job);
  let hook = "有相关项目交付经验";
  let focus = displayKeywords(scoreData.matchedSkills, 2);

  const fullstackJob = /全栈|端到端|前端工作台/i.test(jobText);
  const toolDemand = patternHits(/mcp|tool|工具调用|function calling|技能插件|系统集成/i, jobText);
  const ragDemand = patternHits(/rag|检索|知识库|向量|召回|重排/i, jobText);

  if (/用户研究|市场调研|行业研究|政策研究|研究员/i.test(jobText) && matched.has("研究与调研分析")) {
    hook = "做过用户研究与调研分析";
    focus = ["研究与调研分析", ...focus.filter((item) => item !== "研究与调研分析")].slice(0, 2);
  } else if (/内容策划|文案|编辑|新媒体|品牌传播/i.test(jobText) && matched.has("内容策划与写作")) {
    hook = "做过内容策划与文案产出";
    focus = ["内容策划与写作", ...focus.filter((item) => item !== "内容策划与写作")].slice(0, 2);
  } else if (/运营|活动策划|社群|项目运营/i.test(jobText) && matched.has("运营与活动执行")) {
    hook = "做过运营策划与活动执行";
    focus = ["运营与活动执行", ...focus.filter((item) => item !== "运营与活动执行")].slice(0, 2);
  } else if (/项目管理|项目协调|跨部门|进度管理|资源协调/i.test(jobText) && matched.has("项目协调与执行推进")) {
    hook = "做过项目协调与执行推进";
    focus = ["项目协调与执行推进", ...focus.filter((item) => item !== "项目协调与执行推进")].slice(0, 2);
  } else if (/教学|课程设计|培训|教研|授课|教育/i.test(jobText) && matched.has("课程设计与培训支持")) {
    hook = "做过课程设计与培训支持";
    focus = ["课程设计与培训支持", ...focus.filter((item) => item !== "课程设计与培训支持")].slice(0, 2);
  } else if (/数据分析|商业分析/i.test(job.title || "") && matched.has("数据分析与可视化")) {
    hook = "做过数据分析与可视化交付";
    focus = ["数据分析与可视化", ...focus.filter((item) => item !== "数据分析与可视化")].slice(0, 2);
  } else if (fullstackJob && matched.has("Agent 工作流与编排") && matched.has("后端 API 开发")) {
    hook = "做过Agent编排与后端交付";
    focus = ["Agent 工作流与编排", "后端 API 开发"];
  } else if (toolDemand > ragDemand && matched.has("工具调用与系统集成")) {
    hook = "做过Agent编排与工具调用";
    focus = ["Agent 工作流与编排", "工具调用与系统集成"].filter((item) => matched.has(item));
  } else if (ragDemand > 0 && matched.has("RAG 与检索") && matched.has("后端 API 开发")) {
    hook = "做过RAG检索优化与后端交付";
    focus = ["RAG 与检索", "后端 API 开发"];
  } else if (toolDemand > 0 && matched.has("工具调用与系统集成")) {
    hook = "做过Agent编排与工具调用";
    focus = ["Agent 工作流与编排", "工具调用与系统集成"].filter((item) => matched.has(item));
  } else if (matched.has("Agent 工作流与编排")) {
    hook = "做过Agent工作流与项目交付";
    focus = ["Agent 工作流与编排", ...focus.filter((item) => item !== "Agent 工作流与编排")].slice(0, 2);
  } else if (focus.length) {
    hook = `有${focus[0]}项目实践`;
  }

  const focusEvidenceWeights = new Map();
  scoreData.semanticRequirements
    .filter((requirement) => focus.includes(requirement.name))
    .forEach((requirement) => requirement.evidence_ids.forEach((id) => {
      const priority = Math.max(1, focus.length - focus.indexOf(requirement.name));
      focusEvidenceWeights.set(id, (focusEvidenceWeights.get(id) || 0) + priority);
    }));
  const experience = scoreData.relevantExperiences
    .map((entry) => ({
      entry,
      opener_relevance: entry.evidence_ids.reduce((sum, id) => sum + (focusEvidenceWeights.get(id) || 0), 0),
    }))
    .sort((left, right) => right.opener_relevance - left.opener_relevance || right.entry.result_count - left.entry.result_count)[0]?.entry;
  const experienceName = shortPlanText(experience?.heading || "相关项目", 34);
  const focusText = focus.length ? focus.join("、") : "岗位核心能力";
  let message = `${hook}，在「${experienceName}」中积累了相关项目实践。看到${shortPlanText(company, 18)}的${shortPlanText(title, 26)}重点关注${focusText}，与我的相关经历较契合，期待进一步沟通。`;
  if ([...message].length > 190) {
    message = `${hook}，相关经历是「${shortPlanText(experienceName, 26)}」。${shortPlanText(title, 22)}重点关注${focusText}，与我的相关经历较契合，期待沟通。`;
  }
  const preview = [...message].slice(0, 15).join("");
  const proof = experience ? experience.heading : "当前候选人证据模型中的相关能力";

  return `# HR 开场白：${company} · ${title}

## 可直接发送

${message}

## 前 15 字预览

\`${preview}\`

## 为什么这样写

- **先给价值：**Boss 未点开前只能先看到开头约 15 个字，因此不以“您好”“我关注到”起句，直接前置“${hook}”。
- **对应岗位：**当前 JD 重点关注${focusText}，开头只选择已有证据支持、且与岗位最相关的能力。
- **证据来源：**“${proof}”；不使用缺失能力，不包装工作年限，也不编造结果。`;
}

function mermaidLabel(value) {
  return String(value || "").replace(/[\[\]{}|"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
}

function buildEvidenceDiagram(experience, diagramIndex) {
  const items = experience.items.slice(0, 8);
  const lines = [
    `## ${experience.heading}`,
    "",
    `证据 ID：${experience.evidence_ids.join("、")}`,
    "",
    "```mermaid",
    "mindmap",
    `  root((${mermaidLabel(experience.heading)}))`,
    "    已有证据",
  ];
  items.slice(0, 4).forEach((item) => lines.push(`      ${mermaidLabel(item.text)}`));
  lines.push("    可核实结果");
  items.filter((item) => /提升|降低|减少|增长|完成|上线|覆盖|\d+(?:\.\d+)?%/i.test(item.text)).slice(0, 4).forEach((item) => lines.push(`      ${mermaidLabel(item.text)}`));
  lines.push("```", "## 项目讲解稿", `我介绍一下“${experience.heading}”。目前材料能确认的内容包括：${items.map((item) => item.text).join("；")}。这张证据图只展示已有描述，未对项目模块之间的关系做未经确认的推断。`);
  return lines.join("\n");
}

function projectBriefFiles() {
  return projectBriefs || [];
}

function findProjectBrief(experience, briefs) {
  const terms = String(experience.heading || "").match(/[\u4e00-\u9fff]{2,}|[A-Za-z]{3,}/g) || [];
  return briefs
    .map((brief) => ({ ...brief, score: terms.reduce((score, term) => score + (brief.markdown.includes(term) ? 1 : 0), 0) }))
    .filter((brief) => brief.score > 0)
    .sort((left, right) => right.score - left.score)[0] || null;
}

function buildDiagrams(job, scoreData) {
  const diagrams = [`# 流程与架构图：${job.company || "未知公司"} · ${job.title || "未知职位"}`];
  const briefs = projectBriefFiles();
  const experiences = (scoreData.relevantExperiences.length
    ? scoreData.relevantExperiences
    : candidateProfile.experiences).filter((experience) => experience.items.length).slice(0, 2);
  experiences.forEach((experience, index) => {
    const brief = findProjectBrief(experience, briefs);
    if (brief) diagrams.push(renderProjectDiagram(experience.heading, brief.markdown, inspectProjectBrief(brief.markdown)));
    else diagrams.push(buildEvidenceDiagram(experience, index + 1));
  });
  if (!experiences.length) diagrams.push("当前证据不足，未生成自动图。");
  return diagrams.join("\n\n");
}

if (!fs.existsSync(jobsDir)) {
  console.error(`Missing jobs directory: ${jobsDir}`);
  process.exit(1);
}

let cacheHits = 0;
const records = fs.readdirSync(jobsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const jobDir = path.join(jobsDir, entry.name);
    const job = readJson(path.join(jobDir, "job.json"));
    const analysisPath = path.join(jobDir, "analysis.json");
    let analysisJson = null;
    let scoreData = null;
    if (fs.existsSync(analysisPath)) {
      const cached = readJson(analysisPath);
      const completeScores = ["hard_skills", "experience_depth", "domain_fit", "soft_fit", "job_quality"]
        .every((key) => Number.isFinite(cached.scores?.[key]));
      const completeClaims = ["summary", "opener", "diagram"]
        .every((key) => Array.isArray(cached.generated_claims?.[key]));
      if (
        cached.resume_hash === resumeHash &&
        cached.job_hash === job.content_hash &&
        cached.scoring_version === scoring.version &&
        completeScores &&
        completeClaims
      ) {
        analysisJson = { ...cached, cache: { reused: true } };
        scoreData = scoreDataFromAnalysis(cached);
        cacheHits += 1;
      }
    }
    if (!scoreData) {
      scoreData = scoreJob(job);
      analysisJson = buildAnalysisJson(job, scoreData);
    }
    return { id: entry.name, jobDir, job, scoreData, analysisJson };
  })
  .sort((left, right) => right.scoreData.overall - left.scoreData.overall);

const deepCount = Math.min(Number(scoring.deep_analysis_top_n || 5), records.length);
for (const [index, record] of records.entries()) {
  const { id, jobDir, job, scoreData, analysisJson } = record;
  const tailoredResume = buildResume(job, scoreData);
  const diff = buildResumeDiff(resume, tailoredResume);
  diff.tailoring = buildTailoringPlan(job, scoreData, diff);
  analysisJson.deep_analysis = {
    included: index < deepCount,
    rank: index + 1,
    market_salary_status: index < deepCount ? "not_researched" : "not_applicable"
  };

  writeJsonAtomic(path.join(jobDir, "analysis.json"), analysisJson);
  write(path.join(jobDir, "analysis.md"), buildAnalysis(job, scoreData, index < deepCount));
  write(path.join(jobDir, "resume.md"), tailoredResume);
  write(path.join(jobDir, "opener.md"), buildOpener(job, scoreData));
  writeJsonAtomic(path.join(jobDir, "diff.json"), diff);
  write(path.join(jobDir, "changelog.md"), buildChangelogFromDiff(job, diff));
  write(path.join(jobDir, "diagrams.md"), buildDiagrams(job, scoreData));
  job.status = { analyzed: true, tailored: true };
  writeJsonAtomic(path.join(jobDir, "job.json"), job);
}

const analyzed = records.map((record) => record.id);
const sortedIds = [...analyzed];
const previousState = readRunState(runDir, runId);
updateRunState(runDir, runId, {
  phase: "generated",
  imported: previousState.imported.length ? previousState.imported : analyzed,
  analyzed,
  tailored: analyzed,
  sorted_ids: sortedIds,
  analysis_cache_hits: cacheHits,
  deep_analyzed: sortedIds.slice(0, deepCount)
});
console.log(`OK: generated outputs for ${records.length} job(s); cache hits ${cacheHits}; deep analysis ${deepCount}`);
