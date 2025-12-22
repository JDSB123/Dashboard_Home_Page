/**
 * Shared Utilities Module
 * Common utility functions used across the dashboard
 */

(function() {
    'use strict';

    /**
     * Get API base URL from config
     * @returns {string} API base URL
     */
    function getApiUrl() {
        return window.APP_CONFIG?.API_BASE_URL || '/api';
    }

    /**
     * Format money value with $ sign and 2 decimal places
     * @param {number|string} val - Value to format
     * @returns {string} Formatted money string
     */
    function formatMoney(val) {
        if (!val) return '$0.00';
        const num = parseFloat(String(val).replace(/[$,]/g, ''));
        return isNaN(num) ? '$0.00' : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Format money value without $ sign
     * @param {number|string} val - Value to format
     * @returns {string} Formatted number string
     */
    function formatMoneyValue(val) {
        if (!val) return '0.00';
        const num = parseFloat(String(val).replace(/[$,]/g, ''));
        return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Get display label for status
     * @param {string} status - Status key
     * @returns {string} Display label
     */
    function getStatusLabel(status) {
        const labels = {
            'pending': 'Pending',
            'on-track': 'On Track',
            'at-risk': 'At Risk',
            'hit': 'Hit',
            'miss': 'Miss',
            'push': 'Push'
        };
        return labels[status] || status;
    }

    /**
     * Get segment display label
     * @param {string} segment - Segment key
     * @returns {string} Display label
     */
    function getSegmentLabel(segment) {
        const labels = {
            'full-game': 'Full Game',
            'fg': 'Full Game',
            '1h': '1st Half',
            '2h': '2nd Half',
            '1q': '1st Quarter',
            '2q': '2nd Quarter',
            '3q': '3rd Quarter',
            '4q': '4th Quarter'
        };
        return labels[(segment || '').toLowerCase()] || segment || 'Full Game';
    }

    /**
     * Get team abbreviation from name
     * @param {string} teamName - Full team name
     * @returns {string} Team abbreviation
     */
    function getTeamAbbr(teamName) {
        if (!teamName) return '';
        
        // Common team abbreviations
        const abbrs = {
            // NFL
            'raiders': 'LV', 'las vegas raiders': 'LV',
            'broncos': 'DEN', 'denver broncos': 'DEN',
            'chiefs': 'KC', 'kansas city chiefs': 'KC',
            'chargers': 'LAC', 'los angeles chargers': 'LAC',
            'cowboys': 'DAL', 'dallas cowboys': 'DAL',
            'eagles': 'PHI', 'philadelphia eagles': 'PHI',
            'giants': 'NYG', 'new york giants': 'NYG',
            'commanders': 'WSH', 'washington commanders': 'WSH',
            'packers': 'GB', 'green bay packers': 'GB',
            'bears': 'CHI', 'chicago bears': 'CHI',
            'lions': 'DET', 'detroit lions': 'DET',
            'vikings': 'MIN', 'minnesota vikings': 'MIN',
            'falcons': 'ATL', 'atlanta falcons': 'ATL',
            'saints': 'NO', 'new orleans saints': 'NO',
            'panthers': 'CAR', 'carolina panthers': 'CAR',
            'buccaneers': 'TB', 'tampa bay buccaneers': 'TB',
            'bills': 'BUF', 'buffalo bills': 'BUF',
            'dolphins': 'MIA', 'miami dolphins': 'MIA',
            'jets': 'NYJ', 'new york jets': 'NYJ',
            'patriots': 'NE', 'new england patriots': 'NE',
            'bengals': 'CIN', 'cincinnati bengals': 'CIN',
            'browns': 'CLE', 'cleveland browns': 'CLE',
            'steelers': 'PIT', 'pittsburgh steelers': 'PIT',
            'ravens': 'BAL', 'baltimore ravens': 'BAL',
            'colts': 'IND', 'indianapolis colts': 'IND',
            'jaguars': 'JAX', 'jacksonville jaguars': 'JAX',
            'texans': 'HOU', 'houston texans': 'HOU',
            'titans': 'TEN', 'tennessee titans': 'TEN',
            'seahawks': 'SEA', 'seattle seahawks': 'SEA',
            '49ers': 'SF', 'san francisco 49ers': 'SF',
            'rams': 'LAR', 'los angeles rams': 'LAR',
            'cardinals': 'ARI', 'arizona cardinals': 'ARI',
            
            // NBA
            'lakers': 'LAL', 'los angeles lakers': 'LAL',
            'clippers': 'LAC', 'la clippers': 'LAC',
            'warriors': 'GSW', 'golden state warriors': 'GSW',
            'suns': 'PHX', 'phoenix suns': 'PHX',
            'celtics': 'BOS', 'boston celtics': 'BOS',
            'nets': 'BKN', 'brooklyn nets': 'BKN',
            'knicks': 'NYK', 'new york knicks': 'NYK',
            '76ers': 'PHI', 'philadelphia 76ers': 'PHI',
            'heat': 'MIA', 'miami heat': 'MIA',
            'magic': 'ORL', 'orlando magic': 'ORL',
            'bulls': 'CHI', 'chicago bulls': 'CHI',
            'bucks': 'MIL', 'milwaukee bucks': 'MIL',
            'cavaliers': 'CLE', 'cleveland cavaliers': 'CLE',
            'pistons': 'DET', 'detroit pistons': 'DET',
            'pacers': 'IND', 'indiana pacers': 'IND',
            'hawks': 'ATL', 'atlanta hawks': 'ATL',
            'hornets': 'CHA', 'charlotte hornets': 'CHA',
            'wizards': 'WAS', 'washington wizards': 'WAS',
            'raptors': 'TOR', 'toronto raptors': 'TOR',
            'nuggets': 'DEN', 'denver nuggets': 'DEN',
            'jazz': 'UTA', 'utah jazz': 'UTA',
            'blazers': 'POR', 'portland trail blazers': 'POR',
            'thunder': 'OKC', 'oklahoma city thunder': 'OKC',
            'timberwolves': 'MIN', 'minnesota timberwolves': 'MIN',
            'pelicans': 'NOP', 'new orleans pelicans': 'NOP',
            'grizzlies': 'MEM', 'memphis grizzlies': 'MEM',
            'spurs': 'SAS', 'san antonio spurs': 'SAS',
            'rockets': 'HOU', 'houston rockets': 'HOU',
            'mavericks': 'DAL', 'dallas mavericks': 'DAL',
            'kings': 'SAC', 'sacramento kings': 'SAC'
        };
        
        const key = teamName.toLowerCase().trim();
        if (abbrs[key]) {
            return abbrs[key];
        }
        
        // Fallback: first 3 letters of last word
        const words = teamName.trim().split(/\s+/);
        return words[words.length - 1].substring(0, 3).toUpperCase();
    }

    /**
     * Parse teams from game string
     * @param {string} gameString - Game string like "Team A @ Team B"
     * @returns {Object} { away, home }
     */
    function parseTeamsFromGame(gameString) {
        if (!gameString) return { away: '', home: '' };
        
        const separators = ['@', ' vs ', ' vs. ', ' / '];
        for (const sep of separators) {
            if (gameString.includes(sep)) {
                const parts = gameString.split(sep);
                return {
                    away: parts[0].trim(),
                    home: parts[1] ? parts[1].trim() : ''
                };
            }
        }
        
        return { away: gameString.trim(), home: '' };
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Format date for display
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date (MM/DD/YYYY)
     */
    function formatDate(date) {
        if (!date) return 'TBD';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'TBD';
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${month}/${day}/${year}`;
    }

    /**
     * Format time for display
     * @param {string|Date} date - Date/time to format
     * @returns {string} Formatted time (HH:MM AM/PM)
     */
    function formatTime(date) {
        if (!date) return 'TBD';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'TBD';
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Export utilities
    window.SharedUtils = {
        getApiUrl,
        formatMoney,
        formatMoneyValue,
        getStatusLabel,
        getSegmentLabel,
        getTeamAbbr,
        parseTeamsFromGame,
        escapeHtml,
        formatFileSize,
        formatDate,
        formatTime
    };

})();
