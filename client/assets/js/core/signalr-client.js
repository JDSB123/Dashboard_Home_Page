/**
 * SignalR Real-time Client v1.0.0
 * Provides true push-based real-time updates for:
 * - Model execution status updates
 * - Live score changes
 * - Pick status changes
 * 
 * Falls back to polling if SignalR connection fails
 */

(function() {
    'use strict';

    class SignalRClient {
        constructor() {
            this.connection = null;
            this.hubName = 'modelHub';
            this.isConnected = false;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.reconnectDelay = 5000;
            this.listeners = new Map();
            
            // Get negotiate endpoint from config
            this.negotiateUrl = window.APP_CONFIG?.FUNCTIONS_BASE_URL 
                ? `${window.APP_CONFIG.FUNCTIONS_BASE_URL}/api/signalr/negotiate`
                : '/api/signalr/negotiate';
            
            // Event callbacks
            this.onConnected = null;
            this.onDisconnected = null;
            this.onReconnecting = null;
            this.onError = null;
        }

        /**
         * Initialize SignalR connection
         */
        async connect() {
            // Check if SignalR is enabled in config
            if (!window.APP_CONFIG?.SIGNALR_ENABLED) {
                console.log('[SignalR] Disabled in config - using polling fallback');
                console.log('[SignalR] • To enable, set SIGNALR_ENABLED: true in config.js');
                console.log('[SignalR] • Requires Azure SignalR Service + Azure Functions deployment');
                this._startPollingFallback();
                return false;
            }

            // Check if SignalR library is loaded
            if (typeof signalR === 'undefined') {
                console.warn('[SignalR] Library not loaded, using polling fallback');
                this._startPollingFallback();
                return false;
            }

            // Check if negotiate URL is configured
            if (!this.negotiateUrl || this.negotiateUrl === '/api/signalr/negotiate') {
                // Relative URL won't work without proper backend - check if FUNCTIONS_BASE_URL is set
                if (!window.APP_CONFIG?.FUNCTIONS_BASE_URL) {
                    console.log('[SignalR] No FUNCTIONS_BASE_URL configured - using polling fallback');
                    this._startPollingFallback();
                    return false;
                }
            }

            try {
                console.log('[SignalR] Attempting to negotiate connection...');
                // Get connection info from Azure Functions
                const response = await fetch(this.negotiateUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Negotiate failed: ${response.status}`);
                }

                const connectionInfo = await response.json();

                // Build connection
                this.connection = new signalR.HubConnectionBuilder()
                    .withUrl(connectionInfo.url, {
                        accessTokenFactory: () => connectionInfo.accessToken
                    })
                    .withAutomaticReconnect({
                        nextRetryDelayInMilliseconds: (retryContext) => {
                            if (retryContext.previousRetryCount >= this.maxReconnectAttempts) {
                                return null; // Stop reconnecting
                            }
                            return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                        }
                    })
                    .configureLogging(signalR.LogLevel.Information)
                    .build();

                // Set up event handlers
                this._setupEventHandlers();

                // Start connection
                await this.connection.start();
                this.isConnected = true;
                this.reconnectAttempts = 0;

                console.log('✅ SignalR connected to', this.hubName);
                
                if (this.onConnected) {
                    this.onConnected();
                }

                // Emit custom event for other scripts
                window.dispatchEvent(new CustomEvent('signalr:connected', {
                    detail: { hubName: this.hubName }
                }));

                return true;

            } catch (error) {
                console.error('SignalR connection failed:', error);
                
                if (this.onError) {
                    this.onError(error);
                }

                // Fall back to polling
                this._startPollingFallback();
                return false;
            }
        }

        /**
         * Set up SignalR event handlers
         */
        _setupEventHandlers() {
            if (!this.connection) return;

            // Connection state handlers
            this.connection.onclose((error) => {
                this.isConnected = false;
                console.log('SignalR disconnected:', error?.message || 'Connection closed');
                
                if (this.onDisconnected) {
                    this.onDisconnected(error);
                }

                window.dispatchEvent(new CustomEvent('signalr:disconnected'));
            });

            this.connection.onreconnecting((error) => {
                this.isConnected = false;
                console.log('SignalR reconnecting...', error?.message);
                
                if (this.onReconnecting) {
                    this.onReconnecting(error);
                }

                window.dispatchEvent(new CustomEvent('signalr:reconnecting'));
            });

            this.connection.onreconnected((connectionId) => {
                this.isConnected = true;
                console.log('✅ SignalR reconnected:', connectionId);
                
                if (this.onConnected) {
                    this.onConnected();
                }

                window.dispatchEvent(new CustomEvent('signalr:reconnected'));
            });

            // Message handlers
            this.connection.on('modelStatusUpdate', (data) => {
                this._handleMessage('modelStatusUpdate', data);
            });

            this.connection.on('scoreUpdate', (data) => {
                this._handleMessage('scoreUpdate', data);
            });

            this.connection.on('pickStatusChange', (data) => {
                this._handleMessage('pickStatusChange', data);
            });

            this.connection.on('jobComplete', (data) => {
                this._handleMessage('jobComplete', data);
            });

            this.connection.on('notification', (data) => {
                this._handleMessage('notification', data);
            });
        }

        /**
         * Handle incoming SignalR message
         */
        _handleMessage(eventType, data) {
            console.log(`SignalR [${eventType}]:`, data);

            // Notify registered listeners
            const listeners = this.listeners.get(eventType) || [];
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in SignalR listener for ${eventType}:`, error);
                }
            });

            // Emit DOM event for loose coupling
            window.dispatchEvent(new CustomEvent(`signalr:${eventType}`, {
                detail: data
            }));
        }

        /**
         * Subscribe to a message type
         */
        on(eventType, callback) {
            if (!this.listeners.has(eventType)) {
                this.listeners.set(eventType, []);
            }
            this.listeners.get(eventType).push(callback);
        }

        /**
         * Unsubscribe from a message type
         */
        off(eventType, callback) {
            const listeners = this.listeners.get(eventType);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        }

        /**
         * Send a message to the hub (if supported by backend)
         */
        async send(method, ...args) {
            if (!this.isConnected || !this.connection) {
                console.warn('Cannot send: SignalR not connected');
                return false;
            }

            try {
                await this.connection.invoke(method, ...args);
                return true;
            } catch (error) {
                console.error(`SignalR send failed [${method}]:`, error);
                return false;
            }
        }

        /**
         * Disconnect from SignalR
         */
        async disconnect() {
            if (this.connection) {
                await this.connection.stop();
                this.isConnected = false;
                this.connection = null;
            }
        }

        /**
         * Start polling fallback when SignalR is unavailable
         */
        _startPollingFallback() {
            console.log('Using polling fallback for updates');
            
            // Emit event so other scripts know to use polling
            window.dispatchEvent(new CustomEvent('signalr:fallback', {
                detail: { reason: 'SignalR unavailable, using polling' }
            }));

            // The existing LiveScoreUpdater will handle polling
            // This just ensures graceful degradation
        }

        /**
         * Get connection status
         */
        getStatus() {
            return {
                isConnected: this.isConnected,
                hubName: this.hubName,
                state: this.connection?.state || 'Disconnected'
            };
        }
    }

    // Create singleton instance
    const signalRClient = new SignalRClient();

    // Auto-connect when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay connection slightly to allow config to load
            setTimeout(() => signalRClient.connect(), 500);
        });
    } else {
        setTimeout(() => signalRClient.connect(), 500);
    }

    // Export to window
    window.SignalRClient = signalRClient;

})();
