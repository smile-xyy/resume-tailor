# Data Schema

## User Files

### `data/resume.md`

The user's current base resume. This is the source of truth for identity, dates,
company names, role titles, education, and existing claims.

Rules:

- Do not change dates, companies, schools, titles, or identity fields.
- Do not add skills or projects unless they already appear in `resume.md` or `experience-bank.md`.
- If a useful metric is missing, insert `[请填写：具体指标]`.
- If a light inference is made from existing text, mark it as `[需确认]`.

### `data/profile.md`

Stable user preferences:

- target roles
- target industries
- preferred tone
- preferred city/remote style
- resume writing preferences
- things to avoid

### `data/experience-bank.md`

Structured project and work stories. This file lets the skill use richer context
than the public resume while still staying truth-based.

Recommended entry format:

```markdown
## Experience: <name>

Role:
Time:
Context:
Problem:
Actions:
- 
Results:
- 
Evidence:
- 
Reusable skills:
- 
Can generate diagrams:
- business-flow
- system-architecture
- data-flow
```

## Job JSON

Job files live in `data/jobs/inbox/*.json`.

Required fields:

```json
{
  "source": "manual",
  "url": "",
  "title": "",
  "company": "",
  "salary": "",
  "location": "",
  "description": "",
  "requirements": "",
  "tags": [],
  "saved_at": "2026-07-08T10:00:00+08:00"
}
```

Optional fields:

```json
{
  "platform": "",
  "company_size": "",
  "industry": "",
  "education": "",
  "experience": "",
  "hr_name": "",
  "hr_title": "",
  "benefits": []
}
```

Screenshot input additionally uses:

```json
{
  "source": {
    "type": "screenshot",
    "files": ["boss-job.png"]
  },
  "needs_confirmation": ["company", "education"],
  "excluded_content": ["推荐岗位", "广告"]
}
```

Unclear screenshot fields must be `null` and listed in
`needs_confirmation`. Missing job titles are rejected.

## Run Directory

Each run writes to:

```text
output/<run_id>/
├── report.html
├── pdf/
│   ├── manifest.json
│   └── <候选人>-定制简历-<公司>-<岗位>-<run_id>-<岗位短哈希>.pdf
├── state.json
├── candidate-profile.json
├── resume-audit.json
├── resume-audit.md
├── inputs/
│   ├── resume.md
│   ├── experience-bank.md
│   ├── profile.md
│   └── manifest.json
└── jobs/
    └── <job_id>/
        ├── job.json
        ├── analysis.json
        ├── analysis.md
        ├── resume.md
        ├── resume.html
        ├── resume-pdf.json
        ├── diff.json
        ├── opener.md
        ├── changelog.md
        ├── cover-letter-questions.md
        ├── cover-letter-input.json
        ├── cover-letter-draft.md
        ├── cover-letter-status.json
        ├── cover-letter.md
        └── diagrams.md             # Mermaid source + project presentation script
```

## PDF Export Schema

每个岗位的 `resume-pdf.json` 保存 `filename`、`job_id`、`source_resume_hash`、
`job_content_hash`、`sha256`、`page_count`、`generated_at` 和渲染器。报告只有在
PDF 文件存在且 `source_resume_hash` 与当前岗位 `resume.md` 一致时才显示下载入口。

文件名规则为：

```text
<候选人>-定制简历-<公司>-<岗位>-<run_id>-<岗位短哈希>.pdf
```

所有路径非法字符会替换为连字符；run ID 区分不同生成批次，8 位岗位 hash 防止
同公司同职位或重复导入时覆盖。`pdf/manifest.json` 是当前 run 全部 PDF 的索引。

## Candidate Profile Schema

`candidate-profile.json` is the run's derived evidence model. It contains the
combined evidence hash, explicit identity and education, runtime-extracted
skills, experience blocks, and atomic records with stable `ev-*` IDs.

Generated summaries, openers, analyses, and automatic diagrams must cite these
IDs. Candidate facts that cannot be traced to this model must not be generated.

## Cover Letter Schema

The optional Cover Letter flow uses `cover-letter-status.json` as its state
source. States are `needs_answers`, `awaiting_approval`, and `approved`.

Only the `approved` state may have `cover-letter.md`. Its answer, draft,
approval, and final hashes must match the current companion files.

## Analysis Schema

`analysis.json` is the score source of truth and includes:

- resume and job hashes
- scoring configuration version
- five displayed scores: core capability match (technical, research, content, operations, coordination or training as applicable), experience depth, domain fit, soft fit, job quality
- candidate-fit total and recommendation tier (calculated from the first four dimensions only); job quality is a separate JD-risk signal
- 经过能力主题归类的已匹配能力、至多 5 项高优先级缺口，以及对应 evidence ID/JD 原文依据；不得保存岗位名、公司名或任意分词片段为缺口

`analysis.md` explains the score, risks, strategy, and user questions.

`job_quality.signals` records each deterministic deduction. `deep_analysis`
marks whether the job is in the configured Top N and whether market salary
research was performed.

`score_rationale` records a readable, evidence-based explanation for every displayed dimension. `experience_assessment` records parsed JD/experience duration; project and employment records covering the same time must not be double-counted.

## Opener Schema

`opener.md` separates a ≤200-character `可直接发送` body from `前 15 字预览` and `为什么这样写`. The first 15 visible characters must contain a job-specific, evidence-backed value hook. The rationale records the selected JD focus and candidate experience; it is report-only content and must not be counted as part of the sendable message.

## Diff Schema

`diff.json` binds the run input resume hash to the current tailored resume hash.
Every meaningful operation has a stable ID and a type: `add`, `remove`,
`rewrite`, or `move`. Its `tailoring` object records the current JD focus
areas, the candidate evidence selected for each focus, the operation IDs that
implemented that focus, and evidence gaps that were deliberately not written
into the resume.

`changelog.md` is generated from this enriched `diff.json`. It explains the JD
requirement, selected evidence, actual before/after change, and actionable gap
questions. Hidden `diff-op` markers make the mapping machine-verifiable without
changing the visible report.

## Diagram Schema

`diagrams.md` should include Mermaid blocks only when supported by real resume
or experience-bank evidence.

When a project brief is provided, it is the primary source for the overall
flow/architecture and must be checked for background, start/end, nodes and
relations before rendering. If it is insufficient, `diagrams.md` records the
focused questions instead of drawing a guessed chain. Every generated diagram
also includes a copyable Mermaid code block and a project presentation script.

Allowed diagram types:

- `flowchart` for business or operational processes.
- `sequenceDiagram` for collaboration or system interactions.
- `journey` for user/customer journey.
- `mindmap` for capability maps.
