#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const runId = args[0];
const jobFile = args[1];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

if (!runId) {
  console.error("Usage: node scripts/run_pipeline.mjs <run_id> [jobs_json_path]");
  process.exit(2);
}

function run(commandArgs) {
  const result = spawnSync("node", commandArgs, {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run([path.join(scriptDir, "prepare_resume.mjs"), runId]);
run(jobFile ? [path.join(scriptDir, "import_jobs.mjs"), runId, jobFile] : [path.join(scriptDir, "import_jobs.mjs"), runId]);
run([path.join(scriptDir, "generate_outputs.mjs"), runId]);
run([path.join(scriptDir, "build_ats_html.mjs"), runId]);
run([path.join(scriptDir, "build_pdfs.mjs"), runId]);
run([path.join(scriptDir, "build_report.mjs"), runId]);
run([path.join(scriptDir, "validate_run.mjs"), runId]);

console.log(`DONE: output/${runId}/report.html`);
