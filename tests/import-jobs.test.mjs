import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const importer = path.resolve("scripts/import_jobs.mjs");

test("different jobs with the same readable id never overwrite each other", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-import-"));
  const input = path.join(root, "jobs.json");
  fs.writeFileSync(input, JSON.stringify({
    jobs: [
      { id: "same-role", title: "AI Engineer", company: "Example", description: "Agent workflow" },
      { id: "same-role", title: "AI Engineer", company: "Example", description: "RAG platform" }
    ]
  }));

  const first = spawnSync("node", [importer, "run-1", input], { cwd: root, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const jobsDir = path.join(root, "output", "run-1", "jobs");
  const directories = fs.readdirSync(jobsDir).sort();
  assert.equal(directories.length, 2);
  assert.ok(directories.includes("same-role"));
  assert.ok(directories.some((name) => /^same-role-[a-f0-9]{8}$/.test(name)));

  const second = spawnSync("node", [importer, "run-1", input], { cwd: root, encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readdirSync(jobsDir).length, 2);
  const state = JSON.parse(fs.readFileSync(path.join(root, "output", "run-1", "state.json"), "utf8"));
  assert.equal(new Set(state.imported).size, 2);
});
