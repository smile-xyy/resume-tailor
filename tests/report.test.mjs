import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { contentHash } from "../lib/core.mjs";

const builder = path.resolve("scripts/build_report.mjs");
const template = fs.readFileSync(path.resolve("templates/report.html"), "utf8");

test("report exposes Chinese tiers, score details, search, and tier filter", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-report-"));
  const runDir = path.join(root, "output", "run-1");
  const jobDir = path.join(runDir, "jobs", "example");
  fs.mkdirSync(jobDir, { recursive: true });
  fs.mkdirSync(path.join(root, "templates"), { recursive: true });
  fs.writeFileSync(path.join(root, "templates", "report.html"), template);
  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify({
    company: "示例公司",
    title: "AI 工程师",
    url: "https://example.com/job/123",
    location: "广州",
    salary: "20-30K",
    needs_confirmation: ["company"]
  }));
  fs.writeFileSync(path.join(jobDir, "analysis.json"), JSON.stringify({
    scores: { total: 82, hard_skills: 88, experience_depth: 72, domain_fit: 84, soft_fit: 82, job_quality: 84 },
    recommendation: { tier: "strong" },
    evidence: { matched: ["LangGraph"], missing: ["React"], present_but_buried: [], soft_skill_proofs: ["ev-abcdef123456"] },
    assessment: { fit: [], risks: ["年限不足"], strategy: [], questions: ["确认项目规模"] }
  }));
  for (const file of ["analysis.md", "resume.md", "opener.md"]) {
    fs.writeFileSync(path.join(jobDir, file), `# ${file}\n`);
  }
  const pdfFilename = "张三-定制简历-示例公司-AI-工程师-run-1-12345678.pdf";
  fs.mkdirSync(path.join(runDir, "pdf"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "pdf", pdfFilename), "%PDF-1.4\n%%EOF\n");
  fs.writeFileSync(path.join(jobDir, "resume-pdf.json"), JSON.stringify({
    filename: pdfFilename,
    source_resume_hash: contentHash("# resume.md\n"),
    page_count: 1,
    sha256: "test-sha"
  }));
  fs.writeFileSync(
    path.join(jobDir, "diagrams.md"),
    "# 流程图\n\n证据 ID：ev-123456789abc、ev-abcdef123456\n\n```mermaid\nflowchart TD\n  A --> B\n```\n"
  );
  fs.writeFileSync(
    path.join(jobDir, "changelog.md"),
    "# 岗位定制说明\n\n1. 调整项目顺序。 <!-- diff-op:123456789abc -->\n"
  );

  const result = spawnSync("node", [builder, "run-1"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(path.join(runDir, "report.html"), "utf8");
  assert.match(html, /优先投递/);
  assert.match(html, /"hard_skills":88/);
  assert.match(html, /候选人匹配度/);
  assert.match(html, /岗位质量单列，不会抬高匹配度/);
  assert.match(html, /岗位质量/);
  assert.match(html, /岗位信息链接/);
  assert.match(html, /导出 PDF/);
  assert.match(html, new RegExp(pdfFilename));
  assert.match(html, /"pageCount":1/);
  assert.match(html, /copy-mermaid/);
  assert.match(html, /复制 Mermaid/);
  assert.match(html, /"inputConfirmation":\["company"\]/);
  assert.match(html, /截图待确认字段/);
  assert.match(html, /id="jobSearch"/);
  assert.match(html, /id="tierFilter"/);
  assert.match(html, />优化说明</);
  assert.doesNotMatch(html, /diff-op:123456789abc/);
  assert.doesNotMatch(html, /证据 ID：ev-123456789abc/);
  assert.doesNotMatch(html, /ev-[a-f0-9]{12}/);
});

test("report template keeps the native motion, accessibility, and offline fallback contracts", () => {
  assert.match(template, /--motion-fast:\s*140ms/);
  assert.match(template, /--motion-normal:\s*220ms/);
  assert.match(template, /--motion-slow:\s*520ms/);
  assert.match(template, /prefers-reduced-motion/);
  assert.match(template, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(template, /cancelAnimationFrame\(scoreAnimationFrame\)/);
  assert.match(template, /scaleX\(var\(--score-ratio\)\)/);
  assert.match(template, /role="tabpanel"/);
  assert.match(template, /aria-expanded/);
  assert.match(template, /role="status" aria-live="polite"/);
  assert.match(template, /复制开场白/);
  assert.match(template, /id="pdfLink"/);
  assert.match(template, /pdfLink\.download = item\.pdf\.filename/);
  assert.match(template, /放大查看/);
  assert.match(template, /id="mermaidDialog"/);
  assert.match(template, /openMermaidDialog/);
  assert.match(template, /pointerdown/);
  assert.match(template, /mermaidModalCanvas/);
  assert.match(template, /grid-template-columns:\s*280px minmax\(0, 1fr\) 500px/);
  assert.match(template, /grid-template-columns:\s*250px minmax\(0, 1fr\) 450px/);
  assert.match(template, /图表组件离线，已保留源码/);
  assert.doesNotMatch(template, /transition:\s*all/);
  assert.doesNotMatch(template, /setInterval\s*\(/);
  assert.doesNotMatch(template, /alert\s*\(/);
});
