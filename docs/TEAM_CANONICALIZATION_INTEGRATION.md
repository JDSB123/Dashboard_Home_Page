# Team Canonicalization Integration Summary

## Overview
Integrated robust team name canonicalization system into telegram analysis workflow to handle shorthand team names from telegram messages. System uses comprehensive team variant mappings across NFL, NBA, NCAAM, and NCAAF.

## Changes Made

### 1. Team Variant Lookup Module
- **File**: `scripts/team_variant_lookup.py`
- **Source**: Copied from `data-pipeline/scripts/team_variant_lookup.py`
- **Updated**: Auto-detects path to `client/assets/data/team-variants/` JSON files
- **Features**:
  - `find_nfl_team(query)` - Resolves NFL team names/abbreviations
  - `find_nba_team(query)` - Resolves NBA team names/abbreviations
  - `find_ncaam_team(query)` - Resolves NCAAM team names/abbreviations
  - `normalize_*_abbreviation()` - Canonicalizes abbreviations (e.g., BRK → BKN)
  - Supports historical team names and relocations

### 2. Telegram Analysis Integration
- **File**: `scripts/run_telegram_analysis.py`
- **Added**: `normalize_team_name(team_str, league)` function
- **Usage**: Automatically resolves shorthand team names when parsing matchups
- **Example**: "Raiders @ Chiefs" → "LV @ KC"

### 3. Test Coverage
- **File**: `scripts/test_team_canonicalization.py`
- **Results**:
  - NFL: 9/10 tests pass (90%)
  - NBA: 10/10 tests pass (100%)
  - NCAAM: Abbreviations work perfectly; partial names match multiple teams
- **Recommendation**: Use team abbreviations in telegram messages for NCAAM

### 4. Missing Scores Audit
- **File**: `scripts/audit_missing_scores.py`
- **Findings**:
  - Total games: 4,072
  - Missing 1H scores: 139 (3.4%)
  - Breakdown:
    - NFL: 0/272 missing (0.0%) ✓
    - NBA: 7/494 missing (1.4%)
    - NCAAM: 132/3306 missing (4.0%)
  - **Root cause**: 134/139 are unfinished games from 2026-01-10 (today)
  - **Historical missing**: Only 5 games from Nov-Dec 2025

## Usage Examples

### In Telegram Messages
```
# Before (may fail to match):
"pick: lakers over warriors, -120"

# After (auto-resolved):
"pick: LAL over GSW, -120"
```

### Supported Shorthand
- **NFL**: "Raiders", "Chiefs", "Packers", etc. → Auto-resolved to LV, KC, GB
- **NBA**: "Lakers", "Warriors", "Celtics", etc. → Auto-resolved to LAL, GSW, BOS
- **NCAAM**: Best to use abbreviations (DUKE, UNC, UK) due to duplicate nicknames

### API Usage
```python
from team_variant_lookup import TeamVariantLookup

lookup = TeamVariantLookup()

# Find team
team = lookup.find_nfl_team("Raiders")
print(team['key'])  # "LV"

# Normalize abbreviation
abbrev = lookup.normalize_nba_abbreviation("BRK")
print(abbrev)  # "BKN"
```

## Team Variant Data Sources
- **Location**: `client/assets/data/team-variants/`
- **Files**:
  - `nfl_team_variants.json` (32 teams)
  - `nba_team_variants.json` (30 teams)
  - `ncaam_team_variants.json` (350+ teams)
  - `cfb_team_variants.json` (if needed)

## Benefits
1. **Resilient parsing**: Handles various team name formats from telegram
2. **Consistent matching**: Maps variants to canonical abbreviations used in box score cache
3. **Historical support**: Handles team relocations (e.g., Raiders: OAK → LV)
4. **Extensible**: Easy to add new leagues or update variants

## Next Steps
1. Deploy to production telegram webhook
2. Test with real telegram messages containing shorthand
3. Add NCAAF variant support if needed
4. Consider fuzzy matching for typos (optional)

## Tags
[Telegram Review][Team Variants][Canonicalization][Data Quality][Metrikcs]
