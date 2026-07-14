#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const failures = [];
const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "examples/resume.md",
  "examples/profile.md",
  "examples/experience-bank.md",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing required public file: ${file}`);
}
if (!fs.existsSync("LICENSE") && !fs.existsSync("LICENSE.md")) {
  failures.push("missing open-source license");
}

const trackedResult = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (trackedResult.status !== 0) {
  failures.push("unable to list tracked files");
} else {
  const trackedFiles = trackedResult.stdout.split("\0").filter(Boolean);
  const checks = [
    { label: "absolute macOS user path", pattern: /\/Users\/[^/\s]+/ },
    { label: "possible mainland China phone number", pattern: /\b1[3-9]\d{9}\b/ },
    { label: "private key", pattern: /BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY/ },
    { label: "common API token", pattern: /\b(?:sk-|ghp_)[A-Za-z0-9_-]{20,}/ },
  ];
  for (const file of trackedFiles) {
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const check of checks) {
      if (check.pattern.test(content)) failures.push(`${check.label}: ${file}`);
    }
  }
}

const historicalNames = [
  ["job", "hunt"].join("-"),
  ["career", "ops"].join("-"),
];
const historyResult = spawnSync("git", ["log", "--all", "-p", "--format="], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
if (historyResult.status !== 0) {
  failures.push("unable to inspect Git history");
} else {
  const lowerHistory = historyResult.stdout.toLowerCase();
  for (const name of historicalNames) {
    if (lowerHistory.includes(name)) failures.push("Git history contains a removed upstream project name");
  }
}

if (failures.length) {
  for (const failure of [...new Set(failures)]) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log("OK: release audit passed");
