"""
Base Ingestor Class - Common interface for all sport/league ingestors
"""

import json
import os
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

class BaseIngestor(ABC):
    """
    Base class for all sports data ingestors.
    
    Each league ingestor must implement:
    - fetch_schedule(): Get games from API
    - normalize_team(): Convert API team name to canonical form
    - get_game_scores(): Extract scores from game data
    """
    
    def __init__(self, league: str, cache_dir: str = None, variants_dir: str = None):
        self.league = league.upper()
        
        # Set up paths
        base_dir = Path(__file__).parent.parent
        self.cache_dir = Path(cache_dir) if cache_dir else base_dir / "cache"
        self.variants_dir = Path(variants_dir) if variants_dir else base_dir / "variants"
        
        # Ensure directories exist
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.variants_dir.mkdir(parents=True, exist_ok=True)
        
        # Load team variants
        self.variants = self._load_variants()
        self.reverse_variants = self._build_reverse_lookup()
        
        # Cache file path
        self.cache_file = self.cache_dir / f"{self.league.lower()}_schedule.json"
    
    def _load_variants(self) -> Dict[str, List[str]]:
        """Load team variant mappings for this league."""
        variants_file = self.variants_dir / f"{self.league.lower()}_variants.json"
        if variants_file.exists():
            with open(variants_file, 'r') as f:
                return json.load(f)
        return {}
    
    def _build_reverse_lookup(self) -> Dict[str, str]:
        """Build reverse lookup: variant -> canonical name."""
        reverse = {}
        for canonical, variants in self.variants.items():
            # Canonical name maps to itself
            reverse[canonical.lower()] = canonical
            for variant in variants:
                reverse[variant.lower()] = canonical
        return reverse
    
    def resolve_team(self, name: str) -> Optional[str]:
        """
        Resolve a team name (possibly a variant) to its canonical form.
        Returns None if no match found.
        """
        if not name:
            return None
        
        normalized = name.strip().lower()
        
        # Direct lookup in reverse variants
        if normalized in self.reverse_variants:
            return self.reverse_variants[normalized]
        
        # Try partial matching for common patterns, but only for longer variants to avoid over-matching
        candidates = []
        for variant, canonical in self.reverse_variants.items():
            if len(variant) >= 4 and (variant in normalized or normalized in variant):
                candidates.append(canonical)
        
        # Return the longest matching canonical if multiple
        if candidates:
            return max(candidates, key=len)
        
        return None
    
    def load_cache(self) -> Optional[Dict]:
        """Load cached schedule data."""
        if self.cache_file.exists():
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        return None
    
    def save_cache(self, data: Dict):
        """Save schedule data to cache."""
        with open(self.cache_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def is_cache_fresh(self, max_age_hours: int = 6) -> bool:
        """Check if cache is still fresh (within max_age_hours)."""
        if not self.cache_file.exists():
            return False
        
        mtime = datetime.fromtimestamp(self.cache_file.stat().st_mtime)
        return datetime.now() - mtime < timedelta(hours=max_age_hours)
    
    def get_schedule(self, force_refresh: bool = False) -> Dict:
        """
        Get schedule data - from cache if fresh, otherwise fetch new.
        
        Returns dict with structure:
        {
            "league": "NFL",
            "last_updated": "2025-12-24T10:00:00",
            "by_date": {
                "2025-12-24": [game1, game2, ...],
                ...
            },
            "by_team": {
                "team_name": [game1, game2, ...],
                ...
            }
        }
        """
        if not force_refresh and self.is_cache_fresh():
            return self.load_cache()
        
        # Fetch fresh data
        games = self.fetch_schedule()
        
        # Build indexed structure
        schedule = {
            "league": self.league,
            "last_updated": datetime.now().isoformat(),
            "by_date": {},
            "by_team": {}
        }
        
        for game in games:
            # Index by date
            game_date = game.get("date", "unknown")
            if game_date not in schedule["by_date"]:
                schedule["by_date"][game_date] = []
            schedule["by_date"][game_date].append(game)
            
            # Index by team (both home and away)
            for team_key in ["home_team", "away_team"]:
                team = game.get(team_key)
                if team:
                    team_lower = team.lower()
                    if team_lower not in schedule["by_team"]:
                        schedule["by_team"][team_lower] = []
                    schedule["by_team"][team_lower].append(game)
        
        # Save to cache
        self.save_cache(schedule)
        
        return schedule
    
    def find_game(self, date: str, team: str) -> Optional[Dict]:
        """
        Find a specific game by date and team name.
        Uses variant matching to resolve team names.
        """
        schedule = self.get_schedule()
        
        # Resolve team name to canonical form
        canonical_team = self.resolve_team(team)
        
        # Get games for this date
        date_games = schedule.get("by_date", {}).get(date, [])
        
        for game in date_games:
            home = game.get("home_team", "").lower()
            away = game.get("away_team", "").lower()
            
            # Check direct match
            if team.lower() in [home, away]:
                return game
            
            # Check canonical match
            if canonical_team:
                canonical_lower = canonical_team.lower()
                if canonical_lower in [home, away]:
                    return game
                
                # Check if game teams resolve to same canonical
                home_canonical = self.resolve_team(home)
                away_canonical = self.resolve_team(away)
                
                if canonical_team in [home_canonical, away_canonical]:
                    return game
        
        return None
    
    @abstractmethod
    def fetch_schedule(self) -> List[Dict]:
        """
        Fetch schedule from API.
        
        Must return list of games with standardized structure:
        {
            "game_id": "unique_id",
            "date": "YYYY-MM-DD",
            "home_team": "Team Name",
            "away_team": "Team Name",
            "home_score": 0,  # None if not started
            "away_score": 0,  # None if not started
            "status": "scheduled|in_progress|final",
            "quarter_scores": {...}  # Optional, for segment betting
        }
        """
        pass
    
    @abstractmethod
    def get_current_season(self) -> str:
        """Get the current season identifier for this league."""
        pass
