# Resume-Tailor v0.6 Requirements

## Goal

Provide a guided conversational entry point that starts or resumes when the
user types `/resume-tailor` and ends with a validated local HTML report.

## Requirements

- Detect progress from workspace files instead of hidden chat-only state.
- Ask one blocking question per reply.
- Accept resume files/text, job JSON, screenshots, pasted JD, or extension
  exports.
- Create required local data files from confirmed user input.
- Run project scripts for the user once required inputs are complete.
- Do not present an HTML report until Validator succeeds.
- Generate one selectable-text A4 PDF per tailored job when the local renderer is available; keep job-specific normalized filenames and hashes, and expose only current PDFs in the report.
- Deliver an absolute report path and a short result summary.
- Offer experience deepening, detailed diagrams, and Cover Letters only after
  the first valid report.
- Resume safely after an interrupted conversation.

## Acceptance

1. Exact `/resume-tailor` invocation is documented in Skill metadata.
2. The Skill links a single guided-workflow reference.
3. The reference defines phase detection and one-question behavior.
4. Missing resume starts with the resume prompt, not terminal instructions.
5. Complete inputs proceed directly to generation.
6. Completion requires a validated `report.html`.
7. When `pdf_export.status` is complete, every job has a PDF, metadata file, matching resume/JD hashes, and a report download entry.
