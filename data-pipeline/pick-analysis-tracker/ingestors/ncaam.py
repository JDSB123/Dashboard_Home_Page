"""
NCAAM Ingestor - Fetches College Basketball schedule and scores from ESPN API
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from .base import BaseIngestor

class NCAAMIngestor(BaseIngestor):
    """
    NCAAM schedule and scores ingestor using ESPN API.
    
    Leverages extensive team variant matching from NCAAM model.
    """
    
    API_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
    
    def __init__(self, **kwargs):
        super().__init__(league="NCAAM", **kwargs)
    
    def get_current_season(self) -> str:
        """Get current NCAAM season year."""
        now = datetime.now()
        # NCAAM season runs Nov-April
        if now.month >= 5 and now.month <= 10:
            return str(now.year + 1)  # Upcoming season
        elif now.month >= 11:
            return str(now.year + 1)  # Current season
        else:
            return str(now.year)  # Jan-April, current season
    
    def fetch_schedule(self, days_back: int = 90, days_forward: int = 7) -> List[Dict]:
        """
        Fetch NCAAM schedule from ESPN for a date range.
        ESPN only returns one day at a time, so we iterate.
        """
        games = []
        
        start_date = datetime.now() - timedelta(days=days_back)
        end_date = datetime.now() + timedelta(days=days_forward)
        
        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y%m%d")
            try:
                response = requests.get(self.API_BASE, params={
                    "dates": date_str,
                    "groups": "50",  # Division I
                    "limit": 300  # Get all games
                })
                
                if response.status_code == 200:
                    data = response.json()
                    for event in data.get("events", []):
                        standardized = self._standardize_game(event)
                        if standardized:
                            games.append(standardized)
            except Exception as e:
                print(f"Error fetching NCAAM {date_str}: {e}")
            
            current += timedelta(days=1)
        
        return games
    
    def _standardize_game(self, event: Dict) -> Optional[Dict]:
        """Convert ESPN event format to standard format."""
        try:
            # Get competition data
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])
            
            if len(competitors) != 2:
                return None
            
            # ESPN lists home team first (with homeAway field)
            home_team = None
            away_team = None
            home_team_full = None
            away_team_full = None
            home_score = None
            away_score = None
            
            for comp in competitors:
                team = comp.get("team", {})
                score = comp.get("score")
                
                # Get multiple name formats for better matching
                abbrev = team.get("abbreviation")
                short_name = team.get("shortDisplayName")
                full_name = team.get("displayName")
                
                # Use abbreviation as primary, fall back to others
                team_name = abbrev or short_name or full_name
                
                if comp.get("homeAway") == "home":
                    home_team = team_name
                    home_team_full = full_name
                    home_score = int(score) if score and score.isdigit() else None
                else:
                    away_team = team_name
                    away_team_full = full_name
                    away_score = int(score) if score and score.isdigit() else None
            
            # Parse date
            date_str = event.get("date", "")
            if date_str:
                game_date = date_str.split("T")[0]
            else:
                return None
            
            # Determine status
            status_obj = event.get("status", {})
            status_type = status_obj.get("type", {}).get("name", "")
            
            if status_type == "STATUS_FINAL":
                status = "final"
            elif status_type == "STATUS_IN_PROGRESS":
                status = "in_progress"
            else:
                status = "scheduled"
            
            # Get half scores if available (college uses halves, not quarters)
            half_scores = {}
            for comp in competitors:
                linescores = comp.get("linescores", [])
                is_home = comp.get("homeAway") == "home"
                
                for i, period in enumerate(linescores, 1):
                    period_key = f"H{i}" if i <= 2 else f"OT{i-2}"
                    if period_key not in half_scores:
                        half_scores[period_key] = {"home": 0, "away": 0}
                    
                    score_val = period.get("value", 0)
                    if is_home:
                        half_scores[period_key]["home"] = int(score_val) if score_val else 0
                    else:
                        half_scores[period_key]["away"] = int(score_val) if score_val else 0
            
            return {
                "game_id": event.get("id"),
                "date": game_date,
                "home_team": home_team,
                "away_team": away_team,
                "home_team_full": home_team_full,
                "away_team_full": away_team_full,
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "half_scores": half_scores,
                "name": event.get("name"),
                "short_name": event.get("shortName")
            }
        except Exception as e:
            print(f"Error standardizing NCAAM game: {e}")
            return None
    
    def find_game(self, date: str, team: str) -> Optional[Dict]:
        """
        Enhanced find_game that uses extensive NCAAM variant matching.
        Overrides base class to add additional matching strategies.
        """
        # First try the base class method
        game = super().find_game(date, team)
        if game:
            return game
        
        # If not found, try additional fuzzy matching for NCAAM
        schedule = self.get_schedule()
        date_games = schedule.get("by_date", {}).get(date, [])
        
        team_lower = team.strip().lower()
        
        # Try matching against full team names
        for game in date_games:
            home_full = (game.get("home_team_full") or "").lower()
            away_full = (game.get("away_team_full") or "").lower()
            
            # Check if team name is contained in full name
            if team_lower in home_full or team_lower in away_full:
                return game
            
            # Check if full name contains team
            if home_full in team_lower or away_full in team_lower:
                return game
        
        return None
