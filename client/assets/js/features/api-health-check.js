/**
 * Simple API health check banner
 * - Pings /api/registry (primary) and reports failures (non-JSON / non-200)
 * - If ModelEndpointBootstrap fell back to a secondary base, it will show that too
 */
(function() {
    'use strict';

    const HEALTH_TIMEOUT_MS = 5000;
    const bannerId = 'api-health-banner';

    const fetchJson = async (url, timeoutMs = HEALTH_TIMEOUT_MS) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
            clearTimeout(timer);
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            const isJson = ct.includes('application/json');
            if (!res.ok || !isJson) {
                const text = await res.text();
                throw new Error(`status ${res.status}, type ${ct}, body: ${text.slice(0, 120)}`);
            }
            return await res.json();
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    };

    const renderBanner = (statusText, isHealthy) => {
        let banner = document.getElementById(bannerId);
        if (!banner) {
            banner = document.createElement('div');
            banner.id = bannerId;
            banner.style.position = 'fixed';
            banner.style.bottom = '12px';
            banner.style.right = '12px';
            banner.style.zIndex = 9999;
            banner.style.padding = '10px 14px';
            banner.style.borderRadius = '6px';
            banner.style.fontSize = '13px';
            banner.style.fontFamily = 'Inter, system-ui, sans-serif';
            banner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
            banner.style.maxWidth = '320px';
            document.body.appendChild(banner);
        }
        banner.style.background = isHealthy ? '#0f5132' : '#5c2e0a';
        banner.style.color = '#fff';
        banner.textContent = statusText;
    };

    const runHealthCheck = async () => {
        const primary = window.APP_CONFIG?.API_BASE_URL || '';
        const fallback = window.APP_CONFIG?.API_BASE_FALLBACK || '';
        const targets = [];
        if (primary) targets.push({ label: 'primary', url: `${primary}/registry` });
        if (fallback) targets.push({ label: 'fallback', url: `${fallback}/registry` });

        if (targets.length === 0) {
            renderBanner('API_BASE_URL not configured', false);
            return;
        }

        let healthy = false;
        const messages = [];

        for (const t of targets) {
            try {
                await fetchJson(t.url);
                messages.push(`${t.label}: ok`);
                healthy = true;
            } catch (err) {
                messages.push(`${t.label}: ${err.message}`);
            }
        }

        renderBanner(messages.join(' | '), healthy);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runHealthCheck);
    } else {
        runHealthCheck();
    }
})();

