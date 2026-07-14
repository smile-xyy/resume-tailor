# Resume Tailor

Resume Tailor 是一个本地优先的简历定制 Skill。它从候选人的简历、经历库、项目整体描述和岗位信息出发，生成证据可追溯的匹配分析、定制简历、Boss 开场白、Mermaid 项目图和本地 HTML 报告。

它不自动投递，不编造项目、公司、学历、时间、技能或结果。技术岗位、文科岗位、商科、教育、运营、研究、内容和综合职能岗位都按当前 JD 的能力要求处理。

本项目以 [MIT License](LICENSE) 开源。

## 1. 环境要求

- Node.js 20 或更高版本；
- Chrome（仅在使用岗位摘录扩展时需要）；
- 不需要安装 npm 依赖，核心流水线只使用 Node.js 标准库；
- 岗位级 PDF 使用 Python `reportlab` 与 `pypdf`。Codex 桌面环境会自动发现内置运行时；其他环境可执行 `python3 -m pip install reportlab pypdf`；
- 截图输入需要当前对话环境具备图片读取能力。

检查 Node.js：

```bash
node --version
```

## 2. 安装 Skill

将 `skills/` 下的 Skill 目录复制或链接到 Codex 使用的个人 Skill 目录。至少安装：

```text
resume-tailor/
resume-tailor-ingest/
resume-tailor-analyze/
resume-tailor-write/
resume-tailor-diagram/
resume-tailor-report/
```

安装后，在本项目根目录启动新的 Codex 会话，发送：

```text
/resume-tailor
```

Skill 会检查当前阶段，只询问下一个必要输入，不要求用户自己运行终端命令。

### Claude Code

项目同时提供 Claude Code 的项目级入口：

```text
.claude/skills/resume-tailor/SKILL.md
```

在仓库根目录启动 Claude Code：

```bash
claude
```

然后输入：

```text
/resume-tailor
```

Claude Code 会自动发现 `.claude/skills/`。该入口只负责发现与路由，实际规则仍读取 `skills/resume-tailor/` 及其内部子 skill，因此 Codex 与 Claude Code 共用同一份事实边界、匹配规则、PDF 规范和引导流程，不需要维护两套正文。新增 `.claude/skills/` 顶层目录后，如果已经打开了旧 Claude Code 会话，请重启一次；后续 skill 文件更新支持会话内自动检测。

## 3. 推荐的首次使用流程

### 3.1 提供简历

支持：

- `.md` 文件或本地路径；
- 直接复制粘贴简历文本；
- 不建议直接上传 PDF/Word 版式文件。若版式无法稳定读取，请在阅读器中全选复制后粘贴，或另存为 Markdown。

简历必须是事实源。格式清洗只合并断行、恢复列表和标题，不改写事实。

### 3.2 提供偏好与经历库

引导流程会依次询问：

- 目标岗位、城市或远程偏好；
- 除简历外的项目/工作经历材料；
- 是否有需要补充确认的事实。

对应文件：

```text
data/profile.md
data/experience-bank.md
```

### 3.3 提供项目整体描述

如果需要流程图或架构图，请为每个项目提供一个 Markdown 文件：

```text
data/projects/<project-name>.md
```

模板见 [project-brief-template.md](docs/project-brief-template.md)。至少写清：背景与目标、起点、终点、3 个以上步骤/模块，以及顺序、并行、交接或判断分支关系。

信息不足时系统会先追问，不会把简历 bullet 自动串成一条线。信息充分后生成 Mermaid 源码和项目讲解稿；报告中每张图右上角都有“复制 Mermaid”按钮，复制的是真实源码，可直接粘贴到 Mermaid Live、Markdown 编辑器或面试文档。

### 3.4 提供岗位信息

推荐顺序：

1. 使用 Chrome 岗位摘录扩展；
2. 上传插件导出的岗位 JSON；
3. 上传清晰的岗位截图；
4. 直接复制岗位正文。

无论采用哪种方式，至少要有职位名称和职责或任职要求。只有公司名、薪资或职位标签时，系统会要求补充，不会猜测 JD。

## 4. Chrome 岗位摘录扩展

扩展目录：

```text
browser-extension/
```

### 安装

1. 打开 Chrome，访问 `chrome://extensions`；
2. 打开右上角“开发者模式”；
3. 点击“加载未打包的扩展程序”；
4. 选择本项目的 `browser-extension/` 目录；
5. 将“岗位摘录器”固定到工具栏；
6. 打开招聘平台的岗位详情页，等待页面正文加载完成；
7. 点击页面上的“保存当前岗位 · 0”；数字会实时显示已收集岗位数，按钮上方会跳出
   “已添加岗位”或“已更新岗位”；
8. 点击扩展图标，在弹窗中导出 `jobs.json`；
9. 回到 `/resume-tailor` 会话，上传导出的 JSON。

已安装旧版时无需卸载：更新项目文件后，在 `chrome://extensions` 的“岗位摘录器”
卡片上点击“重新加载”，并刷新招聘页面。旧版保存成“公司待确认”的当前岗位，
重新保存一次即可原位补全；旧版已保存的方块薪资会在新版弹窗中自动解码。

进入岗位输入阶段时，Skill 会在会话中直接展示上述安装、保存、导出和失败处理
步骤；用户不需要先离开会话查找 README。回复“安装插件”还可以进入逐步陪同模式，
每次只完成一个 Chrome 操作。

扩展只读取当前打开的岗位详情并保存在浏览器本地，不读取 Cookie、不调用招聘平台私有 API、不自动翻页、不自动投递。

在 Boss 等分栏页面中，可以留在同一个搜索页依次选择多个岗位：不同岗位会追加到
列表，同一岗位再次保存才会更新。插件优先用当前岗位卡片的岗位 ID/详情链接识别
岗位，并在详情区缺少公司名时从当前卡片补取公司名。

### 当前平台支持

| 平台 | 扩展状态 | 失败时的替代方式 |
|---|---|---|
| Boss 直聘 | 支持详情页结构化摘录 | 截图或复制岗位正文 |
| 前程无忧 | 支持常见详情页选择器 | 截图或复制岗位正文 |
| 智联招聘 | 支持常见详情页选择器 | 截图或复制岗位正文 |
| 猎聘 | 支持常见详情页选择器 | 截图或复制岗位正文 |

招聘网站会调整页面结构，扩展识别不到标题或正文时会明确提示。此时请先确认岗位详情已展开；仍失败就换用清晰截图或复制完整 JD。不要把识别失败的空字段当作真实信息。

## 5. 截图和复制 JD

### 截图

截图应尽量包含：职位名称、公司、职责、任职要求、经验/学历、薪资地点和岗位链接（如果页面可见）。

截图文字无法识别、被遮挡或职责/要求缺失时：

- 重新截取完整岗位详情；或
- 改用 Chrome 扩展；或
- 直接复制岗位正文粘贴。

系统会保留无法确认的字段为 `null`，写入 `needs_confirmation`，不会自行补齐。

### 复制粘贴

请至少粘贴以下内容：

```text
职位名称：
公司：
岗位职责：
任职要求：
经验/学历：
薪资/地点（可选）：
岗位链接（可选）：
```

复制内容可能包含推荐岗位、广告、福利或页面导航。系统会尽量保留原文并分离字段；无法确认的部分会要求补充。

## 6. 报告、岗位链接与 PDF

报告不会直接展示冗长的原始 URL。若岗位 JSON 含有链接，报告中显示为“岗位信息链接”，点击后在新标签页打开招聘页面；没有链接时该入口自动隐藏。

岗位 JD 正文仍保存在本地结构化 `job.json` 与输入快照中，匹配分析使用结构化字段，不依赖报告页面重新解析 JD。

每个岗位会生成独立 PDF。切换岗位后，简历工具栏中的“导出 PDF”始终指向当前岗位的版本，文件名格式为：

```text
<候选人>-定制简历-<公司>-<岗位>-<run-id>-<岗位短哈希>.pdf
```

run ID 用于区分不同生成批次，8 位岗位 hash 防止同公司同岗位重名覆盖。公司和岗位中的 `/ \\ : * ? " < > |` 等路径非法字符会自动替换。PDF 保存在 `output/<run-id>/pdf/`，`manifest.json` 记录岗位、源简历 hash、JD hash、页数和文件 hash。报告只展示与当前 `resume.md` hash 一致的 PDF，避免下载到旧版本。

如需指定独立 Python 或中文字体，可设置：

```bash
export RESUME_TAILOR_PYTHON=/path/to/python3
export RESUME_TAILOR_PDF_FONT=/path/to/chinese-font.ttf
```

## 7. 运行流水线

通常不需要手动运行命令。调试或批处理时可使用：

```bash
npm test
node scripts/run_pipeline.mjs <run-id> [jobs-json-path]
node scripts/prepare_diagram.mjs data/projects/<project-name>.md [output.md]
node scripts/build_ats_html.mjs <run-id>
node scripts/build_pdfs.mjs <run-id> [job-id]
node scripts/build_report.mjs <run-id>
node scripts/validate_run.mjs <run-id>
```

成功条件：流水线退出码为 0、校验器成功，并生成：

```text
output/<run-id>/report.html
```

每次 run 都会保存简历、经历库、偏好和项目描述的输入快照，避免生成结果随着工作区文件变化而失去可追溯性。

## 8. 更新 Skill 和扩展

更新代码后：

```bash
git pull
npm test
```

然后重新将 `skills/` 下对应目录复制/链接到个人 Skill 目录。Chrome 扩展更新步骤：

1. 打开 `chrome://extensions`；
2. 找到“岗位摘录器”；
3. 点击“重新加载”；
4. 刷新已打开的招聘页面。

如果选择复制而不是链接，请确保 Skill 目录与项目代码同步更新。

## 9. 输出文件

每个岗位会生成：

```text
analysis.json / analysis.md   匹配分数、能力证据、缺口和风险
resume.md / resume.html       定制后的 Markdown 与 ATS HTML
resume-pdf.json               当前岗位 PDF 的文件名、源 hash、页数和 sha256
opener.md                     可直接发送的开场白、前 15 字预览和写作理由
changelog.md                  岗位级定制说明
diagrams.md                   Mermaid 源码、待确认项和项目讲解稿
diff.json                     可校验的真实修改操作
```

批次级 PDF 输出：

```text
output/<run-id>/pdf/manifest.json
output/<run-id>/pdf/<规范化岗位文件名>.pdf
```

## 10. 隐私与事实边界

- 所有核心处理默认在本地完成；
- 个人简历、联系方式、岗位 JSON 和报告产物不应直接提交到公开仓库；
- 不自动投递、不代替用户回答求职信问题；
- 缺失数字使用 `[请填写：...]`，轻度推断使用 `[需确认]`；
- 生成的图表、开场白和定制简历只能使用输入文件和用户确认过的事实。
