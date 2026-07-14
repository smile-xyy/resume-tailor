# Skill Boundaries

## `resume-tailor`

Main router and workflow coordinator.

Responsibilities:

- Check required user files.
- Create `run_id`.
- Route to sub-skills.
- Keep the pipeline moving.
- Give the user a short final summary.

Does not:

- Rewrite resumes directly.
- Parse screenshots directly.
- Build the final HTML directly.

## `resume-tailor-ingest`

Job import and normalization.

Responsibilities:

- Detect and clean malformed resume formatting without changing meaning.
- Generate STAR cache and resume quality audit.
- Read `data/jobs/inbox/*.json`.
- Accept pasted JD text when used interactively.
- Support Chrome extension, JSON, screenshot, and pasted-JD input modes; preserve URLs and unresolved fields.
- Normalize job data into one schema.
- Write parsed jobs to the current run folder.

Does not:

- Score fit.
- Rewrite resume content.
- Generate diagrams.

## `resume-tailor-analyze`

Resume/JD/experience-bank matching.

Responsibilities:

- Read `resume.md`, `profile.md`, `experience-bank.md`, and parsed job data.
- Score fit across practical dimensions.
- Identify evidence, gaps, and risk.
- Produce `analysis.md`.

Does not:

- Modify the resume.
- Invent mitigation claims.
- Generate final application text.

## `resume-tailor-write`

Truth-preserving resume tailoring.

Responsibilities:

- Generate tailored `resume.md`.
- Generate `opener.md`.
- Generate `changelog.md`.
- Provide the truth-preserving `resume.md` source consumed by the PDF renderer; the main pipeline owns binary rendering and hash validation.
- Preserve identity, dates, company names, and role titles.
- Insert placeholders for missing metrics.

Does not:

- Create new experience.
- Hide changes.
- Remove important user evidence just to match a JD.

## `resume-tailor-diagram`

Diagram generation from real experience.

Responsibilities:

- Generate Mermaid diagrams based on `resume.md` and `experience-bank.md`.
- Require a project brief for overall flow/architecture, ask focused questions when it is insufficient, and generate copyable Mermaid plus a presentation script.
- Choose diagram type based on role and experience.
- Mark weak or incomplete diagrams as drafts.

Does not:

- Invent architecture, systems, or process steps.
- Put diagrams into ATS resume output by default.

## `resume-tailor-report`

Local HTML report generation.

Responsibilities:

- Aggregate all job outputs.
- Build a static `report.html`.
- Use a new layout and visual language.
- Show a user-facing “岗位信息链接” label without printing raw URLs.
- Show the current job's validated “导出 PDF” link and preserve its normalized download filename.

Does not:

- Score or rewrite content.
- Require a dev server.
