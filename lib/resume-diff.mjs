import { contentHash } from "./core.mjs";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return new Set(clean(value).toLowerCase().split(/[^\p{L}\p{N}+#./-]+/u).filter(Boolean));
}

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

export function parseResume(markdown) {
  const document = { head: [], sections: [] };
  let section = null;
  let block = null;
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      section = { heading: clean(line.slice(3)), paragraphs: [], items: [], blocks: [] };
      document.sections.push(section);
      block = null;
    } else if (line.startsWith("### ") && section) {
      block = { heading: clean(line.slice(4)), paragraphs: [], items: [] };
      section.blocks.push(block);
    } else if (/^[-*]\s+/.test(line)) {
      const item = clean(line.replace(/^[-*]\s+/, ""));
      (block || section)?.items.push(item);
    } else if (section) {
      (block || section).paragraphs.push(clean(line));
    } else {
      document.head.push(clean(line));
    }
  }
  return document;
}

function contexts(document) {
  const result = [];
  for (const section of document.sections) {
    result.push({
      section: section.heading,
      block: "",
      paragraphs: section.paragraphs,
      items: section.items
    });
    for (const block of section.blocks) {
      result.push({
        section: section.heading,
        block: block.heading,
        paragraphs: block.paragraphs,
        items: block.items
      });
    }
  }
  return result;
}

function withId(operation) {
  const payload = { ...operation };
  return { id: contentHash(payload).slice(0, 12), ...payload };
}

export function buildResumeDiff(baseMarkdown, tailoredMarkdown) {
  const base = parseResume(baseMarkdown);
  const tailored = parseResume(tailoredMarkdown);
  const operations = [];
  const baseSections = new Map(base.sections.map((section) => [section.heading, section]));
  const tailoredSections = new Map(tailored.sections.map((section) => [section.heading, section]));

  for (const [heading] of tailoredSections) {
    if (!baseSections.has(heading)) {
      operations.push(withId({
        type: "add",
        section: heading,
        block: "",
        before: "",
        after: `新增章节：${heading}`,
        from_index: null,
        to_index: null,
        requires_confirmation: false,
        placeholder: false
      }));
    }
  }

  for (const [heading] of baseSections) {
    if (!tailoredSections.has(heading)) {
      operations.push(withId({
        type: "remove",
        section: heading,
        block: "",
        before: `删除章节：${heading}`,
        after: "",
        from_index: null,
        to_index: null,
        requires_confirmation: false,
        placeholder: false
      }));
    }
  }

  for (const [heading, baseSection] of baseSections) {
    const tailoredSection = tailoredSections.get(heading);
    if (!tailoredSection) continue;
    const oldOrder = baseSection.blocks.map((block) => block.heading);
    const newOrder = tailoredSection.blocks.map((block) => block.heading);
    for (const blockHeading of oldOrder) {
      const from = oldOrder.indexOf(blockHeading);
      const to = newOrder.indexOf(blockHeading);
      if (to >= 0 && from !== to) {
        operations.push(withId({
          type: "move",
          scope: "block",
          section: heading,
          block: blockHeading,
          before: blockHeading,
          after: blockHeading,
          from_index: from,
          to_index: to,
          requires_confirmation: false,
          placeholder: false
        }));
      }
    }
  }

  const baseContexts = new Map(contexts(base).map((context) => [`${context.section}\0${context.block}`, context]));
  const tailoredContexts = new Map(contexts(tailored).map((context) => [`${context.section}\0${context.block}`, context]));
  const keys = new Set([...baseContexts.keys(), ...tailoredContexts.keys()]);
  for (const key of keys) {
    const beforeContext = baseContexts.get(key) || { section: key.split("\0")[0], block: key.split("\0")[1], paragraphs: [], items: [] };
    const afterContext = tailoredContexts.get(key) || { ...beforeContext, paragraphs: [], items: [] };
    const beforeValues = [...beforeContext.paragraphs, ...beforeContext.items];
    const afterValues = [...afterContext.paragraphs, ...afterContext.items];
    const sharedValues = [...new Set(beforeValues.filter((value) => afterValues.includes(value)))];
    for (const value of sharedValues) {
      const from = beforeValues.indexOf(value);
      const to = afterValues.indexOf(value);
      if (from !== to) {
        operations.push(withId({
          type: "move",
          scope: "item",
          section: beforeContext.section,
          block: beforeContext.block,
          before: value,
          after: value,
          from_index: from,
          to_index: to,
          requires_confirmation: false,
          placeholder: false
        }));
      }
    }
    const removed = beforeValues.filter((value) => !afterValues.includes(value));
    const added = afterValues.filter((value) => !beforeValues.includes(value));
    const usedAdded = new Set();

    for (const before of removed) {
      let bestIndex = -1;
      let bestScore = 0;
      added.forEach((after, index) => {
        if (usedAdded.has(index)) return;
        const score = similarity(before, after);
        if (score > bestScore) {
          bestIndex = index;
          bestScore = score;
        }
      });
      if (bestIndex >= 0 && bestScore >= 0.34) {
        const after = added[bestIndex];
        usedAdded.add(bestIndex);
        operations.push(withId({
          type: "rewrite",
          section: beforeContext.section,
          block: beforeContext.block,
          before,
          after,
          from_index: beforeValues.indexOf(before),
          to_index: afterValues.indexOf(after),
          requires_confirmation: after.includes("[需确认]"),
          placeholder: after.includes("[请填写")
        }));
      } else {
        operations.push(withId({
          type: "remove",
          section: beforeContext.section,
          block: beforeContext.block,
          before,
          after: "",
          from_index: beforeValues.indexOf(before),
          to_index: null,
          requires_confirmation: false,
          placeholder: false
        }));
      }
    }

    added.forEach((after, index) => {
      if (usedAdded.has(index)) return;
      operations.push(withId({
        type: "add",
        section: afterContext.section,
        block: afterContext.block,
        before: "",
        after,
        from_index: null,
        to_index: afterValues.indexOf(after),
        requires_confirmation: after.includes("[需确认]"),
        placeholder: after.includes("[请填写")
      }));
    });
  }

  return {
    base_resume_hash: contentHash(baseMarkdown),
    tailored_resume_hash: contentHash(tailoredMarkdown),
    operations
  };
}

function shorten(value, length = 88) {
  const text = clean(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function location(operation) {
  return [operation.section, operation.block].filter(Boolean).join(" / ") || "文档";
}

function marker(operation) {
  return `<!-- diff-op:${operation.id} -->`;
}

function markers(operations) {
  return operations.map(marker).join(" ");
}

function isSummaryOperation(operation) {
  return operation.section === "求职概述";
}

function describeMove(operation) {
  if (operation.scope === "item") {
    return `将「${shorten(operation.before, 62)}」从第 ${(operation.from_index ?? 0) + 1} 条调整到第 ${(operation.to_index ?? 0) + 1} 条，让岗位相关成果更靠前。`;
  }
  return operation.block
    ? `将「${operation.block}」在「${operation.section}」中从第 ${(operation.from_index ?? 0) + 1} 项调整到第 ${(operation.to_index ?? 0) + 1} 项。`
    : `调整「${operation.section}」的展示顺序，让关键信息更靠前。`;
}

function renderOperation(operation) {
  const opMarker = marker(operation);
  if (operation.type === "rewrite") {
    return `- **实际改写：**「${shorten(operation.before, 72)}」→「${shorten(operation.after, 72)}」。 ${opMarker}`;
  }
  if (operation.type === "move") {
    return `- **顺序调整：**${describeMove(operation)} ${opMarker}`;
  }
  if (operation.type === "add") {
    return `- **补充表达：**在「${location(operation)}」加入「${shorten(operation.after, 72)}」。 ${opMarker}`;
  }
  return `- **弱化内容：**从「${location(operation)}」移除「${shorten(operation.before, 72)}」。 ${opMarker}`;
}

function appendEvidenceGaps(output, gaps) {
  if (!gaps?.length) return;
  output.push("## 尚未自动写入的优化建议");
  output.push("以下内容是当前 JD 的真实缺口。系统没有把它们硬塞进简历，需要你先确认是否有事实材料。");
  gaps.forEach((gap, index) => {
    output.push(`### ${index + 1}. ${gap.name}`);
    output.push(`**JD 要求：**${gap.requirement}`);
    output.push(`**建议：**${gap.suggestion}`);
  });
}

export function buildChangelogFromDiff(job, diff) {
  const title = `# 岗位定制说明：${job.company || "未知公司"} · ${job.title || "未知职位"}`;
  const operations = diff.operations || [];
  const plan = diff.tailoring || {};
  const focusAreas = plan.focus_areas || [];
  const output = [title];
  const represented = new Set();

  if (focusAreas.length || plan.primary_experiences?.length || plan.matched_keywords?.length) {
    output.push("## 岗位定制策略");
    if (focusAreas.length) output.push(`- **岗位重点：**${focusAreas.map((focus) => focus.name).join("、")}。`);
    if (plan.primary_experiences?.length) output.push(`- **主打经历：**${plan.primary_experiences.join("、")}。`);
    if (plan.matched_keywords?.length) output.push(`- **首屏关键词：**${plan.matched_keywords.join("、")}；均来自现有简历或经验材料。`);
  }

  if (!operations.length) {
    output.push("## 本岗位未改动正文");
    output.push("当前简历与该 JD 没有形成可验证的新改动，系统没有为了制造差异而改写原文。");
    appendEvidenceGaps(output, plan.evidence_gaps || []);
    return `${output.join("\n\n")}\n`;
  }

  output.push("## 已落实到简历的改动");
  const summaryOperations = operations.filter(isSummaryOperation);
  if (summaryOperations.length) {
    output.push("### 首屏求职定位");
    output.push(`- 根据当前岗位重新组织求职概述，只保留已有教育、技能和经历能够支持的定位，不把缺失技能写进正文。 ${markers(summaryOperations)}`);
    summaryOperations.forEach((operation) => represented.add(operation.id));
  }

  for (const focus of focusAreas) {
    const ids = new Set(focus.operation_ids || []);
    const related = operations.filter((operation) => ids.has(operation.id) && !represented.has(operation.id));
    if (!related.length) continue;
    output.push(`### ${focus.name}`);
    output.push(`**JD 关注：**${focus.requirement}`);
    output.push(`**已有证据：**「${focus.evidence.heading}」中已有“${shorten(focus.evidence.text, 92)}”。`);
    related.forEach((operation) => {
      output.push(renderOperation(operation));
      represented.add(operation.id);
    });
    output.push(`**为什么这样改：**${focus.reason || "该要求与上述经历存在直接对应关系，因此只调整原有事实的顺序和岗位化表述，让招聘方能快速看出要求与证据的关系。"}`);
  }

  const remaining = operations.filter((operation) => !represented.has(operation.id));
  if (remaining.length) {
    output.push("### 其他真实调整");
    remaining.forEach((operation) => {
      output.push(renderOperation(operation));
      represented.add(operation.id);
    });
  }

  const pending = operations.filter((operation) => operation.placeholder || operation.requires_confirmation);
  if (pending.length) {
    output.push("## 仍需你确认或补充");
    pending.forEach((operation) => {
      const reason = operation.placeholder ? "需要回填真实信息" : "属于轻度推断，需要确认";
      output.push(`- 「${location(operation)}」${reason}：${shorten(operation.after || operation.before)}。 ${marker(operation)}`);
    });
  }

  appendEvidenceGaps(output, plan.evidence_gaps || []);

  const unrepresented = operations.filter((operation) => !represented.has(operation.id));
  if (unrepresented.length) output.push(markers(unrepresented));
  return `${output.join("\n\n")}\n`;
}

export function changelogOperationIds(markdown) {
  return [...markdown.matchAll(/<!--\s*diff-op:([a-f0-9]{12})\s*-->/g)].map((match) => match[1]);
}
