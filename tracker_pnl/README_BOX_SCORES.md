# Box Score Caching Infrastructure

This document describes the box score caching infrastructure for the Sports Betting Tracker.

## Overview

The system fetches and caches box scores from various APIs, ensuring proper segment/period data structure for all leagues:
- **NFL**: SportsDataIO API
- **NCAAF**: SportsDataIO API  
- **NBA**: API-Basketball (RapidAPI)
- **NCAAM**: API-Basketball (RapidAPI)

## Structure

### Cache Directory

Box scores are stored in JSON format in the `box_scores/` directory, organized by league:
```
box_scores/
├── NFL/
│   ├── 2025-12-14.json
│   ├── 2025-12-15.json
│   └── ...
├── NCAAF/
│   ├── 2025-11-01.json
│   └── ...
├── NBA/
│   ├── 2025-12-16.json
│   └── ...
└── NCAAM/
    └── ...
```

### Data Structure

Each JSON file contains an array of box score objects with the following structure:

```json
{
  "game_id": "401810326",
  "date": "2026-01-01",
  "league": "NBA",
  "home_team": "BKN",
  "away_team": "HOU",
  "home_team_full": "Brooklyn Nets",
  "away_team_full": "Houston Rockets",
  "home_score": 96,
  "away_score": 120,
  "status": "final",
  "half_scores": {
    "H1": {
      "home": 20,
      "away": 26
    },
    "H2": {
      "home": 22,
      "away": 27
    }
  },
  "quarter_scores": {
    "Q1": {
      "home": 10,
      "away": 13
    },
    "Q2": {
      "home": 10,
      "away": 13
    },
    "Q3": {
      "home": 11,
      "away": 14
    },
    "Q4": {
      "home": 11,
      "away": 13
    }
  },
  "source": "API-Basketball",
  "fetched_at": "2026-01-09T16:05:55.870801"
}
```

### Segment Data

The cache ensures proper segment data structure:

- **Quarters (Q1-Q4)**: Individual quarter scores (NFL, NCAAF, NBA, NCAAM)
- **Halves (H1, H2)**: First and second half scores
  - For NFL/NCAAF/NCAAM: H1 = Q1 + Q2, H2 = Q3 + Q4
  - For NBA: H1 = Q1 + Q2, H2 = Q3 + Q4 (plus overtime periods if applicable)

## Usage

### Fetch Box Scores

Fetch box scores for a single date:
```bash
python fetch_box_scores.py --date 2025-12-14
```

Fetch box scores for all leagues:
```bash
python fetch_box_scores.py --date 2025-12-14 --league ALL
```

Fetch for a specific league:
```bash
python fetch_box_scores.py --date 2025-12-14 --league NBA
```

Fetch for a date range:
```bash
python fetch_box_scores.py --start-date 2025-12-01 --end-date 2025-12-31
```

Force re-fetch (ignore cache):
```bash
python fetch_box_scores.py --date 2025-12-14 --no-cache
```

### Programmatic Usage

```python
from src.box_score_fetcher import BoxScoreFetcher
from src.box_score_cache import BoxScoreCache

# Initialize fetcher
fetcher = BoxScoreFetcher()

# Fetch box scores for a date
nfl_scores = fetcher.fetch_nfl_box_scores("2025-12-14")
nba_scores = fetcher.fetch_nba_box_scores("2025-12-14")

# Or fetch all leagues at once
all_scores = fetcher.fetch_all_leagues("2025-12-14")

# Access cache directly
cache = BoxScoreCache()
scores = cache.load_box_scores("NBA", "2025-12-14")
has_scores = cache.has_box_scores("NFL", "2025-12-14")
cached_dates = cache.get_cached_dates("NBA")
```

## API Configuration

Configure API keys in `.env`:

```env
# SportsDataIO (for NFL and NCAAF)
SPORTSDATAIO_API_KEY=your_key_here

# API-Basketball (for NBA and NCAAM)
API_BASKETBALL_KEY=your_key_here
```

### API Sources

1. **SportsDataIO**
   - Used for: NFL, NCAAF
   - Base URL: `https://api.sportsdata.io/v3`
   - Authentication: Header `Ocp-Apim-Subscription-Key`

2. **API-Basketball (RapidAPI)**
   - Used for: NBA, NCAAM
   - Base URL: `https://api-basketball.p.rapidapi.com`
   - Authentication: Header `X-RapidAPI-Key`

## Normalization

The `BoxScoreCache` class automatically normalizes box scores:

1. **Quarter to Half Conversion**: If quarters are available but halves are not, halves are calculated from quarters
2. **Data Type Consistency**: Ensures scores are integers
3. **Structure Validation**: Ensures all required fields are present

## Caching Strategy

- **File-based caching**: Each league/date combination is stored as a JSON file
- **Cache checking**: By default, fetchers check cache before making API calls
- **Merge capability**: Can merge new scores with existing cached scores
- **In-memory cache**: `BoxScoreMatcher` maintains an in-memory cache for performance

## Future Enhancements

- [ ] Implement week calculation for NCAAF (currently requires manual week input)
- [ ] Add ESPN API as fallback/alternative source
- [ ] Add support for historical box score bulk fetching
- [ ] Add cache validation/cleanup utilities
- [ ] Add database storage option for large-scale caching
