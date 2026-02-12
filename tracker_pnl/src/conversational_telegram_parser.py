"""
Conversational Telegram Pick Parser — deep-inference edition.

Architecture:
  • Josh's messages set CONTEXT — matchup, league, segment — and produce
    a list of "proposed picks" that Zach may confirm generically.
  • Zach's messages with ``$`` amounts  → parse exact confirmed bets (source
    of truth for line/odds/stake).
  • Zach "In" / "Ok" / "all good" (without ``$``) → confirm Josh's pending
    proposals at default stakes ($50 k NFL/NBA, $25 k NCAAM).
  • Zach "off the board" / "no good" / "otb" / "cbk extra" → NOT placed.
  • Alex W behaves like Zach for confirmation purposes.

Uses ``team_registry.normalize_team()`` for league inference on every bet,
so the league never gets "stuck" from a prior conversation segment.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from src.pick_tracker import Pick
from src.team_registry import team_registry

# ── Segment mapping ────────────────────────────────────────────────────────
_SEGMENT_MAP = {
    "1h": "1H",
    "fh": "1H",
    "first half": "1H",
    "1st half": "1H",
    "2h": "2H",
    "sh": "2H",
    "second half": "2H",
    "2nd half": "2H",
    "2nd": "2H",
    "s2": "2H",
    "fg": "FG",
    "full": "FG",
    "full game": "FG",
    "game": "FG",
    "1q": "1Q",
    "2q": "2Q",
    "3q": "3Q",
    "4q": "4Q",
}

# Quick-lookup word sets for league sniffing
_NFL_WORDS = {
    "chiefs",
    "bills",
    "cowboys",
    "packers",
    "eagles",
    "ravens",
    "49ers",
    "niners",
    "dolphins",
    "lions",
    "bears",
    "vikings",
    "texans",
    "bengals",
    "broncos",
    "steelers",
    "patriots",
    "jets",
    "giants",
    "chargers",
    "rams",
    "seahawks",
    "cardinals",
    "cards",
    "falcons",
    "panthers",
    "saints",
    "bucs",
    "buccaneers",
    "buccs",
    "browns",
    "raiders",
    "colts",
    "jaguars",
    "jags",
    "titans",
    "commanders",
    "redskins",
    "eagle",
    "skins",
}
_NBA_WORDS = {
    "lakers",
    "celtics",
    "warriors",
    "heat",
    "bulls",
    "nets",
    "knicks",
    "clippers",
    "clips",
    "rockets",
    "spurs",
    "mavs",
    "mavericks",
    "nuggets",
    "nugs",
    "suns",
    "grizzlies",
    "grizz",
    "pelicans",
    "pels",
    "jazz",
    "timberwolves",
    "wolves",
    "twolves",
    "thunder",
    "blazers",
    "kings",
    "hawks",
    "hornets",
    "cavaliers",
    "cavs",
    "pistons",
    "pacers",
    "bucks",
    "magic",
    "76ers",
    "76s",
    "sixers",
    "raptors",
    "raps",
    "wizards",
    "wiz",
    "lak",
}

# Supplementary aliases for teams the registry doesn't cover
_EXTRA_ALIASES: Dict[str, Tuple[str, str]] = {
    "eagle": ("Philadelphia Eagles", "NFL"),
    "skins": ("Washington Commanders", "NFL"),
    "lak": ("Los Angeles Lakers", "NBA"),
    "new orleans": ("New Orleans Pelicans", "NBA"),
    "c mich": ("Central Michigan", "NCAAF"),
    "nw": ("Northwestern", "NCAAF"),
    "g was": ("George Washington", "NCAAM"),
    "marshall": ("Marshall", "NCAAF"),
    "x": ("Xavier", "NCAAM"),
    "bama": ("Alabama", "NCAAF"),
    "smu": ("SMU", "NCAAF"),
    "miss st": ("Mississippi State", "NCAAM"),
    "indiana": ("Indiana", "NCAAM"),
    "n iowa": ("Northern Iowa", "NCAAM"),
    "n. iowa": ("Northern Iowa", "NCAAM"),
    "vandy": ("Vanderbilt", "NCAAF"),
    "depaul": ("DePaul", "NCAAM"),
    "miami": ("Miami", "NCAAF"),
    "texas": ("Texas", "NCAAF"),
    "oregon": ("Oregon", "NCAAF"),
    "tennessee": ("Tennessee", "NCAAF"),
    "tulsa": ("Tulsa", "NCAAM"),
    "boise": ("Boise State", "NCAAM"),
    "harvard": ("Harvard", "NCAAM"),
    "zaga": ("Gonzaga", "NCAAM"),
    "cal poly": ("Cal Poly", "NCAAM"),
    "tx a&m": ("Texas A&M", "NCAAF"),
    "uscd": ("UC San Diego", "NCAAM"),
    "ucsd": ("UC San Diego", "NCAAM"),
    "samf": ("Samford", "NCAAM"),
    "wcu": ("Western Carolina", "NCAAM"),
    "utst": ("Utah State", "NCAAM"),
    "por": ("Portland", "NCAAM"),
    "montana": ("Montana", "NCAAM"),
    "uncg": ("UNC Greensboro", "NCAAM"),
    "lindenwood": ("Lindenwood", "NCAAM"),
    "byu": ("BYU Cougars", "NCAAM"),
    "msu": ("Michigan State", "NCAAM"),
    "ill": ("Illinois", "NCAAM"),
    "uga": ("Georgia", "NCAAF"),
    "clem": ("Clemson", "NCAAM"),
    "cal": ("California", "NCAAM"),
    "penn": ("Penn", "NCAAM"),
    "wyo": ("Wyoming", "NCAAM"),
    "hawaii": ("Hawaii", "NCAAM"),
    "houston": ("Houston Cougars", "NCAAM"),
    "tamu": ("Texas A&M", "NCAAF"),
    "tx a&m": ("Texas A&M", "NCAAF"),
    "fla": ("Florida", "NCAAF"),
    "ole miss": ("Ole Miss", "NCAAF"),
    "new mexico": ("New Mexico", "NCAAM"),
    "new mecixo": ("New Mexico", "NCAAM"),
    "49s": ("San Francisco 49ers", "NFL"),
    "49ers": ("San Francisco 49ers", "NFL"),
    "76s": ("Philadelphia 76ers", "NBA"),
    "buccs": ("Tampa Bay Buccaneers", "NFL"),
    "bucs": ("Tampa Bay Buccaneers", "NFL"),
    "broncus": ("Denver Broncos", "NFL"),
    # Ambiguous city abbreviations — context-aware _normalize will pick the right one
    "min": ("Minnesota Timberwolves", "NBA"),
    "minnesota": ("Minnesota Timberwolves", "NBA"),
    "was": ("Washington Wizards", "NBA"),
    "washington": ("Washington Wizards", "NBA"),
    "cha": ("Charlotte Hornets", "NBA"),
    "charlotte": ("Charlotte Hornets", "NBA"),
    "phl": ("Philadelphia 76ers", "NBA"),
    "phi": ("Philadelphia 76ers", "NBA"),
    "phx": ("Phoenix Suns", "NBA"),
    "atl": ("Atlanta Hawks", "NBA"),
    "atlanta": ("Atlanta Hawks", "NBA"),
    "ind": ("Indiana Pacers", "NBA"),
    "tor": ("Toronto Raptors", "NBA"),
    "toronto": ("Toronto Raptors", "NBA"),
    "raptos": ("Toronto Raptors", "NBA"),
}

# ── Telegram plain-text header ────────────────────────────────────────────
_HEADER_RE = re.compile(
    r"^([A-Za-z][A-Za-z \w]+),\s*\[(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]$"
)

# ── Matchup patterns ─────────────────────────────────────────────────────
_MATCHUP_AT = re.compile(
    r"([A-Za-z][A-Za-z\s&\'.,-]+?)\s+(?:at|@)\s+([A-Za-z][A-Za-z\s&\'.,-]+)",
    re.I,
)
_MATCHUP_VS = re.compile(
    r"([A-Za-z][A-Za-z\s&\'.,-]+?)\s+(?:vs\.?|versus|v\.?)\s+([A-Za-z][A-Za-z\s&\'.,-]+)",
    re.I,
)
_PIPE_MATCHUP = re.compile(r"([A-Z]{2,5})\s*@\s*([A-Z]{2,5})\s*[|\-—]")

# ── Zach bet patterns ────────────────────────────────────────────────────

# team <spread> <odds> $<stake> [segment]   e.g. "Rams -3 -130 $50 1h"
_ZBET_SPREAD = re.compile(
    r"(?P<team>[A-Za-z][A-Za-z\s.'-]*?)\s+"
    r"(?P<ou>[ou])?"
    r"(?P<line>[-+]?\d+\.?\d*)\s+"
    r"(?P<odds>[-+]\d{3,})\s+"
    r"\$(?P<stake>\d+)"
    r"(?:\s+(?P<seg>\S+))?",
    re.I,
)

# team <ou><total> [segment] <odds> $<stake>   e.g. "Clips u118 1h -119 $50"
_ZBET_OU = re.compile(
    r"(?P<team>[A-Za-z][A-Za-z\s.'-]*?)\s+"
    r"(?P<ou>[ou])(?P<line>\d+\.?\d*)\s*"
    r"(?:(?P<seg1>1h|2h|1q|fg)\s+)?"
    r"(?P<odds>[-+]?\d{3,})\s+"
    r"\$(?P<stake>\d+)"
    r"(?:\s+(?P<seg2>\S+))?",
    re.I,
)

# team <3+-digit-odds> $<stake> [seg]   e.g. "Jazz 240 $50" (ML +240)
_ZBET_ML = re.compile(
    r"(?P<team>[A-Za-z][A-Za-z\s.'-]*?)\s+"
    r"(?P<odds>[-+]?\d{3,})\s+"
    r"\$(?P<stake>\d+)"
    r"(?:\s+(?P<seg>\S+))?",
    re.I,
)

# team PK <odds> $<stake>
_ZBET_PK = re.compile(
    r"(?P<team>[A-Za-z][A-Za-z\s.'-]*?)\s+(?:pk|pick)\s+"
    r"(?P<odds>[-+]\d{3,})\s+"
    r"\$(?P<stake>\d+)"
    r"(?:\s+(?P<seg>\S+))?",
    re.I,
)

# bare odds: "-102 $50"  (inherit team from context)
_ZBET_BARE = re.compile(
    r"^(?P<odds>[-+]\d{3,})\s+\$(?P<stake>\d+)$",
    re.I,
)

# "odds on line $stake"   e.g. "-115 on +0.5 $50"
_ZBET_ON = re.compile(
    r"(?P<odds>[-+]\d{3,})\s+on\s+(?P<line>[-+]?\d+\.?\d*)\s+\$(?P<stake>\d+)",
    re.I,
)

# "Ok $50 ea"  /  "In $50"  — generic confirm with stake only
_ZBET_GENERIC_STAKE = re.compile(
    r"^(?:ok|in|yes|good|done|all in|yep|perf)\s+\$(?P<stake>\d+)(?:\s+ea)?",
    re.I,
)

# ── Josh proposed-pick patterns ──────────────────────────────────────────
_JOSH_TOTAL = re.compile(
    r"(?P<ou>over|under|[ou])\s*(?P<total>\d+\.?\d*)",
    re.I,
)
_JOSH_ML = re.compile(
    r"(?P<team>[A-Za-z][A-Za-z\s.'-]*?)\s+ml\b\s*(?P<odds>[-+]?\d+)?",
    re.I,
)
_JOSH_SPREAD = re.compile(
    r"(?P<team>[A-Za-z][A-Za-z\s.&'-]*?)\s+(?P<line>[-+]\d+\.?\d*)",
    re.I,
)
_JOSH_STAKE = re.compile(r"\(\s*\$(?P<stake>\d+)\s*\)|\$(?P<stake2>\d+)")


# ══════════════════════════════════════════════════════════════════════════
#  Data types
# ══════════════════════════════════════════════════════════════════════════


@dataclass
class _Matchup:
    text: str  # "Orlando Magic @ Utah Jazz"
    team_a: str  # away canonical
    team_b: str  # home canonical
    league: Optional[str] = None


@dataclass
class _ProposedPick:
    """A pick Josh proposes (may be confirmed generically by Zach)."""

    team: str  # canonical team or "Over"/"Under"
    line: str  # spread number, total number, or "ML"
    bet_type: str  # spread / total / ml
    segment: str = "FG"
    matchup: Optional[str] = None
    league: Optional[str] = None
    odds: str = "-110"  # default; overridden by Zach when available
    explicit_stake: Optional[int] = None  # Josh rarely specifies


@dataclass
class _ZachBet:
    """One confirmed bet extracted from a Zach message fragment."""

    team: str
    line: str
    odds: str
    stake: int  # dollars as Zach writes (50 → will be ×1000)
    segment: str = "FG"
    bet_type: str = "spread"
    raw: str = ""


# ══════════════════════════════════════════════════════════════════════════
#  Main parser
# ══════════════════════════════════════════════════════════════════════════


class ConversationalTelegramParser:
    """Deep-inference dialogue parser: Josh proposes → Zach confirms."""

    def __init__(self):
        self.reg = team_registry
        # Conversation state (reset per date)
        self._matchup_stack: List[_Matchup] = []
        self._pending_picks: List[_ProposedPick] = []
        self._league: Optional[str] = None
        self._segment: str = "FG"
        self._date: Optional[str] = None

    # ── public API ────────────────────────────────────────────────────────

    def parse_file(self, path: str, date_range: Tuple[str, str] | None = None) -> List[Pick]:
        return self.parse_text(Path(path).read_text(encoding="utf-8"), date_range)

    def parse_text(self, text: str, date_range: Tuple[str, str] | None = None) -> List[Pick]:
        start = end = None
        if date_range:
            start = datetime.strptime(date_range[0], "%Y-%m-%d").date()
            end = datetime.strptime(date_range[1], "%Y-%m-%d").date()

        msgs = _split_messages(text)
        # Sort chronologically. File is roughly newest-first, so for same-timestamp
        # messages, reverse file order (use inverted index as tiebreaker).
        n = len(msgs)
        msgs_indexed = [(s, ts, b, n - i) for i, (s, ts, b) in enumerate(msgs)]
        msgs_indexed.sort(key=lambda x: (x[1], x[3]))
        msgs = [(s, ts, b) for s, ts, b, _ in msgs_indexed]

        all_picks: List[Pick] = []

        for sender, ts, body in msgs:
            if start and end and (ts.date() < start or ts.date() > end):
                continue

            d = ts.strftime("%Y-%m-%d")
            if self._date != d:  # new day → reset context
                self._date = d
                self._segment = "FG"
                self._matchup_stack.clear()
                self._pending_picks.clear()
                self._league = None

            body = body.strip()
            if not body:
                continue

            sl = sender.lower()
            if "josh" in sl:
                self._handle_josh(body)
            elif "zach" in sl or "alex" in sl:
                picks = self._handle_confirmer(body, ts, d)
                all_picks.extend(picks)

        return all_picks

    # ══════════════════════════════════════════════════════════════════════
    #  Josh handling — extract context + proposed picks
    # ══════════════════════════════════════════════════════════════════════

    def _handle_josh(self, body: str):
        """Extract context and create pending proposed picks."""
        self._pending_picks.clear()

        body_lower = body.lower()
        # League keywords — clear stale matchups when switching leagues
        new_league = None
        if "nfl" in body_lower:
            new_league = "NFL"
        elif "nba" in body_lower:
            new_league = "NBA"
        elif any(k in body_lower for k in ("ncaaf", "cfb", "college football")):
            new_league = "NCAAF"
        elif any(k in body_lower for k in ("ncaam", "cbb", "college basketball", "ncaab", "cbk")):
            new_league = "NCAAM"
        if new_league and new_league != self._league:
            self._matchup_stack.clear()
            self._league = new_league
        elif new_league:
            self._league = new_league

        # Split on semicolons and newlines for individual proposals
        fragments = re.split(r"[;\n]+", body)

        current_matchup: Optional[_Matchup] = None
        current_segment = self._segment

        for frag in fragments:
            frag = frag.strip()
            if not frag:
                continue
            # Normalize "plus"/"minus" to +/- for spread parsing
            frag = re.sub(r"\bplus\s+", "+", frag, flags=re.I)
            frag = re.sub(r"\bminus\s+", "-", frag, flags=re.I)
            # ".5" → "0.5" for lines like "+.5"
            frag = re.sub(r"([-+])\.(\d)", r"\g<1>0.\2", frag)
            # Normalize numeric team names
            frag = re.sub(r"\b49s\b", "Niners", frag, flags=re.I)
            frag = re.sub(r"\b49ers\b", "Niners", frag, flags=re.I)
            frag = re.sub(r"\b76s\b", "Sixers", frag, flags=re.I)
            frag = re.sub(r"\b76ers\b", "Sixers", frag, flags=re.I)
            frag_lower = frag.lower()

            # -- Segment --
            for tok, seg in _SEGMENT_MAP.items():
                if re.search(r"\b" + re.escape(tok) + r"\b", frag_lower):
                    current_segment = seg
                    self._segment = seg

            # Strip segment tokens from fragment text for cleaner regex matching
            # (e.g. "Niners 2h +0.5" → "Niners +0.5")
            frag_for_picks = re.sub(
                r"\b(?:1h|2h|fg|fh|sh|1q|2q|3q|4q)\b", "", frag, flags=re.I
            ).strip()
            frag_for_picks = re.sub(r"\s{2,}", " ", frag_for_picks)  # collapse whitespace

            # -- Matchup --
            mu = self._extract_matchup(frag)
            if mu:
                current_matchup = mu
                self._matchup_stack.append(mu)

            # -- Picks (use segment-stripped frag for better regex matching) --
            picks = self._extract_josh_picks(frag_for_picks, current_matchup, current_segment)
            self._pending_picks.extend(picks)

    def _extract_matchup(self, text: str) -> Optional[_Matchup]:
        """Try to pull a matchup from text."""
        pm = _PIPE_MATCHUP.search(text)
        if pm:
            return self._build_matchup(pm.group(1), pm.group(2))

        m = _MATCHUP_AT.search(text)
        if m:
            mu = self._build_matchup(m.group(1), m.group(2))
            if mu:
                return mu

        m = _MATCHUP_VS.search(text)
        if m:
            mu = self._build_matchup(m.group(1), m.group(2))
            if mu:
                return mu

        return None

    def _build_matchup(self, raw_a: str, raw_b: str) -> Optional[_Matchup]:
        raw_a = re.sub(r"[;:,.\-—|]+$", "", raw_a).strip()
        raw_b = re.sub(r"[;:,.\-—|]+$", "", raw_b).strip()
        # Truncate at sentence boundary (". " or "—")
        raw_a = re.sub(r"\.\s+.*$", "", raw_a).strip()
        raw_b = re.sub(r"\.\s+.*$", "", raw_b).strip()
        raw_b = re.sub(r"\s*—\s*.*$", "", raw_b).strip()
        # Trim pick noise after team name in raw_b
        raw_b = re.sub(r"\s+[-+]\d.*$", "", raw_b).strip()
        for pat in (r"\b(fg|1h|2h|1q|ml)\b.*$",):
            raw_b = re.sub(pat, "", raw_b, flags=re.I).strip()

        na, la = self._normalize(raw_a)
        nb, lb = self._normalize(raw_b)
        if not na and not nb:
            return None

        a = na or raw_a.strip().title()
        b = nb or raw_b.strip().title()
        league = la or lb or self._league

        # Resolve league conflicts between the two teams
        if la and lb and la != lb:
            college = {"NCAAF", "NCAAM"}
            # Prefer college over pro
            if lb in college and la not in college:
                league = lb
            elif la in college and lb not in college:
                league = la
            # NBA vs NFL: check if one team name is unambiguously one sport
            elif {la, lb} == {"NBA", "NFL"}:
                # Check canonical names against known NBA-only / NFL-only indicators
                nba_only = {
                    "Trail Blazers",
                    "Timberwolves",
                    "Cavaliers",
                    "Pelicans",
                    "Grizzlies",
                    "Thunder",
                    "Mavericks",
                    "Nuggets",
                    "Celtics",
                    "Knicks",
                    "Nets",
                    "Clippers",
                    "Lakers",
                    "Warriors",
                    "76ers",
                    "Heat",
                    "Raptors",
                    "Magic",
                    "Pacers",
                    "Jazz",
                    "Suns",
                    "Hornets",
                    "Pistons",
                    "Bucks",
                    "Kings",
                    "Rockets",
                    "Spurs",
                    "Hawks",
                    "Wizards",
                    "Blazers",
                }
                if lb == "NBA" and any(w in (nb or "") for w in nba_only):
                    league = "NBA"
                    # Re-normalize first team with NBA context
                    self._league = "NBA"
                    na2, la2 = self._normalize(raw_a)
                    if na2 and la2 == "NBA":
                        a = na2
                elif la == "NBA" and any(w in (na or "") for w in nba_only):
                    league = "NBA"
                    self._league = "NBA"
                    nb2, lb2 = self._normalize(raw_b)
                    if nb2 and lb2 == "NBA":
                        b = nb2
        # CFB season ends mid-Jan; after that NCAAF → NCAAM
        if league == "NCAAF" and self._date and self._date >= "2026-01-20":
            league = "NCAAM"
        if league:
            self._league = league
        return _Matchup(text=f"{a} @ {b}", team_a=a, team_b=b, league=league)

    def _extract_josh_picks(
        self,
        frag: str,
        matchup: Optional[_Matchup],
        segment: str,
    ) -> List[_ProposedPick]:
        picks: List[_ProposedPick] = []
        frag_clean = frag.strip()
        if not frag_clean:
            return picks

        mu_text = (
            matchup.text
            if matchup
            else (self._matchup_stack[-1].text if self._matchup_stack else None)
        )
        mu_league = (
            matchup.league
            if matchup
            else (self._matchup_stack[-1].league if self._matchup_stack else self._league)
        )

        # Explicit stake from Josh?
        explicit_stake = None
        sm = _JOSH_STAKE.search(frag_clean)
        if sm:
            explicit_stake = int(sm.group("stake") or sm.group("stake2"))

        # -- Totals --
        for tm in _JOSH_TOTAL.finditer(frag_clean):
            ou_raw = tm.group("ou").lower()
            ou = "Over" if ou_raw in ("o", "over") else "Under"
            total = tm.group("total")
            picks.append(
                _ProposedPick(
                    team=ou,
                    line=total,
                    bet_type="total",
                    segment=segment,
                    matchup=mu_text,
                    league=mu_league,
                    explicit_stake=explicit_stake,
                )
            )

        # -- ML --
        for mm in _JOSH_ML.finditer(frag_clean):
            team_raw = mm.group("team").strip()
            # Strip trailing segment tokens from team name
            team_raw = re.sub(
                r"\s+(?:1h|2h|fg|1q|2q|3q|4q|fh|sh)$", "", team_raw, flags=re.I
            ).strip()
            # Strip leading conjunctions
            team_raw = re.sub(r"^(?:and|also|then)\s+", "", team_raw, flags=re.I).strip()
            tn, tl = self._normalize(team_raw)
            team = tn or team_raw.title()
            # Prefer matchup league when present (more context than individual team)
            league = mu_league or tl or self._league
            odds = mm.group("odds") or ""
            picks.append(
                _ProposedPick(
                    team=team,
                    line="ML",
                    bet_type="ml",
                    segment=segment,
                    matchup=mu_text,
                    league=league,
                    odds=odds if odds else "-110",
                    explicit_stake=explicit_stake,
                )
            )

        # -- Spreads (skip if already captured as ML or total) --
        ml_teams = {p.team.lower() for p in picks if p.bet_type == "ml"}
        for sm2 in _JOSH_SPREAD.finditer(frag_clean):
            team_raw = sm2.group("team").strip()
            if team_raw.lower() in ("over", "under", "o", "u", "fg", "1h", "2h", "1q"):
                continue
            # Skip if team_raw contains "ml" — likely a mismatch with ML regex
            if "ml" in team_raw.lower().split():
                continue
            # Strip trailing segment/PK tokens from team name
            team_raw = re.sub(
                r"\s+(?:1h|2h|fg|1q|2q|3q|4q|fh|sh|pk)$", "", team_raw, flags=re.I
            ).strip()
            # Strip leading conjunctions
            team_raw = re.sub(r"^(?:and|also|then)\s+", "", team_raw, flags=re.I).strip()
            tn, tl = self._normalize(team_raw)
            team = tn or team_raw.title()
            if team.lower() in ml_teams:
                continue
            league = mu_league or tl or self._league
            line = sm2.group("line")
            picks.append(
                _ProposedPick(
                    team=team,
                    line=line,
                    bet_type="spread",
                    segment=segment,
                    matchup=mu_text,
                    league=league,
                    explicit_stake=explicit_stake,
                )
            )

        return picks

    # ══════════════════════════════════════════════════════════════════════
    #  Zach / Alex handling — confirmation / rejection / explicit bets
    # ══════════════════════════════════════════════════════════════════════

    def _handle_confirmer(self, body: str, ts: datetime, date: str) -> List[Pick]:
        body_lower = body.lower().strip()

        # -- Rejection → skip --
        if re.search(
            r"\b(off the board|otb|no good|off board|cbk extra|shop closed)\b", body_lower
        ):
            if not re.search(r"\$\d+", body):
                return []

        # -- "Ok $50 ea" → generic with stake --
        m = _ZBET_GENERIC_STAKE.match(body.strip())
        if m:
            stake_override = int(m.group("stake"))
            return self._confirm_pending(ts, date, stake_override=stake_override)

        # -- Has dollar amounts → parse explicit bets --
        if re.search(r"\$\d+", body):
            return self._parse_explicit_bets(body, ts, date)

        # -- Generic "In" / "Ok" / "all good" → confirm pending --
        confirm_words = {
            "in",
            "ok",
            "yes",
            "all good",
            "good",
            "got it",
            "done",
            "all in",
            "yep",
            "perf",
            "perfect",
        }
        if body_lower in confirm_words or any(body_lower.startswith(w) for w in confirm_words):
            return self._confirm_pending(ts, date)

        return []

    # ── Explicit $ bets ──────────────────────────────────────────────────

    def _parse_explicit_bets(self, body: str, ts: datetime, date: str) -> List[Pick]:
        picks: List[Pick] = []
        parts = re.split(r"[,\n]+", body)

        for part in parts:
            part = part.strip()
            if not part or "$" not in part:
                continue
            if re.search(r"\b(off the board|otb|no good|cbk extra)\b", part, re.I):
                continue

            bet = self._parse_zach_fragment(part)
            if bet:
                picks.append(self._bet_to_pick(bet, ts, date))

        return picks

    def _parse_zach_fragment(self, text: str) -> Optional[_ZachBet]:
        text = text.strip()
        if "$" not in text:
            return None

        # Normalise: "1h$50" → "1h $50", "fg$25" → "fg $25"
        text = re.sub(r"(\d[hHqQ])\$", r"\1 $", text)
        text = re.sub(r"(fg|FG)\$", r"\1 $", text)

        # -- bare: "-102 $50" --
        m = _ZBET_BARE.match(text)
        if m:
            return self._bare_bet(m.group("odds"), int(m.group("stake")), text)

        # -- "odds on line $stake" --
        m = _ZBET_ON.search(text)
        if m:
            line = m.group("line")
            if not line.startswith(("+", "-")):
                line = f"+{line}"
            # Prefer pending pick context, then matchup stack
            if self._pending_picks:
                pp = self._pending_picks[0]
                return _ZachBet(
                    team=pp.team,
                    line=line,
                    odds=m.group("odds"),
                    stake=int(m.group("stake")),
                    segment=pp.segment,
                    bet_type="spread",
                    raw=text,
                )
            return _ZachBet(
                team=self._latest_team_a() or "Unknown",
                line=line,
                odds=m.group("odds"),
                stake=int(m.group("stake")),
                segment=self._segment,
                bet_type="spread",
                raw=text,
            )

        # -- PK --
        m = _ZBET_PK.match(text)
        if m:
            tn, _ = self._normalize(m.group("team").strip())
            seg = self._resolve_seg(m.group("seg"))
            return _ZachBet(
                team=tn or m.group("team").strip().title(),
                line="PK",
                odds=m.group("odds"),
                stake=int(m.group("stake")),
                segment=seg,
                bet_type="spread",
                raw=text,
            )

        # -- O/U with optional segment between total and odds --
        m = _ZBET_OU.match(text)
        if m:
            ou = "Over" if m.group("ou").lower() == "o" else "Under"
            seg = self._resolve_seg(m.group("seg1") or m.group("seg2"))
            return _ZachBet(
                team=ou,
                line=m.group("line"),
                odds=m.group("odds") or "-110",
                stake=int(m.group("stake")),
                segment=seg,
                bet_type="total",
                raw=text,
            )

        # -- spread: "team [ou?]line odds $stake [seg]" --
        m = _ZBET_SPREAD.match(text)
        if m:
            ou = (m.group("ou") or "").lower()
            line = m.group("line")
            seg_raw = (m.group("seg") or "").lower().strip()
            seg = self._resolve_seg(seg_raw)
            team_raw = m.group("team").strip()
            tn, _ = self._normalize(team_raw)

            if ou:
                ou_label = "Over" if ou == "o" else "Under"
                return _ZachBet(
                    team=ou_label,
                    line=line,
                    odds=m.group("odds"),
                    stake=int(m.group("stake")),
                    segment=seg,
                    bet_type="total",
                    raw=text,
                )
            else:
                if not line.startswith(("+", "-")):
                    line = f"+{line}"
                return _ZachBet(
                    team=tn or team_raw.title(),
                    line=line,
                    odds=m.group("odds"),
                    stake=int(m.group("stake")),
                    segment=seg,
                    bet_type="spread",
                    raw=text,
                )

        # -- ML: "team <3-digit> $stake [seg]" --
        m = _ZBET_ML.match(text)
        if m:
            team_raw = m.group("team").strip()
            tn, _ = self._normalize(team_raw)
            odds_raw = m.group("odds")
            seg = self._resolve_seg(m.group("seg"))
            if not odds_raw.startswith(("+", "-")):
                odds_raw = f"+{odds_raw}"
            return _ZachBet(
                team=tn or team_raw.title(),
                line="ML",
                odds=odds_raw,
                stake=int(m.group("stake")),
                segment=seg,
                bet_type="ml",
                raw=text,
            )

        return None

    def _bare_bet(self, odds: str, stake: int, raw: str) -> _ZachBet:
        """Handle a bare odds+stake line by inferring team from context."""
        if self._pending_picks:
            pp = self._pending_picks[0]
            return _ZachBet(
                team=pp.team,
                line=pp.line,
                odds=odds,
                stake=stake,
                segment=pp.segment,
                bet_type=pp.bet_type,
                raw=raw,
            )
        return _ZachBet(
            team=self._latest_team_a() or "Unknown",
            line="?",
            odds=odds,
            stake=stake,
            segment=self._segment,
            bet_type="spread",
            raw=raw,
        )

    # ── Generic "In" / "Ok" confirmation ─────────────────────────────────

    def _confirm_pending(
        self,
        ts: datetime,
        date: str,
        stake_override: int | None = None,
    ) -> List[Pick]:
        """Zach said 'In' / 'Ok' — confirm all pending Josh picks."""
        picks: List[Pick] = []
        for pp in self._pending_picks:
            league = pp.league or self._league
            # Last-resort: infer from total value when no league context
            if not league and pp.bet_type == "total":
                try:
                    tv = float(pp.line)
                    if tv > 100:
                        league = "NBA"
                    elif 15 <= tv <= 65:
                        league = "NFL"
                except ValueError:
                    pass
            # Stake
            if stake_override:
                stake = stake_override * 1000
            elif pp.explicit_stake:
                stake = pp.explicit_stake * 1000
            elif league in ("NCAAM", "NCAAF"):
                stake = 25000
            else:
                stake = 50000

            risk, to_win = _calc_amounts(pp.odds, Decimal(str(stake)))

            if pp.bet_type == "total":
                desc = f"{pp.team} {pp.line}"
            elif pp.bet_type == "ml":
                desc = f"{pp.team} ML"
            else:
                desc = f"{pp.team} {pp.line}"

            picks.append(
                Pick(
                    date_time_cst=ts,
                    date=date,
                    league=league,
                    matchup=pp.matchup,
                    segment=pp.segment,
                    pick_description=desc,
                    odds=pp.odds,
                    risk_amount=risk,
                    to_win_amount=to_win,
                    source_text=f"[Josh proposed] {desc}",
                )
            )

        self._pending_picks.clear()
        return picks

    # ── Convert _ZachBet → Pick ──────────────────────────────────────────

    def _bet_to_pick(self, bet: _ZachBet, ts: datetime, date: str) -> Pick:
        # Authoritative league from team_registry + extra aliases
        tn, team_league = (None, None)
        prefix_team_name = None  # for totals

        if bet.team not in ("Over", "Under"):
            tn, team_league = self._normalize(bet.team)
            # If normalized name is different, re-try with raw for league
            if not team_league and bet.raw:
                raw_prefix = re.match(r"([A-Za-z][A-Za-z\s.'-]+?)(?:\s+[\d+-])", bet.raw, re.I)
                if raw_prefix:
                    _, rl = self._normalize(raw_prefix.group(1).strip())
                    if rl:
                        team_league = rl

        # For totals, extract the team prefix from raw text for league + matchup
        if bet.team in ("Over", "Under") and bet.raw:
            prefix_m = re.match(r"([A-Za-z][A-Za-z\s.'-]+?)\s+[ou]", bet.raw, re.I)
            if prefix_m:
                prefix_team_name = prefix_m.group(1).strip()
                ptn, raw_league = self._normalize(prefix_team_name)
                if raw_league:
                    team_league = raw_league
                else:
                    team_league = self._resolve_league_for_team(prefix_team_name)

        # For college: if Josh explicitly set NCAAM or post-CFB season, override NCAAF → NCAAM
        if team_league == "NCAAF" and (self._league == "NCAAM" or (date and date >= "2026-01-20")):
            team_league = "NCAAM"

        league = team_league or self._resolve_league_for_team(bet.team) or self._league

        # Last-resort for totals: infer league from total value
        if not league and bet.bet_type == "total":
            try:
                tv = float(bet.line)
                if tv > 100:
                    league = "NBA"
                elif 15 <= tv <= 65:
                    league = "NFL"
            except ValueError:
                pass

        # Matchup: for totals use the prefix team, for sides use the bet team
        if bet.team in ("Over", "Under") and prefix_team_name:
            ptn2, _ = self._normalize(prefix_team_name)
            matchup = self._resolve_matchup_for_team(prefix_team_name, ptn2)
        else:
            matchup = self._resolve_matchup_for_team(bet.team, tn)

        # Stake: Zach $50 → $50,000
        stake = bet.stake * 1000
        risk, to_win = _calc_amounts(bet.odds, Decimal(str(stake)))

        if bet.bet_type == "total":
            desc = f"{bet.team} {bet.line}"
        elif bet.bet_type == "ml":
            desc = f"{bet.team} ML"
        else:
            desc = f"{bet.team} {bet.line}"

        return Pick(
            date_time_cst=ts,
            date=date,
            league=league,
            matchup=matchup,
            segment=bet.segment,
            pick_description=desc,
            odds=bet.odds,
            risk_amount=risk,
            to_win_amount=to_win,
            source_text=bet.raw,
        )

    # ── Resolution helpers ───────────────────────────────────────────────

    def _resolve_matchup_for_team(self, team: str, canonical: str | None = None) -> Optional[str]:
        """Find the matchup containing this team in the stack."""
        if team in ("Over", "Under"):
            # Use most recent matchup for totals
            return self._matchup_stack[-1].text if self._matchup_stack else None

        names: Set[str] = {team.lower()}
        if canonical:
            names.add(canonical.lower())

        # Search stack (most recent first) for a matchup mentioning this team
        for mu in reversed(self._matchup_stack):
            ta_low, tb_low = mu.team_a.lower(), mu.team_b.lower()
            mu_low = mu.text.lower()
            for n in names:
                if n in ta_low or n in tb_low or n in mu_low:
                    return mu.text

        # NO fallback to wrong matchup — return None if team not found
        return None

    def _normalize(self, name: str) -> Tuple[Optional[str], Optional[str]]:
        """Normalize via team_registry first, then fall back to _EXTRA_ALIASES.
        When current league context is set and the alias matches it better
        than the registry (e.g. 'Indiana' → Pacers/NBA vs Hoosiers/NCAAM),
        prefer the alias.
        """
        if not name:
            return None, None
        tn, tl = self.reg.normalize_team(name)
        alias = _EXTRA_ALIASES.get(name.lower().strip())

        # Context-aware: prefer alias when it matches current league ctx
        if tn and alias and self._league:
            if tl != self._league and alias[1] == self._league:
                return alias

        if tn:
            return tn, tl
        if alias:
            return alias
        return None, None

    def _resolve_league_for_team(self, team: str) -> Optional[str]:
        t_words = set(team.lower().split())
        if t_words & _NFL_WORDS:
            return "NFL"
        if t_words & _NBA_WORDS:
            return "NBA"
        last = team.lower().split()[-1] if team else ""
        if last in _NFL_WORDS:
            return "NFL"
        if last in _NBA_WORDS:
            return "NBA"
        # Check extra aliases
        alias = _EXTRA_ALIASES.get(team.lower().strip())
        if alias:
            return alias[1]
        return None

    def _resolve_seg(self, raw: str | None) -> str:
        if not raw:
            return self._segment
        raw = raw.lower().strip()
        if raw in ("ml",):
            return self._segment
        return _SEGMENT_MAP.get(raw, self._segment)

    def _latest_team_a(self) -> Optional[str]:
        return self._matchup_stack[-1].team_a if self._matchup_stack else None


# ══════════════════════════════════════════════════════════════════════════
#  Module helpers
# ══════════════════════════════════════════════════════════════════════════


def _split_messages(text: str) -> List[Tuple[str, datetime, str]]:
    messages: List[Tuple[str, datetime, str]] = []
    lines = text.splitlines()
    sender: Optional[str] = None
    ts: Optional[datetime] = None
    body: List[str] = []

    for raw in lines:
        m = _HEADER_RE.match(raw.strip())
        if m:
            if sender is not None:
                messages.append((sender, ts, "\n".join(body)))
            sender = m.group(1).strip()
            d, mo, y = int(m.group(2)), int(m.group(3)), int(m.group(4))
            h, mi = int(m.group(5)), int(m.group(6))
            s = int(m.group(7)) if m.group(7) else 0
            ts = datetime(y, mo, d, h, mi, s)
            body = []
        else:
            body.append(raw)

    if sender is not None:
        messages.append((sender, ts, "\n".join(body)))
    return messages


def _calc_amounts(odds_str: str, stake: Decimal) -> Tuple[Decimal, Decimal]:
    """(risk, to_win) from American odds.
    Neg odds → risk = stake×|odds|/100, to_win = stake.
    Pos odds → risk = stake, to_win = stake×odds/100.
    """
    try:
        val = int(re.search(r"[-+]?\d+", odds_str).group())
    except Exception:
        return stake, stake
    if val < 0:
        return stake * abs(val) / 100, stake
    return stake, stake * val / 100
