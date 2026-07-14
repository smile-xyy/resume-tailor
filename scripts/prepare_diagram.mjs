#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { inspectProjectBrief, renderProjectDiagram } from "../lib/diagram-brief.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error("用法：node scripts/prepare_diagram.mjs <project.md> [output.md]");
  process.exit(2);
}
const fullInput = path.resolve(inputPath);
const markdown = fs.readFileSync(fullInput, "utf8");
const projectName = path.basename(fullInput, path.extname(fullInput));
const inspection = inspectProjectBrief(markdown);
const target = path.resolve(outputPath || path.join("output", "diagrams", `${projectName}.md`));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, renderProjectDiagram(projectName, markdown, inspection));
console.log(inspection.sufficient
  ? `OK: diagram generated at ${target}`
  : `NEEDS_INPUT: questions written to ${target}`);
