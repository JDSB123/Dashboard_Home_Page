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
            success: { bg: 'rgba(0, 214, 137, 0.95)', icon: '✓', border: '#00ffaa' },
            error: { bg: 'rgba(229, 57, 53, 0.95)', icon: '✕', border: '#ff5f6d' },
            warning: { bg: 'rgba(251, 140, 0, 0.95)', icon: '⚠', border: '#fb8c00' },
            info: { bg: 'rgba(74, 182, 255, 0.95)', icon: 'ℹ', border: '#4ab6ff' }
        };
        
        const style = colors[type] || colors.info;
        
        notification.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 18px;
            background: ${style.bg};
            border: 1px solid ${style.border};
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            color: white;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 0.95rem;
            font-weight: 500;
            line-height: 1.4;
            pointer-events: auto;
            opacity: 0;
            transform: translateX(100%);
            transition: opacity 0.3s ease, transform 0.3s ease;
        `;
        
        notification.innerHTML = `
            <span style="font-size: 1.2rem; line-height: 1;">${style.icon}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                opacity: 0.7;
                cursor: pointer;
                font-size: 1.2rem;
                padding: 0;
                line-height: 1;
            " onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">×</button>
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
        notification.style.transform = 'translateX(100%)';
        
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
