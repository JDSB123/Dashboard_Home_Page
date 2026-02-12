"""
BetsAPI Client Module
Client for BetsAPI v1/v2 endpoints – used for NFL and NCAAF box scores
(replacing SportsDataIO which required a subscription key).

API docs: https://betsapi.com/docs/
Auth: token= query parameter
"""

import os
import time
from datetime import datetime
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

# BetsAPI sport IDs
SPORT_AMERICAN_FOOTBALL = 12
SPORT_BASKETBALL = 18

# BetsAPI league IDs (cc values)
# These match the BetsAPI competition/country codes
LEAGUE_NFL = "us"  # United States – NFL
LEAGUE_NCAAF = "us"  # United States – NCAAF (college)

# Known BetsAPI league_id values (from /v3/events/upcoming?sport_id=12)
# NFL events have league.id values; we'll filter by name patterns
NFL_LEAGUE_NAMES = {"NFL", "NFL Preseason", "NFL Playoffs", "Super Bowl"}
NCAAF_LEAGUE_NAMES = {
    "NCAA",
    "NCAAF",
    "NCAA Division I FBS",
    "NCAA Division I",
    "College Football",
    "NCAA Football",
    "FBS",
}


class BetsAPIClient:
    """Client for BetsAPI v1/v2 REST endpoints – football scores & odds."""

    BASE_URL = "https://api.betsapi.com"

    def __init__(self, token: Optional[str] = None):
        """
        Initialise BetsAPI client.

        Args:
            token: BetsAPI access token. Falls back to BETSAPI_TOKEN env var.
        """
        self.token = token or os.getenv("BETSAPI_TOKEN")
        if not self.token:
            raise ValueError(
                "BetsAPI token not provided. Set BETSAPI_TOKEN env var "
                "or pass token= explicitly."
            )

        self.session = requests.Session()
        # BetsAPI uses query-param auth, not headers
        self.session.params = {"token": self.token}
        self._request_delay = 1.0  # seconds between requests (rate-limit)
        self._last_request_time: float = 0

    # ------------------------------------------------------------------
    # Core helpers
    # ------------------------------------------------------------------

    def _throttle(self):
        """Enforce minimum delay between API calls."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self._request_delay:
            time.sleep(self._request_delay - elapsed)
        self._last_request_time = time.time()

    def _get(self, path: str, params: Optional[Dict] = None) -> Dict:
        """
        Issue a throttled GET request and return the JSON body.

        Raises:
            requests.HTTPError on non-2xx responses.
        """
        self._throttle()
        url = f"{self.BASE_URL}{path}"
        resp = self.session.get(url, params=params or {}, timeout=15)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Ended events (scores) – v2
    # ------------------------------------------------------------------

    def get_ended_events(
        self,
        sport_id: int,
        day: str,
        page: int = 1,
        league_id: Optional[int] = None,
    ) -> Dict:
        """
        Fetch ended (completed) events for a sport on a given day.

        GET /v2/events/ended

        Args:
            sport_id: BetsAPI sport id (12 = American Football, 18 = Basketball)
            day: YYYYMMDD string
            page: Pagination page (50 per page)
            league_id: Optional BetsAPI league_id to filter

        Returns:
            Raw API JSON dict with 'results' list and 'pager' info.
        """
        params: Dict = {
            "sport_id": sport_id,
            "day": day,
            "page": page,
        }
        if league_id:
            params["league_id"] = league_id

        return self._get("/v2/events/ended", params)

    def get_all_ended_events(
        self,
        sport_id: int,
        day: str,
        league_id: Optional[int] = None,
    ) -> List[Dict]:
        """
        Paginate through ALL ended events for a sport+day.

        Returns:
            Combined list of event dicts across all pages.
        """
        all_events: List[Dict] = []
        page = 1
        while True:
            data = self.get_ended_events(sport_id, day, page=page, league_id=league_id)
            results = data.get("results", [])
            all_events.extend(results)

            pager = data.get("pager", {})
            total_pages = int(pager.get("total", 1))
            if page >= total_pages:
                break
            page += 1

        return all_events

    # ------------------------------------------------------------------
    # Event detail – v1
    # ------------------------------------------------------------------

    def get_event_view(self, event_id: int) -> Dict:
        """
        Fetch detailed view of a single event (scores, timer, etc.).

        GET /v1/event/view

        Args:
            event_id: BetsAPI event ID

        Returns:
            Raw JSON dict with 'results' containing scores.
        """
        return self._get("/v1/event/view", {"event_id": event_id})

    # ------------------------------------------------------------------
    # Odds – v1
    # ------------------------------------------------------------------

    def get_event_odds(
        self,
        event_id: int,
        source: Optional[int] = None,
        since_time: Optional[int] = None,
    ) -> Dict:
        """
        Fetch pre-match & live odds for an event.

        GET /v1/event/odds

        Args:
            event_id: BetsAPI event ID
            source: Odds source id (e.g. bet365, Pinnacle). None = all
            since_time: Unix timestamp. Only return odds updated after this.

        Returns:
            Raw JSON odds dict.
        """
        params: Dict = {"event_id": event_id}
        if source is not None:
            params["source"] = source
        if since_time is not None:
            params["since_time"] = since_time
        return self._get("/v1/event/odds", params)

    def get_event_odds_summary(self, event_id: int) -> Dict:
        """
        Fetch odds summary (opening, closing) for an event.

        GET /v1/event/odds/summary
        """
        return self._get("/v1/event/odds/summary", {"event_id": event_id})

    # ------------------------------------------------------------------
    # Helpers for football box scores
    # ------------------------------------------------------------------

    def _classify_football_event(self, event: Dict) -> Optional[str]:
        """
        Classify a BetsAPI American-football event into NFL or NCAAF.

        Uses the league.name field. Returns 'NFL', 'NCAAF', or None.
        """
        league = event.get("league", {})
        league_name = (league.get("name") or "").strip()

        # Check NFL
        if any(n.lower() in league_name.lower() for n in NFL_LEAGUE_NAMES):
            return "NFL"
        # Check NCAAF
        if any(n.lower() in league_name.lower() for n in NCAAF_LEAGUE_NAMES):
            return "NCAAF"
        return None

    def _parse_football_scores(self, event: Dict) -> Dict:
        """
        Extract quarter & half scores from a BetsAPI event dict.

        BetsAPI stores scores as:
          ss  = "home-away" total score string
          scores = {"1": {"home":"7","away":"3"}, "2": {...}, ...}
                   where keys 1-4 are quarters, 5+ = OT
        """
        scores_raw = event.get("scores", {})
        ss = event.get("ss", "")

        # Parse total score from ss
        home_score = None
        away_score = None
        if ss and "-" in str(ss):
            parts = str(ss).split("-")
            try:
                home_score = int(parts[0].strip())
                away_score = int(parts[1].strip())
            except (ValueError, IndexError):
                pass

        # Parse quarter scores
        quarter_scores: Dict = {}
        for q_num in range(1, 5):
            q_key = str(q_num)
            if q_key in scores_raw:
                q_data = scores_raw[q_key]
                try:
                    q_home = int(q_data.get("home", 0))
                    q_away = int(q_data.get("away", 0))
                    quarter_scores[f"Q{q_num}"] = {"home": q_home, "away": q_away}
                except (ValueError, TypeError):
                    pass

        # Overtime
        if "5" in scores_raw:
            try:
                ot_data = scores_raw["5"]
                ot_home = int(ot_data.get("home", 0))
                ot_away = int(ot_data.get("away", 0))
                if ot_home > 0 or ot_away > 0:
                    quarter_scores["OT"] = {"home": ot_home, "away": ot_away}
            except (ValueError, TypeError):
                pass

        # Derive half scores from quarters
        half_scores: Dict = {}
        if "Q1" in quarter_scores and "Q2" in quarter_scores:
            half_scores["H1"] = {
                "home": quarter_scores["Q1"]["home"] + quarter_scores["Q2"]["home"],
                "away": quarter_scores["Q1"]["away"] + quarter_scores["Q2"]["away"],
            }
        if "Q3" in quarter_scores and "Q4" in quarter_scores:
            half_scores["H2"] = {
                "home": quarter_scores["Q3"]["home"] + quarter_scores["Q4"]["home"],
                "away": quarter_scores["Q3"]["away"] + quarter_scores["Q4"]["away"],
            }

        # If no quarter scores but we have the total, still return it
        if home_score is None and quarter_scores:
            home_score = sum(q["home"] for q in quarter_scores.values())
            away_score = sum(q["away"] for q in quarter_scores.values())

        return {
            "home_score": home_score,
            "away_score": away_score,
            "quarter_scores": quarter_scores,
            "half_scores": half_scores,
        }

    def _parse_football_event(self, event: Dict, league: str, game_date: str) -> Dict:
        """
        Parse a single BetsAPI football event into the normalised box-score
        schema that BoxScoreCache expects.
        """
        home = event.get("home", {})
        away = event.get("away", {})
        score_data = self._parse_football_scores(event)

        # Determine status
        time_status = event.get("time_status")
        # BetsAPI time_status: 1=Not started, 2=InPlay, 3=Ended, …
        status = "final" if str(time_status) == "3" else "scheduled"

        return {
            "game_id": event.get("id"),
            "date": game_date,
            "league": league,
            "home_team": home.get("name", ""),
            "away_team": away.get("name", ""),
            "home_team_full": home.get("name", ""),
            "away_team_full": away.get("name", ""),
            "home_score": score_data["home_score"],
            "away_score": score_data["away_score"],
            "status": status,
            "quarter_scores": score_data["quarter_scores"],
            "half_scores": score_data["half_scores"],
            "source": "BetsAPI",
            "betsapi_event_id": event.get("id"),
            "betsapi_league": event.get("league", {}).get("name", ""),
            "fetched_at": datetime.now().isoformat(),
        }

    # ------------------------------------------------------------------
    # High-level fetch methods (mirror SportsDataIOClient interface)
    # ------------------------------------------------------------------

    def get_nfl_scores(self, game_date: str) -> List[Dict]:
        """
        Fetch all completed NFL games for a given date.

        Args:
            game_date: YYYY-MM-DD date string

        Returns:
            List of normalised box-score dicts.
        """
        day = game_date.replace("-", "")  # YYYYMMDD
        events = self.get_all_ended_events(SPORT_AMERICAN_FOOTBALL, day)

        scores: List[Dict] = []
        for ev in events:
            league = self._classify_football_event(ev)
            if league == "NFL":
                parsed = self._parse_football_event(ev, "NFL", game_date)
                scores.append(parsed)
        return scores

    def get_ncaaf_scores(self, game_date: str) -> List[Dict]:
        """
        Fetch all completed NCAAF / college-football games for a given date.

        Args:
            game_date: YYYY-MM-DD date string

        Returns:
            List of normalised box-score dicts.
        """
        day = game_date.replace("-", "")
        events = self.get_all_ended_events(SPORT_AMERICAN_FOOTBALL, day)

        scores: List[Dict] = []
        for ev in events:
            league = self._classify_football_event(ev)
            if league == "NCAAF":
                parsed = self._parse_football_event(ev, "NCAAF", game_date)
                scores.append(parsed)
        return scores

    def get_nfl_box_score(self, event_id: int) -> Optional[Dict]:
        """
        Fetch detailed score data for a single NFL event.

        If the ended-events response already has quarter scores, this is
        usually unnecessary. Use it when you need detailed/live data.
        """
        data = self.get_event_view(event_id)
        results = data.get("results", [])
        if not results:
            return None

        ev = results[0] if isinstance(results, list) else results
        return self._parse_football_scores(ev)

    def get_ncaaf_box_score(self, event_id: int) -> Optional[Dict]:
        """Alias of get_nfl_box_score – same BetsAPI structure."""
        return self.get_nfl_box_score(event_id)

    # ------------------------------------------------------------------
    # Odds helpers
    # ------------------------------------------------------------------

    def get_nfl_odds(self, event_id: int) -> Dict:
        """Fetch odds summary for an NFL event."""
        return self.get_event_odds_summary(event_id)

    def get_ncaaf_odds(self, event_id: int) -> Dict:
        """Fetch odds summary for an NCAAF event."""
        return self.get_event_odds_summary(event_id)

    # ------------------------------------------------------------------
    # Enrichment: fetch detail for events missing quarter scores
    # ------------------------------------------------------------------

    def enrich_events_with_detail(self, events: List[Dict]) -> List[Dict]:
        """
        For each event that is missing quarter scores, call event/view
        to fill in the detail.

        Args:
            events: List of parsed box-score dicts (must have betsapi_event_id)

        Returns:
            The same list, mutated in-place with enriched quarter data.
        """
        for ev in events:
            if not ev.get("quarter_scores"):
                eid = ev.get("betsapi_event_id")
                if eid:
                    detail = self.get_nfl_box_score(eid)
                    if detail:
                        ev["quarter_scores"] = detail.get("quarter_scores", {})
                        ev["half_scores"] = detail.get("half_scores", {})
                        if detail.get("home_score") is not None:
                            ev["home_score"] = detail["home_score"]
                            ev["away_score"] = detail["away_score"]
        return events
