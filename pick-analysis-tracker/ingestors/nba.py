"""
NBA Ingestor - Fetches NBA schedule and scores from ESPN API
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from .base import BaseIngestor

class NBAIngestor(BaseIngestor):
    """
    NBA schedule and scores ingestor using ESPN API.
    """
    
    API_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
    
    def __init__(self, **kwargs):
        super().__init__(league="NBA", **kwargs)
    
    def get_current_season(self) -> str:
        """Get current NBA season year."""
        now = datetime.now()
        # NBA season runs Oct-June
        if now.month >= 7 and now.month <= 9:
            return str(now.year + 1)  # Upcoming season
        elif now.month >= 10:
            return str(now.year + 1)  # Current season (2024-25 = 2025)
        else:
            return str(now.year)  # Jan-June, current season
    
    def fetch_schedule(self, days_back: int = 30, days_forward: int = 7) -> List[Dict]:
        """
        Fetch NBA schedule from ESPN for a date range.
        ESPN only returns one day at a time, so we iterate.
        """
        games = []
        
        start_date = datetime.now() - timedelta(days=days_back)
        end_date = datetime.now() + timedelta(days=days_forward)
        
        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y%m%d")
            try:
                response = requests.get(self.API_BASE, params={"dates": date_str})
                
                if response.status_code == 200:
                    data = response.json()
                    for event in data.get("events", []):
                        standardized = self._standardize_game(event)
                        if standardized:
                            games.append(standardized)
            except Exception as e:
                print(f"Error fetching NBA {date_str}: {e}")
            
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
            home_score = None
            away_score = None
            
            for comp in competitors:
                team = comp.get("team", {})
                score = comp.get("score")
                
                if comp.get("homeAway") == "home":
                    home_team = team.get("abbreviation") or team.get("shortDisplayName") or team.get("displayName")
                    home_score = int(score) if score and score.isdigit() else None
                else:
                    away_team = team.get("abbreviation") or team.get("shortDisplayName") or team.get("displayName")
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
            
            # Get quarter/period scores if available
            quarter_scores = {}
            for comp in competitors:
                linescores = comp.get("linescores", [])
                is_home = comp.get("homeAway") == "home"
                
                for i, period in enumerate(linescores, 1):
                    period_key = f"Q{i}" if i <= 4 else f"OT{i-4}"
                    if period_key not in quarter_scores:
                        quarter_scores[period_key] = {"home": 0, "away": 0}
                    
                    score_val = period.get("value", 0)
                    if is_home:
                        quarter_scores[period_key]["home"] = int(score_val) if score_val else 0
                    else:
                        quarter_scores[period_key]["away"] = int(score_val) if score_val else 0
            
            return {
                "game_id": event.get("id"),
                "date": game_date,
                "home_team": home_team,
                "away_team": away_team,
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "quarter_scores": quarter_scores,
                "name": event.get("name"),
                "short_name": event.get("shortName")
            }
        except Exception as e:
            print(f"Error standardizing NBA game: {e}")
            return None
