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
                    this.resetForm();
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

            if (!textPicks && !file) {
                alert('Please enter picks or upload a file.');
                return;
            }

            // Simulate upload process
            const originalText = this.submitBtn.textContent;
            this.submitBtn.textContent = 'Uploading...';
            this.submitBtn.disabled = true;

            try {
                // TODO: Implement actual API call here
                // For now, just simulate a delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                console.log('Uploading picks:', { text: textPicks, file: file ? file.name : null });
                
                // Success feedback
                this.submitBtn.textContent = 'Success!';
                this.submitBtn.style.background = '#00ffaa';
                
                setTimeout(() => {
                    this.resetForm();
                }, 2000);

            } catch (error) {
                console.error('Upload failed:', error);
                this.submitBtn.textContent = 'Error';
                this.submitBtn.style.background = '#ff5570';
                
                setTimeout(() => {
                    this.submitBtn.textContent = originalText;
                    this.submitBtn.disabled = false;
                    this.submitBtn.style.background = ''; // Reset to CSS default
                }, 2000);
            }
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
