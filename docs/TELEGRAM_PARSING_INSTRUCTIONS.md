# Telegram Picks Parsing Instructions

## Overview
When provided with raw telegram chat logs, parse picks using these inference rules to create the PnL tracker.

## Format Rules

### Pick Detection
1. **From Josh Biering:** Initial pick requests (game, spread/total, sometimes with segment)
2. **From Zach Campbell:** Confirmed bets with exact odds and stakes
   - Format: `{team/total} {line} {odds} ${stake}`
   - Segment indicators: `1h`, `2h`, `1q`, `fg` (or implied)

### Inference Rules

#### **Stakes**
- Default: `$50,000` unless Zach specifies otherwise
- Special cases:
  - NCAAM picks: `$25,000` (Josh explicitly mentions "$25k each")
  - Corrections: Zach may type correction (e.g., "25^" means $25k not $35k)
  - Small positions: Zach explicitly states (e.g., `$20`, `$10`)

#### **Lines & Odds**
- **Use Zach's numbers** when there's a discrepancy (Zach has the actual book line)
- Examples:
  - Josh: "over 47.5" → Zach: "o48" → **Use 48**
  - Josh: "under 35.5" → Zach: "u34.5" → **Use 34.5**
  - Josh: "+8.75" → Zach: "+8.5" → **Use 8.5**

#### **Segments**
- **FG** (Full Game): Default if no segment specified
- **1H** (First Half): Explicitly mentioned or "1h"
- **2H** (Second Half): Explicitly mentioned or "2h"
- **1Q** (First Quarter): Explicitly mentioned or "1q"
- **TT** (Team Total): When pick includes "TTO" or "TTU" or specific team scoring

#### **Teams**
- Normalize abbreviations to canonical names
- Handle variations:
  - "niners" → "49ers" or "SF"
  - "bills/eagle" → separate picks
  - "seattle" → "SEA"

### Special Cases

#### **Off Board**
- If Zach says "off the board" or "Off board sorry"
- **DO NOT** include in tracker (bet was not placed)

#### **ML (Moneyline) Bets**
- No spread, just team to win
- Odds format: `-155` (favorite) or `+220` (underdog)

#### **Corrections**
- Zach may correct himself (e.g., "25^" after saying "$35")
- **Always use the corrected value**

#### **Buy Down**
- Josh may ask "buy down?" meaning adjust the line
- Zach's response shows the actual line booked

## PnL Tracker Format

### Required Columns
```
Date,Time (CST),League,Match-Up (Away vs Home),Segment,Pick,Odds,To Risk $,To Win $,Result,PnL,Score
```

### Column Specifications

1. **Date**: YYYY-MM-DD format
2. **Time (CST)**: HH:MM AM/PM from telegram timestamp
3. **League**: NFL, NBA, NCAAM, NCAAF
4. **Match-Up**: `Away @ Home` format
5. **Segment**: FG, 1H, 2H, 1Q, etc.
6. **Pick**: 
   - Spread: `Team +7.5` or `Team -3`
   - Total: `Over 45` or `Under 52`
   - Team Total: `Team Over 14 (TT)`
   - ML: `Team ML`
7. **Odds**: American format (e.g., `-110`, `+220`)
8. **To Risk $**: Amount wagered
9. **To Win $**: Calculated: `Risk / (Odds/100)` for negative odds, `Risk * (Odds/100)` for positive
10. **Result**: Win, Loss, Push
11. **PnL**: 
    - Win: +To Win amount
    - Loss: -Risk amount
    - Push: 0
12. **Score**: Final score or segment score with totals noted

## Grading Process

1. **Load master schedule**: `data-pipeline/output/master_schedule_all_leagues.csv`
2. **Match games** by date, league, teams
3. **Calculate results**:
   - Spreads: Did pick cover?
   - Totals: Over/Under vs actual total
   - ML: Did team win?
4. **Handle segments**:
   - Need period-specific scores (1H, 2H, 1Q)
   - May require box score APIs if not in master schedule

## Output Files

- **CSV**: `output/reconciled/pnl_tracker_YYYY-MM-DD.csv`
- **Summary**: Generate summary stats (W-L-P, Total PnL, ROI by league/segment)

## Example Parsing

### Input
```
Josh Biering, [12/28/2025 3:25 PM]
bills fg -3; bills/eagoe fg over 44.5

Zach Campbell, [12/28/2025 3:25 PM]
bills -3 -115 $50

Zach Campbell, [12/28/2025 3:25 PM]
bills o45 -111 $50
```

### Output
```csv
2025-12-28,3:25 PM,NFL,PHI @ BUF,FG,Bills -3,-115,50000,43478.26,Win,43478.26,13-12
2025-12-28,3:25 PM,NFL,PHI @ BUF,FG,Bills Over 45,-111,50000,45045.05,Loss,-50000,13-12 (Total: 25)
```

## Notes

- **Trust Zach's confirmations** - he has the actual bets placed
- **"cbk extra" = not booked** - exclude from tracker
- **Watch for typos** - Zach types quickly, use context
- **Timestamps matter** - helps distinguish FG vs live bets
- **Keep raw text** - useful for auditing/debugging
