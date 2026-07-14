import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const skill = fs.readFileSync("skills/resume-tailor/SKILL.md", "utf8");
const guide = fs.readFileSync("skills/resume-tailor/references/guided-workflow.md", "utf8");
const jobInputGuide = fs.readFileSync("skills/resume-tailor/references/job-input-guide.md", "utf8");
const agent = fs.readFileSync("skills/resume-tailor/agents/openai.yaml", "utf8");

test("main skill exposes the guided command-like entry point", () => {
  assert.match(skill, /`\/resume-tailor`/);
  assert.match(skill, /references\/guided-workflow\.md/);
  assert.match(skill, /Ask exactly one/);
  assert.match(agent, /default_prompt: "\/resume-tailor"/);
});

test("guided workflow has resumable phases and HTML completion gate", () => {
  for (const phase of [
    "Phase 1: Resume",
    "Phase 2: Preferences",
    "Phase 3: Experience Bank",
    "Phase 4: Job Input",
    "Phase 5: Confirmation",
    "Phase 6: Generate",
    "Phase 7: Verify and Deliver",
    "Phase 8: Optional Follow-up",
  ]) {
    assert.match(guide, new RegExp(phase));
  }
  assert.match(guide, /Ask exactly one blocking question per reply/);
  assert.match(guide, /Validator success/);
  assert.match(guide, /report\.html/);
});

test("job input phase gives users an actionable Chrome and fallback guide", () => {
  assert.match(guide, /job-input-guide\.md/);
  assert.match(guide, /Do not reduce this phase to a one-line list/);
  for (const expected of [
    "chrome://extensions",
    "开发者模式",
    "加载未打包的扩展程序",
    "browser-extension",
    "保存当前岗位",
    "导出 jobs.json",
    "Boss 直聘",
    "前程无忧",
    "智联招聘",
    "猎聘",
    "岗位截图",
    "直接复制 JD",
    "安装插件",
  ]) {
    assert.match(jobInputGuide, new RegExp(expected));
  }
  assert.match(jobInputGuide, /职位名称：[\s\S]*岗位职责：[\s\S]*任职要求：/);
  assert.match(jobInputGuide, /一次只让用户完成一个步骤/);
  assert.match(jobInputGuide, /系统不会根据空字段猜测岗位/);
  assert.match(jobInputGuide, /不同岗位会追加，同一岗位再次保存才会更新/);
  assert.match(jobInputGuide, /已添加岗位.*已更新岗位/s);
});
