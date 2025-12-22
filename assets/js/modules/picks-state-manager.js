/**
 * Picks State Manager Module
 * Centralized state management for the active picks table
 * Handles filter state, sort state, and state persistence
 */
(function() {
    'use strict';

    // Initialize the global state object if not already present
    if (typeof window.tableState === 'undefined') {
        window.tableState = {
            filters: {
                date: {
                    start: null,
                    end: null,
                    selectedDates: null,
                    selectedTimes: null,
                    selectedBooks: null
                },
                matchup: {
                    league: '',
                    selectedTeams: null,
                    ticketType: 'all'
                },
                pick: {
                    betType: '',
                    subtype: '',
                    segment: ''
                },
                risk: {
                    min: null,
                    max: null,
                    selectedRiskRanges: [],
                    selectedWinRanges: []
                },
                status: []
            },
            sort: {
                column: null,
                direction: 'asc'
            },
            expandedParlayIds: []
        };
    }

    // State shape validators
    const StateShapeValidators = {
        /**
         * Creates a new date filter state object with all filter properties
         */
        createDateFilterState() {
            return {
                start: null,
                end: null,
                selectedDates: null,
                selectedTimes: null,
                selectedBooks: null
            };
        },

        /**
         * Creates a new matchup filter state object
         */
        createMatchupFilterState() {
            return {
                league: '',
                selectedTeams: null,
                ticketType: 'all'
            };
        },

        /**
         * Creates a new risk filter state object
         */
        createRiskFilterState() {
            return {
                min: null,
                max: null,
                selectedRiskRanges: [],
                selectedWinRanges: []
            };
        },

        /**
         * Creates a new pick filter state object
         */
        createPickFilterState() {
            return {
                betType: '',
                subtype: '',
                segment: ''
            };
        },

        /**
         * Ensures date filter state has the correct shape
         */
        ensureDateFilterShape() {
            const state = window.tableState;
            if (!state.filters.date || typeof state.filters.date !== 'object') {
                state.filters.date = this.createDateFilterState();
                return;
            }
            const dateFilter = state.filters.date;
            if (!('start' in dateFilter)) dateFilter.start = null;
            if (!('end' in dateFilter)) dateFilter.end = null;
            if (!('selectedDates' in dateFilter)) dateFilter.selectedDates = null;
            if (!('selectedTimes' in dateFilter)) dateFilter.selectedTimes = null;
            if (!('selectedBooks' in dateFilter)) dateFilter.selectedBooks = null;
        },

        /**
         * Ensures matchup filter state has the correct shape
         */
        ensureMatchupFilterShape() {
            const state = window.tableState;
            if (!state.filters.matchup || typeof state.filters.matchup !== 'object') {
                state.filters.matchup = this.createMatchupFilterState();
                return;
            }
            const matchupFilter = state.filters.matchup;
            if (!('ticketType' in matchupFilter)) matchupFilter.ticketType = 'all';
            if (!('selectedTeams' in matchupFilter)) matchupFilter.selectedTeams = null;
            if (!('league' in matchupFilter)) matchupFilter.league = '';
        },

        /**
         * Ensures risk filter state has the correct shape
         */
        ensureRiskFilterShape() {
            const state = window.tableState;
            if (!state.filters.risk || typeof state.filters.risk !== 'object') {
                state.filters.risk = this.createRiskFilterState();
                return;
            }
            const riskFilter = state.filters.risk;
            if (!('min' in riskFilter)) riskFilter.min = null;
            if (!('max' in riskFilter)) riskFilter.max = null;
            if (!Array.isArray(riskFilter.selectedRiskRanges)) riskFilter.selectedRiskRanges = [];
            if (!Array.isArray(riskFilter.selectedWinRanges)) riskFilter.selectedWinRanges = [];
        },

        /**
         * Ensures pick filter state has the correct shape
         */
        ensurePickFilterShape() {
            const state = window.tableState;
            if (!state.filters.pick) {
                state.filters.pick = this.createPickFilterState();
            }
        },

        /**
         * Ensures all filter states have correct shapes
         */
        ensureAllFilterShapes() {
            this.ensureDateFilterShape();
            this.ensureMatchupFilterShape();
            this.ensureRiskFilterShape();
            this.ensurePickFilterShape();
        }
    };

    // State management functions
    const StateManager = {
        /**
         * Get the current table state
         */
        getState() {
            return window.tableState;
        },

        /**
         * Get a specific filter state
         */
        getFilter(filterType) {
            return window.tableState.filters[filterType];
        },

        /**
         * Update a specific filter
         */
        updateFilter(filterType, updates) {
            if (!window.tableState.filters[filterType]) {
                console.warn(`Filter type ${filterType} does not exist`);
                return;
            }
            Object.assign(window.tableState.filters[filterType], updates);
        },

        /**
         * Reset a specific filter to its default state
         */
        resetFilter(filterType) {
            switch(filterType) {
                case 'date':
                    window.tableState.filters.date = StateShapeValidators.createDateFilterState();
                    break;
                case 'matchup':
                    window.tableState.filters.matchup = StateShapeValidators.createMatchupFilterState();
                    break;
                case 'pick':
                    window.tableState.filters.pick = StateShapeValidators.createPickFilterState();
                    break;
                case 'risk':
                    window.tableState.filters.risk = StateShapeValidators.createRiskFilterState();
                    break;
                case 'status':
                    window.tableState.filters.status = [];
                    break;
                default:
                    console.warn(`Unknown filter type: ${filterType}`);
            }
        },

        /**
         * Reset all filters
         */
        resetAllFilters() {
            window.tableState.filters = {
                date: StateShapeValidators.createDateFilterState(),
                matchup: StateShapeValidators.createMatchupFilterState(),
                pick: StateShapeValidators.createPickFilterState(),
                risk: StateShapeValidators.createRiskFilterState(),
                status: []
            };
        },

        /**
         * Get expanded parlay IDs
         */
        getExpandedParlayIds() {
            if (!Array.isArray(window.tableState.expandedParlayIds)) {
                window.tableState.expandedParlayIds = [];
            }
            return window.tableState.expandedParlayIds;
        },

        /**
         * Set parlay expansion state
         */
        setParlayExpanded(parlayId, isExpanded) {
            if (!parlayId) return;

            if (!Array.isArray(window.tableState.expandedParlayIds)) {
                window.tableState.expandedParlayIds = [];
            }

            const index = window.tableState.expandedParlayIds.indexOf(parlayId);

            if (isExpanded && index === -1) {
                window.tableState.expandedParlayIds.push(parlayId);
            } else if (!isExpanded && index !== -1) {
                window.tableState.expandedParlayIds.splice(index, 1);
            }
        },

        /**
         * Check if parlay is expanded
         */
        isParlayExpanded(parlayId) {
            if (!parlayId || !Array.isArray(window.tableState.expandedParlayIds)) {
                return false;
            }
            return window.tableState.expandedParlayIds.includes(parlayId);
        },

        /**
         * Toggle parlay expansion state
         */
        toggleParlayExpanded(parlayId) {
            const isCurrentlyExpanded = this.isParlayExpanded(parlayId);
            this.setParlayExpanded(parlayId, !isCurrentlyExpanded);
            return !isCurrentlyExpanded;
        },

        /**
         * Reset expansion state
         */
        resetExpansionState() {
            window.tableState.expandedParlayIds = [];
        },

        /**
         * Get sort state
         */
        getSortState() {
            return window.tableState.sort;
        },

        /**
         * Update sort state
         */
        updateSort(column, direction) {
            window.tableState.sort = {
                column: column,
                direction: direction || 'asc'
            };
        },

        /**
         * Reset sort state
         */
        resetSort() {
            window.tableState.sort = {
                column: null,
                direction: 'asc'
            };
        },

        /**
         * Check if any filters are active
         */
        hasActiveFilters() {
            const filters = window.tableState.filters;

            // Check date filters
            if (filters.date.selectedDates || filters.date.selectedTimes || filters.date.selectedBooks ||
                filters.date.start || filters.date.end) {
                return true;
            }

            // Check matchup filters
            if (filters.matchup.league || filters.matchup.selectedTeams ||
                filters.matchup.ticketType !== 'all') {
                return true;
            }

            // Check pick filters
            if (filters.pick.betType || filters.pick.subtype || filters.pick.segment) {
                return true;
            }

            // Check risk filters
            if (filters.risk.min !== null || filters.risk.max !== null ||
                filters.risk.selectedRiskRanges.length > 0 ||
                filters.risk.selectedWinRanges.length > 0) {
                return true;
            }

            // Check status filters
            if (filters.status.length > 0) {
                return true;
            }

            return false;
        },

        /**
         * Get active filter count
         */
        getActiveFilterCount() {
            let count = 0;
            const filters = window.tableState.filters;

            if (filters.date.selectedDates) count++;
            if (filters.date.selectedTimes) count++;
            if (filters.date.selectedBooks) count++;
            if (filters.matchup.league || filters.matchup.selectedTeams) count++;
            if (filters.pick.betType || filters.pick.subtype) count++;
            if (filters.pick.segment) count++;
            if (filters.risk.selectedRiskRanges.length > 0) count++;
            if (filters.risk.selectedWinRanges.length > 0) count++;
            if (filters.status.length > 0) count++;

            return count;
        },

        /**
         * Initialize state
         */
        init() {
            StateShapeValidators.ensureAllFilterShapes();
            if (!Array.isArray(window.tableState.expandedParlayIds)) {
                window.tableState.expandedParlayIds = [];
            }
        }
    };

    // Export to global scope
    window.PicksStateManager = {
        ...StateManager,
        validators: StateShapeValidators,
        // Expose the tableState directly for backward compatibility
        state: window.tableState
    };

    // Initialize on load
    StateManager.init();

})();