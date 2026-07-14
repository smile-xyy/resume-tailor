---
name: resume-tailor
description: 本地简历定制与 HTML 报告向导。当用户输入 `/resume-tailor`、`$resume-tailor`，或要求逐步完成简历优化时使用；一次只引导一个必要输入，依次完成候选人资料、岗位导入、字段确认、匹配分析、可信改写、证据图、验证和本地 HTML 报告。
---

# Resume Tailor

Run as a guided conversation by default. Read
`references/guided-workflow.md` completely before replying to the initial
invocation. Infer the current phase from files on disk and continue from the
first incomplete phase.

Do not respond to `/resume-tailor` with a command list. Ask exactly one
short, actionable question unless all required inputs are already available.
When inputs are complete, execute the pipeline without asking the user to run
terminal commands.

## Sub-skill Routing

Before executing a phase, read the corresponding sibling skill completely:

- ingest and job normalization: `../resume-tailor-ingest/SKILL.md`
- matching analysis: `../resume-tailor-analyze/SKILL.md`
- resume, opener, changelog and PDF source: `../resume-tailor-write/SKILL.md`
- project diagrams: `../resume-tailor-diagram/SKILL.md`
- HTML report assembly: `../resume-tailor-report/SKILL.md`

These relative paths are the canonical instructions for Codex, Claude Code,
and other Agent Skills-compatible clients.

## Deterministic Workflow

1. Check or guide creation of:
   - `data/resume.md`
   - `data/profile.md`
   - `data/experience-bank.md`
   - `data/projects/*.md`（至少一个希望生成流程图/架构图的项目说明）
   - `data/jobs/inbox/*.json`
   - or a JD text / job screenshot supplied by the user
2. Create a `run_id` using local time: `YYYY-MM-DD-HHMM`.
3. Create `output/<run_id>/jobs/`.
4. Capture immutable input files under `output/<run_id>/inputs/`.
5. Build `output/<run_id>/candidate-profile.json`. Treat its evidence IDs as
   the only source for generated candidate facts.
6. Run `resume-tailor-ingest`:
   - **Resume text cleaning** (§1.1): detect format → clean line-breaks/indent/bullets if needed → save `resume.raw.md` as rollback
   - **STAR decomposition** (§1.2): filter non-experience sections → decompose each work/project entry into S/T/A/R + skill keywords → cache by resume hash
   - **Resume quality assessment** (§1.3): STAR 3-dimension scoring (S/A/R) → empty-shell warning → skills section diagnosis
   - **Job JSON import**: normalize fields → dedup by content_hash → save to `output/<run_id>/jobs/<job_id>/job.json`
7. Run `resume-tailor-analyze`:
   - **Layer 1**: 5-dimension 0-100 scoring (hard skills / experience depth / domain fit / soft fit / 🆕 job quality)
   - **Layer 2** (top N=5~10 jobs only): deep analysis blocks — tailoring strategy / level & comp reference / job credibility
   - Cache analysis results by JD hash + resume hash, skip re-analysis on cache hit
8. Run `resume-tailor-write`, then generate and validate `diff.json`:
   - **(A) resume.md**: STAR alignment → reorder/skill-sort → keyword injection (§3.6) → 6-second scan gate (§3.7) → self-check (3 mandatory floors)
   - **(B) opener.md**: Boss-oriented greeting with a job-specific value hook in the first 15 visible characters, ≤200-char sendable body, and a visible explanation of the hook/JD/evidence choices
   - **(C) changelog.md**: based on enriched real diff; explain JD focus, selected evidence, actual before/after changes, and evidence gaps
   - **(D) cover-letter.md** (optional): run `scripts/cover_letter.mjs`; require
     all four answers, present the draft hash, and generate the final file only
     after exact-hash approval
   - **PDF**: run `scripts/build_pdfs.mjs` after ATS HTML generation. Generate one selectable-text A4 PDF per job under `output/<run_id>/pdf/`; use the normalized `候选人-定制简历-公司-岗位-run-id-岗位短哈希.pdf` naming rule. If the renderer is unavailable, record `pdf_export.status=unavailable` and clearly report that PDF was not generated.
   - **Guided deep-dive**: if experience is too thin, proactively offer to help user reframe and enrich
9. Run `resume-tailor-diagram` — require a project brief from `data/projects/*.md` or the user's uploaded file; use `scripts/prepare_diagram.mjs` to check background, start/end, nodes and relations; ask its generated questions one at a time until sufficient, then generate a non-linear Mermaid flow/mindmap plus a project presentation script. Never fall back to a one-line evidence chain.
10. Run `resume-tailor-report` — generate `output/<run_id>/report.html` with run summary, job list with scores, tailored resume, a current-job “导出 PDF” action when the validated file exists, and analysis/changelog/opener tabs.
11. Tell the user:
    - number of jobs processed
    - report path
    - any missing user inputs

After validation succeeds, open or link the absolute `report.html` path. The
HTML report is the completion condition for the core guided workflow.

The deterministic pipeline maintains `output/<run_id>/state.json`. Resume/JD
hashes and score version make analysis results traceable.

Never overwrite an existing run input snapshot. Changelog entries must map to
stable operation IDs in `diff.json`.

## Local Helper

For the current MVP, the deterministic local pipeline can be run with:

```bash
node scripts/run_pipeline.mjs <run_id> [jobs_json_path]
```

## Guardrails

- Never fabricate projects, metrics, company names, role titles, dates, or skills.
- Support technical, humanities, business, education and general-function candidates alike; treat research, writing, operations, coordination and training as first-class evidence when the JD requires them.
- Use only `resume.md` and `experience-bank.md` as sources for user claims.
- Mark missing metrics as `[请填写：...]`.
- Mark light inferences as `[需确认]`.
- Do not auto-submit applications.
- **Guided deep-dive**: when user experience is too thin, proactively ask if they want help reframing. User-confirmed new info is treated as user-provided facts. Never inflate numbers or add unmentioned tools.

## Project References

Before changing the workflow, read:

- `references/guided-workflow.md`
- `references/job-input-guide.md`（进入岗位输入阶段或用户询问插件安装时）
- `docs/requirements-v0.4.md`
- `docs/product-plan.md`
- `docs/data-schema.md`
- `docs/skill-boundaries.md`
