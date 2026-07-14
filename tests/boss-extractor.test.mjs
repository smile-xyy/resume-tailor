import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  decodeBossSalary,
  extractBossJob,
  jobStorageKey,
  validateExtractedBossJob
} from "../browser-extension/lib/boss-extractor.mjs";
import {
  exportEnvelope,
  normalizeStoredJobs,
  upsertJob
} from "../browser-extension/lib/job-store.mjs";

const importer = path.resolve("scripts/import_jobs.mjs");

function reader({ values = {}, lists = {}, sections = {}, pageType = "detail-page" }) {
  return {
    text(selectors) {
      for (const selector of selectors) if (values[selector]) return values[selector];
      return "";
    },
    texts(selectors) {
      for (const selector of selectors) if (lists[selector]) return lists[selector];
      return [];
    },
    section(headings) {
      for (const heading of headings) if (sections[heading]) return sections[heading];
      return "";
    },
    pageType() {
      return pageType;
    }
  };
}

test("Boss detail page extraction keeps structured fields", () => {
  const job = extractBossJob(reader({
    values: {
      ".job-detail-box .job-name": "AI Agent 开发工程师",
      ".job-detail-box .company-name": "示例科技",
      ".job-detail-box .salary": "20-30K",
      ".job-detail-box .job-area": "广州",
      ".job-degree": "本科",
      ".job-experience": "1-3年"
    },
    lists: {
      ".job-detail-box .job-tags span": ["Python", "LangGraph", "Python"],
      ".job-detail-box .job-benefits span": ["五险一金"]
    },
    sections: {
      "职位描述": "负责 Agent 工作流开发。",
      "任职要求": "熟悉 RAG 与 Tool Calling。"
    }
  }), "https://www.zhipin.com/job_detail/abc123.html");

  assert.equal(job.title, "AI Agent 开发工程师");
  assert.equal(job.company, "示例科技");
  assert.equal(job.external_id, "abc123");
  assert.deepEqual(job.tags, ["Python", "LangGraph"]);
  assert.deepEqual(validateExtractedBossJob(job), []);
});

test("Boss split view uses fallback body and marks missing fields", () => {
  const job = extractBossJob(reader({
    values: {
      ".job-name": "RAG 工程师",
      ".job-detail-box .job-sec-text": "负责知识库检索与重排。"
    },
    pageType: "split-view"
  }), "https://www.zhipin.com/web/geek/job?jobId=job-2");

  assert.equal(job.source.page_type, "split-view");
  assert.equal(job.description, "负责知识库检索与重排。");
  assert.ok(job.needs_confirmation.includes("company"));
  assert.ok(job.needs_confirmation.includes("requirements"));
  assert.deepEqual(validateExtractedBossJob(job), []);
});

test("Boss split view reads identity and company from the active job card", () => {
  const job = extractBossJob({
    ...reader({
      values: {
        ".job-name": "新媒体运营",
        ".job-detail-box .job-sec-text": "负责用户研究与内容运营。"
      },
      pageType: "split-view"
    }),
    activeJob() {
      return {
        title: "新媒体运营",
        company: "恺郡文化",
        salary: "6-10K",
        location: "广州",
        url: "https://www.zhipin.com/job_detail/card-job-1.html",
        external_id: "card-job-1"
      };
    }
  }, "https://www.zhipin.com/web/geek/jobs?city=101280100&query=运营");

  assert.equal(job.company, "恺郡文化");
  assert.equal(job.external_id, "card-job-1");
  assert.equal(job.url, "https://www.zhipin.com/job_detail/card-job-1.html");
  assert.equal(job.source.page_url, "https://www.zhipin.com/web/geek/jobs?city=101280100&query=运营");
});

test("Boss split view reads company from boss-info-attr and decodes PUA salary", () => {
  const base = reader({
    values: {
      ".job-detail-box .job-sec-text": "负责新媒体内容运营。"
    },
    pageType: "split-view"
  });
  const job = extractBossJob({
    ...base,
    panelText(selectors) {
      if (selectors.includes(".job-name")) return "新媒体运营实习生";
      if (selectors.includes(".boss-info-attr")) return "Classin · 招聘经理";
      if (selectors.includes(".job-salary")) {
        return "\uE032\uE036\uE031-\uE032\uE039\uE031元/天";
      }
      return "";
    }
  }, "https://www.zhipin.com/web/geek/jobs?query=运营");

  assert.equal(job.company, "Classin");
  assert.equal(job.salary, "150-180元/天");
  assert.ok(!job.needs_confirmation.includes("company"));
  assert.ok(!job.needs_confirmation.includes("salary"));
});

test("Boss salary decoder converts kanzhun PUA digits and rejects unknown mappings", () => {
  assert.equal(decodeBossSalary("\uE037-\uE032\uE031K"), "6-10K");
  assert.equal(decodeBossSalary("150-180元/天"), "150-180元/天");
  assert.equal(decodeBossSalary("\uE100K"), null);
});

test("Boss extraction rejects pages without a loaded job detail", () => {
  const job = extractBossJob(reader({}), "https://www.zhipin.com/");
  assert.equal(validateExtractedBossJob(job).length, 2);
});

test("job store updates duplicate jobs and preserves different jobs", () => {
  const first = { external_id: "a", title: "AI 工程师", company: "甲公司", salary: "20K" };
  const changed = { ...first, salary: "25K" };
  const other = { external_id: "b", title: "RAG 工程师", company: "乙公司" };
  const one = upsertJob([], first);
  const updated = upsertJob(one.jobs, changed);
  const two = upsertJob(updated.jobs, other);

  assert.equal(updated.updated, true);
  assert.equal(updated.jobs.length, 1);
  assert.equal(updated.jobs[0].salary, "25K");
  assert.equal(two.jobs.length, 2);
  assert.notEqual(jobStorageKey(first), jobStorageKey(other));
});

test("different Boss cards on one unchanged search URL are both preserved", () => {
  const listUrl = "https://www.zhipin.com/web/geek/jobs?city=101280100&query=运营";
  const first = {
    platform: "boss",
    external_id: "job-a",
    url: "https://www.zhipin.com/job_detail/job-a.html",
    source: { page_url: listUrl },
    title: "用户运营",
    company: "甲公司"
  };
  const second = {
    platform: "boss",
    external_id: "job-b",
    url: "https://www.zhipin.com/job_detail/job-b.html",
    source: { page_url: listUrl },
    title: "内容运营",
    company: "乙公司"
  };
  const saved = upsertJob(upsertJob([], first).jobs, second);

  assert.equal(saved.jobs.length, 2);
  assert.notEqual(jobStorageKey(first), jobStorageKey(second));
});

test("semantic fallback keeps different companies when a card has no job id", () => {
  const listUrl = "https://www.zhipin.com/web/geek/jobs?query=运营";
  const first = { platform: "boss", url: listUrl, title: "内容运营", company: "甲公司", location: "广州" };
  const second = { platform: "boss", url: listUrl, title: "内容运营", company: "乙公司", location: "广州" };
  const saved = upsertJob(upsertJob([], first).jobs, second);

  assert.equal(saved.jobs.length, 2);
});

test("legacy split-view record is upgraded instead of duplicated", () => {
  const listUrl = "https://www.zhipin.com/web/geek/jobs?query=运营";
  const legacy = { platform: "boss", url: listUrl, title: "新媒体运营", company: null };
  const incoming = {
    platform: "boss",
    external_id: "job-new",
    url: "https://www.zhipin.com/job_detail/job-new.html",
    source: { page_url: listUrl },
    title: "新媒体运营",
    company: "恺郡文化"
  };
  const result = upsertJob([legacy], incoming);

  assert.equal(result.updated, true);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].company, "恺郡文化");
  assert.equal(result.jobs[0].external_id, "job-new");
});

test("extension export uses resume-tailor-jobs v1 envelope", () => {
  const payload = exportEnvelope([{ title: "AI 工程师" }]);
  assert.equal(payload.format, "resume-tailor-jobs");
  assert.equal(payload.version, 1);
  assert.equal(payload.jobs.length, 1);
  assert.ok(payload.exported_at);
});

test("stored and exported Boss salaries never retain PUA digits", () => {
  const jobs = [{ platform: "boss", title: "新媒体运营", salary: "\uE037-\uE032\uE031K" }];
  const normalized = normalizeStoredJobs(jobs);
  const payload = exportEnvelope(jobs);

  assert.equal(normalized[0].salary, "6-10K");
  assert.equal(payload.jobs[0].salary, "6-10K");
});

test("extension export imports directly into Resume-Tailor", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-extension-"));
  const file = path.join(root, "export.jobs.json");
  const payload = exportEnvelope([{
    source: { type: "browser-extension" },
    external_id: "job-1",
    url: "https://www.zhipin.com/job_detail/job-1.html",
    title: "AI Agent 开发工程师",
    company: "示例公司",
    description: "负责 Agent 工作流开发。",
    requirements: "熟悉 LangGraph。",
    tags: ["LangGraph"],
    benefits: []
  }]);
  fs.writeFileSync(file, JSON.stringify(payload));
  const result = spawnSync("node", [importer, "run-1", file], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const jobsDir = path.join(root, "output", "run-1", "jobs");
  const [jobId] = fs.readdirSync(jobsDir);
  const job = JSON.parse(fs.readFileSync(path.join(jobsDir, jobId, "job.json"), "utf8"));
  assert.equal(job.source.type, "browser-extension");
  assert.equal(job.external_id, "job-1");
});
