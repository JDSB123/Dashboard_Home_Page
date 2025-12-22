/**
 * @file zebra-stripes.js
 * @description Zebra stripe utility for alternating table row backgrounds with performance optimizations
 * @module ZebraStripes
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Debouncing configuration
    let zebraTimeout = null;
    const DEBOUNCE_DELAY = 50; // milliseconds

    /**
     * Checks if a table row is visible for zebra striping purposes
     * @param {HTMLTableRowElement} row - Table row element
     * @returns {boolean} True if row should be counted for zebra striping
     */
    function isRowVisibleForZebra(row) {
        if (!row) return false;
        if (row.style.display === 'none') return false;
        if (row.hasAttribute('hidden') || row.getAttribute('aria-hidden') === 'true') return false;
        if (row.classList.contains('is-hidden') || row.classList.contains('hidden')) return false;
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const computed = window.getComputedStyle(row);
            if (!computed) return false;
            if (computed.display === 'none' || computed.visibility === 'hidden') return false;
        }
        return true;
    }

    /**
     * Gets direct child TR elements from a tbody
     * @param {HTMLTableSectionElement} tbody - Table body element
     * @returns {HTMLTableRowElement[]} Array of TR elements
     */
    function getDirectChildRows(tbody) {
        if (!tbody) return [];
        return Array.from(tbody.children).filter(node => node && node.tagName === 'TR');
    }

    /**
     * Gets parent rows only (excludes parlay-legs rows)
     * @param {HTMLTableSectionElement} tbody - Table body element
     * @returns {HTMLTableRowElement[]} Array of parent TR elements
     */
    function getParentRowsOnly(tbody) {
        return getDirectChildRows(tbody).filter(row => !row.classList.contains('parlay-legs'));
    }

    /**
     * Finds the parlay legs row associated with a parent parlay row
     * @param {HTMLTableRowElement} parentRow - Parent parlay row
     * @returns {HTMLTableRowElement|null} Associated legs row or null
     */
    function findParlayLegsRow(parentRow) {
        if (!parentRow) return null;
        const rowId = parentRow.getAttribute('data-row-id');
        if (rowId) {
            const byId = document.querySelector(`tr.parlay-legs[data-parent-id="${rowId}"]`);
            if (byId) return byId;
        }
        const nextSibling = parentRow.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('parlay-legs')) {
            return nextSibling;
        }
        return null;
    }

    // Cache for tbody element to avoid repeated DOM queries
    let cachedTbody = null;
    let lastTbodyCheck = 0;
    const TBODY_CACHE_TIME = 1000; // milliseconds

    /**
     * Applies zebra striping to the picks table
     * Alternates odd/even classes on visible rows
     * @param {HTMLTableSectionElement} [forceTbody] - Optional tbody to use instead of cached
     * @returns {number} Number of visible rows striped
     */
    function applyPicksTableZebraStripes(forceTbody) {
        // Use provided tbody or get cached/fresh tbody
        let tbody = forceTbody;
        if (!tbody) {
            const now = Date.now();
            if (!cachedTbody || now - lastTbodyCheck > TBODY_CACHE_TIME) {
                cachedTbody = document.getElementById('picks-tbody') || document.querySelector('.picks-table tbody');
                lastTbodyCheck = now;
            }
            tbody = cachedTbody;
        }

        if (!tbody) return 0;

        const zebraClasses = ['zebra-row', 'zebra-odd', 'zebra-even'];
        
        // Clear existing zebra classes
        tbody.querySelectorAll('.zebra-row, .zebra-odd, .zebra-even').forEach(row => {
            zebraClasses.forEach(cls => row.classList.remove(cls));
        });

        // Get parent rows (not parlay legs)
        const parentRows = getDirectChildRows(tbody).filter(row => {
            if (!row) return false;
            if (row.classList.contains('parlay-legs')) return false;
            if (row.dataset && row.dataset.zebraIgnore === 'true') return false;
            return true;
        });

        /**
         * Applies zebra stripes to nested leg table rows
         * @param {HTMLTableRowElement} legsRow - Parlay legs container row
         */
        const applyLegTableStripes = (legsRow) => {
            if (!legsRow) return;
            // Try tbody tr first, fall back to filtering out thead rows
            let legRows = legsRow.querySelectorAll('.compact-leg-table tbody tr');
            if (!legRows.length) {
                // Fallback: get all tr and filter out any in thead
                const allRows = legsRow.querySelectorAll('.compact-leg-table tr');
                legRows = Array.from(allRows).filter(tr => !tr.closest('thead'));
            }
            if (!legRows.length) return;
            legRows.forEach((legRow, legIndex) => {
                zebraClasses.forEach(cls => legRow.classList.remove(cls));
                const legClass = legIndex % 2 === 0 ? 'zebra-odd' : 'zebra-even';
                legRow.classList.add('zebra-row', legClass);
            });
        };

        let visibleIndex = 0;
        parentRows.forEach(row => {
            if (!isRowVisibleForZebra(row)) {
                return;
            }

            const zebraClass = visibleIndex % 2 === 0 ? 'zebra-odd' : 'zebra-even';
            row.classList.add('zebra-row', zebraClass);
            visibleIndex += 1;

            if (row.classList.contains('parlay-row')) {
                const legsRow = findParlayLegsRow(row);
                if (legsRow) {
                    const legsVisible = isRowVisibleForZebra(legsRow);
                    
                    // Only apply zebra classes if the legs row is visible
                    if (legsVisible) {
                        const legsZebraClass = visibleIndex % 2 === 0 ? 'zebra-odd' : 'zebra-even';
                        legsRow.classList.add('zebra-row', legsZebraClass);
                        applyLegTableStripes(legsRow);
                        visibleIndex += 1;
                    } else {
                        // Hidden legs inherit parent's stripe for when they become visible
                        legsRow.classList.add('zebra-row', zebraClass);
                    }
                }
            }
        });

        // Return count of visible rows striped for diagnostics
        return visibleIndex;
    }

    /**
     * Debounced version of applyPicksTableZebraStripes
     * Prevents excessive recalculation during rapid DOM changes
     * @param {number} [customDelay] - Optional custom delay in milliseconds
     */
    function debouncedApplyZebraStripes(customDelay) {
        const delay = customDelay || DEBOUNCE_DELAY;
        clearTimeout(zebraTimeout);
        zebraTimeout = setTimeout(() => {
            applyPicksTableZebraStripes();
        }, delay);
    }

    /**
     * Immediately applies zebra stripes (cancels any pending debounced calls)
     */
    function applyZebraStripesNow() {
        clearTimeout(zebraTimeout);
        applyPicksTableZebraStripes();
    }

    // Export to window for cross-script access
    window.ZebraStripes = {
        isRowVisibleForZebra,
        getDirectChildRows,
        getParentRowsOnly,
        findParlayLegsRow,
        applyPicksTableZebraStripes,
        debouncedApply: debouncedApplyZebraStripes,
        applyNow: applyZebraStripesNow,
        DEBOUNCE_DELAY
    };

    // Also expose commonly used functions directly
    window.__gbsvApplyZebraStripes = applyPicksTableZebraStripes;
    window.getDirectChildRows = getDirectChildRows;
    window.getParentRowsOnly = getParentRowsOnly;
    window.findParlayLegsRow = findParlayLegsRow;

    // Apply initial zebra stripes on load
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyPicksTableZebraStripes);
        } else {
            try {
                applyPicksTableZebraStripes();
            } catch (_) {
                // no-op
            }
        }
    }

    console.log('✅ zebra-stripes.js loaded');
})();