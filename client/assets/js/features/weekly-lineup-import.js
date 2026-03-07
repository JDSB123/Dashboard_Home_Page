/**
 * Weekly Lineup import handler.
 * Wires upload/paste controls in weekly-lineup.html to PickStandardizer
 * and appends parsed picks through WeeklyLineup.appendImportedPicks().
 */
(function () {
  "use strict";

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  const TEXT_EXTENSIONS = new Set(["txt", "csv", "html", "htm"]);
  const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

  let statusTimer = null;

  const safeText = (value) => (value ?? "").toString();

  const escapeHtml = (value) =>
    safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getExtension = (fileName) => {
    const lower = safeText(fileName).toLowerCase();
    const idx = lower.lastIndexOf(".");
    return idx >= 0 ? lower.slice(idx + 1) : "";
  };

  const getSelectedSportsbook = () => {
    const select = document.getElementById("upload-sportsbook-select");
    if (!select) {
      return { value: "", label: "" };
    }
    const value = safeText(select.value).trim();
    const label = safeText(select.options?.[select.selectedIndex]?.textContent).trim();
    return { value, label };
  };

  const showToast = (message, type = "info") => {
    if (window.WeeklyLineup?.showNotification) {
      window.WeeklyLineup.showNotification(message, type);
      return;
    }
    if (window.showNotification) {
      window.showNotification(message, type);
      return;
    }
    console.log(`[weekly-lineup-import][${type}] ${message}`);
  };

  const applyStatusStyle = (node, type) => {
    if (!node) return;
    if (type === "success") {
      node.style.background = "rgba(16, 185, 129, 0.12)";
      node.style.color = "#34d399";
      node.style.border = "1px solid rgba(16, 185, 129, 0.35)";
      return;
    }
    if (type === "error") {
      node.style.background = "rgba(239, 68, 68, 0.12)";
      node.style.color = "#fca5a5";
      node.style.border = "1px solid rgba(239, 68, 68, 0.35)";
      return;
    }
    if (type === "warning") {
      node.style.background = "rgba(245, 158, 11, 0.12)";
      node.style.color = "#fbbf24";
      node.style.border = "1px solid rgba(245, 158, 11, 0.35)";
      return;
    }
    node.style.background = "rgba(59, 130, 246, 0.12)";
    node.style.color = "#93c5fd";
    node.style.border = "1px solid rgba(59, 130, 246, 0.35)";
  };

  const showInlineStatus = (message, type = "info", timeoutMs = 4500) => {
    const node = document.getElementById("upload-status");
    if (!node) return;

    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }

    node.textContent = safeText(message);
    applyStatusStyle(node, type);
    node.style.display = "block";

    if (timeoutMs > 0) {
      statusTimer = setTimeout(() => {
        node.style.display = "none";
        statusTimer = null;
      }, timeoutMs);
    }
  };

  const parseWithStandardizer = (content) => {
    const parser = window.PickStandardizer;
    if (!parser?.standardize) return [];
    try {
      const picks = parser.standardize(content);
      return Array.isArray(picks) ? picks : [];
    } catch (error) {
      console.warn("[weekly-lineup-import] parse failed", error);
      return [];
    }
  };

  const parseTextFile = async (file) => {
    const text = await file.text();
    return parseWithStandardizer(text);
  };

  const parsePdfFile = async (file) => {
    const pdfParser = window.PDFParser;
    if (!pdfParser?.extractAndParsePicks) {
      throw new Error("PDF parser is not loaded yet. Please try again in a moment.");
    }

    const result = await pdfParser.extractAndParsePicks(file);
    if (safeText(result?.rawText).trim()) {
      return parseWithStandardizer(result.rawText);
    }
    return Array.isArray(result?.picks) ? result.picks : [];
  };

  const parseImageFile = async (file) => {
    const ocrParser = window.ImageOCRParser;
    if (!ocrParser?.extractAndParsePicks) {
      throw new Error("OCR parser is not loaded yet. Please try again in a moment.");
    }

    const result = await ocrParser.extractAndParsePicks(file);
    if (safeText(result?.rawText).trim()) {
      return parseWithStandardizer(result.rawText);
    }
    return Array.isArray(result?.picks) ? result.picks : [];
  };

  const parseFileToPicks = async (file) => {
    if (!file) return [];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`${file.name} is larger than 10MB.`);
    }

    const ext = getExtension(file.name);

    if (ext === "pdf" || file.type === "application/pdf") {
      return parsePdfFile(file);
    }
    if (IMAGE_EXTENSIONS.has(ext) || safeText(file.type).startsWith("image/")) {
      return parseImageFile(file);
    }
    if (TEXT_EXTENSIONS.has(ext)) {
      return parseTextFile(file);
    }

    throw new Error(`${file.name} has an unsupported file type.`);
  };

  const renderFileList = (files) => {
    const host = document.getElementById("file-list");
    if (!host) return;
    const list = Array.isArray(files) ? files : [];
    if (!list.length) {
      host.innerHTML = "";
      host.style.display = "none";
      return;
    }
    host.style.display = "block";
    host.innerHTML = list
      .map((file) => {
        const sizeKb = Math.max(1, Math.round((file.size || 0) / 1024));
        return `<div class="file-list-item"><span>${escapeHtml(file.name)}</span><span>${sizeKb} KB</span></div>`;
      })
      .join("");
  };

  const appendParsedPicks = async (picks, sportsbook, source) => {
    if (!window.WeeklyLineup?.appendImportedPicks) {
      throw new Error("Weekly lineup import API is unavailable.");
    }
    const result = await window.WeeklyLineup.appendImportedPicks(picks, {
      sportsbook: sportsbook?.label || sportsbook?.value || "Manual Upload",
      sportsbookKey: sportsbook?.value || "",
      source: source || "manual-import",
      saveToCosmos: true,
    });
    return result || {};
  };

  const processManualText = async () => {
    const sportsbook = getSelectedSportsbook();
    if (!sportsbook.value) {
      showInlineStatus("Select a sportsbook before importing picks.", "warning");
      return;
    }

    const input = document.getElementById("manual-picks-input");
    const text = safeText(input?.value).trim();
    if (!text) {
      showInlineStatus("Paste picks text before processing.", "warning");
      return;
    }

    const parsed = parseWithStandardizer(text);
    if (!parsed.length) {
      showInlineStatus("No picks were detected in pasted text.", "warning");
      return;
    }

    showInlineStatus("Processing pasted picks...", "info", 0);

    try {
      const summary = await appendParsedPicks(parsed, sportsbook, "manual-import");
      const added = summary.added || 0;
      const updated = summary.updated || 0;
      const dropped = summary.dropped || 0;
      const importedCount = added + updated;
      const statusType = importedCount > 0 ? "success" : "warning";
      const message =
        importedCount > 0
          ? `Imported ${importedCount} pick(s)${dropped ? ` (${dropped} skipped)` : ""}.`
          : `No picks imported${dropped ? ` (${dropped} skipped)` : ""}.`;
      showInlineStatus(message, statusType);
      if (importedCount > 0) {
        showToast(
          `Weekly Lineup updated: ${added} added, ${updated} updated.`,
          "success",
        );
      } else {
        showToast("No importable picks were matched to active games.", "warning");
      }
      if (input) input.value = "";
    } catch (error) {
      showInlineStatus(error.message || "Unable to import pasted picks.", "error");
      showToast(error.message || "Unable to import pasted picks.", "error");
    }
  };

  const processFiles = async (files) => {
    const sportsbook = getSelectedSportsbook();
    if (!sportsbook.value) {
      showInlineStatus("Select a sportsbook before importing picks.", "warning");
      return;
    }

    const list = Array.from(files || []);
    if (!list.length) return;

    renderFileList(list);
    showInlineStatus(`Processing ${list.length} file(s)...`, "info", 0);

    const parsed = [];
    const errors = [];

    for (const file of list) {
      try {
        const picks = await parseFileToPicks(file);
        if (Array.isArray(picks) && picks.length) parsed.push(...picks);
      } catch (error) {
        errors.push(`${file.name}: ${error.message || "parse failed"}`);
      }
    }

    if (!parsed.length) {
      const message = errors.length
        ? `No picks imported. ${errors[0]}`
        : "No picks detected in selected file(s).";
      showInlineStatus(message, "warning");
      if (errors.length) showToast(errors.join(" | "), "warning");
      return;
    }

    try {
      const summary = await appendParsedPicks(parsed, sportsbook, "file-import");
      const added = summary.added || 0;
      const updated = summary.updated || 0;
      const dropped = summary.dropped || 0;
      const failedCount = errors.length;
      const importedCount = added + updated;

      showInlineStatus(
        importedCount > 0
          ? `Imported ${importedCount} pick(s)${dropped ? ` (${dropped} skipped)` : ""}${failedCount ? `, ${failedCount} file error(s)` : ""}.`
          : `No picks imported${dropped ? ` (${dropped} skipped)` : ""}${failedCount ? `, ${failedCount} file error(s)` : ""}.`,
        importedCount > 0 && !failedCount ? "success" : "warning",
      );
      if (importedCount > 0) {
        showToast(
          `Weekly Lineup updated: ${added} added, ${updated} updated.`,
          "success",
        );
      } else {
        showToast("No importable picks were matched to active games.", "warning");
      }
      if (failedCount) showToast(errors.join(" | "), "warning");
    } catch (error) {
      showInlineStatus(error.message || "Unable to import file picks.", "error");
      showToast(error.message || "Unable to import file picks.", "error");
    } finally {
      renderFileList([]);
      const input = document.getElementById("file-upload");
      if (input) input.value = "";
    }
  };

  const init = () => {
    const select = document.getElementById("upload-sportsbook-select");
    const actionButtons = document.getElementById("action-buttons");
    const importOptions = document.getElementById("import-options");
    const importBtn = document.querySelector(".import-picks-btn");
    const backBtn = document.querySelector(".import-back-btn");
    const manualToggleBtn = document.getElementById("manual-entry-btn");
    const manualArea = document.getElementById("manual-entry-area");
    const submitManual = document.getElementById("submit-manual-picks");
    const fileInput = document.getElementById("file-upload");
    const dropZone = document.getElementById("drop-zone");

    if (!select || !importOptions) return;

    const syncActionState = () => {
      const hasSportsbook = !!safeText(select.value).trim();
      if (actionButtons) {
        actionButtons.classList.toggle("is-hidden", !hasSportsbook);
      }
      if (!hasSportsbook) {
        importOptions.setAttribute("hidden", "");
        if (manualArea) manualArea.classList.add("hidden");
      }
    };

    const showImportOptions = () => {
      if (!safeText(select.value).trim()) {
        showInlineStatus("Select a sportsbook before uploading picks.", "warning");
        return;
      }
      importOptions.removeAttribute("hidden");
      if (actionButtons) actionButtons.classList.add("is-hidden");
    };

    const hideImportOptions = () => {
      importOptions.setAttribute("hidden", "");
      if (manualArea) manualArea.classList.add("hidden");
      renderFileList([]);
      syncActionState();
    };

    select.addEventListener("change", syncActionState);

    if (importBtn) {
      importBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showImportOptions();
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", (event) => {
        event.preventDefault();
        hideImportOptions();
      });
    }

    if (manualToggleBtn && manualArea) {
      manualToggleBtn.addEventListener("click", (event) => {
        event.preventDefault();
        manualArea.classList.toggle("hidden");
      });
    }

    if (submitManual) {
      submitManual.addEventListener("click", (event) => {
        event.preventDefault();
        processManualText();
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", () => {
        processFiles(fileInput.files);
      });
    }

    if (dropZone) {
      const preventDefaults = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };

      ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, preventDefaults);
      });

      ["dragenter", "dragover"].forEach((eventName) => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.remove("dragover");
        });
      });

      dropZone.addEventListener("drop", (event) => {
        const dt = event.dataTransfer;
        processFiles(dt?.files || []);
      });
    }

    syncActionState();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
