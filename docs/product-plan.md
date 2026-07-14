# Resume Tailor Product Plan

## Goal

Build a local-first resume tailoring skill for Chinese job seekers.

The current implementation contract is defined in
`docs/requirements-v0.3.md`.

The tool should:

- Read a user's resume and experience bank.
- Import job descriptions from local JSON files or pasted text.
- Analyze resume/JD fit with clear evidence.
- Rewrite resume content for each JD without fabricating facts.
- Generate a changelog, HR opener, and Mermaid diagrams.
- Produce a local HTML report with a new visual layout.

## Non-goals

- No web app in the first version.
- No account system, cloud storage, or remote backend.
- No automatic job application submission.
- No hidden keyword stuffing.
- No fabricated projects, metrics, titles, dates, companies, or skills.
- No direct reuse of another project's prompt text, UI, CSS, or scripts.

## MVP Workflow

1. User places resume in `data/resume.md`.
2. User fills `data/profile.md` and `data/experience-bank.md`.
3. User puts job JSON files into `data/jobs/inbox/`.
4. Main skill runs the pipeline:
   - ingest jobs
   - analyze fit
   - tailor resume
   - generate diagrams
   - build report
5. Output is written under `output/<run_id>/`.

## First Version Scope

### Inputs

- Markdown resume.
- Markdown profile.
- Markdown experience bank.
- Local job JSON files.

### Outputs per job

- `analysis.md`
- `resume.md`
- `opener.md`
- `changelog.md`
- `diagrams.md`

### Final output

- `output/<run_id>/report.html`

## Differentiation

This project should feel different from a basic resume editor:

- It uses an explicit experience bank, not only the resume.
- It explains every modification.
- It produces diagrams from real experience.
- It treats missing evidence as a task for the user, not an invitation to invent.
- It is designed as a local skill workflow, not a full SaaS app.

## Build Order

1. Finalize schemas.
2. Finish skill boundaries.
3. Implement local JSON ingest.
4. Implement fit analysis.
5. Implement resume writing.
6. Implement diagram generation.
7. Implement HTML report generation.
8. Add browser extension or local capture helper later.
