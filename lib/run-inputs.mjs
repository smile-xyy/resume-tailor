import fs from "node:fs";
import path from "node:path";
import { contentHash, writeJsonAtomic } from "./core.mjs";

function immutableValues(resume) {
  const values = new Set();
  for (const line of resume.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    if (/^###\s+.+\s+\|\s+.+/.test(text)) values.add(text.replace(/^###\s+/, ""));
    for (const match of text.matchAll(/\b20\d{2}\.\d{2}\s*-\s*(?:20\d{2}\.\d{2}|至今)\b/g)) {
      values.add(match[0]);
    }
    for (const match of text.matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)) values.add(match[0]);
    for (const match of text.matchAll(/1\d{10}/g)) values.add(match[0]);
  }
  const title = resume.match(/^#\s+(.+)$/m);
  if (title) values.add(title[1].trim());
  return [...values].sort();
}

export function ensureRunInputs(root, runDir) {
  const inputsDir = path.join(runDir, "inputs");
  const projectInputsDir = path.join(inputsDir, "projects");
  const manifestPath = path.join(inputsDir, "manifest.json");
  const files = {
    resume: path.join(inputsDir, "resume.md"),
    bank: path.join(inputsDir, "experience-bank.md"),
    profile: path.join(inputsDir, "profile.md")
  };

  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(inputsDir, { recursive: true });
    const resume = fs.readFileSync(path.join(root, "data", "resume.md"), "utf8");
    const bank = fs.readFileSync(path.join(root, "data", "experience-bank.md"), "utf8");
    const profile = fs.readFileSync(path.join(root, "data", "profile.md"), "utf8");
    fs.writeFileSync(files.resume, resume);
    fs.writeFileSync(files.bank, bank);
    fs.writeFileSync(files.profile, profile);
    const sourceProjectsDir = path.join(root, "data", "projects");
    const projectBriefs = fs.existsSync(sourceProjectsDir)
      ? fs.readdirSync(sourceProjectsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
        .map((entry) => {
          const content = fs.readFileSync(path.join(sourceProjectsDir, entry.name), "utf8");
          fs.mkdirSync(projectInputsDir, { recursive: true });
          fs.writeFileSync(path.join(projectInputsDir, entry.name), content);
          return { name: entry.name, hash: contentHash(content) };
        })
      : [];
    writeJsonAtomic(manifestPath, {
      resume_hash: contentHash(resume),
      experience_bank_hash: contentHash(bank),
      profile_hash: contentHash(profile),
      combined_evidence_hash: contentHash(`${resume}\n${bank}`),
      immutable_values: immutableValues(resume),
      project_briefs: projectBriefs,
      captured_at: new Date().toISOString()
    });
  }

  const resume = fs.readFileSync(files.resume, "utf8");
  const bank = fs.readFileSync(files.bank, "utf8");
  const profile = fs.readFileSync(files.profile, "utf8");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const projectSourceDir = manifest.project_briefs
    ? projectInputsDir
    : path.join(root, "data", "projects");
  const projectBriefs = fs.existsSync(projectSourceDir)
    ? fs.readdirSync(projectSourceDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
      .map((entry) => ({ name: entry.name, path: path.join(projectSourceDir, entry.name), markdown: fs.readFileSync(path.join(projectSourceDir, entry.name), "utf8") }))
    : [];
  const actual = {
    resume_hash: contentHash(resume),
    experience_bank_hash: contentHash(bank),
    profile_hash: contentHash(profile),
    combined_evidence_hash: contentHash(`${resume}\n${bank}`)
  };
  for (const [key, value] of Object.entries(actual)) {
    if (manifest[key] !== value) throw new Error(`Run input snapshot hash mismatch: ${key}`);
  }
  return { resume, bank, profile, manifest, inputsDir, projectBriefs };
}
