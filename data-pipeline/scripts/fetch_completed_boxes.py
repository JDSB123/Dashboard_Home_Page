#!/usr/bin/env python3
"""
Unified Box Score Fetcher - Pulls completed game scores across all sports

Fetches completed box scores from:
- ESPN API: NBA, NCAAM (free, no auth required)
- SportsDataIO: NFL, NCAAF (paid, requires API key)

Daily schedule (recommended): 2 AM (after all previous day games complete)

Usage:
    python fetch_completed_boxes.py
    python fetch_completed_boxes.py --date 2026-01-06
    python fetch_completed_boxes.py --start 2026-01-01 --end 2026-01-06
    python fetch_completed_boxes.py --verbose
    python fetch_completed_boxes.py --telegram

Environment Variables:
    SDIO_KEY: SportsDataIO API key (optional, for NFL/NCAAF)
    TELEGRAM_BOT_TOKEN: Telegram bot token (optional)
    TELEGRAM_CHAT_ID: Telegram chat ID (optional)
"""

import os
import sys
import json
import argparse
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configuration
OUTPUT_DIR = Path(__file__).parent.parent / "output" / "box_scores"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

SPORTS = ["NBA", "NCAAM", "NFL", "NCAAF"]
RETRY_STRATEGY = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
ADAPTER = HTTPAdapter(max_retries=RETRY_STRATEGY)

# Setup logging
LOG_FILE = LOG_DIR / f"box_scores_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class BoxScoreFetcher:
    """Base fetcher class with common functionality"""
    
    def __init__(self, league: str, verbose: bool = False):
        self.league = league
        self.verbose = verbose
        self.session = requests.Session()
        self.session.mount("http://", ADAPTER)
        self.session.mount("https://", ADAPTER)
        self.games_fetched = 0
        self.games_completed = 0
    
    def _log(self, message: str, level: str = "info"):
        """Log with optional verbose output"""
        method = getattr(logger, level.lower(), logger.info)
        method(f"[{self.league}] {message}")
        if self.verbose and level == "debug":
            print(f"  DEBUG: {message}")
    
    def _get_request(self, url: str, params: Dict = None, timeout: int = 30) -> Optional[Dict]:
        """Make GET request with error handling"""
        try:
            response = self.session.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            self._log(f"Timeout fetching {url}", "error")
            return None
        except requests.exceptions.RequestException as e:
            self._log(f"Request error: {str(e)[:100]}", "error")
            return None
        except json.JSONDecodeError:
            self._log(f"Invalid JSON response from {url}", "error")
            return None
    
    def fetch_games(self, date_range: Tuple[str, str]) -> List[Dict]:
        """Fetch games for date range - implement in subclass"""
        raise NotImplementedError
    
    def filter_completed(self, games: List[Dict]) -> List[Dict]:
        """Filter to only completed games"""
        return [g for g in games if g.get("status") == "final"]
    
    def standardize_game(self, game: Dict) -> Dict:
        """Ensure consistent game format"""
        return {
            "game_id": game.get("game_id"),
            "date": game.get("date"),
            "league": self.league,
            "home_team": game.get("home_team"),
            "away_team": game.get("away_team"),
            "home_team_full": game.get("home_team_full"),
            "away_team_full": game.get("away_team_full"),
            "home_score": game.get("home_score"),
            "away_score": game.get("away_score"),
            "status": game.get("status"),
            "half_scores": game.get("half_scores", {}),
            "quarter_scores": game.get("quarter_scores", {}),
            "source": game.get("source", self.league),
            "fetched_at": datetime.utcnow().isoformat()
        }
    
    def save_games(self, games: List[Dict], date: str) -> int:
        """Save games for a single date"""
        if not games:
            self._log(f"No games to save for {date}")
            return 0
        
        league_dir = OUTPUT_DIR / self.league
        league_dir.mkdir(parents=True, exist_ok=True)
        
        sanitized_date = date or "unknown"
        output_file = league_dir / f"{sanitized_date}.json"
        
        standardized = [self.standardize_game(g) for g in games]
        
        try:
            output_file.write_text(json.dumps(standardized, indent=2))
            self._log(f"Saved {len(standardized)} games to {output_file.name}")
            return len(standardized)
        except Exception as e:
            self._log(f"Error saving games: {e}", "error")
            return 0

    def save_historical_snapshot(self, games: List[Dict], start_date: str, end_date: str) -> Optional[Path]:
        """Persist an aggregated snapshot for the requested date span"""
        if not games or not start_date or not end_date:
            self._log("Skipping snapshot save (missing data or date range)", "debug")
            return None

        league_dir = OUTPUT_DIR / self.league
        league_dir.mkdir(parents=True, exist_ok=True)

        start_key = start_date.replace("-", "")
        end_key = end_date.replace("-", "")
        snapshot_path = league_dir / f"historical_{start_key}_to_{end_key}.json"

        standardized = [self.standardize_game(g) for g in games]
        try:
            snapshot_path.write_text(json.dumps(standardized, indent=2))
            self._log(f"Saved snapshot {snapshot_path.name} ({len(standardized)} games)")
            return snapshot_path
        except Exception as e:
            self._log(f"Error saving snapshot: {e}", "error")
            return None


def group_games_by_date(games: List[Dict]) -> Dict[str, List[Dict]]:
    grouped = defaultdict(list)
    for game in games:
        day = game.get("date") or "unknown"
        grouped[day].append(game)
    return grouped


def save_games_by_day(fetcher: BoxScoreFetcher, games: List[Dict]) -> int:
    daily_groups = group_games_by_date(games)
    total_saved = 0
    for date in sorted(daily_groups.keys()):
        total_saved += fetcher.save_games(daily_groups[date], date)
    return total_saved


class ESPNFetcher(BoxScoreFetcher):
    """Fetch games from ESPN API (NBA, NCAAM)"""
    
    BASE_URLS = {
        "NBA": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
        "NCAAM": "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
    }
    
    def fetch_games(self, date_range: Tuple[str, str]) -> List[Dict]:
        """Fetch games for date range from ESPN"""
        start_date = datetime.strptime(date_range[0], "%Y-%m-%d")
        end_date = datetime.strptime(date_range[1], "%Y-%m-%d")
        
        all_games = []
        current = start_date
        
        while current <= end_date:
            date_str = current.strftime("%Y%m%d")
            self._log(f"Fetching {date_str}...")
            
            params = {"dates": date_str}
            if self.league == "NCAAM":
                params.update({"groups": "50", "limit": 300})
            
            data = self._get_request(self.BASE_URLS[self.league], params=params)
            
            if data:
                games = self._parse_espn_response(data, current.strftime("%Y-%m-%d"))
                all_games.extend(games)
                self._log(f"Found {len(games)} games")
                self.games_fetched += len(games)
            else:
                self._log(f"No data for {date_str}", "warn")
            
            current += timedelta(days=1)
        
        return all_games
    
    def _parse_espn_response(self, data: Dict, date: str) -> List[Dict]:
        """Parse ESPN response into standardized format"""
        games = []
        
        for event in data.get("events", []):
            try:
                game = self._parse_espn_game(event, date)
                if game:
                    games.append(game)
            except Exception as e:
                self._log(f"Error parsing game: {str(e)[:100]}", "debug")
                continue
        
        return games
    
    def _parse_espn_game(self, event: Dict, date: str) -> Optional[Dict]:
        """Parse single ESPN game event"""
        competition = event.get("competitions", [{}])[0]
        competitors = competition.get("competitors", [])
        
        if len(competitors) != 2:
            return None
        
        # Get home and away teams
        home_team = None
        away_team = None
        home_score = None
        away_score = None
        
        for comp in competitors:
            team = comp.get("team", {})
            score = comp.get("score")
            
            team_name = team.get("abbreviation") or team.get("shortDisplayName") or team.get("displayName")
            score_val = int(score) if score and str(score).isdigit() else None
            
            # Extract periods/linescores
            # JSON format: "linescores": [{"value": 24}, {"value": 31}, ...]
            periods = []
            ls_data = comp.get("linescores", [])
            if ls_data:
                for p in ls_data:
                    val = p.get("value")
                    periods.append(int(val) if val is not None else 0)

            if comp.get("homeAway") == "home":
                home_team = team_name
                home_score = score_val
                home_periods = periods
            else:
                away_team = team_name
                away_score = score_val
                away_periods = periods
        
        if not home_team or not away_team:
            return None
            
        # Structure period scores
        # mapped as Q1, Q2 etc.
        quarter_scores = {}
        for i, (h_p, a_p) in enumerate(zip(home_periods, away_periods)):
            quarter_scores[f"Q{i+1}"] = {"home": h_p, "away": a_p}
        
        # Parse status
        status_obj = event.get("status", {})
        status_type = status_obj.get("type", {}).get("name", "")
        
        if status_type == "STATUS_FINAL":
            status = "final"
        elif status_type == "STATUS_IN_PROGRESS":
            status = "in_progress"
        else:
            status = "scheduled"
        
        # Get half/quarter scores
        half_scores = {}
        for comp in competitors:
            linescores = comp.get("linescores", [])
            is_home = comp.get("homeAway") == "home"
            
            for i, period in enumerate(linescores, 1):
                period_key = f"H{i}" if i <= 2 else f"OT{i-2}"
                if period_key not in half_scores:
                    half_scores[period_key] = {"home": 0, "away": 0}
                
                score_val = period.get("value", 0)
                if is_home:
                    half_scores[period_key]["home"] = int(score_val) if score_val else 0
                else:
                    half_scores[period_key]["away"] = int(score_val) if score_val else 0
        
        return {
            "game_id": event.get("id"),
            "date": date,
            "home_team": home_team,
            "away_team": away_team,
            "home_team_full": competitors[0].get("team", {}).get("displayName"),
            "away_team_full": competitors[1].get("team", {}).get("displayName"),
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "half_scores": half_scores,
            "period_scores": quarter_scores,
            "source": self.league
        }


class SportsDataIOFetcher(BoxScoreFetcher):
    """Fetch games from SportsDataIO (NFL, NCAAF)"""
    
    BASE_URL = "https://api.sportsdata.io/v3"
    
    def __init__(self, league: str, api_key: str = None, verbose: bool = False):
        super().__init__(league, verbose)
        self.api_key = api_key or os.environ.get("SDIO_KEY")
        
        if not self.api_key:
            self._log(f"No API key found. Set SDIO_KEY environment variable.", "warn")
    
    def fetch_games(self, date_range: Tuple[str, str]) -> List[Dict]:
        """Fetch games for date range from SportsDataIO"""
        if not self.api_key:
            self._log("Cannot fetch: API key not configured", "error")
            return []
        
        if self.league == "NFL":
            return self._fetch_nfl_games(date_range)
        elif self.league == "NCAAF":
            return self._fetch_ncaaf_games(date_range)
        
        return []
    
    def _fetch_nfl_games(self, date_range: Tuple[str, str]) -> List[Dict]:
        """Fetch NFL games by week"""
        all_games = []
        
        # Get season from date
        start_date = datetime.strptime(date_range[0], "%Y-%m-%d")
        season = start_date.year if start_date.month >= 9 else start_date.year - 1
        
        # Fetch all weeks (1-23 covers full season + playoffs)
        for week in range(1, 23):
            endpoint = f"{self.BASE_URL}/nfl/scores/json/ScoresByWeek/{season}/{week}"
            self._log(f"Fetching week {week}...")
            
            data = self._get_request(endpoint, params={"key": self.api_key})
            
            if data:
                games = self._parse_sdio_games(data, "NFL")
                
                # Filter to date range
                filtered = [g for g in games 
                           if date_range[0] <= g.get("date", "") <= date_range[1]]
                all_games.extend(filtered)
                
                self.games_fetched += len(filtered)
                if filtered:
                    self._log(f"Found {len(filtered)} games in week {week}")
            elif isinstance(data, dict) and "error" not in str(data):
                # Week doesn't exist yet (future)
                continue
            else:
                self._log(f"Week {week} not found or error occurred", "warn")
        
        return all_games
    
    def _fetch_ncaaf_games(self, date_range: Tuple[str, str]) -> List[Dict]:
        """Fetch NCAAF games (full season)"""
        all_games = []
        
        # Get season from date
        start_date = datetime.strptime(date_range[0], "%Y-%m-%d")
        season = start_date.year if start_date.month >= 8 else start_date.year
        
        # Fetch regular season games
        endpoint = f"{self.BASE_URL}/cfb/scores/json/Games/{season}"
        self._log(f"Fetching regular season games...")
        
        data = self._get_request(endpoint, params={"key": self.api_key})
        if data:
            games = self._parse_sdio_games(data, "NCAAF")
            filtered = [g for g in games 
                       if date_range[0] <= g.get("date", "") <= date_range[1]]
            all_games.extend(filtered)
            self.games_fetched += len(filtered)
        
        # Fetch postseason/bowl games
        endpoint = f"{self.BASE_URL}/cfb/scores/json/Games/{season}POST"
        self._log(f"Fetching postseason games...")
        
        data = self._get_request(endpoint, params={"key": self.api_key})
        if data:
            games = self._parse_sdio_games(data, "NCAAF")
            filtered = [g for g in games 
                       if date_range[0] <= g.get("date", "") <= date_range[1]]
            all_games.extend(filtered)
            self.games_fetched += len(filtered)
        
        return all_games
    
    def _parse_sdio_games(self, data: List[Dict], league: str) -> List[Dict]:
        """Parse SportsDataIO game list"""
        games = []
        
        for game in data:
            try:
                parsed = self._parse_sdio_game(game, league)
                if parsed:
                    games.append(parsed)
            except Exception as e:
                self._log(f"Error parsing game: {str(e)[:100]}", "debug")
                continue
        
        return games
    
    def _parse_sdio_game(self, game: Dict, league: str) -> Optional[Dict]:
        """Parse single SportsDataIO game"""
        # Get date
        date_str = game.get("DateTime") or game.get("Date")
        if not date_str:
            return None
        
        # Parse date
        if "T" in date_str:
            game_date = date_str.split("T")[0]
        else:
            game_date = date_str[:10]
        
        # Get teams and scores
        home_team = game.get("HomeTeam")
        away_team = game.get("AwayTeam")
        home_score = game.get("HomeScore")
        if home_score is None:
            home_score = game.get("HomeTeamScore")
            
        away_score = game.get("AwayScore")
        if away_score is None:
            away_score = game.get("AwayTeamScore")
        
        # Determine status - SportsDataIO uses multiple fields
        is_completed = game.get("IsCompleted", False)
        is_in_progress = game.get("IsInProgress", False)
        status_field = game.get("Status", "")
        
        # Status field values: "Final", "InProgress", "Scheduled", "Postponed", "Canceled"
        # Also check if game has final scores (both scores not None and game date is in the past)
        has_scores = home_score is not None and away_score is not None
        game_in_past = game_date < datetime.now().strftime("%Y-%m-%d")
        
        if is_completed or status_field == "Final" or (has_scores and game_in_past):
            status = "final"
        elif is_in_progress or status_field == "InProgress":
            status = "in_progress"
        elif status_field in ("Postponed", "Canceled"):
            status = status_field.lower()
        else:
            status = "scheduled"
        
        # Get quarter scores if available
        quarter_scores = {}
        quarters_list = game.get("Quarters") or game.get("Periods") or []
        for quarter in quarters_list:
            q_num = quarter.get("Number", 0)
            if q_num > 0:
                quarter_scores[f"Q{q_num}"] = {
                    "home": quarter.get("HomeScore", 0),
                    "away": quarter.get("AwayScore", 0)
                }
        
        return {
            "game_id": game.get("GameID") or game.get("ScoreID"),
            "date": game_date,
            "home_team": home_team,
            "away_team": away_team,
            "home_team_full": game.get("HomeTeamName"),
            "away_team_full": game.get("AwayTeamName"),
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "quarter_scores": quarter_scores,
            "source": league
        }


def fetch_all_sports(date_range: Tuple[str, str], verbose: bool = False) -> Dict[str, List[Dict]]:
    """Fetch games from all sports"""
    logger.info(f"Starting box score fetch for {date_range[0]} to {date_range[1]}")
    
    results = {}
    
    # ESPN sports (free)
    for league in ["NBA", "NCAAM"]:
        logger.info(f"\n{'='*60}")
        logger.info(f"Fetching {league}...")
        logger.info(f"{'='*60}")
        
        fetcher = ESPNFetcher(league, verbose=verbose)
        games = fetcher.fetch_games(date_range)
        completed = fetcher.filter_completed(games)
        
        daily_saved = save_games_by_day(fetcher, completed)
        snapshot_path = fetcher.save_historical_snapshot(completed, date_range[0], date_range[1])
        results[league] = {
            "total": len(games),
            "completed": len(completed),
            "daily_saved": daily_saved,
            "snapshot": snapshot_path.name if snapshot_path else None
        }
    
    # SportsDataIO sports (paid, optional)
    sdio_key = os.environ.get("SDIO_KEY")
    if not sdio_key:
        logger.warn("\nSDIO_KEY not set. Skipping NFL/NCAAF. Set environment variable to enable.")
        results["NFL"] = {"error": "No API key"}
        results["NCAAF"] = {"error": "No API key"}
    else:
        for league in ["NFL", "NCAAF"]:
            logger.info(f"\n{'='*60}")
            logger.info(f"Fetching {league}...")
            logger.info(f"{'='*60}")
            
            fetcher = SportsDataIOFetcher(league, api_key=sdio_key, verbose=verbose)
            games = fetcher.fetch_games(date_range)
            completed = fetcher.filter_completed(games)
            
            daily_saved = save_games_by_day(fetcher, completed)
            snapshot_path = fetcher.save_historical_snapshot(completed, date_range[0], date_range[1])
            results[league] = {
                "total": len(games),
                "completed": len(completed),
                "daily_saved": daily_saved,
                "snapshot": snapshot_path.name if snapshot_path else None
            }
    
    return results


def print_summary(results: Dict) -> None:
    """Print summary of fetch results"""
    logger.info(f"\n{'='*60}")
    logger.info("FETCH SUMMARY")
    logger.info(f"{'='*60}")
    
    for sport, stats in results.items():
        if "error" in stats:
            logger.info(f"{sport:8} | ❌ {stats['error']}")
        else:
            snapshot_label = stats.get("snapshot") or "none"
            daily_files = stats.get("daily_saved", 0)
            logger.info(
                f"{sport:8} | Total: {stats['total']:2} | Completed: {stats['completed']:2} | "
                f"DailyFiles: {daily_files:2} | Snapshot: {snapshot_label}"
            )
    
    logger.info(f"{'='*60}")
    logger.info(f"Log saved to: {LOG_FILE}")


def main():
    parser = argparse.ArgumentParser(description="Fetch completed box scores across all sports")
    parser.add_argument("--date", help="Specific date (YYYY-MM-DD)", default=None)
    parser.add_argument("--start", help="Start date (YYYY-MM-DD)", default=None)
    parser.add_argument("--end", help="End date (YYYY-MM-DD)", default=None)
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--telegram", action="store_true", help="Send Telegram notification")
    
    args = parser.parse_args()
    
    # Determine date range
    if args.date:
        date_range = (args.date, args.date)
    elif args.start and args.end:
        date_range = (args.start, args.end)
    else:
        # Default: yesterday
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        date_range = (yesterday, yesterday)
    
    logger.info(f"Fetching box scores for: {date_range[0]} to {date_range[1]}")
    logger.info(f"Verbose: {args.verbose}")
    
    # Fetch all games
    results = fetch_all_sports(date_range, verbose=args.verbose)
    
    # Print summary
    print_summary(results)
    
    # Send Telegram notification if requested
    if args.telegram:
        try:
            from .telegram_notifier import TelegramNotifier
            notifier = TelegramNotifier()
            notifier.send_score_notification(results, date_range[0])
            logger.info("Telegram notification sent")
        except Exception as e:
            logger.error(f"Failed to send Telegram notification: {e}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
