/**
 * Manual Pick Modal v1.0.0
 * Provides row-level "+" button in Weekly Lineup table for manual pick entry
 * Opens modal with form to enter: league, matchup, pick, odds, risk, segment, fire rating
 */

(function() {
    'use strict';

    const MODAL_ID = 'manual-pick-modal';
    let currentContextData = {};

    /**
     * Initialize modal and attach event listeners
     * Called after DOM is ready
     */
    function initManualPickModal() {
        // Create modal HTML
        createModalHTML();

        // Wait for page to fully load before attaching listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachEventListeners);
        } else {
            attachEventListeners();
        }

        // Re-attach listeners when table is re-rendered (for dynamically loaded content)
        observeTableChanges();
    }

    /**
     * Create modal HTML structure
     */
    function createModalHTML() {
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'manual-pick-modal-overlay';
        modal.innerHTML = `
            <div class="manual-pick-modal">
                <div class="modal-header">
                    <h2>Add Manual Pick</h2>
                    <button type="button" class="modal-close" aria-label="Close modal">✕</button>
                </div>
                <div class="modal-body">
                    <form id="manual-pick-form" novalidate>
                        <div class="form-group">
                            <label for="manual-league">League</label>
                            <select id="manual-league" name="league" required>
                                <option value="">Select League</option>
                                <option value="NBA">NBA</option>
                                <option value="NFL">NFL</option>
                                <option value="NCAAM">NCAAM</option>
                                <option value="NCAAF">NCAAF</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="manual-matchup">Matchup</label>
                            <input 
                                type="text" 
                                id="manual-matchup"
                                name="matchup" 
                                placeholder="e.g., Lakers vs Celtics" 
                                required>
                        </div>

                        <div class="form-group">
                            <label for="manual-pick">Pick</label>
                            <input 
                                type="text" 
                                id="manual-pick"
                                name="pick" 
                                placeholder="e.g., Lakers -3.5 or Over 225.5" 
                                required>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="manual-odds">Odds</label>
                                <input 
                                    type="number" 
                                    id="manual-odds"
                                    name="odds" 
                                    placeholder="-110" 
                                    value="-110"
                                    required>
                            </div>
                            <div class="form-group">
                                <label for="manual-risk">Risk Amount ($)</label>
                                <input 
                                    type="number" 
                                    id="manual-risk"
                                    name="risk" 
                                    placeholder="50000" 
                                    value="50000"
                                    required
                                    min="1">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="manual-segment">Segment</label>
                                <select id="manual-segment" name="segment">
                                    <option value="FG">Full Game (FG)</option>
                                    <option value="1H">1st Half (1H)</option>
                                    <option value="2H">2nd Half (2H)</option>
                                    <option value="1Q">1st Quarter (1Q)</option>
                                    <option value="2Q">2nd Quarter (2Q)</option>
                                    <option value="3Q">3rd Quarter (3Q)</option>
                                    <option value="4Q">4th Quarter (4Q)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="manual-fire">Fire Rating</label>
                                <select id="manual-fire" name="fire">
                                    <option value="1">🔥 (Low)</option>
                                    <option value="2">🔥🔥 (Medium)</option>
                                    <option value="3" selected>🔥🔥🔥 (High)</option>
                                    <option value="4">🔥🔥🔥🔥 (Hot)</option>
                                    <option value="5">🔥🔥🔥🔥🔥 (Max)</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group form-info">
                            <small>To Win: <strong id="to-win-calc">0.00</strong></small>
                            <small>Will be saved to your local dashboard</small>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="modal-save">Add to Dashboard</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Attach event listeners to modal and buttons
     * Uses delegation for dynamically added buttons
     */
    function attachEventListeners() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        // Use event delegation for dynamically created buttons
        if (!document._manualPickDelegationAttached) {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.add-pick-manual-btn');
                if (btn) {
                    handleAddPickClick(e);
                }
            });
            document._manualPickDelegationAttached = true;
        }

        // Modal controls
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('modal-cancel');
        const saveBtn = document.getElementById('modal-save');

        closeBtn?.removeEventListener('click', closeModal);
        closeBtn?.addEventListener('click', closeModal);

        cancelBtn?.removeEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);

        saveBtn?.removeEventListener('click', savePick);
        saveBtn?.addEventListener('click', savePick);

        // Overlay close on outside click
        modal.removeEventListener('click', handleOverlayClick);
        modal.addEventListener('click', handleOverlayClick);

        // Real-time To Win calculation
        const oddsInput = document.getElementById('manual-odds');
        const riskInput = document.getElementById('manual-risk');

        oddsInput?.removeEventListener('input', updateToWinCalc);
        oddsInput?.addEventListener('input', updateToWinCalc);

        riskInput?.removeEventListener('input', updateToWinCalc);
        riskInput?.addEventListener('input', updateToWinCalc);

        // Inject buttons into table rows
        injectButtonsIntoTableRows();
    }

    /**
     * Inject "+" buttons into existing table rows
     * Looks for .col-pick or .picks-table cells
     */
    function injectButtonsIntoTableRows() {
        const tbody = document.querySelector('.picks-table tbody, #picks-tbody');
        if (!tbody) return;

        // Find all pick cells in data rows
        tbody.querySelectorAll('tr:not(.empty-state-row)').forEach(row => {
            // Skip if button already added
            if (row.querySelector('.add-pick-manual-btn')) return;

            // Find the pick cell
            let pickCell = row.querySelector('.col-pick');
            if (!pickCell) {
                // Fallback: look for pick text
                const cells = row.querySelectorAll('td');
                if (cells.length > 3) {
                    pickCell = cells[3]; // Usually 4th column
                }
            }

            if (pickCell) {
                // Create wrapper for button
                const wrapper = document.createElement('div');
                wrapper.className = 'pick-cell-actions';
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                wrapper.style.gap = '8px';

                // Create button
                const btn = document.createElement('button');
                btn.className = 'add-pick-manual-btn';
                btn.type = 'button';
                btn.textContent = '+';
                btn.title = 'Manually add this pick';

                // Extract league, matchup, pick from row
                const league = row.getAttribute('data-league') || row.querySelector('.league-badge')?.textContent || '';
                const matchup = row.getAttribute('data-matchup') || row.querySelector('.matchup')?.textContent || '';
                const pick = pickCell.textContent.trim();

                btn.dataset.league = league;
                btn.dataset.matchup = matchup;
                btn.dataset.pick = pick;

                wrapper.appendChild(btn);

                // Insert into pick cell
                const pickContent = document.createElement('div');
                pickContent.className = 'pick-text';
                while (pickCell.firstChild) {
                    pickContent.appendChild(pickCell.firstChild);
                }
                pickCell.appendChild(pickContent);
                pickCell.appendChild(wrapper);
            }
        });
    }

    /**
     * Handle "+" button click
     */
    function handleAddPickClick(e) {
        const btn = e.target.closest('.add-pick-manual-btn');
        if (!btn) return;

        currentContextData = {
            league: btn.dataset.league || '',
            matchup: btn.dataset.matchup || '',
            pick: btn.dataset.pick || ''
        };

        openModal();
    }

    /**
     * Handle overlay outside-click to close
     */
    function handleOverlayClick(e) {
        const modal = document.getElementById(MODAL_ID);
        if (e.target === modal) {
            closeModal();
        }
    }

    /**
     * Open modal and pre-fill form if context data exists
     */
    function openModal() {
        const modal = document.getElementById(MODAL_ID);
        const form = modal.querySelector('#manual-pick-form');

        // Pre-fill form with context data
        if (currentContextData.league) {
            form.querySelector('[name="league"]').value = currentContextData.league;
        }
        if (currentContextData.matchup) {
            form.querySelector('[name="matchup"]').value = currentContextData.matchup;
        }
        if (currentContextData.pick) {
            form.querySelector('[name="pick"]').value = currentContextData.pick;
        }

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // Focus on first empty field
        const leagueInput = form.querySelector('[name="league"]');
        if (!leagueInput.value) {
            leagueInput.focus();
        } else {
            form.querySelector('[name="matchup"]').focus();
        }

        updateToWinCalc();
    }

    /**
     * Close modal and reset form
     */
    function closeModal() {
        const modal = document.getElementById(MODAL_ID);
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');

        const form = modal.querySelector('#manual-pick-form');
        form.reset();
        currentContextData = {};
    }

    /**
     * Calculate and display "To Win" amount based on odds and risk
     */
    function updateToWinCalc() {
        const oddsInput = document.getElementById('manual-odds');
        const riskInput = document.getElementById('manual-risk');
        const calcDisplay = document.getElementById('to-win-calc');

        const odds = parseInt(oddsInput.value) || -110;
        const risk = parseFloat(riskInput.value) || 50000;

        const toWin = calculateToWin(odds, risk);
        calcDisplay.textContent = toWin.toFixed(2);
    }

    /**
     * Calculate To Win amount from odds and risk
     */
    function calculateToWin(odds, risk) {
        if (odds < 0) {
            // Negative odds (favorite): to_win = risk * (100 / |odds|)
            return risk * (100 / Math.abs(odds));
        } else {
            // Positive odds (underdog): to_win = risk * (odds / 100)
            return risk * (odds / 100);
        }
    }

    /**
     * Save manual pick to dashboard
     */
    function savePick() {
        const form = document.querySelector('#manual-pick-form');

        // Validate form
        if (!form.reportValidity()) {
            console.warn('Form validation failed');
            return;
        }

        const formData = new FormData(form);

        const pick = {
            league: formData.get('league'),
            matchup: formData.get('matchup'),
            pick: formData.get('pick'),
            odds: parseInt(formData.get('odds')),
            risk: parseFloat(formData.get('risk')),
            toWin: calculateToWin(parseInt(formData.get('odds')), parseFloat(formData.get('risk'))),
            segment: formData.get('segment'),
            fire: parseInt(formData.get('fire')),
            source: 'manual-entry',
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        console.log('✅ Saving manual pick:', pick);

        // Add to local dashboard
        if (window.LocalPicksManager) {
            window.LocalPicksManager.addPicks([pick]);
            console.log('✅ Manual pick added to dashboard');
        } else {
            console.error('❌ LocalPicksManager not found');
            alert('Error: Could not save pick. Please refresh the page.');
            return;
        }

        closeModal();

        // Show success message
        if (window.StatusIndicator && window.StatusIndicator.show) {
            window.StatusIndicator.show(`✅ Pick added: ${pick.pick}`, 'success', 3000);
        } else {
            alert(`✅ Pick added: ${pick.pick}`);
        }
    }

    /**
     * Observe table changes and re-attach listeners when table is re-rendered
     * This handles dynamically loaded picks from API
     */
    function observeTableChanges() {
        const tableContainer = document.querySelector('.weekly-lineup-table-wrapper');
        if (!tableContainer) return;

        const observer = new MutationObserver(() => {
            // Re-attach listeners to newly created buttons
            setTimeout(attachEventListeners, 100);
        });

        observer.observe(tableContainer, {
            childList: true,
            subtree: true,
            characterData: false
        });
    }

    // Initialize when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initManualPickModal);
    } else {
        initManualPickModal();
    }

    // Public API
    window.ManualPickModal = {
        open: openModal,
        close: closeModal,
        attachListeners: attachEventListeners
    };

})();
