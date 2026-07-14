# Guided Workflow

## Conversation Rules

1. Treat `/resume-tailor` and `$resume-tailor` as start or resume commands.
2. Inspect the workspace before asking anything.
3. Ask exactly one blocking question per reply.
4. Explain why the requested input is needed in one short sentence.
5. Accept an uploaded file, pasted text, screenshot, or an existing local path.
6. Never ask the user to run a command that the agent can run.
7. Never invent missing resume, job, metric, or project facts.
8. Resume from the first incomplete phase when invoked again.
9. Keep optional enhancements until after the first valid HTML report.

## Phase Detection

Use the first matching phase:

| Phase | Complete when |
|---|---|
| 1. Resume | `data/resume.md` exists and contains meaningful resume text |
| 2. Preferences | `data/profile.md` records target role and location/remote preference |
| 3. Experience | `data/experience-bank.md` exists; an explicit minimal file is acceptable |
| 4. Project brief | For diagram generation, at least one `data/projects/*.md` or uploaded project-description file exists with background, start/end, key steps/modules, and relations |
| 5. Jobs | At least one valid job source is supplied or present in the inbox |
| 6. Confirmation | Required job title/body exist and all `needs_confirmation` fields are resolved or explicitly left unknown |
| 7. Generate | A new run completes the deterministic pipeline |
| 8. Verify | Validator succeeds and `report.html` exists |
| 9. Optional | User chooses whether to deepen experience, create a detailed diagram, or draft a Cover Letter |

Do not create files from `examples/` when the user intends to use a real
resume. Examples are only for an explicit demo request.

## Phase Prompts

### Phase 1: Resume

Ask:

> 请上传简历文件、粘贴简历文本，或告诉我简历的本地路径。

After receiving it:

- preserve all identity, organization, title, and date facts;
- convert readable content to `data/resume.md`;
- show a short extraction summary;
- ask for correction only when essential fields are unreadable.

### Phase 2: Preferences

Ask target role first:

> 你目前最想投递的岗位是什么？

On the next turn ask location or remote preference. Infer writing preferences
only when explicitly stated. Save confirmed answers to `data/profile.md`.

### Phase 3: Experience Bank

Ask:

> 除简历内容外，你是否有更详细的项目或工作经历材料？可以上传、粘贴，暂时没有也可以。

If none, create a minimal `data/experience-bank.md` that states no additional
evidence was provided. Do not manufacture a structured story.

### Phase 3.5: Project Brief

Before diagram generation, ask:

> 请上传一个项目整体描述文件（Markdown、纯文本或直接粘贴），说明项目背景、起点和终点、至少 3 个步骤/模块，以及它们是顺序、并行还是分支关系。我会先检查信息是否完整，再继续追问或画图。

保存为 `data/projects/<project-name>.md`。如果用户暂时不需要图，可明确跳过；
一旦选择生成图，缺少上述信息就必须逐项追问，不能用简历 bullet 自动串成一条线。

### Phase 4: Job Input

Before asking for a job, read `job-input-guide.md` completely. Determine the
repository root and replace `<项目根目录绝对路径>` with the real absolute path.
Show the guide's user-facing first-entry instructions directly in the chat,
including Chrome installation, collection/export, screenshot, pasted-JD, and
failure-recovery steps. Do not reduce this phase to a one-line list of accepted
file types, and do not make the user open README to discover the next action.

End with exactly one action prompt:

> 请现在直接发送插件导出的 `.jobs.json`、岗位截图或完整 JD；如果想让我陪你一步步安装插件，请回复“安装插件”。

If the user replies “安装插件”, follow the guide's one-step-at-a-time assisted
installation flow. After a `.jobs.json`, screenshot, or pasted JD arrives,
continue with the matching route below without asking whether to proceed.

Route the input:

- JSON: run `scripts/import_jobs.mjs`;
- screenshot: follow `../../resume-tailor-ingest/references/screenshot-intake.md`,
  create structured JSON, then run `scripts/import_screenshot_job.mjs`;
- pasted JD: create a structured job JSON while preserving the pasted text;
- existing inbox: confirm the number of jobs found, then proceed.

### Phase 5: Confirmation

If required fields are ambiguous, ask about one job at a time. Group that
job's uncertain fields into one compact question. Preserve `null` when the user
explicitly does not know.

Do not block on optional HR, benefit, company-size, or URL fields.

### Phase 6: Generate

Create a local-time run ID and execute:

```bash
node scripts/run_pipeline.mjs <run-id> [jobs-json-path]
```

Do not ask for permission again: generation is the action requested by the
start command. Report progress briefly for long runs.

### Phase 7: Verify and Deliver

Require:

- pipeline exit code 0;
- Validator success;
- `output/<run-id>/report.html` exists;
- at least one job is present in the report.
- when `state.json` records `pdf_export.status=complete`, every tailored job has a current PDF and the report exposes its job-specific download link.

Then provide:

- number of imported/analyzed jobs;
- number of generated PDF resumes, or the explicit renderer-unavailable reason;
- strongest matches;
- unresolved confirmations;
- clickable absolute path to `report.html`.

Open the report in the in-app browser when that capability is available.

### Phase 8: Optional Follow-up

After delivering the first HTML report, ask one optional question:

> HTML 报告已生成。下一步要先补强经历、细化某个项目图，还是为某个岗位准备求职信？

Only enter the Cover Letter workflow after the user selects it. Follow the
four-answer and exact-hash approval rules in `scripts/cover_letter.mjs`.

## Failure Recovery

- Invalid resume: preserve the original input and ask for a clearer source.
- Invalid job input: identify the missing title or body and ask only for that.
- Pipeline failure: diagnose and fix local code/data issues before asking the
  user to intervene.
- Validator failure: do not present the report as complete.
- Interrupted session: inspect `output/*/state.json`; reuse only immutable
  inputs and valid artifacts, otherwise create a new run.
