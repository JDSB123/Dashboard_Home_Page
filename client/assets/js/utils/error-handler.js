/**
 * Error Handler Utility
 * Provides user-facing error notifications and centralized error handling
 */

(function() {
    'use strict';

    /**
     * Show error notification to user
     * @param {string} message - Error message to display
     * @param {string} type - Error type: 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (0 = persistent)
     */
    function showError(message, type = 'error', duration = 5000) {
        // Use notifications.js if available
        if (window.Notifications && typeof window.Notifications.show === 'function') {
            window.Notifications.show(message, type, duration);
            return;
        }

        // Fallback: Create simple notification element
        const notification = document.createElement('div');
        notification.className = `error-notification error-notification-${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        
        const icon = type === 'error' ? '⚠️' : type === 'warning' ? '⚠️' : 'ℹ️';
        notification.innerHTML = `
            <span class="error-icon">${icon}</span>
            <span class="error-message">${escapeHtml(message)}</span>
            <button class="error-close" aria-label="Close notification">×</button>
        `;

        // Add styles if not already present
        if (!document.getElementById('error-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'error-notification-styles';
            style.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: rgba(220, 53, 69, 0.95);
                    color: white;
                    padding: 12px 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 400px;
                    animation: slideIn 0.3s ease-out;
                }
                .error-notification-warning {
                    background: rgba(255, 193, 7, 0.95);
                    color: #000;
                }
                .error-notification-info {
                    background: rgba(0, 123, 255, 0.95);
                    color: white;
                }
                .error-notification .error-close {
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    margin-left: auto;
                    opacity: 0.8;
                }
                .error-notification .error-close:hover {
                    opacity: 1;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Close button handler
        const closeBtn = notification.querySelector('.error-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
    }

    /**
     * Handle API errors
     * @param {Error|Response} error - Error object or Response object
     * @param {string} context - Context where error occurred
     */
    function handleApiError(error, context = 'API request') {
        let message = 'An error occurred';
        
        if (error instanceof Response) {
            if (error.status === 404) {
                message = `${context}: Service not found`;
            } else if (error.status === 500) {
                message = `${context}: Server error`;
            } else if (error.status === 403) {
                message = `${context}: Access denied`;
            } else {
                message = `${context}: HTTP ${error.status}`;
            }
        } else if (error instanceof Error) {
            message = `${context}: ${error.message}`;
        } else if (typeof error === 'string') {
            message = `${context}: ${error}`;
        }

        console.error(`[ErrorHandler] ${context}:`, error);
        showError(message, 'error');
    }

    /**
     * Handle localStorage errors
     * @param {Error} error - Error object
     * @param {string} operation - Operation that failed ('read', 'write', 'delete')
     */
    function handleStorageError(error, operation = 'access') {
        const message = `Failed to ${operation} local storage. Your data may not be saved.`;
        console.error(`[ErrorHandler] Storage ${operation} error:`, error);
        showError(message, 'warning', 7000);
    }

    /**
     * Handle parsing errors
     * @param {Error} error - Error object
     * @param {string} dataType - Type of data being parsed
     */
    function handleParseError(error, dataType = 'data') {
        const message = `Failed to parse ${dataType}. Please check the format.`;
        console.error(`[ErrorHandler] Parse error (${dataType}):`, error);
        showError(message, 'error');
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Global error handler for uncaught errors
     */
    function setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            console.error('[ErrorHandler] Uncaught error:', event.error);
            // Only show user-facing error for non-script errors
            if (event.error && event.error.message && !event.error.message.includes('Script error')) {
                showError('An unexpected error occurred. Please refresh the page.', 'error', 10000);
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('[ErrorHandler] Unhandled promise rejection:', event.reason);
            handleApiError(event.reason, 'Async operation');
        });
    }

    // Export to global scope
    window.ErrorHandler = {
        show: showError,
        handleApi: handleApiError,
        handleStorage: handleStorageError,
        handleParse: handleParseError,
        escapeHtml: escapeHtml
    };

    // Setup global error handler
    setupGlobalErrorHandler();

})();
