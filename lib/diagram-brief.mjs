function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function section(markdown, names) {
  const lines = String(markdown || "").split(/\r?\n/);
  const index = lines.findIndex((line) => /^#{1,3}\s+/.test(line) && names.some((name) => line.replace(/^#{1,3}\s+/, "").includes(name)));
  if (index < 0) return "";
  const body = [];
  for (let cursor = index + 1; cursor < lines.length && !/^#{1,3}\s+/.test(lines[cursor]); cursor += 1) {
    if (lines[cursor].trim()) body.push(clean(lines[cursor].replace(/^[-*\d.、)]+\s*/, "")));
  }
  return body.join("；");
}

function numberedSteps(markdown) {
  return String(markdown || "").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:\d+[.、)]|[-*])\s*/.test(line))
    .map((line) => clean(line.replace(/^(?:\d+[.、)]|[-*])\s*/, "")))
    .filter(Boolean);
}

function mermaidLabel(value) {
  return clean(value).replace(/[\[\]{}()"<>|]/g, " ").slice(0, 24) || "待确认";
}

function narrative(value) {
  return clean(value).replace(/[。！？；;]+$/g, "");
}

export function inspectProjectBrief(markdown) {
  const steps = numberedSteps(markdown);
  const arrows = String(markdown || "").match(/[^→\n]+→[^→\n]+/g) || [];
  const arrowSteps = arrows.flatMap((chain) => chain.split("→").map(clean)).filter(Boolean);
  const nodes = steps.length >= 3 ? steps : arrowSteps;
  const hasStart = /起点|开始|输入|用户|需求|接收|触发/.test(markdown) || nodes.length >= 1;
  const hasEnd = /终点|结束|输出|交付|上线|返回|复盘|完成|结果/.test(markdown) || nodes.length >= 3;
  const hasRelations = /→|并行|分支|判断|然后|之后|流转|调用|如果|当.*时/.test(markdown) || nodes.length >= 3;
  const hasContext = /背景|场景|目标|问题|面向|项目从|负责/.test(markdown);
  const questions = [];
  if (!hasStart || !hasEnd) questions.push("这个项目从什么输入或事件开始，最终产出什么？");
  if (nodes.length < 3) questions.push("请按顺序列出至少 3 个关键步骤、模块或参与角色。");
  if (!hasRelations) questions.push("这些环节是顺序、并行还是有判断分支？请标出关系。");
  if (!hasContext) questions.push("请补充项目背景、服务对象和要解决的问题。");
  return {
    sufficient: hasStart && hasEnd && nodes.length >= 3 && hasRelations && hasContext,
    nodes,
    context: section(markdown, ["背景", "场景", "目标", "问题"]),
    tools: section(markdown, ["工具", "技术", "平台", "方法"]),
    results: section(markdown, ["结果", "成果", "产出", "复盘"]),
    questions: questions.slice(0, 3)
  };
}

function renderNonLinearFlow(inspection) {
  const nodes = inspection.nodes.slice(0, 8);
  const lines = ["flowchart TD", "  START((项目输入))", `  START --> N1[${mermaidLabel(nodes[0])}]`];
  nodes.slice(1).forEach((node, index) => {
    const id = `N${index + 2}`;
    lines.push(`  ${id}[${mermaidLabel(node)}]`);
    if (/并行|同时|同步/.test(node) || /并行|同时|同步/.test(nodes[index])) {
      lines.push(`  N${index + 1} --> ${id}`);
    } else {
      lines.push(`  N${index + 1} --> ${id}`);
    }
  });
  const endId = `N${nodes.length}`;
  lines.push("  OUT((项目产出))", `  ${endId} --> OUT`);
  if (inspection.tools) {
    lines.push("  METHODS[方法与工具]", "  START -.支撑.-> METHODS");
    inspection.tools.split("；").slice(0, 5).forEach((tool, index) => {
      const id = `M${index + 1}`;
      lines.push(`  ${id}[${mermaidLabel(tool)}]`, `  METHODS -.-> ${id}`);
    });
  }
  if (inspection.results) {
    lines.push("  RESULT[结果与复盘]", "  OUT --> RESULT");
    inspection.results.split("；").slice(0, 4).forEach((result, index) => {
      const id = `R${index + 1}`;
      lines.push(`  ${id}[${mermaidLabel(result)}]`, `  RESULT -.-> ${id}`);
    });
  }
  return lines;
}

function renderMindmap(inspection) {
  const lines = ["mindmap", "  root((项目全景))", "    流程"];
  inspection.nodes.slice(0, 8).forEach((node) => lines.push(`      ${mermaidLabel(node)}`));
  if (inspection.tools) {
    lines.push("    方法与工具");
    inspection.tools.split("；").slice(0, 6).forEach((item) => lines.push(`      ${mermaidLabel(item)}`));
  }
  if (inspection.results) {
    lines.push("    结果与产出");
    inspection.results.split("；").slice(0, 4).forEach((item) => lines.push(`      ${mermaidLabel(item)}`));
  }
  return lines;
}

function renderSpeakerScript(projectName, inspection) {
  const parts = [
    `我介绍一下“${projectName}”。`,
    inspection.context ? `这个项目的背景和目标是：${narrative(inspection.context)}。` : "项目从既定需求或用户输入开始。",
    `整体流程包括：${inspection.nodes.slice(0, 8).map(narrative).join("，然后是")}。`,
    inspection.tools ? `其中使用的方法、工具或协作方式包括：${inspection.tools.split("；").map(narrative).join("；")}。` : "各环节的具体工具以项目实际记录为准。",
    inspection.results ? `最终产出或结果是：${inspection.results.split("；").map(narrative).join("；")}。` : "最终交付以项目记录中的结果为准。",
    "这张图重点展示项目的输入、关键环节、支撑方法和产出，方便面试时按结构展开。"
  ];
  return parts.join("\n");
}

export function renderProjectDiagram(projectName, markdown, inspection = inspectProjectBrief(markdown)) {
  const output = [
    `# 架构与流程图：${projectName}`,
    "> 以下图表只使用项目描述中已经提供的信息。Mermaid 代码可直接复制到 Mermaid Live、Markdown 编辑器或文档中。"
  ];
  if (!inspection.sufficient) {
    output.push("## 信息不足，暂不生成图", ...inspection.questions.map((question) => `- ${question}`));
    return `${output.join("\n\n")}\n`;
  }
  const type = inspection.tools || inspection.results ? "flowchart TD" : "mindmap";
  output.push("## 项目全景", `**类型**：${type}`, "**证据来源**：用户提供的项目描述", "```mermaid", ...(type === "mindmap" ? renderMindmap(inspection) : renderNonLinearFlow(inspection)), "```", "## 待确认项", "- 无", "## 项目讲解稿", renderSpeakerScript(projectName, inspection));
  return `${output.join("\n\n")}\n`;
}
