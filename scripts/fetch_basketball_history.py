import requests
import json
import os
import time
from datetime import datetime, timedelta

# Constants
OUTPUT_DIR = 'output/box_scores'
START_DATE = '2025-11-01' # Approx start of season
END_DATE = '2026-01-10'   # Current date in context

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def save_json(league, date_str, data):
    # Ensure standard filename YYYY-MM-DD.json
    year, month, day = date_str[:4], date_str[4:6], date_str[6:]
    formatted_date = f"{year}-{month}-{day}"
    
    path = os.path.join(OUTPUT_DIR, league, f"{formatted_date}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    return len(data)

def parse_espn_event(event, league):
    # Flatten ESPN structure to match our Box Score schema roughly
    game = {}
    try:
        competition = event['competitions'][0]
        competitors = competition['competitors']
        
        # Sort so Home is usually last in ESPN, but we check 'homeAway'
        home_comp = next(c for c in competitors if c['homeAway'] == 'home')
        away_comp = next(c for c in competitors if c['homeAway'] == 'away')
        
        game['GameKey'] = event['id']
        game['Date'] = event['date']
        game['Status'] = event['status']['type']['description']
        
        game['HomeTeam'] = home_comp['team']['abbreviation']
        game['AwayTeam'] = away_comp['team']['abbreviation']
        game['HomeTeamName'] = home_comp['team']['displayName']
        game['AwayTeamName'] = away_comp['team']['displayName']
        
        game['HomeScore'] = int(home_comp.get('score', 0))
        game['AwayScore'] = int(away_comp.get('score', 0))
        
        # Period Scores (Linescores)
        # ESPN lists them in order.
        # NBA: Q1, Q2, Q3, Q4, OT...
        # NCAAM: H1, H2, OT...
        
        h_lines = home_comp.get('linescores', [])
        a_lines = away_comp.get('linescores', [])
        
        if league == 'NBA':
            # Map Qs to standard keys if feasible, or just store the array
            # We want to enable 1H calculation.
            # Q1=0, Q2=1
            if len(h_lines) >= 2:
                game['HomeScoreQ1'] = int(float(h_lines[0].get('value', 0)))
                game['HomeScoreQ2'] = int(float(h_lines[1].get('value', 0)))
                game['HomeScore1H'] = game['HomeScoreQ1'] + game['HomeScoreQ2']
            if len(a_lines) >= 2:
                game['AwayScoreQ1'] = int(float(a_lines[0].get('value', 0)))
                game['AwayScoreQ2'] = int(float(a_lines[1].get('value', 0)))
                game['AwayScore1H'] = game['AwayScoreQ1'] + game['AwayScoreQ2']
                
        elif league == 'NCAAM':
            # Period 1 is 1st Half
            if len(h_lines) >= 1:
                game['HomeScore1H'] = int(float(h_lines[0].get('value', 0)))
            if len(a_lines) >= 1:
                game['AwayScore1H'] = int(float(a_lines[0].get('value', 0)))
                
        # Store raw linescores for deeper inspection if needed
        game['HomeLinescores'] = h_lines
        game['AwayLinescores'] = a_lines
        
        return game
    except Exception as e:
        # print(f"Error parsing event {event.get('id')}: {e}")
        return None

def fetch_range(league, url_template):
    print(f"Fetching {league} from {START_DATE} to {END_DATE}")
    
    start = datetime.strptime(START_DATE, "%Y-%m-%d")
    end = datetime.strptime(END_DATE, "%Y-%m-%d")
    delta = timedelta(days=1)
    
    current = start
    total_games = 0
    
    while current <= end:
        date_str = current.strftime("%Y%m%d") # ESPN uses compact format
        
        url = url_template.format(date_str)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                raw_data = resp.json()
                events = raw_data.get('events', [])
                
                clean_games = []
                for evt in events:
                     g = parse_espn_event(evt, league)
                     if g: clean_games.append(g)
                
                if clean_games:
                    save_json(league, date_str, clean_games)
                    total_games += len(clean_games)
                    # print(f"  {date_str}: {len(clean_games)} games")
                else:
                    pass # print(f"  {date_str}: No games")
            else:
                print(f"Failed {date_str}: {resp.status_code}")
                
        except Exception as e:
            print(f"Exception on {date_str}: {e}")
        
        current += delta
        # Courtesy sleep
        time.sleep(0.1)
        
    print(f"Total {league} games cached: {total_games}")

if __name__ == "__main__":
    # NBA
    fetch_range('NBA', "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={}&limit=100")
    
    # NCAAM (Div I mostly, groups=50)
    fetch_range('NCAAM', "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={}&groups=50&limit=500")
