/**
 * Picks Sort Manager Module
 * Handles table sorting logic for all columns
 */
(function() {
    'use strict';

    const SortManager = {
        /**
         * Get 1-based column index - delegates to shared PicksDOMUtils
         */
        getColumnIndex(row, columnKey) {
            if (window.PicksDOMUtils?.getColumnIndex) {
                return window.PicksDOMUtils.getColumnIndex(row, columnKey);
            }
            return null;
        },

        /**
         * Get a table cell - delegates to shared PicksDOMUtils
         */
        getCell(row, columnKey, fallbackIndex) {
            if (window.PicksDOMUtils?.getCell) {
                return window.PicksDOMUtils.getCell(row, columnKey, fallbackIndex);
            }
            const idx = fallbackIndex || null;
            return idx ? row.querySelector(`td:nth-child(${idx})`) : null;
        },

        /**
         * Get date sort value from date text
         * Handles cross-year dates (e.g., Dec 31 vs Jan 1)
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
                const now = new Date();
                const currentMonth = now.getMonth() + 1; // 1-based
                const currentYear = now.getFullYear();

                // Handle year rollover: if we're in Dec (12) and date is Jan (1),
                // assume it's next year. If we're in Jan and date is Dec, assume last year.
                let year = currentYear;
                if (currentMonth >= 11 && month <= 2) {
                    // Late in year, early month dates are next year
                    year = currentYear + 1;
                } else if (currentMonth <= 2 && month >= 11) {
                    // Early in year, late month dates are last year
                    year = currentYear - 1;
                }

                return new Date(year, month - 1, day).getTime();
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

                case 'profit': {
                    const cell = row.querySelector('td:last-child');
                    if (!cell) return 0;
                    const amountEl = cell.querySelector('.profit-amount');
                    if (!amountEl) return 0;
                    const text = amountEl.textContent.replace(/[$,]/g, '').trim();
                    return parseFloat(text) || 0;
                }

                case 'score': {
                    const dataEpoch = row.getAttribute('data-epoch');
                    return dataEpoch ? parseInt(dataEpoch, 10) : 0;
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
        /**
         * Sort icon glyphs - standardized across all pages
         * ▲ = unsorted/ascending (up triangle)
         * ▼ = descending (down triangle)
         */
        SORT_ICONS: {
            unsorted: '▲',
            asc: '▲',
            desc: '▼'
        },

        updateSortIndicators() {
            const state = window.PicksStateManager ?
                window.PicksStateManager.getSortState() :
                window.tableState?.sort;

            const headers = document.querySelectorAll('th[data-sort]');

            headers.forEach(th => {
                // Remove both naming conventions for compatibility
                th.classList.remove('sorted-asc', 'sorted-desc', 'sort-asc', 'sort-desc');
                th.setAttribute('aria-sort', 'none');

                const icon = th.querySelector('.sort-icon');
                if (icon) {
                    icon.textContent = this.SORT_ICONS.unsorted;
                }
            });

            if (!state?.column) return;

            const activeHeader = document.querySelector(`th[data-sort="${state.column}"]`);
            if (!activeHeader) return;

            const isDesc = state.direction === 'desc';
            // Use standardized class names
            activeHeader.classList.add(isDesc ? 'sorted-desc' : 'sorted-asc');
            activeHeader.setAttribute('aria-sort', isDesc ? 'descending' : 'ascending');

            const activeIcon = activeHeader.querySelector('.sort-icon');
            if (activeIcon) {
                activeIcon.textContent = isDesc ? this.SORT_ICONS.desc : this.SORT_ICONS.asc;
            }
        },

        /**
         * Initialize sort functionality
         */
        initSorting() {
            // Select all sort buttons
            const sortButtons = document.querySelectorAll('.th-sort-btn');
            
            sortButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Stop propagation to prevent bubbling issues
                    e.stopPropagation();
                    
                    const th = btn.closest('th');
                    if (!th) return;
                    
                    const column = th.getAttribute('data-sort');
                    if (column) {
                        this.handleHeaderClick(column);
                    }
                });
            });

            // Initialize indicators
            this.updateSortIndicators();
        }
    };

    // Export to global scope
    window.PicksSortManager = SortManager;

})();