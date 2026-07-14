# Integration Audit

## Decision

The integration plan has sound engineering and ethics requirements, but its
original scope targets a full `参考项目乙` lifecycle system. That conflicts with
this project's goal: a small, local, skill-oriented resume tailoring workflow.

## Adopt Now

- Unified normalized job records with source and liveness metadata.
- Content hashes, score versioning, and atomic run state.
- Configurable four-dimension scoring with machine-readable evidence.
- Truth-preserving per-job resume, opener, changelog, and diagrams.
- Local shortlist report with rendered Markdown and Mermaid.
- Deterministic validation and focused tests.

## Defer

- Career tracker, follow-up, interview, offer, email, and auto-application flows.
- Migration of `参考项目乙` history.
- Browser automation and URL liveness checks.
- Screenshot OCR and platform-specific capture.
- PDF and LaTeX generation.

These can be added only after the current pipeline is stable and genuinely
useful for repeated applications.

## Compatibility

- The two reference repositories remain untouched.
- Existing `resume-tailor` run folders remain readable.
- New runs add `state.json` and `analysis.json`.
- Markdown files remain the human-editable outputs.

## Verification

Use:

```bash
node --test tests/*.test.mjs
node scripts/run_pipeline.mjs <run_id> <jobs_json_path>
```
