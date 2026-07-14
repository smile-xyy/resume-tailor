---
name: resume-tailor-ingest
description: 内部岗位导入与简历预处理 skill。处理岗位 JSON、JD 文本或截图；执行简历清洗、STAR 拆解和质量评估；构建带稳定证据 ID 的候选人画像并规范化岗位数据。
---

# Resume Tailor Ingest

## 职责

简历预处理（清洗 → STAR 拆解 → 质量评估）+ 候选人证据模型 + 岗位 JSON 导入。

将证据模型写入 `output/<run_id>/candidate-profile.json`。不得加入输入材料
没有出现的身份、学历、技能、经历、项目或结果。

---

## Part 1：简历文本清洗

### 触发条件

用户从 PDF/Word 粘贴简历时，自动检测格式是否正常。

### 格式检测（4 项标准，全部满足 = 跳过清洗）

- 有 ≥2 处章节标记（`#`、`##` 或有序列表）
- 有 ≥2 处列表标记（`-`、`*` 开头）
- 平均非空行长度 ≥15 字符
- 不存在连续 5 行以上每行只有 1-3 字符

### 清洗操作（只动格式，不动文字）

- 合并被换行打断的同句
- 合并被拆散的标题/姓名
- 移除连续空行（≥3 → 保留 1）
- 还原项目符号（`·` `●` `▪` → `- `）
- 识别常见章节关键词，补 `## ` 标题
- 规范缩进（tab → 2 空格）
- 删除零宽字符

### 禁止操作

- 不增删改任何文字
- 不修正错别字
- 不翻译、总结、精简、扩写
- 不推断补齐缺失信息

### 回滚机制

清洗前保存 `resume.raw.md`，用户随时可说"还原原版"切回。

---

## Part 2：简历 STAR 拆解

### 目的

将简历中每段工作/项目经历拆解成 S/T/A/R 四要素，供后续匹配打分和定制使用。

### 过滤规则（先过滤再拆解）

- 整体跳过：个人信息、专业技能、教育背景、自我评价、证书奖项等区块
- 行级跳过：没有行动动词 + 没有结果描述的行（纯公司名/日期/部门名）
- 注意：部门名中的词（"运营组""品牌部"）不算行动动词

### 拆解格式

```markdown
## [公司/项目名] · [职位/角色] · [时间段]
- S (Situation): 业务背景、团队状况、面临的挑战
- T (Task): 被赋予的具体目标/职责
- A (Action): 具体做了什么（方法/流程/协作方式）
- R (Result): 可量化成果（数字/百分比）；无数字标注 ⚠️ 缺数字
技能关键词：[从该段提取的技能词列表]
```

写入 `data/resume.star.md`。

### 缓存

计算 `resume.md` 的 hash 存入 `data/resume.md.hash`。hash 不变则复用 STAR 拆解，不重新跑。

---

## Part 3：简历质量评估

### 目的

在定制前诊断简历本身的问题，让用户知道哪里薄弱。

### STAR 三维度打分

每项：✅合格 / ⚠️薄弱 / ❌缺失

| 维度 | ✅ 合格 | ⚠️ 薄弱 | ❌ 缺失 |
|------|---------|----------|---------|
| 场景/问题 (S/P) | 有明确业务背景 | 背景模糊 | 无场景描述 |
| 行动 (A) | 具体方法/手段 | 只写职责 | 缺失 |
| 结果 (R) | 有量化数字 | 结果模糊 | 无结果 |

### 额外检查

- 是否大量使用"负责""参与""协助"等被动词
- 是否有明显可量化但留白的指标

### 空壳经历警示

若某段工作经历只有公司名+时间，没写工作内容和成果 → 在评估输出最顶部显著提醒用户。

### 技能板块诊断

- 虚浮词/空泛声称
- 缺工具名/过于宽泛
- 无程度分层（全部同一个程度词）

用户选择：A. 自己去改简历 → 改完重评 / B. 先不改，用当前简历继续。

---

## Part 4：岗位 JSON 导入

进入岗位导入对话前，先读取
`../resume-tailor/references/job-input-guide.md`，直接向用户展示可执行步骤。
不得只列输入类型或只说“查看 README”。用户回复“安装插件”时，一次引导一个
Chrome 操作步骤；收到岗位材料后直接导入。

### Inputs

- `data/jobs/inbox/*.json`
- Optional pasted JD text
- Optional job screenshots parsed by the calling visual agent
- Current `run_id`

岗位输入支持四种方式：

1. 推荐：使用 `browser-extension/` Chrome 插件直接保存详情页；当前适配 Boss 直聘、前程无忧、智联招聘和猎聘。
2. 上传岗位 JSON 或插件导出的 `resume-tailor-jobs` JSON。
3. 上传岗位截图；截图中必须能看清职位名称、职责/要求，无法识别时要求用户重新截图或改用复制文本/插件。
4. 直接复制岗位正文；至少包含职位名称和职责或任职要求。只有公司名、薪资或职位标签时停止并要求补充。

截图或复制文本无法稳定结构化时，不猜测字段：保留空值并列入
`needs_confirmation`，同时提示用户改用插件或重新提供更完整的输入。

插件在分栏岗位页中必须用当前岗位卡片的岗位 ID/详情链接作为稳定身份：同一岗位
再次保存执行更新，不同岗位必须追加，不能用切换岗位后不变的搜索列表 URL 去重。
Boss 分栏页先从右侧面板 `.boss-info-attr` 提取公司名，再从与详情标题一致的当前
岗位卡片补取；仍为空才进入 `needs_confirmation`。Boss 薪资的
`U+E031–U+E03A` PUA 数字必须先解码为 `0–9`，存储和导出中不得保留字体混淆字符。
页面保存按钮实时显示已收集数量，并用“已添加岗位/已更新岗位”反馈本次操作。

### Output

```text
output/<run_id>/jobs/<job_id>/job.json
```

### Helper

```bash
node scripts/import_jobs.mjs <run_id>
```

For screenshots, read `references/screenshot-intake.md`, write the extracted JSON, then run:

```bash
node scripts/import_screenshot_job.mjs <run_id> <extracted_json_path>
```

### Normalization Rules

Required normalized fields:
`id` / `source` / `url` / `title` / `company` / `salary` / `location` / `description` / `requirements` / `tags` / `saved_at` / `content_hash` / `liveness` / `status`

- Missing fields: keep empty or `null`. Do not infer.
- Screenshot input: preserve missing fields as `null`, list in `needs_confirmation`, retain screenshot names in `source.files`.
- Reject records without a title or without both description and requirements.
- Dedup by `content_hash`.

### Job ID

```text
<company>-<title>
```

If company is missing, use `unknown-company`. If the readable ID is already
occupied by different content, append the first 8 characters of `content_hash`.
