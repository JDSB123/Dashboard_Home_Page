/**
 * Enhanced Notification System
 * Toast notifications with animations and stacking
 */

(function() {
    'use strict';

    const notifications = [];
    let notificationContainer = null;

    // ===== NOTIFICATION TYPES =====
    const TYPES = {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    };

    const TYPE_CONFIG = {
        success: { icon: '✓', duration: 3000 },
        error: { icon: '✕', duration: 5000 },
        warning: { icon: '⚠', duration: 4000 },
        info: { icon: 'ℹ', duration: 3000 }
    };

    // ===== CREATE CONTAINER =====
    function ensureContainer() {
        if (notificationContainer) return;

        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.setAttribute('role', 'region');
        notificationContainer.setAttribute('aria-live', 'polite');
        notificationContainer.setAttribute('aria-label', 'Notifications');
        document.body.appendChild(notificationContainer);
    }

    // ===== SHOW NOTIFICATION =====
    function show(message, type = TYPES.INFO, options = {}) {
        ensureContainer();

        const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
        const duration = options.duration || config.duration;
        const id = `notification-${Date.now()}-${Math.random()}`;

        const notification = {
            id,
            message,
            type,
            duration,
            timestamp: Date.now()
        };

        notifications.push(notification);

        const element = createNotificationElement(notification, config);
        notificationContainer.appendChild(element);

        // Trigger animation
        requestAnimationFrame(() => {
            element.classList.add('show');
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }

        return id;
    }

    // ===== CREATE NOTIFICATION ELEMENT =====
    function createNotificationElement(notification, config) {
        const div = document.createElement('div');
        div.className = `notification notification-${notification.type}`;
        div.setAttribute('data-notification-id', notification.id);
        div.setAttribute('role', 'alert');

        div.innerHTML = `
            <div class="notification-icon">${config.icon}</div>
            <div class="notification-content">
                <div class="notification-message">${escapeHtml(notification.message)}</div>
            </div>
            <button class="notification-close" aria-label="Close notification">×</button>
        `;

        // Close button handler
        div.querySelector('.notification-close').addEventListener('click', () => {
            dismiss(notification.id);
        });

        return div;
    }

    // ===== DISMISS NOTIFICATION =====
    function dismiss(id) {
        const element = notificationContainer?.querySelector(`[data-notification-id="${id}"]`);
        if (!element) return;

        element.classList.add('exit');

        setTimeout(() => {
            element.remove();
            const index = notifications.findIndex(n => n.id === id);
            if (index > -1) notifications.splice(index, 1);
        }, 300);
    }

    // ===== DISMISS ALL =====
    function dismissAll() {
        const elements = notificationContainer?.querySelectorAll('.notification');
        elements?.forEach(el => {
            el.classList.add('exit');
        });

        setTimeout(() => {
            notificationContainer.innerHTML = '';
            notifications.length = 0;
        }, 300);
    }

    // ===== HELPER FUNCTIONS =====
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== CONVENIENCE METHODS =====
    function success(message, options) {
        return show(message, TYPES.SUCCESS, options);
    }

    function error(message, options) {
        return show(message, TYPES.ERROR, options);
    }

    function warning(message, options) {
        return show(message, TYPES.WARNING, options);
    }

    function info(message, options) {
        return show(message, TYPES.INFO, options);
    }

    // ===== EXPORT =====
    window.DashboardNotification = {
        show,
        success,
        error,
        warning,
        info,
        dismiss,
        dismissAll,
        TYPES
    };

    console.log('✅ Enhanced Notification System loaded');

})();
