# Manual Pick Entry Guide - Weekly Lineup & Dashboard

## Current State

Your dashboard has two primary data flow paths:

### 1. **Automated Model Picks** (Current Primary)

- NBA, NFL, NCAAM, NCAAF Container App APIs fetch algorithmic picks
- Displayed in Weekly Lineup table with edge/fire ratings
- Auto-refresh buttons for each league

### 2. **Manual Pick Upload** (Partially Built)

- Textarea for pasting picks (`paste-area` in weekly-lineup.html)
- File upload for PDFs, images, HTML, text, CSV
- Parsed into "Parsed Picks" section before adding to dashboard

## Implementation Options

### **Option A: Quick Manual Add Button (Recommended)**

Add a "+" button next to each game row to manually create a pick from the Weekly Lineup display.

**Where to add:**

- [weekly-lineup.html](../client/weekly-lineup.html) - In the picks table row, after the pick display

**How it works:**

1. User sees a game row (e.g., "Lakers -3.5")
2. Clicks "+" button
3. Modal opens with form:
   - Matchup (auto-filled from row)
   - League (auto-filled)
   - Pick text (auto-filled with displayed pick)
   - Odds (auto-filled)
   - Risk amount
   - Segment (FG, 1H, 2H, etc.)
   - Fire rating (optional)
4. Save → pick added to local dashboard

**Advantages:**

- User can see odds/schedule while entering
- Minimal typing required
- Integrates seamlessly with existing Weekly Lineup UI

---

### **Option B: Dedicated Manual Entry Page**

Create a new `manual-picks.html` page with a form for batch entry.

**Structure:**

```
Manual Picks Entry
├── Quick Single Entry
│   ├── League selector
│   ├── Matchup search/dropdown
│   ├── Pick text input
│   ├── Odds input
│   ├── Risk amount
│   └── Add button
├── Batch Entry (Textarea)
│   ├── Paste multiple picks at once
│   └── Auto-parse format
└── Recent Picks (Last 10)
    └── Click to edit/delete
```

**Advantages:**

- Dedicated UI doesn't distract from viewing picks
- Good for batch entry from external notes
- Can save templates/recurring picks

---

### **Option C: Quick Add Modal in Weekly Lineup**

Floating "+" button (bottom right corner) that opens quick entry modal.

**How it works:**

1. Floating action button with "+" icon
2. Click → modal appears
3. User enters pick details or pastes text
4. Supports both single and batch entry

**Advantages:**

- Always accessible
- Doesn't clutter table UI
- Mobile-friendly

---

## Implementation Details

### **A: Row-Level Manual Entry Button**

**1. Add HTML button to table row** ([weekly-lineup.html](../client/weekly-lineup.html)):

```html
<!-- In the picks-table row template, after the pick display -->
<td class="picks-table-actions">
  <button
    class="add-pick-manual-btn"
    data-league="NBA"
    data-matchup="Lakers vs Celtics"
    title="Manually add this pick"
  >
    +
  </button>
</td>
```

**2. Add CSS styling** (weekly-lineup.css):

```css
.add-pick-manual-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 16px;
  transition: background 0.2s;
}

.add-pick-manual-btn:hover {
  background: #45a049;
}

.add-pick-manual-btn:active {
  transform: scale(0.95);
}
```

**3. Create manual-pick-modal.js:**

```javascript
(function () {
  "use strict";

  const MODAL_ID = "manual-pick-modal";

  // Initialize modal when DOM ready
  document.addEventListener("DOMContentLoaded", initManualPickModal);

  function initManualPickModal() {
    // Create modal HTML
    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "manual-pick-modal-overlay";
    modal.innerHTML = `
            <div class="manual-pick-modal">
                <div class="modal-header">
                    <h2>Add Manual Pick</h2>
                    <button type="button" class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <form id="manual-pick-form">
                        <div class="form-group">
                            <label>League</label>
                            <select name="league" required>
                                <option value="">Select League</option>
                                <option value="NBA">NBA</option>
                                <option value="NFL">NFL</option>
                                <option value="NCAAM">NCAAM</option>
                                <option value="NCAAF">NCAAF</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Matchup</label>
                            <input type="text" name="matchup" placeholder="e.g., Lakers vs Celtics" required>
                        </div>

                        <div class="form-group">
                            <label>Pick</label>
                            <input type="text" name="pick" placeholder="e.g., Lakers -3.5" required>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Odds</label>
                                <input type="number" name="odds" placeholder="-110" required>
                            </div>
                            <div class="form-group">
                                <label>Risk ($)</label>
                                <input type="number" name="risk" placeholder="50000" required>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Segment</label>
                                <select name="segment">
                                    <option value="FG">Full Game (FG)</option>
                                    <option value="1H">1st Half (1H)</option>
                                    <option value="2H">2nd Half (2H)</option>
                                    <option value="1Q">1st Quarter (1Q)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fire Rating</label>
                                <select name="fire">
                                    <option value="1">🔥</option>
                                    <option value="2">🔥🔥</option>
                                    <option value="3">🔥🔥🔥</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-cancel">Cancel</button>
                    <button type="button" class="btn-save">Add to Dashboard</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);

    // Attach event listeners
    attachEventListeners();
  }

  function attachEventListeners() {
    // Add button click handlers
    document.querySelectorAll(".add-pick-manual-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const league = e.target.dataset.league;
        const matchup = e.target.dataset.matchup;
        openModal(league, matchup);
      });
    });

    // Modal controls
    document
      .querySelector(`#${MODAL_ID} .modal-close`)
      .addEventListener("click", closeModal);
    document
      .querySelector(`#${MODAL_ID} .btn-cancel`)
      .addEventListener("click", closeModal);
    document
      .querySelector(`#${MODAL_ID} .btn-save`)
      .addEventListener("click", savePick);

    // Overlay close on outside click
    document.getElementById(MODAL_ID).addEventListener("click", (e) => {
      if (e.target.id === MODAL_ID) closeModal();
    });
  }

  function openModal(league, matchup) {
    const modal = document.getElementById(MODAL_ID);
    const form = modal.querySelector("#manual-pick-form");

    // Pre-fill form
    form.querySelector('[name="league"]').value = league;
    form.querySelector('[name="matchup"]').value = matchup;

    modal.style.display = "flex";
  }

  function closeModal() {
    document.getElementById(MODAL_ID).style.display = "none";
    document.querySelector("#manual-pick-form").reset();
  }

  function savePick() {
    const form = document.querySelector("#manual-pick-form");
    const data = new FormData(form);

    const pick = {
      league: data.get("league"),
      matchup: data.get("matchup"),
      pick: data.get("pick"),
      odds: parseInt(data.get("odds")),
      risk: parseFloat(data.get("risk")),
      toWin: calculateToWin(data.get("odds"), data.get("risk")),
      segment: data.get("segment"),
      fire: data.get("fire"),
      source: "manual",
      timestamp: new Date().toISOString(),
    };

    // Add to local dashboard (uses existing LocalPicksManager)
    if (window.LocalPicksManager) {
      window.LocalPicksManager.addPicks([pick]);
      console.log("✅ Manual pick added:", pick);
    }

    closeModal();
  }

  function calculateToWin(odds, risk) {
    const o = parseInt(odds);
    if (o < 0) {
      return parseFloat((risk * (100 / Math.abs(o))).toFixed(2));
    } else {
      return parseFloat((risk * (o / 100)).toFixed(2));
    }
  }

  // Expose public API
  window.ManualPickModal = {
    open: openModal,
    close: closeModal,
  };
})();
```

**4. Add to weekly-lineup.html:**

```html
<script src="assets/js/features/manual-pick-modal.js?v=1.0.0" defer></script>
```

---

### **B: Alternative - Floating Action Button**

If you prefer a bottom-right floating button:

**HTML:**

```html
<button class="fab-manual-pick" id="fab-add-pick" title="Add manual pick">
  +
</button>
```

**CSS:**

```css
.fab-manual-pick {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #4caf50;
  color: white;
  border: none;
  font-size: 32px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  transition:
    background 0.2s,
    transform 0.2s;
}

.fab-manual-pick:hover {
  background: #45a049;
  transform: scale(1.1);
}
```

---

## Integration with Existing Systems

### **Data Flow:**

```
Manual Pick Entry
    ↓
localStorage via LocalPicksManager.addPicks()
    ↓
Displayed in dashboard picks table
    ↓
Can be graded/exported like any other pick
    ↓
Eventually migrated to Cosmos DB
```

### **Key Classes/Files to Reference:**

- [local-picks-manager.js](../client/dashboard/js/local-picks-manager.js) - Storage & retrieval
- [weekly-lineup.html](../client/weekly-lineup.html) - Main UI layout
- [unified-picks-fetcher.js](../client/assets/js/features/unified-picks-fetcher.js) - Fetch logic for API picks

---

## Recommendation

**Start with Option A (Row-Level Button)** because:

1. ✅ Minimal code changes
2. ✅ Context-aware (user sees matchup while entering)
3. ✅ Integrates with existing Weekly Lineup
4. ✅ Mobile-friendly
5. ✅ Reuses existing LocalPicksManager infrastructure

**Then add Option C (Floating Button)** for quick batch entry when you're reading external pick sources.

---

## Migration Path

1. **Phase 1:** Add manual pick button to Weekly Lineup (this week)
2. **Phase 2:** Ensure manual picks persist to Cosmos DB when ready
3. **Phase 3:** Add grading UI for manual picks (Win/Loss/Push)
4. **Phase 4:** Include manual picks in metrics calculations

Let me know which approach you prefer and I can implement it!
