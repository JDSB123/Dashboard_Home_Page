"""
API Clients Module
Client implementations for various sports data APIs.
"""

import os
import requests
from typing import List, Dict, Optional
from datetime import datetime, date
import time


class SportsDataIOClient:
    """Client for SportsDataIO API (NFL and NCAAF only)."""
    
    BASE_URL = "https://api.sportsdata.io/v3"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize SportsDataIO client.
        
        Args:
            api_key: API key (defaults to SPORTSDATAIO_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("SPORTSDATAIO_API_KEY")
        if not self.api_key:
            raise ValueError("SportsDataIO API key not provided")
        
        self.session = requests.Session()
        self.session.headers.update({
            "Ocp-Apim-Subscription-Key": self.api_key
        })
    
    def get_nfl_scores(self, game_date: str) -> List[Dict]:
        """
        Get NFL scores for a specific date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            
        Returns:
            List of box score dictionaries
        """
        url = f"{self.BASE_URL}/nfl/scores/json/Scores/{game_date}"
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            games = response.json()
            
            box_scores = []
            for game in games:
                box_score = self._parse_nfl_game(game, game_date)
                if box_score:
                    box_scores.append(box_score)
            
            return box_scores
        except Exception as e:
            print(f"Error fetching NFL scores for {game_date}: {e}")
            return []
    
    def get_nfl_box_score(self, game_id: int) -> Optional[Dict]:
        """
        Get detailed box score for an NFL game.
        
        Args:
            game_id: NFL game ID
            
        Returns:
            Box score dictionary with segment data
        """
        url = f"{self.BASE_URL}/nfl/scores/json/BoxScore/{game_id}"
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_nfl_box_score(data)
        except Exception as e:
            print(f"Error fetching NFL box score for game {game_id}: {e}")
            return None
    
    def get_ncaaf_scores(self, season: int, week: int) -> List[Dict]:
        """
        Get NCAAF scores for a specific week.
        
        Args:
            season: Season year (e.g., 2025)
            week: Week number
            
        Returns:
            List of box score dictionaries
        """
        url = f"{self.BASE_URL}/cfb/scores/json/Scores/{season}/{week}"
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            games = response.json()
            
            box_scores = []
            for game in games:
                box_score = self._parse_ncaaf_game(game)
                if box_score:
                    box_scores.append(box_score)
            
            return box_scores
        except Exception as e:
            print(f"Error fetching NCAAF scores for season {season} week {week}: {e}")
            return []
    
    def _parse_nfl_game(self, game: Dict, game_date: str) -> Dict:
        """Parse NFL game data into box score format."""
        return {
            "game_id": game.get("GameID"),
            "date": game_date,
            "league": "NFL",
            "home_team": game.get("HomeTeam"),
            "away_team": game.get("AwayTeam"),
            "home_team_full": game.get("HomeTeamName"),
            "away_team_full": game.get("AwayTeamName"),
            "home_score": game.get("HomeScore"),
            "away_score": game.get("AwayScore"),
            "status": "final" if game.get("IsOver") else "scheduled",
            "half_scores": {},
            "quarter_scores": {},
            "source": "SportsDataIO",
            "fetched_at": datetime.now().isoformat()
        }
    
    def _parse_nfl_box_score(self, data: Dict) -> Dict:
        """Parse NFL box score with quarter data."""
        quarters = {}
        for q in ["1", "2", "3", "4"]:
            home_key = f"Quarter{q}HomeScore"
            away_key = f"Quarter{q}AwayScore"
            if home_key in data and away_key in data:
                quarters[f"Q{q}"] = {
                    "home": data.get(home_key, 0),
                    "away": data.get(away_key, 0)
                }
        
        # Derive halves from quarters
        halves = {}
        if "Q1" in quarters and "Q2" in quarters:
            halves["H1"] = {
                "home": quarters["Q1"]["home"] + quarters["Q2"]["home"],
                "away": quarters["Q1"]["away"] + quarters["Q2"]["away"]
            }
        if "Q3" in quarters and "Q4" in quarters:
            halves["H2"] = {
                "home": quarters["Q3"]["home"] + quarters["Q4"]["home"],
                "away": quarters["Q3"]["away"] + quarters["Q4"]["away"]
            }
        
        return {
            "quarter_scores": quarters,
            "half_scores": halves
        }
    
    def _parse_ncaaf_game(self, game: Dict) -> Dict:
        """Parse NCAAF game data into box score format."""
        return {
            "game_id": game.get("GameID"),
            "date": game.get("DateTime", "")[:10] if game.get("DateTime") else "",
            "league": "NCAAF",
            "home_team": game.get("HomeTeam"),
            "away_team": game.get("AwayTeam"),
            "home_team_full": game.get("HomeTeamName"),
            "away_team_full": game.get("AwayTeamName"),
            "home_score": game.get("HomeScore"),
            "away_score": game.get("AwayScore"),
            "status": "final" if game.get("IsOver") else "scheduled",
            "half_scores": {},
            "quarter_scores": {},
            "source": "SportsDataIO",
            "fetched_at": datetime.now().isoformat()
        }


class APIBasketballClient:
    """Client for API-Basketball / API-Sports (NBA and NCAAM)."""
    
    BASE_URL = "https://api-basketball.p.rapidapi.com"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize API-Basketball client.
        
        Args:
            api_key: API key (defaults to API_BASKETBALL_KEY env var)
        """
        self.api_key = api_key or os.getenv("API_BASKETBALL_KEY")
        if not self.api_key:
            raise ValueError("API-Basketball API key not provided")
        
        self.session = requests.Session()
        self.session.headers.update({
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "api-basketball.p.rapidapi.com"
        })
    
    def get_nba_games(self, game_date: str) -> List[Dict]:
        """
        Get NBA games for a specific date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            
        Returns:
            List of box score dictionaries
        """
        url = f"{self.BASE_URL}/games"
        params = {
            "date": game_date,
            "league": "12",  # NBA league ID
            "season": self._get_season(game_date)
        }
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            games = data.get("response", [])
            
            box_scores = []
            for game in games:
                box_score = self._parse_nba_game(game, game_date)
                if box_score:
                    box_scores.append(box_score)
            
            return box_scores
        except Exception as e:
            print(f"Error fetching NBA games for {game_date}: {e}")
            return []
    
    def get_nba_box_score(self, game_id: int) -> Optional[Dict]:
        """Get detailed box score for NBA game."""
        url = f"{self.BASE_URL}/games"
        params = {"id": game_id}
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            games = data.get("response", [])
            if games:
                return self._parse_nba_box_score(games[0])
            return None
        except Exception as e:
            print(f"Error fetching NBA box score for game {game_id}: {e}")
            return None
    
    def get_ncaam_games(self, game_date: str) -> List[Dict]:
        """Get NCAAM games for a specific date."""
        url = f"{self.BASE_URL}/games"
        params = {
            "date": game_date,
            "league": "5",  # NCAA league ID
            "season": self._get_season(game_date)
        }
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            games = data.get("response", [])
            
            box_scores = []
            for game in games:
                box_score = self._parse_ncaam_game(game, game_date)
                if box_score:
                    box_scores.append(box_score)
            
            return box_scores
        except Exception as e:
            print(f"Error fetching NCAAM games for {game_date}: {e}")
            return []
    
    def _get_season(self, game_date: str) -> str:
        """Get season string from date (e.g., '2025-2026')."""
        year = int(game_date[:4])
        month = int(game_date[5:7])
        # NBA/NCAAM season spans two years (e.g., Oct 2025 - June 2026 = 2025-2026)
        if month >= 10:
            return f"{year}-{year+1}"
        else:
            return f"{year-1}-{year}"
    
    def _parse_nba_game(self, game: Dict, game_date: str) -> Dict:
        """Parse NBA game data into box score format."""
        teams = game.get("teams", {})
        scores = game.get("scores", {})
        
        return {
            "game_id": game.get("id"),
            "date": game_date,
            "league": "NBA",
            "home_team": teams.get("home", {}).get("code", ""),
            "away_team": teams.get("away", {}).get("code", ""),
            "home_team_full": teams.get("home", {}).get("name", ""),
            "away_team_full": teams.get("away", {}).get("name", ""),
            "home_score": scores.get("home", {}).get("total"),
            "away_score": scores.get("away", {}).get("total"),
            "status": "final" if game.get("status", {}).get("long") == "Finished" else "scheduled",
            "half_scores": {},
            "quarter_scores": {},
            "source": "API-Basketball",
            "fetched_at": datetime.now().isoformat()
        }
    
    def _parse_nba_box_score(self, game: Dict) -> Dict:
        """Parse NBA box score with quarter and half data."""
        scores = game.get("scores", {})
        quarters = {}
        
        # Parse quarters
        for q in ["1", "2", "3", "4"]:
            home_score = scores.get("home", {}).get(f"quarter_{q}")
            away_score = scores.get("away", {}).get(f"quarter_{q}")
            if home_score is not None and away_score is not None:
                quarters[f"Q{q}"] = {
                    "home": home_score,
                    "away": away_score
                }
        
        # Parse halves
        halves = {}
        home_h1 = scores.get("home", {}).get("half")
        away_h1 = scores.get("away", {}).get("half")
        if home_h1 is not None and away_h1 is not None:
            halves["H1"] = {"home": home_h1, "away": away_h1}
        
        return {
            "quarter_scores": quarters,
            "half_scores": halves
        }
    
    def _parse_ncaam_game(self, game: Dict, game_date: str) -> Dict:
        """Parse NCAAM game data into box score format."""
        teams = game.get("teams", {})
        scores = game.get("scores", {})
        
        return {
            "game_id": game.get("id"),
            "date": game_date,
            "league": "NCAAM",
            "home_team": teams.get("home", {}).get("code", ""),
            "away_team": teams.get("away", {}).get("code", ""),
            "home_team_full": teams.get("home", {}).get("name", ""),
            "away_team_full": teams.get("away", {}).get("name", ""),
            "home_score": scores.get("home", {}).get("total"),
            "away_score": scores.get("away", {}).get("total"),
            "status": "final" if game.get("status", {}).get("long") == "Finished" else "scheduled",
            "half_scores": {},
            "quarter_scores": {},
            "source": "API-Basketball",
            "fetched_at": datetime.now().isoformat()
        }
