/* ==========================================================================
   TABLE FILTERS MODULE v2.0 (Card-Based)
   --------------------------------------------------------------------------
   UI initialization and bindings for the new card-based filter system.
   ========================================================================== */
(function() {
    'use strict';

    const debug = (...args) => {
        if (window.APP_CONFIG?.DEBUG_MODE) console.log('🔍 [Filters]', ...args);
    };

    // ===== INITIALIZATION =====
    function init() {
        debug('Initializing card-based filters...');
        bindFilterEvents();
        // Initial state check
        updateActiveStatesFromConfig();
    }

    // ===== EVENT BINDING =====
    function bindFilterEvents() {
        // 1. Date Filter Pills
        document.querySelectorAll('.filter-card[data-filter-type="date"] .filter-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.target.dataset.range;
                handleDateFilter(range);
                updatePillState(e.target, '.filter-card[data-filter-type="date"] .filter-pill');
            });
        });

        // 2. League Icon Buttons
        document.querySelectorAll('.filter-card[data-filter-type="league"] .filter-icon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.currentTarget; // Use currentTarget for button with img inside
                const league = btnEl.dataset.league;
                handleLeagueFilter(league);
                updatePillState(btnEl, '.filter-card[data-filter-type="league"] .filter-icon-btn');
            });
        });

        // 3. Segment Filter Pills
        document.querySelectorAll('.filter-card[data-filter-type="segment"] .filter-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const segment = e.target.dataset.segment;
                handleSegmentFilter(segment);
                updatePillState(e.target, '.filter-card[data-filter-type="segment"] .filter-pill');
            });
        });

        // 4. Search Input
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                handleSearchFilter(e.target.value);
            }, 300));
        }
    }

    // ===== UI UPDATES =====
    function updatePillState(activeBtn, selector) {
        document.querySelectorAll(selector).forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    function updateActiveStatesFromConfig() {
        // Sync UI with current window.tableState if needed on reload
        // For now, we assume default state matches HTML 'active' classes
    }

    // ===== FILTER HANDLERS =====
    
    function handleDateFilter(range) {
        debug('Date filter selected:', range);
        if (window.TableFilters && window.TableFilters.setDateRange) {
            window.TableFilters.setDateRange(range);
        }
        applyFilters();
    }

    function handleLeagueFilter(league) {
        debug('League filter selected:', league);
        if (window.tableState && window.tableState.filters) {
            window.tableState.filters.matchup.league = (league === 'all') ? '' : league;
        }
        applyFilters();
    }

    function handleSegmentFilter(segment) {
        debug('Segment filter selected:', segment);
        if (window.tableState && window.tableState.filters) {
            window.tableState.filters.pick.segment = (segment === 'all') ? '' : segment;
        }
        applyFilters();
    }

    function handleSearchFilter(query) {
        debug('Search query:', query);
        if (window.tableState && window.tableState.filters) {
            window.tableState.filters.search = query.toLowerCase();
        }
        applyFilters();
    }

    function applyFilters() {
        if (window.PicksFilterManager && window.PicksFilterManager.applyFilters) {
            window.PicksFilterManager.applyFilters();
        } else if (window.TableFilters && window.TableFilters.applyFilters) {
            window.TableFilters.applyFilters();
        }
    }

    // ===== UTILS =====
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
