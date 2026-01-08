"""
NFL Ingestor - Fetches NFL schedule and scores from SportsDataIO
"""

import os
import requests
from datetime import datetime
from typing import Dict, List, Optional
from .base import BaseIngestor

class NFLIngestor(BaseIngestor):
    """
    NFL schedule and scores ingestor using SportsDataIO API.
    """
    
    API_BASE = "https://api.sportsdata.io/v3/nfl/scores/json"
    
    def __init__(self, api_key: str = None, **kwargs):
        super().__init__(league="NFL", **kwargs)
        self.api_key = api_key or os.environ.get("SPORTSDATA_NFL_KEY") or os.environ.get("SPORTSDATA_API_KEY")
        
        if not self.api_key:
            raise ValueError("NFL API key required. Set SPORTSDATA_NFL_KEY or SPORTSDATA_API_KEY environment variable.")
    
    def get_current_season(self) -> str:
        """Get current NFL season year."""
        now = datetime.now()
        # NFL season spans two calendar years, use the starting year
        # Season typically runs Sept-Feb
        if now.month >= 3 and now.month <= 8:
            return str(now.year)  # Offseason, use upcoming season
        elif now.month >= 9:
            return str(now.year)  # Current season
        else:
            return str(now.year - 1)  # Jan-Feb, still previous season
    
    def fetch_schedule(self) -> List[Dict]:
        """Fetch NFL schedule for current season from SportsDataIO."""
        season = self.get_current_season()
        games = []
        
        # Fetch all weeks (1-18 regular season + postseason)
        for week in range(1, 23):  # Weeks 1-18 regular + playoffs
            try:
                url = f"{self.API_BASE}/ScoresByWeek/{season}/{week}"
                response = requests.get(url, params={"key": self.api_key})
                
                if response.status_code == 200:
                    week_games = response.json()
                    for game in week_games:
                        standardized = self._standardize_game(game)
                        if standardized:
                            games.append(standardized)
                elif response.status_code == 404:
                    # Week doesn't exist yet (future)
                    continue
                else:
                    print(f"NFL API error week {week}: {response.status_code}")
            except Exception as e:
                print(f"Error fetching NFL week {week}: {e}")
        
        return games
    
    def _standardize_game(self, game: Dict) -> Optional[Dict]:
        """Convert SportsDataIO game format to standard format."""
        try:
            # Parse date
            date_str = game.get("Date") or game.get("Day")
            if date_str:
                # Handle various date formats
                if "T" in date_str:
                    game_date = date_str.split("T")[0]
                else:
                    game_date = date_str[:10]
            else:
                return None
            
            # Get scores - handle zero correctly
            home_score = game.get("HomeScore")
            away_score = game.get("AwayScore")
            
            # Determine status
            status = "scheduled"
            if game.get("IsOver"):
                status = "final"
            elif game.get("IsInProgress"):
                status = "in_progress"
            elif home_score is not None or away_score is not None:
                status = "final"
            
            # Build quarter scores for segment betting
            quarter_scores = {}
            for q in range(1, 5):
                home_q = game.get(f"HomeScoreQuarter{q}")
                away_q = game.get(f"AwayScoreQuarter{q}")
                if home_q is not None or away_q is not None:
                    quarter_scores[f"Q{q}"] = {
                        "home": home_q or 0,
                        "away": away_q or 0
                    }
            
            # Add overtime if present
            home_ot = game.get("HomeScoreOvertime")
            away_ot = game.get("AwayScoreOvertime")
            if home_ot is not None or away_ot is not None:
                quarter_scores["OT"] = {
                    "home": home_ot or 0,
                    "away": away_ot or 0
                }
            
            return {
                "game_id": str(game.get("GameKey") or game.get("ScoreID")),
                "date": game_date,
                "home_team": game.get("HomeTeam"),
                "away_team": game.get("AwayTeam"),
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "quarter_scores": quarter_scores,
                "week": game.get("Week"),
                "season": game.get("Season"),
                "season_type": game.get("SeasonType")
            }
        except Exception as e:
            print(f"Error standardizing NFL game: {e}")
            return None
