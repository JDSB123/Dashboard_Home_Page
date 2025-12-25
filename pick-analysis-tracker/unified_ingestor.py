"""
Unified Sports Data Ingestor
Single entry point for all league schedule ingestion.

Usage:
    python unified_ingestor.py                    # Refresh all leagues
    python unified_ingestor.py --league NFL       # Refresh single league
    python unified_ingestor.py --force            # Force refresh (ignore cache)
    python unified_ingestor.py --status           # Show cache status
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from ingestors import NFLIngestor, NCAAFIngestor, NBAIngestor, NCAAMIngestor

class UnifiedIngestor:
    """
    Single source of truth for all sports schedule data.
    Manages all league ingestors and provides unified access.
    """
    
    SUPPORTED_LEAGUES = ["NFL", "NCAAF", "NBA", "NCAAM"]
    
    def __init__(self, cache_dir: str = None, variants_dir: str = None):
        self.base_dir = Path(__file__).parent
        self.cache_dir = Path(cache_dir) if cache_dir else self.base_dir / "cache"
        self.variants_dir = Path(variants_dir) if variants_dir else self.base_dir / "variants"
        
        # Ensure directories exist
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.variants_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize ingestors (lazy loading)
        self._ingestors: Dict[str, object] = {}
    
    def _get_ingestor(self, league: str):
        """Get or create ingestor for a league."""
        league = league.upper()
        
        if league not in self._ingestors:
            common_args = {
                "cache_dir": str(self.cache_dir),
                "variants_dir": str(self.variants_dir)
            }
            
            if league == "NFL":
                self._ingestors[league] = NFLIngestor(**common_args)
            elif league == "NCAAF":
                self._ingestors[league] = NCAAFIngestor(**common_args)
            elif league == "NBA":
                self._ingestors[league] = NBAIngestor(**common_args)
            elif league == "NCAAM":
                self._ingestors[league] = NCAAMIngestor(**common_args)
            else:
                raise ValueError(f"Unsupported league: {league}")
        
        return self._ingestors[league]
    
    def refresh(self, leagues: List[str] = None, force: bool = False) -> Dict[str, dict]:
        """
        Refresh schedule data for specified leagues.
        
        Args:
            leagues: List of league codes to refresh. None = all leagues.
            force: Force refresh even if cache is fresh.
        
        Returns:
            Dict mapping league -> schedule data
        """
        if leagues is None:
            leagues = self.SUPPORTED_LEAGUES
        
        results = {}
        
        for league in leagues:
            league = league.upper()
            if league not in self.SUPPORTED_LEAGUES:
                print(f"⚠️  Skipping unsupported league: {league}")
                continue
            
            try:
                print(f"📥 Ingesting {league} schedule...")
                ingestor = self._get_ingestor(league)
                schedule = ingestor.get_schedule(force_refresh=force)
                
                game_count = sum(len(games) for games in schedule.get("by_date", {}).values())
                team_count = len(schedule.get("by_team", {}))
                
                print(f"   ✅ {league}: {game_count} games, {team_count} teams indexed")
                results[league] = schedule
                
            except Exception as e:
                print(f"   ❌ {league} error: {e}")
                results[league] = {"error": str(e)}
        
        return results
    
    def find_game(self, league: str, date: str, team: str) -> Optional[Dict]:
        """
        Find a game across any league.
        
        Args:
            league: League code (NFL, NCAAF, NBA, NCAAM)
            date: Game date in YYYY-MM-DD format
            team: Team name (can be variant)
        
        Returns:
            Game dict if found, None otherwise
        """
        league = league.upper()
        
        try:
            ingestor = self._get_ingestor(league)
            return ingestor.find_game(date, team)
        except Exception as e:
            print(f"Error finding game: {e}")
            return None
    
    def resolve_team(self, league: str, team: str) -> Optional[str]:
        """
        Resolve a team variant to its canonical name.
        
        Args:
            league: League code
            team: Team name (possibly a variant)
        
        Returns:
            Canonical team name, or None if not found
        """
        league = league.upper()
        
        try:
            ingestor = self._get_ingestor(league)
            return ingestor.resolve_team(team)
        except Exception as e:
            print(f"Error resolving team: {e}")
            return None
    
    def get_cache_status(self) -> Dict[str, dict]:
        """Get status of all league caches."""
        status = {}
        
        for league in self.SUPPORTED_LEAGUES:
            cache_file = self.cache_dir / f"{league.lower()}_schedule.json"
            variants_file = self.variants_dir / f"{league.lower()}_variants.json"
            
            league_status = {
                "cache_exists": cache_file.exists(),
                "variants_exists": variants_file.exists()
            }
            
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                league_status["last_updated"] = data.get("last_updated")
                league_status["game_count"] = sum(len(g) for g in data.get("by_date", {}).values())
                league_status["team_count"] = len(data.get("by_team", {}))
            
            if variants_file.exists():
                with open(variants_file, 'r') as f:
                    variants = json.load(f)
                league_status["variant_teams"] = len(variants)
                league_status["total_variants"] = sum(len(v) for v in variants.values())
            
            status[league] = league_status
        
        return status
    
    def print_status(self):
        """Print formatted cache status."""
        status = self.get_cache_status()
        
        print("\n" + "=" * 60)
        print("📊 UNIFIED INGESTOR CACHE STATUS")
        print("=" * 60)
        
        for league, info in status.items():
            print(f"\n{league}:")
            
            if info.get("cache_exists"):
                print(f"  📁 Cache: ✅ ({info.get('game_count', 0)} games, {info.get('team_count', 0)} teams)")
                print(f"  🕐 Updated: {info.get('last_updated', 'unknown')}")
            else:
                print(f"  📁 Cache: ❌ Not found")
            
            if info.get("variants_exists"):
                print(f"  🏷️  Variants: ✅ ({info.get('variant_teams', 0)} teams, {info.get('total_variants', 0)} aliases)")
            else:
                print(f"  🏷️  Variants: ❌ Not found")
        
        print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Unified Sports Data Ingestor")
    parser.add_argument("--league", "-l", type=str, help="Specific league to refresh (NFL, NCAAF, NBA, NCAAM)")
    parser.add_argument("--force", "-f", action="store_true", help="Force refresh, ignore cache")
    parser.add_argument("--status", "-s", action="store_true", help="Show cache status only")
    
    args = parser.parse_args()
    
    ingestor = UnifiedIngestor()
    
    if args.status:
        ingestor.print_status()
        return
    
    leagues = [args.league] if args.league else None
    
    print("\n🚀 Starting unified schedule ingestion...")
    print(f"   Force refresh: {args.force}")
    print(f"   Leagues: {leagues or 'ALL'}")
    print()
    
    results = ingestor.refresh(leagues=leagues, force=args.force)
    
    print("\n✅ Ingestion complete!")
    ingestor.print_status()


if __name__ == "__main__":
    main()
