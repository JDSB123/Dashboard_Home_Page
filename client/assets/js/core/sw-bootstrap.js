(function () {
  "use strict";

  try {
    if (!("serviceWorker" in navigator)) return;

    var script = document.currentScript;
    var version = (script && script.dataset && script.dataset.version) || "";
    var explicitSwUrl =
      (script && script.dataset && script.dataset.swUrl) || "";
    var prefetchUrl =
      (script && script.dataset && script.dataset.prefetchUrl) || "";
    var swUrl =
      explicitSwUrl ||
      "/sw.js" + (version ? "?v=" + encodeURIComponent(version) : "");

    async function hardResetCachesAndReload() {
      try {
        var regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(function (r) {
            return r.unregister();
          }),
        );
      } catch (e) {}

      try {
        if (window.caches && caches.keys) {
          var keys = await caches.keys();
          await Promise.all(
            keys.map(function (k) {
              return caches.delete(k);
            }),
          );
        }
      } catch (e) {}

      try {
        var url = new URL(window.location.href);
        url.searchParams.set("r", String(Date.now()));
        window.location.replace(url.toString());
      } catch (e) {
        window.location.reload();
      }
    }

    function getSwVersion(controller) {
      return new Promise(function (resolve) {
        try {
          if (!controller) return resolve(null);
          var channel = new MessageChannel();
          channel.port1.onmessage = function (evt) {
            resolve((evt && evt.data && evt.data.version) || null);
          };
          controller.postMessage({ type: "GET_VERSION" }, [channel.port2]);
          setTimeout(function () {
            resolve(null);
          }, 1500);
        } catch (e) {
          resolve(null);
        }
      });
    }

    async function ensureFreshClient() {
      try {
        var params = new URLSearchParams(window.location.search);
        if (params.get("reset") === "1") {
          await hardResetCachesAndReload();
          return;
        }
      } catch (e) {}

      if (!version) return;

      try {
        var controller = navigator.serviceWorker.controller;
        var activeVersion = await getSwVersion(controller);
        if (activeVersion && activeVersion !== version) {
          await hardResetCachesAndReload();
        }
      } catch (e) {}
    }

    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register(swUrl, { updateViaCache: "none" })
        .then(function (reg) {
          try {
            reg.update();
          } catch (e) {}

          try {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          } catch (e) {}

          ensureFreshClient();
        })
        .catch(function () {});
    });

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      // Keep listener for visibility and future hooks.
    });

    if (prefetchUrl) {
      (
        window.requestIdleCallback ||
        function (cb) {
          setTimeout(cb, 100);
        }
      )(function () {
        try {
          fetch(prefetchUrl, { mode: "no-cors" }).catch(function () {});
        } catch (e) {}
      });
    }
  } catch (e) {}
})();
