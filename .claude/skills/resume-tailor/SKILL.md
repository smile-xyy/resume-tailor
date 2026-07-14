---
name: resume-tailor
description: 本地简历定制与 HTML/PDF 报告向导。用户输入 `/resume-tailor`、要求导入简历与岗位、分析匹配、生成岗位定制简历或继续上次流程时使用；兼容技术、文科、商科、教育、运营、研究和内容岗位。
---

# Resume Tailor for Claude Code

Use the repository's canonical cross-agent skill; do not duplicate or rewrite its workflow here.

Before replying or taking task actions:

1. Read `${CLAUDE_SKILL_DIR}/../../../skills/resume-tailor/SKILL.md` completely and follow it as the source of truth.
2. Read `${CLAUDE_SKILL_DIR}/../../../skills/resume-tailor/references/guided-workflow.md` completely.
3. Resolve references mentioned by the canonical skill from the repository root or the canonical skill directory, as specified there.
4. When the canonical skill routes to an internal phase, read that phase's sibling `SKILL.md` before acting.

Run the guided workflow in the current repository. Ask only the next blocking question, execute repository scripts on the user's behalf, preserve evidence boundaries, and do not claim completion until validation succeeds.
