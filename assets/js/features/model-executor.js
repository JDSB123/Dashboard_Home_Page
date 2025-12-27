/**
 * Model Executor Module v1.0
 * Handles model execution requests and real-time status updates
 * Integrates with Azure Functions orchestrator and SignalR
 */

(function() {
    'use strict';

    class ModelExecutor {
        constructor() {
            this.orchestratorUrl = window.APP_CONFIG?.ORCHESTRATOR_URL || 'https://gbsv-orchestrator.azurewebsites.net/api';
            this.signalRUrl = window.APP_CONFIG?.SIGNALR_HUB_URL || 'https://gbsv-signalr.service.signalr.net';
            this.modelConfigs = window.APP_CONFIG?.MODEL_CONFIGS || {};
            
            this.signalRConnection = null;
            this.activeJobs = new Map();
            this.statusListeners = new Map();
            
            this.initSignalR();
        }

        /**
         * Initialize SignalR connection for real-time updates
         */
        async initSignalR() {
            if (!window.signalR) {
                console.warn('[ModelExecutor] SignalR library not loaded. Real-time updates disabled.');
                return;
            }

            try {
                // Get connection info from orchestrator
                const response = await fetch(`${this.orchestratorUrl}/signalr/negotiate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`SignalR negotiation failed: ${response.status}`);
                }

                const connectionInfo = await response.json();

                // Build connection
                this.signalRConnection = new window.signalR.HubConnectionBuilder()
                    .withUrl(connectionInfo.url, {
                        accessTokenFactory: () => connectionInfo.accessToken
                    })
                    .withAutomaticReconnect()
                    .configureLogging(window.signalR.LogLevel.Information)
                    .build();

                // Setup event handlers
                this.signalRConnection.on('modelStatusUpdate', (update) => {
                    this.handleStatusUpdate(update);
                });

                // Start connection
                await this.signalRConnection.start();
                console.log('[ModelExecutor] SignalR connected successfully');

            } catch (error) {
                console.error('[ModelExecutor] SignalR connection failed:', error);
                // Fall back to polling
                this.enablePollingFallback();
            }
        }

        /**
         * Execute a model with given parameters
         * @param {string} modelType - Type of model (nba, ncaam, nfl, ncaaf)
         * @param {Object} params - Model parameters
         * @returns {Promise<string>} Job ID
         */
        async executeModel(modelType, params = {}) {
            const normalizedModel = modelType.toLowerCase();
            
            if (!['nba', 'ncaam', 'nfl', 'ncaaf'].includes(normalizedModel)) {
                throw new Error(`Invalid model type: ${modelType}`);
            }

            console.log(`[ModelExecutor] Executing ${normalizedModel} model with params:`, params);

            try {
                const response = await fetch(`${this.orchestratorUrl}/execute`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: normalizedModel,
                        params: {
                            ...params,
                            requestedAt: new Date().toISOString()
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `Execution failed: ${response.status}`);
                }

                const result = await response.json();
                const { jobId } = result;

                // Track job
                this.activeJobs.set(jobId, {
                    model: normalizedModel,
                    status: 'queued',
                    startTime: Date.now(),
                    params
                });

                // Start polling if SignalR not available
                if (!this.signalRConnection || this.signalRConnection.state !== 'Connected') {
                    this.pollJobStatus(jobId);
                }

                console.log(`[ModelExecutor] Job ${jobId} created for ${normalizedModel}`);
                return jobId;

            } catch (error) {
                console.error(`[ModelExecutor] Error executing ${normalizedModel}:`, error);
                throw error;
            }
        }

        /**
         * Get current status of a job
         * @param {string} jobId - Job ID to check
         * @returns {Promise<Object>} Job status
         */
        async getJobStatus(jobId) {
            try {
                const response = await fetch(`${this.orchestratorUrl}/status/${jobId}`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Job not found');
                    }
                    throw new Error(`Status check failed: ${response.status}`);
                }

                return await response.json();

            } catch (error) {
                console.error(`[ModelExecutor] Error checking status for job ${jobId}:`, error);
                throw error;
            }
        }

        /**
         * Poll job status (fallback when SignalR unavailable)
         * @param {string} jobId - Job ID to poll
         */
        async pollJobStatus(jobId) {
            const pollInterval = 2000; // 2 seconds
            const maxPolls = 150; // 5 minutes max
            let pollCount = 0;

            const poll = async () => {
                if (pollCount >= maxPolls) {
                    console.warn(`[ModelExecutor] Polling timeout for job ${jobId}`);
                    this.handleStatusUpdate({
                        jobId,
                        status: 'timeout',
                        error: 'Job execution timeout'
                    });
                    return;
                }

                try {
                    const status = await this.getJobStatus(jobId);
                    this.handleStatusUpdate(status);

                    if (status.status === 'completed' || status.status === 'failed') {
                        return; // Stop polling
                    }

                    pollCount++;
                    setTimeout(poll, pollInterval);

                } catch (error) {
                    console.error(`[ModelExecutor] Polling error for job ${jobId}:`, error);
                    // Continue polling unless job not found
                    if (!error.message.includes('not found')) {
                        pollCount++;
                        setTimeout(poll, pollInterval);
                    }
                }
            };

            // Start polling
            setTimeout(poll, pollInterval);
        }

        /**
         * Handle status update from SignalR or polling
         * @param {Object} update - Status update object
         */
        handleStatusUpdate(update) {
            const { jobId, status, modelType, progress, results, error } = update;

            // Update active job
            if (this.activeJobs.has(jobId)) {
                const job = this.activeJobs.get(jobId);
                job.status = status;
                job.progress = progress;
                
                if (status === 'completed') {
                    job.results = results;
                    job.endTime = Date.now();
                    job.duration = job.endTime - job.startTime;
                } else if (status === 'failed') {
                    job.error = error;
                    job.endTime = Date.now();
                }
            }

            // Notify listeners
            const listeners = this.statusListeners.get(jobId) || [];
            listeners.forEach(callback => {
                try {
                    callback(update);
                } catch (err) {
                    console.error('[ModelExecutor] Error in status listener:', err);
                }
            });

            // Trigger global status event
            window.dispatchEvent(new CustomEvent('modelStatusUpdate', {
                detail: update
            }));

            // Clean up completed/failed jobs after delay
            if (status === 'completed' || status === 'failed') {
                setTimeout(() => {
                    this.activeJobs.delete(jobId);
                    this.statusListeners.delete(jobId);
                }, 60000); // Keep for 1 minute
            }
        }

        /**
         * Register a callback for job status updates
         * @param {string} jobId - Job ID to monitor
         * @param {Function} callback - Callback function
         */
        onStatusUpdate(jobId, callback) {
            if (!this.statusListeners.has(jobId)) {
                this.statusListeners.set(jobId, []);
            }
            this.statusListeners.get(jobId).push(callback);
        }

        /**
         * Cancel a running job
         * @param {string} jobId - Job ID to cancel
         */
        async cancelJob(jobId) {
            try {
                const response = await fetch(`${this.orchestratorUrl}/cancel/${jobId}`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(`Cancel failed: ${response.status}`);
                }

                // Update local state
                if (this.activeJobs.has(jobId)) {
                    const job = this.activeJobs.get(jobId);
                    job.status = 'cancelled';
                }

                return true;

            } catch (error) {
                console.error(`[ModelExecutor] Error cancelling job ${jobId}:`, error);
                return false;
            }
        }

        /**
         * Get model registry information
         * @returns {Promise<Object>} Model registry
         */
        async getModelRegistry() {
            try {
                const response = await fetch(`${this.orchestratorUrl}/registry`);
                
                if (!response.ok) {
                    throw new Error(`Registry fetch failed: ${response.status}`);
                }

                return await response.json();

            } catch (error) {
                console.error('[ModelExecutor] Error fetching model registry:', error);
                throw error;
            }
        }

        /**
         * Enable polling fallback for all active jobs
         */
        enablePollingFallback() {
            console.log('[ModelExecutor] Enabling polling fallback for active jobs');
            this.activeJobs.forEach((job, jobId) => {
                if (job.status !== 'completed' && job.status !== 'failed') {
                    this.pollJobStatus(jobId);
                }
            });
        }

        /**
         * Get all active jobs
         * @returns {Array} Active jobs
         */
        getActiveJobs() {
            return Array.from(this.activeJobs.entries()).map(([jobId, job]) => ({
                jobId,
                ...job
            }));
        }

        /**
         * Clear all completed/failed jobs
         */
        clearInactiveJobs() {
            const toRemove = [];
            this.activeJobs.forEach((job, jobId) => {
                if (job.status === 'completed' || job.status === 'failed') {
                    toRemove.push(jobId);
                }
            });
            
            toRemove.forEach(jobId => {
                this.activeJobs.delete(jobId);
                this.statusListeners.delete(jobId);
            });
        }
    }

    // Create singleton instance
    const modelExecutor = new ModelExecutor();

    // Export to window
    window.ModelExecutor = modelExecutor;

    // Also export the class for testing
    window.ModelExecutorClass = ModelExecutor;

    console.log('[ModelExecutor] Module initialized');

})();
