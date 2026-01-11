# Telegram Message Parser - Summary

## Overview

**YES**, you have an existing script/analyzer to convert Telegram message history into picks! 

## Existing Implementation

### 1. **PickParser Class** (`src/pick_parser.py`)
   - **`parse_html_conversation()`** - Parses HTML from Telegram exports
   - Uses BeautifulSoup to parse Telegram HTML message format
   - Extracts dates from message timestamps
   - Parses betting picks using regex patterns
   - Handles multiple formats including conversational and formatted summary

### 2. **Main Entry Point** (`src/main.py` / `ingest_picks.py`)
   - Command-line interface with `--input-type html` flag
   - Can process Telegram HTML files directly

### 3. **New Analysis Script** (`analyze_telegram_picks.py`)
   - Comprehensive analyzer for Telegram HTML files
   - Shows statistics and examples
   - Identifies parsing issues
   - Provides recommendations

## Usage

### Command-Line (Existing)

```bash
# Parse Telegram HTML file
python ingest_picks.py --input telegram_text_history_data/messages.html --input-type html --output tracker.xlsx
```

### Analysis Script (New)

```bash
# Analyze Telegram HTML file
python analyze_telegram_picks.py --input telegram_text_history_data/messages.html

# Save parsed picks to JSON
python analyze_telegram_picks.py --input messages.html --output picks.json
```

### Programmatic

```python
from src.pick_parser import PickParser

parser = PickParser()
with open('telegram_text_history_data/messages.html', 'r') as f:
    picks = parser.parse_html_conversation(f.read())
```

## Current Status

Based on testing with your actual Telegram HTML file (`messages.html`):

### Working Well ✅
- **HTML parsing**: Successfully extracts messages from Telegram HTML format
- **Date extraction**: Correctly extracts dates from message timestamps
- **League extraction**: 73.7% of picks have league information
- **Formatted summary parsing**: Parses formatted summary format (e.g., "Bears +7.5 NFL HIT +$33,000")

### Needs Improvement ⚠️
- **Odds extraction**: Only 26.3% of picks have odds (many are from formatted summary which doesn't include odds)
- **Matchup extraction**: 0% of picks have matchup information (needs improvement)
- **Conversational format**: Many conversational/abbreviated formats aren't being parsed well

## Parser Capabilities

The parser handles:

1. **Formatted Summary Format** (from tracking summaries)
   - Example: "Bears +7.5 NFL HIT +$33,000"
   - "Texas A&M -2 CFB MISS -$60,000"
   - Parses league, segment, pick description
   - Note: These don't include odds (only P&L)

2. **Well-Formatted Picks**
   - Example: "Suns +9 1h -108 $50"
   - "Raiders 7.5 1h -107 $50"
   - "Total Under 46.5 -107"
   - Parses team, spread/total, segment, odds

3. **Conversational/Abbreviated Format** (partially working)
   - Example: "a and m: -.5 2h , -135, o24 total 2h"
   - "indiana -13.5 -125; o23.5 -125"
   - Needs more work for better parsing

## Test Results

From your `messages.html` file:
- **Total messages**: 543
- **Total picks found**: 19
- **Picks with league**: 14 (73.7%)
- **Picks with odds**: 5 (26.3%)
- **Picks with matchup**: 0 (0.0%)

**Distribution:**
- NCAAF: 10 picks
- NFL: 2 picks
- NCAAM: 1 pick
- NBA: 1 pick
- Unknown: 5 picks

## Recommendations

1. **For formatted summary format**: The parser extracts picks but they don't include odds (only P&L). This is expected as the summary format doesn't include odds.

2. **For conversational messages**: Consider:
   - Adding team name mappings (e.g., "a and m" → "Texas A&M")
   - Improving abbreviated format parsing ("o" = Over, "u" = Under)
   - Better handling of multi-pick messages (semicolon-separated)

3. **Matchup extraction**: Consider:
   - Extracting matchups from team pairs in messages
   - Using team names to infer matchups from context
   - Pairing picks with matchup headers in formatted messages

## Files

- **`src/pick_parser.py`** - Main parser implementation (recently improved)
- **`src/main.py`** - Main entry point for CLI
- **`ingest_picks.py`** - CLI wrapper
- **`analyze_telegram_picks.py`** - New analysis script
- **`test_telegram_parser.py`** - Test script

## Next Steps

1. ✅ **DONE**: Test parser with actual Telegram HTML files
2. ✅ **DONE**: Improve parser based on actual data format
3. ✅ **DONE**: Create analysis script
4. 🔄 **TODO**: Further improve conversational format parsing (if needed)
5. 🔄 **TODO**: Improve matchup extraction
6. 🔄 **TODO**: Add team name mappings for abbreviated names

## Conclusion

You have a **working parser** that successfully extracts picks from Telegram HTML exports. It works well for formatted summary messages and some conversational formats. The parser can be improved further, but it's functional and ready to use for basic pick extraction.
