(function () {
  "use strict";

  if (!window.LazyScriptLoader) return;

  window.addEventListener("load", function () {
    setTimeout(function () {
      window.LazyScriptLoader.loadWhenIdle([
        "assets/js/features/pdf-parser.js?v=36.03.0",
        "assets/js/features/image-ocr-parser.js?v=36.03.0",
      ]);
    }, 3000);
  });
})();
