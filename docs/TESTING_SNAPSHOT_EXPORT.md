# Testing Guide - Snapshot & Export Features

## Quick Test Steps

### Test 1: Snapshot Auto-Save on Load
1. Open `weekly-lineup.html` in browser
2. Wait for picks to load (or click "All" fetch button)
3. Open browser console - should see: `✅ Snapshot saved: [timestamp]_auto-load`
4. Click "History ▾" button in toolbar
5. **Expected:** See one snapshot listed with current timestamp

### Test 2: Manual Fetch Creates Snapshot
1. Click any individual fetch button (NBA, NCAAM, etc.)
2. Wait for picks to load
3. Open browser console - should see: `✅ Snapshot saved: [timestamp]_manual-fetch`
4. Click "History ▾" button
5. **Expected:** See multiple snapshots now (auto-load + manual-fetch)

### Test 3: View Historical Snapshot
1. Have at least 2 snapshots saved (repeat Test 1 & 2 if needed)
2. Click "History ▾" button
3. Click on an older snapshot
4. **Expected:** 
   - Table updates with that snapshot's picks
   - Console shows: `📂 Loading snapshot: [snapshotId]`
   - Notification appears: "Loaded snapshot from [time]"

### Test 4: Delete Individual Snapshot
1. Click "History ▾" button
2. Hover over a snapshot row
3. Click the trash icon (🗑️) on the right
4. Confirm deletion dialog
5. **Expected:** Snapshot removed from list

### Test 5: Clear All Snapshots
1. Click "History ▾" button
2. Click "Clear All" button (top right of dropdown)
3. Confirm dialog
4. **Expected:** 
   - All snapshots removed
   - Shows "No snapshots saved yet" message

### Test 6: Export to HTML
1. Ensure picks are loaded in table
2. Click "Export ▾" button in toolbar
3. Click "Export as HTML"
4. **Expected:**
   - File downloads: `weekly-lineup-YYYYMMDD-HHMM.html`
   - Open file in browser - beautiful styled page with all picks
   - Includes Bears & Bulls branding, stats banner, full table

### Test 7: Export to CSV/Excel
1. Ensure picks are loaded
2. Click "Export ▾" button
3. Click "Export as Excel (CSV)"
4. **Expected:**
   - File downloads: `weekly-lineup-YYYYMMDD-HHMM.csv`
   - Open in Excel/Sheets - properly formatted spreadsheet
   - All columns present with correct data

### Test 8: Export to PDF
1. Ensure picks are loaded
2. Click "Export ▾" button
3. Click "Export as PDF"
4. **Expected:**
   - New browser window opens
   - Print dialog appears
   - Preview shows professional layout
   - Can save as PDF or print

### Test 9: Snapshot Persistence
1. Create several snapshots (load/fetch picks multiple times)
2. Refresh the browser page
3. Click "History ▾" button
4. **Expected:** All saved snapshots still present

### Test 10: Empty State
1. Clear all snapshots (Test 5)
2. Click "History ▾" button
3. **Expected:** See "No snapshots saved yet" message
4. Try exporting with no picks
5. **Expected:** Alert: "No picks to export"

## Console Testing

Open browser console and try these commands:

```javascript
// Check if managers loaded
window.PicksSnapshotManager
window.PicksExportManager
window.SnapshotExportUI

// Get all snapshots
window.PicksSnapshotManager.getSnapshots()

// Get snapshots grouped by date
window.PicksSnapshotManager.getSnapshotsByDate()

// Manually save a snapshot
window.WeeklyLineup.savePicksSnapshot([{
    league: 'NBA',
    away_team: 'Test Away',
    home_team: 'Test Home',
    pick: 'Test Pick',
    edge: '5.2',
    fire: 5
}], 'test')

// Manually export current picks
window.SnapshotExportUI.exportCurrentPicks('html')
window.SnapshotExportUI.exportCurrentPicks('csv')
window.SnapshotExportUI.exportCurrentPicks('pdf')
```

## Visual Verification Checklist

### History Dropdown:
- [ ] Button visible in toolbar (has history icon + "History ▾")
- [ ] Dropdown opens on click
- [ ] "Clear All" button present
- [ ] Snapshots grouped by date (Today, Yesterday, etc.)
- [ ] Each snapshot shows time, pick count, leagues, avg edge
- [ ] Current snapshot highlighted in blue
- [ ] Trash icon visible on hover
- [ ] Smooth scrolling if many snapshots

### Export Dropdown:
- [ ] Button visible in toolbar (has download icon + "Export ▾")
- [ ] Dropdown opens on click
- [ ] Three options visible (HTML, Excel, PDF)
- [ ] Icons present for each format
- [ ] Hover effect on options

### Dropdowns General:
- [ ] Clicking outside closes dropdown
- [ ] Only one dropdown open at a time
- [ ] Dropdowns properly positioned (not cut off)
- [ ] Mobile: Both dropdowns hidden (screen < 768px)

## Edge Cases to Test

1. **Large Number of Picks:** Load 50+ picks, verify export handles it
2. **Special Characters:** Picks with commas, quotes, etc. in CSV export
3. **Empty Picks:** Try exporting when no picks loaded
4. **Max Snapshots:** Create 51+ snapshots, verify oldest deleted
5. **Rapid Fetching:** Click fetch buttons rapidly, verify snapshots save correctly
6. **Long Team Names:** NCAA teams with long names, verify layout
7. **Missing Data:** Picks with missing fields (no odds, no edge, etc.)
8. **Different Leagues:** Mix of NBA, NCAAM, NFL picks in one snapshot
9. **Browser Storage Full:** Fill localStorage, verify error handling
10. **Slow Network:** Test during slow API responses

## Common Issues & Solutions

### Issue: Snapshots not saving
**Solution:** 
- Check console for errors
- Verify `PicksSnapshotManager` loaded: `window.PicksSnapshotManager`
- Check localStorage quota: `navigator.storage.estimate()`

### Issue: Export downloads empty file
**Solution:**
- Ensure picks are loaded in table first
- Check console for "No picks to export" message
- Try scraping from table vs. using stored picks

### Issue: PDF doesn't open
**Solution:**
- Check popup blocker settings
- Try different browser
- Use HTML export as alternative

### Issue: Dropdown doesn't close
**Solution:**
- Click outside dropdown
- Refresh page
- Check for JavaScript errors in console

### Issue: History shows wrong data
**Solution:**
- Clear all snapshots and start fresh
- Check localStorage data: `localStorage.getItem('gbsv_picks_snapshots')`
- Clear browser cache

## Performance Testing

### Snapshot Operations:
- Save snapshot: Should be < 50ms
- Load snapshot: Should be < 100ms
- List snapshots: Should be instant
- Delete snapshot: Should be < 50ms

### Export Operations:
- HTML export: 100-300ms depending on pick count
- CSV export: 50-200ms
- PDF export: Opens within 500ms

### UI Responsiveness:
- Dropdown open/close: Instant
- Snapshot item click: Immediate table update
- Export button click: Immediate download prompt

## Browser Testing Matrix

| Browser | Version | Snapshot | Export HTML | Export CSV | Export PDF |
|---------|---------|----------|-------------|------------|------------|
| Chrome  | Latest  | ✓        | ✓           | ✓          | ✓          |
| Edge    | Latest  | ✓        | ✓           | ✓          | ✓          |
| Firefox | Latest  | ✓        | ✓           | ✓          | ✓          |
| Safari  | Latest  | ✓        | ✓           | ✓          | ✓          |

## Regression Testing

After implementing features, verify these existing features still work:

- [ ] Picks loading on page load
- [ ] Manual fetch buttons (All, NBA, NCAAM, etc.)
- [ ] Filter toolbar (league, edge, fire, etc.)
- [ ] Sort table by clicking headers
- [ ] Active/History view toggle
- [ ] Track button on picks
- [ ] Mobile responsive layout
- [ ] Archive functionality

## Sign-Off Checklist

- [ ] All 10 quick tests pass
- [ ] No console errors on page load
- [ ] Snapshots persist across refresh
- [ ] All three export formats work
- [ ] UI looks professional and clean
- [ ] Mobile view hides new controls
- [ ] Performance is acceptable
- [ ] Documentation is complete
- [ ] Code is commented and clean
- [ ] No breaking changes to existing features
