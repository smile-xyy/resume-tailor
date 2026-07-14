import assert from "node:assert/strict";
import test from "node:test";
import { extractJob, supportedPlatforms, validateExtractedJob } from "../browser-extension/lib/job-extractor.mjs";

function readerFor(values) {
  return {
    text(selectors) {
      for (const selector of selectors) {
        if (values[selector]) return values[selector];
        if (/job-name|job-title|job-header h1|summary-plane h1|\.cn$|tHeader h1|^h1$/.test(selector) && values.title) return values.title;
        if (/company|cname|com_name|company-info/.test(selector) && values.company) return values.company;
        if (/salary|sal/.test(selector) && values.salary) return values.salary;
        if (/job-area|location|job-address|sp4/.test(selector) && values.location) return values.location;
      }
      return "";
    },
    section(headings) {
      return headings.includes("任职要求") ? values.requirements || "" : values.description || "";
    },
    texts() { return []; },
    pageType() { return "detail-page"; }
  };
}

test("extension recognizes the four supported job platforms", () => {
  assert.deepEqual(supportedPlatforms(), ["boss", "zhaopin", "qiancheng", "liepin"]);
  for (const [url, platform] of [
    ["https://www.zhipin.com/job_detail/abc.html", "boss"],
    ["https://sou.zhaopin.com/job/abc", "zhaopin"],
    ["https://jobs.51job.com/guangzhou/abc.html", "qiancheng"],
    ["https://www.liepin.com/job/abc", "liepin"],
  ]) {
    const reader = readerFor({
      title: "用户研究专员",
      company: "明川公益",
      salary: "8-12K",
      location: "广州",
      ".job-description": "负责用户访谈和研究报告。",
      description: "负责用户访谈和研究报告。",
      requirements: "具备问卷设计经验。",
    });
    const job = extractJob(reader, url);
    assert.equal(job.platform, platform);
    assert.equal(job.title, "用户研究专员");
    assert.equal(job.description, "负责用户访谈和研究报告。");
    assert.deepEqual(validateExtractedJob(job), []);
  }
});

test("unknown or unloaded pages provide a screenshot/copy fallback", () => {
  const job = extractJob(readerFor({}), "https://example.com/jobs/1");
  const errors = validateExtractedJob(job);
  assert.ok(errors.some((error) => /截图|粘贴|复制/.test(error)));
});
