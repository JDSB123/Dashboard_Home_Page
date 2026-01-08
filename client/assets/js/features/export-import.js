/**
 * Export/Import Utility for Picks
 * Handles CSV export, Excel export, and various import formats
 */

(function() {
    'use strict';

    // ===== CSV EXPORT =====
    function exportToCSV() {
        const picks = window.LocalPicksManager?.getAll() || [];
        
        if (picks.length === 0) {
            showNotification('No picks to export', 'warning');
            return;
        }

        const headers = [
            'Date', 'Time', 'Sport', 'Sportsbook', 'Pick Team', 'Away Team', 'Home Team',
            'Pick Type', 'Line', 'Odds', 'Segment', 'Risk', 'Win', 'Status', 'Result'
        ];

        const rows = picks.map(pick => [
            pick.gameDate || '',
            pick.gameTime || '',
            pick.sport || '',
            pick.sportsbook || '',
            pick.pickTeam || '',
            pick.awayTeam || '',
            pick.homeTeam || '',
            pick.pickType || '',
            pick.line || '',
            pick.odds || '',
            pick.segment || 'Full Game',
            pick.risk || 0,
            pick.win || 0,
            pick.status || 'pending',
            pick.result || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        downloadFile(csvContent, `bears-bulls-picks-${getDateString()}.csv`, 'text/csv');
        showNotification(`${picks.length} picks exported to CSV`, 'success');
    }

    // ===== EXCEL EXPORT (CSV with .xlsx extension for Excel compatibility) =====
    function exportToExcel() {
        const picks = window.LocalPicksManager?.getAll() || [];
        
        if (picks.length === 0) {
            showNotification('No picks to export', 'warning');
            return;
        }

        const headers = [
            'Date', 'Time', 'Sport', 'Sportsbook', 'Pick Team', 'Away Team', 'Home Team',
            'Pick Type', 'Line', 'Odds', 'Segment', 'Risk', 'Win', 'Status', 'Result', 'Notes'
        ];

        const rows = picks.map(pick => [
            pick.gameDate || '',
            pick.gameTime || '',
            pick.sport || '',
            pick.sportsbook || '',
            pick.pickTeam || '',
            pick.awayTeam || '',
            pick.homeTeam || '',
            pick.pickType || '',
            pick.line || '',
            pick.odds || '',
            pick.segment || 'Full Game',
            pick.risk || 0,
            pick.win || 0,
            pick.status || 'pending',
            pick.result || '',
            pick.notes || ''
        ]);

        // Tab-separated for better Excel compatibility
        const tsvContent = [
            headers.join('\t'),
            ...rows.map(row => row.map(cell => String(cell).replace(/\t/g, ' ')).join('\t'))
        ].join('\n');

        downloadFile(tsvContent, `bears-bulls-picks-${getDateString()}.xls`, 'application/vnd.ms-excel');
        showNotification(`${picks.length} picks exported to Excel`, 'success');
    }

    // ===== JSON EXPORT =====
    function exportToJSON() {
        const picks = window.LocalPicksManager?.getAll() || [];
        
        if (picks.length === 0) {
            showNotification('No picks to export', 'warning');
            return;
        }

        const jsonContent = JSON.stringify(picks, null, 2);
        downloadFile(jsonContent, `bears-bulls-picks-${getDateString()}.json`, 'application/json');
        showNotification(`${picks.length} picks exported to JSON`, 'success');
    }

    // ===== IMPORT FROM FILE =====
    function importFromFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const ext = file.name.split('.').pop().toLowerCase();
                
                let picks = [];
                
                if (ext === 'json') {
                    picks = JSON.parse(content);
                } else if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
                    picks = parseCSV(content);
                } else {
                    throw new Error('Unsupported file format');
                }
                
                if (!Array.isArray(picks) || picks.length === 0) {
                    throw new Error('No valid picks found in file');
                }
                
                // Validate and add picks
                const validPicks = picks.filter(pick => 
                    pick.pickTeam && (pick.awayTeam || pick.homeTeam)
                );
                
                if (window.LocalPicksManager) {
                    window.LocalPicksManager.add(validPicks);
                    showNotification(`Imported ${validPicks.length} picks`, 'success');
                } else {
                    console.error('LocalPicksManager not available');
                    showNotification('Error: Import system not ready', 'error');
                }
                
            } catch (error) {
                console.error('Import error:', error);
                showNotification(`Import failed: ${error.message}`, 'error');
            }
        };
        
        reader.readAsText(file);
    }

    // ===== CSV PARSER =====
    function parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(/,|\t/).map(h => h.replace(/"/g, '').trim().toLowerCase());
        const picks = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/,|\t/).map(v => v.replace(/"/g, '').trim());
            const pick = {};
            
            headers.forEach((header, index) => {
                const value = values[index] || '';
                
                // Map headers to pick properties
                if (header.includes('date')) pick.gameDate = value;
                else if (header.includes('time')) pick.gameTime = value;
                else if (header.includes('sport')) pick.sport = value;
                else if (header.includes('sportsbook') || header.includes('book')) pick.sportsbook = value;
                else if (header.includes('pick') && header.includes('team')) pick.pickTeam = value;
                else if (header.includes('away')) pick.awayTeam = value;
                else if (header.includes('home')) pick.homeTeam = value;
                else if (header.includes('type')) pick.pickType = value;
                else if (header.includes('line')) pick.line = value;
                else if (header.includes('odds')) pick.odds = value;
                else if (header.includes('segment') || header.includes('period')) pick.segment = value;
                else if (header.includes('risk') || header.includes('bet')) pick.risk = parseFloat(value) || 0;
                else if (header.includes('win') || header.includes('return')) pick.win = parseFloat(value) || 0;
                else if (header.includes('status')) pick.status = value || 'pending';
                else if (header.includes('result')) pick.result = value;
                else if (header.includes('notes')) pick.notes = value;
            });
            
            if (pick.pickTeam && (pick.awayTeam || pick.homeTeam)) {
                picks.push(pick);
            }
        }
        
        return picks;
    }

    // ===== HELPER FUNCTIONS =====
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function showNotification(message, type = 'info') {
        if (window.DashboardNotification) {
            window.DashboardNotification.show(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // ===== UI INTEGRATION =====
    function setupExportImportUI() {
        // Add export/import buttons to dashboard if not already present
        const toolbar = document.querySelector('.filters-toolbar, .dashboard-toolbar, .main-toolbar');
        
        if (!toolbar || toolbar.querySelector('.export-import-controls')) return;
        
        const controlsHTML = `
            <div class="export-import-controls">
                <button class="btn-export-csv" title="Export to CSV">
                    <span class="icon">📊</span>
                    <span class="label">Export CSV</span>
                </button>
                <button class="btn-export-excel" title="Export to Excel">
                    <span class="icon">📈</span>
                    <span class="label">Export Excel</span>
                </button>
                <button class="btn-import" title="Import picks from file">
                    <span class="icon">📥</span>
                    <span class="label">Import</span>
                </button>
                <input type="file" id="import-file-input" accept=".csv,.xls,.xlsx,.json" style="display: none;">
            </div>
        `;
        
        toolbar.insertAdjacentHTML('beforeend', controlsHTML);
        
        // Attach event listeners
        document.querySelector('.btn-export-csv')?.addEventListener('click', exportToCSV);
        document.querySelector('.btn-export-excel')?.addEventListener('click', exportToExcel);
        
        const importBtn = document.querySelector('.btn-import');
        const fileInput = document.getElementById('import-file-input');
        
        importBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importFromFile(file);
                e.target.value = ''; // Reset input
            }
        });
    }

    // ===== INITIALIZE ON DOM READY =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupExportImportUI);
    } else {
        setupExportImportUI();
    }

    // ===== EXPORT FUNCTIONS =====
    window.ExportImportUtil = {
        exportToCSV,
        exportToExcel,
        exportToJSON,
        importFromFile,
        parseCSV
    };

    console.log('✅ Export/Import Utility loaded');

})();
