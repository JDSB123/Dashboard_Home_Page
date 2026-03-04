/**
 * Notification System — bottom-center snackbar (Linear / Vercel style)
 */

(function() {
    'use strict';

    let container = null;

    function initContainer() {
        if (container) return container;

        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001;
            display: flex;
            flex-direction: column-reverse;
            align-items: center;
            gap: 6px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        return container;
    }

    function showNotification(message, type = 'info', duration = 3000) {
        initContainer();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        const dot = { success: '#00c875', error: '#f45', warning: '#e0a000', info: '#7ab4db' };
        const c = dot[type] || dot.info;

        notification.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            background: rgba(12, 18, 30, 0.88);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 20px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.4);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            color: rgba(200,215,230,0.9);
            font: 500 11px/1 'Inter','Montserrat',system-ui,sans-serif;
            letter-spacing: 0.01em;
            white-space: nowrap;
            pointer-events: auto;
            cursor: default;
            opacity: 0;
            transform: translateY(8px) scale(0.96);
            transition: opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1);
        `;

        notification.innerHTML =
            `<span style="width:5px;height:5px;border-radius:50%;background:${c};flex-shrink:0"></span>` +
            `<span>${message}</span>`;

        container.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0) scale(1)';
        });

        if (duration > 0) {
            setTimeout(() => dismissNotification(notification), duration);
        }

        return notification;
    }

    function dismissNotification(el) {
        if (!el) return;
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px) scale(0.96)';
        setTimeout(() => el.remove(), 200);
    }

    function showLoading(message = 'Loading…') {
        const notification = showNotification(message, 'info', 0);

        // swap dot for spinner
        const dotEl = notification.querySelector('span');
        if (dotEl) {
            dotEl.style.cssText = `
                width:9px;height:9px;flex-shrink:0;
                border:1.5px solid rgba(255,255,255,0.15);
                border-top-color:rgba(255,255,255,0.7);
                border-radius:50%;
                animation:_gbsv_spin .7s linear infinite;
            `;
        }

        if (!document.querySelector('style[data-loading-spinner]')) {
            const s = document.createElement('style');
            s.setAttribute('data-loading-spinner', 'true');
            s.textContent = '@keyframes _gbsv_spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(s);
        }

        return {
            dismiss: () => dismissNotification(notification),
            update: (msg) => {
                const t = notification.querySelector('span:nth-child(2)');
                if (t) t.textContent = msg;
            }
        };
    }

    function success(msg, d) { return showNotification(msg, 'success', d); }
    function error(msg, d = 4500) { return showNotification(msg, 'error', d); }
    function warning(msg, d) { return showNotification(msg, 'warning', d); }
    function info(msg, d) { return showNotification(msg, 'info', d); }

    // Export
    window.Notify = {
        show: showNotification,
        success,
        error,
        warning,
        info,
        loading: showLoading
    };

})();
