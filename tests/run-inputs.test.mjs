import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureRunInputs } from "../lib/run-inputs.mjs";

test("run inputs remain immutable after source files change", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-inputs-"));
  const dataDir = path.join(root, "data");
  const runDir = path.join(root, "output", "run-1");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "resume.md"), "# Original\n");
  fs.writeFileSync(path.join(dataDir, "experience-bank.md"), "# Bank\n");
  fs.writeFileSync(path.join(dataDir, "profile.md"), "# Profile\n");

  const first = ensureRunInputs(root, runDir);
  fs.writeFileSync(path.join(dataDir, "resume.md"), "# Changed\n");
  const second = ensureRunInputs(root, runDir);

  assert.equal(first.resume, "# Original\n");
  assert.equal(second.resume, "# Original\n");
  assert.equal(first.manifest.resume_hash, second.manifest.resume_hash);
});
