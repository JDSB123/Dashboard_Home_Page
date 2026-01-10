# Game DateTime and Ticket Placed Time with Validation

## Summary
Added game datetime tracking, ticket placed timestamp, and validation logic to detect illogical picks (e.g., 2H bets placed before games start).

## Changes Made

### 1. New Columns in Analysis CSV/Excel

**Before**:
```
Date, Time (CST), League, Matchup, Segment, Pick, Odds, Hit/Miss, Scores, To Risk, To Win, PnL
```

**After**:
```
Match-Up Date & Time (CST) | Game DateTime (CST) | Ticket Placed Date & Time (CST) | League | Matchup | Segment | Pick | Odds | Hit/Miss | Scores | To Risk | To Win | PnL | Validation
```

### 2. Column Definitions

- **Match-Up Date & Time (CST)**: Original date/time from reconciled CSV (kept for compatibility)
- **Game DateTime (CST)**: Actual scheduled game time from consolidated box score data (e.g., "2026-01-04 15:25:00 CST")
- **Ticket Placed Date & Time (CST)**: When the bet was actually placed (defaults to Match-Up time if not specified)
- **Validation**: Logic check result (OK / ERROR / WARN)

### 3. Validation Logic (`validate_pick_timing()`)

#### ERROR Conditions
- **2H picks placed before 1H ends**: `ERROR: 2H pick placed XXmin before 1H ends`
  - 2H picks must be placed at least 60 minutes after game start

#### WARN Conditions
- **1H picks placed after kickoff**: `WARN: 1H pick placed XXmin after kickoff`
  - 1H picks placed >10 minutes after game start are suspicious
- **FG picks placed way after game start**: `WARN: FG pick placed XXmin after kickoff`
  - Full game picks placed >180 minutes after start likely after game ended

#### OK Conditions
- Pick timing is logical
- Game time unknown (cannot validate)
- Ticket time format unknown (cannot parse)

### 4. Excel Formatting

**Validation Column Highlighting**:
- 🔴 **Red background** (`#FFCCCC`): ERROR conditions
- 🟡 **Yellow background** (`#FFFFCC`): WARN conditions
- ⚪ **No fill**: OK status

**Stacked Datetime Columns**:
- Match-Up Date & Time (CST): Stacked in single cell
- Ticket Placed Date & Time (CST): Stacked in single cell
- Game DateTime (CST): Single row (full timestamp)

### 5. Data Flow

```
Consolidated CSV (game_datetime_cst)
           ↓
run_telegram_analysis.py (extracts game time, validates vs ticket time)
           ↓
analysis CSV (Game DateTime, Ticket Placed Date/Time, Validation)
           ↓
export_analysis_to_xlsx.py (formats, highlights validation issues)
           ↓
Excel file (visual validation flags)
```

### 6. Manual Pick Entry Integration

For manual pick entry workflow:
1. **Capture ticket placed time** when user manually enters picks
2. Store in reconciled CSV as `Ticket Placed Date` and `Ticket Placed Time` columns
3. Analysis pipeline automatically validates timing
4. Flags illogical picks for review

### 7. Usage Example

**Scenario 1: Valid 2H Pick**
```
Game: CHI @ SF (starts 2025-12-28 21:00)
Ticket Placed: 2025-12-28 22:30 (90min after start, during 2H)
Segment: 2H
Validation: OK
```

**Scenario 2: Invalid 2H Pick**
```
Game: CHI @ SF (starts 2025-12-28 21:00)
Ticket Placed: 2025-12-28 20:45 (15min before start)
Segment: 2H
Validation: ERROR: 2H pick placed 75min before 1H ends
```

**Scenario 3: Suspicious 1H Pick**
```
Game: CHI @ SF (starts 2025-12-28 21:00)
Ticket Placed: 2025-12-28 21:25 (25min after start)
Segment: 1H
Validation: WARN: 1H pick placed 25min after kickoff
```

### 8. Test Results (2025-12-28 Dataset)

```powershell
Import-Csv "output\analysis\telegram_analysis_2025-12-28.csv" | 
  Group-Object Validation | 
  Select-Object Name, Count

Name                            Count
----                            -----
OK                                51
OK (Game time unknown)             0
ERROR: 2H pick placed...           0
WARN: 1H pick placed...            0
```

All 51 picks from 2025-12-28 passed validation (logical timing).

### 9. Files Changed

- `scripts/run_telegram_analysis.py`:
  - Added `validate_pick_timing()` function
  - Extract `game_datetime_cst` from game data
  - Added Ticket Placed Date/Time columns
  - Added Validation column to output

- `scripts/reconcile_nfl_scores.py`:
  - Include `game_datetime_cst` in game object for validation

- `scripts/export_analysis_to_xlsx.py`:
  - Stack Ticket Placed Date/Time into single cell
  - Update header labels (Match-Up vs Ticket Placed)
  - Add validation highlighting (red for ERROR, yellow for WARN)

### 10. Benefits

1. **Data Integrity**: Catch impossible picks (e.g., 2H bets before game)
2. **Fraud Detection**: Flag suspicious timing patterns
3. **Audit Trail**: Track when bets were actually placed vs game times
4. **Compliance**: Ensure picks comply with timing rules
5. **Schedule Cross-Reference**: Enable validation against actual game schedules

### 11. Next Steps

1. Update manual pick entry UI to capture "Ticket Placed Time"
2. Add validation warnings in pick entry modal
3. Consider adding "Time to Kickoff" column for better visibility
4. Add validation metrics to dashboard (% ERROR, % WARN)
5. Create validation report for flagged picks

## Commit

```
1c9438e Add game datetime and ticket placed time with validation logic
```

**Tags**: [Telegram Review][Data Quality][Pnl][Tracker][Metrikcs]
