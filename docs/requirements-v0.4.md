# Resume-Tailor v0.4 Requirements

## 1. Goal

Make the local pipeline reusable for different candidates. Generated analysis,
summaries, openers, resume ordering, and diagrams must depend only on the
current run input snapshot.

## 2. Candidate Evidence Model

Each run must generate:

```text
output/<run-id>/candidate-profile.json
```

The model contains:

- candidate name when explicitly present;
- education entries;
- skills and keywords found in the evidence;
- work, project, and other experience blocks;
- atomic evidence records with stable IDs and source locations;
- the combined evidence hash.

Every extracted item must reference one or more evidence IDs. The model may
normalize whitespace and keyword casing, but must not add candidate facts.

## 3. Generic Matching

Matching must derive candidate and JD keywords at runtime. A catalog may help
normalize common aliases, but it must not contain candidate-specific project,
school, employer, or identity data.

Scores must be based on:

1. JD keyword coverage by candidate evidence;
2. depth and result evidence in relevant experience blocks;
3. overlap between JD terms and experience evidence;
4. soft-skill evidence explicitly present in the resume or experience bank;
5. deterministic JD quality rules.

`analysis.json` must expose the evidence IDs used for matching.

## 4. Generic Tailoring

- Build the summary from explicit education, matched skills, and relevant
  experience headings.
- Build the opener from the company, role, matched skills, and relevant
  experience headings.
- Reorder blocks only within their original section.
- Never insert a fixed candidate identity, education status, project, metric,
  or technology.
- Keep the original resume unchanged when there is insufficient evidence for a
  useful summary.

## 5. Evidence Diagrams

Automatic diagrams must be evidence maps:

- select relevant experience blocks;
- use only the block heading and existing bullet text;
- attach evidence IDs in the surrounding Markdown;
- prefer a capability flow when the source contains ordered actions;
- otherwise render an evidence map without inventing system relationships.

The guided project-diagram workflow remains unchanged.

## 6. Acceptance Criteria

1. Existing tests pass.
2. A fixture with a different name, education, domain, and technology produces
   no facts from another candidate.
3. `candidate-profile.json` is deterministic for the same input.
4. Generated summaries, openers, analyses, and diagrams expose evidence IDs.
5. No production generator contains candidate-specific identity, employer,
   project, school, metric, or technology assumptions.
6. The complete pipeline and validator pass on a real local run.

## 7. Deferred

- LLM semantic scoring;
- automatic cover-letter approval;
- binary PDF rendering;
- online salary research;
- automatic application submission.
