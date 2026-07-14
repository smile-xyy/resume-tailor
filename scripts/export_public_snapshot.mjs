#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const destinationArg = process.argv[2];
if (!destinationArg) {
  console.error("Usage: node scripts/export_public_snapshot.mjs <new-directory>");
  process.exit(2);
}

const destination = path.resolve(destinationArg);
if (fs.existsSync(destination)) {
  console.error(`Destination already exists: ${destination}`);
  process.exit(1);
}

const archive = spawnSync("git", ["archive", "--format=tar", "HEAD"], {
  encoding: null,
  maxBuffer: 50 * 1024 * 1024,
});
if (archive.status !== 0) {
  console.error(String(archive.stderr || "Unable to create Git archive."));
  process.exit(1);
}

fs.mkdirSync(destination, { recursive: false });
const extracted = spawnSync("tar", ["-xf", "-", "-C", destination], {
  input: archive.stdout,
  encoding: null,
});
if (extracted.status !== 0) {
  console.error(String(extracted.stderr || "Unable to extract public snapshot."));
  process.exit(1);
}

console.log(`OK: clean public snapshot exported to ${destination}`);
console.log("Initialize a new Git repository in that directory; do not push the old repository history.");
