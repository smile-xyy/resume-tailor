import { exportEnvelope, normalizeStoredJobs } from "../lib/job-store.mjs";
import { jobStorageKey } from "../lib/boss-extractor.mjs";

const jobsNode = document.getElementById("jobs");
const emptyNode = document.getElementById("empty");
const countNode = document.getElementById("count");
const clearButton = document.getElementById("clear");
const exportButton = document.getElementById("export");

let jobs = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function save(next) {
  jobs = next;
  await chrome.storage.local.set({ savedJobs: jobs });
  render();
}

function render() {
  countNode.textContent = `${jobs.length} 个岗位`;
  emptyNode.hidden = jobs.length > 0;
  jobsNode.innerHTML = "";
  clearButton.disabled = jobs.length === 0;
  exportButton.disabled = jobs.length === 0;

  for (const job of jobs) {
    const item = document.createElement("article");
    item.className = "job";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(job.company || "公司待确认")} · ${escapeHtml(job.title || "岗位待确认")}</strong>
        <span>${escapeHtml(job.location || "")} ${escapeHtml(job.salary || "")}</span>
      </div>
      <button class="delete" type="button" title="删除此岗位" aria-label="删除此岗位">×</button>
    `;
    item.querySelector(".delete").addEventListener("click", () => {
      const key = jobStorageKey(job);
      save(jobs.filter((candidate) => jobStorageKey(candidate) !== key));
    });
    jobsNode.appendChild(item);
  }
}

clearButton.addEventListener("click", () => {
  if (jobs.length && window.confirm(`确定清空已收藏的 ${jobs.length} 个岗位吗？`)) save([]);
});

exportButton.addEventListener("click", () => {
  const payload = exportEnvelope(jobs);
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  link.href = url;
  link.download = `resume-tailor-jobs-${timestamp}.jobs.json`;
  link.click();
  URL.revokeObjectURL(url);
});

chrome.storage.local.get({ savedJobs: [] }).then((stored) => {
  jobs = normalizeStoredJobs(stored.savedJobs);
  if (JSON.stringify(jobs) !== JSON.stringify(stored.savedJobs)) {
    chrome.storage.local.set({ savedJobs: jobs });
  }
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.savedJobs) return;
  jobs = changes.savedJobs.newValue || [];
  render();
});
