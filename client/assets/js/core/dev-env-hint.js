(function () {
  "use strict";

  var script = document.currentScript;
  var requireParam =
    script && script.dataset ? script.dataset.requireParam : "";
  var isLocal =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  if (!isLocal) return;

  if (requireParam) {
    try {
      var params = new URLSearchParams(location.search);
      if (!params.has(requireParam)) return;
    } catch (e) {
      return;
    }
  }

  console.log(
    "[DEV] Local environment detected — using production APIs by default. Add ?localApi=1 for local Functions.",
  );
})();
