"""
Unified Team Resolver
=====================
Single entry-point for team-name canonicalization across all 4 leagues.

Merges data from:
  1. tracker_pnl/src/team_registry.py   (Python TeamRegistry – authoritative)
  2. client/assets/data/team-variants/   (JSON variant files used by dashboard)
  3. pnl/box_scores.py TEAM_ALIASES      (inline dict for quick PnL matching)

Usage:
    from tracker_pnl.src.unified_team_resolver import resolver
    canonical, league = resolver.resolve("chiefs", league_hint="NFL")
    # => ("Kansas City Chiefs", "NFL")
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Import the existing TeamRegistry (source of truth for Python pipeline)
# ---------------------------------------------------------------------------
try:
    from .team_registry import team_registry as _team_registry, TeamRegistry
except ImportError:
    # Allow standalone usage
    _team_registry = None
    TeamRegistry = None

# Root of the project
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class UnifiedTeamResolver:
    """
    Merges every known alias source into a single fast lookup.

    Lookup priority:
        1. Exact match (case-insensitive)
        2. ID match (e.g. "KC" → Kansas City Chiefs)
        3. Partial / fuzzy match (substring on mascot or city)
    """

    LEAGUES = ("NFL", "NBA", "NCAAF", "NCAAM")

    def __init__(self):
        # alias_lower → list of (canonical_name, league)
        self._alias_map: Dict[str, List[Tuple[str, str]]] = {}
        # id_upper → list of (canonical_name, league)
        self._id_map: Dict[str, List[Tuple[str, str]]] = {}
        # Mascot → list of (canonical_name, league)
        self._mascot_map: Dict[str, List[Tuple[str, str]]] = {}

        self._load_team_registry()
        self._load_json_variants()
        self._load_inline_aliases()

    # ------------------------------------------------------------------
    # Loaders
    # ------------------------------------------------------------------

    def _add_alias(self, alias: str, canonical: str, league: str):
        key = alias.lower().strip()
        if not key:
            return
        entry = (canonical, league)
        self._alias_map.setdefault(key, [])
        if entry not in self._alias_map[key]:
            self._alias_map[key].append(entry)

    def _add_id(self, team_id: str, canonical: str, league: str):
        key = team_id.upper().strip()
        if not key:
            return
        entry = (canonical, league)
        self._id_map.setdefault(key, [])
        if entry not in self._id_map[key]:
            self._id_map[key].append(entry)

    def _add_mascot(self, mascot: str, canonical: str, league: str):
        key = mascot.lower().strip()
        if not key:
            return
        entry = (canonical, league)
        self._mascot_map.setdefault(key, [])
        if entry not in self._mascot_map[key]:
            self._mascot_map[key].append(entry)

    def _load_team_registry(self):
        """Ingest data from the TeamRegistry singleton."""
        if _team_registry is None:
            return

        for league_name, teams_dict in [
            ("NFL", _team_registry.nfl_teams),
            ("NBA", _team_registry.nba_teams),
            ("NCAAF", _team_registry.ncaaf_teams),
            ("NCAAM", _team_registry.ncaam_teams),
        ]:
            for canonical, data in teams_dict.items():
                # ID
                self._add_id(data["id"], canonical, league_name)
                # Canonical name itself is an alias
                self._add_alias(canonical, canonical, league_name)
                # City + Mascot combos
                city = data.get("city", "")
                mascot = data.get("mascot", "")
                if city:
                    self._add_alias(city, canonical, league_name)
                if mascot:
                    self._add_alias(mascot, canonical, league_name)
                    self._add_mascot(mascot, canonical, league_name)
                if city and mascot:
                    self._add_alias(f"{city} {mascot}", canonical, league_name)
                # Explicit aliases
                for alias in data.get("aliases", []):
                    self._add_alias(alias, canonical, league_name)

    def _load_json_variants(self):
        """Ingest JSON variant files from client/assets/data/team-variants/."""
        variants_dir = _PROJECT_ROOT / "client" / "assets" / "data" / "team-variants"
        if not variants_dir.exists():
            return

        mapping = {
            "nfl_team_variants.json": "NFL",
            "nba_team_variants.json": "NBA",
            "ncaam_team_variants.json": "NCAAM",
            "cfb_team_variants.json": "NCAAF",  # may not exist yet
        }

        for filename, league in mapping.items():
            fpath = variants_dir / filename
            if not fpath.exists():
                continue
            try:
                data = json.loads(fpath.read_text(encoding="utf-8"))
            except Exception:
                continue

            for team_id, info in data.items():
                # Canonical = first full name
                names = info.get("names", [])
                canonical = names[0] if names else team_id
                # Find if TeamRegistry already has this canonical
                # Use the variant info to add more aliases
                self._add_id(team_id, canonical, league)
                for abbr in info.get("abbreviations", []):
                    self._add_alias(abbr, canonical, league)
                    self._add_id(abbr, canonical, league)
                for name in names:
                    self._add_alias(name, canonical, league)
                for loc in info.get("locations", []):
                    self._add_alias(loc, canonical, league)
                for nick in info.get("nicknames", []):
                    self._add_alias(nick, canonical, league)
                    self._add_mascot(nick, canonical, league)

    def _load_inline_aliases(self):
        """
        Ingest the TEAM_ALIASES dict from pnl/box_scores.py.

        Format: alias_key -> [primary_code, alt_name1, ...]

        We don't know the league from context so we try to match
        against existing known teams.  If not found, add to NFL+NBA
        (the two most common in that dict).
        """
        try:
            from pnl.box_scores import TEAM_ALIASES as _inline
        except ImportError:
            return

        for alias_key, values in _inline.items():
            # values[0] is usually the abbreviation (e.g. "KC")
            primary_code = values[0] if values else ""
            alt_names = values[1:] if len(values) > 1 else []

            # Try to resolve primary_code to a known team
            resolved = self._id_map.get(primary_code.upper())
            if resolved:
                for canonical, league in resolved:
                    self._add_alias(alias_key, canonical, league)
                    for alt in alt_names:
                        self._add_alias(alt, canonical, league)
            else:
                # Can't resolve – add as-is for both NFL and NBA
                for alt in [alias_key] + alt_names:
                    self._add_alias(alt, primary_code, "NFL")
                    self._add_alias(alt, primary_code, "NBA")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resolve(
        self,
        text: str,
        league_hint: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Resolve raw team text to (canonical_name, league).

        Args:
            text: Any team reference (abbrev, city, mascot, full name, …)
            league_hint: Optional league to prefer when ambiguous.

        Returns:
            (canonical_name, league) or (None, None).
        """
        if not text:
            return None, None

        cleaned = text.strip()
        lower = cleaned.lower()

        # --- 1. Exact alias match ---
        result = self._pick_best(self._alias_map.get(lower, []), league_hint)
        if result:
            return result

        # --- 2. ID match ---
        result = self._pick_best(self._id_map.get(cleaned.upper(), []), league_hint)
        if result:
            return result

        # --- 3. Normalised match (strip punctuation) ---
        norm = re.sub(r"[^a-z0-9 ]", "", lower).strip()
        if norm != lower:
            result = self._pick_best(self._alias_map.get(norm, []), league_hint)
            if result:
                return result

        # --- 4. Mascot substring match ---
        for mascot_key, entries in self._mascot_map.items():
            if mascot_key in lower or lower in mascot_key:
                result = self._pick_best(entries, league_hint)
                if result:
                    return result

        # --- 5. Word-token match (try each word) ---
        tokens = norm.split()
        for token in tokens:
            if len(token) < 3:
                continue
            result = self._pick_best(self._alias_map.get(token, []), league_hint)
            if result:
                return result

        return None, None

    def resolve_pair(
        self,
        team_a: str,
        team_b: str,
        league_hint: Optional[str] = None,
    ) -> Tuple[
        Tuple[Optional[str], Optional[str]],
        Tuple[Optional[str], Optional[str]],
    ]:
        """
        Resolve two teams together, using the first successful match to
        narrow the league for the second.
        """
        a_canon, a_league = self.resolve(team_a, league_hint)
        # If we got a league from team A, use it as hint for team B
        hint_b = a_league or league_hint
        b_canon, b_league = self.resolve(team_b, hint_b)
        return (a_canon, a_league), (b_canon, b_league)

    def get_team_id(self, text: str, league_hint: Optional[str] = None) -> Optional[str]:
        """Return the short ID (e.g. 'KC') for a team reference."""
        canonical, league = self.resolve(text, league_hint)
        if not canonical:
            return None
        # Look up in ID map (reverse)
        for tid, entries in self._id_map.items():
            for c, l in entries:
                if c == canonical and l == league:
                    return tid
        return None

    def get_all_aliases(self, text: str, league_hint: Optional[str] = None) -> List[str]:
        """Return every known alias for the resolved team."""
        canonical, league = self.resolve(text, league_hint)
        if not canonical:
            return []

        aliases = set()
        for alias_key, entries in self._alias_map.items():
            for c, l in entries:
                if c == canonical and l == league:
                    aliases.add(alias_key)
        return sorted(aliases)

    def search(self, query: str, league_hint: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Fuzzy search across all teams. Returns top matches.

        Returns list of dicts: {canonical, league, team_id, score}
        """
        query_lower = query.lower().strip()
        scored: List[Tuple[float, str, str, str]] = []

        seen = set()
        for alias_key, entries in self._alias_map.items():
            for canonical, league in entries:
                if league_hint and league != league_hint.upper():
                    continue
                key = (canonical, league)
                if key in seen:
                    continue
                seen.add(key)

                # Score: exact > starts_with > contains
                score = 0.0
                if alias_key == query_lower:
                    score = 1.0
                elif alias_key.startswith(query_lower):
                    score = 0.8
                elif query_lower in alias_key:
                    score = 0.6
                elif alias_key in query_lower:
                    score = 0.5
                else:
                    continue

                tid = self.get_team_id(canonical, league)
                scored.append((score, canonical, league, tid or ""))

        scored.sort(key=lambda x: -x[0])
        return [
            {"canonical": c, "league": l, "team_id": t, "score": s} for s, c, l, t in scored[:limit]
        ]

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _pick_best(
        entries: List[Tuple[str, str]],
        league_hint: Optional[str],
    ) -> Optional[Tuple[str, str]]:
        """
        From a list of (canonical, league) candidates pick the best match,
        preferring the league_hint when supplied.
        """
        if not entries:
            return None
        if league_hint:
            upper = league_hint.upper()
            for c, l in entries:
                if l == upper:
                    return c, l
        return entries[0]

    # ------------------------------------------------------------------
    # Stats / debug
    # ------------------------------------------------------------------

    def stats(self) -> Dict:
        """Return counts for debugging."""
        leagues: Dict[str, int] = {}
        for entries in self._alias_map.values():
            for _, l in entries:
                leagues[l] = leagues.get(l, 0) + 1
        return {
            "total_aliases": len(self._alias_map),
            "total_ids": len(self._id_map),
            "total_mascots": len(self._mascot_map),
            "by_league": leagues,
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
resolver = UnifiedTeamResolver()
