# Quick Reference: Team Variant Data

## 📁 Files Created

```
../client/assets/data/team-variants/
├── nfl_team_variants.json    (35 KB - 32 teams, 2002-2025)
├── nba_team_variants.json    (5 KB - 30 teams + historical)
├── metadata.json             (1 KB - data provenance)
└── README.md                 (7 KB - full documentation)

scripts/
├── extract_team_variants.py  (Python extraction script)
└── team_variant_lookup.py    (Lookup utility functions)

TEAM_VARIANTS_SUMMARY.md      (Comprehensive summary report)
```

## 🚀 Quick Start

### Load Data in JavaScript

```javascript
// Load NFL teams
const nflTeams = await fetch(
  "assets/data/team-variants/nfl_team_variants.json",
).then((r) => r.json());

// Get team info
const cardinals = nflTeams["ARI"];
console.log(cardinals.names[0]); // "Arizona Cardinals"
console.log(cardinals.abbreviations); // ["ARI", "CRD", ...]
```

### Load Data in Python

```python
import json

# Load NBA teams
with open('assets/data/team-variants/nba_team_variants.json') as f:
    nba_teams = json.load(f)

# Find team
nets = nba_teams['BKN']
print(nets['name'])  # "Brooklyn Nets"
print(nets['historical'])  # Shows "New Jersey Nets"
```

### Use Lookup Utility (Python)

```python
from scripts.team_variant_lookup import TeamVariantLookup

lookup = TeamVariantLookup()

# Find any team
team = lookup.find_nfl_team("Raiders")
print(team['historical'][-1]['location'])  # "Las Vegas"

# Normalize abbreviations
abbrev = lookup.normalize_nba_abbreviation("BRK")
print(abbrev)  # "BKN"
```

## 📊 Data Coverage

| League | Teams | File Size | Coverage    | Historical |
| ------ | ----- | --------- | ----------- | ---------- |
| NFL    | 32    | 35 KB     | ⭐⭐⭐⭐⭐  | 2002-2025  |
| NBA    | 30    | 5 KB      | ⭐⭐⭐⭐    | Complete   |
| CFB    | -     | -         | ⚠️ Need Key | Current    |
| NCAAM  | -     | -         | ℹ️ Pending  | Current    |

## 🔑 Key Features

### NFL Data

✅ Multiple abbreviation systems (ESPN, PFR, PFF)
✅ Season-by-season tracking (2002-2025)
✅ Historical changes (relocations, name changes)
✅ Nicknames, locations, full names

**Example - Las Vegas Raiders**:

```json
{
  "LV": {
    "abbreviations": ["LV", "RAI", "OAK", ...],
    "names": ["Las Vegas Raiders", "Oakland Raiders"],
    "locations": ["Las Vegas", "Oakland"],
    "nicknames": ["Raiders"],
    "historical": [
      {"season": "2019", "location": "Oakland"},
      {"season": "2020", "location": "Las Vegas"}
    ]
  }
}
```

### NBA Data

✅ Current 30 franchises
✅ Multiple abbreviation variants
✅ Historical relocations and name changes
✅ Team nicknames and locations

**Example - Brooklyn Nets**:

```json
{
  "BKN": {
    "name": "Brooklyn Nets",
    "abbreviations": ["BKN", "BRK"],
    "historical": [{ "name": "New Jersey Nets", "years": "1977-2012" }]
  }
}
```

## 🎯 Common Use Cases

### 1. Normalize Team Names

```python
# Problem: Multiple ways to refer to same team
inputs = ["ARI", "CRD", "Cardinals", "Arizona"]

# Solution: Look up canonical form
for inp in inputs:
    team = lookup.find_nfl_team(inp)
    print(f"{inp} → {team['names'][0]}")
# All return: "Arizona Cardinals"
```

### 2. Historical Tracking

```python
# Find team name changes
team = lookup.find_nba_team("BKN")
print(f"Current: {team['name']}")
for hist in team.get('historical', []):
    print(f"Previous: {hist['name']} ({hist['years']})")
```

### 3. Abbreviation Mapping

```javascript
// Map various abbreviations to standard form
const abbrevMap = {};
for (const [key, team] of Object.entries(nflTeams)) {
  team.abbreviations.forEach((abbrev) => {
    abbrevMap[abbrev] = key;
  });
}

console.log(abbrevMap["CRD"]); // "ARI"
console.log(abbrevMap["ARI"]); // "ARI"
```

## 🔄 Update Instructions

### Refresh All Data

```bash
cd C:\Users\JB\green-bier-ventures\DASHBOARD_main
python scripts/extract_team_variants.py
```

### Add CFB Data (requires API key)

1. Get free key: https://collegefootballdata.com/key
2. Set environment variable: `CFBD_API_KEY=your-key`
3. Re-run extraction script

## 📚 Documentation

- **Full Guide**: [README.md](../client/assets/data/team-variants/README.md)
- **Summary Report**: [TEAM_VARIANTS_SUMMARY.md](TEAM_VARIANTS_SUMMARY.md)
- **Metadata**: [metadata.json](../client/assets/data/team-variants/metadata.json)

## 🎁 Notable Historical Changes

### NFL

- 2020: Oakland Raiders → **Las Vegas Raiders**
- 2017: San Diego Chargers → **Los Angeles Chargers**
- 2016: St. Louis Rams → **Los Angeles Rams**
- 2022: Washington Football Team → **Washington Commanders**

### NBA

- 2012: New Jersey Nets → **Brooklyn Nets**
- 2014: Charlotte Bobcats → **Charlotte Hornets**
- 2013: New Orleans Hornets → **New Orleans Pelicans**
- 2008: Seattle SuperSonics → **Oklahoma City Thunder**

## 🔗 Data Sources

- **NFL**: [nflverse](https://github.com/nflverse) (MIT)
- **NBA**: [hoopR](https://github.com/sportsdataverse/hoopR) (MIT)
- **CFB**: [College Football Data API](https://api.collegefootballdata.com)
- **NCAAM**: [hoopR](https://github.com/sportsdataverse/hoopR) (MIT)

## ✅ Checklist

### What's Complete

- ✅ NFL team data extracted and cached
- ✅ NBA team data extracted and cached
- ✅ Documentation created
- ✅ Lookup utility created
- ✅ Summary report generated
- ✅ Metadata file created

### What's Pending

- ⚠️ CFB data (needs API key)
- ℹ️ NCAAM data (optional)
- 📋 Integration with existing team-config.json
- 🔗 Create unified lookup API

## 💡 Pro Tips

1. **Use the lookup utility** instead of manual searching
2. **Check historical data** before assuming current names
3. **Normalize all inputs** to canonical abbreviations
4. **Update quarterly** to catch any league changes
5. **Combine with existing** team-config.json for complete solution

---

**Generated**: December 24, 2024
**Status**: ✅ Production Ready
**Next Update**: March 2025 (before NFL Draft)
