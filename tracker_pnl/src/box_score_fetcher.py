"""
Box Score Fetcher Module
Fetches box scores from APIs and stores them with proper segment data.
"""

import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from dotenv import load_dotenv

from .api_clients import SportsDataIOClient, APIBasketballClient
from .box_score_cache import BoxScoreCache


class BoxScoreFetcher:
    """Fetches and caches box scores from various APIs."""
    
    def __init__(self, cache_dir: str = "box_scores"):
        """
        Initialize box score fetcher.
        
        Args:
            cache_dir: Directory to cache box scores
        """
        load_dotenv()
        self.cache = BoxScoreCache(cache_dir)
        self.sportsdata_client = None
        self.basketball_client = None
        
        # Initialize API clients if keys are available
        try:
            self.sportsdata_client = SportsDataIOClient()
        except ValueError:
            print("Warning: SportsDataIO API key not configured")
        
        try:
            self.basketball_client = APIBasketballClient()
        except ValueError:
            print("Warning: API-Basketball API key not configured")
    
    def fetch_nfl_box_scores(self, game_date: str, use_cache: bool = True) -> List[Dict]:
        """
        Fetch NFL box scores for a date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            use_cache: If True, use cached data if available
            
        Returns:
            List of box score dictionaries
        """
        # Check cache first
        if use_cache and self.cache.has_box_scores("NFL", game_date):
            return self.cache.load_box_scores("NFL", game_date)
        
        if not self.sportsdata_client:
            print("SportsDataIO client not available for NFL")
            return []
        
        # Fetch scores
        scores = self.sportsdata_client.get_nfl_scores(game_date)
        
        # Fetch detailed box scores with quarter data
        box_scores = []
        for score in scores:
            game_id = score.get("game_id")
            if game_id and score.get("status") == "final":
                # Fetch detailed box score
                detailed = self.sportsdata_client.get_nfl_box_score(game_id)
                if detailed:
                    score.update(detailed)
            box_scores.append(score)
        
        # Cache results
        if box_scores:
            self.cache.store_box_scores("NFL", game_date, box_scores)
        
        return box_scores
    
    def fetch_ncaaf_box_scores(self, game_date: str, season: Optional[int] = None,
                               week: Optional[int] = None, use_cache: bool = True) -> List[Dict]:
        """
        Fetch NCAAF box scores for a date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            season: Season year (optional, defaults to year from date)
            week: Week number (optional, required if fetching)
            use_cache: If True, use cached data if available
            
        Returns:
            List of box score dictionaries
        """
        # Check cache first
        if use_cache and self.cache.has_box_scores("NCAAF", game_date):
            return self.cache.load_box_scores("NCAAF", game_date)
        
        if not self.sportsdata_client:
            print("SportsDataIO client not available for NCAAF")
            return []
        
        # Determine season and week if not provided
        if not season:
            season = int(game_date[:4])
        
        # Note: SportsDataIO requires week number, which is complex to determine from date
        # For now, we'll need week to be provided or implement week calculation
        if not week:
            print(f"Warning: Week number required for NCAAF. Skipping {game_date}")
            return []
        
        # Fetch scores
        scores = self.sportsdata_client.get_ncaaf_scores(season, week)
        
        # Filter by date
        filtered = [s for s in scores if s.get("date", "").startswith(game_date)]
        
        # Cache results
        if filtered:
            self.cache.store_box_scores("NCAAF", game_date, filtered)
        
        return filtered
    
    def fetch_nba_box_scores(self, game_date: str, use_cache: bool = True) -> List[Dict]:
        """
        Fetch NBA box scores for a date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            use_cache: If True, use cached data if available
            
        Returns:
            List of box score dictionaries
        """
        # Check cache first
        if use_cache and self.cache.has_box_scores("NBA", game_date):
            return self.cache.load_box_scores("NBA", game_date)
        
        if not self.basketball_client:
            print("API-Basketball client not available for NBA")
            return []
        
        # Fetch games
        games = self.basketball_client.get_nba_games(game_date)
        
        # Fetch detailed box scores with quarter/half data
        box_scores = []
        for game in games:
            game_id = game.get("game_id")
            if game_id and game.get("status") == "final":
                # Fetch detailed box score
                detailed = self.basketball_client.get_nba_box_score(game_id)
                if detailed:
                    game.update(detailed)
            box_scores.append(game)
        
        # Cache results
        if box_scores:
            self.cache.store_box_scores("NBA", game_date, box_scores)
        
        return box_scores
    
    def fetch_ncaam_box_scores(self, game_date: str, use_cache: bool = True) -> List[Dict]:
        """
        Fetch NCAAM box scores for a date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            use_cache: If True, use cached data if available
            
        Returns:
            List of box score dictionaries
        """
        # Check cache first
        if use_cache and self.cache.has_box_scores("NCAAM", game_date):
            return self.cache.load_box_scores("NCAAM", game_date)
        
        if not self.basketball_client:
            print("API-Basketball client not available for NCAAM")
            return []
        
        # Fetch games
        games = self.basketball_client.get_ncaam_games(game_date)
        
        # Cache results
        if games:
            self.cache.store_box_scores("NCAAM", game_date, games)
        
        return games
    
    def fetch_all_leagues(self, game_date: str, use_cache: bool = True) -> Dict[str, List[Dict]]:
        """
        Fetch box scores for all leagues for a date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            use_cache: If True, use cached data if available
            
        Returns:
            Dictionary mapping league to list of box scores
        """
        results = {}
        
        print(f"\nFetching box scores for {game_date}...")
        
        # NFL
        print("  Fetching NFL...")
        nfl_scores = self.fetch_nfl_box_scores(game_date, use_cache)
        results["NFL"] = nfl_scores
        print(f"    Found {len(nfl_scores)} games")
        
        # NCAAF (requires week number - skip for now or implement week lookup)
        # print("  Fetching NCAAF...")
        # ncaaf_scores = self.fetch_ncaaf_box_scores(game_date, use_cache=use_cache)
        # results["NCAAF"] = ncaaf_scores
        
        # NBA
        print("  Fetching NBA...")
        nba_scores = self.fetch_nba_box_scores(game_date, use_cache)
        results["NBA"] = nba_scores
        print(f"    Found {len(nba_scores)} games")
        
        # NCAAM
        print("  Fetching NCAAM...")
        ncaam_scores = self.fetch_ncaam_box_scores(game_date, use_cache)
        results["NCAAM"] = ncaam_scores
        print(f"    Found {len(ncaam_scores)} games")
        
        return results
    
    def fetch_date_range(self, start_date: str, end_date: str, 
                        leagues: Optional[List[str]] = None, use_cache: bool = True):
        """
        Fetch box scores for a date range.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            leagues: List of leagues to fetch (defaults to all)
            use_cache: If True, use cached data if available
        """
        if leagues is None:
            leagues = ["NFL", "NCAAF", "NBA", "NCAAM"]
        
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        current = start
        while current <= end:
            game_date = current.strftime("%Y-%m-%d")
            
            for league in leagues:
                try:
                    if league == "NFL":
                        self.fetch_nfl_box_scores(game_date, use_cache)
                    elif league == "NCAAF":
                        # Skip for now - requires week calculation
                        pass
                    elif league == "NBA":
                        self.fetch_nba_box_scores(game_date, use_cache)
                    elif league == "NCAAM":
                        self.fetch_ncaam_box_scores(game_date, use_cache)
                except Exception as e:
                    print(f"Error fetching {league} for {game_date}: {e}")
            
            current += timedelta(days=1)
            # Rate limiting
            import time
            time.sleep(1)
