/* ==========================================================================
   PICKS FILTER MANAGER v1.1
   --------------------------------------------------------------------------
   Core filtering logic for the picks table. Exports window.PicksFilterManager.

   ARCHITECTURE NOTE:
   This is the "source of truth" for filter application logic.
   Other modules should use window.PicksFilterManager methods:
   - passesAllFilters(row): Check if a row passes all active filters
   - applyFilter(type): Apply a specific filter type
   - resetFilter(type): Reset a specific filter
   - clearFilterByChip(type, subtype): Clear filter from chip click

   Related modules:
   - table-filters.js: UI initialization, dropdown handlers
   - picks-state-manager.js: State persistence and updates
   - picks-table-renderer.js: Uses passesAllFilters for row visibility
   ========================================================================== */
(function() {
    'use strict';

    const FilterManager = {
        _columnIndexCache: new WeakMap(),

        /**
         * Get 1-based column index by reading the table header for this table.
         * Uses data-sort or data-filter on <th>.
         */
        getColumnIndex(row, columnKey) {
            try {
                const table = row?.closest?.('table');
                if (!table) return null;

                let cacheForTable = this._columnIndexCache.get(table);
                if (!cacheForTable) {
                    cacheForTable = new Map();
                    this._columnIndexCache.set(table, cacheForTable);
                }

                if (cacheForTable.has(columnKey)) {
                    return cacheForTable.get(columnKey);
                }

                const th = table.querySelector(`thead th[data-sort="${columnKey}"]`) ||
                           table.querySelector(`thead th[data-filter="${columnKey}"]`);
                if (!th) {
                    cacheForTable.set(columnKey, null);
                    return null;
                }

                const rowEl = th.closest('tr');
                const ths = rowEl ? Array.from(rowEl.children).filter(el => el.tagName === 'TH') : [];
                const idx = ths.indexOf(th);
                const oneBased = idx >= 0 ? idx + 1 : null;
                cacheForTable.set(columnKey, oneBased);
                return oneBased;
            } catch (e) {
                return null;
            }
        },

        getCell(row, columnKey, fallbackIndex) {
            const idx = this.getColumnIndex(row, columnKey) || fallbackIndex || null;
            return idx ? row.querySelector(`td:nth-child(${idx})`) : null;
        },

        // Filter type configurations
        DATE_FILTER_GROUP_MAP: {
            dates: 'selectedDates',
            times: 'selectedTimes',
            books: 'selectedBooks'
        },

        DATE_FILTER_GROUP_LABELS: {
            dates: 'Dates',
            times: 'Times',
            books: 'Sportsbooks'
        },

        /**
         * Normalize filter value for comparison
         */
        normalizeFilterValue(value) {
            return (value ?? '').toString().trim().toLowerCase();
        },

        /**
         * Extract date/time parts from a row
         */
        getDateTimeParts(row) {
            const dateCell = row.querySelector('td:first-child');
            if (!dateCell) return { date: '', time: '', book: '' };

            const dateEl = dateCell.querySelector('.cell-date');
            const timeEl = dateCell.querySelector('.cell-time');
            const bookEl = dateCell.querySelector('.cell-book, .sportsbook-name, .sportsbook-value');

            let dateText = dateEl ? dateEl.textContent.trim() : '';
            let timeText = timeEl ? timeEl.textContent.trim() : '';
            let bookText = bookEl ? bookEl.textContent.trim() : '';

            // Extract date with weekday if present
            const weekdayEl = dateCell.querySelector('.cell-weekday');
            if (weekdayEl) {
                const weekday = weekdayEl.textContent.trim();
                if (weekday && !dateText.includes(weekday)) {
                    dateText = `${weekday} ${dateText}`;
                }
            }

            return {
                date: dateText,
                time: timeText,
                book: bookText
            };
        },

        /**
         * Get matchup value from row
         */
        getMatchupValue(row) {
            const matchupCell = this.getCell(row, 'matchup', 2);
            if (!matchupCell) return '';

            // Get full text content
            let text = matchupCell.textContent || '';

            // Try to get team names from logos
            const logos = matchupCell.querySelectorAll('.team-logo');
            if (logos.length > 0) {
                const teams = Array.from(logos).map(logo =>
                    logo.getAttribute('alt') || logo.getAttribute('title') || ''
                ).filter(Boolean);
                if (teams.length > 0) {
                    text = teams.join(' vs ');
                }
            }

            return text.toLowerCase();
        },

        /**
         * Get pick value from row
         */
        getPickValue(row) {
            const pickCell = this.getCell(row, 'pick', 3);
            if (!pickCell) return '';

            const pickText = pickCell.textContent || '';
            const betTypeEl = pickCell.querySelector('[data-bet-type]');
            const betType = betTypeEl ? betTypeEl.getAttribute('data-bet-type') : '';

            return {
                text: pickText.toLowerCase(),
                betType: betType.toLowerCase()
            };
        },

        /**
         * Get currency value from row
         */
        getCurrencyValue(row, columnIndex) {
            const cell = row.querySelector(`td:nth-child(${columnIndex})`);
            if (!cell) return null;

            const text = cell.textContent.replace(/[$,]/g, '').trim();
            return text ? parseFloat(text) : null;
        },

        /**
         * Get risk value from row
         */
        getRiskValue(row) {
            const cell = this.getCell(row, 'risk', 5);
            if (!cell) return null;
            const amountEl = cell.querySelector('.risk-amount');
            if (!amountEl) return null;
            const text = amountEl.textContent.replace(/[$,]/g, '').trim();
            return text ? parseFloat(text) : null;
        },

        /**
         * Get win value from row
         */
        getWinValue(row) {
            const cell = this.getCell(row, 'risk', 5);
            if (!cell) return null;
            const amountEl = cell.querySelector('.win-amount');
            if (!amountEl) return null;
            const text = amountEl.textContent.replace(/[$,]/g, '').trim();
            return text ? parseFloat(text) : null;
        },

        /**
         * Get status value from row
         */
        getStatusValue(row) {
            const statusCell = this.getCell(row, 'status') || row.querySelector('td:last-child');
            if (!statusCell) return '';

            const badge = statusCell.querySelector('.status-badge');
            if (badge) {
                // Try multiple attributes for status
                return badge.getAttribute('data-status') ||
                       badge.className.match(/status-(\w+)/)?.[1] ||
                       badge.textContent.trim().toLowerCase();
            }

            return statusCell.textContent.trim().toLowerCase();
        },

        /**
         * Normalize status for comparison
         */
        normalizeStatus(raw) {
            if (window.PicksDOMUtils && window.PicksDOMUtils.normalizeStatus) {
                return window.PicksDOMUtils.normalizeStatus(raw);
            }

            if (!raw) return '';
            const lower = raw.toString().toLowerCase().trim();

            const statusMap = {
                'win': 'win',
                'won': 'win',
                'winner': 'win',
                'loss': 'loss',
                'lost': 'loss',
                'lose': 'loss',
                'loser': 'loss',
                'push': 'push',
                'tie': 'push',
                'void': 'void',
                'voided': 'void',
                'cancelled': 'void',
                'pending': 'pending',
                'open': 'pending',
                'live': 'live',
                'in-progress': 'live',
                'in progress': 'live',
                'active': 'live'
            };

            return statusMap[lower] || lower;
        },

        /**
         * Detect bet type from row
         */
        detectBetType(row) {
            const pickCell = this.getCell(row, 'pick', 3);
            if (!pickCell) return { type: '', subtype: '' };

            const pickText = (pickCell.textContent || '').toLowerCase();
            const betTypeAttr = pickCell.querySelector('[data-bet-type]');

            if (betTypeAttr) {
                const type = betTypeAttr.getAttribute('data-bet-type').toLowerCase();
                const subtype = betTypeAttr.getAttribute('data-bet-subtype') || '';
                return { type, subtype: subtype.toLowerCase() };
            }

            // Pattern matching for bet types
            if (pickText.includes('spread') || pickText.includes('+') || pickText.includes('-')) {
                if (pickText.includes('1st') || pickText.includes('first')) {
                    return { type: 'spread', subtype: '1h' };
                }
                if (pickText.includes('2nd') || pickText.includes('second')) {
                    return { type: 'spread', subtype: '2h' };
                }
                return { type: 'spread', subtype: 'game' };
            }

            if (pickText.includes('total') || pickText.includes('over') || pickText.includes('under')) {
                if (pickText.includes('1st') || pickText.includes('first')) {
                    return { type: 'total', subtype: '1h' };
                }
                if (pickText.includes('2nd') || pickText.includes('second')) {
                    return { type: 'total', subtype: '2h' };
                }
                return { type: 'total', subtype: 'game' };
            }

            if (pickText.includes('moneyline') || pickText.includes('ml')) {
                if (pickText.includes('1st') || pickText.includes('first')) {
                    return { type: 'moneyline', subtype: '1h' };
                }
                if (pickText.includes('2nd') || pickText.includes('second')) {
                    return { type: 'moneyline', subtype: '2h' };
                }
                return { type: 'moneyline', subtype: 'game' };
            }

            if (pickText.includes('parlay')) {
                return { type: 'parlay', subtype: '' };
            }

            if (pickText.includes('prop') || pickText.includes('player')) {
                return { type: 'prop', subtype: '' };
            }

            return { type: '', subtype: '' };
        },

        /**
         * Detect game segment from row
         */
        detectSegment(row) {
            const segmentCell = this.getCell(row, 'segment', 4);
            if (!segmentCell) return 'game';

            const segmentSpan = segmentCell.querySelector('.game-segment');
            if (segmentSpan && segmentSpan.getAttribute('data-segment')) {
                return segmentSpan.getAttribute('data-segment').toLowerCase();
            }

            const text = segmentCell.textContent.trim().toLowerCase();
            if (text.includes('1st') || text.includes('1h') || text.includes('1q')) return '1h';
            if (text.includes('2nd') || text.includes('2h') || text.includes('2q')) return '2h';
            
            return 'game';
        },

        /**
         * Check if value matches range list
         */
        valueMatchesRangeList(ranges, value) {
            if (!ranges || ranges.length === 0 || value === null) return false;

            return ranges.some(range => {
                const [min, max] = range.split('-').map(v => parseFloat(v));
                return value >= min && value <= max;
            });
        },

        /**
         * Check if row passes date filter
         */
        passesDateFilter(row) {
            const filters = window.tableState.filters.date;

            // If no date filters active, pass
            if (!filters.selectedDates && !filters.selectedTimes &&
                !filters.selectedBooks && !filters.start && !filters.end) {
                return true;
            }

            const { date, time, book } = this.getDateTimeParts(row);

            // Check selected dates
            if (filters.selectedDates && filters.selectedDates.length > 0) {
                const normalizedDate = this.normalizeFilterValue(date);
                const passes = filters.selectedDates.some(selected =>
                    normalizedDate.includes(this.normalizeFilterValue(selected))
                );
                if (!passes) return false;
            }

            // Check selected times
            if (filters.selectedTimes && filters.selectedTimes.length > 0) {
                const normalizedTime = this.normalizeFilterValue(time);
                const passes = filters.selectedTimes.some(selected =>
                    normalizedTime.includes(this.normalizeFilterValue(selected))
                );
                if (!passes) return false;
            }

            // Check selected books
            if (filters.selectedBooks && filters.selectedBooks.length > 0) {
                const normalizedBook = this.normalizeFilterValue(book);
                const passes = filters.selectedBooks.some(selected =>
                    normalizedBook.includes(this.normalizeFilterValue(selected))
                );
                if (!passes) return false;
            }

            return true;
        },

        /**
         * Check if row passes matchup filter
         */
        passesMatchupFilter(row) {
            const filters = window.tableState.filters.matchup;

            // Check ticket type filter
            if (filters.ticketType && filters.ticketType !== 'all') {
                const isParlay = row.classList.contains('parlay-row');
                if (filters.ticketType === 'single' && isParlay) return false;
                if (filters.ticketType === 'parlay' && !isParlay) return false;
            }

            // Check league filter
            if (filters.league) {
                const matchupText = this.getMatchupValue(row);
                if (!matchupText.includes(filters.league.toLowerCase())) {
                    return false;
                }
            }

            // Check selected teams
            if (filters.selectedTeams && filters.selectedTeams.length > 0) {
                const matchupText = this.getMatchupValue(row);
                const passes = filters.selectedTeams.some(team =>
                    matchupText.includes(team.toLowerCase())
                );
                if (!passes) return false;
            }

            return true;
        },

        /**
         * Check if row passes pick filter
         */
        passesPickFilter(row) {
            const filters = window.tableState.filters.pick;

            if (filters.betType || filters.subtype) {
                const detected = this.detectBetType(row);

                if (filters.betType && detected.type !== filters.betType.toLowerCase()) {
                    return false;
                }

                if (filters.subtype && detected.subtype !== filters.subtype.toLowerCase()) {
                    return false;
                }
            }

            if (filters.segment) {
                const segment = this.detectSegment(row);
                if (segment !== filters.segment.toLowerCase()) {
                    return false;
                }
            }

            return true;
        },

        /**
         * Check if row passes risk filter
         */
        passesRiskFilter(row) {
            const filters = window.tableState.filters.risk;

            // Check risk ranges
            if (filters.selectedRiskRanges && filters.selectedRiskRanges.length > 0) {
                const risk = this.getRiskValue(row);
                if (!this.valueMatchesRangeList(filters.selectedRiskRanges, risk)) {
                    return false;
                }
            }

            // Check win ranges
            if (filters.selectedWinRanges && filters.selectedWinRanges.length > 0) {
                const win = this.getWinValue(row);
                if (!this.valueMatchesRangeList(filters.selectedWinRanges, win)) {
                    return false;
                }
            }

            // Check min/max values (legacy support)
            if (filters.min !== null || filters.max !== null) {
                const risk = this.getRiskValue(row);
                if (filters.min !== null && risk < filters.min) return false;
                if (filters.max !== null && risk > filters.max) return false;
            }

            return true;
        },

        /**
         * Check if row passes status filter
         */
        passesStatusFilter(row) {
            const filters = window.tableState.filters.status;

            if (!filters || filters.length === 0) {
                return true;
            }

            const status = this.normalizeStatus(this.getStatusValue(row));
            return filters.some(filter =>
                this.normalizeStatus(filter) === status
            );
        },

        /**
         * Check if row passes all filters
         */
        passesAllFilters(row) {
            const filters = window.tableState?.filters;
            if (!filters) return true;

            // 1. Search Filter
            if (filters.search) {
                const rowText = row.textContent.toLowerCase();
                if (!rowText.includes(filters.search)) return false;
            }

            // 2. Date Filter
            if (filters.date) {
                const { start, end } = filters.date;
                if (start && end) {
                    const rowEpoch = parseInt(row.getAttribute('data-epoch'), 10);
                    if (isNaN(rowEpoch)) return false; 
                    
                    const rowDate = new Date(rowEpoch * 1000);
                    // Set times to ensure inclusive comparison
                    const startDate = new Date(start); startDate.setHours(0,0,0,0);
                    const endDate = new Date(end); endDate.setHours(23,59,59,999);
                    
                    if (rowDate < startDate || rowDate > endDate) return false;
                }
            }

            // 3. League Filter
            if (filters.matchup?.league) {
                const rowLeague = (row.getAttribute('data-league') || '').toLowerCase();
                if (rowLeague !== filters.matchup.league.toLowerCase()) return false;
            }

            // 4. Segment Filter
            if (filters.pick?.segment) {
                const rowSegment = (row.getAttribute('data-segment') || '').toLowerCase();
                let normalizedRowSegment = rowSegment;
                if (rowSegment === 'full game') normalizedRowSegment = 'full';
                
                if (normalizedRowSegment !== filters.pick.segment.toLowerCase()) return false;
            }

            return true;
        },

        /**
         * Apply filters to table (debounced for performance)
         */
        applyFilters: (function() {
            // Create debounced version of the actual filter application
            let debouncedApply = null;

            return function() {
                // Lazy-init debounced function (SharedUtils may not be loaded yet)
                if (!debouncedApply && window.SharedUtils?.debounce) {
                    debouncedApply = window.SharedUtils.debounce(function() {
                        if (window.PicksTableRenderer) {
                            window.PicksTableRenderer.updateTable();
                        }
                    }, 150);
                }

                // Use debounced version if available, otherwise apply immediately
                if (debouncedApply) {
                    debouncedApply();
                } else if (window.PicksTableRenderer) {
                    window.PicksTableRenderer.updateTable();
                } else {
                    console.warn('PicksTableRenderer not loaded');
                }
            };
        })(),

        /**
         * Apply specific filter type
         */
        applyFilter(type, options = {}) {
            // Update state based on filter type
            switch(type) {
                case 'date':
                    this.syncDateFilterStateFromUI();
                    break;
                case 'matchup':
                    this.syncMatchupFilterStateFromUI();
                    break;
                case 'pick':
                    this.syncPickFilterStateFromUI();
                    break;
                case 'risk':
                    this.syncRiskFilterStateFromUI();
                    break;
                case 'status':
                    this.syncStatusFilterStateFromUI();
                    break;
            }

            // Apply all filters
            this.applyFilters();

            // Announce change for accessibility
            if (window.PicksTableRenderer) {
                const count = this.countVisibleRows();
                window.PicksTableRenderer.announceFilterChange(
                    `Filter applied. ${count} rows visible.`
                );
            }
        },

        /**
         * Reset specific filter
         */
        resetFilter(type) {
            if (window.PicksStateManager) {
                window.PicksStateManager.resetFilter(type);
            }

            // Clear UI elements
            this.clearFilterUI(type);

            // Re-apply filters
            this.applyFilters();
        },

        /**
         * Clear filter by chip
         */
        clearFilterByChip(type, subtype) {
            if (type === 'date' && subtype) {
                // Clear specific date filter subtype
                const stateKey = this.DATE_FILTER_GROUP_MAP[subtype];
                if (stateKey) {
                    window.tableState.filters.date[stateKey] = null;
                }
            } else {
                // Clear entire filter type
                this.resetFilter(type);
            }

            this.applyFilters();
        },

        /**
         * Sync date filter state from UI
         */
        syncDateFilterStateFromUI() {
            const container = document.getElementById('date-filter-options');
            if (!container) return;

            const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
            const grouped = { dates: [], times: [], books: [] };

            checkboxes.forEach(cb => {
                if (cb.id === 'date-select-all') return;

                const group = cb.getAttribute('data-group');
                const value = cb.value;

                if (group && value && grouped[group]) {
                    grouped[group].push(value);
                }
            });

            // Update state
            window.tableState.filters.date.selectedDates = grouped.dates.length > 0 ? grouped.dates : null;
            window.tableState.filters.date.selectedTimes = grouped.times.length > 0 ? grouped.times : null;
            window.tableState.filters.date.selectedBooks = grouped.books.length > 0 ? grouped.books : null;
        },

        /**
         * Sync matchup filter state from UI
         */
        syncMatchupFilterStateFromUI() {
            const leagueSelect = document.getElementById('league-select');
            const teamsList = document.getElementById('teams-list');

            if (leagueSelect) {
                window.tableState.filters.matchup.league = leagueSelect.value;
            }

            if (teamsList) {
                const checkedTeams = teamsList.querySelectorAll('input[type="checkbox"]:checked');
                const teams = Array.from(checkedTeams)
                    .filter(cb => cb.id !== 'teams-select-all')
                    .map(cb => cb.value);

                window.tableState.filters.matchup.selectedTeams =
                    teams.length > 0 ? teams : null;
            }

            // Get ticket type
            const ticketType = document.querySelector('input[name="ticket-type"]:checked');
            if (ticketType) {
                window.tableState.filters.matchup.ticketType = ticketType.value;
            }
        },

        /**
         * Sync pick filter state from UI
         */
        syncPickFilterStateFromUI() {
            const betTypeSelect = document.getElementById('bet-type-select');
            const subtypeSelect = document.getElementById('subtype-select');
            const segmentSelect = document.getElementById('segment-select');

            if (betTypeSelect) {
                window.tableState.filters.pick.betType = betTypeSelect.value;
            }

            if (subtypeSelect) {
                window.tableState.filters.pick.subtype = subtypeSelect.value;
            }

            if (segmentSelect) {
                window.tableState.filters.pick.segment = segmentSelect.value;
            }
        },

        /**
         * Sync risk filter state from UI
         */
        syncRiskFilterStateFromUI() {
            const riskContainer = document.getElementById('risk-ranges');
            const winContainer = document.getElementById('win-ranges');

            if (riskContainer) {
                const checked = riskContainer.querySelectorAll('input[type="checkbox"]:checked');
                const ranges = Array.from(checked).map(cb => cb.value);
                window.tableState.filters.risk.selectedRiskRanges = ranges;
            }

            if (winContainer) {
                const checked = winContainer.querySelectorAll('input[type="checkbox"]:checked');
                const ranges = Array.from(checked).map(cb => cb.value);
                window.tableState.filters.risk.selectedWinRanges = ranges;
            }
        },

        /**
         * Sync status filter state from UI
         */
        syncStatusFilterStateFromUI() {
            const container = document.getElementById('status-filter-options');
            if (!container) return;

            const checked = container.querySelectorAll('input[type="checkbox"]:checked');
            const statuses = Array.from(checked).map(cb => cb.value);

            window.tableState.filters.status = statuses;
        },

        /**
         * Clear filter UI elements
         */
        clearFilterUI(type) {
            switch(type) {
                case 'date':
                    const dateChecks = document.querySelectorAll('#date-filter-options input[type="checkbox"]');
                    dateChecks.forEach(cb => cb.checked = false);
                    break;
                case 'matchup':
                    const leagueSelect = document.getElementById('league-select');
                    if (leagueSelect) leagueSelect.value = '';
                    const teamChecks = document.querySelectorAll('#teams-list input[type="checkbox"]');
                    teamChecks.forEach(cb => cb.checked = false);
                    break;
                case 'pick':
                    const betTypeSelect = document.getElementById('bet-type-select');
                    if (betTypeSelect) betTypeSelect.value = '';
                    const subtypeSelect = document.getElementById('subtype-select');
                    if (subtypeSelect) subtypeSelect.value = '';
                    const segmentSelect = document.getElementById('segment-select');
                    if (segmentSelect) segmentSelect.value = '';
                    break;
                case 'risk':
                    const riskChecks = document.querySelectorAll('#risk-ranges input[type="checkbox"], #win-ranges input[type="checkbox"]');
                    riskChecks.forEach(cb => cb.checked = false);
                    break;
                case 'status':
                    const statusChecks = document.querySelectorAll('#status-filter-options input[type="checkbox"]');
                    statusChecks.forEach(cb => cb.checked = false);
                    break;
            }
        },

        /**
         * Count visible rows after filtering
         */
        countVisibleRows() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return 0;

            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');
            return Array.from(rows).filter(row => row.style.display !== 'none').length;
        }
    };

    // Export to global scope
    window.PicksFilterManager = FilterManager;

})();