/**
 * Notification System
 * Provides user feedback for API operations and errors
 */

(function() {
    'use strict';

    let container = null;

    /**
     * Initialize notification container
     */
    function initContainer() {
        if (container) return container;
        
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        return container;
    }

    /**
     * Show notification toast
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms (default 5000, 0 = persistent)
     */
    function showNotification(message, type = 'info', duration = 5000) {
        initContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Type-specific styling
        const colors = {
            success: { bg: 'rgba(10, 22, 40, 0.94)', icon: '✓', border: 'rgba(0, 214, 137, 0.45)', accent: '#00d689' },
            error: { bg: 'rgba(10, 22, 40, 0.94)', icon: '✕', border: 'rgba(229, 57, 53, 0.45)', accent: '#ff5f6d' },
            warning: { bg: 'rgba(10, 22, 40, 0.94)', icon: '⚠', border: 'rgba(251, 191, 36, 0.40)', accent: '#fbbf24' },
            info: { bg: 'rgba(10, 22, 40, 0.94)', icon: '›', border: 'rgba(100, 160, 220, 0.35)', accent: '#8bb8e8' }
        };
        
        const style = colors[type] || colors.info;
        
        notification.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: ${style.bg};
            border: 1px solid ${style.border};
            border-left: 3px solid ${style.accent};
            border-radius: 6px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: rgba(220, 235, 248, 0.92);
            font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
            font-size: 0.78rem;
            font-weight: 500;
            letter-spacing: 0.02em;
            line-height: 1.35;
            pointer-events: auto;
            opacity: 0;
            transform: translateX(40px);
            transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        `;
        
        notification.innerHTML = `
            <span style="font-size: 0.85rem; line-height: 1; color: ${style.accent}; flex-shrink: 0; font-weight: 700;">${style.icon}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: rgba(220, 235, 248, 0.35);
                cursor: pointer;
                font-size: 1rem;
                padding: 0 0 0 4px;
                line-height: 1;
                transition: color 0.15s ease;
            " onmouseover="this.style.color='rgba(220,235,248,0.8)'" onmouseout="this.style.color='rgba(220,235,248,0.35)'">×</button>
        `;
        
        container.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                dismissNotification(notification);
            }, duration);
        }
        
        return notification;
    }

    /**
     * Dismiss a notification
     */
    function dismissNotification(notification) {
        if (!notification) return;
        
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(40px)';
        
        setTimeout(() => {
            notification.remove();
        }, 300);
    }

    /**
     * Show loading indicator
     * @param {string} message - Loading message
     * @returns {Object} - Loading indicator with dismiss method
     */
    function showLoading(message = 'Loading...') {
        const notification = showNotification(
            `<span class="loading-spinner"></span> ${message}`,
            'info',
            0
        );
        
        // Add spinner animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .loading-spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
        `;
        if (!document.querySelector('style[data-loading-spinner]')) {
            style.setAttribute('data-loading-spinner', 'true');
            document.head.appendChild(style);
        }
        
        return {
            dismiss: () => dismissNotification(notification),
            update: (newMessage) => {
                const textSpan = notification.querySelector('span:nth-child(2)');
                if (textSpan) textSpan.innerHTML = `<span class="loading-spinner"></span> ${newMessage}`;
            }
        };
    }

    // Convenience methods
    function success(message, duration) {
        return showNotification(message, 'success', duration);
    }

    function error(message, duration = 8000) {
        return showNotification(message, 'error', duration);
    }

    function warning(message, duration) {
        return showNotification(message, 'warning', duration);
    }

    function info(message, duration) {
        return showNotification(message, 'info', duration);
    }

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
