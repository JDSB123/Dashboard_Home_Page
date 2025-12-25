/**
 * Dashboard Filters Adapter
 * Adapts the Weekly Lineup filter UI pattern for the Dashboard
 * Handles dropdown positioning, visibility, and interaction with TableFilters
 */
(function() {
    'use strict';

    const DashboardFilters = {
        init() {
            console.log('Initializing Dashboard Filters Adapter...');
            this.initFilterButtons();
            this.initFilterInteractions();
            
            // Close dropdowns on click outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.th-filter-dropdown') && !e.target.closest('.th-filter-btn')) {
                    this.closeAllDropdowns();
                }
            });

            // Close on scroll
            window.addEventListener('scroll', () => this.closeAllDropdowns(), { passive: true });
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.addEventListener('scroll', () => this.closeAllDropdowns(), { passive: true });
            }
        },

        initFilterButtons() {
            const buttons = document.querySelectorAll('.th-filter-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDropdown(btn);
                });
            });
        },

        toggleDropdown(btn) {
            const dropdownId = btn.getAttribute('aria-controls');
            const dropdown = document.getElementById(dropdownId);
            
            if (!dropdown) {
                console.warn(`Dropdown not found for id: ${dropdownId}`);
                return;
            }

            const isOpen = dropdown.classList.contains('open');
            
            // Close all others first
            this.closeAllDropdowns();

            if (!isOpen) {
                this.openDropdown(dropdown, btn);
            }
        },

        openDropdown(dropdown, btn) {
            // Move to body to avoid clipping/stacking issues
            if (dropdown.parentElement !== document.body) {
                document.body.appendChild(dropdown);
            }

            dropdown.classList.add('open');
            dropdown.hidden = false;
            dropdown.style.display = 'flex';
            
            this.positionDropdown(dropdown, btn);
            
            btn.setAttribute('aria-expanded', 'true');
            btn.classList.add('active');
        },

        closeAllDropdowns() {
            document.querySelectorAll('.th-filter-dropdown').forEach(dd => {
                dd.classList.remove('open');
                dd.hidden = true;
                dd.style.display = 'none';
            });
            
            document.querySelectorAll('.th-filter-btn').forEach(btn => {
                btn.setAttribute('aria-expanded', 'false');
                btn.classList.remove('active');
            });
        },

        positionDropdown(dropdown, btn) {
            const btnRect = btn.getBoundingClientRect();
            const dropdownWidth = 240; // Fixed width from CSS
            
            // Position below the button
            let top = btnRect.bottom + 8;
            let left = btnRect.left - dropdownWidth + btnRect.width; // Align right edge with button

            // Ensure it doesn't go off screen
            if (left < 10) left = 10;
            if (left + dropdownWidth > window.innerWidth) left = window.innerWidth - dropdownWidth - 10;

            dropdown.style.position = 'fixed';
            dropdown.style.top = `${top}px`;
            dropdown.style.left = `${left}px`;
            dropdown.style.zIndex = '10000';
        },

        initFilterInteractions() {
            // Date Range Buttons
            this.attachGroupHandlers('.date-range-btn', 'date', 'range');
            
            // Time Slot Buttons
            this.attachMultiSelectHandlers('.time-slot', 'date', 'time');
            
            // League Pills
            this.attachMultiSelectHandlers('.league-pill', 'matchup', 'league');
            
            // Segment Pills
            this.attachMultiSelectHandlers('.segment-pill', 'pick', 'segment');
            
            // Pick Type Pills
            this.attachMultiSelectHandlers('.pick-pill', 'pick', 'type');
            
            // Status Pills
            this.attachMultiSelectHandlers('.status-pill', 'status', 'status');
            
            // Quick Actions
            document.querySelectorAll('.filter-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = btn.getAttribute('data-action');
                    const dropdown = btn.closest('.th-filter-dropdown');
                    if (!dropdown) return;
                    
                    if (action === 'clear') {
                        this.clearFiltersInDropdown(dropdown);
                    } else if (action === 'select-all') {
                        this.selectAllInDropdown(dropdown);
                    }
                });
            });
        },

        attachGroupHandlers(selector, filterType, dataAttr) {
            document.querySelectorAll(selector).forEach(btn => {
                btn.addEventListener('click', () => {
                    // Toggle active class (single select behavior for ranges usually)
                    const siblings = btn.parentElement.querySelectorAll(selector);
                    siblings.forEach(s => s.classList.remove('active'));
                    btn.classList.add('active');
                    
                    this.applyFilters();
                });
            });
        },

        attachMultiSelectHandlers(selector, filterType, dataAttr) {
            document.querySelectorAll(selector).forEach(btn => {
                btn.addEventListener('click', () => {
                    // Toggle active class (multi select)
                    // Special case for "All" buttons
                    const value = btn.getAttribute(`data-${dataAttr}`);
                    if (value === 'all') {
                        const siblings = btn.parentElement.querySelectorAll(selector);
                        siblings.forEach(s => s.classList.remove('active'));
                        btn.classList.add('active');
                    } else {
                        btn.classList.toggle('active');
                        // If we select a specific item, deselect "All"
                        const allBtn = btn.parentElement.querySelector(`[data-${dataAttr}="all"]`);
                        if (allBtn) allBtn.classList.remove('active');
                        
                        // If nothing is selected, select "All"
                        const anyActive = Array.from(btn.parentElement.querySelectorAll(selector))
                            .some(s => s.classList.contains('active') && s.getAttribute(`data-${dataAttr}`) !== 'all');
                        if (!anyActive && allBtn) allBtn.classList.add('active');
                    }
                    
                    this.applyFilters();
                });
            });
        },

        clearFiltersInDropdown(dropdown) {
            dropdown.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
            // Reset to "All" if present
            dropdown.querySelectorAll('[data-league="all"], [data-segment="all"], [data-pick="all"], [data-status="all"]').forEach(el => el.classList.add('active'));
            this.applyFilters();
        },

        selectAllInDropdown(dropdown) {
            // Select all options except "All"
            dropdown.querySelectorAll('button[data-league], button[data-segment], button[data-pick], button[data-status]').forEach(btn => {
                const val = btn.getAttribute('data-league') || btn.getAttribute('data-segment') || btn.getAttribute('data-pick') || btn.getAttribute('data-status');
                if (val !== 'all') btn.classList.add('active');
            });
            // Deselect "All" buttons
            dropdown.querySelectorAll('[data-league="all"], [data-segment="all"], [data-pick="all"], [data-status="all"]').forEach(el => el.classList.remove('active'));
            this.applyFilters();
        },

        applyFilters() {
            // Collect state from UI and update window.tableState.filters
            // Then call window.TableFilters.applyFilters()
            
            if (!window.tableState || !window.TableFilters) return;

            const filters = window.tableState.filters;

            // Date
            const activeDateRange = document.querySelector('.date-range-btn.active')?.getAttribute('data-range') || 'all';
            // Map range to start/end dates if needed, or just pass the range string if supported
            // For now, let's assume we need to pass the range string to a helper or just store it
            filters.date.activeRange = activeDateRange;
            
            const activeTimes = Array.from(document.querySelectorAll('.time-slot.active')).map(b => b.getAttribute('data-time'));
            filters.date.selectedTimes = activeTimes.length ? activeTimes : null;

            // League
            const activeLeagues = Array.from(document.querySelectorAll('.league-pill.active'))
                .map(b => b.getAttribute('data-league'))
                .filter(v => v !== 'all');
            filters.matchup.league = activeLeagues.length ? activeLeagues[0] : ''; // Assuming single league for now or update logic for multi

            // Segment
            const activeSegments = Array.from(document.querySelectorAll('.segment-pill.active'))
                .map(b => b.getAttribute('data-segment'))
                .filter(v => v !== 'all');
            filters.pick.segment = activeSegments.length ? activeSegments[0] : '';

            // Pick Type
            const activePickTypes = Array.from(document.querySelectorAll('.pick-pill.active'))
                .map(b => b.getAttribute('data-pick'))
                .filter(v => v !== 'all');
            filters.pick.betType = activePickTypes.length ? activePickTypes[0] : '';

            // Status
            const activeStatuses = Array.from(document.querySelectorAll('.status-pill.active'))
                .map(b => b.getAttribute('data-status'))
                .filter(v => v !== 'all');
            filters.status = activeStatuses;

            console.log('Applying filters:', filters);
            window.TableFilters.applyFilters();
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DashboardFilters.init());
    } else {
        DashboardFilters.init();
    }

})();
