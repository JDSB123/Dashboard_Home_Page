(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var rangeDropdown = document.getElementById("date-range-dropdown");
    var rangeLabel = document.getElementById("date-range-label");
    if (!rangeDropdown || !rangeLabel) return;

    rangeDropdown.addEventListener("click", function (e) {
      if (!e.target.classList.contains("date-range-option")) return;

      rangeLabel.textContent = e.target.textContent;

      // Reload picks through the canonical rendering pipeline only.
      if (typeof window.loadLivePicks === "function") {
        window.loadLivePicks();
      } else if (
        window.LocalPicksManager &&
        typeof window.LocalPicksManager.refresh === "function"
      ) {
        window.LocalPicksManager.refresh();
      }
    });
  });
})();
