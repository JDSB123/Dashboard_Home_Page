/**
 * Sportsbook Selection Handler
 * Manages visual indication of selected sportsbook across the dashboard
 * Shows a "selected" state on the chosen sportsbook card without dropdown appearance
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'GBSV_SELECTED_SPORTSBOOK';
    let selectedSportsbook = null;

    /**
     * Initialize sportsbook selection handlers
     */
    function init() {
        // Load persisted selection
        selectedSportsbook = localStorage.getItem(STORAGE_KEY);
        
        // Attach click handlers to sportsbook cards
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachHandlers);
        } else {
            attachHandlers();
        }
    }

    /**
     * Attach event handlers to sportsbook cards
     */
    function attachHandlers() {
        // Get all sportsbook cards (excluding the upload card)
        const cards = document.querySelectorAll('.sportsbook-card:not(.upload-picks-card)');
        
        cards.forEach(card => {
            const bookKey = card.getAttribute('data-book');
            
            // Make card clickable
            card.addEventListener('click', (e) => {
                // Don't trigger on input/button clicks
                if (e.target.closest('input') || e.target.closest('button')) {
                    return;
                }
                
                selectSportsbook(bookKey, card);
            });
        });
        
        // Apply initial selected state if one was persisted
        if (selectedSportsbook) {
            applySelectedState(selectedSportsbook);
        }
    }

    /**
     * Select a sportsbook and update visual state
     */
    function selectSportsbook(bookKey, cardElement) {
        if (!bookKey) return;
        
        // Persist selection
        selectedSportsbook = bookKey;
        localStorage.setItem(STORAGE_KEY, bookKey);
        
        // Update visual state on all cards
        document.querySelectorAll('.sportsbook-card:not(.upload-picks-card)').forEach(card => {
            if (card.getAttribute('data-book') === bookKey) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        // Update nav trigger to show selected state
        updateNavTriggerState(bookKey);
        
        console.log('[SPORTSBOOK SELECTION]', `Selected: ${bookKey}`);
    }

    /**
     * Apply selected state without triggering the full click flow
     */
    function applySelectedState(bookKey) {
        const card = document.querySelector(`.sportsbook-card[data-book="${bookKey}"]`);
        if (card) {
            selectSportsbook(bookKey, card);
        }
    }

    /**
     * Update nav trigger to show selected state
     */
    function updateNavTriggerState(bookKey) {
        const trigger = document.getElementById('sportsbooks-trigger');
        if (!trigger) return;
        
        if (bookKey) {
            trigger.classList.add('has-selection');
        } else {
            trigger.classList.remove('has-selection');
        }
        // Always keep trigger text as "My Sports Books"
        trigger.textContent = 'My Sports Books';
    }

    /**
     * Get the currently selected sportsbook
     */
    function getSelectedSportsbook() {
        return selectedSportsbook;
    }

    /**
     * Clear selection
     */
    function clearSelection() {
        selectedSportsbook = null;
        localStorage.removeItem(STORAGE_KEY);
        
        document.querySelectorAll('.sportsbook-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const trigger = document.getElementById('sportsbooks-trigger');
        if (trigger) {
            trigger.classList.remove('has-selection');
            trigger.textContent = 'My Sports Books';
        }
    }

    // Expose for external use
    window.SportsBookSelectionHandler = {
        getSelected: getSelectedSportsbook,
        selectBook: selectSportsbook,
        clearSelection: clearSelection
    };

    // Initialize on load
    init();

})();
