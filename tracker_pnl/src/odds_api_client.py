"""
The Odds API Client Module
Client for The Odds API v4 – pre-match & live odds for all 4 sports.

API docs: https://the-odds-api.com/liveapi/guides/v4/
Auth: apiKey= query parameter
Rate limits tracked via response headers: x-requests-used, x-requests-remaining
"""

import logging
import os
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

import requests
from dotenv import load_dotenv

load_dotenv()

# The Odds API sport keys
SPORT_KEYS = {
    "NFL": "americanfootball_nfl",
    "NCAAF": "americanfootball_ncaaf",
    "NBA": "basketball_nba",
    "NCAAM": "basketball_ncaab",  # Note: NCAAB in Odds API = our NCAAM
}

# Market keys
MARKET_SPREADS = "spreads"
MARKET_TOTALS = "totals"
MARKET_H2H = "h2h"  # moneyline
MARKET_OUTRIGHTS = "outrights"

# Regions
REGION_US = "us"
REGION_US2 = "us2"
REGION_EU = "eu"
REGION_UK = "uk"


class OddsAPIClient:
    """Client for The Odds API v4."""

    BASE_URL = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialise the client.

        Args:
            api_key: API key. Falls back to ODDS_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("ODDS_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Odds API key not provided. Set ODDS_API_KEY env var "
                "or pass api_key= explicitly."
            )

        self.session = requests.Session()
        self._request_delay = 0.5
        self._last_request_time: float = 0

        # Track quota from response headers
        self.requests_used: Optional[int] = None
        self.requests_remaining: Optional[int] = None

    # ------------------------------------------------------------------
    # Core helpers
    # ------------------------------------------------------------------

    def _throttle(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self._request_delay:
            time.sleep(self._request_delay - elapsed)
        self._last_request_time = time.time()

    def _get(self, path: str, params: Optional[Dict] = None) -> Tuple[Dict | List, Dict]:
        """
        Issue a throttled GET. Returns (json_body, response_headers).

        The caller can inspect headers for quota tracking.
        """
        self._throttle()
        url = f"{self.BASE_URL}{path}"
        all_params = {"apiKey": self.api_key}
        if params:
            all_params.update(params)

        resp = self.session.get(url, params=all_params, timeout=15)
        resp.raise_for_status()

        # Track quota
        used = resp.headers.get("x-requests-used")
        remaining = resp.headers.get("x-requests-remaining")
        if used is not None:
            self.requests_used = int(used)
        if remaining is not None:
            self.requests_remaining = int(remaining)

        return resp.json(), dict(resp.headers)

    # ------------------------------------------------------------------
    # Sports
    # ------------------------------------------------------------------

    def get_sports(self, all_sports: bool = False) -> List[Dict]:
        """
        List available sports.

        GET /v4/sports

        Args:
            all_sports: If True include out-of-season sports.

        Returns:
            List of sport dicts with keys: key, group, title, active, …
        """
        params = {}
        if all_sports:
            params["all"] = "true"
        data, _ = self._get("/sports", params)
        return data

    # ------------------------------------------------------------------
    # Odds
    # ------------------------------------------------------------------

    def get_odds(
        self,
        sport_key: str,
        regions: str = REGION_US,
        markets: str = MARKET_SPREADS,
        odds_format: str = "american",
        event_ids: Optional[List[str]] = None,
        bookmakers: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        Get current odds for a sport.

        GET /v4/sports/{sport}/odds

        Args:
            sport_key: e.g. "americanfootball_nfl"
            regions: Comma-separated regions (us, us2, eu, uk)
            markets: Comma-separated markets (spreads, totals, h2h)
            odds_format: "american" or "decimal"
            event_ids: Optional list of specific event ids
            bookmakers: Optional list of bookmaker keys to filter

        Returns:
            List of event dicts with nested bookmaker odds.
        """
        params: Dict = {
            "regions": regions,
            "markets": markets,
            "oddsFormat": odds_format,
        }
        if event_ids:
            params["eventIds"] = ",".join(event_ids)
        if bookmakers:
            params["bookmakers"] = ",".join(bookmakers)

        data, _ = self._get(f"/sports/{sport_key}/odds", params)
        return data

    def get_odds_for_league(
        self,
        league: str,
        markets: str = "spreads,totals,h2h",
        regions: str = REGION_US,
    ) -> List[Dict]:
        """
        Convenience: fetch odds by our internal league code (NFL, NCAAF, NBA, NCAAM).
        """
        sport_key = SPORT_KEYS.get(league)
        if not sport_key:
            raise ValueError(f"Unknown league '{league}'. Valid: {list(SPORT_KEYS.keys())}")
        return self.get_odds(sport_key, regions=regions, markets=markets)

    # ------------------------------------------------------------------
    # Scores
    # ------------------------------------------------------------------

    def get_scores(
        self,
        sport_key: str,
        days_from: Optional[int] = None,
        date_format: str = "iso",
    ) -> List[Dict]:
        """
        Get scores for recently completed & upcoming events.

        GET /v4/sports/{sport}/scores

        NOTE: Only returns events from roughly the last 3 days. For older
        data use the historical endpoint or BetsAPI.

        Args:
            sport_key: e.g. "americanfootball_nfl"
            days_from: Number of days back (max ~3)
            date_format: "iso" or "unix"

        Returns:
            List of event score dicts.
        """
        params: Dict = {"dateFormat": date_format}
        if days_from is not None:
            params["daysFrom"] = days_from

        data, _ = self._get(f"/sports/{sport_key}/scores", params)
        return data

    # ------------------------------------------------------------------
    # Events (no odds)
    # ------------------------------------------------------------------

    def get_events(self, sport_key: str, date_format: str = "iso") -> List[Dict]:
        """
        Get upcoming & recently completed events.

        GET /v4/sports/{sport}/events
        """
        data, _ = self._get(
            f"/sports/{sport_key}/events",
            {"dateFormat": date_format},
        )
        return data

    # ------------------------------------------------------------------
    # Historical odds (costs 10 credits per region per market call)
    # ------------------------------------------------------------------

    def get_historical_odds(
        self,
        sport_key: str,
        date: str,
        regions: str = REGION_US,
        markets: str = MARKET_SPREADS,
        odds_format: str = "american",
    ) -> Dict:
        """
        Get historical odds snapshot for a past date.

        GET /v4/historical/sports/{sport}/odds

        ⚠️  Each call costs 10 credits per region per market.

        Args:
            sport_key: e.g. "americanfootball_nfl"
            date: ISO-8601 date string e.g. "2026-01-15T12:00:00Z"
            regions: Comma-separated regions
            markets: Comma-separated markets
            odds_format: "american" or "decimal"

        Returns:
            Dict with 'data' (list of events) and 'timestamp'.
        """
        params: Dict = {
            "date": date,
            "regions": regions,
            "markets": markets,
            "oddsFormat": odds_format,
        }
        data, _ = self._get(f"/historical/sports/{sport_key}/odds", params)
        return data

    def get_historical_events(self, sport_key: str, date: str) -> Dict:
        """
        Get historical events for a date.

        GET /v4/historical/sports/{sport}/events

        Args:
            sport_key: e.g. "americanfootball_nfl"
            date: ISO-8601 date string

        Returns:
            Dict with 'data' (list of events) and 'timestamp'.
        """
        data, _ = self._get(
            f"/historical/sports/{sport_key}/events",
            {"date": date},
        )
        return data

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def parse_odds_event(event: Dict) -> Dict:
        """
        Parse an Odds API event into a flat dict for analysis.

        Returns a dict with keys like:
            commence_time, home_team, away_team,
            best_spread_home, best_spread_away,
            best_total_over, best_total_under,
            best_ml_home, best_ml_away
        """
        parsed = {
            "event_id": event.get("id"),
            "sport_key": event.get("sport_key"),
            "commence_time": event.get("commence_time"),
            "home_team": event.get("home_team"),
            "away_team": event.get("away_team"),
        }

        # Collect best odds across bookmakers
        best_spread_home = None
        best_spread_away = None
        best_total_over = None
        best_total_under = None
        best_ml_home = None
        best_ml_away = None

        for bookie in event.get("bookmakers", []):
            for market in bookie.get("markets", []):
                key = market.get("key")
                outcomes = market.get("outcomes", [])

                if key == "spreads":
                    for o in outcomes:
                        name = o.get("name")
                        price = o.get("price")
                        point = o.get("point")
                        if name == event.get("home_team"):
                            if best_spread_home is None or price > best_spread_home.get(
                                "price", -9999
                            ):
                                best_spread_home = {
                                    "price": price,
                                    "point": point,
                                    "book": bookie["key"],
                                }
                        else:
                            if best_spread_away is None or price > best_spread_away.get(
                                "price", -9999
                            ):
                                best_spread_away = {
                                    "price": price,
                                    "point": point,
                                    "book": bookie["key"],
                                }

                elif key == "totals":
                    for o in outcomes:
                        name = o.get("name")  # Over / Under
                        price = o.get("price")
                        point = o.get("point")
                        if name == "Over":
                            if best_total_over is None or price > best_total_over.get(
                                "price", -9999
                            ):
                                best_total_over = {
                                    "price": price,
                                    "point": point,
                                    "book": bookie["key"],
                                }
                        elif name == "Under":
                            if best_total_under is None or price > best_total_under.get(
                                "price", -9999
                            ):
                                best_total_under = {
                                    "price": price,
                                    "point": point,
                                    "book": bookie["key"],
                                }

                elif key == "h2h":
                    for o in outcomes:
                        name = o.get("name")
                        price = o.get("price")
                        if name == event.get("home_team"):
                            if best_ml_home is None or price > best_ml_home.get("price", -9999):
                                best_ml_home = {"price": price, "book": bookie["key"]}
                        else:
                            if best_ml_away is None or price > best_ml_away.get("price", -9999):
                                best_ml_away = {"price": price, "book": bookie["key"]}

        parsed["best_spread_home"] = best_spread_home
        parsed["best_spread_away"] = best_spread_away
        parsed["best_total_over"] = best_total_over
        parsed["best_total_under"] = best_total_under
        parsed["best_ml_home"] = best_ml_home
        parsed["best_ml_away"] = best_ml_away

        return parsed

    # ------------------------------------------------------------------
    # Quota helpers
    # ------------------------------------------------------------------

    def get_quota_status(self) -> Dict:
        """Return last-known quota usage from response headers."""
        return {
            "requests_used": self.requests_used,
            "requests_remaining": self.requests_remaining,
        }

    def print_quota(self):
        """Print a human-readable quota summary."""
        if self.requests_used is not None:
            total = (self.requests_used or 0) + (self.requests_remaining or 0)
            logger.info(
                f"Odds API quota: {self.requests_used}/{total} used, "
                f"{self.requests_remaining} remaining"
            )
        else:
            logger.info("Odds API quota: unknown (make a request first)")
