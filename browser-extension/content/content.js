(async () => {
  if (document.getElementById("resume-tailor-save-job")) return;

  const { extractJob, validateExtractedJob } = await import(
    chrome.runtime.getURL("lib/job-extractor.mjs")
  );
  const { upsertJob } = await import(chrome.runtime.getURL("lib/job-store.mjs"));
  const { saveButtonLabel, saveStatusMessage } = await import(
    chrome.runtime.getURL("lib/ui-copy.mjs")
  );

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function textFrom(root, selectors) {
    for (const selector of selectors) {
      const node = root?.querySelector?.(selector);
      if (clean(node?.textContent)) return clean(node.textContent);
    }
    return "";
  }

  function absoluteUrl(value) {
    if (!value) return "";
    try {
      return new URL(value, location.href).href;
    } catch {
      return "";
    }
  }

  function findBossRightPanel() {
    for (const selector of [
      ".job-detail-box",
      ".detail-box",
      ".job-detail-card",
      ".recommend-detail",
      ".search-job-result .job-detail",
      "[class*='jobDetail']",
      "[class*='job-detail']"
    ]) {
      const panel = document.querySelector(selector);
      if (panel) return panel;
    }
    const description = document.querySelector(".job-sec-text, .job-detail-section .text, p.desc");
    return description?.closest("section, article, [class*='detail']")
      || description?.parentElement
      || null;
  }

  function cardExternalId(card, url) {
    const attributeNode = [card, ...card.querySelectorAll("[data-jobid], [data-job-id]")]
      .find((node) => node.getAttribute("data-jobid") || node.getAttribute("data-job-id"));
    const attributeId = attributeNode?.getAttribute("data-jobid")
      || attributeNode?.getAttribute("data-job-id");
    if (attributeId) return clean(attributeId);
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("jobId")
        || parsed.searchParams.get("job_id")
        || parsed.pathname.match(/job_detail\/([^./?]+)/i)?.[1]
        || "";
    } catch {
      return "";
    }
  }

  function activeJobCard() {
    const detailTitle = clean(document.querySelector(
      ".job-detail-box .job-name, .job-primary .job-name, .job-detail .job-title, .job-title, .job-name"
    )?.textContent);
    const cardNodes = [...new Set(document.querySelectorAll(
      ".job-card-wrapper, .job-card-box, .job-list-box > li, .job-list > li, [data-jobid], [data-job-id]"
    ))];
    const snapshots = cardNodes.map((card) => {
      const title = textFrom(card, [
        ".job-name", ".job-title", "[class*='job-name']", "[class*='job-title']", "h3"
      ]);
      const company = textFrom(card, [
        ".company-name",
        ".company-text",
        "[class*='company-name']",
        "[class*='company-text']",
        ".company-info a",
        ".company-info"
      ]);
      const salary = textFrom(card, [".salary", ".job-salary", "[class*='salary']"]);
      const location = textFrom(card, [".job-area", ".location", "[class*='job-area']"]);
      const link = card.matches("a[href]") ? card : card.querySelector(
        "a[href*='job_detail'], a[href*='jobId'], a[href*='/job/'], a[href]"
      );
      const url = absoluteUrl(link?.getAttribute("href"));
      const selected = card.matches(
        ".active, .selected, .current, .cur, [aria-selected='true'], [data-selected='true']"
      ) || /(^|\s)(active|selected|current|cur)(\s|$)/i.test(card.className || "");
      return {
        title,
        company,
        salary,
        location,
        url,
        external_id: cardExternalId(card, url),
        selected,
        score: (selected ? 8 : 0) + (company ? 4 : 0) + (url ? 2 : 0)
      };
    }).filter((card) => card.title);
    const normalizedTitle = detailTitle.replace(/\s+/g, "");
    const titleMatches = snapshots.filter(
      (card) => card.title.replace(/\s+/g, "") === normalizedTitle
    );
    const candidates = titleMatches.length
      ? titleMatches
      : snapshots.filter((card) => card.selected);
    return candidates.sort((left, right) => right.score - left.score)[0] || null;
  }

  const reader = {
    text(selectors) {
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        if (node?.textContent?.trim()) return node.textContent;
      }
      return "";
    },
    texts(selectors) {
      for (const selector of selectors) {
        const values = [...document.querySelectorAll(selector)]
          .map((node) => node.textContent?.trim())
          .filter(Boolean);
        if (values.length) return values;
      }
      return [];
    },
    section(headings) {
      const normalized = headings.map((heading) => heading.replace(/\s+/g, ""));
      const titleNodes = document.querySelectorAll(
        ".job-detail-box h3, .job-detail-section h3, .job-sec h3, .job-detail h3, .job-detail h2, .describtion__detail h2, .job_msg h2, .tCompany_main h2, h2, h3, h4"
      );
      for (const titleNode of titleNodes) {
        const title = (titleNode.textContent || "").replace(/\s+/g, "");
        if (!normalized.some((heading) => title.includes(heading))) continue;
        const container = titleNode.closest(".job-sec, .job-detail-section")
          || titleNode.parentElement;
        const body = container?.querySelector(".job-sec-text, .text, p, .describtion__detail, .job_msg, .job-intro-container");
        if (body?.textContent?.trim()) return body.textContent;
        const siblingText = [...(container?.children || [])]
          .filter((node) => node !== titleNode)
          .map((node) => node.textContent?.trim())
          .filter(Boolean)
          .join(" ");
        if (siblingText) return siblingText;
      }
      return "";
    },
    pageType() {
      return document.querySelector(".job-list-box, .job-list") ? "split-view" : "detail-page";
    },
    panelText(selectors) {
      const panel = findBossRightPanel();
      if (!panel) return "";
      for (const selector of selectors) {
        const node = panel.querySelector(selector);
        const value = clean(node?.innerText || node?.textContent);
        if (value) return value;
      }
      return "";
    },
    activeJob() {
      return activeJobCard();
    }
  };

  const button = document.createElement("button");
  button.id = "resume-tailor-save-job";
  button.type = "button";
  button.textContent = saveButtonLabel(0);
  button.title = "保存当前岗位到岗位摘录器";

  const status = document.createElement("div");
  status.id = "resume-tailor-save-status";
  status.setAttribute("role", "status");
  document.documentElement.append(button, status);

  let statusTimer;
  function updateCount(jobCount) {
    button.textContent = saveButtonLabel(jobCount);
    button.title = `保存当前岗位到岗位摘录器；当前已收集 ${jobCount} 个岗位`;
  }

  function showStatus(message, failed = false) {
    clearTimeout(statusTimer);
    status.dataset.visible = "false";
    void status.offsetWidth;
    status.textContent = message;
    status.dataset.failed = failed ? "true" : "false";
    status.dataset.visible = "true";
    statusTimer = setTimeout(() => {
      status.dataset.visible = "false";
    }, 2800);
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const job = extractJob(reader, location.href);
      const errors = validateExtractedJob(job);
      if (errors.length) {
        showStatus(errors[0], true);
        return;
      }
      const stored = await chrome.storage.local.get({ savedJobs: [] });
      const result = upsertJob(stored.savedJobs, job);
      await chrome.storage.local.set({ savedJobs: result.jobs });
      updateCount(result.jobs.length);
      showStatus(saveStatusMessage(result.updated, result.jobs.length));
    } finally {
      button.disabled = false;
    }
  });

  chrome.storage.local.get({ savedJobs: [] }).then(({ savedJobs }) => {
    updateCount(savedJobs.length);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.savedJobs) {
      updateCount((changes.savedJobs.newValue || []).length);
    }
  });
})();
