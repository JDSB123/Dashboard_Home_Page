/**
 * API Error Handler v1.0
 * Centralized error handling with user-facing notifications
 * Provides consistent error messaging and retry logic
 */
(function() {
    'use strict';

    // Error message templates
    const ERROR_MESSAGES = {
        network: {
            title: 'Connection Error',
            message: 'Unable to reach the server. Check your internet connection.',
            icon: '🌐'
        },
        timeout: {
            title: 'Request Timeout',
            message: 'The server took too long to respond. Please try again.',
            icon: '⏱️'
        },
        serverError: {
            title: 'Server Error',
            message: 'Something went wrong on our end. Please try again later.',
            icon: '⚠️'
        },
        notFound: {
            title: 'Not Found',
            message: 'The requested data could not be found.',
            icon: '🔍'
        },
        unauthorized: {
            title: 'Access Denied',
            message: 'You don\'t have permission to access this resource.',
            icon: '🔒'
        },
        rateLimit: {
            title: 'Too Many Requests',
            message: 'Please wait a moment before trying again.',
            icon: '⏳'
        },
        dataFetch: {
            title: 'Data Unavailable',
            message: 'Could not load the latest data. Using cached data.',
            icon: '📊'
        },
        parseError: {
            title: 'Data Error',
            message: 'Received invalid data from the server.',
            icon: '❌'
        }
    };

    // Retry configuration
    const RETRY_CONFIG = {
        maxRetries: 3,
        baseDelay: 1000, // ms
        maxDelay: 10000, // ms
        backoffFactor: 2
    };

    // Track active errors to prevent duplicates
    const activeErrors = new Set();

    /**
     * Classify error type from response/error
     * @param {Error|Response} error - The error or response object
     * @returns {string} - Error type key
     */
    function classifyError(error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return 'network';
        }
        if (error.name === 'AbortError') {
            return 'timeout';
        }
        if (error instanceof Response) {
            const status = error.status;
            if (status === 401 || status === 403) return 'unauthorized';
            if (status === 404) return 'notFound';
            if (status === 429) return 'rateLimit';
            if (status >= 500) return 'serverError';
        }
        if (error instanceof SyntaxError) {
            return 'parseError';
        }
        return 'serverError';
    }

    /**
     * Show error notification to user
     * @param {string} errorType - Error type key
     * @param {Object} [options] - Additional options
     */
    function showError(errorType, options = {}) {
        const errorInfo = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.serverError;
        const errorId = options.errorId || `${errorType}-${Date.now()}`;

        // Prevent duplicate notifications
        if (activeErrors.has(errorType) && !options.force) {
            console.log(`[APIErrorHandler] Suppressing duplicate: ${errorType}`);
            return;
        }

        activeErrors.add(errorType);

        // Build notification content
        const title = options.title || errorInfo.title;
        const message = options.message || errorInfo.message;
        const icon = options.icon || errorInfo.icon;

        // Use existing notification system if available
        if (window.showNotification) {
            window.showNotification(`${icon} ${title}: ${message}`, 'error', options.duration || 5000);
        } else if (window.NotificationsManager && window.NotificationsManager.show) {
            window.NotificationsManager.show({
                type: 'error',
                title: `${icon} ${title}`,
                message: message,
                duration: options.duration || 5000
            });
        } else {
            // Fallback - create toast notification
            createToast({ icon, title, message, type: 'error', duration: options.duration || 5000 });
        }

        // Clear from active errors after notification duration
        setTimeout(() => {
            activeErrors.delete(errorType);
        }, (options.duration || 5000) + 1000);

        // Log for debugging
        console.error(`[APIErrorHandler] ${errorType}:`, message, options.context || '');
    }

    /**
     * Create fallback toast notification
     */
    function createToast({ icon, title, message, type, duration }) {
        let container = document.getElementById('api-error-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'api-error-toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'api-error-toast';
        toast.style.cssText = `
            background: linear-gradient(135deg, rgba(255, 79, 94, 0.95), rgba(200, 50, 70, 0.95));
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(255, 79, 94, 0.3);
            display: flex;
            align-items: flex-start;
            gap: 12px;
            max-width: 380px;
            pointer-events: auto;
            animation: slideInRight 0.3s ease-out;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        toast.innerHTML = `
            <span style="font-size: 24px; line-height: 1;">${icon}</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${title}</div>
                <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">${message}</div>
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                color: white;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        `;

        container.appendChild(toast);

        // Add animation styles if not present
        if (!document.getElementById('api-error-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'api-error-toast-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Auto-remove after duration
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Handle API error with optional retry
     * @param {Error|Response} error - The error or response
     * @param {Object} [options] - Options including retry config
     * @returns {Promise} - Resolves when handled
     */
    async function handleError(error, options = {}) {
        const errorType = classifyError(error);
        
        // Show notification unless suppressed
        if (!options.silent) {
            showError(errorType, {
                context: options.context,
                ...options.notification
            });
        }

        // Return retry info for caller
        return {
            errorType,
            shouldRetry: options.retryable !== false && 
                         ['network', 'timeout', 'serverError'].includes(errorType),
            retryDelay: calculateRetryDelay(options.attempt || 0)
        };
    }

    /**
     * Calculate retry delay with exponential backoff
     * @param {number} attempt - Current attempt number (0-based)
     * @returns {number} - Delay in milliseconds
     */
    function calculateRetryDelay(attempt) {
        const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt);
        const jitter = delay * 0.2 * Math.random();
        return Math.min(delay + jitter, RETRY_CONFIG.maxDelay);
    }

    /**
     * Fetch with automatic error handling and retry
     * @param {string} url - URL to fetch
     * @param {Object} [options] - Fetch options plus retry config
     * @returns {Promise<Response>} - Response if successful
     */
    async function fetchWithRetry(url, options = {}) {
        const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
        const timeout = options.timeout ?? 10000;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw response;
                }

                return response;

            } catch (error) {
                lastError = error;
                
                const { shouldRetry, retryDelay } = await handleError(error, {
                    context: options.context || url,
                    silent: attempt < maxRetries, // Only show error on final attempt
                    attempt
                });

                if (!shouldRetry || attempt >= maxRetries) {
                    throw error;
                }

                console.log(`[APIErrorHandler] Retry ${attempt + 1}/${maxRetries} in ${retryDelay}ms`);
                await new Promise(r => setTimeout(r, retryDelay));
            }
        }

        throw lastError;
    }

    /**
     * Wrapper for API calls with automatic error handling
     * @param {Function} apiCall - Async function to call
     * @param {Object} [options] - Options
     * @returns {Promise<{data: any, error: Error|null}>}
     */
    async function safeApiCall(apiCall, options = {}) {
        try {
            const data = await apiCall();
            return { data, error: null };
        } catch (error) {
            await handleError(error, {
                context: options.context,
                silent: options.silent
            });
            return { data: options.fallback ?? null, error };
        }
    }

    // Export API
    window.APIErrorHandler = {
        handleError,
        showError,
        fetchWithRetry,
        safeApiCall,
        classifyError,
        ERROR_MESSAGES
    };

    console.log('[APIErrorHandler] Module loaded');
})();

