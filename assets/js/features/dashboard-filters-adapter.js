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
        },

        // ===== FILTER TOOLBAR HANDLING =====
        initToolbar() {
            const toolbar = document.getElementById('filter-toolbar');
            if (!toolbar) return;

            console.log('Initializing filter toolbar...');

            // League pill toggles
            toolbar.querySelectorAll('.ft-pill.ft-league').forEach(pill => {
                pill.addEventListener('click', () => {
                    pill.classList.toggle('active');
                    this.applyToolbarFilters();
                });
            });

            // Dropdown toggles
            const dropdowns = toolbar.querySelectorAll('.ft-dropdown');
            dropdowns.forEach(dropdown => {
                const btn = dropdown.querySelector('.ft-dropdown-btn');
                const menu = dropdown.querySelector('.ft-dropdown-menu');
                if (btn && menu) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Close all other dropdowns
                        dropdowns.forEach(d => {
                            if (d !== dropdown) {
                                d.querySelector('.ft-dropdown-menu')?.classList.remove('open');
                                d.querySelector('.ft-dropdown-btn')?.classList.remove('open');
                            }
                        });
                        menu.classList.toggle('open');
                        btn.classList.toggle('open');
                    });
                }
            });

            // Close dropdowns on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.ft-dropdown')) {
                    toolbar.querySelectorAll('.ft-dropdown-menu').forEach(m => m.classList.remove('open'));
                    toolbar.querySelectorAll('.ft-dropdown-btn').forEach(b => b.classList.remove('open'));
                }
            });

            // Edge dropdown items
            toolbar.querySelectorAll('#edge-dropdown-menu .ft-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    item.classList.toggle('active');
                    const menu = item.closest('.ft-dropdown-menu');
                    if (menu) {
                        const activeCount = menu.querySelectorAll('.ft-dropdown-item.active').length;
                        this.updateDropdownButtonText('edge-dropdown-btn', 'Edge', activeCount);
                    }
                    this.applyToolbarFilters();
                });
            });

            // Fire dropdown items
            toolbar.querySelectorAll('#fire-dropdown-menu .ft-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    item.classList.toggle('active');
                    const menu = item.closest('.ft-dropdown-menu');
                    if (menu) {
                        const activeCount = menu.querySelectorAll('.ft-dropdown-item.active').length;
                        this.updateDropdownButtonText('fire-dropdown-btn', '🔥 Fire', activeCount);
                    }
                    this.applyToolbarFilters();
                });
            });

            // Clear button
            const clearBtn = toolbar.querySelector('#ft-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    // Clear all pills
                    toolbar.querySelectorAll('.ft-pill.active').forEach(p => p.classList.remove('active'));
                    // Clear dropdown selections
                    toolbar.querySelectorAll('#edge-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                    const edgeBtn = document.getElementById('edge-dropdown-btn');
                    if (edgeBtn) edgeBtn.innerHTML = '<svg class="edge-svg" viewBox="0 0 16 16" fill="currentColor"><path d="M4 14V9h2v5H4zm3 0V6h2v8H7zm3 0V2h2v12h-2z"/></svg>Edge ▾';
                    
                    toolbar.querySelectorAll('#fire-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                    const fireBtn = document.getElementById('fire-dropdown-btn');
                    if (fireBtn) fireBtn.textContent = '🔥 Fire ▾';
                    
                    this.applyToolbarFilters();
                    this.clearFilterChips();
                });
            }
        },

        updateDropdownButtonText(btnId, label, count) {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            if (btnId === 'edge-dropdown-btn') {
                btn.innerHTML = `<svg class="edge-svg" viewBox="0 0 16 16" fill="currentColor"><path d="M4 14V9h2v5H4zm3 0V6h2v8H7zm3 0V2h2v12h-2z"/></svg>${label}${count > 0 ? ` (${count})` : ''} ▾`;
            } else {
                btn.textContent = `${label}${count > 0 ? ` (${count})` : ''} ▾`;
            }
        },

        applyToolbarFilters() {
            const toolbar = document.getElementById('filter-toolbar');
            if (!toolbar) return;

            // Collect active leagues
            const activeLeagues = Array.from(toolbar.querySelectorAll('.ft-pill.ft-league.active'))
                .map(p => p.getAttribute('data-league'));

            // Collect active edge values
            const activeEdges = Array.from(toolbar.querySelectorAll('#edge-dropdown-menu .ft-dropdown-item.active'))
                .map(i => i.getAttribute('data-v'));

            // Collect active fire values
            const activeFires = Array.from(toolbar.querySelectorAll('#fire-dropdown-menu .ft-dropdown-item.active'))
                .map(i => i.getAttribute('data-v'));

            console.log('Toolbar filters:', { activeLeagues, activeEdges, activeFires });

            // Apply to table filtering
            if (window.tableState && window.TableFilters) {
                // Set league filter
                if (activeLeagues.length > 0) {
                    window.tableState.filters.matchup.league = activeLeagues;
                } else {
                    window.tableState.filters.matchup.league = '';
                }
                
                // Edge and Fire would need to be added to tableState.filters schema
                // For now, store them and let TableFilters handle
                window.tableState.filters.edge = activeEdges;
                window.tableState.filters.fire = activeFires;

                window.TableFilters.applyFilters();
            }

            // Update filter chips display
            this.updateFilterChips(activeLeagues, activeEdges, activeFires);
        },

        updateFilterChips(leagues, edges, fires) {
            const chipsContainer = document.getElementById('table-filter-chips');
            if (!chipsContainer) return;

            chipsContainer.innerHTML = '';
            let hasChips = false;

            leagues.forEach(league => {
                hasChips = true;
                const chip = document.createElement('span');
                chip.className = 'filter-chip';
                chip.innerHTML = `${league.toUpperCase()} <button class="chip-remove" data-type="league" data-value="${league}">×</button>`;
                chipsContainer.appendChild(chip);
            });

            edges.forEach(edge => {
                hasChips = true;
                const chip = document.createElement('span');
                chip.className = 'filter-chip';
                const label = edge === 'high' ? 'Best Edge' : edge === 'medium' ? 'Good Edge' : 'Low Edge';
                chip.innerHTML = `${label} <button class="chip-remove" data-type="edge" data-value="${edge}">×</button>`;
                chipsContainer.appendChild(chip);
            });

            fires.forEach(fire => {
                hasChips = true;
                const chip = document.createElement('span');
                chip.className = 'filter-chip';
                chip.innerHTML = `${'🔥'.repeat(parseInt(fire))} <button class="chip-remove" data-type="fire" data-value="${fire}">×</button>`;
                chipsContainer.appendChild(chip);
            });

            chipsContainer.setAttribute('data-has-chips', hasChips ? 'true' : 'false');

            // Add chip remove handlers
            chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    const type = btn.getAttribute('data-type');
                    const value = btn.getAttribute('data-value');
                    this.removeFilter(type, value);
                });
            });
        },

        removeFilter(type, value) {
            const toolbar = document.getElementById('filter-toolbar');
            if (!toolbar) return;

            if (type === 'league') {
                const pill = toolbar.querySelector(`.ft-pill.ft-league[data-league="${value}"]`);
                if (pill) pill.classList.remove('active');
            } else if (type === 'edge') {
                const item = toolbar.querySelector(`#edge-dropdown-menu .ft-dropdown-item[data-v="${value}"]`);
                if (item) item.classList.remove('active');
                const menu = document.getElementById('edge-dropdown-menu');
                if (menu) {
                    const count = menu.querySelectorAll('.ft-dropdown-item.active').length;
                    this.updateDropdownButtonText('edge-dropdown-btn', 'Edge', count);
                }
            } else if (type === 'fire') {
                const item = toolbar.querySelector(`#fire-dropdown-menu .ft-dropdown-item[data-v="${value}"]`);
                if (item) item.classList.remove('active');
                const menu = document.getElementById('fire-dropdown-menu');
                if (menu) {
                    const count = menu.querySelectorAll('.ft-dropdown-item.active').length;
                    this.updateDropdownButtonText('fire-dropdown-btn', '🔥 Fire', count);
                }
            }

            this.applyToolbarFilters();
        },

        clearFilterChips() {
            const chipsContainer = document.getElementById('table-filter-chips');
            if (chipsContainer) {
                chipsContainer.innerHTML = '';
                chipsContainer.setAttribute('data-has-chips', 'false');
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DashboardFilters.init();
            DashboardFilters.initToolbar();
        });
    } else {
        DashboardFilters.init();
        DashboardFilters.initToolbar();
    }

})();
