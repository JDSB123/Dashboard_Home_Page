/**
 * Accessibility Utilities v1.0
 * Keyboard navigation handlers and ARIA helpers
 */
(function() {
    'use strict';

    /**
     * Make an element keyboard-accessible as a button
     * Adds Enter/Space key handlers that trigger click events
     * @param {HTMLElement} element - Element to make accessible
     * @param {Function} [callback] - Optional callback instead of click
     */
    function makeClickable(element, callback) {
        if (!element) return;

        // Ensure proper attributes
        if (!element.getAttribute('role')) {
            element.setAttribute('role', 'button');
        }
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }

        // Add keyboard handler
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                
                if (callback) {
                    callback.call(this, e);
                } else {
                    this.click();
                }
            }
        });
    }

    /**
     * Make all elements matching selector keyboard-accessible
     * @param {string} selector - CSS selector
     * @param {Function} [callback] - Optional callback
     */
    function makeAllClickable(selector, callback) {
        document.querySelectorAll(selector).forEach(el => makeClickable(el, callback));
    }

    /**
     * Initialize keyboard handlers for parlay rows
     */
    function initParlayKeyboard() {
        // Parlay rows with toggle functionality
        document.querySelectorAll('.parlay-row[role="button"], tr[onclick*="toggleParlay"]').forEach(row => {
            makeClickable(row, function(e) {
                // Trigger parlay toggle
                if (window.toggleParlay) {
                    window.toggleParlay(this);
                } else if (window.PicksParlayManager && window.PicksParlayManager.toggleParlay) {
                    const rowId = this.id || this.getAttribute('data-row-id');
                    window.PicksParlayManager.toggleParlay(rowId);
                } else {
                    // Fallback - simulate click
                    this.click();
                }
            });
        });
    }

    /**
     * Initialize keyboard handlers for KPI tiles
     */
    function initKPIKeyboard() {
        document.querySelectorAll('.kpi-tile[data-action="flip-tile"], .kpi-tile[role="button"]').forEach(tile => {
            makeClickable(tile, function(e) {
                // Toggle between front and back
                const layers = this.querySelectorAll('.kpi-tile-layer');
                if (layers.length < 2) return;

                layers.forEach(layer => layer.classList.toggle('active'));
                
                // Update aria-pressed if present
                const isActive = this.querySelector('.kpi-tile-layer:first-child').classList.contains('active');
                this.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        });
    }

    /**
     * Initialize keyboard handlers for filter dropdowns
     */
    function initFilterKeyboard() {
        // Filter buttons
        document.querySelectorAll('.th-filter-btn').forEach(btn => {
            makeClickable(btn);
        });

        // Filter chips/pills
        document.querySelectorAll('.filter-chip, .filter-pill, .league-chip, .ft-pill, .ft-toggle').forEach(chip => {
            makeClickable(chip);
        });

        // Dropdown menu items
        document.querySelectorAll('.ft-dropdown-item, .ft-dropdown-menu button').forEach(item => {
            makeClickable(item);
        });
    }

    /**
     * Initialize keyboard handlers for sortable headers
     */
    function initSortKeyboard() {
        document.querySelectorAll('.th-sort-btn, th[data-sort]').forEach(header => {
            const btn = header.classList.contains('th-sort-btn') ? header : header.querySelector('.th-sort-btn');
            if (btn) {
                makeClickable(btn);
            }
        });
    }

    /**
     * Initialize keyboard handlers for navigation
     */
    function initNavKeyboard() {
        // Nav dropdown triggers
        document.querySelectorAll('.nav-dropdown-trigger').forEach(trigger => {
            makeClickable(trigger);
        });

        // Sportsbook fetch buttons
        document.querySelectorAll('.sportsbook-fetch-compact').forEach(btn => {
            makeClickable(btn);
        });
    }

    /**
     * Initialize keyboard handlers for tracker buttons
     */
    function initTrackerKeyboard() {
        document.querySelectorAll('.tracker-btn').forEach(btn => {
            if (!btn.hasAttribute('type')) {
                btn.setAttribute('type', 'button');
            }
            makeClickable(btn);
        });
    }

    /**
     * Initialize focus trap for modal dialogs
     * @param {HTMLElement} modal - Modal element
     */
    function initFocusTrap(modal) {
        if (!modal) return;

        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = modal.querySelectorAll(focusableSelector);
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        });
    }

    /**
     * Initialize escape key to close modals/dropdowns
     */
    function initEscapeHandler() {
        document.addEventListener('keydown', function(e) {
            if (e.key !== 'Escape') return;

            // Close open filter dropdowns
            document.querySelectorAll('.th-filter-dropdown.open, .ft-dropdown-menu.open').forEach(dropdown => {
                dropdown.classList.remove('open');
                dropdown.setAttribute('hidden', '');
                
                // Return focus to trigger
                const trigger = document.querySelector(`[aria-controls="${dropdown.id}"]`);
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            });

            // Close modals
            document.querySelectorAll('.bet-modal-overlay:not([hidden]), .modal-overlay:not([hidden])').forEach(modal => {
                modal.setAttribute('hidden', '');
                const closeBtn = modal.querySelector('.bet-modal-close, .modal-close');
                if (closeBtn) closeBtn.click();
            });

            // Close nav dropdowns
            document.querySelectorAll('.nav-dropdown-menu:not([hidden])').forEach(menu => {
                menu.setAttribute('hidden', '');
                const trigger = document.querySelector(`[aria-controls="${menu.id}"]`);
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            });
        });
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     * @param {string} [priority='polite'] - 'polite' or 'assertive'
     */
    function announce(message, priority = 'polite') {
        let announcer = document.getElementById('sr-announcer');
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.setAttribute('aria-live', priority);
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            announcer.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
            document.body.appendChild(announcer);
        }

        // Clear and set new message
        announcer.textContent = '';
        announcer.setAttribute('aria-live', priority);
        
        // Use setTimeout to ensure screen readers pick up the change
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }

    /**
     * Initialize all accessibility features
     */
    function init() {
        console.log('[Accessibility] Initializing keyboard handlers...');
        
        initParlayKeyboard();
        initKPIKeyboard();
        initFilterKeyboard();
        initSortKeyboard();
        initNavKeyboard();
        initTrackerKeyboard();
        initEscapeHandler();

        // Re-initialize when DOM changes (for dynamically added content)
        const observer = new MutationObserver((mutations) => {
            let shouldReinit = false;
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches('.parlay-row, .kpi-tile, .tracker-btn') ||
                                node.querySelector('.parlay-row, .kpi-tile, .tracker-btn')) {
                                shouldReinit = true;
                            }
                        }
                    });
                }
            });

            if (shouldReinit) {
                initParlayKeyboard();
                initKPIKeyboard();
                initTrackerKeyboard();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[Accessibility] Keyboard handlers initialized');
    }

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export API
    window.Accessibility = {
        init,
        makeClickable,
        makeAllClickable,
        initFocusTrap,
        announce,
        // Re-export individual initializers for partial updates
        initParlayKeyboard,
        initKPIKeyboard,
        initFilterKeyboard
    };

})();

