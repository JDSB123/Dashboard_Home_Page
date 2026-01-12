/**
 * Lazy Script Loader
 * Loads non-critical scripts after initial page interactive
 * Improves Time to Interactive (TTI) and perceived performance
 */

const LazyScriptLoader = (() => {
  const loadedScripts = new Set();
  const pendingScripts = new Map();

  /**
   * Load a script dynamically
   * @param {string} src - Script URL
   * @param {object} options - Script options (async, defer, module, etc.)
   * @returns {Promise<void>}
   */
  function loadScript(src, options = {}) {
    // Return existing promise if already loading
    if (pendingScripts.has(src)) {
      return pendingScripts.get(src);
    }

    // Already loaded
    if (loadedScripts.has(src)) {
      return Promise.resolve();
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = options.async !== false; // async by default

      if (options.defer) script.defer = true;
      if (options.type) script.type = options.type;
      if (options.crossOrigin) script.crossOrigin = options.crossOrigin;

      script.onload = () => {
        loadedScripts.add(src);
        pendingScripts.delete(src);
        resolve();
      };

      script.onerror = () => {
        pendingScripts.delete(src);
        reject(new Error(`Failed to load script: ${src}`));
      };

      document.head.appendChild(script);
    });

    pendingScripts.set(src, promise);
    return promise;
  }

  /**
   * Load multiple scripts in parallel
   * @param {string[]} scripts - Array of script URLs
   * @param {object} options - Script options
   * @returns {Promise<void>}
   */
  function loadScripts(scripts, options = {}) {
    return Promise.all(scripts.map((src) => loadScript(src, options)));
  }

  /**
   * Load scripts after page is interactive
   * @param {string|string[]} scripts - Script URL(s)
   * @param {object} options - Script options
   * @returns {Promise<void>}
   */
  function loadAfterInteractive(scripts, options = {}) {
    return new Promise((resolve) => {
      const loadScriptsNow = () => {
        const scriptArray = Array.isArray(scripts) ? scripts : [scripts];
        loadScripts(scriptArray, options).then(resolve).catch(resolve);
      };

      if (document.readyState === 'complete') {
        // Already loaded
        loadScriptsNow();
      } else {
        window.addEventListener('load', loadScriptsNow);
      }
    });
  }

  /**
   * Load scripts when idle
   * @param {string|string[]} scripts - Script URL(s)
   * @param {object} options - Script options
   * @returns {Promise<void>}
   */
  function loadWhenIdle(scripts, options = {}) {
    return new Promise((resolve) => {
      const loadScriptsNow = () => {
        const scriptArray = Array.isArray(scripts) ? scripts : [scripts];
        loadScripts(scriptArray, options).then(resolve).catch(resolve);
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadScriptsNow, { timeout: 2000 });
      } else {
        setTimeout(loadScriptsNow, 1000);
      }
    });
  }

  return {
    loadScript,
    loadScripts,
    loadAfterInteractive,
    loadWhenIdle,
  };
})();

// Expose globally
window.LazyScriptLoader = LazyScriptLoader;
