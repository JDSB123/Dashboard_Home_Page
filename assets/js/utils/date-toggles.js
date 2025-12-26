/* =========================================================
   DATE TOGGLES FUNCTIONALITY
   Quick date range filtering for dashboard picks
   ========================================================= */

(function() {
    'use strict';

    // Date range state
    let currentDateRange = 'all'; // Default to show all
    let customStartDate = null;
    let customEndDate = null;

    /**
     * Initialize the compact date range dropdown selector
     */
    function initializeDateRangeDropdown() {
        const toggle = document.getElementById('date-range-toggle');
        const dropdown = document.getElementById('date-range-dropdown');
        const label = document.getElementById('date-range-label');
        const options = document.querySelectorAll('.date-range-option');

        if (!toggle || !dropdown || !label) {
            console.log('[DateToggles] Date range dropdown elements not found');
            return;
        }

        // Toggle dropdown on button click
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = !dropdown.hidden;

            if (isOpen) {
                dropdown.hidden = true;
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                dropdown.hidden = false;
                toggle.setAttribute('aria-expanded', 'true');
            }
        });

        // Handle option selection
        options.forEach(option => {
            option.addEventListener('click', function(e) {
                e.stopPropagation();

                const range = this.dataset.range;
                const optionText = this.textContent;

                // Update active state
                options.forEach(opt => {
                    opt.classList.remove('active');
                    opt.setAttribute('aria-selected', 'false');
                });
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');

                // Update button label
                label.textContent = optionText;

                // Close dropdown
                dropdown.hidden = true;
                toggle.setAttribute('aria-expanded', 'false');

                // Apply the date filter
                currentDateRange = range;
                applyDateFilter(range);
            });
        });

        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (!dropdown.hidden && !toggle.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.hidden = true;
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !dropdown.hidden) {
                dropdown.hidden = true;
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });

        console.log('[DateToggles] Date range dropdown initialized');
    }

    /**
     * Initialize date toggles on page load
     */
    function initializeDateToggles() {
        // Initialize compact dropdown selector (new style)
        initializeDateRangeDropdown();

        const dateButtons = document.querySelectorAll('.date-toggle-btn');
        const customRangeSection = document.querySelector('.custom-date-range');
        const applyButton = document.querySelector('.date-apply-btn');
        const clearButton = document.querySelector('.date-clear-btn');
        const startDateInput = document.getElementById('date-range-start');
        const endDateInput = document.getElementById('date-range-end');

        // Set default active state (for legacy buttons if present)
        const allTimeButton = document.querySelector('.date-toggle-btn[data-range="all"]');
        if (allTimeButton) {
            allTimeButton.classList.add('active');
        }

        // Add click handlers to date toggle buttons
        dateButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const range = this.getAttribute('data-range');
                handleDateRangeSelection(range, this);
            });
        });

        // Handle custom range button - toggle popup
        const customButton = document.querySelector('.date-toggle-btn[data-range="custom"]');
        if (customButton) {
            customButton.addEventListener('click', function(e) {
                e.stopPropagation();
                if (customRangeSection) {
                    const isActive = customRangeSection.classList.contains('active');
                    customRangeSection.classList.toggle('active');
                    
                    // If opening, focus on start date
                    if (!isActive && startDateInput) {
                        setTimeout(() => startDateInput.focus(), 100);
                    }
                }
            });
        }

        // Initialize custom metallic calendar (replaces native grey picker)
        initializeCustomCalendar({
            container: customRangeSection,
            startInput: startDateInput,
            endInput: endDateInput
        });

        // Apply custom date range
        if (applyButton) {
            applyButton.addEventListener('click', function(e) {
                e.stopPropagation();
                const startDate = startDateInput?.value;
                const endDate = endDateInput?.value;

                if (startDate && endDate) {
                    customStartDate = new Date(startDate);
                    customEndDate = new Date(endDate);
                    
                    // Set end date to end of day
                    customEndDate.setHours(23, 59, 59, 999);

                    // Mark custom button as active
                    if (customButton) {
                        const allButtons = document.querySelectorAll('.date-toggle-btn');
                        allButtons.forEach(btn => btn.classList.remove('active'));
                        customButton.classList.add('active');
                    }

                    applyDateFilter('custom');
                    
                    // Hide custom range section after applying
                    if (customRangeSection) {
                        customRangeSection.classList.remove('active');
                    }
                } else {
                    // Highlight missing fields
                    if (!startDate && startDateInput) {
                        startDateInput.style.borderColor = '#FF4757';
                        setTimeout(() => startDateInput.style.borderColor = '', 2000);
                    }
                    if (!endDate && endDateInput) {
                        endDateInput.style.borderColor = '#FF4757';
                        setTimeout(() => endDateInput.style.borderColor = '', 2000);
                    }
                }
            });
        }

        // Clear time filters and return to standard view (show all)
        if (clearButton) {
            clearButton.addEventListener('click', function(e) {
                e.stopPropagation();
                resetDateFilter();
            });
        }

        // Close custom range popup when clicking outside
        document.addEventListener('click', function(e) {
            if (customRangeSection && customRangeSection.classList.contains('active')) {
                const isClickInside = customRangeSection.contains(e.target) || 
                                     customButton?.contains(e.target);
                
                if (!isClickInside) {
                    customRangeSection.classList.remove('active');
                }
            }
        });

        // Handle escape key to close popup
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && customRangeSection?.classList.contains('active')) {
                customRangeSection.classList.remove('active');
                customButton?.focus();
            }
        });
    }

    // Calendar UI state (for custom metallic popup)
    let calendarActiveTarget = 'start'; // 'start' or 'end'
    let calendarMonthCursor = new Date(); // first day of visible month
    calendarMonthCursor.setDate(1);

    function formatISODate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDisplayDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Initialize custom metallic calendar UI inside the popup
     */
    function initializeCustomCalendar(config) {
        const container = config.container;
        const startInput = config.startInput;
        const endInput = config.endInput;

        if (!container || !startInput || !endInput) return;

        const monthLabel = container.querySelector('#custom-calendar-month');
        const daysContainer = container.querySelector('#custom-calendar-days');
        const prevBtn = container.querySelector('.calendar-nav.prev');
        const nextBtn = container.querySelector('.calendar-nav.next');
        const targetButtons = container.querySelectorAll('.date-target-btn');
        const startDisplay = container.querySelector('#date-range-start-display');
        const endDisplay = container.querySelector('#date-range-end-display');

        if (!monthLabel || !daysContainer || !prevBtn || !nextBtn || !startDisplay || !endDisplay) {
            return;
        }

        function setActiveTarget(target) {
            calendarActiveTarget = target === 'end' ? 'end' : 'start';
            targetButtons.forEach(btn => {
                const isActive = btn.dataset.target === calendarActiveTarget;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
        }

        function updateDisplayFromInputs() {
            if (startInput.value) {
                const d = new Date(startInput.value);
                const isValid = !isNaN(d.getTime());
                startDisplay.textContent = isValid ? formatDisplayDate(d) : '—';
                startDisplay.classList.toggle('is-placeholder', !isValid);
            } else {
                startDisplay.textContent = '—';
                startDisplay.classList.add('is-placeholder');
            }

            if (endInput.value) {
                const d = new Date(endInput.value);
                const isValid = !isNaN(d.getTime());
                endDisplay.textContent = isValid ? formatDisplayDate(d) : '—';
                endDisplay.classList.toggle('is-placeholder', !isValid);
            } else {
                endDisplay.textContent = '—';
                endDisplay.classList.add('is-placeholder');
            }
        }

        function renderCalendar() {
            const year = calendarMonthCursor.getFullYear();
            const month = calendarMonthCursor.getMonth();

            // Header label
            monthLabel.textContent = calendarMonthCursor.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });

            // Clear days grid
            daysContainer.innerHTML = '';

            const firstDay = new Date(year, month, 1);
            const startWeekDay = firstDay.getDay(); // 0-6
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Existing selected range for highlighting
            const startVal = startInput.value ? new Date(startInput.value) : null;
            const endVal = endInput.value ? new Date(endInput.value) : null;

            // Fill leading blanks
            for (let i = 0; i < startWeekDay; i++) {
                const emptyCell = document.createElement('button');
                emptyCell.className = 'calendar-day empty';
                emptyCell.tabIndex = -1;
                emptyCell.setAttribute('aria-hidden', 'true');
                daysContainer.appendChild(emptyCell);
            }

            // Fill actual days
            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(year, month, day);
                const iso = formatISODate(dateObj);

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'calendar-day';
                btn.textContent = String(day);
                btn.setAttribute('data-date', iso);
                btn.setAttribute('aria-label', formatDisplayDate(dateObj));

                const time = dateObj.getTime();
                const startTime = startVal ? startVal.getTime() : null;
                const endTime = endVal ? endVal.getTime() : null;

                if (startTime && time === startTime) {
                    btn.classList.add('selected', 'selected-start');
                }
                if (endTime && time === endTime) {
                    btn.classList.add('selected', 'selected-end');
                }
                if (startTime && endTime && time > startTime && time < endTime) {
                    btn.classList.add('in-range');
                }

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleDaySelection(dateObj);
                });

                daysContainer.appendChild(btn);
            }

            updateDisplayFromInputs();
        }

        function handleDaySelection(dateObj) {
            const iso = formatISODate(dateObj);

            const currentStart = startInput.value ? new Date(startInput.value) : null;
            const currentEnd = endInput.value ? new Date(endInput.value) : null;

            if (calendarActiveTarget === 'start') {
                startInput.value = iso;

                // If start goes after end, shift end to match start
                if (currentEnd && dateObj.getTime() > currentEnd.getTime()) {
                    endInput.value = iso;
                }
            } else {
                endInput.value = iso;

                // If end goes before start, shift start to match end
                if (currentStart && dateObj.getTime() < currentStart.getTime()) {
                    startInput.value = iso;
                }
            }

            renderCalendar();
        }

        // Target toggle buttons
        targetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = btn.dataset.target === 'end' ? 'end' : 'start';
                setActiveTarget(target);
            });
        });

        // Month navigation
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarMonthCursor.setMonth(calendarMonthCursor.getMonth() - 1);
            renderCalendar();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarMonthCursor.setMonth(calendarMonthCursor.getMonth() + 1);
            renderCalendar();
        });

        // Initialize active target and month to today's month
        setActiveTarget('start');
        calendarMonthCursor = new Date();
        calendarMonthCursor.setDate(1);
        // Initialize placeholder states
        updateDisplayFromInputs();
        renderCalendar();
    }

    /**
     * Handle date range selection
     */
    function handleDateRangeSelection(range, button) {
        // Don't filter if clicking custom (it opens popup instead)
        if (range === 'custom') {
            return;
        }

        // Update active state
        const allButtons = document.querySelectorAll('.date-toggle-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        button.classList.add('active');
        currentDateRange = range;
        applyDateFilter(range);
        
        // Close custom popup if open
        const customRangeSection = document.querySelector('.custom-date-range');
        if (customRangeSection) {
            customRangeSection.classList.remove('active');
        }
    }

    /**
     * Apply date filter to table rows
     */
    function applyDateFilter(range) {
        const now = new Date();
        let startDate, endDate;

        // Calculate date range
        switch(range) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;

            case 'tomorrow':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
                break;

            case 'week':
                // Current week (Sunday to Saturday)
                const dayOfWeek = now.getDay();
                startDate = new Date(now);
                startDate.setDate(now.getDate() - dayOfWeek);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;

            case '7days':
                // Next 7 days (upcoming)
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
                break;

            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;

            case '30days':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 30);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;

            case 'custom':
                startDate = customStartDate;
                endDate = customEndDate;
                break;

            case 'all':
            default:
                // Clear date filter
                if (window.tableState && window.tableState.filters) {
                    window.tableState.filters.date = { start: null, end: null };
                    if (window.updateTableWithFilters) {
                        window.updateTableWithFilters();
                    }
                }
                updateKPIs();
                return;
        }

        // Update the filter state in active-picks.js
        if (window.tableState && window.tableState.filters) {
            window.tableState.filters.date.start = startDate;
            window.tableState.filters.date.end = endDate;
            if (window.updateTableWithFilters) {
                window.updateTableWithFilters();
            }
        }

        // Update KPIs based on filtered data
        updateKPIs();
    }

    /**
     * Update KPIs based on currently visible rows
     */
    function updateKPIs() {
        // This function would update the KPI tiles based on visible rows
        // Integrate with existing kpi-calculator.js if needed
        
        // Check if there's a global KPI update function
        if (typeof window.updateKPIValues === 'function') {
            window.updateKPIValues();
        } else if (typeof window.recalculateKPIs === 'function') {
            window.recalculateKPIs();
        }
    }

    /**
     * Get current date range (for external access)
     */
    function getCurrentDateRange() {
        return {
            range: currentDateRange,
            customStart: customStartDate,
            customEnd: customEndDate
        };
    }

    /**
     * Reset ALL filters (date, column filters, and sort)
     */
    function resetDateFilter() {
        // 1. Reset date filter state
        currentDateRange = 'all';
        customStartDate = null;
        customEndDate = null;

        // Reset date toggle active states
        const allButtons = document.querySelectorAll('.date-toggle-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));

        const allTimeButton = document.querySelector('.date-toggle-btn[data-range="all"]');
        if (allTimeButton) {
            allTimeButton.classList.add('active');
        }

        // Hide custom range section
        const customRangeSection = document.querySelector('.custom-date-range');
        if (customRangeSection) {
            customRangeSection.classList.remove('active');
        }

        // 2. Reset column filters and sort via state manager
        if (window.PicksStateManager) {
            window.PicksStateManager.resetAllFilters();
            window.PicksStateManager.resetSort();
        } else if (window.tableState) {
            // Fallback: reset tableState directly
            window.tableState.filters = {
                date: { start: null, end: null },
                league: [],
                team: [],
                betType: [],
                segment: [],
                status: []
            };
            window.tableState.sort = { column: null, direction: 'asc' };
        }

        // 3. Reset filter UI checkboxes and selects
        document.querySelectorAll('.th-filter-dropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        document.querySelectorAll('.th-filter-dropdown select').forEach(sel => {
            sel.selectedIndex = 0;
        });
        document.querySelectorAll('.th-filter-dropdown input[type="text"]').forEach(inp => {
            inp.value = '';
        });

        // 4. Remove filter indicator dots from kebab buttons
        document.querySelectorAll('.th-filter-btn.has-filter').forEach(btn => {
            btn.classList.remove('has-filter');
        });

        // 5. Reset sort indicators on headers
        if (window.PicksSortManager) {
            window.PicksSortManager.updateSortIndicators();
        }

        // 6. Update table display
        if (window.updateTableWithFilters) {
            window.updateTableWithFilters();
        } else if (window.PicksTableRenderer) {
            window.PicksTableRenderer.updateTable();
        }

        // 7. Update KPIs
        updateKPIs();
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDateToggles);
    } else {
        initializeDateToggles();
    }

    // Export functions for external access
    window.DateToggles = {
        getCurrentDateRange,
        resetDateFilter,
        applyDateFilter
    };

})();

