---
name: resume-tailor-report
description: 内部报告生成 skill。汇总每个岗位的分析、定制简历、改动说明、开场白、Cover Letter 和 Mermaid 架构图，生成本地静态 HTML 报告。
---

# Resume Tailor Report

## Inputs

- `output/<run_id>/state.json`
- `output/<run_id>/jobs/*/job.json`
- `output/<run_id>/jobs/*/analysis.md`
- `output/<run_id>/jobs/*/resume.md`
- `output/<run_id>/jobs/*/opener.md`
- `output/<run_id>/jobs/*/changelog.md`
- `output/<run_id>/jobs/*/diagrams.md`
- `output/<run_id>/jobs/*/cover-letter.md`（如有）
- `output/<run_id>/jobs/*/resume-pdf.json` 与 `output/<run_id>/pdf/*.pdf`（如已生成）
- `templates/report.html`

## Output

```text
output/<run_id>/report.html
```

## Layout

- **Top**: run summary — run_id, 当前阶段, 进度统计（已导入/已分析/已定制）
- **Left**: job list sorted by score, with recommendation (优先投递/可以投递/谨慎投递/暂缓投递)
- **Center**: tailored resume (resume.md rendered as HTML)
- **Center toolbar**: current-job “导出 PDF” download, plus ATS HTML and job link; PDF action is hidden when the validated job-specific artifact is absent
- **Right**: tabs for analysis / changelog / opener / diagrams / cover letter
- **Bottom**: user action items (missing inputs, gaps to fill, confirmations needed)

## Rules

- Static HTML only. No server required.
- PDF 链接必须指向当前岗位的规范化文件名，并使用同名 `download` 属性；不得让不同岗位复用同一个 PDF。
- Make missing user inputs visually obvious.
- Include diagrams (Mermaid) rendered inline where available.
- Cover letter tab only shown when cover-letter.md exists.
- The analysis panel shows all 5 score dimensions with numeric values and bars.
- The opener tab must clearly separate the copy-ready message from “前 15 字预览” and “为什么这样写”, so rationale text is never mistaken for content to send.
- Every Mermaid block in the diagrams tab must be wrapped in a card with top-right “放大查看” and “复制 Mermaid” buttons. “放大查看” opens a native dialog with zoom in/out/reset and pointer drag; “复制 Mermaid” copies the original source code.

## Visual and interaction acceptance

- Treat the report as a three-column resume workbench, not a management dashboard: compact job list on the left, the resume as the visual center, and a restrained right-side inspector.
- On desktop, reserve enough center width for a readable resume paper (about 790–820px maximum); the right inspector should remain narrow enough to be secondary, with no wrapped tab rows.
- Keep the first inspector screen decision-oriented: show one score summary, all five numeric dimensions, then prioritize risks and true gaps before supporting matched evidence. Do not duplicate the same analysis markdown directly below the structured summary; put full rationale behind an explicit disclosure.
- Use only native CSS and JavaScript for motion. Define `--motion-fast: 140ms`, `--motion-normal: 220ms`, `--motion-slow: 520ms` and explicit easing variables. Never use `transition: all`, looping decoration, or an animation framework.
- Initial entry may gently stagger header, job list, resume paper, and inspector. Score count-up and progress bars must replay on initial load, job changes, and returning to matching analysis; cancel stale animation frames during rapid switching.
- Tabs and job changes must update data first, restore inspector scroll to top, keep exactly one active accessible tab panel, and use only a light opacity/translate transition for the updated content.
- Long changelog entries must be collapsible with `aria-expanded`; HR opener and Mermaid source copies must provide a real success/failure toast. Mermaid cards must expose loading, rendered, empty, offline-source fallback, and zoom-dialog states without breaking the rest of a local `file://` report.
- Include `prefers-reduced-motion` CSS and matching JavaScript behavior: scores and bars go directly to final values, content switches immediately, and smooth scrolling is disabled.
- Before delivery, render the actual report in a desktop browser at 1655×927 when the browser runtime honors that override. Capture the first screen and full page, inspect for clipping/overflow, then complete at least two visual adjustment rounds. If the runtime does not honor the requested viewport, record the actual size and validate the desktop grid through its computed desktop rule as well.
