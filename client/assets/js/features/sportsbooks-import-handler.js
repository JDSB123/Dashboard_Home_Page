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
     * Pass raw text directly to parseAndAdd (same as manual-upload.js)
     */
    function handlePasteImport() {
        const pasteArea = document.getElementById('paste-area');
        const rawText = pasteArea.value.trim();

        if (!rawText) {
            showStatus('Please paste pick text first', 'warning');
            return;
        }

        console.log('Raw pasted text:', rawText);
        
        // Show review modal with raw text
        // Actual parsing happens via parseAndAdd when user confirms
        showParsedPicksReview([], 'paste', rawText);
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
        // Handle different file types with proper parsers
        if (file.type.includes('image') || /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)) {
            // Use OCR parser for images
            if (window.ImageOCRParser) {
                showStatus('Running OCR on image...', 'info');
                const result = await window.ImageOCRParser.extractAndParsePicks(file);
                return result.picks || [];
            }
            return [];
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            // Use PDF parser
            if (window.PDFParser) {
                showStatus('Extracting text from PDF...', 'info');
                const result = await window.PDFParser.extractAndParsePicks(file);
                return result.picks || [];
            }
            return [];
        } else if (file.name.endsWith('.csv')) {
            const text = await file.text();
            return window.PickParser?.parseCSV(text) || [];
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Excel files - read as text for now
            showStatus('Excel support coming soon', 'warning');
            return [];
        } else if (file.type.includes('html') || file.name.endsWith('.html')) {
            const text = await file.text();
            // Strip HTML tags and parse as text
            const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            return window.PickParser?.parseText(plainText) || [];
        } else {
            // Treat as plain text (txt, etc.)
            const text = await file.text();
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
     * The actual parsing happens via parseAndAdd (after user confirms)
     */
    function showParsedPicksReview(picks, source = 'manual', rawText = '') {
        // If we don't have raw text, reconstruct from picks
        if (!rawText && picks.length > 0 && picks[0].pick) {
            rawText = picks.map(p => `${p.pick} ${p.odds} $${p.risk}`).join('\n');
        }

        // For now, just pass the raw text directly to parseAndAdd
        // This avoids double-parsing and uses the same PickStandardizer as manual-upload.js
        if (!rawText) {
            showStatus('No pick text to process', 'error');
            return;
        }

        // Create a simple preview modal
        const existing = document.getElementById('picks-review-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'picks-review-modal';
        modal.className = 'picks-review-modal-overlay';
        modal.innerHTML = `
            <div class="picks-review-modal">
                <div class="modal-header">
                    <h2>Add Picks to Dashboard</h2>
                    <button type="button" class="modal-close" aria-label="Close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="picks-preview-text" style="background:#f5f5f5; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; max-height:300px; overflow-y:auto; border:1px solid #ddd; white-space:pre-wrap; word-break:break-word;">
${escapeHtml(rawText)}
                    </div>
                    <div style="margin-top:10px; font-size:12px; color:#666;">
                        Picks will be parsed and added to your dashboard with automatic game data enrichment.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="review-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="review-confirm">Add to Dashboard</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Attach handlers
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#review-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#review-confirm').addEventListener('click', () => {
            confirmAndAddPicksFromText(rawText, modal);
        });

        modal.style.display = 'flex';
    }

    /**
     * Escape HTML entities for safe display
     */
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Add picks from raw text using parseAndAdd (matches manual-upload.js behavior)
     */
    function confirmAndAddPicksFromText(rawText, modal) {
        if (!rawText.trim()) {
            showStatus('No picks to add', 'warning');
            return;
        }

        // Use the SAME parseAndAdd function as manual-upload.js (dashboard.html)
        // This ensures: parsing, enrichment, and prevents stale data mixing
        if (window.LocalPicksManager?.parseAndAdd) {
            window.LocalPicksManager.parseAndAdd(rawText, 'Sportsbooks Import')
                .then(added => {
                    if (added && added.length > 0) {
                        showStatus(`✅ Added ${added.length} picks to dashboard`, 'success', 3000);
                        modal.remove();
                        closeImportOptions();
                        clearPasteArea();
                    } else {
                        showStatus('❌ No valid picks found', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error adding picks:', error);
                    showStatus(`❌ Error: ${error.message}`, 'error');
                });
        } else {
            showStatus('❌ LocalPicksManager not available', 'error');
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

    /**
     * Clear the paste area
     */
    function clearPasteArea() {
        const pasteArea = document.getElementById('paste-area');
        if (pasteArea) {
            pasteArea.value = '';
        }
    }

    // Initialize
    initSportsbooksImport();

})();
