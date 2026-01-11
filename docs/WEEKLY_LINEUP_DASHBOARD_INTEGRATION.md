# Weekly Lineup ↔ Dashboard Integration Architecture

## Overview

The **Weekly Lineup** and **Dashboard** are now properly integrated with a bi-directional sync bridge. Each serves a distinct purpose:

### Weekly Lineup (weekly-lineup.html)
- **Source**: Fetches real picks from model APIs (NBA, NCAAM, NFL, NCAAF)
- **Purpose**: View and manage model predictions with outcomes tracking
- **Storage**: localStorage with daily cache expiry
- **Key features**:
  - Auto-fetch from model endpoints
  - Fire rating & edge calculation
  - "Track" button to send picks to Dashboard
  - Archive completed games with win/loss/push tracking
  - Manual rationale entry

### Dashboard (index.html)
- **Source**: Loads picks from multiple sources (API, localStorage, Weekly Lineup)
- **Purpose**: Unified portfolio view with live P&L, team records, boxscores
- **Storage**: localStorage (LocalPicksManager) + API
- **Key features**:
  - KPI tiles (ROI, hit rate, active picks)
  - Live game status and boxscores
  - Manual pick entry and sportsbook imports
  - Risk/win calculations

## Data Flow

### Scenario 1: Using Model Predictions
```
User opens Weekly Lineup
  ↓
Clicks "Fetch NBA" (or All)
  ↓
Fetches from model APIs → Displays in table
  ↓
User clicks "Track" on picks
  ↓
Picks stored to Dashboard's localStorage (gbsv_picks)
  ↓
User navigates to Dashboard
  ↓
Dashboard loads picks from localStorage on page load
  ↓
Shows active picks with P&L, team records, status
```

### Scenario 2: Manual Entries
```
User enters picks manually on Dashboard
  ↓
Stored in localStorage (gbsv_picks)
  ↓
Weekly Lineup can optionally sync outcomes back
  ↓
Weekly Lineup Archive tracks results
```

### Scenario 3: Refresh/Reload
```
Dashboard page reload
  ↓
smart-load-picks.js calls initializePicksAndRecords()
  ↓
Try API → Try localStorage → Display
  ↓
loadAndAppendPicks() populates table with persisted picks
  
Weekly Lineup page reload
  ↓
Checks localStorage cache timestamp
  ↓
If same day: restore cached picks
  ↓
If different day: clear (stale) and show empty
```

## Key Components

### 1. **Cache Expiry** (Weekly Lineup)
```javascript
// Clears picks cached from previous day
const cachedDate = new Date(parsed.timestamp).toDateString();
const today = new Date().toDateString();
if (cachedDate !== today) {
    // Clear stale picks
    localStorage.removeItem(WEEKLY_LINEUP_STORAGE_KEY);
}
```
✅ Prevents stale model picks from showing up after midnight

### 2. **Dashboard Auto-Load** (Dashboard)
```javascript
// Now enabled: calls initializePicksAndRecords() on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePicksAndRecords);
}
```
✅ Dashboard loads picks from API/localStorage automatically

### 3. **Sync Bridge** (weekly-lineup-sync.js)
```javascript
// Dashboard can call:
window.WeeklyLineupSync.getLatestPicks()
  → returns active picks from Weekly Lineup cache

// Weekly Lineup can call:
window.WeeklyLineupSync.pushOutcomes(picks)
  → updates outcomes in Weekly Lineup archive
```
✅ Cross-page communication without page reload

### 4. **Export Functions** (Weekly Lineup)
```javascript
window.WeeklyLineup.getActivePicks()
  → returns array of currently displayed picks

window.WeeklyLineup.exportToDashboard()
  → formats picks for Dashboard consumption

window.WeeklyLineup.syncDashboardOutcomes(picks)
  → receives outcome updates from Dashboard
```
✅ Programmatic access for sync bridge

## Usage Flow for End Users

### Adding Model Picks to Dashboard
1. Go to **Weekly Lineup**
2. Click **Fetch NBA** (or any league)
3. Model picks appear in table
4. Click **Track** on picks you want to monitor
5. Go to **Dashboard** (picks auto-load)
6. See picks in your portfolio with live P&L

### Tracking Outcomes
1. Play continues on game day
2. Dashboard updates live status and boxscores
3. Game ends → Dashboard marks as **Win/Loss/Push**
4. Return to **Weekly Lineup**
5. Archive shows results with win rate

### Manual Entries
1. Go to **Dashboard**
2. Upload slips or paste picks manually
3. Picks stored in portfolio
4. Weekly Lineup can optionally track outcomes

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Stale picks on Weekly Lineup | Cached from previous day | Clear browser cache or wait until tomorrow (cache auto-expires) |
| Dashboard shows no picks | No auto-load OR picks not in localStorage | Check browser DevTools → Application → localStorage for `gbsv_picks` |
| Weekly Lineup doesn't see Dashboard picks | Tracked picks saved to different localStorage key | Verify both pages use same storage keys |
| Sync not working | Weekly Lineup page not loaded | Sync Bridge stores pending outcomes; picked up on next WL load |

## localStorage Keys Reference

| Key | Page | Purpose | Expires |
|-----|------|---------|---------|
| `gbsv_weekly_lineup_picks` | Weekly Lineup | Cached model predictions | Daily (at midnight) |
| `gbsv_tracked_weekly_picks` | Weekly Lineup | Picks tracking metadata | Never |
| `gbsv_archived_weekly_picks` | Weekly Lineup | Completed game results | Never |
| `gbsv_picks` | Dashboard | User's portfolio picks | Manual clear or delete |
| `gbsv_pending_outcomes` | Both | Awaiting sync from Dashboard | Cleared after sync |

## Next Steps to Complete Integration

### Phase 1: Current (Done)
- ✅ Enable Dashboard auto-load
- ✅ Add cache expiry to Weekly Lineup
- ✅ Create Sync Bridge

### Phase 2: Recommended
- [ ] Add "Import from Weekly Lineup" button to Dashboard (power user feature)
- [ ] Sync outcomes from Dashboard back to Weekly Lineup archive (one-way sync working)
- [ ] Add comparison view (Weekly Lineup predicted vs. Dashboard actual)

### Phase 3: Backend Integration
- [ ] Replace localStorage with Cosmos DB for persistence
- [ ] API endpoint: `GET /api/picks?source=weekly-lineup` (read model picks)
- [ ] API endpoint: `POST /api/picks/sync` (sync outcomes)
- [ ] Add backend reconciliation of Weekly Lineup vs. Dashboard picks
