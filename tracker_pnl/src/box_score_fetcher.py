"""
Box Score Fetcher Module
Fetches box scores from APIs and stores them with proper segment data.
"""

import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from dotenv import load_dotenv

from .api_clients import SportsDataIOClient, APIBasketballClient
from .betsapi_client import BetsAPIClient
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
        self.betsapi_client = None

        # BetsAPI is the preferred client for NFL/NCAAF (date-based, no week required)
        try:
            self.betsapi_client = BetsAPIClient()
        except ValueError:
            print("Warning: BetsAPI token not configured")

        # SportsDataIO kept as fallback for NFL (requires separate subscription)
        try:
            self.sportsdata_client = SportsDataIOClient()
        except ValueError:
            print("Warning: SportsDataIO API key not configured (using BetsAPI for football)")

        try:
            self.basketball_client = APIBasketballClient()
        except ValueError:
            print("Warning: API-Basketball API key not configured")

    def fetch_nfl_box_scores(self, game_date: str, use_cache: bool = True) -> List[Dict]:
        """
        Fetch NFL box scores for a date.

        Prefers BetsAPI (date-based, no week number needed).
        Falls back to SportsDataIO if BetsAPI is unavailable.

        Args:
            game_date: Date in YYYY-MM-DD format
            use_cache: If True, use cached data if available

        Returns:
            List of box score dictionaries
        """
        # Check cache first
        if use_cache and self.cache.has_box_scores("NFL", game_date):
            return self.cache.load_box_scores("NFL", game_date)

        # --- BetsAPI path (preferred) ---
        if self.betsapi_client:
            try:
                scores = self.betsapi_client.get_nfl_scores(game_date)
                if scores:
                    # Enrich events missing quarter data
                    scores = self.betsapi_client.enrich_events_with_detail(scores)
                    self.cache.store_box_scores("NFL", game_date, scores)
                    return scores
                # No games on this date – cache empty list to avoid re-fetching
                self.cache.store_box_scores("NFL", game_date, [])
                return []
            except Exception as e:
                print(f"BetsAPI error for NFL {game_date}: {e}")

        # --- SportsDataIO fallback ---
        if self.sportsdata_client:
            try:
                scores = self.sportsdata_client.get_nfl_scores(game_date)
                box_scores = []
                for score in scores:
                    game_id = score.get("game_id")
                    if game_id and score.get("status") == "final":
                        detailed = self.sportsdata_client.get_nfl_box_score(game_id)
                        if detailed:
                            score.update(detailed)
                    box_scores.append(score)
                if box_scores:
                    self.cache.store_box_scores("NFL", game_date, box_scores)
                return box_scores
            except Exception as e:
                print(f"SportsDataIO error for NFL {game_date}: {e}")

        print("No API client available for NFL")
        return []

    def fetch_ncaaf_box_scores(
        self,
        game_date: str,
        season: Optional[int] = None,
        week: Optional[int] = None,
        use_cache: bool = True,
    ) -> List[Dict]:
        """
        Fetch NCAAF box scores for a date.

        Prefers BetsAPI (date-based query – no week number needed!).
        Falls back to SportsDataIO if BetsAPI unavailable (requires week).

        Args:
            game_date: Date in YYYY-MM-DD format
            season: Season year (optional, for SportsDataIO fallback)
            week: Week number (optional, for SportsDataIO fallback)
            use_cache: If True, use cached data if available

        Returns:
            List of box score dictionaries
        """
        # Check cache first
        if use_cache and self.cache.has_box_scores("NCAAF", game_date):
            return self.cache.load_box_scores("NCAAF", game_date)

        # --- BetsAPI path (preferred – date-based, no week needed) ---
        if self.betsapi_client:
            try:
                scores = self.betsapi_client.get_ncaaf_scores(game_date)
                if scores:
                    scores = self.betsapi_client.enrich_events_with_detail(scores)
                    self.cache.store_box_scores("NCAAF", game_date, scores)
                    return scores
                self.cache.store_box_scores("NCAAF", game_date, [])
                return []
            except Exception as e:
                print(f"BetsAPI error for NCAAF {game_date}: {e}")

        # --- SportsDataIO fallback (requires week number) ---
        if self.sportsdata_client:
            if not season:
                season = int(game_date[:4])
            if not week:
                print(f"Warning: Week number required for SportsDataIO NCAAF. Skipping {game_date}")
                return []
            try:
                scores = self.sportsdata_client.get_ncaaf_scores(season, week)
                filtered = [s for s in scores if s.get("date", "").startswith(game_date)]
                if filtered:
                    self.cache.store_box_scores("NCAAF", game_date, filtered)
                return filtered
            except Exception as e:
                print(f"SportsDataIO error for NCAAF {game_date}: {e}")

        print("No API client available for NCAAF")
        return []

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

        # NCAAF (now supported via BetsAPI – no week number needed)
        print("  Fetching NCAAF...")
        ncaaf_scores = self.fetch_ncaaf_box_scores(game_date, use_cache=use_cache)
        results["NCAAF"] = ncaaf_scores
        print(f"    Found {len(ncaaf_scores)} games")

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

    def fetch_date_range(
        self,
        start_date: str,
        end_date: str,
        leagues: Optional[List[str]] = None,
        use_cache: bool = True,
    ):
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
                        self.fetch_ncaaf_box_scores(game_date, use_cache=use_cache)
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
