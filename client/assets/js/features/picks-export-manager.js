/**
 * Picks Export Manager v1.0
 * Export picks to various formats (HTML, CSV/Excel, PDF)
 */

(function() {
    'use strict';

    /**
     * Export picks to clean HTML format
     * @param {Array} picks - Array of pick objects
     * @param {Object} options - Export options
     */
    function exportToHTML(picks, options = {}) {
        const timestamp = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const title = options.title || 'Bears & Bulls - Weekly Lineup';
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #1a202c;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .header .subtitle {
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 4px;
        }
        .header .timestamp {
            font-size: 14px;
            opacity: 0.7;
        }
        .stats-banner {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            padding: 20px 30px;
            background: #f7fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        .stat-box {
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
        }
        .stat-label {
            font-size: 12px;
            text-transform: uppercase;
            color: #718096;
            margin-top: 4px;
        }
        .picks-table {
            width: 100%;
            border-collapse: collapse;
        }
        .picks-table thead {
            background: #edf2f7;
        }
        .picks-table th {
            padding: 12px 15px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #4a5568;
            border-bottom: 2px solid #cbd5e0;
        }
        .picks-table th.center {
            text-align: center;
        }
        .picks-table td {
            padding: 15px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
        }
        .picks-table td.center {
            text-align: center;
        }
        .picks-table tbody tr:hover {
            background: #f7fafc;
        }
        .league-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .league-nba { background: #c81e4e; color: white; }
        .league-nfl { background: #013369; color: white; }
        .league-ncaab { background: #003087; color: white; }
        .league-ncaaf { background: #ff6b35; color: white; }
        .league-nhl { background: #111; color: white; }
        .league-mlb { background: #041e42; color: white; }
        .matchup {
            font-weight: 600;
        }
        .pick-detail {
            font-weight: 600;
            color: #2d3748;
        }
        .edge-value {
            font-weight: 700;
            color: #38a169;
        }
        .edge-high { color: #22543d; }
        .edge-medium { color: #38a169; }
        .edge-low { color: #68d391; }
        .fire-rating {
            display: inline-flex;
            gap: 2px;
        }
        .fire-emoji {
            font-size: 16px;
        }
        .footer {
            padding: 20px 30px;
            background: #f7fafc;
            text-align: center;
            font-size: 12px;
            color: #718096;
        }
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐻 Bears & Bulls 🐂</h1>
            <div class="subtitle">${title}</div>
            <div class="timestamp">Generated: ${timestamp}</div>
        </div>
        ${generateStatsHTML(picks)}
        <table class="picks-table">
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th class="center">League</th>
                    <th>Matchup</th>
                    <th class="center">Segment</th>
                    <th>Pick</th>
                    <th class="center">Edge</th>
                    <th class="center">Fire</th>
                </tr>
            </thead>
            <tbody>
                ${picks.map(pick => generatePickRowHTML(pick)).join('')}
            </tbody>
        </table>
        <div class="footer">
            <p><strong>Bears & Bulls Sports Betting Dashboard</strong></p>
            <p>Edge values and fire ratings are model-generated predictions. Past performance does not guarantee future results.</p>
        </div>
    </div>
</body>
</html>`;

        downloadFile(html, `weekly-lineup-${formatFilename()}.html`, 'text/html');
    }

    /**
     * Export picks to CSV format (Excel compatible)
     * @param {Array} picks - Array of pick objects
     * @param {Object} options - Export options
     */
    function exportToCSV(picks, options = {}) {
        const headers = [
            'Date',
            'Time',
            'League',
            'Away Team',
            'Home Team',
            'Segment',
            'Pick Type',
            'Pick',
            'Line',
            'Odds',
            'Edge %',
            'Fire Rating',
            'Model Tag'
        ];

        const rows = picks.map(pick => {
            const dateTime = pick.game_datetime || pick.datetime || '';
            const [date, time] = dateTime.split(' ');
            
            return [
                date || '',
                time || '',
                pick.league || '',
                pick.away_team || pick.awayTeam || '',
                pick.home_team || pick.homeTeam || '',
                pick.segment || '',
                pick.pick_type || pick.pickType || '',
                pick.pick || '',
                pick.line || pick.spread || '',
                pick.odds || '',
                pick.edge || pick.edgeValue || '',
                pick.fire || pick.fireRating || '',
                pick.model_tag || pick.modelTag || ''
            ].map(escapeCSV);
        });

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        downloadFile(csv, `weekly-lineup-${formatFilename()}.csv`, 'text/csv');
    }

    /**
     * Export picks to PDF format (via print)
     * @param {Array} picks - Array of pick objects
     * @param {Object} options - Export options
     */
    function exportToPDF(picks, options = {}) {
        // Generate HTML and open in new window for printing
        const timestamp = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const title = options.title || 'Bears & Bulls - Weekly Lineup';
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to export to PDF');
            return;
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #1a202c;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #2d3748;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 5px;
        }
        .header .subtitle {
            font-size: 14px;
            color: #4a5568;
        }
        .stats-banner {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f7fafc;
            border-radius: 8px;
        }
        .stat-box {
            text-align: center;
        }
        .stat-value {
            font-size: 20px;
            font-weight: 700;
        }
        .stat-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #718096;
        }
        .picks-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        .picks-table th {
            padding: 8px 6px;
            background: #2d3748;
            color: white;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
        }
        .picks-table td {
            padding: 8px 6px;
            border-bottom: 1px solid #e2e8f0;
        }
        .league-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
        }
        .matchup { font-weight: 600; }
        .edge-value { font-weight: 700; color: #38a169; }
        @page { margin: 0.5in; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐻 Bears & Bulls 🐂</h1>
        <div class="subtitle">${title} - ${timestamp}</div>
    </div>
    ${generateStatsHTML(picks)}
    <table class="picks-table">
        <thead>
            <tr>
                <th>Date/Time</th>
                <th>League</th>
                <th>Matchup</th>
                <th>Seg</th>
                <th>Pick</th>
                <th>Edge</th>
                <th>Fire</th>
            </tr>
        </thead>
        <tbody>
            ${picks.map(pick => `
                <tr>
                    <td>${pick.game_datetime || pick.datetime || 'TBD'}</td>
                    <td><span class="league-badge">${pick.league || 'N/A'}</span></td>
                    <td class="matchup">${pick.away_team || ''} @ ${pick.home_team || ''}</td>
                    <td>${pick.segment || 'FG'}</td>
                    <td>${pick.pick || 'N/A'}</td>
                    <td class="edge-value">${pick.edge || pick.edgeValue || '0'}%</td>
                    <td>${'🔥'.repeat(pick.fire || pick.fireRating || 0)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        
        // Trigger print dialog after short delay
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }

    /**
     * Generate stats banner HTML
     * @param {Array} picks - Array of pick objects
     * @returns {string} - HTML string
     */
    function generateStatsHTML(picks) {
        const stats = calculateStats(picks);
        
        return `
        <div class="stats-banner">
            <div class="stat-box">
                <div class="stat-value">${stats.totalPicks}</div>
                <div class="stat-label">Total Picks</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${stats.avgEdge}%</div>
                <div class="stat-label">Avg Edge</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${stats.maxFireCount}</div>
                <div class="stat-label">🔥 Max Fire</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${stats.leaguesCount}</div>
                <div class="stat-label">Leagues</div>
            </div>
        </div>
        `;
    }

    /**
     * Generate pick row HTML
     * @param {Object} pick - Pick object
     * @returns {string} - HTML string
     */
    function generatePickRowHTML(pick) {
        const league = (pick.league || 'N/A').toLowerCase();
        const edgeVal = parseFloat(pick.edge || pick.edgeValue || 0);
        const edgeClass = edgeVal >= 5 ? 'edge-high' : edgeVal >= 2 ? 'edge-medium' : 'edge-low';
        const fire = parseInt(pick.fire || pick.fireRating || 0, 10);
        
        return `
        <tr>
            <td>${pick.game_datetime || pick.datetime || 'TBD'}</td>
            <td class="center">
                <span class="league-badge league-${league}">${pick.league || 'N/A'}</span>
            </td>
            <td class="matchup">
                ${pick.away_team || pick.awayTeam || 'TBD'} @ ${pick.home_team || pick.homeTeam || 'TBD'}
            </td>
            <td class="center">${pick.segment || 'FG'}</td>
            <td class="pick-detail">
                ${pick.pick || 'N/A'} 
                ${pick.line || pick.spread ? `(${pick.line || pick.spread})` : ''}
                ${pick.odds ? `@ ${pick.odds}` : ''}
            </td>
            <td class="center edge-value ${edgeClass}">
                ${edgeVal.toFixed(1)}%
            </td>
            <td class="center">
                <span class="fire-rating">
                    ${'<span class="fire-emoji">🔥</span>'.repeat(fire)}
                </span>
            </td>
        </tr>
        `;
    }

    /**
     * Calculate statistics for picks
     * @param {Array} picks - Array of pick objects
     * @returns {Object} - Stats object
     */
    function calculateStats(picks) {
        let totalEdge = 0;
        let edgeCount = 0;
        let maxFireCount = 0;
        const leagues = new Set();

        picks.forEach(pick => {
            const edge = parseFloat(pick.edge || pick.edgeValue || 0);
            if (!isNaN(edge) && edge > 0) {
                totalEdge += edge;
                edgeCount++;
            }

            const fire = parseInt(pick.fire || pick.fireRating || 0, 10);
            if (fire === 5) maxFireCount++;

            if (pick.league) leagues.add(pick.league);
        });

        return {
            totalPicks: picks.length,
            avgEdge: edgeCount > 0 ? (totalEdge / edgeCount).toFixed(1) : '0.0',
            maxFireCount,
            leaguesCount: leagues.size
        };
    }

    /**
     * Escape CSV value
     * @param {string} value - Value to escape
     * @returns {string} - Escaped value
     */
    function escapeCSV(value) {
        const str = String(value || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Format filename timestamp
     * @returns {string} - Formatted timestamp for filename
     */
    function formatFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    /**
     * Download file
     * @param {string} content - File content
     * @param {string} filename - File name
     * @param {string} mimeType - MIME type
     */
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

    // Export to window
    window.PicksExportManager = {
        exportToHTML,
        exportToCSV,
        exportToPDF
    };

    console.log('✅ PicksExportManager loaded');

})();
