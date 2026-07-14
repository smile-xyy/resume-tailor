---
name: resume-tailor-write
description: 内部可信改写 skill。根据分析结果和候选人证据模型生成定制简历、HR 开场白、改动清单及可选 Cover Letter；候选人事实必须可追溯，禁止串入固定模板事实或编造内容。
---

# Resume Tailor Write

## Inputs

- `data/resume.md`（原始简历）
- `data/resume.star.md`（STAR 拆解版）
- `data/profile.md`
- `output/<run_id>/candidate-profile.json`
- `data/experience-bank.md`
- `output/<run_id>/jobs/<job_id>/job.json`
- `output/<run_id>/jobs/<job_id>/analysis.md`
- `output/<run_id>/inputs/resume.md`（输入快照，用于 diff）

## Outputs

```text
output/<run_id>/jobs/<job_id>/resume.md
output/<run_id>/jobs/<job_id>/opener.md
output/<run_id>/jobs/<job_id>/changelog.md
output/<run_id>/jobs/<job_id>/diff.json
output/<run_id>/jobs/<job_id>/resume-pdf.json          （PDF 文件名、源简历 hash、页数与文件 hash）
output/<run_id>/jobs/<job_id>/cover-letter-questions.md （可选）
output/<run_id>/jobs/<job_id>/cover-letter-draft.md     （可选）
output/<run_id>/jobs/<job_id>/cover-letter-status.json  （可选）
output/<run_id>/jobs/<job_id>/cover-letter.md           （仅批准后）
```

---

## 伦理红线（写入前内化）

- 生成器不得写死任何候选人的学校、学历、公司、项目、技能或指标。
- 摘要、开场白和新增候选人表述必须能够定位到 evidence ID。

**绝不触碰**：
- 不凭空增加项目、技能、公司经历
- 不编造具体数字，缺数据用 `[请填写：xxx]` 占位
- 不修改工作时间段、职级、公司名称
- 不为空壳条目编造任何内容
- 不跨章节搬运内容

**可以做**：
- 改写措辞、调整顺序、合并/拆分句子
- 用 STAR 重写已有描述
- 对隐含信息轻度补充（加 `[需用户确认]`）
- 用 JD 关键词重新表述已有经验

**🆕 引导式深挖**：当经历过于简略时，主动提问引导用户从规模感、难点、协作、前后对比、工具方法、复用影响、决策权等角度重新审视经历。用户确认的新信息视为用户提供的事实。底线不变：不放大数字、不添加未提及的工具。

---

## 定制流程

### Step 1：STAR 对齐分析（内部推理，不写文件）

对照 JD + `resume.star.md` + 原始简历，推理：

- **经历排序**：同章节内，哪条与 JD 最相关
- **能力排序**：JD 强调的技术、研究方法、内容能力、运营经验或协作能力前移
- **Action 补充**：缺 JD 强调的工作方式（跨团队协作/数据驱动等），在已有事实上补充
- **Result 缺口**：缺量化指标处，插 `[请填写：xxx]`
- **隐含信息**：显然蕴含但未明说的信息，加 `[需用户确认]`
- **弱化项**：与 JD 相关性低的内容，后移或精简措辞
- **项目内成果重排**：每个有料项目的成果行按 JD 相关性重排

### Step 2：生成定制简历 resume.md

基于 Step 1 结论改写，遵守三项强制下限和结构冻结规则：

**三项强制下限（每个 JD 必须做到）**：
1. 经历/项目排序：最相关的移到章节最前
2. 项目内成果排序：贴合 JD 的指标移到最前
3. 能力板块排序 + 措辞：JD 强调的技术、研究、内容、运营或协作能力前移，措辞向 JD 靠拢

**结构冻结规则**：
- 章节标题逐字保留，不拆分合并
- 顶层章节顺序冻结
- 允许在姓名后新增一个 `求职概述`；其他顶层章节不新增
- 不删除经历块
- 子条目数不删减（弱化项只缩短）
- 列表标记逐字保留
- 技能程度词保留
- 不跨章节搬运内容
- 合并后技能条目数 ≥ 原条目数 80%

**自检关卡**：写入前确认三项下限全落实。整份简历逐字相同 → 回头重做（除非触发"可以不改"例外）。

### Step 3：JD 能力主题注入

从 analysis 中提取的 JD 能力主题，自然注入到：
- Summary 段（前 5 个能力主题，密度最高）
- 每个角色的第一条 bullet（1-2 个能力主题）
- 技能或能力板块（集中展现）

每个能力主题只用一次。融不进去的不硬塞。对文科岗位可使用研究、访谈、写作、运营、课程、协调等已有事实，不得硬塞技术词。

### Step 4：六秒扫描门自检

确认简历第一屏（上半部分）能在 6 秒内让 recruiter 看清三件事：
- 目标角色是什么
- 最匹配 JD 的 1-2 个证明点
- 专业可信度

第一屏看不到 → 排序和措辞再调整。

---

## 产出物

### (A) 定制简历 resume.md

完整 Markdown 简历，只改内容不改架子。

### (B) HR 开场白 opener.md

```markdown
# 开场白 · <公司名> · <岗位名>

## 可直接发送

<15 字内先给出最强岗位价值>，<用一段真实经历承接>。<点明当前 JD 的 1-2 个核心关注>，期待进一步沟通。

## 前 15 字预览

`<Boss 未点开时最先看到的内容>`

## 为什么这样写

- 说明前 15 字为什么能吸引当前岗位 HR；
- 说明对应的 JD 重点；
- 说明使用了哪段候选人证据。
```

**约束**：
- “可直接发送”正文严格 ≤200 字；解释文字不计入发送正文
- Boss 未点开前只能先看到开头约 15 个字，因此前 15 字必须包含当前岗位最有价值的能力、结果或场景，不得以“您好”“看到岗位”“我关注到”等低信息量寒暄开头
- 前 15 字只能写候选人证据直接支持的内容；不能为了吸引点击夸大年限、职级、独立负责范围或上线结果
- 根据当前 JD 选择 1-2 个最重要且已匹配的能力，不能所有岗位复用同一个开头
- 对非技术岗位，开场白使用“项目实践”“调研经历”“内容产出”“活动执行”“课程/培训实践”等中性、事实型表述；不得默认使用“研发”“技术栈”“工程交付”。
- 正文结构：价值钩子 → 对应的真实经历 → 当前 JD 关注点 → 简短沟通邀请
- 禁用句式："我是…的求职者""本人具备…""可投岗""贵司"等
- 只引用简历中真实的、无 `[请填写]` 占位的经历
- 有 `[需用户确认]` 的保留提示

### (C) 优化说明 changelog.md

优化说明是岗位级定制报告，不是原简历摘抄，也不是逐行 diff 日志。生成前必须同时读取当前 JD、候选人证据模型和真实 diff，并按以下关系组织：

1. **岗位定制策略**：提炼当前 JD 最重要的 3-4 个能力主题，说明本岗位主打哪 1-2 段项目/经历，以及首屏前置哪些已有关键词。
2. **已落实到简历的改动**：每个能力主题都展示 JD 关注点、采用的原简历证据、实际改写前后或顺序变化，以及为什么这样改。
3. **尚未自动写入的优化建议**：指出 JD 有要求、但当前材料没有直接证据的内容；建议必须落到一个具体项目和具体追问，不能只列缺失关键词。

底层 `diff.json` 保存机器可校验的操作明细和 `tailoring` 上下文；`changelog.md` 用隐藏 `diff-op` 注释绑定每个真实操作。报告展示时隐藏操作 ID 和 evidence ID，但保留项目名称与证据摘要。

**核心规则**：
- 每类仅在该类改动实际存在时才输出该节。
- 不向用户展示“新增章节：求职概述”这类机器 diff 文案。
- 不在报告中展示 `diff-op`、证据 ID 或底层操作 ID。
- 不能把定制后的简历内容整段复制到优化说明；引用原文和改后文本时只保留足以理解差异的片段。
- “为什么这样改”必须引用当前 JD 的具体要求，不能使用“更贴近岗位”等空泛理由。
- 缺口建议必须区分“可迁移证据”和“没有证据”：前者说明如何真实重述，后者明确要求用户补充或保留缺口。
- 若简历完全未改动，只写“本岗位未改动正文”一节说明原因 + 补充建议。

```markdown
# 岗位定制说明：<公司> · <岗位>

## 岗位定制策略
- 岗位重点：Agent 任务规划、工具调用、系统集成
- 主打经历：<项目 A>、<项目 B>

## 已落实到简历的改动
### 工具调用与系统集成
**JD 关注：**<JD 中对应要求>
**已有证据：**<项目及原文摘要>
- **实际改写：**「<原文片段>」→「<改后片段>」
**为什么这样改：**<该证据如何直接回答岗位要求>

## 尚未自动写入的优化建议
### Agent 评测
**JD 要求：**<JD 原文摘要>
**建议：**如果在 <具体项目> 中真实做过评测，请补充评测集、指标和迭代结果；否则不要写入。
```

### (D) Cover Letter cover-letter.md（可选）

使用 `scripts/cover_letter.mjs`，严格按以下状态执行：

1. 没有回答：只生成四个问题。
2. 回答完整：保存回答快照并生成草稿，状态为 `awaiting_approval`。
3. 向用户展示草稿和 draft hash。
4. 只有用户明确批准该 hash 后，才生成 `cover-letter.md`。
5. 回答或草稿发生变化后，旧批准自动失效。

不得代答申请原因、相关经历、希望解决的问题、联系方式和城市。报告只展示
已批准的正式文件，不展示草稿。

### (E) ATS 优化 PDF

`resume.md` 和 `resume.html` 完成后，由主流水线调用 `scripts/build_pdfs.mjs`：

- 每个岗位生成一份独立 PDF，写入 `output/<run_id>/pdf/`；
- 文件名固定为 `候选人-定制简历-公司-岗位-run-id-岗位短哈希.pdf`；
- 公司/岗位中的路径非法字符必须规范化，run ID 区分生成批次，岗位短哈希防止同名覆盖；
- `resume-pdf.json` 必须绑定当前 `resume.md` hash、JD content hash、PDF sha256 和页数；
- PDF 必须是 A4、单栏、可选文字、无图片文字、无脚本、无加密，并在生成后检查页数和文本提取；
- 环境缺少 `reportlab`/`pypdf` 时，不得伪造 PDF 或只改扩展名，必须将状态记录为 unavailable。

布局规则：单栏 / 标准标题 / 无图片文字 / UTF-8 可选文字 / 无嵌套表格 / 不隐藏文字

Section 顺序：Header → Summary → Core Competencies → Work Experience → Projects → Education → Skills

---

## Changelog Rules

Generate `diff.json` by comparing the immutable run input snapshot with
`resume.md`. Enrich the diff with JD focus areas, selected evidence, and
evidence gaps. Generate `changelog.md` only from this enriched diff. Never
write a change claim that is not backed by a diff operation, and never turn a
missing JD requirement into a resume claim without candidate evidence.
