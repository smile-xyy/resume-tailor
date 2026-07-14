import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildResumePdfFilename,
  normalizePdfFilenamePart,
  shortJobIdentity,
} from "../lib/pdf-export.mjs";

test("PDF filenames are readable, job-specific, and filesystem-safe", () => {
  const filename = buildResumePdfFilename({
    candidateName: "谢运宇",
    company: "示例/公司",
    title: "内容运营：校园项目?",
    runId: "2026-07-11-1030",
    jobId: "job-1",
    jobHash: "abcdef1234567890",
  });
  assert.equal(
    filename,
    "谢运宇-定制简历-示例-公司-内容运营-校园项目-2026-07-11-1030-abcdef12.pdf"
  );
  assert.doesNotMatch(filename, /[\\/:*?"<>|]/);
});

test("PDF filename normalization supports humanities roles and deterministic fallback hashes", () => {
  assert.equal(normalizePdfFilenamePart("  品牌  文案_策划  ", "岗位"), "品牌-文案-策划");
  const first = shortJobIdentity({ company: "出版社", title: "编辑" }, "job-a");
  const second = shortJobIdentity({ company: "出版社", title: "编辑" }, "job-a");
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{8}$/);
});

test("PDF renderer produces selectable text when the bundled runtime is available", (t) => {
  const python = path.join(
    os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime",
    "dependencies", "python", "bin", "python3"
  );
  if (!fs.existsSync(python)) return t.skip("bundled PDF runtime unavailable");
  const probe = spawnSync(python, ["-c", "import reportlab, pypdf"], { encoding: "utf8" });
  if (probe.status !== 0) return t.skip("reportlab/pypdf unavailable");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-pdf-"));
  const input = path.join(tempDir, "input.json");
  const output = path.join(tempDir, "resume.pdf");
  fs.writeFileSync(input, JSON.stringify({
    markdown: "# 张三\n\n## 教育经历\n\n- 中文系本科，完成新闻采访与专题写作。\n",
    candidate_name: "张三",
    company: "示例出版社",
    role: "内容编辑",
    run_id: "test-run",
    font_path: "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  }));
  const result = spawnSync(python, [
    path.resolve("scripts/render_resume_pdf.py"), "--input", input, "--output", output,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.statSync(output).size > 1000);
  const metadata = JSON.parse(result.stdout);
  assert.equal(metadata.page_count, 1);
  assert.ok(metadata.extracted_characters >= 20);
});
