"""
Team Variant Lookup Utility

Provides helper functions to work with team variant data.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class TeamVariantLookup:
    """Lookup utility for team names, abbreviations, and variants."""

    def __init__(self, data_dir: str = None):
        """Initialize with team variant data."""
        if data_dir is None:
            # Auto-detect path relative to this script
            script_dir = Path(__file__).parent
            data_dir = script_dir.parent / "client" / "assets" / "data" / "team-variants"
        self.data_dir = Path(data_dir)
        self.nfl_teams = self._load_json("nfl_team_variants.json")
        self.nba_teams = self._load_json("nba_team_variants.json")
        self.ncaam_teams = self._load_json("ncaam_team_variants.json")
        self.cfb_teams = (
            self._load_json("cfb_team_variants.json")
            if (self.data_dir / "cfb_team_variants.json").exists()
            else {}
        )

        # Build reverse lookup indexes
        self._build_indexes()

    def _load_json(self, filename: str) -> Dict:
        """Load JSON file."""
        filepath = self.data_dir / filename
        if not filepath.exists():
            print(f"Warning: {filename} not found")
            return {}

        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def _build_indexes(self):
        """Build reverse lookup indexes for fast searches."""
        # NFL abbreviation → team key
        self.nfl_abbrev_index = {}
        for team_key, team_data in self.nfl_teams.items():
            for abbrev in team_data.get("abbreviations", []):
                self.nfl_abbrev_index[abbrev.upper()] = team_key

        # NBA abbreviation → team key
        self.nba_abbrev_index = {}
        for team_key, team_data in self.nba_teams.items():
            for abbrev in team_data.get("abbreviations", []):
                self.nba_abbrev_index[abbrev.upper()] = team_key

        # NCAAM abbreviation → team key
        self.ncaam_abbrev_index = {}
        for team_key, team_data in self.ncaam_teams.items():
            for abbrev in team_data.get("abbreviations", []):
                self.ncaam_abbrev_index[abbrev.upper()] = team_key

        # CFB/NCAAF abbreviation → team key
        self.cfb_abbrev_index = {}
        self.cfb_name_index = {}
        for team_key, team_data in self.cfb_teams.items():
            for abbrev in team_data.get("abbreviations", []):
                self.cfb_abbrev_index[abbrev.upper()] = team_key
            for name in team_data.get("names", []):
                self.cfb_name_index[name.upper()] = team_key
            for nickname in team_data.get("nicknames", []):
                self.cfb_name_index[nickname.upper()] = team_key
            for loc in team_data.get("locations", []):
                self.cfb_name_index[loc.upper()] = team_key

        # NFL name → team key
        self.nfl_name_index = {}
        for team_key, team_data in self.nfl_teams.items():
            for name in team_data.get("names", []):
                self.nfl_name_index[name.upper()] = team_key
            for nickname in team_data.get("nicknames", []):
                self.nfl_name_index[nickname.upper()] = team_key

    def find_nfl_team(self, query: str) -> Optional[Dict]:
        """
        Find NFL team by abbreviation or name.

        Args:
            query: Team abbreviation or name (e.g., "ARI", "Cardinals", "Arizona")

        Returns:
            Team data dictionary or None if not found
        """
        query_upper = query.upper().strip()

        # Try abbreviation first
        if query_upper in self.nfl_abbrev_index:
            team_key = self.nfl_abbrev_index[query_upper]
            return {"key": team_key, **self.nfl_teams[team_key]}

        # Try name match
        if query_upper in self.nfl_name_index:
            team_key = self.nfl_name_index[query_upper]
            return {"key": team_key, **self.nfl_teams[team_key]}

        # Try partial match in names
        for team_key, team_data in self.nfl_teams.items():
            for name in team_data.get("names", []):
                if query_upper in name.upper():
                    return {"key": team_key, **team_data}

        return None

    def find_nba_team(self, query: str) -> Optional[Dict]:
        """
        Find NBA team by abbreviation or name.

        Args:
            query: Team abbreviation or name (e.g., "LAL", "Lakers", "Los Angeles")

        Returns:
            Team data dictionary or None if not found
        """
        query_upper = query.upper().strip()

        # Try abbreviation first
        if query_upper in self.nba_abbrev_index:
            team_key = self.nba_abbrev_index[query_upper]
            return {"key": team_key, **self.nba_teams[team_key]}

        # Try partial match in names
        for team_key, team_data in self.nba_teams.items():
            name = team_data.get("name", "").upper()
            location = team_data.get("location", "").upper()
            nickname = team_data.get("nickname", "").upper()

            if query_upper in name or query_upper in location or query_upper in nickname:
                return {"key": team_key, **team_data}

        return None

    def find_ncaam_team(self, query: str) -> Optional[Dict]:
        """
        Find NCAAM team by abbreviation or name.

        Args:
            query: Team abbreviation or name (e.g., "DUKE", "Blue Devils", "Duke")

        Returns:
            Team data dictionary or None if not found
        """
        query_upper = query.upper().strip()

        # Try abbreviation first
        if query_upper in self.ncaam_abbrev_index:
            team_key = self.ncaam_abbrev_index[query_upper]
            return {"key": team_key, **self.ncaam_teams[team_key]}

        # Try direct key match
        if query_upper in self.ncaam_teams:
            return {"key": query_upper, **self.ncaam_teams[query_upper]}

        # Try partial match in names
        for team_key, team_data in self.ncaam_teams.items():
            name = team_data.get("name", "").upper()
            location = team_data.get("location", "").upper()
            nickname = team_data.get("nickname", "").upper()

            if (
                query_upper in name
                or query_upper in location
                or query_upper in nickname
                or query_upper == location.split()[0]
                if location
                else False
            ):  # First word of location
                return {"key": team_key, **team_data}

        return None

    def find_ncaaf_team(self, query: str) -> Optional[Dict]:
        """
        Find NCAAF / CFB team by abbreviation, name, location, or nickname.

        Args:
            query: Team abbreviation or name (e.g., "BAMA", "Crimson Tide", "Alabama")

        Returns:
            Team data dictionary or None if not found
        """
        query_upper = query.upper().strip()

        # Try abbreviation first
        if query_upper in self.cfb_abbrev_index:
            team_key = self.cfb_abbrev_index[query_upper]
            return {"key": team_key, **self.cfb_teams[team_key]}

        # Try name / nickname / location index
        if query_upper in self.cfb_name_index:
            team_key = self.cfb_name_index[query_upper]
            return {"key": team_key, **self.cfb_teams[team_key]}

        # Try direct key match
        if query_upper in self.cfb_teams:
            return {"key": query_upper, **self.cfb_teams[query_upper]}

        # Partial match across all fields
        for team_key, team_data in self.cfb_teams.items():
            for field_name in ("names", "locations", "nicknames"):
                for val in team_data.get(field_name, []):
                    if query_upper in val.upper() or val.upper() in query_upper:
                        return {"key": team_key, **team_data}

        return None

    def normalize_nfl_abbreviation(self, abbrev: str) -> str:
        """
        Normalize NFL team abbreviation to canonical form.

        Args:
            abbrev: Any known abbreviation for a team

        Returns:
            Canonical abbreviation (the team key)
        """
        abbrev_upper = abbrev.upper().strip()
        return self.nfl_abbrev_index.get(abbrev_upper, abbrev)

    def normalize_nba_abbreviation(self, abbrev: str) -> str:
        """
        Normalize NBA team abbreviation to canonical form.

        Args:
            abbrev: Any known abbreviation for a team

        Returns:
            Canonical abbreviation (the team key)
        """
        abbrev_upper = abbrev.upper().strip()
        return self.nba_abbrev_index.get(abbrev_upper, abbrev)

    def normalize_ncaam_abbreviation(self, abbrev: str) -> str:
        """
        Normalize NCAAM team abbreviation to canonical form.

        Args:
            abbrev: Any known abbreviation for a team

        Returns:
            Canonical abbreviation (the team key)
        """
        abbrev_upper = abbrev.upper().strip()
        return self.ncaam_abbrev_index.get(abbrev_upper, abbrev)

    def get_team_variants(self, league: str, team_key: str) -> List[str]:
        """
        Get all known variants for a team.

        Args:
            league: 'NFL', 'NBA', or 'NCAAM'
            team_key: Team abbreviation key

        Returns:
            List of all known variants
        """
        league_upper = league.upper()

        if league_upper == "NFL":
            teams_dict = self.nfl_teams
        elif league_upper == "NBA":
            teams_dict = self.nba_teams
        elif league_upper == "NCAAM":
            teams_dict = self.ncaam_teams
        else:
            return []

        if team_key not in teams_dict:
            return []

        team_data = teams_dict[team_key]
        variants = set()

        if league_upper == "NFL":
            variants.update(team_data.get("abbreviations", []))
            variants.update(team_data.get("names", []))
            variants.update(team_data.get("nicknames", []))
        elif league_upper == "NBA":
            variants.update(team_data.get("abbreviations", []))
            variants.add(team_data.get("name", ""))
        elif league_upper == "NCAAM":
            variants.update(team_data.get("abbreviations", []))
            variants.add(team_data.get("name", ""))
            variants.add(team_data.get("nickname", ""))
            variants.add(team_data.get("nickname", ""))
            variants.add(team_data.get("location", ""))

        return sorted(list(variants))

    def search_teams(self, query: str) -> Dict[str, List[Dict]]:
        """
        Search for teams across all leagues.

        Args:
            query: Search string

        Returns:
            Dictionary with 'nfl', 'nba', and 'ncaam' keys containing matching teams
        """
        results = {"nfl": [], "nba": [], "ncaam": []}

        nfl_team = self.find_nfl_team(query)
        if nfl_team:
            results["nfl"].append(nfl_team)

        nba_team = self.find_nba_team(query)
        if nba_team:
            results["nba"].append(nba_team)

        ncaam_team = self.find_ncaam_team(query)
        if ncaam_team:
            results["ncaam"].append(ncaam_team)

        return results


def main():
    """Example usage."""
    lookup = TeamVariantLookup()

    print("=" * 60)
    print("Team Variant Lookup - Examples")
    print("=" * 60)

    # Example 1: Find NFL team
    print("\n1. Find NFL team by abbreviation:")
    team = lookup.find_nfl_team("ARI")
    if team:
        print(f"   Team: {team['names'][0]}")
        print(f"   All abbreviations: {', '.join(team['abbreviations'])}")

    # Example 2: Find by name
    print("\n2. Find NFL team by name:")
    team = lookup.find_nfl_team("Raiders")
    if team:
        print(f"   Current: {team['historical'][-1]['full_name']}")
        print(f"   Location history: {[h['location'] for h in team['historical'][-3:]]}")

    # Example 3: Find NCAAM team
    print("\n3. Find NCAAM teams:")
    for query in ["DUKE", "North Carolina", "Wildcats"]:
        team = lookup.find_ncaam_team(query)
        if team:
            print(f"   {query} → {team['name']} ({team['abbreviations'][0]})")

    # Example 4: Normalize abbreviation
    print("\n4. Normalize abbreviations:")
    for abbrev in ["BKN", "BRK"]:
        normalized = lookup.normalize_nba_abbreviation(abbrev)
        print(f"   {abbrev} → {normalized}")

    # Example 5: Get all variants
    print("\n5. Get all variants for a team:")
    variants = lookup.get_team_variants("NFL", "LAC")
    print(f"   LAC variants: {', '.join(variants[:5])}...")

    # Example 6: Search across leagues
    print("\n6. Search across all leagues:")
    results = lookup.search_teams("State")
    for league, teams in results.items():
        if teams:
            team_names = [t.get("name") or t["names"][0] for t in teams[:3]]
            print(f"   {league.upper()}: {', '.join(team_names)}")

    print(f"\n7. Total teams loaded:")
    print(f"   NFL: {len(lookup.nfl_teams)}")
    print(f"   NBA: {len(lookup.nba_teams)}")
    print(f"   NCAAM: {len(lookup.ncaam_teams)}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
