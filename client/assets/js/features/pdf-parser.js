/**
 * PDF Parser for Pick Uploads v1.0.0
 * Extracts text from PDF files using pdf.js
 * Parses extracted text using the existing PickParser
 */

(function() {
    'use strict';

    // pdf.js library URL (Mozilla's official CDN)
    const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let pdfjsLoaded = false;

    class PDFParser {
        constructor() {
            this.isProcessing = false;
        }

        /**
         * Ensure pdf.js library is loaded
         */
        async ensureLibraryLoaded() {
            if (pdfjsLoaded && window.pdfjsLib) {
                return true;
            }

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = PDFJS_CDN;
                script.onload = () => {
                    // Configure worker
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
                    pdfjsLoaded = true;
                    console.log('pdf.js library loaded');
                    resolve(true);
                };
                script.onerror = () => {
                    reject(new Error('Failed to load pdf.js library'));
                };
                document.head.appendChild(script);
            });
        }

        /**
         * Extract text from a PDF file
         * @param {File} file - PDF file object
         * @returns {Promise<string>} - Extracted text
         */
        async extractText(file) {
            if (!file || file.type !== 'application/pdf') {
                throw new Error('Invalid PDF file');
            }

            await this.ensureLibraryLoaded();

            this.isProcessing = true;

            try {
                // Read file as ArrayBuffer
                const arrayBuffer = await this._readFileAsArrayBuffer(file);

                // Load PDF document
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                console.log(`PDF loaded: ${pdf.numPages} pages`);

                // Extract text from all pages
                let fullText = '';
                
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    // Concatenate text items
                    const pageText = textContent.items
                        .map(item => item.str)
                        .join(' ');
                    
                    fullText += pageText + '\n\n';
                }

                return fullText.trim();

            } finally {
                this.isProcessing = false;
            }
        }

        /**
         * Extract and parse picks from PDF
         * @param {File} file - PDF file object
         * @returns {Promise<Array>} - Parsed picks
         */
        async extractAndParsePicks(file) {
            const text = await this.extractText(file);

            if (!text) {
                return { picks: [], rawText: '', error: 'No text extracted from PDF' };
            }

            console.log('Extracted PDF text:', text.substring(0, 500) + '...');

            // Use existing PickParser if available
            if (window.PickParser) {
                const picks = window.PickParser.parseText(text);
                return { picks, rawText: text };
            }

            // Basic parsing fallback
            return { picks: this._basicParsing(text), rawText: text };
        }

        /**
         * Basic pick parsing fallback if PickParser not available
         */
        _basicParsing(text) {
            const picks = [];
            const lines = text.split('\n').filter(l => l.trim());

            // Look for common patterns in sportsbook bet slips
            // Pattern: Team Name +/-Spread or Over/Under
            const spreadPattern = /([A-Za-z\s]+)\s+([+-]?\d+\.?\d*)/g;
            const ouPattern = /(over|under)\s+(\d+\.?\d*)/gi;
            const mlPattern = /([A-Za-z\s]+)\s+(ML|moneyline)\s*([+-]\d+)?/gi;

            lines.forEach(line => {
                let match;
                
                // Check for spread picks
                while ((match = spreadPattern.exec(line)) !== null) {
                    const team = match[1].trim();
                    const spread = parseFloat(match[2]);
                    
                    if (team.length > 2 && !isNaN(spread)) {
                        picks.push({
                            team,
                            market: 'spread',
                            line: spread,
                            rawLine: line
                        });
                    }
                }

                // Check for O/U picks
                while ((match = ouPattern.exec(line)) !== null) {
                    picks.push({
                        market: match[1].toLowerCase(),
                        line: parseFloat(match[2]),
                        rawLine: line
                    });
                }
            });

            return picks;
        }

        /**
         * Read file as ArrayBuffer
         */
        _readFileAsArrayBuffer(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(file);
            });
        }

        /**
         * Check if file is a PDF
         */
        isPDF(file) {
            return file && (
                file.type === 'application/pdf' ||
                file.name.toLowerCase().endsWith('.pdf')
            );
        }
    }

    // Create singleton instance
    window.PDFParser = new PDFParser();

})();
