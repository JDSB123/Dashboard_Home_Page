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
                'PicksSortManager',
                'PicksDOMUtils',
                'PicksDataProcessor'
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
            // Initialize header filter buttons if on dashboard page
            if (document.body.classList.contains('page-active-picks')) {
                this.initHeaderFilters();
            }
        },

        /**
         * Initialize header filter buttons
         * Uses class-based selectors and aria-controls to match HTML structure
         */
        initHeaderFilters() {
            // Get all filter buttons by class (matches HTML: class="th-filter-btn")
            const filterButtons = document.querySelectorAll('.th-filter-btn');
            console.log('🔍 Found filter buttons:', filterButtons.length);

            filterButtons.forEach(btn => {
                // Skip if handler already attached (prevents duplicates with weekly-lineup.js)
                if (btn.dataset.filterHandlerAttached) {
                    console.log('⏭️ Handler already attached for:', btn.getAttribute('data-filter'));
                    return;
                }
                btn.dataset.filterHandlerAttached = 'true';

                // Get dropdown ID from aria-controls attribute (e.g., "filter-date")
                const dropdownId = btn.getAttribute('aria-controls');
                // Get filter type from data-filter attribute (e.g., "date")
                const filterType = btn.getAttribute('data-filter');
                const dropdownEl = document.getElementById(dropdownId);
                console.log('✅ Attaching handler for:', filterType, 'dropdown:', dropdownId, 'found:', !!dropdownEl);

                if (dropdownEl) {
                    // Toggle dropdown on click
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 Filter button clicked:', filterType, 'dropdown:', dropdownId);
                        this.toggleFilterDropdown(btn, dropdownEl);
                    });

                    // Sort options inside dropdown (kebab drives sorting now)
                    const sortButtons = dropdownEl.querySelectorAll('.sort-option');
                    sortButtons.forEach(sortBtn => {
                        sortBtn.addEventListener('click', () => {
                            const sortKey = dropdownEl.getAttribute('data-sort-key') || filterType;
                            const direction = sortBtn.getAttribute('data-direction');
                            this.applySortFromDropdown(sortKey, direction);
                            this.closeDropdown(dropdownEl, btn);
                        });
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

            // Close dropdowns on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.th-filter-dropdown') && !e.target.closest('.th-filter-btn')) {
                    this.closeAllFilterDropdowns();
                }
            });

            // Close dropdowns on scroll (since fixed positioning won't follow scroll)
            window.addEventListener('scroll', () => {
                this.closeAllFilterDropdowns();
            }, { passive: true });

            // Also close on table container scroll
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.addEventListener('scroll', () => {
                    this.closeAllFilterDropdowns();
                }, { passive: true });
            }

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeAllFilterDropdowns();
                }
            });
        },

        /**
         * Apply sort triggered from a dropdown's sort controls
         */
        applySortFromDropdown(sortKey, direction) {
            if (!sortKey || !window.PicksSortManager) return;

            if (direction === 'clear') {
                window.PicksSortManager.resetSorting();
            } else {
                window.PicksSortManager.updateSort(sortKey, direction);
                if (window.PicksTableRenderer) {
                    window.PicksTableRenderer.updateTable();
                }
                window.PicksSortManager.updateSortIndicators();
            }
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
            this.populateMatchupTeamOptions();

            this.attachTeamsSelectAllHandler();

            const searchInput = document.getElementById('team-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterTeamList(e.target.value);
                });
            }
        },

        /**
         * Populate the teams list used by the matchup filter
         */
        populateMatchupTeamOptions() {
            const container = document.getElementById('teams-list');
            if (!container || !window.PicksDataProcessor) return;

            const selectAllOption = container.querySelector('.select-all-option');
            const selectAllClone = selectAllOption ? selectAllOption.cloneNode(true) : null;
            container.innerHTML = '';
            if (selectAllClone) {
                container.appendChild(selectAllClone);
            }

            const teams = this.collectMatchupTeams();
            if (teams.length === 0) {
                const notice = document.createElement('div');
                notice.className = 'filter-info';
                notice.textContent = 'No teams available yet';
                container.appendChild(notice);
                return;
            }

            teams.forEach(team => {
                const option = document.createElement('div');
                option.className = 'filter-option';
                const teamId = team.replace(/[^a-z0-9]/gi, '-').toLowerCase();
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
         * Gather all unique teams from the picks table
         */
        collectMatchupTeams() {
            const rows = document.querySelectorAll('#picks-tbody tr:not(.parlay-legs)');
            const teams = new Set();

            rows.forEach(row => {
                const cell = window.PicksDataProcessor.getCell(row, 'matchup', 3);
                const extracted = window.PicksDataProcessor.extractTeamsFromCell(cell);
                extracted.forEach(team => teams.add(team));
            });

            return Array.from(teams).sort((a, b) => a.localeCompare(b));
        },

        /**
         * Attach the select-all handler for matchup teams
         */
        attachTeamsSelectAllHandler() {
            const teamsSelectAll = document.getElementById('teams-select-all');
            if (!teamsSelectAll) return;

            teamsSelectAll.addEventListener('change', (e) => {
                const checkboxes = this.getTeamCheckboxes();
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
        },

        /**
         * Return all matchup team checkboxes (excluding select-all)
         */
        getTeamCheckboxes() {
            const container = document.getElementById('teams-list');
            if (!container) return [];
            return Array.from(container.querySelectorAll('input[type="checkbox"]:not(#teams-select-all)'));
        },

        /**
         * Filter the matchup team options based on the search input
         */
        filterTeamList(query) {
            const container = document.getElementById('teams-list');
            if (!container) return;
            const needle = query.trim().toLowerCase();

            this.getTeamCheckboxes().forEach(cb => {
                const option = cb.closest('.filter-option');
                if (!option) return;
                const label = cb.value.toLowerCase();
                option.style.display = label.includes(needle) ? '' : 'none';
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
            // Checkboxes are static in the markup; no additional setup required.
        },

        /**
         * Initialize risk filter
         */
        initRiskFilter() {
            // Inputs are already present in the markup; no dynamic setup needed.
        },

        /**
         * Initialize status filter
         */
        initStatusFilter() {
            const container = document.getElementById('status-options');
            if (!container) return;

            const statuses = window.PicksDataProcessor.collectStatusValues();
            if (!statuses.length) return;

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

            // Remove button click handler (delegated from table)
            const tbody = document.getElementById('picks-tbody');
            if (tbody) {
                tbody.addEventListener('click', (e) => {
                    if (e.target.classList.contains('remove-pick-btn')) {
                        const index = e.target.getAttribute('data-pick-index');
                        if (index !== null) {
                            this.removePick(parseInt(index, 10));
                        }
                    }
                });
            }
        },

        /**
         * Toggle filter dropdown
         */
        toggleFilterDropdown(btn, dropdown) {
            const isOpen = dropdown.classList.contains('open');
            console.log('🔄 toggleFilterDropdown called, isOpen:', isOpen, 'dropdown:', dropdown.id);

            // Close all dropdowns first
            this.closeAllFilterDropdowns();

            if (!isOpen) {
                // CRITICAL: Position dropdown BEFORE making it visible
                // This prevents the flash where CSS positions it incorrectly
                this.positionDropdownFixed(btn, dropdown);

                // Now make it visible
                dropdown.removeAttribute('hidden');
                dropdown.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                console.log('✅ Dropdown opened at:', dropdown.style.top, dropdown.style.left);
            }
        },

        /**
         * Position dropdown with fixed positioning relative to button
         * Sets position SYNCHRONOUSLY before dropdown becomes visible
         */
        positionDropdownFixed(btn, dropdown) {
            const btnRect = btn.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Use actual dropdown dimensions if available, otherwise small defaults
            const dropdownWidth = dropdown.offsetWidth || 150;
            const dropdownHeight = dropdown.offsetHeight || 200;

            // Position directly below the button, aligned to button's right edge
            let top = btnRect.bottom + 4;
            let left = btnRect.right - dropdownWidth;

            // Keep within viewport bounds
            if (left < 16) {
                left = 16;
            }
            if (left + dropdownWidth > viewportWidth - 16) {
                left = viewportWidth - dropdownWidth - 16;
            }

            // If dropdown would go below viewport, position above button instead
            if (top + dropdownHeight > viewportHeight - 16) {
                top = btnRect.top - dropdownHeight - 8;
                if (top < 16) {
                    top = 16; // Fallback if no room above either
                }
            }

            console.log('📍 Positioning dropdown:', {
                top, left,
                btnRect: {top: btnRect.top, bottom: btnRect.bottom, left: btnRect.left, right: btnRect.right},
                viewport: {width: viewportWidth, height: viewportHeight}
            });

            // Use setProperty with 'important' flag - the proper way to set !important via JS
            dropdown.style.setProperty('position', 'fixed', 'important');
            dropdown.style.setProperty('top', top + 'px', 'important');
            dropdown.style.setProperty('left', left + 'px', 'important');
            dropdown.style.setProperty('right', 'auto', 'important');
            dropdown.style.setProperty('bottom', 'auto', 'important');
            dropdown.style.setProperty('max-height', (viewportHeight - top - 32) + 'px', 'important');
            dropdown.style.setProperty('z-index', '2147483647', 'important');
            dropdown.style.setProperty('transform', 'none', 'important');

            // Verify the styles were applied
            console.log('📍 Inline styles set:', dropdown.style.cssText);
        },

        /**
         * Close all filter dropdowns
         */
        closeAllFilterDropdowns() {
            document.querySelectorAll('.th-filter-dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
                dropdown.setAttribute('hidden', '');
                // Clear inline positioning styles
                dropdown.style.removeProperty('position');
                dropdown.style.removeProperty('top');
                dropdown.style.removeProperty('left');
                dropdown.style.removeProperty('right');
                dropdown.style.removeProperty('bottom');
                dropdown.style.removeProperty('max-height');
                dropdown.style.removeProperty('z-index');
                dropdown.style.removeProperty('transform');

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
            // Clear inline positioning styles
            dropdown.style.removeProperty('position');
            dropdown.style.removeProperty('top');
            dropdown.style.removeProperty('left');
            dropdown.style.removeProperty('right');
            dropdown.style.removeProperty('bottom');
            dropdown.style.removeProperty('max-height');
            dropdown.style.removeProperty('z-index');
            dropdown.style.removeProperty('transform');
            if (btn) {
                btn.setAttribute('aria-expanded', 'false');
            }
        },

        /**
         * Apply filter (optional - filters removed from dashboard)
         */
        applyFilter(type) {
            if (window.PicksFilterManager && window.PicksFilterManager.applyFilter) {
                window.PicksFilterManager.applyFilter(type);
            }
            if (window.PicksTableRenderer && window.PicksTableRenderer.updateFilterIndicators) {
                window.PicksTableRenderer.updateFilterIndicators();
            }
        },

        /**
         * Reset filter (optional - filters removed from dashboard)
         */
        resetFilter(type) {
            if (window.PicksFilterManager && window.PicksFilterManager.resetFilter) {
                window.PicksFilterManager.resetFilter(type);
            }
            if (window.PicksTableRenderer && window.PicksTableRenderer.updateFilterIndicators) {
                window.PicksTableRenderer.updateFilterIndicators();
            }
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
        },

        /**
         * Remove a pick by index
         */
        removePick(index) {
            console.log('[REMOVE PICK] Removing pick at index:', index);
            
            // Get the row element
            const rows = document.querySelectorAll('#picks-tbody tr:not(.parlay-legs)');
            if (index < 0 || index >= rows.length) {
                console.warn('[REMOVE PICK] Invalid index:', index);
                return;
            }

            const row = rows[index];
            if (!row) return;

            // Fade out and remove the row
            row.style.transition = 'opacity 0.3s ease';
            row.style.opacity = '0';

            setTimeout(() => {
                row.remove();
                console.log('[REMOVE PICK] Removed row at index:', index);
                
                // Re-apply zebra striping after removal
                if (window.PicksTableRenderer) {
                    window.PicksTableRenderer.applyZebraStripes();
                }
            }, 300);
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