"""
NCAAF Ingestor - Fetches College Football schedule and scores from SportsDataIO
"""

import os
import requests
from datetime import datetime
from typing import Dict, List, Optional
from .base import BaseIngestor

class NCAAFIngestor(BaseIngestor):
    """
    NCAAF schedule and scores ingestor using SportsDataIO API.
    """
    
    API_BASE = "https://api.sportsdata.io/v3/cfb/scores/json"
    
    def __init__(self, api_key: str = None, **kwargs):
        super().__init__(league="NCAAF", **kwargs)
        self.api_key = api_key or os.environ.get("SPORTSDATA_CFB_KEY") or os.environ.get("SPORTSDATA_API_KEY")
        
        if not self.api_key:
            raise ValueError("NCAAF API key required. Set SPORTSDATA_CFB_KEY or SPORTSDATA_API_KEY environment variable.")
    
    def get_current_season(self) -> str:
        """Get current NCAAF season year."""
        now = datetime.now()
        # CFB season runs Aug-Jan (bowl games)
        if now.month >= 2 and now.month <= 7:
            return str(now.year)  # Offseason
        elif now.month >= 8:
            return str(now.year)  # Current season
        else:
            return str(now.year - 1)  # Jan, still bowl season
    
    def fetch_schedule(self) -> List[Dict]:
        """Fetch NCAAF schedule for current season from SportsDataIO."""
        season = self.get_current_season()
        games = []
        
        # Fetch regular season games
        try:
            url = f"{self.API_BASE}/Games/{season}"
            response = requests.get(url, params={"key": self.api_key})
            
            if response.status_code == 200:
                season_games = response.json()
                for game in season_games:
                    standardized = self._standardize_game(game)
                    if standardized:
                        games.append(standardized)
        except Exception as e:
            print(f"Error fetching NCAAF regular season: {e}")
        
        # Fetch postseason/bowl games (uses next year format: 2025POST for 2024 season bowls)
        post_season = f"{int(season) + 1}POST"
        try:
            url = f"{self.API_BASE}/Games/{post_season}"
            response = requests.get(url, params={"key": self.api_key})
            
            if response.status_code == 200:
                bowl_games = response.json()
                for game in bowl_games:
                    standardized = self._standardize_game(game)
                    if standardized:
                        games.append(standardized)
        except Exception as e:
            print(f"Error fetching NCAAF postseason: {e}")
        
        return games
    
    def _standardize_game(self, game: Dict) -> Optional[Dict]:
        """Convert SportsDataIO game format to standard format."""
        try:
            # Parse date
            date_str = game.get("Day") or game.get("DateTime")
            if date_str:
                if "T" in date_str:
                    game_date = date_str.split("T")[0]
                else:
                    game_date = date_str[:10]
            else:
                return None
            
            # Get scores - handle zero correctly
            home_score = game.get("HomeTeamScore")
            away_score = game.get("AwayTeamScore")
            
            # Determine status
            status = "scheduled"
            if game.get("Status") == "Final":
                status = "final"
            elif game.get("Status") == "InProgress":
                status = "in_progress"
            elif home_score is not None or away_score is not None:
                status = "final"
            
            # Build quarter scores for segment betting
            quarter_scores = {}
            for q in range(1, 5):
                home_q = game.get(f"HomeTeamScoreQuarter{q}")
                away_q = game.get(f"AwayTeamScoreQuarter{q}")
                if home_q is not None or away_q is not None:
                    quarter_scores[f"Q{q}"] = {
                        "home": home_q or 0,
                        "away": away_q or 0
                    }
            
            # Add overtime if present
            home_ot = game.get("HomeTeamScoreOvertime")
            away_ot = game.get("AwayTeamScoreOvertime")
            if home_ot is not None or away_ot is not None:
                quarter_scores["OT"] = {
                    "home": home_ot or 0,
                    "away": away_ot or 0
                }
            
            return {
                "game_id": str(game.get("GameID")),
                "date": game_date,
                "home_team": game.get("HomeTeam"),
                "away_team": game.get("AwayTeam"),
                "home_team_name": game.get("HomeTeamName"),
                "away_team_name": game.get("AwayTeamName"),
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "quarter_scores": quarter_scores,
                "week": game.get("Week"),
                "season": game.get("Season"),
                "title": game.get("Title")  # Bowl game name
            }
        except Exception as e:
            print(f"Error standardizing NCAAF game: {e}")
            return None
