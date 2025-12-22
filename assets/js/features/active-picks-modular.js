/**
 * Active Picks Orchestrator Module
 * Main coordinator that brings together all modular components
 * Dependencies: All picks-*.js modules must be loaded before this file
 */
(function() {
    'use strict';

    // Main orchestrator object
    const ActivePicks = {
        /**
         * Initialize all components
         */
        init() {
            console.log('Initializing Active Picks Module...');

            // Verify all required modules are loaded
            if (!this.verifyDependencies()) {
                console.error('Missing required dependencies for Active Picks');
                return;
            }

            // Initialize components in order
            this.initializeState();
            this.initializeFilters();
            this.initializeSorting();
            this.initializeParlays();
            this.initializeEventHandlers();
            this.initializeUI();

            // Initial table render
            this.updateTable();

            console.log('Active Picks Module initialized successfully');
        },

        /**
         * Verify all required modules are loaded
         */
        verifyDependencies() {
            const required = [
                'PicksStateManager',
                'PicksTableRenderer',
                'PicksFilterManager',
                'PicksSortManager',
                'PicksDOMUtils',
                'PicksDataProcessor',
                'PicksParlayManager'
            ];

            const missing = required.filter(module => !window[module]);

            if (missing.length > 0) {
                console.error('Missing modules:', missing);
                return false;
            }

            return true;
        },

        /**
         * Initialize state management
         */
        initializeState() {
            // State is auto-initialized by PicksStateManager
            // Just ensure shapes are correct
            window.PicksStateManager.init();
        },

        /**
         * Initialize filter functionality
         */
        initializeFilters() {
            this.initHeaderFilters();
            this.initDateFilter();
            this.initMatchupFilter();
            this.initPickFilter();
            this.initRiskFilter();
            this.initStatusFilter();
        },

        /**
         * Initialize header filter buttons
         * Uses class-based selectors and aria-controls to match HTML structure
         */
        initHeaderFilters() {
            // Get all filter buttons by class (matches HTML: class="th-filter-btn")
            const filterButtons = document.querySelectorAll('.th-filter-btn');

            filterButtons.forEach(btn => {
                // Skip if handler already attached (prevents duplicates with weekly-lineup.js)
                if (btn.dataset.filterHandlerAttached) return;
                btn.dataset.filterHandlerAttached = 'true';

                // Get dropdown ID from aria-controls attribute (e.g., "filter-date")
                const dropdownId = btn.getAttribute('aria-controls');
                // Get filter type from data-filter attribute (e.g., "date")
                const filterType = btn.getAttribute('data-filter');
                const dropdownEl = document.getElementById(dropdownId);

                if (dropdownEl) {
                    // Toggle dropdown on click
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleFilterDropdown(btn, dropdownEl);
                    });

                    // Apply button in dropdown
                    const applyBtn = dropdownEl.querySelector('.apply-filter');
                    if (applyBtn) {
                        applyBtn.addEventListener('click', () => {
                            this.applyFilter(filterType);
                            this.closeDropdown(dropdownEl, btn);
                        });
                    }

                    // Reset button in dropdown
                    const resetBtn = dropdownEl.querySelector('.reset-filter');
                    if (resetBtn) {
                        resetBtn.addEventListener('click', () => {
                            this.resetFilter(filterType);
                            this.closeDropdown(dropdownEl, btn);
                        });
                    }
                } else {
                    console.warn(`Filter dropdown not found for button: ${dropdownId}`);
                }
            });

            // Close dropdowns on outside click - DISABLED: handled by inline script in HTML
            // document.addEventListener('click', (e) => {
            //     if (!e.target.closest('.th-filter-dropdown') && !e.target.closest('.th-filter-btn')) {
            //         this.closeAllFilterDropdowns();
            //     }
            // });
        },

        /**
         * Initialize date filter
         */
        initDateFilter() {
            const container = document.getElementById('date-filter-options');
            if (!container) return;

            // Populate date filter options
            this.renderDateFilterOptions();

            // Select all checkbox
            const selectAll = document.getElementById('date-select-all');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not(#date-select-all)');
                    checkboxes.forEach(cb => cb.checked = e.target.checked);
                });
            }

            // Individual checkboxes
            container.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.id !== 'date-select-all') {
                    this.updateDateSelectAllState();
                }
            });
        },

        /**
         * Render date filter options
         */
        renderDateFilterOptions() {
            const container = document.getElementById('date-filter-options');
            if (!container) return;

            const facets = window.PicksDataProcessor.collectDateFilterFacets();

            // Clear existing
            container.innerHTML = '';

            // Add select all
            const selectAllDiv = document.createElement('div');
            selectAllDiv.className = 'filter-option select-all-option';
            selectAllDiv.innerHTML = `
                <label>
                    <input type="checkbox" id="date-select-all" name="date-select-all">
                    <span>Select All</span>
                </label>
            `;
            container.appendChild(selectAllDiv);

            // Add date options
            if (facets.dates.length > 0) {
                const dateGroup = document.createElement('div');
                dateGroup.className = 'filter-group';
                dateGroup.innerHTML = '<div class="filter-group-label">Dates</div>';

                facets.dates.forEach(date => {
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    option.innerHTML = `
                        <label>
                            <input type="checkbox" id="date-filter-${date.replace(/\s+/g, '-').toLowerCase()}" name="date-filter-${date.replace(/\s+/g, '-').toLowerCase()}" value="${date}" data-group="dates">
                            <span>${date}</span>
                        </label>
                    `;
                    dateGroup.appendChild(option);
                });

                container.appendChild(dateGroup);
            }

            // Add time options
            if (facets.times.length > 0) {
                const timeGroup = document.createElement('div');
                timeGroup.className = 'filter-group';
                timeGroup.innerHTML = '<div class="filter-group-label">Times</div>';

                facets.times.forEach(time => {
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    option.innerHTML = `
                        <label>
                            <input type="checkbox" id="time-filter-${time.replace(/\s+/g, '-').toLowerCase()}" name="time-filter-${time.replace(/\s+/g, '-').toLowerCase()}" value="${time}" data-group="times">
                            <span>${time}</span>
                        </label>
                    `;
                    timeGroup.appendChild(option);
                });

                container.appendChild(timeGroup);
            }

            // Add sportsbook options
            if (facets.books.length > 0) {
                const bookGroup = document.createElement('div');
                bookGroup.className = 'filter-group';
                bookGroup.innerHTML = '<div class="filter-group-label">Sportsbooks</div>';

                facets.books.forEach(book => {
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    option.innerHTML = `
                        <label>
                            <input type="checkbox" id="book-filter-${book.replace(/\s+/g, '-').toLowerCase()}" name="book-filter-${book.replace(/\s+/g, '-').toLowerCase()}" value="${book}" data-group="books">
                            <span>${book}</span>
                        </label>
                    `;
                    bookGroup.appendChild(option);
                });

                container.appendChild(bookGroup);
            }
        },

        /**
         * Update date select all checkbox state
         */
        updateDateSelectAllState() {
            const selectAll = document.getElementById('date-select-all');
            const checkboxes = document.querySelectorAll('#date-filter-options input[type="checkbox"]:not(#date-select-all)');

            if (selectAll && checkboxes.length > 0) {
                const checkedCount = document.querySelectorAll('#date-filter-options input[type="checkbox"]:not(#date-select-all):checked').length;

                if (checkedCount === 0) {
                    selectAll.checked = false;
                    selectAll.indeterminate = false;
                } else if (checkedCount === checkboxes.length) {
                    selectAll.checked = true;
                    selectAll.indeterminate = false;
                } else {
                    selectAll.checked = false;
                    selectAll.indeterminate = true;
                }
            }
        },

        /**
         * Initialize matchup filter
         */
        initMatchupFilter() {
            // League dropdown
            const leagueSelect = document.getElementById('league-select');
            if (leagueSelect) {
                this.populateLeagueDropdown();

                leagueSelect.addEventListener('change', (e) => {
                    this.populateTeamsList(e.target.value);
                });
            }

            // Teams select all
            const teamsSelectAll = document.getElementById('teams-select-all');
            if (teamsSelectAll) {
                teamsSelectAll.addEventListener('change', (e) => {
                    const checkboxes = document.querySelectorAll('#teams-list input[type="checkbox"]:not(#teams-select-all)');
                    checkboxes.forEach(cb => cb.checked = e.target.checked);
                });
            }

            // Ticket type radio buttons
            const ticketRadios = document.querySelectorAll('input[name="ticket-type"]');
            ticketRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    window.tableState.filters.matchup.ticketType = radio.value;
                });
            });
        },

        /**
         * Populate league dropdown
         */
        populateLeagueDropdown() {
            const select = document.getElementById('league-select');
            if (!select) return;

            const leagues = window.PicksDataProcessor.getLeaguesFromTable();

            // Clear existing options
            select.innerHTML = '<option value="">All Leagues</option>';

            // Add league options
            leagues.forEach(league => {
                const option = document.createElement('option');
                option.value = league;
                option.textContent = league;
                select.appendChild(option);
            });
        },

        /**
         * Populate teams list for selected league
         */
        populateTeamsList(league) {
            const container = document.getElementById('teams-list');
            if (!container) return;

            // Clear existing
            container.innerHTML = '';

            if (!league) {
                container.innerHTML = '<div class="no-selection">Select a league first</div>';
                return;
            }

            const teams = window.PicksDataProcessor.getTeamsForLeague(league);

            if (teams.length === 0) {
                container.innerHTML = '<div class="no-teams">No teams found</div>';
                return;
            }

            // Add select all
            const selectAllDiv = document.createElement('div');
            selectAllDiv.className = 'filter-option select-all-option';
            selectAllDiv.innerHTML = `
                <label>
                    <input type="checkbox" id="teams-select-all" name="teams-select-all">
                    <span>Select All Teams</span>
                </label>
            `;
            container.appendChild(selectAllDiv);

            // Add team options
            teams.forEach(team => {
                const option = document.createElement('div');
                option.className = 'filter-option';
                    const teamId = team.replace(/\s+/g, '-').toLowerCase();
                    option.innerHTML = `
                        <label>
                            <input type="checkbox" id="team-filter-${teamId}" name="team-filter-${teamId}" value="${team}">
                            <span>${window.PicksDOMUtils.formatTeamName(team)}</span>
                        </label>
                    `;
                container.appendChild(option);
            });
        },

        /**
         * Initialize pick filter
         */
        initPickFilter() {
            const betTypes = window.PicksDataProcessor.collectBetTypes();

            // Populate bet type dropdown
            const betTypeSelect = document.getElementById('bet-type-select');
            if (betTypeSelect) {
                betTypeSelect.innerHTML = '<option value="">All Types</option>';
                betTypes.types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = window.PicksDOMUtils.formatBetTypeLabel(type);
                    betTypeSelect.appendChild(option);
                });
            }

            // Populate subtype dropdown
            const subtypeSelect = document.getElementById('subtype-select');
            if (subtypeSelect) {
                subtypeSelect.innerHTML = '<option value="">All Subtypes</option>';
                betTypes.subtypes.forEach(subtype => {
                    const option = document.createElement('option');
                    option.value = subtype;
                    option.textContent = window.PicksDOMUtils.formatSubtypeLabel(subtype);
                    subtypeSelect.appendChild(option);
                });
            }

            // Segment dropdown
            const segmentSelect = document.getElementById('segment-select');
            if (segmentSelect) {
                segmentSelect.innerHTML = `
                    <option value="">All Segments</option>
                    <option value="game">Full Game</option>
                    <option value="1h">1st Half</option>
                    <option value="2h">2nd Half</option>
                `;
            }
        },

        /**
         * Initialize risk filter
         */
        initRiskFilter() {
            // Collect risk ranges
            const riskRanges = window.PicksDataProcessor.collectValueRanges(4);
            const winRanges = window.PicksDataProcessor.collectValueRanges(5);

            // Populate risk ranges
            const riskContainer = document.getElementById('risk-ranges');
            if (riskContainer && riskRanges.length > 0) {
                riskContainer.innerHTML = '<div class="filter-group-label">Risk Amount</div>';
                riskRanges.forEach(range => {
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    const rangeId = range.replace(/\s+/g, '-').toLowerCase().replace(/[<>]/g, '');
                    option.innerHTML = `
                        <label>
                            <input type="checkbox" id="risk-range-${rangeId}" name="risk-range-${rangeId}" value="${range}">
                            <span>${window.PicksDOMUtils.formatRangeLabel(range)}</span>
                        </label>
                    `;
                    riskContainer.appendChild(option);
                });
            }

            // Populate win ranges
            const winContainer = document.getElementById('win-ranges');
            if (winContainer && winRanges.length > 0) {
                winContainer.innerHTML = '<div class="filter-group-label">Win Amount</div>';
                winRanges.forEach(range => {
                    const option = document.createElement('div');
                    option.className = 'filter-option';
                    const rangeId = range.replace(/\s+/g, '-').toLowerCase().replace(/[<>]/g, '');
                    option.innerHTML = `
                        <label>
                            <input type="checkbox" id="win-range-${rangeId}" name="win-range-${rangeId}" value="${range}">
                            <span>${window.PicksDOMUtils.formatRangeLabel(range)}</span>
                        </label>
                    `;
                    winContainer.appendChild(option);
                });
            }
        },

        /**
         * Initialize status filter
         */
        initStatusFilter() {
            const container = document.getElementById('status-filter-options');
            if (!container) return;

            const statuses = window.PicksDataProcessor.collectStatusValues();

            container.innerHTML = '';
            statuses.forEach(status => {
                const option = document.createElement('div');
                option.className = 'filter-option';
                const statusId = status.replace(/\s+/g, '-').toLowerCase();
                option.innerHTML = `
                    <label>
                        <input type="checkbox" id="status-filter-${statusId}" name="status-filter-${statusId}" value="${status}">
                        <span>${window.PicksDOMUtils.formatBadgeStatus(status)}</span>
                    </label>
                `;
                container.appendChild(option);
            });
        },

        /**
         * Initialize sorting
         */
        initializeSorting() {
            window.PicksSortManager.initSorting();
        },

        /**
         * Initialize parlays
         */
        initializeParlays() {
            window.PicksParlayManager.initParlays();
        },

        /**
         * Initialize UI components
         */
        initializeUI() {
            // Initialize filter chips container
            const chipsContainer = document.querySelector('.filter-chips');
            if (!chipsContainer) {
                const header = document.querySelector('.header-controls');
                if (header) {
                    const chips = document.createElement('div');
                    chips.className = 'filter-chips';
                    header.appendChild(chips);
                }
            }

            // Add clear all filters button
            const clearAllBtn = document.getElementById('clear-all-filters');
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => {
                    this.clearAllFilters();
                });
            }
        },

        /**
         * Initialize event handlers
         */
        initializeEventHandlers() {
            // Refresh button
            const refreshBtn = document.getElementById('refresh-data');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.refreshData();
                });
            }

            // Export button
            const exportBtn = document.getElementById('export-data');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    this.exportData();
                });
            }
        },

        /**
         * Toggle filter dropdown
         */
        toggleFilterDropdown(btn, dropdown) {
            const isOpen = dropdown.classList.contains('open');

            // Close all dropdowns first
            this.closeAllFilterDropdowns();

            if (!isOpen) {
                // Remove hidden attribute and add open class
                dropdown.removeAttribute('hidden');
                dropdown.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                // Position dropdown if needed
                if (window.PicksDOMUtils && window.PicksDOMUtils.positionDropdown) {
                    window.PicksDOMUtils.positionDropdown(btn, dropdown);
                }
            }
        },

        /**
         * Close all filter dropdowns
         */
        closeAllFilterDropdowns() {
            document.querySelectorAll('.th-filter-dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
                dropdown.setAttribute('hidden', '');
                
                // Find associated button via aria-controls
                const btn = document.querySelector(`[aria-controls="${dropdown.id}"]`);
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        },

        /**
         * Close dropdown
         */
        closeDropdown(dropdown, btn) {
            dropdown.classList.remove('open');
            dropdown.setAttribute('hidden', '');
            if (btn) {
                btn.setAttribute('aria-expanded', 'false');
            }
        },

        /**
         * Apply filter
         */
        applyFilter(type) {
            window.PicksFilterManager.applyFilter(type);
            window.PicksTableRenderer.updateFilterIndicators();
        },

        /**
         * Reset filter
         */
        resetFilter(type) {
            window.PicksFilterManager.resetFilter(type);
            window.PicksTableRenderer.updateFilterIndicators();
        },

        /**
         * Clear all filters
         */
        clearAllFilters() {
            window.PicksStateManager.resetAllFilters();
            window.PicksTableRenderer.updateTable();
            window.PicksTableRenderer.updateFilterIndicators();

            // Clear all UI elements
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            document.querySelectorAll('select').forEach(select => select.value = '');
            document.querySelectorAll('input[type="radio"][value="all"]').forEach(radio => radio.checked = true);
        },

        /**
         * Update table
         */
        updateTable() {
            window.PicksTableRenderer.updateTable();
        },

        /**
         * Refresh data
         */
        refreshData() {
            console.log('Refreshing data...');
            // Reload the page or fetch new data via API
            window.location.reload();
        },

        /**
         * Export data
         */
        exportData() {
            console.log('Exporting data...');
            // Implement CSV/Excel export functionality
            const rows = document.querySelectorAll('#picks-tbody tr:not(.parlay-legs)');
            const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');

            // Build CSV content
            let csv = 'Date/Time,Matchup,Pick,Risk,Win,Status\n';

            visibleRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowData = Array.from(cells).map(cell => {
                    const text = cell.textContent.trim().replace(/,/g, ';');
                    return `"${text}"`;
                });
                csv += rowData.join(',') + '\n';
            });

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `picks-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ActivePicks.init());
    } else {
        ActivePicks.init();
    }

    // Export to global scope for debugging
    window.ActivePicks = ActivePicks;

})();