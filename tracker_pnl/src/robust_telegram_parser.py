"""
Robust Telegram Pick Parser - High accuracy extraction from Telegram HTML exports.
Handles multiple HTML files, proper date parsing, and intelligent noise filtering.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from bs4 import BeautifulSoup

from src.pick_tracker import Pick
from src.team_registry import team_registry


@dataclass
class ParseContext:
    """Context maintained across messages."""
    current_date: Optional[str] = None
    current_matchup: Optional[str] = None
    current_league: Optional[str] = None
    current_team: Optional[str] = None
    current_segment: str = "FG"
    last_timestamp: Optional[datetime] = None
    
    def reset_for_new_day(self):
        """Reset context for new day."""
        self.current_matchup = None
        self.current_segment = "FG"


class RobustTelegramParser:
    """High-accuracy Telegram message parser."""
    
    # Structured bet patterns (most specific first)
    BET_PATTERNS = [
        # "Team spread odds $amount" - e.g., "Mavs 8 -110 $50"
        re.compile(r'^([A-Za-z][A-Za-z\s&\'.,-]*?)\s+([-+]?\d+\.?\d*)\s+([-+]\d{3,})\s+\$(\d+)', re.I),
        
        # "Team o/uTotal odds $amount" - e.g., "Nets o219 -112 $50"  
        re.compile(r'^([A-Za-z][A-Za-z\s&\'.,-]*?)\s+([ou])(\d+\.?\d*)\s+([-+]\d{3,})\s+\$(\d+)', re.I),
        
        # Over/Under with odds - e.g., "Over 231 (-110)"
        re.compile(r'^(over|under)\s+(\d+\.?\d*)\s*\(?([-+]\d{3,})\)?', re.I),
        
        # Team spread with segment and odds - e.g., "Jazz +7 1H -110"
        re.compile(r'^([A-Za-z][A-Za-z\s&\'.,-]*?)\s+([-+]?\d+\.?\d*)\s+(1[hH]|2[hH]|[fF][gG]|1[qQ]|2[qQ]|3[qQ]|4[qQ])\s+([-+]\d{3,})', re.I),
        
        # Team spread odds (no amount) - e.g., "Lakers -6.5 -110"
        re.compile(r'^([A-Za-z][A-Za-z\s&\'.,-]*?)\s+([-+]?\d+\.?\d*)\s+([-+]\d{3,})$', re.I),
        
        # Team ML with odds - e.g., "Jazz ML +200"
        re.compile(r'^([A-Za-z][A-Za-z\s&\'.,-]*?)\s+[mM][lL]\s*([-+]\d{3,})?', re.I),
        
        # Simple team spread - e.g., "Bears +7" or "Chiefs -3.5"
        re.compile(r'^([A-Za-z][A-Za-z\s&\'.,-]{2,}?)\s+([-+]\d+\.?\d*)$', re.I),
        
        # Over/Under simple - e.g., "Over 45.5" or "Under 231"
        re.compile(r'^(over|under)\s+(\d+\.?\d*)$', re.I),
        
        # Short form "o/u number odds" - e.g., "o219 -112"
        re.compile(r'^([ou])(\d+\.?\d*)\s+([-+]\d{3,})', re.I),
    ]
    
    # Segment patterns
    SEGMENT_MAP = {
        "1h": "1H", "fh": "1H", "first half": "1H", "1st half": "1H",
        "2h": "2H", "sh": "2H", "second half": "2H", "2nd half": "2H",
        "fg": "FG", "full": "FG", "full game": "FG", "game": "FG",
        "1q": "1Q", "2q": "2Q", "3q": "3Q", "4q": "4Q",
    }
    
    # Noise patterns - messages to completely skip
    NOISE_PATTERNS = [
        re.compile(r'^(ok|okay|yes|no|yeah|nah|lol|haha|nice|cool|ty|thx|thanks?)$', re.I),
        re.compile(r'^(good|great|perfect|awesome|alright|sure|yup|yep|nope)$', re.I),
        re.compile(r'^[?!.]+$'),  # Just punctuation
        re.compile(r'^(hi|hello|hey|bye|goodbye|gn|gm|good morning|good night)', re.I),
        re.compile(r'^\d{1,2}$'),  # Just 1-2 digit numbers
        re.compile(r'^(what|how|why|when|where|who)\s', re.I),  # Questions
        re.compile(r'^@\w+', re.I),  # @ mentions only
        re.compile(r'pizza|fuck|gay|shit|crap|dude|bro\b', re.I),  # Casual chat
    ]
    
    # League inference keywords
    NFL_TEAMS = {"chiefs", "bills", "cowboys", "packers", "eagles", "ravens", "49ers", 
                 "dolphins", "lions", "bears", "vikings", "texans", "bengals", "broncos",
                 "steelers", "patriots", "jets", "giants", "chargers", "rams", "seahawks",
                 "cardinals", "falcons", "panthers", "saints", "bucs", "buccaneers",
                 "browns", "raiders", "colts", "jaguars", "titans", "commanders"}
    
    NBA_TEAMS = {"lakers", "celtics", "warriors", "heat", "bulls", "nets", "knicks",
                 "clippers", "rockets", "spurs", "mavs", "mavericks", "nuggets", "suns",
                 "grizzlies", "pelicans", "jazz", "timberwolves", "thunder", "blazers",
                 "kings", "hawks", "hornets", "cavaliers", "cavs", "pistons", "pacers",
                 "bucks", "magic", "76ers", "sixers", "raptors", "wizards"}
    
    def __init__(self):
        self.context = ParseContext()
        self.team_registry = team_registry
    
    def parse_files(self, file_paths: List[str], date_range: Tuple[str, str] = None) -> List[Pick]:
        """Parse multiple Telegram HTML files."""
        all_picks = []
        
        for file_path in file_paths:
            path = Path(file_path)
            if path.exists():
                picks = self.parse_file(str(path), date_range)
                all_picks.extend(picks)
        
        return all_picks
    
    def parse_file(self, file_path: str, date_range: Tuple[str, str] = None) -> List[Pick]:
        """Parse a single Telegram HTML file."""
        with open(file_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        
        return self.parse_html(html_content, date_range)
    
    def parse_html(self, html_content: str, date_range: Tuple[str, str] = None) -> List[Pick]:
        """Parse Telegram HTML export."""
        soup = BeautifulSoup(html_content, 'html.parser')
        picks = []
        
        # Parse date range
        start_date = end_date = None
        if date_range:
            start_date = datetime.strptime(date_range[0], "%Y-%m-%d").date()
            end_date = datetime.strptime(date_range[1], "%Y-%m-%d").date()
        
        messages = soup.find_all('div', class_='message')
        
        for msg in messages:
            # Skip service messages
            if 'service' in msg.get('class', []):
                continue
            
            # Extract timestamp
            date_div = msg.find('div', class_='date')
            if date_div and date_div.get('title'):
                timestamp = self._parse_timestamp(date_div['title'])
                if timestamp:
                    # Check date range
                    if start_date and end_date:
                        msg_date = timestamp.date()
                        if msg_date < start_date or msg_date > end_date:
                            continue
                    
                    # Update context
                    new_date = timestamp.strftime("%Y-%m-%d")
                    if self.context.current_date != new_date:
                        self.context.current_date = new_date
                        self.context.reset_for_new_day()
                    self.context.last_timestamp = timestamp
            
            # Skip if no date
            if not self.context.current_date:
                continue
            
            # Extract text
            body_div = msg.find('div', class_='body')
            if not body_div:
                continue
            
            text_divs = body_div.find_all('div', class_='text')
            if not text_divs:
                continue
            
            message_text = ' '.join(div.get_text(strip=True) for div in text_divs)
            
            # Parse message
            message_picks = self._parse_message(message_text)
            picks.extend(message_picks)
        
        return picks
    
    def _parse_timestamp(self, title: str) -> Optional[datetime]:
        """Parse timestamp from Telegram date title and convert to CST.
        
        Telegram format: "28.11.2025 18:38:40 UTC-06:00"
        UTC-06:00 is CST (Central Standard Time), so times are already in CST.
        """
        try:
            # Extract date, time, and timezone offset
            match = re.match(
                r'(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s*(?:UTC)?([-+]\d{2}:\d{2})?', 
                title
            )
            if match:
                day, month, year, hour, minute, second, tz_offset = match.groups()
                
                # Create datetime
                dt = datetime(int(year), int(month), int(day), 
                             int(hour), int(minute), int(second))
                
                # If timezone is provided and not CST (-06:00), convert
                if tz_offset and tz_offset != "-06:00":
                    # Parse offset hours
                    offset_hours = int(tz_offset[:3])
                    cst_offset = -6
                    hour_diff = cst_offset - offset_hours
                    
                    # Adjust to CST
                    from datetime import timedelta
                    dt = dt + timedelta(hours=hour_diff)
                
                return dt
        except:
            pass
        return None
    
    def _parse_message(self, text: str) -> List[Pick]:
        """Parse a single message for picks."""
        picks = []
        text = text.strip()
        
        # Skip empty or very short
        if not text or len(text) < 3:
            return []
        
        # Skip noise
        if self._is_noise(text):
            return []
        
        # Check for segment updates
        self._update_segment(text)
        
        # Check for matchup
        if self._extract_matchup(text):
            pass  # Continue to check for picks
        
        # Check for league mentions
        self._update_league(text)
        
        # Check for structured format "TEAM1 @ TEAM2 / SEGMENT / PICK (ODDS)"
        if "/" in text and "@" in text:
            slash_picks = self._parse_slash_format(text)
            if slash_picks:
                picks.extend(slash_picks)
                return picks
        
        # Check for concatenated bets (no separators)
        # Pattern: "Team spread odds $amount" repeated
        if "$" in text and len(text) > 50:
            concat_picks = self._parse_concatenated_bets(text)
            if concat_picks:
                picks.extend(concat_picks)
                return picks
        
        # Try structured patterns first
        for pattern in self.BET_PATTERNS:
            match = pattern.match(text)
            if match:
                pick = self._create_pick_from_match(match, pattern.pattern)
                if pick:
                    picks.append(pick)
                    return picks  # One pick per message typically
        
        # Try parsing multi-part message (semicolon/comma separated)
        parts = re.split(r'[;]|\s{2,}', text)
        if len(parts) > 1:
            for part in parts:
                part = part.strip()
                if len(part) > 3:
                    for pattern in self.BET_PATTERNS:
                        match = pattern.match(part)
                        if match:
                            pick = self._create_pick_from_match(match, pattern.pattern)
                            if pick:
                                picks.append(pick)
                                break
        
        return picks
    
    def _parse_slash_format(self, text: str) -> List[Pick]:
        """Parse 'TEAM1 @ TEAM2 / SEGMENT / PICK (ODDS)' format."""
        picks = []
        
        # Split by common bet separators - might be joined without spaces
        # Pattern: matchup/segment/pick(odds) repeated
        pattern = re.compile(
            r'([A-Za-z][A-Za-z\s&\'.,-]+?)\s*@\s*([A-Za-z][A-Za-z\s&\'.,-]+?)\s*/\s*'
            r'(1H|2H|FG|1Q|2Q|3Q|4Q)\s*/\s*'
            r'([A-Za-z]+)\s+([-+]?\d+\.?\d*)\s*\(([-+]\d+)\)',
            re.I
        )
        
        for match in pattern.finditer(text):
            team1, team2, segment, pick_team, spread, odds = match.groups()
            
            # Normalize teams
            t1_norm, l1 = self.team_registry.normalize_team(team1.strip())
            t2_norm, l2 = self.team_registry.normalize_team(team2.strip())
            pick_norm, _ = self.team_registry.normalize_team(pick_team.strip())
            
            matchup = f"{t1_norm or team1.strip()} vs {t2_norm or team2.strip()}"
            
            # Handle OVER/UNDER
            if pick_team.upper() in ["OVER", "UNDER"]:
                pick_desc = f"{pick_team.title()} {spread}"
            else:
                pick_desc = f"{pick_norm or pick_team} {spread}"
            
            picks.append(Pick(
                date_time_cst=self.context.last_timestamp,
                date=self.context.current_date,
                matchup=matchup,
                pick_description=pick_desc,
                segment=segment.upper(),
                odds=odds,
                league=l1 or l2 or self.context.current_league
            ))
        
        return picks
    
    def _parse_concatenated_bets(self, text: str) -> List[Pick]:
        """Parse concatenated bets without clear separators."""
        picks = []
        
        # Split on $amount patterns
        # "Boston -3.5 -115 1h $50Boston o120 -115 1h $50..."
        parts = re.split(r'\$\d+', text)
        
        for part in parts:
            part = part.strip()
            if not part or len(part) < 5:
                continue
            
            # Try to match bet patterns
            for pattern in self.BET_PATTERNS:
                match = pattern.match(part)
                if match:
                    pick = self._create_pick_from_match(match, pattern.pattern)
                    if pick:
                        picks.append(pick)
                        break
            else:
                # Try more flexible parsing
                # Pattern: Team spread odds segment
                flex_match = re.match(
                    r'([A-Za-z][A-Za-z\s&\'.,-]*?)\s*'
                    r'([ou])?(\d+\.?\d*)\s*'
                    r'([-+]\d{3,})?\s*'
                    r'(1h|2h|fg)?',
                    part, re.I
                )
                
                if flex_match:
                    team, ou, spread, odds, segment = flex_match.groups()
                    team = team.strip()
                    
                    # Normalize
                    team_norm, league = self.team_registry.normalize_team(team)
                    
                    if team_norm or len(team) >= 3:
                        # Build pick description
                        if ou:
                            pick_desc = f"{'Over' if ou.lower() == 'o' else 'Under'} {spread}"
                        else:
                            pick_desc = f"{team_norm or team} +{spread}" if spread else f"{team_norm or team} ML"
                        
                        picks.append(Pick(
                            date_time_cst=self.context.last_timestamp,
                            date=self.context.current_date,
                            matchup=self.context.current_matchup,
                            pick_description=pick_desc,
                            segment=self.SEGMENT_MAP.get(segment.lower() if segment else "fg", "FG"),
                            odds=odds,
                            league=league or self.context.current_league
                        ))
        
        return picks
    
    def _is_noise(self, text: str) -> bool:
        """Check if message is noise."""
        text_lower = text.lower().strip()
        
        # Check noise patterns
        for pattern in self.NOISE_PATTERNS:
            if pattern.search(text_lower):
                return True
        
        # Too short without numbers
        if len(text) < 5 and not re.search(r'\d', text):
            return True
        
        return False
    
    def _update_segment(self, text: str):
        """Update segment from text."""
        text_lower = text.lower()
        for key, segment in self.SEGMENT_MAP.items():
            if re.search(r'\b' + re.escape(key) + r'\b', text_lower):
                self.context.current_segment = segment
                return
    
    def _extract_matchup(self, text: str) -> bool:
        """Extract matchup from text."""
        patterns = [
            re.compile(r'([A-Za-z][A-Za-z\s&\'.,-]+?)\s+(?:vs\.?|versus|v\.?)\s+([A-Za-z][A-Za-z\s&\'.,-]+)', re.I),
            re.compile(r'([A-Za-z][A-Za-z\s&\'.,-]+?)\s+@\s+([A-Za-z][A-Za-z\s&\'.,-]+)', re.I),
        ]
        
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                team1 = match.group(1).strip()
                team2 = match.group(2).strip()
                
                # Normalize
                t1_norm, l1 = self.team_registry.normalize_team(team1)
                t2_norm, l2 = self.team_registry.normalize_team(team2)
                
                if t1_norm or t2_norm:
                    t1 = t1_norm or team1
                    t2 = t2_norm or team2
                    self.context.current_matchup = f"{t1} vs {t2}"
                    if l1:
                        self.context.current_league = l1
                    elif l2:
                        self.context.current_league = l2
                    return True
        
        return False
    
    def _update_league(self, text: str):
        """Update league from text."""
        text_lower = text.lower()
        
        # Direct mentions
        if "nfl" in text_lower:
            self.context.current_league = "NFL"
        elif "nba" in text_lower:
            self.context.current_league = "NBA"
        elif any(x in text_lower for x in ["ncaaf", "cfb", "college football"]):
            self.context.current_league = "NCAAF"
        elif any(x in text_lower for x in ["ncaam", "cbb", "college basketball", "ncaab"]):
            self.context.current_league = "NCAAM"
        
        # Infer from team names
        words = set(re.findall(r'\b\w+\b', text_lower))
        if words & self.NFL_TEAMS:
            self.context.current_league = "NFL"
        elif words & self.NBA_TEAMS:
            self.context.current_league = "NBA"
    
    def _create_pick_from_match(self, match: re.Match, pattern_str: str) -> Optional[Pick]:
        """Create Pick from regex match."""
        groups = match.groups()
        
        # Determine type based on pattern
        if groups[0].lower() in ["over", "under", "o", "u"]:
            # Total bet
            ou_type = "Over" if groups[0].lower() in ["over", "o"] else "Under"
            total = groups[1]
            odds = groups[2] if len(groups) > 2 else None
            
            return Pick(
                date_time_cst=self.context.last_timestamp,
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{ou_type} {total}",
                segment=self.context.current_segment,
                odds=odds,
                league=self.context.current_league
            )
        else:
            # Team bet
            team_text = groups[0].strip()
            
            # Normalize team
            team_norm, league = self.team_registry.normalize_team(team_text, self.context.current_league)
            
            if not team_norm:
                # Check if it looks like a team name (at least 3 chars)
                if len(team_text) < 3:
                    return None
                team_norm = team_text.title()
            
            # Update context
            self.context.current_team = team_norm
            if league:
                self.context.current_league = league
            
            # Determine spread/ML/total type
            if len(groups) > 1 and groups[1]:
                second = groups[1]
                
                # Check if it's o/u (team total)
                if second and second.lower() in ["o", "u"]:
                    ou_type = "Over" if second.lower() == "o" else "Under"
                    total = groups[2] if len(groups) > 2 else None
                    odds = groups[3] if len(groups) > 3 else None
                    
                    return Pick(
                        date_time_cst=self.context.last_timestamp,
                        date=self.context.current_date,
                        matchup=self.context.current_matchup,
                        pick_description=f"{team_norm} {ou_type} {total}",
                        segment=self.context.current_segment,
                        odds=odds,
                        league=league or self.context.current_league
                    )
                
                # Regular spread
                spread = second
                
                # Check for segment in third position
                segment = self.context.current_segment
                odds = None
                
                if len(groups) > 2 and groups[2]:
                    third = groups[2]
                    if third.lower() in self.SEGMENT_MAP:
                        segment = self.SEGMENT_MAP[third.lower()]
                        if len(groups) > 3 and groups[3]:
                            odds = groups[3]
                    else:
                        # Third is odds
                        odds = third
                
                # Ensure spread has sign
                if spread and not spread.startswith(('+', '-')):
                    spread = f"+{spread}"  # Default to plus
                
                return Pick(
                    date_time_cst=self.context.last_timestamp,
                    date=self.context.current_date,
                    matchup=self.context.current_matchup,
                    pick_description=f"{team_norm} {spread}",
                    segment=segment,
                    odds=odds,
                    league=league or self.context.current_league
                )
            
            # ML only
            return Pick(
                date_time_cst=self.context.last_timestamp,
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{team_norm} ML",
                segment=self.context.current_segment,
                odds=groups[1] if len(groups) > 1 and groups[1] else None,
                league=league or self.context.current_league
            )


def parse_telegram_directory(directory: str = "telegram_text_history_data",
                            date_range: Tuple[str, str] = None) -> List[Pick]:
    """Convenience function to parse all HTML files in directory."""
    dir_path = Path(directory)
    html_files = list(dir_path.glob("*.html"))
    
    parser = RobustTelegramParser()
    return parser.parse_files([str(f) for f in html_files], date_range)