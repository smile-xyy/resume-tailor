import { contentHash } from "./core.mjs";

export const coverLetterFields = [
  ["motivation", "为什么申请这个岗位和公司？"],
  ["relevant_experience", "哪段经历与岗位最相关？"],
  ["problem_to_solve", "你希望入职后帮助解决什么问题？"],
  ["contact", "可以使用的联系方式和所在城市是什么？"],
];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeCoverLetterAnswers(value) {
  const answers = {};
  const missing = [];
  for (const [field] of coverLetterFields) {
    answers[field] = clean(value?.[field]);
    if (!answers[field]) missing.push(field);
  }
  return { answers, missing };
}

export function renderCoverLetterQuestions(job, missingFields = coverLetterFields.map(([field]) => field)) {
  const questions = coverLetterFields.filter(([field]) => missingFields.includes(field));
  return `# 求职信信息确认：${job.company || "未知公司"} · ${job.title || "未知职位"}

${questions.map(([, question], index) => `${index + 1}. ${question}`).join("\n")}

请将回答保存为 JSON 后重新运行求职信命令。不得用推测内容代替回答。
`;
}

export function renderCoverLetterDraft(job, answers) {
  return `# 求职信：${job.company || "贵公司"} · ${job.title || "目标岗位"}

您好：

我希望申请${job.company || "贵公司"}的${job.title || "目标岗位"}。${answers.motivation}

与该岗位最相关的经历是：${answers.relevant_experience}

如果有机会加入，我希望重点帮助解决：${answers.problem_to_solve}

感谢您阅读这封求职信，期待进一步沟通。

${answers.contact}
`;
}

export function buildCoverLetterStatus({
  state,
  answers = null,
  draft = "",
  final = "",
  approvedDraftHash = null,
}) {
  return {
    schema_version: "1.0.0",
    state,
    answers_hash: answers ? contentHash(answers) : null,
    draft_hash: draft ? contentHash(draft) : null,
    approved_draft_hash: approvedDraftHash,
    final_hash: final ? contentHash(final) : null,
  };
}

export function validateCoverLetterFinal({ answers, draft, final, status }) {
  const errors = [];
  if (status?.state !== "approved") errors.push("status is not approved");
  if (status?.answers_hash !== contentHash(answers)) errors.push("answers hash mismatch");
  if (status?.draft_hash !== contentHash(draft)) errors.push("draft hash mismatch");
  if (status?.approved_draft_hash !== contentHash(draft)) errors.push("approval hash mismatch");
  if (status?.final_hash !== contentHash(final)) errors.push("final hash mismatch");
  if (final !== draft) errors.push("final content differs from approved draft");
  if (/\[(?:请填写|需确认)/.test(final)) errors.push("final contains unresolved placeholders");
  return errors;
}
