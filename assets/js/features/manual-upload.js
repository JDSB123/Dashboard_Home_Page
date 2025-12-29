/**
 * Manual Upload Feature
 * Handles file upload, drag & drop, and paste functionality for manual picks
 */

(function() {
    'use strict';

    class ManualUploadManager {
        constructor() {
            this.dropZone = document.getElementById('manual-upload-drop-zone');
            this.fileInput = document.getElementById('manual-upload-file');
            this.browseBtn = document.querySelector('.upload-browse-btn');
            this.textArea = document.querySelector('.manual-picks-input');
            this.submitBtn = document.querySelector('.manual-submit-btn-header');
            this.clearBtn = document.querySelector('.manual-clear-btn-header');
            this.sportsbookSelect = document.getElementById('manual-sportsbook-select');
            
            if (this.dropZone) {
                this.init();
            }
        }

        init() {
            this.setupDragAndDrop();
            this.setupFileSelection();
            this.setupPaste();
            this.setupSubmit();
            this.setupClear();
        }

        setupDragAndDrop() {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                this.dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                this.dropZone.addEventListener(eventName, () => {
                    this.dropZone.classList.add('drag-over');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                this.dropZone.addEventListener(eventName, () => {
                    this.dropZone.classList.remove('drag-over');
                }, false);
            });

            this.dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                this.handleFiles(files);
            }, false);
        }

        setupFileSelection() {
            this.browseBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent dropdown from closing
                this.fileInput.click();
            });

            this.fileInput.addEventListener('change', (e) => {
                this.handleFiles(this.fileInput.files);
            });
            
            // Prevent clicks on the dropzone from bubbling up if they aren't on the button
            this.dropZone.addEventListener('click', (e) => {
                if (e.target !== this.browseBtn) {
                    e.stopPropagation();
                    this.fileInput.click();
                }
            });
        }

        setupPaste() {
            // Handle paste on the textarea
            this.textArea.addEventListener('paste', (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                let blob = null;

                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        blob = items[i].getAsFile();
                        e.preventDefault(); // Prevent pasting the image binary text
                        this.handleFiles([blob]);
                        break;
                    }
                }
            });
            
            // Also handle global paste when dropdown is open? 
            // Maybe too aggressive. Let's stick to textarea or dropzone focus.
        }

        setupSubmit() {
            this.submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.uploadPicks();
            });
        }

        setupClear() {
            if (this.clearBtn) {
                this.clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // If there's content in the form, just clear the form
                    if (this.textArea.value.trim() || this.selectedFile) {
                        this.resetForm();
                        return;
                    }
                    
                    // Otherwise, offer to clear all picks
                    if (confirm('Clear ALL saved picks from the dashboard?')) {
                        if (window.LocalPicksManager?.clear) {
                            window.LocalPicksManager.clear();
                            console.log('✅ Cleared all picks');
                        }
                    }
                });
            }
        }

        handleFiles(files) {
            if (files.length > 0) {
                const file = files[0];
                // Update UI to show file selected
                const textEl = this.dropZone.querySelector('.drop-zone-text');
                textEl.textContent = `Selected: ${file.name}`;
                textEl.style.color = '#00ffaa';
                
                // Store file for upload
                this.selectedFile = file;
            }
        }

        async uploadPicks() {
            const textPicks = this.textArea.value.trim();
            const file = this.selectedFile;
            const sportsbook = this.sportsbookSelect?.value || '';

            if (!sportsbook) {
                alert('Please select a sportsbook first.');
                this.sportsbookSelect?.focus();
                return;
            }

            if (!textPicks && !file) {
                alert('Please enter picks or upload a file.');
                return;
            }

            const originalText = this.submitBtn.textContent;
            this.submitBtn.textContent = 'Processing...';
            this.submitBtn.disabled = true;

            try {
                let content = textPicks;
                
                // If a file was selected, read its contents
                if (file && !textPicks) {
                    content = await this.readFileContent(file);
                }
                
                console.log('Processing picks:', { content: content.substring(0, 200), file: file ? file.name : null });
                
                // Use LocalPicksManager to parse and save picks with sportsbook
                const selectedBookMeta = {
                    value: sportsbook,
                    label: this.sportsbookSelect?.options[this.sportsbookSelect.selectedIndex]?.textContent?.trim() || sportsbook
                };

                const addedPicks = window.LocalPicksManager?.parseAndAdd
                    ? await window.LocalPicksManager.parseAndAdd(content, selectedBookMeta.label)
                    : window.processAndSavePicks
                        ? await window.processAndSavePicks(content, false, selectedBookMeta)
                        : null;
                
                if (!addedPicks) {
                    throw new Error('Pick processing not available. Please refresh the page.');
                }
                
                if (!addedPicks || addedPicks.length === 0) {
                    throw new Error('No picks could be parsed from the input. Please check the format.');
                }
                
                console.log(`✅ Successfully added ${addedPicks.length} picks`);
                
                // Success feedback
                this.submitBtn.textContent = `Added ${addedPicks.length} picks!`;
                this.submitBtn.style.background = '#00ffaa';
                
                setTimeout(() => {
                    this.resetForm();
                }, 2000);
                
                // Clear sportsbook selection after successful upload
                if (this.sportsbookSelect) {
                    this.sportsbookSelect.value = '';
                }

            } catch (error) {
                console.error('Upload failed:', error);
                this.submitBtn.textContent = 'Error';
                this.submitBtn.style.background = '#ff5570';
                alert(error.message || 'Failed to process picks. Please try again.');
                
                setTimeout(() => {
                    this.submitBtn.textContent = originalText;
                    this.submitBtn.disabled = false;
                    this.submitBtn.style.background = ''; // Reset to CSS default
                }, 2000);
            }
        }
        
        readFileContent(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            });
        }

        resetForm() {
            this.textArea.value = '';
            this.selectedFile = null;
            this.fileInput.value = '';
            
            const textEl = this.dropZone.querySelector('.drop-zone-text');
            textEl.textContent = 'Drag & Drop or Paste Image';
            textEl.style.color = '';
            
            this.submitBtn.textContent = 'Upload Picks';
            this.submitBtn.disabled = false;
            this.submitBtn.style.background = '';
        }
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        new ManualUploadManager();
    });

})();
