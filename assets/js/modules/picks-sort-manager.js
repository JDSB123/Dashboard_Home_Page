/**
 * Picks Sort Manager Module
 * Handles table sorting logic for all columns
 */
(function() {
    'use strict';

    const SortManager = {
        _columnIndexCache: new WeakMap(),

        /**
         * Get the 1-based column index for a given column key by reading the table header.
         * Falls back to null if not found.
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

        /**
         * Get date sort value from date text
         */
        getDateSortValue(dateText) {
            if (!dateText) return 0;

            // Remove weekday prefix if present
            const cleanDate = dateText.replace(/^(mon|tue|wed|thu|fri|sat|sun)\s+/i, '');

            // Parse date string (MM/DD format)
            const parts = cleanDate.split('/');
            if (parts.length === 2) {
                const month = parseInt(parts[0], 10) || 0;
                const day = parseInt(parts[1], 10) || 0;
                const currentYear = new Date().getFullYear();
                return new Date(currentYear, month - 1, day).getTime();
            }

            return 0;
        },

        /**
         * Get time sort value from time text
         */
        getTimeSortValue(timeText) {
            if (!timeText) return 0;

            // Extract time and convert to 24hr format for sorting
            const match = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
            if (match) {
                let hours = parseInt(match[1], 10);
                const minutes = parseInt(match[2], 10);
                const period = match[3] ? match[3].toLowerCase() : '';

                if (period === 'pm' && hours !== 12) {
                    hours += 12;
                } else if (period === 'am' && hours === 12) {
                    hours = 0;
                }

                return hours * 60 + minutes;
            }

            return 0;
        },

        /**
         * Get sort value for a specific column
         */
        getSortValue(row, column) {
            switch(column) {
                case 'date': {
                    const dateCell = row.querySelector('td:first-child');
                    if (!dateCell) return 0;

                    const dateEl = dateCell.querySelector('.cell-date');
                    const timeEl = dateCell.querySelector('.cell-time');

                    const dateValue = this.getDateSortValue(dateEl ? dateEl.textContent : '');
                    const timeValue = this.getTimeSortValue(timeEl ? timeEl.textContent : '');

                    // Combine date and time for full sorting
                    return dateValue + timeValue / (24 * 60);
                }

                case 'league': {
                    const cell = this.getCell(row, 'league');
                    return cell ? cell.textContent.trim().toLowerCase() : '';
                }

                case 'matchup': {
                    const cell = this.getCell(row, 'matchup', 2);
                    return cell ? cell.textContent.trim().toLowerCase() : '';
                }

                case 'pick': {
                    const cell = this.getCell(row, 'pick', 3);
                    return cell ? cell.textContent.trim().toLowerCase() : '';
                }

                case 'segment': {
                    const cell = this.getCell(row, 'segment', 4);
                    return cell ? cell.textContent.trim().toLowerCase() : '';
                }

                case 'risk': {
                    const cell = this.getCell(row, 'risk', 5);
                    if (!cell) return 0;
                    const amountEl = cell.querySelector('.risk-amount');
                    if (!amountEl) return 0;
                    const text = amountEl.textContent.replace(/[$,]/g, '').trim();
                    return parseFloat(text) || 0;
                }

                case 'win': {
                    const cell = this.getCell(row, 'risk', 5);
                    if (!cell) return 0;
                    const amountEl = cell.querySelector('.win-amount');
                    if (!amountEl) return 0;
                    const text = amountEl.textContent.replace(/[$,]/g, '').trim();
                    return parseFloat(text) || 0;
                }

                case 'status': {
                    const cell = this.getCell(row, 'status') || row.querySelector('td:last-child');
                    if (!cell) return 0;

                    const badge = cell.querySelector('.status-badge');
                    if (badge) {
                        const status = badge.getAttribute('data-status') ||
                                      badge.className.match(/status-(\w+)/)?.[1] ||
                                      badge.textContent.trim();
                        return this.getStatusSortPriority(status);
                    }

                    return this.getStatusSortPriority(cell.textContent.trim().toLowerCase());
                }

                default:
                    return '';
            }
        },

        /**
         * Get status sort priority (for consistent ordering)
         */
        getStatusSortPriority(status) {
            const priorities = {
                'live': 1,
                'in-progress': 1,
                'active': 1,
                'pending': 2,
                'open': 2,
                'win': 3,
                'won': 3,
                'loss': 4,
                'lost': 4,
                'push': 5,
                'tie': 5,
                'void': 6,
                'voided': 6,
                'cancelled': 6
            };

            const normalized = status.toString().toLowerCase();
            return priorities[normalized] || 99;
        },

        /**
         * Apply sorting to table rows
         */
        applySorting(rows) {
            const state = window.PicksStateManager ?
                window.PicksStateManager.getSortState() :
                window.tableState.sort;

            if (!state.column) {
                return rows;
            }

            const sorted = [...rows].sort((a, b) => {
                const aValue = this.getSortValue(a, state.column);
                const bValue = this.getSortValue(b, state.column);

                // Handle numeric vs string comparison
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return state.direction === 'asc' ?
                        aValue - bValue :
                        bValue - aValue;
                }

                // String comparison
                const aStr = aValue.toString();
                const bStr = bValue.toString();

                if (state.direction === 'asc') {
                    return aStr.localeCompare(bStr);
                } else {
                    return bStr.localeCompare(aStr);
                }
            });

            return sorted;
        },

        /**
         * Handle header click for sorting
         */
        handleHeaderClick(column) {
            const state = window.PicksStateManager ?
                window.PicksStateManager.getSortState() :
                window.tableState.sort;

            // Toggle direction if same column, otherwise default to asc
            if (state.column === column) {
                const newDirection = state.direction === 'asc' ? 'desc' : 'asc';
                this.updateSort(column, newDirection);
            } else {
                this.updateSort(column, 'asc');
            }

            // Update table display
            if (window.PicksTableRenderer) {
                window.PicksTableRenderer.updateTable();
            }

            // Update header indicators
            this.updateSortIndicators();
        },

        /**
         * Update sort state
         */
        updateSort(column, direction) {
            if (window.PicksStateManager) {
                window.PicksStateManager.updateSort(column, direction);
            } else {
                window.tableState.sort = { column, direction };
            }
        },

        /**
         * Reset sorting
         */
        resetSorting() {
            if (window.PicksStateManager) {
                window.PicksStateManager.resetSort();
            } else {
                window.tableState.sort = { column: null, direction: 'asc' };
            }

            this.updateSortIndicators();

            if (window.PicksTableRenderer) {
                window.PicksTableRenderer.updateTable();
            }
        },

        /**
         * Update sort indicators in headers
         * NOTE: Sort indicators removed - filter icons are sufficient
         */
        updateSortIndicators() {
            const state = window.PicksStateManager ?
                window.PicksStateManager.getSortState() :
                window.tableState.sort;

            const headers = document.querySelectorAll('th[data-sort]');

            headers.forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
                th.setAttribute('aria-sort', 'none');

                const icon = th.querySelector('.sort-icon');
                if (icon) {
                    icon.textContent = '▲';
                }
            });

            if (!state.column) return;

            const activeHeader = document.querySelector(`th[data-sort="${state.column}"]`);
            if (!activeHeader) return;

            const isDesc = state.direction === 'desc';
            activeHeader.classList.add(isDesc ? 'sorted-desc' : 'sorted-asc');
            activeHeader.setAttribute('aria-sort', isDesc ? 'descending' : 'ascending');

            const activeIcon = activeHeader.querySelector('.sort-icon');
            if (activeIcon) {
                activeIcon.textContent = isDesc ? '▼' : '▲';
            }
        },

        /**
         * Initialize sort functionality
         */
        initSorting() {
            // Sorting is driven exclusively by kebab dropdown controls. Headers are no longer clickable.
            const headers = document.querySelectorAll('th[data-sort]');
            headers.forEach(header => {
                header.style.cursor = 'default';
                header.removeAttribute('role');
            });

            // Initialize indicators (still used when sort is applied via dropdown)
            this.updateSortIndicators();
        }
    };

    // Export to global scope
    window.PicksSortManager = SortManager;

})();