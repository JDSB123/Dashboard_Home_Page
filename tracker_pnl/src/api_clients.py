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
        Get NFL scores for a specific date (deprecated - use get_nfl_scores_by_week).
        
        Args:
            game_date: Date in YYYY-MM-DD format
            
        Returns:
            List of box score dictionaries
        """
        # Try the date-based endpoint first
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
    
    def get_nfl_scores_by_week(self, season: int, week: int) -> List[Dict]:
        """
        Get NFL scores for a specific week.
        
        Args:
            season: Season year (e.g., 2025)
            week: Week number (1-18 for regular season, 19+ for playoffs)
            
        Returns:
            List of game dictionaries with scores
        """
        url = f"{self.BASE_URL}/nfl/scores/json/ScoresByWeek/{season}/{week}"
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            games = response.json()
            
            result = []
            for game in games:
                game_date = game.get("Date", "")[:10] if game.get("Date") else ""
                parsed = self._parse_nfl_game(game, game_date)
                if parsed:
                    parsed["score_id"] = game.get("ScoreID")
                    result.append(parsed)
            
            return result
        except Exception as e:
            print(f"Error fetching NFL scores for week {week}: {e}")
            return []
    
    def get_nfl_box_scores_by_week(self, season: int, week: int) -> List[Dict]:
        """
        Get all NFL box scores for a week (includes quarter-by-quarter scores).
        
        Args:
            season: Season year (e.g., 2025)
            week: Week number (1-18 for regular season, 19+ for playoffs)
            
        Returns:
            List of box score dictionaries with quarter/half data
        """
        url = f"{self.BASE_URL}/nfl/stats/json/BoxScoresFinal/{season}/{week}"
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            box_scores = response.json()
            
            result = []
            for box in box_scores:
                score = box.get("Score", {})
                game_date = score.get("Date", "")[:10] if score.get("Date") else ""
                
                # Parse scoring quarters from the Score object
                quarter_scores = {}
                half_scores = {}
                
                for q in ["1", "2", "3", "4"]:
                    home_key = f"HomeScoreQuarter{q}"
                    away_key = f"AwayScoreQuarter{q}"
                    home_val = score.get(home_key)
                    away_val = score.get(away_key)
                    if home_val is not None and away_val is not None:
                        quarter_scores[f"Q{q}"] = {
                            "home": home_val,
                            "away": away_val
                        }
                
                # Derive halves from quarters
                if "Q1" in quarter_scores and "Q2" in quarter_scores:
                    half_scores["H1"] = {
                        "home": quarter_scores["Q1"]["home"] + quarter_scores["Q2"]["home"],
                        "away": quarter_scores["Q1"]["away"] + quarter_scores["Q2"]["away"]
                    }
                if "Q3" in quarter_scores and "Q4" in quarter_scores:
                    half_scores["H2"] = {
                        "home": quarter_scores["Q3"]["home"] + quarter_scores["Q4"]["home"],
                        "away": quarter_scores["Q3"]["away"] + quarter_scores["Q4"]["away"]
                    }
                
                # Check for overtime
                ot_home = score.get("HomeScoreOvertime")
                ot_away = score.get("AwayScoreOvertime")
                if ot_home is not None and ot_away is not None and (ot_home > 0 or ot_away > 0):
                    quarter_scores["OT"] = {"home": ot_home, "away": ot_away}
                
                parsed = {
                    "game_id": score.get("GameKey"),
                    "score_id": score.get("ScoreID"),
                    "date": game_date,
                    "league": "NFL",
                    "home_team": score.get("HomeTeam"),
                    "away_team": score.get("AwayTeam"),
                    "home_team_full": score.get("HomeTeamName"),
                    "away_team_full": score.get("AwayTeamName"),
                    "home_score": score.get("HomeScore"),
                    "away_score": score.get("AwayScore"),
                    "status": "final" if score.get("IsOver") else "scheduled",
                    "quarter_scores": quarter_scores,
                    "half_scores": half_scores,
                    "source": "SportsDataIO",
                    "fetched_at": datetime.now().isoformat()
                }
                result.append(parsed)
            
            return result
        except Exception as e:
            print(f"Error fetching NFL box scores for week {week}: {e}")
            return []
    
    def get_nfl_box_score(self, game_id: int) -> Optional[Dict]:
        """
        Get detailed box score for an NFL game by ScoreID.
        
        Args:
            game_id: NFL ScoreID
            
        Returns:
            Box score dictionary with segment data
        """
        url = f"{self.BASE_URL}/nfl/stats/json/BoxScoreByScoreIDV3/{game_id}"
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_nfl_box_score_v3(data)
        except Exception as e:
            print(f"Error fetching NFL box score for game {game_id}: {e}")
            return None
    
    def _parse_nfl_box_score_v3(self, data: Dict) -> Dict:
        """Parse NFL box score v3 format with quarter data."""
        score = data.get("Score", {})
        
        quarter_scores = {}
        for q in ["1", "2", "3", "4"]:
            home_key = f"HomeScoreQuarter{q}"
            away_key = f"AwayScoreQuarter{q}"
            home_val = score.get(home_key)
            away_val = score.get(away_key)
            if home_val is not None and away_val is not None:
                quarter_scores[f"Q{q}"] = {
                    "home": home_val,
                    "away": away_val
                }
        
        # Derive halves from quarters
        halves = {}
        if "Q1" in quarter_scores and "Q2" in quarter_scores:
            halves["H1"] = {
                "home": quarter_scores["Q1"]["home"] + quarter_scores["Q2"]["home"],
                "away": quarter_scores["Q1"]["away"] + quarter_scores["Q2"]["away"]
            }
        if "Q3" in quarter_scores and "Q4" in quarter_scores:
            halves["H2"] = {
                "home": quarter_scores["Q3"]["home"] + quarter_scores["Q4"]["home"],
                "away": quarter_scores["Q3"]["away"] + quarter_scores["Q4"]["away"]
            }
        
        # Overtime
        ot_home = score.get("HomeScoreOvertime")
        ot_away = score.get("AwayScoreOvertime")
        if ot_home is not None and ot_away is not None and (ot_home > 0 or ot_away > 0):
            quarter_scores["OT"] = {"home": ot_home, "away": ot_away}
        
        return {
            "quarter_scores": quarter_scores,
            "half_scores": halves
        }
    
    def get_ncaaf_scores(self, season: int, week: int) -> List[Dict]:
        """
        Get NCAAF scores for a specific week (basic, without quarter data).
        
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
    
    def get_ncaaf_games_by_week(self, season: int, week: int) -> List[Dict]:
        """
        Get NCAAF games for a specific week with quarter-by-quarter data.
        
        Args:
            season: Season year (e.g., 2025)
            week: Week number (1-16 for regular season, plus bowl games)
            
        Returns:
            List of game dictionaries with quarter/half scores
        """
        url = f"{self.BASE_URL}/cfb/scores/json/GamesByWeek/{season}/{week}"
        
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            games = response.json()
            
            result = []
            for game in games:
                parsed = self._parse_ncaaf_game_with_quarters(game)
                if parsed:
                    result.append(parsed)
            
            return result
        except Exception as e:
            print(f"Error fetching NCAAF games for week {week}: {e}")
            return []
    
    def get_ncaaf_box_score(self, game_id: int) -> Optional[Dict]:
        """
        Get detailed box score for an NCAAF game.
        
        Args:
            game_id: NCAAF game ID
            
        Returns:
            Box score dictionary with quarter/half data
        """
        url = f"{self.BASE_URL}/cfb/stats/json/BoxScore/{game_id}"
        
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            return self._parse_ncaaf_box_score(data)
        except Exception as e:
            print(f"Error fetching NCAAF box score for game {game_id}: {e}")
            return None
    
    def _parse_ncaaf_game_with_quarters(self, game: Dict) -> Dict:
        """Parse NCAAF game with quarter-by-quarter data."""
        game_date = game.get("DateTime", "")[:10] if game.get("DateTime") else ""
        
        # Extract quarter scores
        quarter_scores = {}
        home_q1 = game.get("HomeTeamScore1stQuarter")
        home_q2 = game.get("HomeTeamScore2ndQuarter")
        home_q3 = game.get("HomeTeamScore3rdQuarter")
        home_q4 = game.get("HomeTeamScore4thQuarter")
        away_q1 = game.get("AwayTeamScore1stQuarter")
        away_q2 = game.get("AwayTeamScore2ndQuarter")
        away_q3 = game.get("AwayTeamScore3rdQuarter")
        away_q4 = game.get("AwayTeamScore4thQuarter")
        
        if home_q1 is not None and away_q1 is not None:
            quarter_scores["Q1"] = {"home": home_q1, "away": away_q1}
        if home_q2 is not None and away_q2 is not None:
            quarter_scores["Q2"] = {"home": home_q2, "away": away_q2}
        if home_q3 is not None and away_q3 is not None:
            quarter_scores["Q3"] = {"home": home_q3, "away": away_q3}
        if home_q4 is not None and away_q4 is not None:
            quarter_scores["Q4"] = {"home": home_q4, "away": away_q4}
        
        # Derive half scores from quarters
        half_scores = {}
        if "Q1" in quarter_scores and "Q2" in quarter_scores:
            half_scores["H1"] = {
                "home": quarter_scores["Q1"]["home"] + quarter_scores["Q2"]["home"],
                "away": quarter_scores["Q1"]["away"] + quarter_scores["Q2"]["away"]
            }
        if "Q3" in quarter_scores and "Q4" in quarter_scores:
            half_scores["H2"] = {
                "home": quarter_scores["Q3"]["home"] + quarter_scores["Q4"]["home"],
                "away": quarter_scores["Q3"]["away"] + quarter_scores["Q4"]["away"]
            }
        
        # Check for overtime
        home_ot = game.get("HomeTeamScoreOvertime")
        away_ot = game.get("AwayTeamScoreOvertime")
        if home_ot is not None and away_ot is not None and (home_ot > 0 or away_ot > 0):
            quarter_scores["OT"] = {"home": home_ot, "away": away_ot}
        
        status = game.get("Status", "")
        is_final = status in ["Final", "F/OT"]
        
        return {
            "game_id": game.get("GameID"),
            "date": game_date,
            "league": "NCAAF",
            "home_team": game.get("HomeTeam"),
            "away_team": game.get("AwayTeam"),
            "home_team_full": game.get("HomeTeamName"),
            "away_team_full": game.get("AwayTeamName"),
            "home_score": game.get("HomeTeamScore"),
            "away_score": game.get("AwayTeamScore"),
            "status": "final" if is_final else "scheduled",
            "quarter_scores": quarter_scores,
            "half_scores": half_scores,
            "source": "SportsDataIO",
            "fetched_at": datetime.now().isoformat()
        }
    
    def _parse_ncaaf_box_score(self, data) -> Dict:
        """Parse NCAAF box score with quarter data from Periods array."""
        # Handle list response
        if isinstance(data, list) and data:
            data = data[0]
        
        game = data.get("Game", {})
        periods = data.get("Periods", [])
        
        # Extract quarter scores from Periods array
        quarter_scores = {}
        for period in periods:
            num = period.get("Number")
            if num in [1, 2, 3, 4]:
                quarter_scores[f"Q{num}"] = {
                    "home": period.get("HomeScore", 0),
                    "away": period.get("AwayScore", 0)
                }
            elif num == 5:  # Overtime
                quarter_scores["OT"] = {
                    "home": period.get("HomeScore", 0),
                    "away": period.get("AwayScore", 0)
                }
        
        # Derive halves
        halves = {}
        if "Q1" in quarter_scores and "Q2" in quarter_scores:
            halves["H1"] = {
                "home": quarter_scores["Q1"]["home"] + quarter_scores["Q2"]["home"],
                "away": quarter_scores["Q1"]["away"] + quarter_scores["Q2"]["away"]
            }
        if "Q3" in quarter_scores and "Q4" in quarter_scores:
            halves["H2"] = {
                "home": quarter_scores["Q3"]["home"] + quarter_scores["Q4"]["home"],
                "away": quarter_scores["Q3"]["away"] + quarter_scores["Q4"]["away"]
            }
        
        return {
            "quarter_scores": quarter_scores,
            "half_scores": halves
        }
    
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
