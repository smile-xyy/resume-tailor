// A small, generic capability taxonomy.  It deliberately describes job
// requirements rather than candidate-specific facts; every positive result is
// still bound to the candidate evidence passed to this module.
const capabilities = [
  { id: "agent_orchestration", name: "Agent 工作流与编排", weight: 4, job: /agent|智能体|langgraph|autogen|工作流|workflow|任务规划|编排/i, evidence: /agent|智能体|langgraph|autogen|多智能体|节点编排|任务编排|工作流/i },
  { id: "tool_integration", name: "工具调用与系统集成", weight: 4, job: /tool|工具调用|function calling|mcp|技能插件|系统\s*api|接口对接/i, evidence: /tool|工具调用|function calling|mcp|toolschema|工具注册|调用接口|系统集成|对接.*\bapi\b/i },
  { id: "rag", name: "RAG 与检索", weight: 4, job: /rag|检索增强|知识库|向量检索|召回|重排|milvus|faiss|chroma|pgvector/i, evidence: /rag|检索增强|知识库|向量检索|召回|重排|milvus|faiss|chroma|llamaindex|embedding/i },
  { id: "prompt", name: "Prompt 设计与优化", weight: 3, job: /prompt|提示词/i, evidence: /prompt|提示词|few-shot|系统提示/i },
  { id: "conversation_memory", name: "多轮对话与上下文管理", weight: 3, job: /记忆|memory|上下文|多轮对话|会话管理|状态管理/i, evidence: /记忆|memory|上下文|多轮对话|会话状态|redis.*(?:会话|状态)|槽位/i },
  { id: "backend_api", name: "后端 API 开发", weight: 3, job: /后端|api|接口开发|fastapi|flask|spring\s*boot|restful/i, evidence: /后端|api|接口开发|fastapi|flask|spring\s*boot|restful|接口联调/i },
  { id: "frontend", name: "前端交互交付", weight: 3, job: /前端|react|vue|next\.js|交互界面|工作台/i, evidence: /前端|react|vue|next\.js|交互界面|页面开发/i },
  { id: "engineering", name: "工程化交付与稳定性", weight: 3, job: /docker|ci\/cd|部署|监控|可观测|日志|测试|单测|稳定性|降级/i, evidence: /docker|ci\/cd|部署|监控|可观测|opentelemetry|日志|单测|测试|降级|异常隔离/i },
  { id: "data_analysis", name: "数据分析与可视化", weight: 3, job: /数据分析|可视化|tableau|excel|sql|看板|数据建模/i, evidence: /数据分析|可视化|tableau|excel|sql|看板|数据建模/i },
  { id: "research", name: "研究与调研分析", weight: 3, job: /用户研究|市场调研|行业研究|政策研究|定性研究|案头研究|访谈|问卷|调研报告/i, evidence: /用户研究|市场调研|行业研究|政策研究|定性研究|案头研究|访谈|问卷|调研报告/i },
  { id: "content", name: "内容策划与写作", weight: 3, job: /内容策划|文案|编辑|新媒体|公众号|短视频|选题|稿件|品牌内容/i, evidence: /内容策划|文案|编辑|新媒体|公众号|短视频|选题|稿件|品牌内容/i },
  { id: "operations", name: "运营与活动执行", weight: 3, job: /运营|活动策划|社群|用户增长|活动执行|项目运营/i, evidence: /运营|活动策划|社群|用户增长|活动执行|项目运营/i },
  { id: "project_coordination", name: "项目协调与执行推进", weight: 3, job: /项目管理|项目协调|跨部门|进度管理|排期|资源协调|执行推进/i, evidence: /项目管理|项目协调|跨部门|进度管理|排期|资源协调|执行推进|组织/i },
  { id: "education_training", name: "课程设计与培训支持", weight: 3, job: /教学|课程设计|培训|教研|授课|教育/i, evidence: /教学|课程设计|培训|教研|授课|教育/i },
  { id: "communications", name: "传播与对外沟通", weight: 3, job: /公关|媒体|传播|品牌传播|舆情|对外沟通/i, evidence: /公关|媒体|传播|品牌传播|舆情|对外沟通/i },
  { id: "python", name: "Python", weight: 2, job: /\bpython\b/i, evidence: /\bpython\b/i },
  { id: "java", name: "Java", weight: 2, job: /\bjava\b/i, evidence: /\bjava\b/i },
  { id: "typescript", name: "TypeScript", weight: 2, job: /\btypescript\b/i, evidence: /\btypescript\b/i },
  { id: "sql", name: "SQL", weight: 2, job: /\bsql\b/i, evidence: /\bsql\b/i },
];

function requirementText(job) {
  // A role title and company introduction identify a vacancy, not a candidate
  // requirement.  Prioritise explicit requirement sentences; responsibilities
  // remain useful only when the JD has no structured requirements.
  const requirements = String(job.requirements || "").trim();
  if (requirements) return requirements;
  return String(job.description || "").trim();
}

function requirementLines(text) {
  return String(text || "")
    .split(/\r?\n|(?<=[。；;])/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isExplicitRequirement(text, capability) {
  const sentences = requirementLines(text);
  return sentences.some((sentence) => capability.job.test(sentence) && /熟悉|掌握|具备|要求|至少|必须|经验|能够|优先|需要/i.test(sentence));
}

export function semanticMatch(candidateProfile, job) {
  const sourceText = candidateProfile.evidence.map((record) => record.text).join("\n");
  const requiredText = requirementText(job);
  const detected = capabilities
    .filter((capability) => capability.job.test(requiredText))
    .map((capability) => {
      const evidence = candidateProfile.evidence.filter((record) => capability.evidence.test(record.text));
      return {
        id: capability.id,
        name: capability.name,
        weight: capability.weight,
        explicit: isExplicitRequirement(requiredText, capability),
        matched: evidence.length > 0,
        evidence_ids: evidence.map((record) => record.id),
        // The field makes the source of a missing conclusion auditable without
        // leaking an arbitrary keyword extracted from the whole JD.
        requirement: requirementLines(requiredText).find((line) => capability.job.test(line)) || job.title || capability.name,
      };
    });
  const matched = detected.filter((entry) => entry.matched);
  // Missing entries must be explicit or high-signal technical capabilities,
  // and are intentionally capped: this is a review queue, not a JD word dump.
  const missing = detected
    .filter((entry) => !entry.matched && (entry.explicit || entry.weight >= 4))
    .sort((a, b) => Number(b.explicit) - Number(a.explicit) || b.weight - a.weight)
    .slice(0, 5);
  const totalWeight = detected.reduce((sum, entry) => sum + entry.weight, 0);
  const matchedWeight = matched.reduce((sum, entry) => sum + entry.weight, 0);
  return {
    requirements: detected,
    matched,
    missing,
    coverage: totalWeight ? matchedWeight / totalWeight : 0,
    evidence_ids: [...new Set(matched.flatMap((entry) => entry.evidence_ids))],
    source_text: sourceText,
  };
}
