/**
 * Image OCR Parser v1.0.0
 * Extracts text from images using Azure Computer Vision or Tesseract.js fallback
 * 
 * Supports: PNG, JPG, JPEG, GIF, BMP, WEBP
 */

(function() {
    'use strict';

    // Azure Computer Vision endpoint (configure in APP_CONFIG)
    const getAzureEndpoint = () => {
        const base = window.APP_CONFIG?.AZURE_VISION_ENDPOINT || 
                     window.APP_CONFIG?.FUNCTIONS_BASE_URL;
        return base ? `${base}/api/ocr` : '/api/ocr';
    };

    // Tesseract.js CDN for fallback
    const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';

    let tesseractLoaded = false;

    class ImageOCRParser {
        constructor() {
            this.isProcessing = false;
            this.useAzure = true; // Prefer Azure, fallback to Tesseract
        }

        /**
         * Extract text from an image file
         * @param {File} file - Image file object
         * @returns {Promise<Object>} - { text, confidence, method }
         */
        async extractText(file) {
            if (!this.isImage(file)) {
                throw new Error('Invalid image file');
            }

            this.isProcessing = true;

            try {
                // Try Azure Computer Vision first
                if (this.useAzure) {
                    try {
                        return await this._extractWithAzure(file);
                    } catch (azureError) {
                        console.warn('Azure OCR failed, falling back to Tesseract:', azureError);
                    }
                }

                // Fallback to Tesseract.js (client-side)
                return await this._extractWithTesseract(file);

            } finally {
                this.isProcessing = false;
            }
        }

        /**
         * Extract text using Azure Computer Vision
         */
        async _extractWithAzure(file) {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(getAzureEndpoint(), {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Azure OCR failed: ${response.status}`);
            }

            const result = await response.json();

            return {
                text: result.text || '',
                confidence: result.confidence || 0,
                method: 'azure',
                regions: result.regions || []
            };
        }

        /**
         * Extract text using Tesseract.js (client-side OCR)
         */
        async _extractWithTesseract(file) {
            await this._ensureTesseractLoaded();

            // Show progress indicator
            this._showProgress('Analyzing image...');

            try {
                const imageUrl = URL.createObjectURL(file);

                const result = await Tesseract.recognize(imageUrl, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            const pct = Math.round(m.progress * 100);
                            this._showProgress(`Extracting text... ${pct}%`);
                        }
                    }
                });

                URL.revokeObjectURL(imageUrl);

                return {
                    text: result.data.text || '',
                    confidence: result.data.confidence || 0,
                    method: 'tesseract',
                    words: result.data.words || []
                };

            } finally {
                this._hideProgress();
            }
        }

        /**
         * Ensure Tesseract.js is loaded
         */
        async _ensureTesseractLoaded() {
            if (tesseractLoaded && window.Tesseract) {
                return true;
            }

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = TESSERACT_CDN;
                script.onload = () => {
                    tesseractLoaded = true;
                    console.log('Tesseract.js loaded');
                    resolve(true);
                };
                script.onerror = () => {
                    reject(new Error('Failed to load Tesseract.js'));
                };
                document.head.appendChild(script);
            });
        }

        /**
         * Extract and parse picks from image
         * @param {File} file - Image file object
         * @returns {Promise<Object>} - { picks, rawText, method }
         */
        async extractAndParsePicks(file) {
            const result = await this.extractText(file);

            if (!result.text) {
                return { 
                    picks: [], 
                    rawText: '', 
                    error: 'No text extracted from image',
                    method: result.method 
                };
            }

            console.log(`OCR extracted (${result.method}):`, result.text.substring(0, 300) + '...');

            // Use existing PickParser if available
            if (window.PickParser) {
                const picks = window.PickParser.parseText(result.text);
                return { 
                    picks, 
                    rawText: result.text, 
                    confidence: result.confidence,
                    method: result.method 
                };
            }

            return { 
                picks: [], 
                rawText: result.text,
                confidence: result.confidence,
                method: result.method 
            };
        }

        /**
         * Check if file is an image
         */
        isImage(file) {
            if (!file) return false;
            
            const imageTypes = [
                'image/png', 
                'image/jpeg', 
                'image/jpg', 
                'image/gif', 
                'image/bmp', 
                'image/webp'
            ];
            
            return imageTypes.includes(file.type) || 
                   /\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name);
        }

        /**
         * Show OCR progress indicator
         */
        _showProgress(message) {
            let indicator = document.getElementById('ocr-progress-indicator');
            
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'ocr-progress-indicator';
                indicator.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.85);
                    color: #fff;
                    padding: 24px 40px;
                    border-radius: 12px;
                    font-size: 16px;
                    z-index: 10001;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                `;
                document.body.appendChild(indicator);
            }

            indicator.innerHTML = `
                <div style="margin-bottom: 10px;">📷 Image OCR</div>
                <div>${message}</div>
            `;
            indicator.style.display = 'block';
        }

        /**
         * Hide OCR progress indicator
         */
        _hideProgress() {
            const indicator = document.getElementById('ocr-progress-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    }

    // Create singleton instance
    window.ImageOCRParser = new ImageOCRParser();

})();
