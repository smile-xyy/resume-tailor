# 岗位截图导入规范

## 适用场景

当用户上传 Boss 直聘、智联招聘、前程无忧、猎聘等岗位截图时，由具备视觉
能力的智能体读取图片并生成岗位 JSON。不要安装 OCR，不调用云端 OCR API。

## 合并规则

- 默认一张截图对应一个岗位。
- 只有公司、岗位名称和正文衔接均明确时，才合并多张连续截图。
- 无法确认是否属于同一岗位时，保持分开并询问用户。
- `source.files` 按阅读顺序记录所有截图文件名。

## 内容边界

只提取当前岗位详情：

- 岗位名称；
- 公司名称；
- 薪资、地点、学历和经验；
- 岗位职责；
- 任职要求；
- 技能标签和福利；
- HR 名称及活跃状态；
- 可见的岗位 URL。

不要混入：

- 左侧或底部推荐岗位；
- 广告；
- 聊天记录；
- 平台导航；
- 其他公司的介绍；
- 智能体对岗位的评价。

可以把明确排除的页面内容摘要写入 `excluded_content`，用于审计。

## 不确定字段

- 看不清或截图未包含的字段写 `null`，不得推断。
- 同时将字段名加入 `needs_confirmation`。
- 公司名可以为 `null`。
- 岗位名称缺失时停止导入并要求用户确认。
- 岗位职责与任职要求不能同时缺失。

示例：

```json
{
  "source": {
    "type": "screenshot",
    "files": ["boss-job-1.png"]
  },
  "platform": "boss",
  "title": "AI Agent 开发工程师",
  "company": null,
  "salary": "20-30K",
  "location": "广州",
  "education": null,
  "experience": "1-3年",
  "description": "负责 Agent 工作流开发与业务系统接入。",
  "requirements": "熟悉 Python、LangGraph 和 RAG。",
  "tags": ["LangGraph", "RAG"],
  "benefits": [],
  "hr_name": null,
  "hr_active_status": null,
  "url": null,
  "needs_confirmation": ["company", "education", "hr_name", "hr_active_status", "url"],
  "excluded_content": ["页面右侧推荐岗位"]
}
```

## 校验与运行

先把视觉解析结果写成 JSON，再运行：

```bash
node scripts/import_screenshot_job.mjs <run_id> <截图解析JSON路径>
node scripts/generate_outputs.mjs <run_id>
node scripts/build_report.mjs <run_id>
node scripts/validate_run.mjs <run_id>
```

校验器只验证结构和事实边界，不判断视觉识别是否正确。智能体必须在写入前
重新对照截图。
