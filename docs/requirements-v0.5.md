# Resume-Tailor v0.5 Requirements

## 1. Goal

Add an explicit, local Cover Letter workflow without treating missing answers
or an AI-generated draft as user approval.

## 2. Required Answers

The user must provide a JSON file with four non-empty string fields:

```json
{
  "motivation": "Why this role and company",
  "relevant_experience": "The most relevant experience",
  "problem_to_solve": "The problem the candidate wants to help solve",
  "contact": "Contact method and city"
}
```

The answers are user-provided evidence. The script must copy them into the run
job directory before drafting.

## 3. State Machine

### Missing answers

Write:

```text
cover-letter-questions.md
cover-letter-status.json
```

Do not write a draft or final Cover Letter.

### Complete answers

Write:

```text
cover-letter-input.json
cover-letter-draft.md
cover-letter-status.json
```

Set state to `awaiting_approval`. Do not write `cover-letter.md`.

### Explicit approval

Approval requires the exact draft hash:

```text
node scripts/cover_letter.mjs <run-id> <job-id> --approve <draft-hash>
```

Generate `cover-letter.md` only when the current draft hash matches the supplied
hash and the recorded answers hash is unchanged.

## 4. Integrity

- Never infer missing answers.
- Never approve automatically.
- Reject unresolved placeholders.
- Store answer, draft, and final hashes in `cover-letter-status.json`.
- Replacing answers invalidates an earlier draft and approval.
- The report shows only `cover-letter.md`, never an unapproved draft.

## 5. Acceptance

1. Missing answers produce questions only.
2. Complete answers produce a draft only.
3. A wrong or stale hash cannot approve a draft.
4. Exact-hash approval produces the final file.
5. Validator rejects an untracked or modified final file.
6. Existing pipeline tests continue to pass.
