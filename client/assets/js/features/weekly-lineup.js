/**
 * Weekly Lineup Dashboard Controller
 * Orchestrates pick data, team records, and filtering logic
 * v2.1: Use SportsDataIO proxy for NFL/NCAAF schedules
 * v2.2: Parallel fetching to resolve performance bottlenecks
 * v2.3: Integrated with AutoGameFetcher for real-time scores
 */

const WeeklyLineup = (function() {
    'use strict';

    // State management
    let state = {
        allPicks: [],
        filteredPicks: [],
        teamRecords: {},
        sportsDataGames: {},
        loading: true,
        filters: {
            sport: 'ALL',
            type: 'ALL',
            status: 'ALL',
            dateRange: 'today',
            sortBy: 'confidence',
            sortOrder: 'desc'
        },
        refreshInterval: null
    };

    /**
     * Initialize the component
     */
    async function init() {
        console.log('[WEEKLY-LINEUP] Initializing...');
        
        try {
            renderLoadingState();
            
            // Initial data fetch
            await fetchData();
            
            // Set up UI components
            setupEventListeners();
            startAutoRefresh();
            
            console.log('[WEEKLY-LINEUP] Initialization complete');
        } catch (error) {
            console.error('[WEEKLY-LINEUP] Init failed:', error);
            renderErrorState(error.message);
        }
    }

    /**
     * Fetch all necessary data in parallel
     */
    async function fetchData() {
        state.loading = true;
        
        try {
            // Fetch from multiple sources simultaneously
            const [picks, records, games] = await Promise.all([
                fetchPicksFromCosmos(),
                fetchTeamRecordsFromStandings(),
                fetchTodaysSchedule()
            ]);
            
            state.allPicks = picks;
            state.teamRecords = records;
            state.sportsDataGames = games;
            
            // Apply initial filtering/sorting
            applyFilters();
            
            state.loading = false;
        } catch (error) {
            state.loading = false;
            throw error;
        }
    }

    /**
     * Fetch picks from Cosmos DB via main API
     */
    async function fetchPicksFromCosmos() {
        const url = `${window.APP_CONFIG.API_BASE_URL}/picks/weekly`;
        console.log(`[WEEKLY-LINEUP] Fetching picks from: ${url}`);
        
        const response = await fetch(url, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) throw new Error(`Picks API error: ${response.status}`);
        
        const data = await response.json();
        return Array.isArray(data) ? data : (data.picks || []);
    }

    /**
     * Fetch standings to get W-L records for context
     */
    async function fetchTeamRecordsFromStandings() {
        // Leverages the records already fetched by AutoGameFetcher
        if (window.AutoGameFetcher) {
            return window.AutoGameFetcher.getRecordsCache() || {};
        }
        return {};
    }

    /**
     * Fetch schedules from SportsDataIO via proxy for specific date range
     */
    async function fetchTodaysSchedule() {
        if (window.AutoGameFetcher) {
            const games = await window.AutoGameFetcher.fetchTodaysGames();
            // Convert array to lookup map for performance
            const gameMap = {};
            games.forEach(g => {
                const key = `${g.awayTeam}_${g.homeTeam}`.toLowerCase();
                gameMap[key] = g;
            });
            return gameMap;
        }
        return {};
    }

    /**
     * Setup UI interaction listeners
     */
    function setupEventListeners() {
        const container = document.getElementById('weekly-lineup-container');
        if (!container) return;

        // Filter changes
        container.addEventListener('change', (e) => {
            if (e.target.matches('.filter-select')) {
                const filterId = e.target.id.replace('filter-', '');
                state.filters[filterId] = e.target.value;
                applyFilters();
            }
        });

        // Search input
        const searchInput = document.getElementById('pick-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.filters.search = e.target.value.toLowerCase();
                applyFilters();
            });
        }

        // Sort headers
        container.addEventListener('click', (e) => {
            const header = e.target.closest('.sortable-header');
            if (header) {
                const sortBy = header.dataset.sort;
                if (state.filters.sortBy === sortBy) {
                    state.filters.sortOrder = state.filters.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    state.filters.sortBy = sortBy;
                    state.filters.sortOrder = 'desc';
                }
                applyFilters();
            }
        });

        // Date range buttons
        const dateRangeBtns = document.querySelectorAll('.date-range-btn');
        dateRangeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                dateRangeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.filters.dateRange = btn.dataset.range;
                applyFilters();
            });
        });
    }

    /**
     * Filter and Sort data
     */
    function applyFilters() {
        let results = [...state.allPicks];

        // 1. Sport filter
        if (state.filters.sport !== 'ALL') {
            results = results.filter(p => p.sport === state.filters.sport);
        }

        // 2. Type filter (ML, Spread, Total)
        if (state.filters.type !== 'ALL') {
            results = results.filter(p => p.pickType === state.filters.type);
        }

        // 3. Search filter
        if (state.filters.search) {
            results = results.filter(p => 
                p.awayTeam.toLowerCase().includes(state.filters.search) || 
                p.homeTeam.toLowerCase().includes(state.filters.search)
            );
        }

        // 4. Sort
        const { sortBy, sortOrder } = state.filters;
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (sortBy === 'confidence') {
                valA = parseFloat(a.confidence) || 0;
                valB = parseFloat(b.confidence) || 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        state.filteredPicks = results;
        renderPicks();
    }

    /**
     * Render the table rows
     */
    function renderPicks() {
        const tbody = document.getElementById('lineup-table-body');
        if (!tbody) return;

        if (state.filteredPicks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-5">No picks found for the selected criteria</td></tr>`;
            return;
        }

        tbody.innerHTML = state.filteredPicks.map(pick => {
            const gameInfo = getGameContext(pick);
            const confidenceClass = getConfidenceClass(pick.confidence);
            const edgeClass = (parseFloat(pick.edge) > 5) ? 'text-success fw-bold' : '';

            return `
                <tr class="pick-row ${pick.isBestBet ? 'best-bet-row' : ''}">
                    <td>
                        <div class="d-flex align-items-center">
                            <span class="sport-badge badge-${pick.sport.toLowerCase()} me-2">${pick.sport}</span>
                            <div class="team-names">
                                <div class="away-team">${pick.awayTeam} <small class="text-muted">${gameInfo.awayRecord}</small></div>
                                <div class="home-team">${pick.homeTeam} <small class="text-muted">${gameInfo.homeRecord}</small></div>
                            </div>
                        </div>
                    </td>
                    <td class="text-center">
                        <div class="pick-selection">${pick.selection}</div>
                        <div class="pick-market text-muted small">${pick.pickType} ${pick.line || ''}</div>
                    </td>
                    <td class="text-center">
                        <div class="odds">${formatOdds(pick.odds)}</div>
                    </td>
                    <td class="text-center">
                        <div class="confidence-container">
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar ${confidenceClass}" role="progressbar" style="width: ${pick.confidence}%"></div>
                            </div>
                            <span class="small">${pick.confidence}%</span>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="${edgeClass}">${pick.edge}%</span>
                    </td>
                    <td class="text-center">
                        <div class="game-status small">${gameInfo.status}</div>
                        <div class="game-time x-small text-muted">${gameInfo.time}</div>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary view-details" data-id="${pick.id}">Details</button>
                    </td>
                </tr>
            `;
        }).join('');

        updateSummaryCounter();
    }

    /**
     * Enrichment: get records and live status for a pick
     */
    function getGameContext(pick) {
        const gameKey = `${pick.awayTeam}_${pick.homeTeam}`.toLowerCase();
        const liveGame = state.sportsDataGames[gameKey] || 
                         (window.AutoGameFetcher ? window.AutoGameFetcher.findGame(pick.awayTeam, pick.homeTeam) : null);

        return {
            awayRecord: state.teamRecords[pick.awayTeam.toLowerCase()] || '',
            homeRecord: state.teamRecords[pick.homeTeam.toLowerCase()] || '',
            status: liveGame ? liveGame.status : 'Scheduled',
            time: liveGame ? liveGame.time : (pick.gameTime || 'TBD')
        };
    }

    /**
     * UI Helpers
     */
    function getConfidenceClass(conf) {
        const val = parseFloat(conf);
        if (val >= 75) return 'bg-success';
        if (val >= 60) return 'bg-primary';
        if (val >= 45) return 'bg-warning';
        return 'bg-danger';
    }

    function formatOdds(odds) {
        if (!odds) return '-';
        const num = parseInt(odds);
        return num > 0 ? `+${num}` : odds;
    }

    function updateSummaryCounter() {
        const countEl = document.getElementById('pick-count-display');
        if (countEl) {
            countEl.textContent = `${state.filteredPicks.length} Picks Found`;
        }
    }

    function renderLoadingState() {
        const tbody = document.getElementById('lineup-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-5"><div class="spinner-border text-primary"></div><p class="mt-2">Loading data...</p></td></tr>`;
        }
    }

    function renderErrorState(msg) {
        const tbody = document.getElementById('lineup-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center border-danger p-5"><div class="text-danger">⚠️ Error loading data</div><p class="small">${msg}</p></td></tr>`;
        }
    }

    /**
     * Background refresh
     */
    function startAutoRefresh() {
        if (state.refreshInterval) clearInterval(state.refreshInterval);
        state.refreshInterval = setInterval(() => {
            fetchData().catch(err => console.warn('[WEEKLY-LINEUP] Refresh failed:', err));
        }, 300000); // 5 mins
    }

    // Public API
    return {
        init,
        refresh: fetchData,
        getState: () => state
    };

})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    WeeklyLineup.init();
});

/* Additional Table Filtering Modules */

(function($) {
    'use strict';
    
    // Extends the core with dynamic UI filtering behaviors
    const TableFilters = {
        init: function() {
            this.bindEvents();
            this.handleDeepLinking();
        },
        
        bindEvents: function() {
            $(document).on('click', '.filter-pill', function() {
                const $this = $(this);
                $this.siblings().removeClass('active');
                $this.addClass('active');
                
                const filterType = $this.data('filter-type');
                const filterValue = $this.data('filter-value');
                
                $('#filter-' + filterType).val(filterValue).trigger('change');
            });
        },
        
        handleDeepLinking: function() {
            const params = new URLSearchParams(window.location.search);
            if (params.has('sport')) {
                const sport = params.get('sport').toUpperCase();
                setTimeout(() => {
                    $('#filter-sport').val(sport).trigger('change');
                    $(`.filter-pill[data-filter-value="${sport}"]`).addClass('active');
                }, 500);
            }
        }
    };

    $(function() {
        TableFilters.init();
    });
})(jQuery);

/* Lines 302-1910 omitted */

    /**
     * Handle date range selection update
     * v2.0: Optimized to use pre-filtered logical sets
     */
    function handleDateRangeSelection(range) {
        console.log('[FILTER] Updating date range:', range);
        
        const today = new Date();
        let startDate, endDate;

        switch(range) {
            case 'today':
                startDate = today;
                endDate = today;
                break;
            case 'tomorrow':
                startDate = new Date(today);
                startDate.setDate(today.getDate() + 1);
                endDate = new Date(startDate);
                break;
            case 'week':
                startDate = today;
                endDate = new Date(today);
                endDate.setDate(today.getDate() + 7);
                break;
            case 'weekend':
                // Find next Friday
                startDate = new Date(today);
                startDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7);
                // Ends Monday morning
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 3);
                break;
            case 'next7':
                startDate = today;
                endDate = new Date(today);
                endDate.setDate(today.getDate() + 7);
                break;
        }
    }

    function initializeFilters() {
        // Find filter containers
        const $dateRangeContainer = $('.date-range-filters');
        const $sportFilterContainer = $('.sport-filters');

        if (!$dateRangeContainer.length) return;

        // Populate dynamic date ranges
        const ranges = [
            { label: 'Today', value: 'today', active: true },
            { label: 'Tomorrow', value: 'tomorrow' },
            { label: 'This Weekend', value: 'weekend' },
            { label: 'Next 7 Days', value: 'next7' }
        ];

        let html = '';
        ranges.forEach(r => {
            html += `<button class="btn btn-outline-secondary btn-sm date-range-btn ${r.active ? 'active' : ''}" 
                        data-range="${r.value}">${r.label}</button>`;
        });

        $dateRangeContainer.html(html);

        // Bind events to the newly created buttons
        $dateRangeContainer.on('click', '.date-range-btn', function() {
            const $btn = $(this);
            const range = $btn.data('range');
            
            $dateRangeContainer.find('.date-range-btn').removeClass('active');
            $btn.addClass('active');
            
            handleDateRangeSelection(range);
        });
        
        console.log('[FILTER] Filters initialized');
    }

/* Lines 1961-3478 omitted */
