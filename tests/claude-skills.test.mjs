import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(".");
const claudeSkillDir = path.join(root, ".claude", "skills", "resume-tailor");
const claudeSkillPath = path.join(claudeSkillDir, "SKILL.md");
const canonicalSkillPath = path.join(root, "skills", "resume-tailor", "SKILL.md");

function frontmatter(markdown) {
  const match = String(markdown).match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "SKILL.md must have YAML frontmatter");
  return match[1];
}

test("Claude Code discovers the project resume-tailor skill", () => {
  assert.ok(fs.existsSync(claudeSkillPath));
  const source = fs.readFileSync(claudeSkillPath, "utf8");
  const yaml = frontmatter(source);
  assert.match(yaml, /^name:\s*resume-tailor$/m);
  assert.match(yaml, /^description:\s*.+$/m);
  assert.match(source, /\$\{CLAUDE_SKILL_DIR\}\/\.\.\/\.\.\/\.\.\/skills\/resume-tailor\/SKILL\.md/);
  assert.match(source, /guided-workflow\.md/);
});

test("Claude Code entry delegates to valid canonical cross-agent skills", () => {
  assert.ok(fs.existsSync(canonicalSkillPath));
  const canonical = fs.readFileSync(canonicalSkillPath, "utf8");
  for (const name of [
    "resume-tailor-ingest",
    "resume-tailor-analyze",
    "resume-tailor-write",
    "resume-tailor-diagram",
    "resume-tailor-report",
  ]) {
    const target = path.join(root, "skills", name, "SKILL.md");
    assert.ok(fs.existsSync(target), `missing canonical skill: ${name}`);
    assert.match(canonical, new RegExp(`\\.\\./${name}/SKILL\\.md`));
  }
  assert.ok(fs.existsSync(path.join(root, "skills", "resume-tailor", "references", "guided-workflow.md")));
});
