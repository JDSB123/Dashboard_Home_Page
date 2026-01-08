# Team Variants Dataset

## Overview

This directory contains comprehensive team name variants, abbreviations, nicknames, and historical information extracted from leading open-source sports data repositories.

## Data Sources

### NFL Data
- **Source**: [nflverse](https://github.com/nflverse)
- **Repository**: [nfldata](https://github.com/nflverse/nfldata)
- **Coverage**: 2002-2025 seasons
- **File**: `nfl_team_variants.json`
- **Features**:
  - Multiple abbreviation variants (ESPN, PFR, PFF, etc.)
  - Full team names, locations, and nicknames
  - Historical team changes (e.g., Oakland Raiders → Las Vegas Raiders)
  - Season-by-season tracking

### CFB (College Football) Data
- **Source**: [cfbfastR](https://github.com/sportsdataverse/cfbfastR) / [College Football Data API](https://api.collegefootballdata.com)
- **Coverage**: FBS teams (current)
- **File**: `cfb_team_variants.json`
- **Features**:
  - School names and mascots
  - Multiple alternate name variants
  - Conference and division information
  - Team colors and logos

### NBA Data
- **Source**: [hoopR](https://github.com/sportsdataverse/hoopR) / Manual compilation
- **Coverage**: Current + Historical franchises
- **File**: `nba_team_variants.json`
- **Features**:
  - Team names, locations, and nicknames
  - Multiple abbreviation variants
  - Historical franchise relocations (e.g., Seattle SuperSonics → Oklahoma City Thunder)
  - Name changes (e.g., Charlotte Bobcats → Charlotte Hornets)

### NCAAM (College Basketball) Data
- **Source**: [ESPN College Basketball API](https://site.api.espn.com)
- **Coverage**: All 362 NCAA Division I teams
- **File**: `ncaam_team_variants.json`
- **Features**:
  - School names and mascots
  - Multiple abbreviation variants
  - Conference affiliations
  - ESPN team IDs for API integration

## File Structure

### NFL Team Variants (`nfl_team_variants.json`)
```json
{
  "TEAM_ABBR": {
    "abbreviations": ["ARI", "CRD", ...],  // All known abbreviations
    "names": ["Arizona Cardinals"],         // Official team names
    "locations": ["Arizona"],               // City/region
    "nicknames": ["Cardinals"],             // Team nickname
    "historical": [                         // Recent season history
      {
        "season": "2024",
        "full_name": "Arizona Cardinals",
        "location": "Arizona",
        "nickname": "Cardinals"
      }
    ]
  }
}
```

### NBA Team Variants (`nba_team_variants.json`)
```json
{
  "TEAM_ABBR": {
    "name": "Atlanta Hawks",
    "location": "Atlanta",
    "nickname": "Hawks",
    "abbreviations": ["ATL"],
    "historical": [                         // Relocations/name changes
      {
        "name": "St. Louis Hawks",
        "years": "1955-1968"
      }
    ]
  }
}
```

### NCAAM Team Variants (`ncaam_team_variants.json`)
```json
{
  "TEAM_ABBR": {
    "name": "Duke Blue Devils",
    "location": "Duke",
    "nickname": "Blue Devils",
    "abbreviations": ["DUKE"],
    "espn_id": "150",
    "conference": "ACC"
  }
}
```

### CFB Team Variants (`cfb_team_variants.json`)
```json
{
  "SCHOOL_NAME": {
    "school": "Alabama",
    "mascot": "Crimson Tide",
    "abbreviation": "BAMA",
    "alt_name1": "Alabama Crimson Tide",
    "alt_name2": "Bama",
    "alt_name3": "Tide",
    "conference": "SEC",
    "division": "West",
    "color": "#9E1B32",
    "alt_color": "#FFFFFF",
    "logos": [...]
  }
}
```

## Usage Examples

### Python
```python
import json

# Load NFL team variants
with open('assets/data/team-variants/nfl_team_variants.json') as f:
    nfl_teams = json.load(f)

# Get all abbreviations for Arizona Cardinals
ari_abbrevs = nfl_teams['ARI']['abbreviations']
print(ari_abbrevs)  # ['ARI', 'CRD', ...]

# Load NCAAM team variants
with open('assets/data/team-variants/ncaam_team_variants.json') as f:
    ncaam_teams = json.load(f)

# Find Duke
duke = ncaam_teams['DUKE']
print(f"{duke['name']} - {duke['conference']}")  # "Duke Blue Devils - ACC"

# Check for historical changes in NFL
for team_abbr, team_data in nfl_teams.items():
    if len(team_data['names']) > 1:
        print(f"{team_abbr} has had name changes: {team_data['names']}")
```

### JavaScript
```javascript
// Load NBA team variants
fetch('assets/data/team-variants/nba_team_variants.json')
  .then(response => response.json())
  .then(nbaTeams => {
    // Find team by any abbreviation
    const findTeam = (abbr) => {
      return Object.entries(nbaTeams).find(([key, team]) => 
        team.abbreviations.includes(abbr)
      );
    };
    
    const [key, team] = findTeam('BRK');  // Brooklyn Nets
    console.log(team.name);  // "Brooklyn Nets"
    console.log(team.historical);  // Shows "New Jersey Nets"
  });

// Load NCAAM team variants
fetch('assets/data/team-variants/ncaam_team_variants.json')
  .then(response => response.json())
  .then(ncaamTeams => {
    // Get all ACC teams
    const accTeams = Object.values(ncaamTeams)
      .filter(team => team.conference === 'ACC')
      .map(team => team.name);
    console.log(accTeams);
  });
```

## Key Features

### 1. **Comprehensive Abbreviation Coverage**
- Multiple sources tracked (ESPN, Pro Football Reference, etc.)
- Common variants included (e.g., LAC vs LA for Chargers)
- Historical abbreviations preserved

### 2. **Historical Tracking**
- NFL: Season-by-season changes since 2002
- NBA: Franchise relocations and name changes
- Notable examples:
  - Oakland Raiders → Las Vegas Raiders (2020)
  - San Diego Chargers → Los Angeles Chargers (2017)
  - Seattle SuperSonics → Oklahoma City Thunder (2008)
  - Washington Redskins → Washington Football Team → Washington Commanders

### 3. **Name Variant Support**
- Full official names
- Common shortened forms
- Location variants (e.g., "Los Angeles Lakers" vs "LA Lakers")
- Nickname-only references (e.g., "Lakers")

## Data Freshness

- **NFL Data**: Updated through 2025 season
- **NBA Data**: Current roster of 30 teams with historical franchises
- **CFB Data**: FBS teams for 2024 season

## Update Process

To refresh the data:

```bash
cd C:\Users\JB\green-bier-ventures\DASHBOARD_main
python scripts/extract_team_variants.py
```

This will:
1. Fetch latest NFL data from nflverse
2. Query College Football Data API for FBS teams
3. Update NBA data with any changes
4. Generate new JSON files with timestamps

## Data Quality Notes

### NFL
- ✅ Highly reliable - sourced from nflverse project
- ✅ Comprehensive historical coverage
- ✅ Multiple data source cross-references

### CFB
- ✅ Official API data
- ⚠️ Focuses on FBS teams only
- ℹ️ FCS and lower divisions not included

### NBA
- ✅ Complete current roster
- ✅ Major historical franchises included
- ⚠️ Manual compilation - verify critical data

## License & Attribution

### Data Sources
- **nflverse**: MIT License
- **cfbfastR / College Football Data API**: Open source
- **hoopR**: MIT License

### Usage
This compiled dataset is provided under the same open-source spirit. Please attribute the original sources when using this data.

## Contributing

To improve this dataset:

1. **NFL**: Updates automatically pulled from nflverse
2. **CFB**: Sourced from collegefootballdata.com
3. **NBA**: Manual updates needed for:
   - New franchises
   - Historical corrections
   - Additional variant names

Submit corrections or additions via pull request to the main repository.

## Metadata

See [metadata.json](metadata.json) for:
- Generation timestamp
- Source repository URLs
- Data provenance information

## Related Files

- `nfl_teams_raw.csv` - Raw CSV data from nflverse
- `team-config.json` - Application-specific team configurations
- `nba_variants.json` - Legacy NBA variants file
- `ncaam_variants.json` - Legacy NCAAM variants file

## Support

For issues or questions:
- NFL data: [nflverse GitHub](https://github.com/nflverse)
- CFB data: [cfbfastR GitHub](https://github.com/sportsdataverse/cfbfastR)
- NBA data: [hoopR GitHub](https://github.com/sportsdataverse/hoopR)
- This dataset: Open an issue in the main repository

---

**Generated**: 2024-12-24  
**Version**: 1.0  
**Format**: JSON  
**Encoding**: UTF-8
