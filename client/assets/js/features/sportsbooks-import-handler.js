/**
 * Enhanced Sportsbooks Import Handler v1.0.0
 * Handles manual paste/upload in the sportsbooks dropdown (Option B)
 * Uses PickParser to support multiple formats
 */

(function() {
    'use strict';

    function initSportsbooksImport() {
        // Attach event listeners after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachImportHandlers);
        } else {
            attachImportHandlers();
        }
    }

    /**
     * Attach all event handlers for import functionality
     */
    function attachImportHandlers() {
        // Paste button handler
        const uploadPasteBtn = document.getElementById('upload-paste-btn');
        if (uploadPasteBtn) {
            uploadPasteBtn.addEventListener('click', handlePasteImport);
        }

        // Clear button handler
        const clearBtn = document.querySelector('.paste-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                document.getElementById('paste-area').value = '';
            });
        }

        // File upload handlers
        const fileUpload = document.getElementById('file-upload');
        const dropZone = document.getElementById('drop-zone');
        const uploadFilesBtn = document.getElementById('upload-files-btn');

        if (fileUpload) {
            fileUpload.addEventListener('change', handleFileSelect);
        }

        if (dropZone) {
            // Drag and drop
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('dragleave', handleDragLeave);
            dropZone.addEventListener('drop', handleFileDrop);
        }

        if (uploadFilesBtn) {
            uploadFilesBtn.addEventListener('click', handleFileUpload);
        }

        // Back button
        const backBtn = document.querySelector('.import-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', closeImportOptions);
        }
    }

    /**
     * Handle pasted text input
     */
    function handlePasteImport() {
        const pasteArea = document.getElementById('paste-area');
        const text = pasteArea.value.trim();

        if (!text) {
            showStatus('Please paste pick text first', 'warning');
            return;
        }

        // Determine league from text if possible
        const detectedLeague = detectLeagueFromText(text);

        // Parse picks using universal parser
        const picks = window.PickParser?.parseText(text, detectedLeague) || [];

        if (picks.length === 0) {
            showStatus('❌ Could not parse any picks from the text', 'error');
            return;
        }

        // Show parsed picks for review
        showParsedPicksReview(picks, 'pasted');
    }

    /**
     * Detect league from text (NBA, NFL, etc.)
     */
    function detectLeagueFromText(text) {
        const upper = text.toUpperCase();
        if (upper.includes('NBA') || upper.includes('LAKERS') || upper.includes('CELTICS')) return 'NBA';
        if (upper.includes('NFL') || upper.includes('CHIEFS') || upper.includes('COWBOYS')) return 'NFL';
        if (upper.includes('NCAAM') || upper.includes('NCAA')) return 'NCAAM';
        if (upper.includes('NCAAF') || upper.includes('COLLEGE')) return 'NCAAF';
        return null;
    }

    /**
     * Handle file drop
     */
    function handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('drop-zone').classList.remove('dragover');

        const files = e.dataTransfer.files;
        handleFiles(files);
    }

    /**
     * Handle drag over
     */
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('drop-zone').classList.add('dragover');
    }

    /**
     * Handle drag leave
     */
    function handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('drop-zone').classList.remove('dragover');
    }

    /**
     * Handle file select from input
     */
    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    /**
     * Process selected files
     */
    function handleFiles(files) {
        if (!files || files.length === 0) return;

        const fileList = document.getElementById('file-list');
        const uploadBtn = document.getElementById('upload-files-btn');

        fileList.innerHTML = '';

        Array.from(files).forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.innerHTML = `
                <div class="file-item-name">${file.name}</div>
                <div class="file-item-size">${(file.size / 1024).toFixed(2)} KB</div>
            `;
            fileList.appendChild(item);

            // Store file reference
            item.dataset.fileIndex = idx;
            item._file = file;
        });

        uploadBtn.style.display = 'block';
    }

    /**
     * Handle file upload/processing
     */
    async function handleFileUpload() {
        const fileList = document.getElementById('file-list');
        const files = Array.from(fileList.querySelectorAll('.file-list-item'))
            .map(item => item._file)
            .filter(f => f);

        if (files.length === 0) {
            showStatus('No files selected', 'warning');
            return;
        }

        showStatus('Processing files...', 'info');

        const allPicks = [];

        for (const file of files) {
            try {
                const picks = await processFile(file);
                allPicks.push(...picks);
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showStatus(`Error processing ${file.name}`, 'error');
            }
        }

        if (allPicks.length === 0) {
            showStatus('❌ No picks found in files', 'error');
            return;
        }

        // Show picks for review
        showParsedPicksReview(allPicks, 'uploaded');
    }

    /**
     * Process individual file
     */
    async function processFile(file) {
        const text = await file.text();

        // Handle different file types
        if (file.type.includes('image')) {
            return processTelegramScreenshot(text);
        } else if (file.type.includes('pdf')) {
            return processPDF(text);
        } else if (file.name.includes('.csv')) {
            return window.PickParser?.parseCSV(text) || [];
        } else {
            // Treat as plain text
            return window.PickParser?.parseText(text) || [];
        }
    }

    /**
     * Process Telegram screenshot text
     */
    function processTelegramScreenshot(text) {
        // Telegram screenshots often have metadata we can parse
        return window.PickParser?.parseText(text) || [];
    }

    /**
     * Process PDF (simple text extraction)
     */
    function processPDF(text) {
        // PDFs extracted as text
        return window.PickParser?.parseText(text) || [];
    }

    /**
     * Show parsed picks for review before adding to dashboard
     */
    function showParsedPicksReview(picks, source = 'manual') {
        // Remove existing review if any
        const existing = document.getElementById('picks-review-modal');
        if (existing) existing.remove();

        // Create review modal
        const modal = document.createElement('div');
        modal.id = 'picks-review-modal';
        modal.className = 'picks-review-modal-overlay';
        modal.innerHTML = `
            <div class="picks-review-modal">
                <div class="modal-header">
                    <h2>Review Parsed Picks (${picks.length})</h2>
                    <button type="button" class="modal-close" aria-label="Close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="picks-review-list" id="picks-review-list"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="review-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="review-confirm">Add All to Dashboard</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Populate picks list
        const listContainer = modal.querySelector('#picks-review-list');
        picks.forEach((pick, idx) => {
            const item = document.createElement('div');
            item.className = 'review-pick-item';
            item.innerHTML = `
                <div class="review-pick-header">
                    <input type="checkbox" class="review-pick-checkbox" data-index="${idx}" checked>
                    <div class="review-pick-summary">
                        <div class="review-pick-league">${pick.league || '?'}</div>
                        <div class="review-pick-matchup">${pick.matchup || 'Unknown'}</div>
                    </div>
                </div>
                <div class="review-pick-details">
                    <div class="detail"><strong>Pick:</strong> ${pick.pick}</div>
                    <div class="detail"><strong>Odds:</strong> ${pick.odds}</div>
                    <div class="detail"><strong>Risk:</strong> $${pick.risk}</div>
                    <div class="detail"><strong>Segment:</strong> ${pick.segment}</div>
                </div>
            `;
            listContainer.appendChild(item);
        });

        // Attach handlers
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#review-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#review-confirm').addEventListener('click', () => {
            confirmAndAddPicks(picks, modal);
        });

        modal.style.display = 'flex';
    }

    /**
     * Confirm and add selected picks to dashboard
     */
    function confirmAndAddPicks(allPicks, modal) {
        const checkboxes = modal.querySelectorAll('.review-pick-checkbox:checked');
        const selectedPicks = [];

        checkboxes.forEach(checkbox => {
            const idx = parseInt(checkbox.dataset.index);
            const pick = allPicks[idx];
            if (pick) {
                selectedPicks.push({
                    ...pick,
                    source: 'manual-import',
                    timestamp: new Date().toISOString(),
                    status: 'pending'
                });
            }
        });

        if (selectedPicks.length === 0) {
            showStatus('No picks selected', 'warning');
            return;
        }

        // Add to dashboard
        if (window.LocalPicksManager) {
            window.LocalPicksManager.addPicks(selectedPicks);
            showStatus(`✅ Added ${selectedPicks.length} picks to dashboard`, 'success', 3000);
            modal.remove();
            closeImportOptions();
        } else {
            showStatus('❌ LocalPicksManager not found', 'error');
        }
    }

    /**
     * Show status message
     */
    function showStatus(message, type = 'info', duration = 2000) {
        const statusEl = document.getElementById('upload-status');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `upload-status status-${type}`;

        if (duration) {
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = '';
            }, duration);
        }
    }

    /**
     * Close import options
     */
    function closeImportOptions() {
        const importOptions = document.getElementById('import-options');
        if (importOptions) {
            importOptions.hidden = true;
        }
    }

    // Initialize
    initSportsbooksImport();

})();
