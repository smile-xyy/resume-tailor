function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function saveButtonLabel(jobCount) {
  return `保存当前岗位 · ${count(jobCount)}`;
}

export function saveStatusMessage(updated, jobCount) {
  return `${updated ? "已更新岗位" : "已添加岗位"} · 共 ${count(jobCount)} 个`;
}
