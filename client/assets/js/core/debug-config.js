/* ==========================================================================
   Debug Configuration
   --------------------------------------------------------------------------
   Silences console output in production unless explicitly enabled.

   To enable debug logging:
   - Set window.DEBUG = true BEFORE this script loads, OR
   - Add ?debug=true to the URL, OR
   - Set localStorage.setItem('DEBUG', 'true')
   ========================================================================== */
(function () {
    'use strict';

    try {
        if (typeof window === 'undefined') return;

        // Check multiple debug sources
        var isDebugEnabled = (
            window.DEBUG === true ||
            localStorage.getItem('DEBUG') === 'true' ||
            window.location.search.indexOf('debug=true') !== -1
        );

        // Store for runtime access
        window.DEBUG = isDebugEnabled;

        if (!isDebugEnabled && typeof console !== 'undefined') {
            // Store original methods for potential restoration
            var originalLog = console.log;
            var originalWarn = console.warn;

            // Silence log and most warnings in production
            console.log = function () {};

            // Keep console.warn for actionable warnings, but filter emoji-heavy debug messages
            console.warn = function () {
                // Allow through actual warnings (errors, deprecations)
                var msg = arguments[0];
                if (typeof msg === 'string' && /^[^\w]*[🚀🔄⚠️📦📍🎯📚📊✅❌🔧📖🏈🔍⏰🚪]/.test(msg)) {
                    // Filter emoji-prefixed debug messages
                    return;
                }
                originalWarn.apply(console, arguments);
            };

            // console.error always logs (these are real errors)
            // console.info is kept for important status updates

            // Allow restoration for debugging
            window.__restoreConsole = function () {
                console.log = originalLog;
                console.warn = originalWarn;
                window.DEBUG = true;
            };
        }
    } catch (e) {
        /* Silent fail - don't break the app */
    }
})();


