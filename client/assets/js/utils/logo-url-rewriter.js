/**
 * Logo URL Rewriter
 * Converts any ESPN CDN logo URLs to our Front Door / Azure CDN paths at runtime.
 * Works for existing DOM nodes and any future assignments to <img>.src.
 */
(function () {
    'use strict';

    const configBase = (window.APP_CONFIG && window.APP_CONFIG.LOGO_BASE_URL) || null;
    const fallbackBase = (window.APP_CONFIG && window.APP_CONFIG.LOGO_FALLBACK_URL) || null;
    const defaultBase = 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos';
    const LOGO_BASE = configBase || fallbackBase || defaultBase;

    /**
     * Transform an ESPN CDN URL into our CDN layout.
     * Example:
     *   https://a.espncdn.com/i/teamlogos/nba/500/ny.png
     *   -> https://<LOGO_BASE>/nba-500-ny.png
     */
    function convertEspnUrl(rawUrl) {
        if (!rawUrl) return null;
        try {
            const url = new URL(rawUrl, window.location.origin);
            if (!/espncdn\.com$/.test(url.hostname) && !/\.espncdn\.com$/.test(url.hostname)) {
                return null;
            }

            const segments = url.pathname.split('/').filter(Boolean);
            const idx = segments.indexOf('teamlogos');
            if (idx === -1 || segments.length < idx + 3) return null;

            const next = segments[idx + 1];
            const sizeOrLeague = segments[idx + 2];
            const maybeFile = segments[idx + 3] || '';

            // League logos: /teamlogos/leagues/500/nba.png
            if (next === 'leagues') {
                const league = maybeFile.replace('.png', '');
                if (!league) return null;
                return `${LOGO_BASE}/leagues-500-${league}.png`;
            }

            // Team logos: /teamlogos/nba/500/ny.png
            const league = next;
            const file = sizeOrLeague === '500' ? maybeFile : sizeOrLeague;
            const teamId = file.replace('.png', '');
            if (!league || !teamId) return null;

            return `${LOGO_BASE}/${league}-500-${teamId}.png`;
        } catch (_) {
            return null;
        }
    }

    function rewriteImage(img) {
        if (!img || !img.src) return;
        const mapped = convertEspnUrl(img.src);
        if (mapped && mapped !== img.src) {
            img.src = mapped;
        }
    }

    function rewriteExistingImages() {
        document.querySelectorAll('img[src*="espncdn.com/i/teamlogos/"]').forEach(rewriteImage);
    }

    // Patch future assignments to <img>.src so minified code paths also get rewritten
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (descriptor && descriptor.set) {
        const originalSet = descriptor.set;
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true,
            enumerable: descriptor.enumerable,
            get: descriptor.get,
            set(value) {
                const mapped = convertEspnUrl(value) || value;
                return originalSet.call(this, mapped);
            }
        });
    }

    // Rewrite on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', rewriteExistingImages, { once: true });
    } else {
        rewriteExistingImages();
    }

    // Observe future DOM mutations for dynamically added <img> tags
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'IMG') {
                    rewriteImage(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('img').forEach(rewriteImage);
                }
            });
        });
    });

    observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
    });

    // Expose helper for manual use/debug
    window.LogoUrlRewriter = {
        convertEspnUrl,
        rewriteExistingImages
    };
})();
