# Telegram Pick Parser - Improvements Summary

## Performance Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Match Rate** | 10.2% | **95.9%** | +840% |
| **High Quality (≥0.7)** | 2 | **240** | +11,900% |
| **Picks Extracted** | 43 (wrong dates) | **288** | +570% |
| **Date Coverage** | 1 day | **14 days** | Full coverage |

### By League Match Rates
- **NFL**: 97.1% (33/34 rows matched)
- **NCAAM**: 97.4% (74/76 rows matched)
- **NCAAF**: 96.8% (61/63 rows matched)
- **NBA**: 94.7% (161/170 rows matched)

## Key Issues Fixed

### 1. Date Parsing with CST Conversion (Critical)
**Problem**: Parser expected `%d.%m.%Y %H:%M:%S` but actual format was `28.11.2025 18:38:40 UTC-06:00`

**Solution**: Updated timestamp parsing to handle timezone suffixes and convert to CST:
```python
# Parse timezone offset (UTC-06:00 = CST)
match = re.match(
    r'(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s*(?:UTC)?([-+]\d{2}:\d{2})?', 
    title
)
# Convert non-CST timezones to CST if needed
if tz_offset and tz_offset != "-06:00":
    dt = dt + timedelta(hours=cst_offset - offset_hours)
```

All timestamps are now stored in CST (Central Standard Time) in the `date_time_cst` field.

### 2. Multiple HTML Files
**Problem**: Data was split across `messages.html` (Nov 28 - Dec 14) and `messages2.html` (Dec 14 - Jan)

**Solution**: Parse both files and merge results:
```python
html_files = ["messages.html", "messages2.html"]
all_picks = parser.parse_files(html_files, date_range=(start, end))
```

### 3. Multi-Pick Messages
**Problem**: Messages contained multiple picks concatenated without separators:
```
"Boston -3.5 -115 1h $50Boston o120 -115 1h $50Chicago o240.5 -115 $50..."
```

**Solution**: Added concatenated bet parsing by splitting on `$amount` patterns:
```python
parts = re.split(r'\$\d+', text)
for part in parts:
    # Parse each segment
```

### 4. Structured Format Parsing
**Problem**: Some messages used slash-delimited format:
```
"MIA @ BOS / 1H / BOS -3.5 (-110)MIA @ BOS / 1H / OVER 120.0 (-110)"
```

**Solution**: Added dedicated parser for this format with regex pattern matching.

### 5. Noise Filtering
**Problem**: Conversational messages being parsed as picks:
```
"you capped me at 50"
"extra games still no go"
```

**Solution**: Aggressive noise filtering with pattern matching for common chat phrases.

### 6. Alignment Scoring
**Problem**: Original scoring didn't weight components properly

**Solution**: Multi-factor scoring:
- Date match: 25%
- Pick type (O/U vs Spread): 20%
- Spread/Total value: 25%
- Team matching: 20%
- Segment matching: 10%

## Files Created/Modified

### New Files
1. `src/team_registry.py` - 700+ team aliases for NFL/NBA/NCAAF/NCAAM
2. `src/robust_telegram_parser.py` - Production-ready parser
3. `src/improved_alignment.py` - Enhanced alignment engine
4. `run_full_analysis.py` - Full analysis pipeline

### Key Classes
- `TeamRegistry` - Canonical team name normalization
- `RobustTelegramParser` - HTML parsing with context
- `align_picks()` - Multi-factor alignment scoring

## Usage

```python
from src.robust_telegram_parser import parse_telegram_directory
from src.improved_alignment import align_picks

# Parse all Telegram HTML files
picks = parse_telegram_directory(
    directory="telegram_text_history_data",
    date_range=("2025-12-12", "2025-12-27")
)

# Align with tracker
alignment_df = align_picks(tracker_df, telegram_df, score_threshold=0.5)

# Access CST timestamps
for pick in picks:
    print(f"{pick.date_time_cst} CST: {pick.pick_description}")
```

## Timezone Handling

All timestamps are converted to and stored in **CST (Central Standard Time)**:

- Telegram exports include timezone info (e.g., `UTC-06:00`)
- UTC-06:00 is CST, so these are already in CST
- Other timezones are converted to CST automatically
- The `date_time_cst` field in Pick objects contains the full timestamp
- The `date` field contains just the date string (YYYY-MM-DD) in CST

Example output:
```
2025-12-12 18:45:00 CST | Under 118 | NBA
2025-12-13 11:38:34 CST | Iowa +11.5 | NCAAF
```

## Remaining Unmatched (14 of 343)

Most unmatched rows are due to:
1. Limited Telegram data for Dec 12 (4 picks vs 28 tracker rows)
2. ML (Moneyline) picks with no spread component
3. Edge cases like "PK" (Pick 'em) formatting

These represent edge cases that would require:
- Additional source data
- More sophisticated ML pick matching
- Custom handling for betting jargon

## Score Interpretation

| Score | Quality | Meaning |
|-------|---------|---------|
| ≥ 0.9 | Excellent | Near-perfect match |
| ≥ 0.8 | Very Good | High confidence match |
| ≥ 0.7 | Good | Likely correct match |
| ≥ 0.6 | Fair | Probable match |
| ≥ 0.5 | Threshold | Minimum for "matched" |
| < 0.5 | Unmatched | No confident match |
