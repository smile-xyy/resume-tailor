function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function resumeMarkdownToAtsHtml(markdown, title = "定制简历") {
  const output = [];
  let listOpen = false;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!bullet && listOpen) {
      output.push("</ul>");
      listOpen = false;
    }
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
    } else if (bullet) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${escapeHtml(bullet[1])}</li>`);
    } else if (line) {
      output.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (listOpen) output.push("</ul>");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { max-width: 180mm; margin: 0 auto; color: #111; font: 10.5pt/1.45 Arial, "PingFang SC", sans-serif; }
    h1 { margin: 0 0 10pt; font-size: 20pt; }
    h2 { margin: 12pt 0 5pt; padding-bottom: 2pt; border-bottom: 1px solid #333; font-size: 13pt; }
    h3 { margin: 8pt 0 3pt; font-size: 11pt; }
    p { margin: 3pt 0; }
    ul { margin: 3pt 0 6pt; padding-left: 16pt; }
    li { margin: 2pt 0; }
  </style>
</head>
<body>
${output.join("\n")}
</body>
</html>
`;
}

export function validateAtsHtml(html) {
  const errors = [];
  if (/<(?:img|svg|canvas|script|table)\b/i.test(html)) errors.push("ATS HTML 包含禁止元素。");
  if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/i.test(html)) errors.push("ATS HTML 包含隐藏文字样式。");
  if (!/<h1>/.test(html) || !/<h2>/.test(html)) errors.push("ATS HTML 缺少标准标题层级。");
  return errors;
}
