/**
 * Import Options Handler - Upload via API
 * Uploads files and pasted content through Azure Functions API
 */

// Use API endpoint instead of direct blob storage
const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || '/api';

let selectedFiles = [];

// Security: Allowed file types and max size
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.html', '.htm', '.txt', '.csv'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'text/html', 'text/plain', 'text/csv'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

function isFileAllowed(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeAllowed = ALLOWED_MIME_TYPES.some(mime => file.type.startsWith(mime.split('/')[0]) || file.type === mime);
    const isSizeAllowed = file.size <= MAX_FILE_SIZE;
    return { valid: isExtAllowed && isSizeAllowed, ext, size: file.size, isSizeAllowed, isExtAllowed };
}

document.addEventListener('DOMContentLoaded', () => {
    const actionButtons = document.getElementById('action-buttons');
    const importOptions = document.getElementById('import-options');
    const importBtn = document.querySelector('.import-picks-btn');
    const backBtn = document.querySelector('.import-back-btn');

    if (!actionButtons || !importOptions || !importBtn) return;

    // Show/hide import options
    function showImportOptions() {
        actionButtons.style.display = 'none';
        importOptions.removeAttribute('hidden');
    }

    function hideImportOptions() {
        importOptions.setAttribute('hidden', '');
        actionButtons.style.display = 'flex';
        resetUploadForm();
    }

    function resetUploadForm() {
        selectedFiles = [];
        const fileInput = document.getElementById('file-upload');
        const pasteArea = document.getElementById('paste-area');
        const fileList = document.getElementById('file-list');
        const uploadBtn = document.getElementById('upload-files-btn');
        const statusDiv = document.getElementById('upload-status');

        if (fileInput) fileInput.value = '';
        if (pasteArea) pasteArea.value = '';
        if (fileList) {
            fileList.innerHTML = '';
            fileList.style.display = 'none';
        }
        if (uploadBtn) uploadBtn.style.display = 'none';
        if (statusDiv) statusDiv.style.display = 'none';
    }

    importBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showImportOptions();
    });

    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideImportOptions();
        });
    }

    // File upload handling
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-upload');
    const fileList = document.getElementById('file-list');
    const uploadFilesBtn = document.getElementById('upload-files-btn');

    if (dropZone && fileInput) {
        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = '#10b981';
                dropZone.style.background = 'rgba(16, 185, 129, 0.05)';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = '';
                dropZone.style.background = '';
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });
    }

    function handleFiles(files) {
        const validFiles = [];
        const rejected = [];

        Array.from(files).forEach(file => {
            const check = isFileAllowed(file);
            if (check.valid) {
                validFiles.push(file);
            } else {
                const reason = !check.isExtAllowed
                    ? `Invalid file type (${check.ext})`
                    : `File too large (${formatFileSize(check.size)} > ${MAX_FILE_SIZE_MB}MB)`;
                rejected.push({ name: file.name, reason });
            }
        });

        if (rejected.length > 0) {
            const rejectMsg = rejected.map(r => `${r.name}: ${r.reason}`).join('\n');
            console.warn('Rejected files:', rejectMsg);
            showStatus(`Some files rejected:\n${rejected.map(r => r.name).join(', ')}`, 'error');
        }

        selectedFiles = validFiles;
        renderFileList();
    }

    function renderFileList() {
        if (selectedFiles.length === 0) {
            fileList.style.display = 'none';
            uploadFilesBtn.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        uploadFilesBtn.style.display = 'block';

        fileList.innerHTML = selectedFiles.map((file, index) => {
            const size = formatFileSize(file.size);
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(16, 185, 129, 0.05); border-radius: 4px; margin-bottom: 0.25rem;">
                    <span style="font-size: 0.75rem; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(file.name)} (${size})</span>
                    <button onclick="window.removeFile(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 0.5rem;">×</button>
                </div>
            `;
        }).join('');
    }

    // Make removeFile available globally for inline onclick
    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        renderFileList();
    };

    // Upload files button
    if (uploadFilesBtn) {
        uploadFilesBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await uploadFiles();
        });
    }

    async function uploadFiles() {
        if (selectedFiles.length === 0) return;

        uploadFilesBtn.disabled = true;
        uploadFilesBtn.textContent = 'Uploading...';

        try {
            // Upload files one by one to the API
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Failed to upload ${file.name}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`Uploaded ${file.name}:`, result);
            }

            showStatus(`Successfully uploaded ${selectedFiles.length} file(s)!`, 'success');
            selectedFiles = [];
            renderFileList();
            fileInput.value = '';

            // Process and display picks immediately
            if (window.loadUploadedPicks) {
                setTimeout(() => window.loadUploadedPicks(), 1000);
            } else if (window.loadAndAppendPicks) {
                setTimeout(() => window.loadAndAppendPicks(), 1000);
            }

            // Also try to load from database if available
            if (window.loadPicksFromDatabase) {
                setTimeout(() => window.loadPicksFromDatabase(), 1500);
            }

        } catch (error) {
            console.error('Upload error:', error);
            showStatus(`Upload failed: ${error.message}`, 'error');
        } finally {
            uploadFilesBtn.disabled = false;
            uploadFilesBtn.textContent = 'Upload Selected Files';
        }
    }

    // Paste content upload
    const pasteArea = document.getElementById('paste-area');
    const uploadPasteBtn = document.getElementById('upload-paste-btn');
    const clearBtn = document.querySelector('.paste-clear-btn');

    if (uploadPasteBtn) {
        uploadPasteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const content = pasteArea.value.trim();

            if (!content) {
                showStatus('Please paste some content first.', 'error');
                return;
            }

            uploadPasteBtn.disabled = true;
            uploadPasteBtn.textContent = 'Uploading...';

            try {
                // Detect if content is HTML or text
                const isHTML = content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('<div');

                // Use LocalPicksManager if available (local dev), otherwise use API
                const saveFn = window.LocalPicksManager?.parseAndAdd || processAndSavePicks;
                const picks = await saveFn(content, isHTML);
                
                if (picks.length === 0) {
                    showStatus('No picks could be parsed from the pasted content.', 'error');
                    return;
                }

                showStatus(`Successfully parsed and saved ${picks.length} pick(s)!`, 'success');
                pasteArea.value = '';

                // Process and display picks immediately
                if (window.loadUploadedPicks) {
                    setTimeout(() => window.loadUploadedPicks(), 1000);
                } else if (window.loadAndAppendPicks) {
                    setTimeout(() => window.loadAndAppendPicks(), 1000);
                }

                // Also try to load from database if available
                if (window.loadPicksFromDatabase) {
                    setTimeout(() => window.loadPicksFromDatabase(), 1500);
                }

            } catch (error) {
                console.error('Upload error:', error);
                showStatus(`Processing failed: ${error.message}`, 'error');
            } finally {
                uploadPasteBtn.disabled = false;
                uploadPasteBtn.textContent = 'Upload Pasted Content';
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pasteArea) pasteArea.value = '';
        });
    }

    function showStatus(message, type) {
        const statusDiv = document.getElementById('upload-status');
        if (!statusDiv) return;

        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        if (type === 'success') {
            statusDiv.style.background = 'rgba(16, 185, 129, 0.1)';
            statusDiv.style.color = '#059669';
            statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        } else {
            statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            statusDiv.style.color = '#dc2626';
            statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        }

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Function to process and save picks to database
    async function processAndSavePicks(content, isHTML = false) {
        try {
            // Parse the content to extract picks
            let picks = [];

            if (window.PickStandardizer) {
                try {
                    picks = window.PickStandardizer.standardize(content);
                    console.log('Used PickStandardizer to parse picks:', picks.length);
                } catch (e) {
                    console.warn('PickStandardizer failed, falling back to basic parser:', e);
                    picks = isHTML ? parseHTMLPicks(content) : parseTextPicks(content);
                }
            } else {
                picks = isHTML ? parseHTMLPicks(content) : parseTextPicks(content);
            }

            // Helper to derive teams from a game/description string like "Lakers @ Warriors Over"
            const deriveTeams = (pick) => {
                const source = (pick.game || pick.description || pick.pickTeam || '').trim();
                if (!source) return null;
                const match = source.match(/(.+?)\s+(?:vs\.?|@|at)\s+(.+?)(?:\s+(over|under))?$/i);
                if (!match) return null;
                return {
                    awayTeam: match[1].trim(),
                    homeTeam: match[2].trim()
                };
            };

            // Validate and enrich picks with game data using AutoGameFetcher
            if (picks.length > 0 && window.AutoGameFetcher) {
                try {
                    // Fetch today's games if not already cached
                    await window.AutoGameFetcher.fetchTodaysGames();
                    const todaysGames = window.AutoGameFetcher.getTodaysGames() || [];

                    picks = picks.filter(pick => {
                        // Derive missing teams from game/description to improve matching
                        const derivedTeams = deriveTeams(pick);
                        if (derivedTeams) {
                            if (!pick.awayTeam) pick.awayTeam = derivedTeams.awayTeam;
                            if (!pick.homeTeam) pick.homeTeam = derivedTeams.homeTeam;
                        }

                        // Find matching game
                        const game = window.AutoGameFetcher.findGame(
                            (pick.awayTeam || pick.pickTeam || '').replace(/\bover\b|\bunder\b/i, '').trim(),
                            pick.homeTeam
                        );

                        if (!game) {
                            console.warn(`Game not found for today: ${pick.game || pick.pickTeam}`);
                            return true; // Keep the pick but warn
                        }

                        // Check if game has finished
                        if (window.AutoGameFetcher.isGameFinished(game)) {
                            console.warn(`Skipping pick for finished game: ${game.awayTeam} @ ${game.homeTeam}`);
                            return false; // Remove finished games
                        }

                        // Auto-populate game info
                        pick.game = `${game.awayTeam} @ ${game.homeTeam}`;
                        pick.date = game.date;
                        pick.time = game.time;
                        pick.sport = game.sport;
                        pick.gameStatus = game.status;
                        pick.awayTeam = game.awayTeam;
                        pick.homeTeam = game.homeTeam;

                        return true;
                    });

                    console.log(`After validation: ${picks.length} valid picks remaining`);
                } catch (e) {
                    console.warn('AutoGameFetcher validation failed:', e);
                    // Continue with picks even if validation fails
                }
            }

            if (picks.length > 0) {
                // Save to database via API
                const response = await fetch(`${API_BASE_URL}/save-picks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        picks: picks,
                        source: 'upload'
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to save picks: ${response.statusText} - ${errorText}`);
                }

                const result = await response.json();
                console.log('Picks saved to database:', result);
            } else {
                console.warn('No valid picks to save after processing');
            }

            return picks;
        } catch (error) {
            console.error('Error processing picks:', error);
            throw error; // Re-throw to let caller handle
        }
    }

    // Parse HTML picks (from sportsbook)
    function parseHTMLPicks(html) {
        const picks = [];
        // Basic parsing - can be enhanced based on specific sportsbook format
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Look for common bet slip elements
        const betElements = doc.querySelectorAll('[class*="bet"], [class*="pick"], [class*="wager"]');

        betElements.forEach(element => {
            try {
                const text = element.textContent;
                const pick = parsePickFromText(text);
                if (pick) picks.push(pick);
            } catch (e) {
                console.warn('Failed to parse bet element:', e);
            }
        });

        return picks;
    }

    // Parse text picks
    function parseTextPicks(text) {
        const picks = [];
        const lines = text.split('\n');

        lines.forEach(line => {
            const pick = parsePickFromText(line);
            if (pick) picks.push(pick);
        });

        return picks;
    }

    // Parse individual pick from text
    function parsePickFromText(text) {
        // Regex patterns for common pick formats
        // Examples: "Raiders -2.5 (-110)", "Lakers/Suns O 215.5", "Cowboys ML +150"

        const spreadPattern = /([A-Za-z\s]+)\s+([-+]?\d+\.?\d*)\s+\(([-+]\d+)\)/;
        const totalPattern = /([A-Za-z\s]+)\s+(O|U|Over|Under)\s+(\d+\.?\d*)/i;
        const mlPattern = /([A-Za-z\s]+)\s+ML\s+([-+]\d+)/i;

        let match;
        let pick = null;

        if (match = text.match(spreadPattern)) {
            pick = {
                pickType: 'spread',
                pickTeam: match[1].trim(),
                line: match[2],
                odds: match[3]
            };
        } else if (match = text.match(totalPattern)) {
            pick = {
                pickType: 'total',
                pickTeam: match[2].toUpperCase() === 'O' || match[2].toLowerCase() === 'over' ? 'Over' : 'Under',
                line: match[3]
            };
        } else if (match = text.match(mlPattern)) {
            pick = {
                pickType: 'moneyline',
                pickTeam: match[1].trim(),
                odds: match[2]
            };
        }

        // Extract teams from text if possible
        if (pick) {
            const vsPattern = /([A-Za-z\s]+)\s+(vs?|@|at)\s+([A-Za-z\s]+)/i;
            const teamMatch = text.match(vsPattern);
            if (teamMatch) {
                pick.awayTeam = teamMatch[1].trim();
                pick.homeTeam = teamMatch[3].trim();
            }

            // Add default values
            pick.sport = 'nfl'; // Default, can be enhanced
            pick.gameDate = new Date().toISOString().split('T')[0];
            pick.status = 'pending';
        }

        return pick;
    }

    // Make functions available globally for testing
    window.processAndSavePicks = processAndSavePicks;
    window.parseTextPicks = parseTextPicks;
});
