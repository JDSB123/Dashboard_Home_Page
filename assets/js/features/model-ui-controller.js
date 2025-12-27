/**
 * Model UI Controller v1.0
 * Handles UI interactions for model execution controls
 * Integrates with ModelExecutor for triggering analysis
 */

(function() {
    'use strict';

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModelUI);
    } else {
        initModelUI();
    }

    function initModelUI() {
        console.log('[ModelUI] Initializing model execution UI');

        // Check if ModelExecutor is available
        if (!window.ModelExecutor) {
            console.error('[ModelUI] ModelExecutor not found. Model execution disabled.');
            return;
        }

        // Initialize UI components
        setupExecutionButtons();
        setupStatusDisplay();
        setupGlobalStatusListener();
        
        // Add styles for model controls
        addModelControlStyles();
    }

    /**
     * Setup execution button handlers
     */
    function setupExecutionButtons() {
        const buttons = document.querySelectorAll('.btn-execute');
        
        buttons.forEach(button => {
            button.addEventListener('click', handleExecuteClick);
        });

        console.log(`[ModelUI] Initialized ${buttons.length} execution buttons`);
    }

    /**
     * Handle model execution button click
     */
    async function handleExecuteClick(event) {
        const button = event.currentTarget;
        const modelType = button.dataset.model;
        
        if (!modelType) {
            console.error('[ModelUI] No model type specified on button');
            return;
        }

        // Disable button and show loading state
        button.disabled = true;
        button.classList.add('loading');
        const originalText = button.innerHTML;
        button.innerHTML = `
            <span class="spinner">⟳</span>
            <span>Running...</span>
        `;

        try {
            // Get current date from date selector if available
            const dateRange = document.querySelector('#date-range-label')?.textContent || 'today';
            
            // Execute model
            const jobId = await window.ModelExecutor.executeModel(modelType, {
                date: dateRange.toLowerCase(),
                source: 'dashboard'
            });

            // Show status display
            showStatusDisplay();
            
            // Add job to status display
            addJobToStatusDisplay(jobId, modelType, 'queued');
            
            // Listen for updates on this job
            window.ModelExecutor.onStatusUpdate(jobId, (update) => {
                updateJobStatus(jobId, update);
                
                // If completed, refresh picks after a delay
                if (update.status === 'completed') {
                    setTimeout(() => {
                        refreshPicksForModel(modelType);
                    }, 1000);
                }
            });

            console.log(`[ModelUI] Started job ${jobId} for ${modelType}`);

        } catch (error) {
            console.error(`[ModelUI] Error executing ${modelType}:`, error);
            showNotification(`Failed to start ${modelType.toUpperCase()} analysis: ${error.message}`, 'error');
        } finally {
            // Reset button state
            setTimeout(() => {
                button.disabled = false;
                button.classList.remove('loading');
                button.innerHTML = originalText;
            }, 2000);
        }
    }

    /**
     * Setup status display area
     */
    function setupStatusDisplay() {
        const statusClose = document.getElementById('status-close');
        if (statusClose) {
            statusClose.addEventListener('click', hideStatusDisplay);
        }
    }

    /**
     * Show status display area
     */
    function showStatusDisplay() {
        const statusEl = document.getElementById('model-status');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.classList.add('active');
        }
    }

    /**
     * Hide status display area
     */
    function hideStatusDisplay() {
        const statusEl = document.getElementById('model-status');
        if (statusEl) {
            statusEl.style.display = 'none';
            statusEl.classList.remove('active');
        }
    }

    /**
     * Add job to status display
     */
    function addJobToStatusDisplay(jobId, modelType, status) {
        const jobsContainer = document.getElementById('status-jobs');
        if (!jobsContainer) return;

        // Remove existing job if present
        const existing = document.getElementById(`job-${jobId}`);
        if (existing) {
            existing.remove();
        }

        // Create job status element
        const jobEl = document.createElement('div');
        jobEl.className = 'status-job';
        jobEl.id = `job-${jobId}`;
        jobEl.innerHTML = `
            <div class="job-header">
                <span class="job-model">${modelType.toUpperCase()}</span>
                <span class="job-status status-${status}">${formatStatus(status)}</span>
            </div>
            <div class="job-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
            <div class="job-details">
                <span class="job-id">Job ID: ${jobId.substring(0, 8)}...</span>
                <span class="job-time">${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        jobsContainer.prepend(jobEl);
    }

    /**
     * Update job status in display
     */
    function updateJobStatus(jobId, update) {
        const jobEl = document.getElementById(`job-${jobId}`);
        if (!jobEl) return;

        const statusEl = jobEl.querySelector('.job-status');
        const progressEl = jobEl.querySelector('.progress-fill');
        
        if (statusEl) {
            statusEl.className = `job-status status-${update.status}`;
            statusEl.textContent = formatStatus(update.status);
        }

        if (progressEl && update.progress !== undefined) {
            progressEl.style.width = `${update.progress}%`;
        }

        // Add error message if failed
        if (update.status === 'failed' && update.error) {
            const detailsEl = jobEl.querySelector('.job-details');
            if (detailsEl) {
                detailsEl.innerHTML += `<div class="job-error">${update.error}</div>`;
            }
        }

        // Add results summary if completed
        if (update.status === 'completed' && update.resultsSummary) {
            const detailsEl = jobEl.querySelector('.job-details');
            if (detailsEl) {
                detailsEl.innerHTML += `<div class="job-results">Found ${update.resultsSummary.totalPicks} picks</div>`;
            }
        }
    }

    /**
     * Format status for display
     */
    function formatStatus(status) {
        const statusMap = {
            'queued': 'Queued',
            'running': 'Running',
            'completed': 'Completed',
            'failed': 'Failed',
            'timeout': 'Timeout',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    /**
     * Setup global status event listener
     */
    function setupGlobalStatusListener() {
        window.addEventListener('modelStatusUpdate', (event) => {
            const update = event.detail;
            console.log('[ModelUI] Global status update:', update);
            
            // Update any active job displays
            if (update.jobId) {
                updateJobStatus(update.jobId, update);
            }
        });
    }

    /**
     * Refresh picks for a specific model
     */
    function refreshPicksForModel(modelType) {
        console.log(`[ModelUI] Refreshing picks for ${modelType}`);
        
        // Try to use UnifiedPicksFetcher if available
        if (window.UnifiedPicksFetcher && window.UnifiedPicksFetcher.fetchPicks) {
            window.UnifiedPicksFetcher.fetchPicks(modelType, 'today').then(result => {
                console.log(`[ModelUI] Fetched ${result.picks?.length || 0} picks for ${modelType}`);
                
                // Trigger refresh of picks table if available
                if (window.PicksTableManager && window.PicksTableManager.refresh) {
                    window.PicksTableManager.refresh();
                }
            }).catch(error => {
                console.error(`[ModelUI] Error fetching picks for ${modelType}:`, error);
            });
        }
        
        // Show success notification
        showNotification(`${modelType.toUpperCase()} analysis completed. Refreshing picks...`, 'success');
    }

    /**
     * Show notification message
     */
    function showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.NotificationManager && window.NotificationManager.show) {
            window.NotificationManager.show(message, type);
            return;
        }
        
        // Fallback to simple notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    /**
     * Add dynamic styles for model controls
     */
    function addModelControlStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Model Controls Section */
            .model-controls-section {
                padding: 15px 0;
                border-top: 1px solid var(--border-color, #e0e0e0);
                margin-top: 10px;
            }
            
            .model-controls {
                display: flex;
                align-items: center;
                gap: 20px;
            }
            
            .model-controls-label {
                font-weight: 600;
                color: var(--text-secondary, #666);
            }
            
            .model-control-buttons {
                display: flex;
                gap: 10px;
            }
            
            .model-btn {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 8px 15px;
                background: var(--bg-secondary, #f5f5f5);
                border: 1px solid var(--border-color, #ddd);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .model-btn:hover {
                background: var(--primary-color, #007bff);
                color: white;
                transform: translateY(-1px);
            }
            
            .model-btn.loading {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            .model-btn .spinner {
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            /* Status Display */
            .execution-status {
                margin-top: 15px;
                padding: 15px;
                background: var(--bg-secondary, #f8f9fa);
                border: 1px solid var(--border-color, #dee2e6);
                border-radius: 8px;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .execution-status.active {
                animation: slideDown 0.3s ease;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--border-color, #dee2e6);
            }
            
            .status-title {
                font-weight: 600;
                font-size: 14px;
            }
            
            .status-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                opacity: 0.5;
            }
            
            .status-close:hover {
                opacity: 1;
            }
            
            /* Job Status Items */
            .status-job {
                padding: 10px;
                margin-bottom: 10px;
                background: white;
                border: 1px solid var(--border-color, #e0e0e0);
                border-radius: 6px;
            }
            
            .job-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            
            .job-model {
                font-weight: 600;
                font-size: 12px;
            }
            
            .job-status {
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
            }
            
            .status-queued {
                background: #ffc107;
                color: #000;
            }
            
            .status-running {
                background: #17a2b8;
                color: white;
            }
            
            .status-completed {
                background: #28a745;
                color: white;
            }
            
            .status-failed {
                background: #dc3545;
                color: white;
            }
            
            .job-progress {
                margin: 8px 0;
            }
            
            .progress-bar {
                height: 4px;
                background: var(--bg-secondary, #e9ecef);
                border-radius: 2px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: var(--primary-color, #007bff);
                transition: width 0.3s ease;
            }
            
            .job-details {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--text-muted, #6c757d);
            }
            
            .job-error {
                margin-top: 5px;
                padding: 5px;
                background: #f8d7da;
                color: #721c24;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .job-results {
                margin-top: 5px;
                padding: 5px;
                background: #d4edda;
                color: #155724;
                border-radius: 4px;
                font-size: 12px;
            }
        `;
        
        document.head.appendChild(style);
    }

    console.log('[ModelUI] Module loaded');

})();
