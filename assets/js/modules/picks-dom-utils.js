/**
 * Picks DOM Utilities Module
 * Common DOM manipulation utilities and helper functions
 */
(function() {
    'use strict';

    // Shared column index cache across all modules
    const _columnIndexCache = new WeakMap();

    const DOMUtils = {
        /**
         * Get the 1-based column index for a given column key by reading the table header.
         * Shared utility to avoid duplication in filter/sort managers.
         * @param {HTMLElement} row - A table row element
         * @param {string} columnKey - The data-sort or data-filter attribute value
         * @returns {number|null} 1-based column index or null if not found
         */
        getColumnIndex(row, columnKey) {
            try {
                const table = row?.closest?.('table');
                if (!table) return null;

                let cacheForTable = _columnIndexCache.get(table);
                if (!cacheForTable) {
                    cacheForTable = new Map();
                    _columnIndexCache.set(table, cacheForTable);
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

        /**
         * Get a table cell by column key or fallback index
         * @param {HTMLElement} row - A table row element
         * @param {string} columnKey - The data-sort or data-filter attribute value
         * @param {number} fallbackIndex - Fallback 1-based index if column not found
         * @returns {HTMLElement|null} The table cell or null
         */
        getCell(row, columnKey, fallbackIndex) {
            const idx = this.getColumnIndex(row, columnKey) || fallbackIndex || null;
            return idx ? row.querySelector(`td:nth-child(${idx})`) : null;
        },

        /**
         * Clear the column index cache for a specific table or all tables
         * @param {HTMLElement} table - Optional table to clear cache for
         */
        clearColumnIndexCache(table) {
            if (table) {
                _columnIndexCache.delete(table);
            }
            // Note: WeakMap doesn't support clear(), but entries are garbage collected
        },

        /**
         * Escape HTML to prevent XSS
         */
        escapeHtml(value) {
            if (!value) return '';
            const div = document.createElement('div');
            div.textContent = value;
            return div.innerHTML;
        },

        /**
         * Format currency value for display
         */
        formatCurrency(value) {
            if (value == null || isNaN(value)) return '-';

            const num = parseFloat(value);
            const formatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.abs(num));

            return num < 0 ? `(${formatted})` : formatted;
        },

        /**
         * Format currency for filter chips (abbreviated)
         */
        formatCurrencyForChip(value) {
            if (!value) return '';
            const num = parseFloat(value);

            if (num >= 1000) {
                return `$${(num / 1000).toFixed(1)}k`;
            }
            return `$${num}`;
        },

        /**
         * Format date with weekday
         */
        formatDateWithDay(dateText) {
            if (!dateText) return '';

            // If already has weekday, return as is
            if (/^(mon|tue|wed|thu|fri|sat|sun)\s+/i.test(dateText)) {
                return dateText;
            }

            // Add weekday
            const weekday = this.getWeekdayName(dateText);
            return weekday ? `${weekday} ${dateText}` : dateText;
        },

        /**
         * Get weekday name from date string
         */
        getWeekdayName(dateText) {
            if (!dateText) return '';

            // Parse MM/DD format
            const match = dateText.match(/(\d{1,2})\/(\d{1,2})/);
            if (!match) return '';

            const month = parseInt(match[1], 10) - 1;
            const day = parseInt(match[2], 10);
            const year = new Date().getFullYear();

            const date = new Date(year, month, day);
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            return weekdays[date.getDay()];
        },

        /**
         * Normalize status to standard values (win, loss, push, void, pending, live)
         */
        normalizeStatus(status) {
            if (!status) return 'pending';

            const lower = status.toString().toLowerCase().trim();
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
                'active': 'live',
                'in-progress': 'live',
                'in progress': 'live'
            };

            return statusMap[lower] || 'pending';
        },

        /**
         * Format badge status text
         */
        formatBadgeStatus(status) {
            if (!status) return '';

            const normalized = this.normalizeStatus(status);
            return normalized.toUpperCase();
        },

        /**
         * Format team record value
         */
        formatTeamRecordValue(value) {
            if (!value) return '';
            // Ensure format is W-L
            return value.toString().replace(/[^\d-]/g, '');
        },

        /**
         * Format bet type label
         */
        formatBetTypeLabel(type) {
            if (!type) return '';

            const typeMap = {
                'spread': 'Spread',
                'total': 'Total',
                'moneyline': 'Moneyline',
                'ml': 'Moneyline',
                'parlay': 'Parlay',
                'prop': 'Prop',
                'player': 'Player Prop'
            };

            return typeMap[type.toLowerCase()] || type;
        },

        /**
         * Format subtype label
         */
        formatSubtypeLabel(subtype) {
            if (!subtype) return '';

            const subtypeMap = {
                '1h': '1st Half',
                '2h': '2nd Half',
                '1q': '1st Quarter',
                '2q': '2nd Quarter',
                '3q': '3rd Quarter',
                '4q': '4th Quarter',
                'game': 'Full Game',
                'full': 'Full Game'
            };

            return subtypeMap[subtype.toLowerCase()] || subtype;
        },

        /**
         * Format segment label
         */
        formatSegmentLabel(segment) {
            if (!segment) return '';

            const segmentMap = {
                '1h': '1st Half',
                '2h': '2nd Half',
                'game': 'Full Game',
                'full': 'Full Game',
                'live': 'Live',
                'pregame': 'Pre-Game'
            };

            return segmentMap[segment.toLowerCase()] || segment;
        },

        /**
         * Create element with attributes
         */
        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);

            // Set attributes
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else if (key === 'textContent') {
                    element.textContent = value;
                } else if (key.startsWith('data-')) {
                    element.setAttribute(key, value);
                } else {
                    element[key] = value;
                }
            });

            // Add children
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Element) {
                    element.appendChild(child);
                }
            });

            return element;
        },

        /**
         * Position dropdown relative to trigger button
         */
        positionDropdown(button, dropdown) {
            if (!button || !dropdown) return;

            const btnRect = button.getBoundingClientRect();
            const dropdownHeight = dropdown.offsetHeight;
            const viewportHeight = window.innerHeight;

            // Reset positioning
            dropdown.style.position = 'absolute';
            dropdown.style.left = `${btnRect.left}px`;

            // Check if dropdown would go off bottom of viewport
            if (btnRect.bottom + dropdownHeight > viewportHeight && btnRect.top > dropdownHeight) {
                // Position above button
                dropdown.style.top = `${btnRect.top - dropdownHeight}px`;
                dropdown.classList.add('dropdown-above');
            } else {
                // Position below button
                dropdown.style.top = `${btnRect.bottom}px`;
                dropdown.classList.remove('dropdown-above');
            }

            // Check horizontal overflow
            const dropdownRect = dropdown.getBoundingClientRect();
            if (dropdownRect.right > window.innerWidth) {
                dropdown.style.left = `${window.innerWidth - dropdown.offsetWidth - 10}px`;
            }
        },

        /**
         * Close all dropdowns
         */
        closeAllDropdowns() {
            document.querySelectorAll('.filter-dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');

                // Find associated button and update aria
                const btnId = dropdown.getAttribute('aria-labelledby');
                if (btnId) {
                    const btn = document.getElementById(btnId);
                    if (btn) {
                        btn.setAttribute('aria-expanded', 'false');
                    }
                }
            });
        },

        /**
         * Extract abbreviation from team name
         */
        extractAbbreviation(name) {
            if (!name) return '';

            // Remove common suffixes
            const cleaned = name
                .replace(/(fc|united|city|town|athletic|rovers)$/i, '')
                .trim();

            // Split and get first letters
            const words = cleaned.split(/\s+/);

            if (words.length === 1) {
                // Single word - take first 3 letters
                return words[0].substring(0, 3).toUpperCase();
            } else {
                // Multiple words - take first letter of each
                return words
                    .map(w => w.charAt(0))
                    .join('')
                    .substring(0, 3)
                    .toUpperCase();
            }
        },

        /**
         * Format team name for display
         */
        formatTeamName(name) {
            if (!name) return '';

            // Title case
            return name.replace(/\w\S*/g, txt =>
                txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
        },

        /**
         * Debounce function for performance
         */
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * Throttle function for performance
         */
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * Check if element is visible
         */
        isElementVisible(element) {
            if (!element) return false;

            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },

        /**
         * Scroll element into view smoothly
         */
        scrollIntoViewSmoothly(element, options = {}) {
            if (!element) return;

            const defaultOptions = {
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            };

            element.scrollIntoView({ ...defaultOptions, ...options });
        },

        /**
         * Get text content safely
         */
        getTextContent(element, selector) {
            if (!element) return '';

            if (selector) {
                const child = element.querySelector(selector);
                return child ? child.textContent.trim() : '';
            }

            return element.textContent.trim();
        },

        /**
         * Set loading state on element
         */
        setLoadingState(element, isLoading, text = 'Loading...') {
            if (!element) return;

            if (isLoading) {
                element.classList.add('loading');
                element.setAttribute('aria-busy', 'true');

                if (element.tagName === 'BUTTON') {
                    element.disabled = true;
                    element.setAttribute('data-original-text', element.textContent);
                    element.textContent = text;
                }
            } else {
                element.classList.remove('loading');
                element.setAttribute('aria-busy', 'false');

                if (element.tagName === 'BUTTON') {
                    element.disabled = false;
                    const originalText = element.getAttribute('data-original-text');
                    if (originalText) {
                        element.textContent = originalText;
                        element.removeAttribute('data-original-text');
                    }
                }
            }
        },

        /**
         * Parse range string (e.g., "100-500")
         */
        parseRange(rangeStr) {
            if (!rangeStr) return { min: null, max: null };

            const parts = rangeStr.split('-').map(p => parseFloat(p.trim()));
            return {
                min: parts[0] || null,
                max: parts[1] || parts[0] || null
            };
        },

        /**
         * Format range for display
         */
        formatRangeLabel(range) {
            if (!range) return '';

            if (typeof range === 'string') {
                const { min, max } = this.parseRange(range);
                if (min === max || !max) {
                    return this.formatCurrency(min);
                }
                return `${this.formatCurrency(min)} - ${this.formatCurrency(max)}`;
            }

            return range.toString();
        },

        /**
         * Add event listener with cleanup
         */
        addEventListenerWithCleanup(element, event, handler) {
            if (!element) return null;

            element.addEventListener(event, handler);

            // Return cleanup function
            return () => element.removeEventListener(event, handler);
        },

        /**
         * Batch DOM updates for performance
         */
        batchDOMUpdates(updates) {
            requestAnimationFrame(() => {
                updates.forEach(update => update());
            });
        },

        /**
         * Create document fragment for multiple elements
         */
        createFragment(elements) {
            const fragment = document.createDocumentFragment();
            elements.forEach(el => {
                if (el) fragment.appendChild(el);
            });
            return fragment;
        }
    };

    // Export to global scope
    window.PicksDOMUtils = DOMUtils;

})();