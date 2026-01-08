/* ==========================================================================
   TABLE FILTERS MODULE v1.1
   --------------------------------------------------------------------------
   UI initialization and dropdown bindings for the dashboard filter system.

   ARCHITECTURE NOTE:
   This module handles:
   - Filter dropdown UI initialization (opening/closing dropdowns)
   - Checkbox and pill click handlers
   - Filter chip rendering in the UI
   - Initial tableState shape setup

   For actual filtering logic (passesAllFilters, applyFilter, etc.),
   see picks-filter-manager.js which exports window.PicksFilterManager.

   Related modules:
   - picks-filter-manager.js: Core filtering logic, used by table renderer
   - picks-state-manager.js: State persistence and updates
   - picks-table-renderer.js: Table rendering with filter application
   ========================================================================== */
(function() {
    'use strict';

    // ===== DEBUG HELPER =====
    const debug = (...args) => {
        // Always log for now to debug the issue
        console.log('🔍 [Filters]', ...args);
    };

    // ===== FILTER STATE =====
    // Ensure global tableState exists with proper shape
    if (typeof window.tableState === 'undefined') {
        window.tableState = {
            filters: {
                date: {
                    start: null,
                    end: null,
                    selectedDates: null,
                    selectedTimes: null,
                    selectedBooks: null,
                    activeRange: 'all' // 'today', 'week', 'month', 'custom', 'all'
                },
                matchup: { league: '', selectedTeams: null, ticketType: 'all' },
                pick: { betType: '', subtype: '', segment: '' },
                risk: { min: null, max: null, selectedRiskRanges: [], selectedWinRanges: [] },
                status: []
            },
            sort: { column: null, direction: 'asc' }
        };
    }

    // ===== CONFIGURATION =====
    const CONFIG = {
        DATE_GROUP_MAP: {
            dates: 'selectedDates',
            times: 'selectedTimes',
            books: 'selectedBooks'
        },
        DATE_GROUP_LABELS: {
            dates: 'Dates',
            times: 'Times',
            books: 'Sportsbooks'
        },
        STATUS_NORMALIZE_MAP: {
            'pending': 'pending',
            'live': 'live',
            'on-track': 'on-track',
            'on track': 'on-track',
            'ontrack': 'on-track',
            'at-risk': 'at-risk',
            'at risk': 'at-risk',
            'atrisk': 'at-risk',
            'win': 'win',
            'winner': 'win',
            'won': 'win',
            'loss': 'loss',
            'lost': 'loss',
            'loser': 'loss',
            'push': 'push',
            'tie': 'push'
        },
        LEAGUE_LABELS: {
            'nfl': 'NFL', 'nba': 'NBA', 'ncaaf': 'NCAAF', 'ncaab': 'NCAAB',
            'mlb': 'MLB', 'nhl': 'NHL', 'mls': 'MLS', 'epl': 'EPL'
        }
    };

    // ===== UTILITY FUNCTIONS =====
    
    function normalizeFilterValue(value) {
        return (value ?? '').toString().trim().toLowerCase();
    }

    function normalizeStatus(status) {
        const key = normalizeFilterValue(status);
        return CONFIG.STATUS_NORMALIZE_MAP[key] || key;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function parseRangeBound(attr, fallback) {
        if (attr === undefined || attr === null || attr === '') return fallback;
        if (attr === 'inf') return Number.POSITIVE_INFINITY;
        const parsed = parseFloat(attr);
        return Number.isNaN(parsed) ? fallback : parsed;
    }

    // ===== STATE SHAPE VALIDATORS =====

    function ensureDateFilterShape() {
        const filters = window.tableState.filters;
        if (!filters.date || typeof filters.date !== 'object') {
            filters.date = createDateFilterState();
            return;
        }
        const df = filters.date;
        if (!('start' in df)) df.start = null;
        if (!('end' in df)) df.end = null;
        if (!('selectedDates' in df)) df.selectedDates = null;
        if (!('selectedTimes' in df)) df.selectedTimes = null;
        if (!('selectedBooks' in df)) df.selectedBooks = null;
        if (!('activeRange' in df)) df.activeRange = 'all';
    }

    function createDateFilterState() {
        return {
            start: null, end: null,
            selectedDates: null, selectedTimes: null, selectedBooks: null,
            activeRange: 'all'
        };
    }

    function ensureMatchupFilterShape() {
        const filters = window.tableState.filters;
        if (!filters.matchup || typeof filters.matchup !== 'object') {
            filters.matchup = { league: '', selectedTeams: null, ticketType: 'all' };
            return;
        }
        if (!('ticketType' in filters.matchup)) filters.matchup.ticketType = 'all';
        if (!('selectedTeams' in filters.matchup)) filters.matchup.selectedTeams = null;
        if (!('league' in filters.matchup)) filters.matchup.league = '';
    }

    function ensureRiskFilterShape() {
        const filters = window.tableState.filters;
        if (!filters.risk || typeof filters.risk !== 'object') {
            filters.risk = { min: null, max: null, selectedRiskRanges: [], selectedWinRanges: [] };
            return;
        }
        const rf = filters.risk;
        if (!('min' in rf)) rf.min = null;
        if (!('max' in rf)) rf.max = null;
        if (!Array.isArray(rf.selectedRiskRanges)) rf.selectedRiskRanges = [];
        if (!Array.isArray(rf.selectedWinRanges)) rf.selectedWinRanges = [];
    }

    // Initialize state shapes
    ensureDateFilterShape();
    ensureMatchupFilterShape();
    ensureRiskFilterShape();

    // ===== DATA EXTRACTION =====

    function getDateTimeParts(row) {
        const datetimeCell = row.querySelector('.datetime-cell');
        // Legacy fallback: if .datetime-cell not found, try getting data-label="Date & Time"
        const cell = datetimeCell || row.querySelector('td[data-label="Date & Time"]');
        
        if (!cell) {
            debug('No date/time cell found in row');
            return { dateText: '', timeText: '', sportsbookText: '' };
        }

        const dateEl = cell.querySelector('.cell-date') || cell.querySelector('.date-value');
        const timeEl = cell.querySelector('.cell-time') || cell.querySelector('.time-value');
        const bookEl = cell.querySelector('.sportsbook-value');

        const result = {
            dateText: dateEl?.textContent?.trim() || '',
            timeText: timeEl?.textContent?.trim() || '',
            sportsbookText: bookEl?.textContent?.trim() || ''
        };

        // Debug log for first few calls
        if (window._dateTimeDebugCount === undefined) window._dateTimeDebugCount = 0;
        if (window._dateTimeDebugCount < 3) {
            console.log('📅 getDateTimeParts result:', result);
            window._dateTimeDebugCount++;
        }

        return result;
    }

    function getDateValue(row) {
        const epoch = row.getAttribute('data-epoch');
        if (epoch) return new Date(parseInt(epoch, 10));
        
        const { dateText } = getDateTimeParts(row);
        if (dateText) return new Date(dateText);
        
        return null;
    }

    function getStatusKey(row) {
        const statusAttr = row.getAttribute('data-status');
        if (statusAttr) return normalizeStatus(statusAttr);

        const badge = row.querySelector('.status-badge');
        if (badge) {
            const badgeStatus = badge.getAttribute('data-status');
            if (badgeStatus) return normalizeStatus(badgeStatus);
            return normalizeStatus(badge.textContent);
        }
        return '';
    }

    function getPickValue(row) {
        const pickCell = row.querySelector('.pick-cell');
        if (!pickCell) return '';
        return pickCell.textContent?.trim() || '';
    }

    function getSegmentFromRow(row) {
        const segAttr = row.getAttribute('data-segment');
        if (segAttr) return segAttr.toLowerCase();

        const segCell = row.querySelector('.game-segment');
        if (segCell) {
            const text = segCell.textContent?.trim().toLowerCase() || '';
            if (text.includes('full')) return 'full-game';
            if (text.includes('1h') || text.includes('first half')) return '1h';
            if (text.includes('2h') || text.includes('second half')) return '2h';
            if (text.includes('multi')) return 'multi';
            return text;
        }
        return '';
    }

    function getRiskValue(row) {
        const riskAttr = row.getAttribute('data-risk');
        if (riskAttr) return parseFloat(riskAttr) || 0;

        const riskEl = row.querySelector('.risk-amount');
        if (riskEl) {
            const text = riskEl.textContent?.replace(/[$,]/g, '') || '0';
            return parseFloat(text) || 0;
        }
        return 0;
    }

    function getWinValue(row) {
        const winAttr = row.getAttribute('data-win');
        if (winAttr) return parseFloat(winAttr) || 0;

        const winEl = row.querySelector('.win-amount');
        if (winEl) {
            const text = winEl.textContent?.replace(/[$,]/g, '') || '0';
            return parseFloat(text) || 0;
        }
        return 0;
    }

    // ===== FILTER LOGIC =====

    function valueMatchesRangeList(ranges, value) {
        if (!Array.isArray(ranges) || !ranges.length) return true;
        return ranges.some(range => {
            const min = typeof range.min === 'number' ? range.min : 0;
            const max = typeof range.max === 'number' ? range.max : Number.POSITIVE_INFINITY;
            return value >= min && value <= max;
        });
    }

    /**
     * Core filter check - determines if a row passes all active filters
     */
    function passesAllFilters(row) {
        const filters = window.tableState.filters;

        // === DATE FILTER ===
        if (filters.date) {
            const df = filters.date;
            const { dateText, timeText, sportsbookText } = getDateTimeParts(row);

            // Checkbox-based selections
            if (Array.isArray(df.selectedDates) && df.selectedDates.length > 0) {
                // The selectedDates are already normalized, so we just need to normalize the cell text
                const normalizedDate = normalizeFilterValue(dateText);
                const passes = df.selectedDates.includes(normalizedDate);
                if (!passes) {
                    debug(`Date filter failed: "${dateText}" (normalized: "${normalizedDate}") not in`, df.selectedDates);
                    return false;
                }
            }
            if (Array.isArray(df.selectedTimes) && df.selectedTimes.length > 0) {
                // The selectedTimes are already normalized
                const normalizedTime = normalizeFilterValue(timeText);
                const passes = df.selectedTimes.includes(normalizedTime);
                if (!passes) {
                    debug(`Time filter failed: "${timeText}" (normalized: "${normalizedTime}") not in`, df.selectedTimes);
                    return false;
                }
            }
            if (Array.isArray(df.selectedBooks) && df.selectedBooks.length > 0) {
                // The selectedBooks are already normalized
                const normalizedBook = normalizeFilterValue(sportsbookText);
                const passes = df.selectedBooks.includes(normalizedBook);
                if (!passes) {
                    debug(`Book filter failed: "${sportsbookText}" (normalized: "${normalizedBook}") not in`, df.selectedBooks);
                    return false;
                }
            }

            // Date range (from date toggles or custom range)
            if (df.start || df.end) {
                const rowDate = getDateValue(row);
                if (rowDate) {
                    if (df.start && rowDate < df.start) return false;
                    if (df.end && rowDate > df.end) return false;
                }
            }
        }

        // === MATCHUP FILTER ===
        const mf = filters.matchup;
        if (mf && (mf.league || mf.selectedTeams || (mf.ticketType && mf.ticketType !== 'all'))) {
            const rowLeague = (row.getAttribute('data-league') || '').toLowerCase();
            const awayTeam = (row.getAttribute('data-away') || '').toLowerCase();
            const homeTeam = (row.getAttribute('data-home') || '').toLowerCase();
            const rowPickType = (row.getAttribute('data-pick-type') || '').toLowerCase();

            if (mf.league && rowLeague !== mf.league) return false;

            if (mf.selectedTeams && mf.selectedTeams.length > 0) {
                const selectedSet = new Set(mf.selectedTeams);
                if (!selectedSet.has(awayTeam) && !selectedSet.has(homeTeam)) return false;
            }

            if (mf.ticketType && mf.ticketType !== 'all') {
                if (mf.ticketType === 'straight' && rowPickType === 'parlay') return false;
                if (mf.ticketType === 'multi' && rowPickType !== 'parlay') return false;
                if (mf.ticketType === 'props' && rowPickType !== 'prop') return false;
            }
        }

        // === PICK FILTER ===
        const pf = filters.pick;
        if (pf && (pf.betType || pf.subtype || pf.segment)) {
            const rowType = (row.getAttribute('data-pick-type') || '').toLowerCase();
            const rowSeg = getSegmentFromRow(row);
            const pickText = getPickValue(row).toLowerCase();

            if (pf.betType && pf.betType !== 'all') {
                if (rowType !== pf.betType) return false;
            }

            if (pf.segment && pf.segment !== 'all') {
                if (pf.segment === 'multi' && rowSeg !== 'multi') return false;
                else if (pf.segment !== 'multi' && rowSeg !== pf.segment) return false;
            }

            if (pf.subtype) {
                if (!pickText.includes(pf.subtype)) return false;
            }
        }

        // === RISK FILTER ===
        const rf = filters.risk;
        if (rf) {
            const riskVal = getRiskValue(row);
            const winVal = getWinValue(row);

            if (rf.selectedRiskRanges && rf.selectedRiskRanges.length > 0) {
                if (!valueMatchesRangeList(rf.selectedRiskRanges, riskVal)) return false;
            }
            if (rf.selectedWinRanges && rf.selectedWinRanges.length > 0) {
                if (!valueMatchesRangeList(rf.selectedWinRanges, winVal)) return false;
            }
            if (rf.min !== null && riskVal < rf.min) return false;
            if (rf.max !== null && riskVal > rf.max) return false;
        }

        // === STATUS FILTER ===
        if (filters.status && filters.status.length > 0) {
            const rowStatus = getStatusKey(row);
            const normalizedStatuses = filters.status.map(normalizeStatus);
            if (!normalizedStatuses.includes(rowStatus)) return false;
        }

        return true;
    }

    // ===== DATE RANGE HELPERS (for date toggles) =====

    function calculateDateRange(range, customStart = null, customEnd = null) {
        const now = new Date();
        let start = null, end = null;

        switch (range) {
            case 'today':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                start = new Date(now);
                start.setDate(now.getDate() - dayOfWeek);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'custom':
                start = customStart;
                end = customEnd;
                break;
            case 'all':
            default:
                start = null;
                end = null;
                break;
        }

        return { start, end };
    }

    function setDateRange(range, customStart = null, customEnd = null) {
        const { start, end } = calculateDateRange(range, customStart, customEnd);
        window.tableState.filters.date.start = start;
        window.tableState.filters.date.end = end;
        window.tableState.filters.date.activeRange = range;
        debug('Date range set:', range, { start, end });
    }

    // ===== FILTER APPLICATION =====

    function applyFiltersToTable() {
        console.log('🎯 TableFilters.applyFiltersToTable() called');
        const tbody = document.getElementById('picks-tbody');
        if (!tbody) {
            console.error('❌ picks-tbody not found');
            return;
        }

        const rows = Array.from(tbody.querySelectorAll('tr:not(.parlay-legs)'));
        console.log(`📊 Processing ${rows.length} table rows`);

        let visibleCount = 0;
        let hiddenCount = 0;

        rows.forEach((row, index) => {
            const shouldShow = passesAllFilters(row);

            // Debug first few rows
            if (index < 3) {
                const { dateText, timeText, sportsbookText } = getDateTimeParts(row);
                console.log(`Row ${index}: Date="${dateText}", Time="${timeText}", Book="${sportsbookText}", Show=${shouldShow}`);
            }

            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
                // Handle parlay legs visibility
                const legsRow = row.nextElementSibling;
                if (legsRow && legsRow.classList.contains('parlay-legs')) {
                    const isExpanded = row.getAttribute('aria-expanded') === 'true';
                    legsRow.style.display = isExpanded ? 'table-row' : 'none';
                }
            } else {
                row.style.display = 'none';
                hiddenCount++;
                // Auto-collapse parlay legs when parent is hidden
                const legsRow = row.nextElementSibling;
                if (legsRow && legsRow.classList.contains('parlay-legs')) {
                    legsRow.style.display = 'none';
                    row.setAttribute('aria-expanded', 'false');
                }
            }
        });

        console.log(`✅ Filter results: ${visibleCount} visible, ${hiddenCount} hidden`);

        // Update zebra stripes
        if (window.ZebraStripes?.debouncedApply) {
            window.ZebraStripes.debouncedApply();
        } else if (window.__gbsvApplyZebraStripes) {
            window.__gbsvApplyZebraStripes();
        }

        // Update filter chips
        renderFilterChips();

        // Update header indicators
        updateFilterIndicators();

        // Announce to screen readers
        announceFilterChange('Filters applied');

        debug('Filters applied to', rows.length, 'rows');
    }

    // ===== FILTER INDICATORS =====

    function updateFilterIndicators() {
        const filters = window.tableState.filters;

        // Date header
        const dateHeader = document.querySelector('th.date-time-header');
        if (dateHeader) {
            const hasFilter = filters.date && (
                filters.date.selectedDates?.length > 0 ||
                filters.date.selectedTimes?.length > 0 ||
                filters.date.selectedBooks?.length > 0 ||
                filters.date.start || filters.date.end
            );
            dateHeader.classList.toggle('has-active-filter', !!hasFilter);
        }

        // Matchup header
        const matchupHeader = document.querySelector('th.matchup-header');
        if (matchupHeader) {
            const hasFilter = filters.matchup && (
                filters.matchup.league ||
                filters.matchup.selectedTeams ||
                (filters.matchup.ticketType && filters.matchup.ticketType !== 'all')
            );
            matchupHeader.classList.toggle('has-active-filter', !!hasFilter);
        }

        // Pick header
        const pickHeader = document.querySelector('th.pick-header');
        if (pickHeader) {
            const hasFilter = filters.pick?.betType || filters.pick?.subtype;
            pickHeader.classList.toggle('has-active-filter', !!hasFilter);
        }

        // Segment header
        const segmentHeader = document.querySelector('th.segment-header');
        if (segmentHeader) {
            segmentHeader.classList.toggle('has-active-filter', !!filters.pick?.segment);
        }

        // Risk header
        const riskHeader = document.querySelector('th.risk-win-header');
        if (riskHeader) {
            const rf = filters.risk || {};
            const hasFilter = rf.min != null || rf.max != null ||
                (Array.isArray(rf.selectedRiskRanges) && rf.selectedRiskRanges.length > 0) ||
                (Array.isArray(rf.selectedWinRanges) && rf.selectedWinRanges.length > 0);
            riskHeader.classList.toggle('has-active-filter', !!hasFilter);
        }

        // Status header
        const statusHeader = document.querySelector('th.status-header');
        if (statusHeader) {
            statusHeader.classList.toggle('has-active-filter', filters.status?.length > 0);
        }
    }

    // ===== FILTER CHIPS =====

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
    });

    function formatDateForChip(dateObj) {
        if (!(dateObj instanceof Date) || isNaN(dateObj)) return '';
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatSelectionLabel(values, label) {
        if (!Array.isArray(values) || values.length === 0) return '';
        if (values.length <= 3) return `${label}: ${values.join(', ')}`;
        return `${label}: ${values.length} selected`;
    }

    function renderFilterChips() {
        const container = document.getElementById('table-filter-chips');
        if (!container) return;

        const chips = [];
        const filters = window.tableState.filters;

        // Date chips
        const df = filters.date || {};
        const dateParts = [];
        if (df.selectedDates?.length) dateParts.push(formatSelectionLabel(df.selectedDates, 'Dates'));
        if (df.selectedTimes?.length) dateParts.push(formatSelectionLabel(df.selectedTimes, 'Times'));
        if (df.selectedBooks?.length) dateParts.push(formatSelectionLabel(df.selectedBooks, 'Books'));

        if (dateParts.length) {
            chips.push({ type: 'date', label: dateParts.join(' • ') });
        } else if (df.start || df.end) {
            let label = df.activeRange !== 'custom' && df.activeRange !== 'all'
                ? df.activeRange.charAt(0).toUpperCase() + df.activeRange.slice(1)
                : '';
            if (!label && df.start && df.end) {
                label = `${formatDateForChip(df.start)} – ${formatDateForChip(df.end)}`;
            }
            if (label) chips.push({ type: 'date', label: `Date: ${label}` });
        }

        // Matchup chips
        const mf = filters.matchup;
        if (mf && (mf.league || mf.selectedTeams || (mf.ticketType && mf.ticketType !== 'all'))) {
            const parts = [];
            if (mf.league) parts.push(CONFIG.LEAGUE_LABELS[mf.league] || mf.league.toUpperCase());
            if (mf.selectedTeams?.length > 0) {
                parts.push(mf.selectedTeams.length <= 2 
                    ? mf.selectedTeams.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                    : `${mf.selectedTeams.length} teams`);
            }
            if (mf.ticketType && mf.ticketType !== 'all') {
                const labels = { 'straight': 'Straight', 'multi': 'Parlay', 'props': 'Props' };
                parts.push(labels[mf.ticketType] || mf.ticketType);
            }
            if (parts.length) chips.push({ type: 'matchup', label: `Matchup: ${parts.join(' • ')}` });
        }

        // Pick chips
        const pf = filters.pick;
        if (pf?.betType) {
            const labels = { 'spread': 'Spread', 'moneyline': 'ML', 'total': 'O/U', 'team-total': 'TT' };
            chips.push({ type: 'pick', label: `Pick: ${labels[pf.betType] || pf.betType}` });
        }
        if (pf?.segment) {
            const labels = { 'full-game': 'Full Game', '1h': '1H', '2h': '2H', 'multi': 'Parlay' };
            chips.push({ type: 'segment', label: `Segment: ${labels[pf.segment] || pf.segment}` });
        }

        // Risk chips
        const rf = filters.risk;
        if (rf?.selectedRiskRanges?.length || rf?.selectedWinRanges?.length) {
            const parts = [];
            if (rf.selectedRiskRanges?.length) parts.push(`Risk: ${rf.selectedRiskRanges.length} ranges`);
            if (rf.selectedWinRanges?.length) parts.push(`Win: ${rf.selectedWinRanges.length} ranges`);
            chips.push({ type: 'risk', label: parts.join(' • ') });
        }

        // Status chips
        if (filters.status?.length) {
            const labels = filters.status.map(s => s.charAt(0).toUpperCase() + s.slice(1));
            chips.push({ type: 'status', label: `Status: ${labels.join(', ')}` });
        }

        // Render
        container.innerHTML = '';
        container.setAttribute('data-has-chips', chips.length > 0 ? 'true' : 'false');

        chips.forEach(chip => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-chip-btn';
            btn.textContent = chip.label;
            btn.setAttribute('aria-label', `Remove ${chip.label} filter`);
            btn.addEventListener('click', () => clearFilterByType(chip.type));
            container.appendChild(btn);
        });
    }

    // ===== FILTER RESET =====

    function clearFilterByType(type) {
        const filters = window.tableState.filters;

        switch (type) {
            case 'date':
                filters.date = createDateFilterState();
                resetDateToggleUI();
                resetDateFilterDropdownUI();
                break;
            case 'matchup':
                filters.matchup = { league: '', selectedTeams: null, ticketType: 'all' };
                resetMatchupFilterUI();
                break;
            case 'pick':
                filters.pick.betType = '';
                filters.pick.subtype = '';
                resetPickFilterUI();
                break;
            case 'segment':
                filters.pick.segment = '';
                resetSegmentFilterUI();
                break;
            case 'risk':
                filters.risk = { min: null, max: null, selectedRiskRanges: [], selectedWinRanges: [] };
                resetRiskFilterUI();
                break;
            case 'status':
                filters.status = [];
                resetStatusFilterUI();
                break;
        }

        applyFiltersToTable();
        debug('Cleared filter:', type);
    }

    function clearAllFilters() {
        window.tableState.filters = {
            date: createDateFilterState(),
            matchup: { league: '', selectedTeams: null, ticketType: 'all' },
            pick: { betType: '', subtype: '', segment: '' },
            risk: { min: null, max: null, selectedRiskRanges: [], selectedWinRanges: [] },
            status: []
        };
        resetAllFilterUIs();
        applyFiltersToTable();
        debug('All filters cleared');
    }

    // ===== UI RESET HELPERS =====

    function resetDateToggleUI() {
        const buttons = document.querySelectorAll('.date-toggle-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        const allBtn = document.querySelector('.date-toggle-btn[data-range="all"]');
        if (allBtn) allBtn.classList.add('active');

        const customRange = document.querySelector('.custom-date-range');
        if (customRange) customRange.classList.remove('active');
    }

    function resetDateFilterDropdownUI() {
        const dropdown = document.getElementById('filter-date');
        if (!dropdown) return;
        dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        const selectAll = dropdown.querySelector('#filter-date-select-all');
        if (selectAll) {
            selectAll.checked = true;
            selectAll.indeterminate = false;
        }
    }

    function resetMatchupFilterUI() {
        const leagueSelect = document.getElementById('matchup-league-select');
        if (leagueSelect) leagueSelect.value = '';

        document.querySelectorAll('input[name="matchup-ticket-type"]').forEach(r => {
            r.checked = r.value === 'all';
        });

        const teamsCard = document.getElementById('matchup-teams-card');
        if (teamsCard) teamsCard.setAttribute('data-visible', 'false');

        const selectAll = document.getElementById('filter-matchup-select-all');
        if (selectAll) { selectAll.checked = true; selectAll.indeterminate = false; }
    }

    function resetPickFilterUI() {
        document.querySelectorAll('input[name="pick-bet-type"]').forEach(r => {
            r.checked = r.value === 'all';
        });
    }

    function resetSegmentFilterUI() {
        document.querySelectorAll('input[name="segment-select"]').forEach(r => {
            r.checked = r.value === 'all';
        });
    }

    function resetRiskFilterUI() {
        document.querySelectorAll('input[name="risk-range"], input[name="win-range"]').forEach(cb => {
            cb.checked = false;
        });
    }

    function resetStatusFilterUI() {
        document.querySelectorAll('input[name="status-filter"]').forEach(cb => {
            cb.checked = false;
        });
    }

    function resetAllFilterUIs() {
        resetDateToggleUI();
        resetDateFilterDropdownUI();
        resetMatchupFilterUI();
        resetPickFilterUI();
        resetSegmentFilterUI();
        resetRiskFilterUI();
        resetStatusFilterUI();
    }

    // ===== ACCESSIBILITY =====

    function announceFilterChange(message) {
        const container = document.getElementById('table-filter-chips');
        if (container) {
            container.setAttribute('aria-label', message);
        }
    }

    // ===== PUBLIC API =====

    window.TableFilters = {
        // State
        getState: () => window.tableState.filters,
        
        // Core
        passesAllFilters,
        applyFilters: applyFiltersToTable,
        clearFilter: clearFilterByType,
        clearAll: clearAllFilters,
        
        // Date range helpers
        setDateRange,
        calculateDateRange,
        
        // State validators
        ensureDateFilterShape,
        ensureMatchupFilterShape,
        ensureRiskFilterShape,
        
        // Utilities
        normalizeFilterValue,
        normalizeStatus,
        
        // Data extraction
        getDateTimeParts,
        getStatusKey,
        getPickValue,
        getSegmentFromRow,
        getRiskValue,
        getWinValue,
        
        // UI
        updateFilterIndicators,
        renderFilterChips,
        
        // Config
        CONFIG
    };

    // Backward compatibility
    window.updateTableWithFilters = applyFiltersToTable;
    window.passesAllFilters = passesAllFilters;
    window.updateFilterIndicators = updateFilterIndicators;
    window.renderFilterChips = renderFilterChips;

    debug('TableFilters module loaded');

})();
