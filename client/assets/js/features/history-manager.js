/**
 * History Toggle Enhancement v1.0.0
 * Fetches archived picks from Azure Blob Storage
 * Enhances the existing localStorage-based history view
 */

(function() {
    'use strict';

    const getApiBase = () => window.APP_CONFIG?.FUNCTIONS_BASE_URL || '';

    class HistoryManager {
        constructor() {
            this.cache = new Map();
            this.currentWeek = null;
            this.initialized = false;
        }

        /**
         * Initialize history manager
         */
        init() {
            if (this.initialized) return;
            
            // Hook into existing view toggle
            this._enhanceViewToggle();
            
            this.initialized = true;
            console.log('📚 History Manager initialized');
        }

        /**
         * Enhance the existing view toggle to use blob storage
         */
        _enhanceViewToggle() {
            const historyBtn = document.querySelector('[data-view="history"]');
            if (!historyBtn) return;

            // Replace click handler
            historyBtn.addEventListener('click', async (e) => {
                // Let original handler update button state
                // Then enhance with blob data
                setTimeout(() => this.loadHistoryFromBlob(), 100);
            }, { capture: true });
        }

        /**
         * Fetch archived picks from Azure Blob Storage
         */
        async loadHistoryFromBlob() {
            const tbody = document.querySelector('.weekly-lineup-table tbody');
            if (!tbody) return;

            // Show loading state
            tbody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="9" style="text-align:center; padding:40px;">
                        <div class="loading-spinner"></div>
                        <div style="margin-top:10px; color:#888;">Loading archived picks...</div>
                    </td>
                </tr>
            `;

            try {
                const weeks = await this.fetchAvailableWeeks();
                
                if (!weeks || weeks.length === 0) {
                    // Fall back to localStorage
                    console.log('📚 No blob archives found, using localStorage');
                    return;
                }

                // Render week selector
                this._renderWeekSelector(weeks);

                // Load most recent week by default
                await this.loadWeek(weeks[0]);

            } catch (error) {
                console.error('History load error:', error);
                // Fall back to localStorage on error
                tbody.innerHTML = `
                    <tr class="error-row">
                        <td colspan="9" style="text-align:center; padding:40px; color:#ef4444;">
                            Failed to load history from cloud. Showing local history...
                        </td>
                    </tr>
                `;
            }
        }

        /**
         * Fetch list of available weeks from blob storage
         */
        async fetchAvailableWeeks() {
            const response = await fetch(`${getApiBase()}/api/archive-picks/list`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch weeks: ${response.status}`);
            }

            const data = await response.json();
            return data.weeks || [];
        }

        /**
         * Load a specific week's picks
         */
        async loadWeek(weekId) {
            this.currentWeek = weekId;

            // Check cache first
            if (this.cache.has(weekId)) {
                this._renderPicks(this.cache.get(weekId));
                return;
            }

            const tbody = document.querySelector('.weekly-lineup-table tbody');
            tbody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="9" style="text-align:center; padding:20px;">
                        Loading ${weekId}...
                    </td>
                </tr>
            `;

            try {
                const response = await fetch(`${getApiBase()}/api/archive-picks/${weekId}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch week: ${response.status}`);
                }

                const data = await response.json();
                this.cache.set(weekId, data);
                this._renderPicks(data);

            } catch (error) {
                console.error(`Failed to load week ${weekId}:`, error);
                tbody.innerHTML = `
                    <tr class="error-row">
                        <td colspan="9" style="text-align:center; padding:20px; color:#ef4444;">
                            Failed to load ${weekId}
                        </td>
                    </tr>
                `;
            }
        }

        /**
         * Render week selector dropdown
         */
        _renderWeekSelector(weeks) {
            let statsBar = document.querySelector('.history-stats-bar');
            
            if (!statsBar) {
                statsBar = document.createElement('div');
                statsBar.className = 'history-stats-bar';
                const tableWrapper = document.querySelector('.weekly-lineup-table-wrapper');
                if (tableWrapper) {
                    tableWrapper.insertBefore(statsBar, tableWrapper.firstChild);
                }
            }

            statsBar.innerHTML = `
                <div class="history-controls">
                    <label>Week:</label>
                    <select id="history-week-select" class="history-week-select">
                        ${weeks.map(w => `<option value="${w}">${this._formatWeekLabel(w)}</option>`).join('')}
                    </select>
                    <span class="history-source-badge">☁️ Cloud Archive</span>
                </div>
                <div class="history-stats" id="history-stats"></div>
            `;

            // Attach week change handler
            const select = statsBar.querySelector('#history-week-select');
            select.addEventListener('change', (e) => {
                this.loadWeek(e.target.value);
            });
        }

        /**
         * Format week ID to readable label
         */
        _formatWeekLabel(weekId) {
            // Convert "2026-week-02" to "Week 2, 2026"
            const match = weekId.match(/(\d{4})-week-(\d+)/);
            if (match) {
                return `Week ${parseInt(match[2])}, ${match[1]}`;
            }
            return weekId;
        }

        /**
         * Render picks in the table
         */
        _renderPicks(data) {
            const picks = data.picks || [];
            const tbody = document.querySelector('.weekly-lineup-table tbody');
            const statsDiv = document.getElementById('history-stats');

            if (!tbody) return;

            if (picks.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="9" style="text-align:center; padding:40px; color:#888;">
                            No picks archived for this week
                        </td>
                    </tr>
                `;
                return;
            }

            // Calculate stats
            const wins = picks.filter(p => p.outcome === 'win').length;
            const losses = picks.filter(p => p.outcome === 'loss').length;
            const pushes = picks.filter(p => p.outcome === 'push').length;
            const pending = picks.filter(p => !p.outcome || p.outcome === 'pending').length;
            const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 'N/A';

            if (statsDiv) {
                statsDiv.innerHTML = `
                    <span class="stat-item win">${wins}W</span>
                    <span class="stat-item loss">${losses}L</span>
                    <span class="stat-item push">${pushes}P</span>
                    ${pending > 0 ? `<span class="stat-item pending">${pending} Pending</span>` : ''}
                    <span class="stat-item rate">${winRate}%</span>
                `;
            }

            // Render table rows
            tbody.innerHTML = picks.map(pick => this._renderPickRow(pick)).join('');
        }

        /**
         * Render a single pick row
         */
        _renderPickRow(pick) {
            const outcomeClass = pick.outcome ? `outcome-${pick.outcome}` : '';
            const outcomeIcon = this._getOutcomeIcon(pick.outcome);

            return `
                <tr class="archived-pick-row ${outcomeClass}">
                    <td class="col-datetime">${this._formatDateTime(pick.gameDate, pick.gameTime)}</td>
                    <td class="col-league center">${this._getLeagueLogo(pick.league)}</td>
                    <td class="col-matchup">${this._formatMatchup(pick)}</td>
                    <td class="col-segment center">${pick.segment || 'Full'}</td>
                    <td class="col-pick">${pick.pick || ''}</td>
                    <td class="col-market center">${pick.odds || ''}</td>
                    <td class="col-edge center">${pick.edge ? pick.edge + '%' : ''}</td>
                    <td class="col-fire center">${pick.confidence || ''}</td>
                    <td class="col-track center">${outcomeIcon}</td>
                </tr>
            `;
        }

        /**
         * Get outcome icon
         */
        _getOutcomeIcon(outcome) {
            switch (outcome) {
                case 'win': return '<span class="outcome-badge win">✓ WIN</span>';
                case 'loss': return '<span class="outcome-badge loss">✗ LOSS</span>';
                case 'push': return '<span class="outcome-badge push">= PUSH</span>';
                default: return '<span class="outcome-badge pending">⏳</span>';
            }
        }

        /**
         * Format date/time
         */
        _formatDateTime(date, time) {
            if (!date) return '';
            return `<div class="datetime-cell">
                <span class="date">${date}</span>
                ${time ? `<span class="time">${time}</span>` : ''}
            </div>`;
        }

        /**
         * Get league logo HTML
         */
        _getLeagueLogo(league) {
            const logos = {
                'NBA': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nba.png',
                'NFL': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-nfl.png',
                'NCAAB': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-ncaam.png',
                'NCAAM': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-ncaam.png',
                'NCAAF': 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos/leagues-500-ncaaf.png'
            };
            const src = logos[league?.toUpperCase()] || '';
            return src ? `<img src="${src}" alt="${league}" class="league-logo-sm" style="height:24px;">` : league || '';
        }

        /**
         * Format matchup display
         */
        _formatMatchup(pick) {
            const away = pick.awayTeam || pick.team1 || '';
            const home = pick.homeTeam || pick.team2 || '';
            
            if (!away && !home) return pick.matchup || '';
            
            return `<div class="matchup-cell">
                <span class="team-away">${away}</span>
                <span class="vs">@</span>
                <span class="team-home">${home}</span>
            </div>`;
        }
    }

    // Create singleton and init on DOM ready
    window.HistoryManager = new HistoryManager();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.HistoryManager.init());
    } else {
        window.HistoryManager.init();
    }

})();
