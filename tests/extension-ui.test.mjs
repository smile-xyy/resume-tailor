import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  saveButtonLabel,
  saveStatusMessage
} from "../browser-extension/lib/ui-copy.mjs";

test("save button exposes the live number of collected jobs", () => {
  assert.equal(saveButtonLabel(0), "保存当前岗位 · 0");
  assert.equal(saveButtonLabel(12), "保存当前岗位 · 12");
});

test("save feedback distinguishes additions from updates", () => {
  assert.equal(saveStatusMessage(false, 2), "已添加岗位 · 共 2 个");
  assert.equal(saveStatusMessage(true, 2), "已更新岗位 · 共 2 个");
});

test("content UI includes a one-shot pop animation with reduced-motion fallback", () => {
  const css = fs.readFileSync("browser-extension/content/content.css", "utf8");
  assert.match(css, /@keyframes resume-tailor-status-pop/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("extension release exposes the multi-job fix", () => {
  const manifest = JSON.parse(fs.readFileSync("browser-extension/manifest.json", "utf8"));
  assert.equal(manifest.version, "0.3.1");
  assert.ok(manifest.web_accessible_resources.some(
    (entry) => entry.resources.includes("lib/*.mjs")
  ));
});
