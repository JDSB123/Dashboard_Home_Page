"""
Extract team variant information from open-source repositories.
This script pulls data from nflverse, cfbfastR, hoopR, and ESPN APIs.
"""

import json
import csv
import requests
from pathlib import Path
from collections import defaultdict
import time

# Base output directory
OUTPUT_DIR = Path("assets/data/team-variants")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def fetch_nfl_teams():
    """Fetch NFL team data from nflverse."""
    print("Fetching NFL teams from nflverse...")
    url = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/teams.csv"
    
    response = requests.get(url)
    response.raise_for_status()
    
    # Parse CSV
    lines = response.text.strip().split('\n')
    reader = csv.DictReader(lines)
    
    # Group by team to capture all variants
    teams_by_abbr = defaultdict(lambda: {
        'abbreviations': set(),
        'names': set(),
        'locations': set(),
        'nicknames': set(),
        'historical': []
    })
    
    for row in reader:
        team = row['team']
        season = row['season']
        
        # Collect all abbreviations
        abbrevs = [team, row.get('nfl', ''), row.get('espn', ''), row.get('pfr', ''), 
                   row.get('pff', ''), row.get('fo', '')]
        teams_by_abbr[team]['abbreviations'].update([a for a in abbrevs if a])
        
        # Collect names and locations
        teams_by_abbr[team]['names'].add(row.get('full', ''))
        teams_by_abbr[team]['locations'].add(row.get('location', ''))
        teams_by_abbr[team]['nicknames'].add(row.get('nickname', ''))
        
        # Track historical changes
        teams_by_abbr[team]['historical'].append({
            'season': season,
            'full_name': row.get('full', ''),
            'location': row.get('location', ''),
            'nickname': row.get('nickname', '')
        })
    
    # Convert sets to lists for JSON serialization
    nfl_teams = {}
    for abbr, data in teams_by_abbr.items():
        nfl_teams[abbr] = {
            'abbreviations': sorted(list(data['abbreviations'])),
            'names': sorted(list(data['names'])),
            'locations': sorted(list(data['locations'])),
            'nicknames': sorted(list(data['nicknames'])),
            'historical': data['historical'][-5:]  # Keep last 5 seasons
        }
    
    return nfl_teams


def fetch_cfb_teams():
    """Fetch CFB team data from multiple sources."""
    print("Fetching CFB teams from sportsdataverse...")
    
    # Try multiple potential URLs
    urls = [
        "https://api.collegefootballdata.com/teams/fbs",
        "https://raw.githubusercontent.com/sportsdataverse/cfbfastR/main/data/cfb_teams.rda",
    ]
    
    cfb_teams = {}
    
    # Try to get data from College Football Data API (no key needed for teams endpoint)
    try:
        response = requests.get("https://api.collegefootballdata.com/teams/fbs?year=2024")
        if response.status_code == 200:
            teams = response.json()
            for team in teams:
                school = team.get('school', '')
                cfb_teams[school] = {
                    'school': school,
                    'mascot': team.get('mascot', ''),
                    'abbreviation': team.get('abbreviation', ''),
                    'alt_name1': team.get('alt_name1', ''),
                    'alt_name2': team.get('alt_name2', ''),
                    'alt_name3': team.get('alt_name3', ''),
                    'conference': team.get('conference', ''),
                    'division': team.get('division', ''),
                    'color': team.get('color', ''),
                    'alt_color': team.get('alt_color', ''),
                    'logos': team.get('logos', [])
                }
    except Exception as e:
        print(f"Error fetching CFB teams: {e}")
    
    return cfb_teams


def fetch_nba_teams():
    """Fetch NBA team data."""
    print("Fetching NBA teams...")
    
    # NBA teams with comprehensive variants
    nba_teams = {
        "ATL": {"name": "Atlanta Hawks", "location": "Atlanta", "nickname": "Hawks", "abbreviations": ["ATL"]},
        "BOS": {"name": "Boston Celtics", "location": "Boston", "nickname": "Celtics", "abbreviations": ["BOS"]},
        "BKN": {"name": "Brooklyn Nets", "location": "Brooklyn", "nickname": "Nets", "abbreviations": ["BKN", "BRK"],
                "historical": [{"name": "New Jersey Nets", "years": "1977-2012"}]},
        "CHA": {"name": "Charlotte Hornets", "location": "Charlotte", "nickname": "Hornets", "abbreviations": ["CHA", "CHO"],
                "historical": [{"name": "Charlotte Bobcats", "years": "2004-2014"}]},
        "CHI": {"name": "Chicago Bulls", "location": "Chicago", "nickname": "Bulls", "abbreviations": ["CHI"]},
        "CLE": {"name": "Cleveland Cavaliers", "location": "Cleveland", "nickname": "Cavaliers", "abbreviations": ["CLE"]},
        "DAL": {"name": "Dallas Mavericks", "location": "Dallas", "nickname": "Mavericks", "abbreviations": ["DAL"]},
        "DEN": {"name": "Denver Nuggets", "location": "Denver", "nickname": "Nuggets", "abbreviations": ["DEN"]},
        "DET": {"name": "Detroit Pistons", "location": "Detroit", "nickname": "Pistons", "abbreviations": ["DET"]},
        "GSW": {"name": "Golden State Warriors", "location": "Golden State", "nickname": "Warriors", "abbreviations": ["GSW", "GS"]},
        "HOU": {"name": "Houston Rockets", "location": "Houston", "nickname": "Rockets", "abbreviations": ["HOU"]},
        "IND": {"name": "Indiana Pacers", "location": "Indiana", "nickname": "Pacers", "abbreviations": ["IND"]},
        "LAC": {"name": "Los Angeles Clippers", "location": "Los Angeles", "nickname": "Clippers", "abbreviations": ["LAC", "LAL"],
                "historical": [{"name": "San Diego Clippers", "years": "1978-1984"}]},
        "LAL": {"name": "Los Angeles Lakers", "location": "Los Angeles", "nickname": "Lakers", "abbreviations": ["LAL", "LA"]},
        "MEM": {"name": "Memphis Grizzlies", "location": "Memphis", "nickname": "Grizzlies", "abbreviations": ["MEM"],
                "historical": [{"name": "Vancouver Grizzlies", "years": "1995-2001"}]},
        "MIA": {"name": "Miami Heat", "location": "Miami", "nickname": "Heat", "abbreviations": ["MIA"]},
        "MIL": {"name": "Milwaukee Bucks", "location": "Milwaukee", "nickname": "Bucks", "abbreviations": ["MIL"]},
        "MIN": {"name": "Minnesota Timberwolves", "location": "Minnesota", "nickname": "Timberwolves", "abbreviations": ["MIN"]},
        "NOP": {"name": "New Orleans Pelicans", "location": "New Orleans", "nickname": "Pelicans", "abbreviations": ["NOP", "NO"],
                "historical": [{"name": "New Orleans Hornets", "years": "2002-2013"}]},
        "NYK": {"name": "New York Knicks", "location": "New York", "nickname": "Knicks", "abbreviations": ["NYK", "NY"]},
        "OKC": {"name": "Oklahoma City Thunder", "location": "Oklahoma City", "nickname": "Thunder", "abbreviations": ["OKC"],
                "historical": [{"name": "Seattle SuperSonics", "years": "1967-2008"}]},
        "ORL": {"name": "Orlando Magic", "location": "Orlando", "nickname": "Magic", "abbreviations": ["ORL"]},
        "PHI": {"name": "Philadelphia 76ers", "location": "Philadelphia", "nickname": "76ers", "abbreviations": ["PHI"]},
        "PHX": {"name": "Phoenix Suns", "location": "Phoenix", "nickname": "Suns", "abbreviations": ["PHX", "PHO"]},
        "POR": {"name": "Portland Trail Blazers", "location": "Portland", "nickname": "Trail Blazers", "abbreviations": ["POR"]},
        "SAC": {"name": "Sacramento Kings", "location": "Sacramento", "nickname": "Kings", "abbreviations": ["SAC"]},
        "SAS": {"name": "San Antonio Spurs", "location": "San Antonio", "nickname": "Spurs", "abbreviations": ["SAS", "SA"]},
        "TOR": {"name": "Toronto Raptors", "location": "Toronto", "nickname": "Raptors", "abbreviations": ["TOR"]},
        "UTA": {"name": "Utah Jazz", "location": "Utah", "nickname": "Jazz", "abbreviations": ["UTA", "UTH"]},
        "WAS": {"name": "Washington Wizards", "location": "Washington", "nickname": "Wizards", "abbreviations": ["WAS"],
                "historical": [{"name": "Washington Bullets", "years": "1974-1997"}]}
    }
    
    return nba_teams


def fetch_ncaam_teams():
    """Fetch NCAAM team data from ESPN API."""
    print("Fetching NCAAM teams from ESPN API...")
    url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        ncaam_teams = {}
        
        if 'sports' in data and len(data['sports']) > 0:
            leagues = data['sports'][0].get('leagues', [])
            for league in leagues:
                teams = league.get('teams', [])
                
                for team_entry in teams:
                    team = team_entry.get('team', {})
                    
                    team_id = team.get('id', '')
                    if not team_id:
                        continue
                    
                    # Get abbreviation (primary key)
                    abbrev = team.get('abbreviation', '').upper()
                    if not abbrev:
                        continue
                    
                    name = team.get('displayName', '')
                    location = team.get('location', '')
                    nickname = team.get('name', '')  # Nickname/mascot
                    
                    # Get conference info
                    groups = team.get('groups', {})
                    conference = None
                    if groups and 'id' in groups:
                        conference = groups.get('name', '')
                    
                    # Alternative abbreviations
                    abbreviations = [abbrev]
                    alt_abbrev = team.get('shortDisplayName', '').split()
                    if alt_abbrev and len(alt_abbrev[-1]) <= 4:
                        alt = alt_abbrev[-1].upper()
                        if alt and alt != abbrev:
                            abbreviations.append(alt)
                    
                    team_info = {
                        "name": name,
                        "location": location,
                        "nickname": nickname,
                        "abbreviations": abbreviations,
                        "espn_id": team_id
                    }
                    
                    if conference:
                        team_info["conference"] = conference
                    
                    # Store by primary abbreviation
                    ncaam_teams[abbrev] = team_info
        
        print(f"Successfully fetched {len(ncaam_teams)} NCAAM teams")
        return ncaam_teams
        
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch NCAAM teams from ESPN API: {e}")
        print("NCAAM data extraction skipped.")
        return {}


def save_team_data(data, filename):
    """Save team data to JSON file."""
    output_path = OUTPUT_DIR / filename
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(data)} teams to {output_path}")


def main():
    """Main execution function."""
    print("=" * 60)
    print("Extracting Team Variant Data from Open Source Repositories")
    print("=" * 60)
    
    # Fetch NFL data
    try:
        nfl_teams = fetch_nfl_teams()
        save_team_data(nfl_teams, 'nfl_team_variants.json')
    except Exception as e:
        print(f"Error processing NFL teams: {e}")
    
    # Fetch CFB data
    try:
        cfb_teams = fetch_cfb_teams()
        if cfb_teams:
            save_team_data(cfb_teams, 'cfb_team_variants.json')
    except Exception as e:
        print(f"Error processing CFB teams: {e}")
    
    # Fetch NBA data
    try:
        nba_teams = fetch_nba_teams()
        save_team_data(nba_teams, 'nba_team_variants.json')
    except Exception as e:
        print(f"Error processing NBA teams: {e}")
    
    # Fetch NCAAM data
    try:
        ncaam_teams = fetch_ncaam_teams()
        if ncaam_teams:
            save_team_data(ncaam_teams, 'ncaam_team_variants.json')
    except Exception as e:
        print(f"Error processing NCAAM teams: {e}")
    
    # Create consolidated metadata file
    metadata = {
        "source": "Open Source Sports Data Repositories",
        "repositories": {
            "nfl": {
                "name": "nflverse",
                "url": "https://github.com/nflverse",
                "data_source": "https://github.com/nflverse/nfldata"
            },
            "cfb": {
                "name": "cfbfastR / College Football Data API",
                "url": "https://github.com/sportsdataverse/cfbfastR",
                "data_source": "https://api.collegefootballdata.com"
            },
            "nba": {
                "name": "hoopR / NBA Stats",
                "url": "https://github.com/sportsdataverse/hoopR",
                "data_source": "Manual compilation with historical data"
            },
            "ncaam": {
                "name": "ESPN College Basketball API",
                "url": "https://site.api.espn.com",
                "data_source": "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams"
            }
        },
        "generated": "2024-12-24",
        "description": "Comprehensive team name variants, abbreviations, and historical information"
    }
    
    save_team_data(metadata, 'metadata.json')
    
    print("\n" + "=" * 60)
    print("Extraction Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
