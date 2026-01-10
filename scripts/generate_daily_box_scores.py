import os
import json
import pandas as pd
from datetime import datetime
import pytz
import sys

# Config
CACHE_DIR = 'output/box_scores'

def load_game_cache(league, date_str):
    path = os.path.join(CACHE_DIR, league, f"{date_str}.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return []

def format_mini_box_score(game, league):
    # Extracts scores and formats the "Mini Box Score" string
    # Always Away-Home order to match Matchup
    
    # 1. Get Final Scores
    # SportsDataIO often uses {Away|Home}Score, ESPN uses {Away|Home}TeamScore
    # We normalized most ESPN data, but let's be safe
    a_final = game.get('AwayScore') or game.get('AwayTeamScore') or 0
    h_final = game.get('HomeScore') or game.get('HomeTeamScore') or 0
    
    parts = []
    
    # Format: Score-Score (Total)
    parts.append(f"FG: {a_final}-{h_final} ({a_final + h_final})")
    
    # 2. Get Periods (1H / 2H)
    # 1H is usually Q1+Q2. 2H is usually Final - 1H (or Q3+Q4+OT).
    
    a_1h = 0
    h_1h = 0
    has_segments = False
    
    # Check for SportsDataIO Quarter segments
    if 'AwayScoreQuarter1' in game:
        has_segments = True
        a_1h = (game.get('AwayScoreQuarter1') or 0) + (game.get('AwayScoreQuarter2') or 0)
        h_1h = (game.get('HomeScoreQuarter1') or 0) + (game.get('HomeScoreQuarter2') or 0)
    
    # Check for ESPN Normalized segments (HomeScore1H)
    elif 'HomeScore1H' in game:
        has_segments = True
        a_1h = game.get('AwayScore1H') or 0
        h_1h = game.get('HomeScore1H') or 0
        
    if has_segments:
        # Calculate 2H as remainder (includes OT)
        # Verify 2H calculation: Final - 1H
        a_2h = a_final - a_1h
        h_2h = h_final - h_1h
        
        parts.append(f"1H: {a_1h}-{h_1h} ({a_1h + h_1h})")
        parts.append(f"2H: {a_2h}-{h_2h} ({a_2h + h_2h})")
        
    return " | ".join(parts)

def format_date_cst(raw_date):
    if not raw_date:
        return "N/A"
    
    try:
        # Use pandas for robust parsing
        dt_obj = pd.to_datetime(raw_date)
        
        # Check timezone awareness
        if dt_obj.tz is None:
            # Assume ET if coming from SportsDataIO (common)
            # Or if it looks like an ISO string that pandas parsed as naive, treat as UTC if 'Z' was in string?
            # Pandas usually handles Z if present.
            # If Z not present, assume US/Eastern for SportsDataIO
            if str(raw_date).endswith('Z'):
                 dt_obj = dt_obj.replace(tzinfo=pytz.utc)
            else:
                 tz_et = pytz.timezone('US/Eastern')
                 dt_obj = dt_obj.tz_localize(tz_et)
        
        # Convert to CST
        tz_cst = pytz.timezone('US/Central')
        dt_cst = dt_obj.tz_convert(tz_cst)
        
        return dt_cst.strftime("%Y-%m-%d %I:%M %p CST")
    except Exception as e:
        return str(raw_date)

def generate_report(target_date_str):
    report_rows = []
    
    # Order: NFL, NCAAF, NBA, NCAAM
    leagues = ['NFL', 'NCAAF', 'NBA', 'NCAAM']
    
    for league in leagues:
        games = load_game_cache(league, target_date_str)
        for game in games:
            # Filter? Assuming cache contains valid games.
            
            # Date Parsing
            raw_date = game.get('DateTime') or game.get('Date') or game.get('date')
            date_cst = format_date_cst(raw_date)
            
            # Matchup "Away vs. Home"
            # Get FULL team names if available, prioritization: 'AwayTeamName' > 'AwayTeam'
            away = game.get('AwayTeamName') or game.get('AwayTeam') or 'UNK'
            home = game.get('HomeTeamName') or game.get('HomeTeam') or 'UNK'
            
            # User requested "Match-Up (Away vs. Home)"
            matchup = f"{away} vs. {home}" 
            
            # Box Score
            mini_box = format_mini_box_score(game, league)
            
            report_rows.append({
                'sort_key': pd.to_datetime(date_cst.split(' CST')[0]), # Helper for sorting
                'display': f"{date_cst} | {league} | {matchup} | {mini_box}"
            })
            
    # Sort by time
    df = pd.DataFrame(report_rows)
    if not df.empty:
        df = df.sort_values(by='sort_key')
        
        for _, row in df.iterrows():
            print(row['display'])
    else:
        print(f"No games found for {target_date_str}")

if __name__ == "__main__":
    # Default to 12/28 if no arg, or take arg
    target = '2025-12-28'
    if len(sys.argv) > 1:
        target = sys.argv[1]
        
    generate_report(target)
