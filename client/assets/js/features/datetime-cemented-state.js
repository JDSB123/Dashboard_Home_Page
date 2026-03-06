/**
 * Date/Time + Book cemented state
 * Adds a green "locked in" appearance when a row has date, time, and sportsbook.
 */
(function () {
  "use strict";

  const MEANINGFUL_TEXT = /^(?!\s*$)(?!-+$)(?!n\/?a$)(?!none$)(?!select\b)(?!choose\b).+/i;

  function readText(container, selectors) {
    for (const selector of selectors) {
      const el = container.querySelector(selector);
      if (el && typeof el.textContent === "string") {
        const value = el.textContent.trim();
        if (value) return value;
      }
    }
    return "";
  }

  function hasMeaningfulValue(value) {
    return MEANINGFUL_TEXT.test((value || "").trim());
  }

  // Map book keys to display names
  var BOOK_LABELS = {
    hulkwager: "Hulk Wager",
    bombay711: "Bombay 711",
    kingofsports: "King of Sports",
    primetimeaction: "Prime Time Action",
    other: "Other",
  };

  function evaluateDateTimeCell(cell) {
    const dateText = readText(cell, [".date-value", ".cell-date", ".date"]);
    const timeText = readText(cell, [".time-value", ".cell-time", ".time"]);
    const bookText = readText(cell, [
      ".sportsbook-value",
      ".cell-book",
      ".sportsbook-name",
    ]);

    // Support both class names used across the codebase
    const sportsbookSelect =
      cell.querySelector(".sportsbook-select") ||
      cell.querySelector(".sportsbook-dropdown");
    const selectedBook = sportsbookSelect ? (sportsbookSelect.value || "").trim() : "";

    const hasDate = hasMeaningfulValue(dateText);
    const hasTime = hasMeaningfulValue(timeText);
    const hasBook = hasMeaningfulValue(selectedBook || bookText);
    const isCemented = hasDate && hasTime && hasBook;

    cell.classList.toggle("is-cemented", isCemented);

    if (sportsbookSelect) {
      sportsbookSelect.classList.toggle("is-cemented", isCemented);
    }

    // When cemented and a dropdown is present, swap it for a static badge
    if (isCemented && sportsbookSelect && selectedBook) {
      var label = BOOK_LABELS[selectedBook] || selectedBook;
      var pickId = sportsbookSelect.getAttribute("data-pick-id") || "";
      var badge = document.createElement("span");
      badge.className = "sportsbook-value is-cemented";
      badge.setAttribute("data-pick-id", pickId);
      badge.setAttribute("data-book-key", selectedBook);
      badge.textContent = label;
      sportsbookSelect.replaceWith(badge);
    }
  }

  function applyCementedState(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const cells = scope.querySelectorAll(".datetime-cell");
    cells.forEach(evaluateDateTimeCell);
  }

  let refreshQueued = false;
  function queueRefresh(root) {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      applyCementedState(root);
    });
  }

  function init() {
    applyCementedState(document);

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.matches(".sportsbook-select, .sportsbook-dropdown")) {
        const cell = target.closest(".datetime-cell");
        if (cell) evaluateDateTimeCell(cell);
      }
    });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" || mutation.type === "characterData") {
          queueRefresh(document);
          break;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
