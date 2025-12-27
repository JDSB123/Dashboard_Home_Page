/**
 * Picks Table Renderer Module
 * Handles all table rendering, DOM updates, and visual presentation
 */
(function() {
    'use strict';

    const TableRenderer = {
        /**
         * Get parent rows only (excluding parlay-legs rows)
         */
        getParentRowsOnly(tbody) {
            if (!tbody) return [];
            return Array.from(tbody.children).filter(row =>
                row && row.tagName === 'TR' && !row.classList.contains('parlay-legs')
            );
        },

        /**
         * Get all direct child rows from tbody
         */
        getDirectChildRows(tbody) {
            if (!tbody) return [];
            return Array.from(tbody.children).filter(node => node && node.tagName === 'TR');
        },

        /**
         * Check if row is visible for zebra striping
         */
        isRowVisibleForZebra(row) {
            if (!row) return false;
            if (row.style.display === 'none') return false;
            return true;
        },

        /**
         * Apply zebra stripes to table
         */
        applyZebraStripes() {
            if (window.ZebraStripes && typeof window.ZebraStripes.applyPicksTableZebraStripes === 'function') {
                window.ZebraStripes.applyPicksTableZebraStripes();
                return;
            }

            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return;

            const visibleRows = this.getParentRowsOnly(tbody)
                .filter(row => this.isRowVisibleForZebra(row));

            visibleRows.forEach((row, index) => {
                const className = index % 2 === 0 ? 'zebra-even' : 'zebra-odd';
                const otherClass = index % 2 === 0 ? 'zebra-odd' : 'zebra-even';

                row.classList.remove(otherClass);
                row.classList.add(className);
                row.classList.add('zebra-row');

                // Apply same class to associated parlay-legs row
                if (window.PicksParlayManager) {
                    const legsRow = window.PicksParlayManager.findParlayLegsRow(row);
                    if (legsRow) {
                        legsRow.classList.remove(otherClass);
                        legsRow.classList.add(className);
                        legsRow.classList.add('zebra-row');
                    }
                }
            });
        },

        /**
         * Update table with current filters and sorting
         */
        updateTable() {
            const tbody = document.getElementById('picks-tbody');
            if (!tbody) return;

            let parentRows = this.getParentRowsOnly(tbody);

            // Apply sorting if active
            const sortState = window.PicksStateManager ?
                window.PicksStateManager.getSortState() :
                window.tableState.sort;

            if (sortState.column) {
                parentRows = window.PicksSortManager ?
                    window.PicksSortManager.applySorting(parentRows) :
                    parentRows;

                // Re-append in sorted order, keeping parlay-legs with parents
                parentRows.forEach(row => {
                    tbody.appendChild(row);

                    // Delegate parlay leg row management to ParlayManager
                    if (window.PicksParlayManager && row.classList.contains('parlay-row')) {
                        window.PicksParlayManager.ensureLegRowPosition(row);
                    }
                });
            }

            // Apply filters to rows
            this.applyFiltersToRows(parentRows);

            // Ensure parlay visibility is synced with state
            if (window.PicksParlayManager) {
                window.PicksParlayManager.refreshAllParlayVisibility();
            }

            // Apply zebra stripes
            this.applyZebraStripes();

            // Render filter chips
            this.renderFilterChips();
        },

        /**
         * Apply filters to table rows
         */
        applyFiltersToRows(rows) {
            if (!rows) {
                const tbody = document.getElementById('picks-tbody');
                rows = this.getParentRowsOnly(tbody);
            }

            rows.forEach(row => {
                // Prioritize DashboardFilterPills for dashboard page filters
                // Falls back to PicksFilterManager for other pages
                const shouldShow = window.DashboardFilterPills?.passesAllFilters ?
                    window.DashboardFilterPills.passesAllFilters(row) :
                    (window.PicksFilterManager ?
                        window.PicksFilterManager.passesAllFilters(row) :
                        true);

                row.style.display = shouldShow ? '' : 'none';

                // Manage parlay-legs visibility via ParlayManager
                if (window.PicksParlayManager && row.classList.contains('parlay-row')) {
                    const legsRow = window.PicksParlayManager.findParlayLegsRow(row);
                    if (legsRow) {
                        if (!shouldShow) {
                            legsRow.style.display = 'none';
                        } else {
                            // Only show if parent is expanded
                            const parlayId = row.getAttribute('data-row-id');
                            const isExpanded = window.PicksStateManager ?
                                window.PicksStateManager.isParlayExpanded(parlayId) :
                                row.getAttribute('aria-expanded') === 'true';

                            legsRow.style.display = isExpanded ? 'table-row' : 'none';
                        }
                    }
                }
            });
        },

        /**
         * Render filter chips showing active filters
         */
        renderFilterChips() {
            const container = document.querySelector('.filter-chips') ||
                            document.getElementById('filter-chips-container');
            if (!container) return;

            container.innerHTML = '';

            const state = window.PicksStateManager ?
                window.PicksStateManager.getState() :
                window.tableState;

            const filters = state.filters;
            const chips = [];

            // Date filters
            if (filters.date.selectedDates && filters.date.selectedDates.length > 0) {
                chips.push({
                    type: 'date',
                    subtype: 'dates',
                    label: `Dates: ${filters.date.selectedDates.length} selected`,
                    value: filters.date.selectedDates
                });
            }

            if (filters.date.selectedTimes && filters.date.selectedTimes.length > 0) {
                chips.push({
                    type: 'date',
                    subtype: 'times',
                    label: `Times: ${filters.date.selectedTimes.length} selected`,
                    value: filters.date.selectedTimes
                });
            }

            if (filters.date.selectedBooks && filters.date.selectedBooks.length > 0) {
                chips.push({
                    type: 'date',
                    subtype: 'books',
                    label: `Books: ${filters.date.selectedBooks.length} selected`,
                    value: filters.date.selectedBooks
                });
            }

            // Matchup filters
            if (filters.matchup.league || filters.matchup.selectedTeams) {
                const label = filters.matchup.selectedTeams ?
                    `Teams: ${filters.matchup.selectedTeams.length} selected` :
                    `League: ${filters.matchup.league}`;
                chips.push({
                    type: 'matchup',
                    label: label,
                    value: filters.matchup
                });
            }

            // Pick filters
            if (filters.pick.betType || filters.pick.subtype) {
                const parts = [];
                if (filters.pick.betType) parts.push(filters.pick.betType);
                if (filters.pick.subtype) parts.push(filters.pick.subtype);
                chips.push({
                    type: 'pick',
                    label: `Pick: ${parts.join(' - ')}`,
                    value: filters.pick
                });
            }

            if (filters.pick.segment) {
                chips.push({
                    type: 'segment',
                    label: `Segment: ${filters.pick.segment}`,
                    value: filters.pick.segment
                });
            }

            // Risk filters
            if (filters.risk.selectedRiskRanges && filters.risk.selectedRiskRanges.length > 0) {
                chips.push({
                    type: 'risk',
                    label: `Risk: ${filters.risk.selectedRiskRanges.length} ranges`,
                    value: filters.risk.selectedRiskRanges
                });
            }

            if (filters.risk.selectedWinRanges && filters.risk.selectedWinRanges.length > 0) {
                chips.push({
                    type: 'win',
                    label: `Win: ${filters.risk.selectedWinRanges.length} ranges`,
                    value: filters.risk.selectedWinRanges
                });
            }

            // Status filters
            if (filters.status && filters.status.length > 0) {
                chips.push({
                    type: 'status',
                    label: `Status: ${filters.status.join(', ')}`,
                    value: filters.status
                });
            }

            // Render chips
            chips.forEach(chip => {
                const chipEl = document.createElement('div');
                chipEl.className = 'filter-chip';
                chipEl.setAttribute('data-filter-type', chip.type);
                if (chip.subtype) {
                    chipEl.setAttribute('data-filter-subtype', chip.subtype);
                }

                const labelSpan = document.createElement('span');
                labelSpan.className = 'filter-chip-label';
                labelSpan.textContent = chip.label;

                const removeBtn = document.createElement('button');
                removeBtn.className = 'filter-chip-remove';
                removeBtn.innerHTML = '&times;';
                removeBtn.setAttribute('aria-label', `Remove ${chip.label} filter`);
                removeBtn.onclick = () => this.removeFilterChip(chip.type, chip.subtype);

                chipEl.appendChild(labelSpan);
                chipEl.appendChild(removeBtn);
                container.appendChild(chipEl);
            });

            // Add clear all button if there are chips
            if (chips.length > 0) {
                const clearAllBtn = document.createElement('button');
                clearAllBtn.className = 'clear-all-filters';
                clearAllBtn.textContent = 'Clear All';
                clearAllBtn.onclick = () => this.clearAllFilters();
                container.appendChild(clearAllBtn);
            }
        },

        /**
         * Remove a filter chip
         */
        removeFilterChip(type, subtype) {
            if (window.PicksFilterManager) {
                window.PicksFilterManager.clearFilterByChip(type, subtype);
            } else {
                console.warn('PicksFilterManager not loaded');
            }
        },

        /**
         * Clear all filters
         */
        clearAllFilters() {
            if (window.PicksStateManager) {
                window.PicksStateManager.resetAllFilters();
            }
            this.updateTable();
        },

        /**
         * Update filter indicators in header
         */
        updateFilterIndicators() {
            const indicators = {
                'date-filter-btn': window.tableState.filters.date.selectedDates ||
                                   window.tableState.filters.date.selectedTimes ||
                                   window.tableState.filters.date.selectedBooks,
                'matchup-filter-btn': window.tableState.filters.matchup.league ||
                                     window.tableState.filters.matchup.selectedTeams,
                'pick-filter-btn': window.tableState.filters.pick.betType ||
                                  window.tableState.filters.pick.subtype,
                'risk-filter-btn': window.tableState.filters.risk.selectedRiskRanges?.length > 0 ||
                                  window.tableState.filters.risk.selectedWinRanges?.length > 0,
                'status-filter-btn': window.tableState.filters.status?.length > 0
            };

            Object.entries(indicators).forEach(([btnId, hasFilter]) => {
                const btn = document.getElementById(btnId);
                if (!btn) return;

                const indicator = btn.querySelector('.filter-indicator') ||
                                btn.querySelector('.indicator');

                if (hasFilter) {
                    btn.classList.add('has-filter');
                    if (indicator) {
                        indicator.style.display = 'inline-block';
                    }
                } else {
                    btn.classList.remove('has-filter');
                    if (indicator) {
                        indicator.style.display = 'none';
                    }
                }
            });

            // Update filter count
            const filterCount = window.PicksStateManager ?
                window.PicksStateManager.getActiveFilterCount() : 0;

            const countEl = document.getElementById('active-filter-count');
            if (countEl) {
                countEl.textContent = filterCount > 0 ? `(${filterCount})` : '';
            }
        },

        /**
         * Announce filter changes for accessibility
         */
        announceFilterChange(message) {
            let announcer = document.getElementById('filter-announcer');
            if (!announcer) {
                announcer = document.createElement('div');
                announcer.id = 'filter-announcer';
                announcer.setAttribute('role', 'status');
                announcer.setAttribute('aria-live', 'polite');
                announcer.setAttribute('aria-atomic', 'true');
                announcer.style.position = 'absolute';
                announcer.style.left = '-10000px';
                announcer.style.width = '1px';
                announcer.style.height = '1px';
                announcer.style.overflow = 'hidden';
                document.body.appendChild(announcer);
            }
            announcer.textContent = message;
        },

        /**
         * Refresh the table display
         */
        refresh() {
            this.updateTable();
            this.updateFilterIndicators();
        }
    };

    // Create debounced version of applyZebraStripes for performance
    let zebraDebounceTimer;
    TableRenderer.debouncedZebraStripes = function() {
        clearTimeout(zebraDebounceTimer);
        zebraDebounceTimer = setTimeout(() => {
            TableRenderer.applyZebraStripes();
        }, 50);
    };

    // Export to global scope
    window.PicksTableRenderer = TableRenderer;

})();