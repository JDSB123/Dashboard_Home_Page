"""
Box Score Cache Module
Manages caching and storage of box scores with segment/period data.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime, date
import hashlib


class BoxScoreCache:
    """Manages caching and storage of box scores."""
    
    def __init__(self, cache_dir: str = "box_scores"):
        """
        Initialize box score cache.
        
        Args:
            cache_dir: Directory to store cached box scores
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # League directories
        self.leagues = ["NBA", "NFL", "NCAAF", "NCAAM"]
        for league in self.leagues:
            (self.cache_dir / league).mkdir(parents=True, exist_ok=True)
    
    def get_file_path(self, league: str, game_date: str) -> Path:
        """
        Get file path for a specific league and date.
        
        Args:
            league: League code (NBA, NFL, NCAAF, NCAAM)
            game_date: Date in YYYY-MM-DD format
            
        Returns:
            Path to cache file
        """
        if league not in self.leagues:
            raise ValueError(f"Invalid league: {league}. Must be one of {self.leagues}")
        
        return self.cache_dir / league / f"{game_date}.json"
    
    def store_box_scores(self, league: str, game_date: str, box_scores: List[Dict]):
        """
        Store box scores for a specific league and date.
        
        Args:
            league: League code
            game_date: Date in YYYY-MM-DD format
            box_scores: List of box score dictionaries
        """
        file_path = self.get_file_path(league, game_date)
        
        # Normalize and validate box scores
        normalized_scores = []
        for score in box_scores:
            normalized = self._normalize_box_score(score, league)
            normalized_scores.append(normalized)
        
        # Write to file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(normalized_scores, f, indent=2, ensure_ascii=False)
        
        print(f"Stored {len(normalized_scores)} box scores for {league} on {game_date}")
    
    def load_box_scores(self, league: str, game_date: str) -> List[Dict]:
        """
        Load box scores for a specific league and date.
        
        Args:
            league: League code
            game_date: Date in YYYY-MM-DD format
            
        Returns:
            List of box score dictionaries, empty list if not found
        """
        file_path = self.get_file_path(league, game_date)
        
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading box scores from {file_path}: {e}")
            return []
    
    def _normalize_box_score(self, box_score: Dict, league: str) -> Dict:
        """
        Normalize box score to ensure consistent structure with segment data.
        
        Args:
            box_score: Raw box score dictionary
            league: League code
            
        Returns:
            Normalized box score dictionary
        """
        normalized = {
            "game_id": box_score.get("game_id", ""),
            "date": box_score.get("date", ""),
            "league": league,
            "home_team": box_score.get("home_team", ""),
            "away_team": box_score.get("away_team", ""),
            "home_team_full": box_score.get("home_team_full"),
            "away_team_full": box_score.get("away_team_full"),
            "home_score": box_score.get("home_score", 0),
            "away_score": box_score.get("away_score", 0),
            "status": box_score.get("status", "pending"),
            "half_scores": box_score.get("half_scores", {}),
            "quarter_scores": box_score.get("quarter_scores", {}),
            "source": box_score.get("source", ""),
            "fetched_at": box_score.get("fetched_at", datetime.now().isoformat())
        }
        
        # Ensure segment scores are properly structured
        normalized["half_scores"] = self._normalize_half_scores(
            normalized["half_scores"], 
            normalized.get("quarter_scores", {}),
            league
        )
        normalized["quarter_scores"] = self._normalize_quarter_scores(
            normalized["quarter_scores"],
            normalized.get("half_scores", {}),
            league
        )
        
        return normalized
    
    def _normalize_half_scores(self, half_scores: Dict, quarter_scores: Dict, league: str) -> Dict:
        """
        Normalize half scores, deriving from quarters if needed.
        
        Args:
            half_scores: Existing half scores
            quarter_scores: Quarter scores (can derive halves from these)
            league: League code
            
        Returns:
            Normalized half scores dictionary
        """
        normalized = {}
        
        # If we have half scores, use them
        if half_scores:
            normalized = half_scores.copy()
        
        # If we have quarter scores but no half scores, derive halves
        elif quarter_scores and league in ["NFL", "NCAAF", "NCAAM"]:
            # NFL/NCAAF/NCAAM: Q1+Q2 = 1H, Q3+Q4 = 2H
            if "Q1" in quarter_scores and "Q2" in quarter_scores:
                q1 = quarter_scores["Q1"]
                q2 = quarter_scores["Q2"]
                normalized["H1"] = {
                    "home": q1.get("home", 0) + q2.get("home", 0),
                    "away": q1.get("away", 0) + q2.get("away", 0)
                }
            
            if "Q3" in quarter_scores and "Q4" in quarter_scores:
                q3 = quarter_scores["Q3"]
                q4 = quarter_scores["Q4"]
                normalized["H2"] = {
                    "home": q3.get("home", 0) + q4.get("home", 0),
                    "away": q3.get("away", 0) + q4.get("away", 0)
                }
        
        elif quarter_scores and league == "NBA":
            # NBA: Q1+Q2 = 1H, Q3+Q4 = 2H
            if "Q1" in quarter_scores and "Q2" in quarter_scores:
                q1 = quarter_scores["Q1"]
                q2 = quarter_scores["Q2"]
                normalized["H1"] = {
                    "home": q1.get("home", 0) + q2.get("home", 0),
                    "away": q1.get("away", 0) + q2.get("away", 0)
                }
            
            if "Q3" in quarter_scores and "Q4" in quarter_scores:
                q3 = quarter_scores["Q3"]
                q4 = quarter_scores["Q4"]
                normalized["H2"] = {
                    "home": q3.get("home", 0) + q4.get("home", 0),
                    "away": q3.get("away", 0) + q4.get("away", 0)
                }
        
        return normalized
    
    def _normalize_quarter_scores(self, quarter_scores: Dict, half_scores: Dict, league: str) -> Dict:
        """
        Normalize quarter scores.
        
        Args:
            quarter_scores: Existing quarter scores
            half_scores: Half scores (can't derive quarters from halves, but we validate)
            league: League code
            
        Returns:
            Normalized quarter scores dictionary
        """
        # Quarter scores must be provided by API - we can't derive them from halves
        # Just ensure structure is consistent
        if not quarter_scores:
            return {}
        
        normalized = {}
        for q in ["Q1", "Q2", "Q3", "Q4"]:
            if q in quarter_scores:
                q_data = quarter_scores[q]
                normalized[q] = {
                    "home": int(q_data.get("home", 0)),
                    "away": int(q_data.get("away", 0))
                }
        
        return normalized
    
    def has_box_scores(self, league: str, game_date: str) -> bool:
        """
        Check if box scores exist for a league and date.
        
        Args:
            league: League code
            game_date: Date in YYYY-MM-DD format
            
        Returns:
            True if box scores exist, False otherwise
        """
        file_path = self.get_file_path(league, game_date)
        return file_path.exists()
    
    def get_cached_dates(self, league: str) -> List[str]:
        """
        Get list of dates for which box scores are cached.
        
        Args:
            league: League code
            
        Returns:
            List of dates in YYYY-MM-DD format
        """
        league_dir = self.cache_dir / league
        if not league_dir.exists():
            return []
        
        dates = []
        for file_path in league_dir.glob("*.json"):
            if file_path.stem != "historical_":
                try:
                    # Validate date format
                    datetime.strptime(file_path.stem, "%Y-%m-%d")
                    dates.append(file_path.stem)
                except ValueError:
                    continue
        
        return sorted(dates)
    
    def merge_box_scores(self, league: str, game_date: str, new_scores: List[Dict]):
        """
        Merge new box scores with existing cached scores.
        
        Args:
            league: League code
            game_date: Date in YYYY-MM-DD format
            new_scores: New box scores to merge
        """
        existing = self.load_box_scores(league, game_date)
        
        # Create lookup by game_id
        existing_dict = {str(score.get("game_id", "")): score for score in existing}
        
        # Merge new scores
        for new_score in new_scores:
            game_id = str(new_score.get("game_id", ""))
            if game_id in existing_dict:
                # Update existing
                normalized = self._normalize_box_score(new_score, league)
                existing_dict[game_id].update(normalized)
            else:
                # Add new
                normalized = self._normalize_box_score(new_score, league)
                existing_dict[game_id] = normalized
        
        # Store merged results
        self.store_box_scores(league, game_date, list(existing_dict.values()))
