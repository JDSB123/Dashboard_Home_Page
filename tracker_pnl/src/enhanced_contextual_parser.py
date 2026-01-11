"""
Enhanced contextual pick parser with improved accuracy and recall.
Uses comprehensive team registry and advanced parsing techniques.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup

from src.pick_tracker import Pick
from src.team_registry import team_registry


# Segment mappings
SEGMENT_MAP = {
    "fh": "1H", "1h": "1H", "first half": "1H", "1st half": "1H",
    "2h": "2H", "sh": "2H", "second half": "2H", "2nd half": "2H",
    "fg": "FG", "full game": "FG", "game": "FG",
    "1q": "1Q", "first quarter": "1Q", "1st quarter": "1Q",
    "2q": "2Q", "second quarter": "2Q", "2nd quarter": "2Q",
    "3q": "3Q", "third quarter": "3Q", "3rd quarter": "3Q",
    "4q": "4Q", "fourth quarter": "4Q", "4th quarter": "4Q",
}

# League mappings
LEAGUE_MAP = {
    "nfl": "NFL", "national football": "NFL", "pro football": "NFL",
    "nba": "NBA", "national basketball": "NBA", "pro basketball": "NBA", 
    "ncaaf": "NCAAF", "cfb": "NCAAF", "college football": "NCAAF", "ncaa football": "NCAAF",
    "ncaam": "NCAAM", "cbb": "NCAAM", "college basketball": "NCAAM", "ncaa basketball": "NCAAM", "ncaab": "NCAAM"
}

# Sport keywords for league inference
SPORT_KEYWORDS = {
    "NBA": ["lakers", "celtics", "warriors", "heat", "bulls", "nets", "knicks", "clippers", "rockets", "spurs"],
    "NFL": ["chiefs", "bills", "cowboys", "packers", "patriots", "steelers", "ravens", "49ers", "eagles", "broncos"],
    "NCAAF": ["alabama", "ohio state", "georgia", "michigan", "clemson", "lsu", "notre dame", "texas", "oklahoma"],
    "NCAAM": ["duke", "north carolina", "kentucky", "kansas", "villanova", "gonzaga", "ucla", "michigan state"]
}


@dataclass
class ConversationContext:
    """Maintains context across messages in a conversation."""
    current_matchup: Optional[str] = None
    current_league: Optional[str] = None
    current_team: Optional[str] = None
    current_date: Optional[str] = None
    pending_picks: List[Dict] = None
    last_message_time: Optional[datetime] = None
    bet_amount: Optional[str] = None
    
    def __post_init__(self):
        if self.pending_picks is None:
            self.pending_picks = []
    
    def reset(self):
        """Reset context for new conversation."""
        self.current_matchup = None
        self.current_league = None
        self.current_team = None
        self.pending_picks = []
    
    def is_new_conversation(self, message_time: Optional[datetime]) -> bool:
        """Check if this is a new conversation based on time gap."""
        if not message_time or not self.last_message_time:
            return False
        time_gap = (message_time - self.last_message_time).total_seconds() / 60
        return time_gap > 30  # 30 minute gap = new conversation


class EnhancedContextualPickParser:
    """Enhanced parser with improved team recognition and pattern matching."""
    
    def __init__(self):
        self.context = ConversationContext()
        self.team_registry = team_registry
        
        # Betting patterns (more flexible)
        self.betting_patterns = [
            # Standard patterns
            r"(\w[\w\s&'.-]*?)\s+([-+]?\d+\.?\d*)\s+(\w+)\s+([-+]?\d+)",  # Team spread segment odds
            r"(over|under|o|u)\s*(\d+\.?\d*)\s+(\w+)\s+([-+]?\d+)",  # Total segment odds
            r"(\w[\w\s&'.-]*?)\s+([-+]?\d+\.?\d*)\s+([-+]?\d+)",  # Team spread odds (no explicit segment)
            r"(over|under|o|u)\s*(\d+\.?\d*)\s+([-+]?\d+)",  # Total odds (no explicit segment)
            
            # Flexible patterns
            r"(\w[\w\s&'.-]*?)\s+([-+]?\d+\.?\d*)",  # Team spread (no odds)
            r"(over|under|o|u)\s*(\d+\.?\d*)",  # Total (no odds)
            r"(\w[\w\s&'.-]*?)\s+ml\s*([-+]?\d+)?",  # Moneyline
            r"(\w[\w\s&'.-]*?)\s+\+(\d+\.?\d*)",  # Explicit plus spread
            r"(\w[\w\s&'.-]*?)\s+\-(\d+\.?\d*)",  # Explicit minus spread
        ]
        
        # Common betting abbreviations
        self.abbreviations = {
            "o": "over", "u": "under", "ov": "over", "un": "under",
            "ml": "ML", "tt": "TT", "fg": "FG", "fh": "1H", "sh": "2H",
            "1h": "1H", "2h": "2H", "1q": "1Q", "2q": "2Q", "3q": "3Q", "4q": "4Q"
        }
    
    def parse_html_conversation(self, html_content: str, default_date: Optional[str] = None) -> List[Pick]:
        """Parse HTML conversation with enhanced context awareness."""
        soup = BeautifulSoup(html_content, 'html.parser')
        picks = []
        
        # Process each message
        for message_div in soup.find_all('div', class_='message'):
            # Extract message text
            body_div = message_div.find('div', class_='body')
            if not body_div:
                continue
            
            # Get text content
            text_divs = body_div.find_all('div', class_='text')
            if not text_divs:
                continue
            
            message_text = ' '.join(div.get_text(strip=True) for div in text_divs)
            
            # Extract timestamp if available
            date_div = message_div.find('div', class_='date')
            message_time = None
            if date_div:
                try:
                    date_text = date_div.get('title', '')
                    if date_text:
                        message_time = datetime.strptime(date_text, "%d.%m.%Y %H:%M:%S")
                        self.context.current_date = message_time.strftime("%Y-%m-%d")
                except:
                    pass
            
            # Check for new conversation
            if self.context.is_new_conversation(message_time):
                self.context.reset()
            
            # Update last message time
            if message_time:
                self.context.last_message_time = message_time
            
            # Parse message with context
            message_picks = self._parse_message_with_context(message_text, message_time)
            picks.extend(message_picks)
        
        # Set default date if not found in messages
        if default_date:
            for pick in picks:
                if not pick.date:
                    pick.date = default_date
        
        return picks
    
    def _parse_message_with_context(self, text: str, message_time: Optional[datetime] = None) -> List[Pick]:
        """Parse a single message with full context awareness."""
        picks = []
        text_lower = text.lower()
        
        # Skip obvious non-betting messages (but be less aggressive)
        if self._is_definite_non_betting_message(text_lower):
            return []
        
        # Check for bet amount updates
        if self._update_bet_amount(text):
            return []
        
        # Try different parsing strategies
        
        # 1. Check for structured summaries
        if any(marker in text_lower for marker in ["hit +", "miss -", "push", "win +", "loss -"]):
            summary_picks = self._parse_formatted_summary(text)
            if summary_picks:
                return summary_picks
        
        # 2. Check for matchup announcements
        if self._extract_matchup(text):
            # Matchup extracted, continue to parse picks
            pass
        
        # 3. Check for league mentions
        self._extract_league(text)
        
        # 4. Parse betting lines
        betting_picks = self._parse_betting_lines(text, message_time)
        picks.extend(betting_picks)
        
        # 5. Try conversational patterns
        if not picks:
            conversational_picks = self._parse_conversational_patterns(text)
            picks.extend(conversational_picks)
        
        return picks
    
    def _is_definite_non_betting_message(self, text_lower: str) -> bool:
        """Filter out messages that are definitely not betting-related (less aggressive)."""
        # Only filter out very obvious non-betting content
        non_betting_phrases = [
            "good morning", "good night", "how are you", "what's up",
            "thank you", "thanks", "you're welcome", "sorry",
            "hello", "hi there", "bye", "goodbye",
            "lol", "haha", "nice", "cool", "awesome",
            "?", "!", "okay", "ok", "yes", "no", "yeah", "nah"
        ]
        
        # Only filter if message is ONLY these phrases
        cleaned = text_lower.strip()
        if cleaned in non_betting_phrases:
            return True
        
        # Filter very short messages without numbers
        if len(cleaned) < 5 and not any(char.isdigit() for char in cleaned):
            return True
        
        return False
    
    def _update_bet_amount(self, text: str) -> bool:
        """Check if message updates bet amount."""
        patterns = [
            r"\$?([\d,]+)\s*(?:bet|unit|play|risk)",
            r"(?:bet|unit|play|risk)\s*\$?([\d,]+)",
            r"^\$?([\d,]+)$"  # Just a number (possible bet amount)
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount = match.group(1).replace(",", "")
                self.context.bet_amount = amount
                return True
        return False
    
    def _extract_matchup(self, text: str) -> bool:
        """Extract matchup from text."""
        # Matchup patterns
        patterns = [
            r"(\w[\w\s&'.-]*?)\s+(?:vs\.?|versus|@|at)\s+(\w[\w\s&'.-]*)",
            r"(\w[\w\s&'.-]*?)\s+v\s+(\w[\w\s&'.-]*)",
            r"(\w[\w\s&'.-]*?)\s*/\s*(\w[\w\s&'.-]*)"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                team1 = match.group(1).strip()
                team2 = match.group(2).strip()
                
                # Normalize team names
                team1_norm, league1 = self.team_registry.normalize_team(team1, self.context.current_league)
                team2_norm, league2 = self.team_registry.normalize_team(team2, self.context.current_league)
                
                if team1_norm and team2_norm:
                    self.context.current_matchup = f"{team1_norm} vs {team2_norm}"
                    # Update league if found
                    if league1:
                        self.context.current_league = league1
                    return True
        
        return False
    
    def _extract_league(self, text: str):
        """Extract league from text."""
        text_lower = text.lower()
        
        # Direct league mentions
        for keyword, league in LEAGUE_MAP.items():
            if keyword in text_lower:
                self.context.current_league = league
                return
        
        # Infer from team mentions
        for league, keywords in SPORT_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                self.context.current_league = league
                return
    
    def _parse_formatted_summary(self, text: str) -> List[Pick]:
        """Parse formatted summary blocks."""
        picks = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Pattern: Team +/- spread league HIT/MISS +/- amount
            pattern = r"([\w\s&'.-]+?)\s+([-+]?\d+\.?\d*)\s+(\w+)\s+(HIT|MISS|PUSH|WIN|LOSS)\s*([-+]?\$?[\d,]+)?"
            match = re.search(pattern, line, re.IGNORECASE)
            
            if match:
                team = match.group(1).strip()
                spread = match.group(2)
                league = match.group(3)
                status = match.group(4)
                
                # Normalize team
                team_norm, inferred_league = self.team_registry.normalize_team(team, league)
                
                pick = Pick(
                    date=self.context.current_date,
                    matchup=self.context.current_matchup,
                    pick_description=f"{team_norm or team} {spread}",
                    segment="FG",  # Summaries usually FG
                    odds=None,
                    status=status.upper(),
                    league=inferred_league or self._normalize_league(league)
                )
                picks.append(pick)
        
        return picks
    
    def _parse_betting_lines(self, text: str, message_time: Optional[datetime] = None) -> List[Pick]:
        """Parse betting lines with multiple pattern strategies."""
        picks = []
        
        # Normalize text
        text = self._normalize_betting_text(text)
        
        # Split by common delimiters
        segments = re.split(r'[;,\n]|\s{2,}', text)
        
        for segment in segments:
            segment = segment.strip()
            if not segment:
                continue
            
            # Try each betting pattern
            for pattern in self.betting_patterns:
                match = re.search(pattern, segment, re.IGNORECASE)
                if match:
                    pick = self._create_pick_from_match(match, segment)
                    if pick:
                        picks.append(pick)
                        break
        
        return picks
    
    def _parse_conversational_patterns(self, text: str) -> List[Pick]:
        """Parse conversational betting patterns."""
        picks = []
        text_lower = text.lower()
        
        # Pattern: "take the [team]" or "on [team]" or "like [team]"
        patterns = [
            r"(?:take|on|like|love|play|bet)\s+(?:the\s+)?(\w[\w\s&'.-]*?)(?:\s+([-+]?\d+\.?\d*))?",
            r"(\w[\w\s&'.-]*?)\s+(?:to\s+)?(?:win|cover)",
            r"going\s+with\s+(\w[\w\s&'.-]*?)"
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text_lower)
            for match in matches:
                team_text = match.group(1).strip()
                spread = match.group(2) if len(match.groups()) > 1 else None
                
                # Normalize team
                team_norm, league = self.team_registry.normalize_team(team_text, self.context.current_league)
                
                if team_norm:
                    pick_desc = f"{team_norm} {spread}" if spread else f"{team_norm} ML"
                    pick = Pick(
                        date=self.context.current_date,
                        matchup=self.context.current_matchup,
                        pick_description=pick_desc,
                        segment="FG",
                        odds=None,
                        league=league or self.context.current_league
                    )
                    picks.append(pick)
        
        return picks
    
    def _normalize_betting_text(self, text: str) -> str:
        """Normalize betting text for easier parsing."""
        # Expand abbreviations
        text_lower = text.lower()
        for abbrev, full in self.abbreviations.items():
            # Use word boundaries for abbreviations
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            text_lower = re.sub(pattern, full, text_lower)
        
        # Normalize spacing around operators
        text_lower = re.sub(r'([+\-])', r' \1', text_lower)
        text_lower = re.sub(r'\s+', ' ', text_lower)
        
        # Handle special formats
        text_lower = re.sub(r'o(\d+)', r'over \1', text_lower)  # o45 -> over 45
        text_lower = re.sub(r'u(\d+)', r'under \1', text_lower)  # u45 -> under 45
        
        return text_lower
    
    def _create_pick_from_match(self, match: re.Match, full_text: str) -> Optional[Pick]:
        """Create a Pick object from a regex match."""
        groups = match.groups()
        
        # Determine what we matched
        team_or_type = groups[0] if groups else None
        
        # Handle Over/Under
        if team_or_type and team_or_type.lower() in ["over", "under", "o", "u"]:
            total = groups[1] if len(groups) > 1 else None
            
            # Try to find segment and odds
            segment = None
            odds = None
            
            if len(groups) > 2:
                potential_segment = groups[2]
                if potential_segment.lower() in SEGMENT_MAP:
                    segment = SEGMENT_MAP[potential_segment.lower()]
                    
                if len(groups) > 3:
                    try:
                        odds = int(groups[3])
                    except:
                        pass
                else:
                    # Maybe it's odds not segment
                    try:
                        odds = int(potential_segment)
                        segment = None
                    except:
                        pass
            
            return Pick(
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{team_or_type.title()} {total}",
                segment=segment or "FG",
                odds=str(odds) if odds else None,
                league=self.context.current_league
            )
        
        # Handle team picks
        else:
            team_text = team_or_type
            team_norm, league = self.team_registry.normalize_team(team_text, self.context.current_league)
            
            if not team_norm:
                # If can't normalize, check if it might be valid anyway
                if len(team_text) < 2:
                    return None
            
            # Update context
            if team_norm:
                self.context.current_team = team_norm
                if league:
                    self.context.current_league = league
            
            spread = None
            segment = None
            odds = None
            
            # Parse remaining groups based on pattern
            if len(groups) > 1:
                spread = groups[1]
                
            if len(groups) > 2:
                potential_segment = groups[2]
                if isinstance(potential_segment, str) and potential_segment.lower() in SEGMENT_MAP:
                    segment = SEGMENT_MAP[potential_segment.lower()]
                else:
                    try:
                        odds = int(potential_segment)
                    except:
                        pass
            
            if len(groups) > 3:
                try:
                    odds = int(groups[3])
                except:
                    pass
            
            # Create pick description
            if spread:
                pick_desc = f"{team_norm or team_text} {spread}"
            else:
                pick_desc = f"{team_norm or team_text} ML"
            
            return Pick(
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=pick_desc,
                segment=segment or "FG",
                odds=str(odds) if odds else None,
                league=league or self.context.current_league
            )
    
    def _normalize_league(self, league_text: str) -> Optional[str]:
        """Normalize league text."""
        if not league_text:
            return None
        
        league_lower = league_text.lower().strip()
        return LEAGUE_MAP.get(league_lower, league_text.upper())
    
    def parse_text(self, text: str, default_date: Optional[str] = None) -> List[Pick]:
        """Parse plain text (for testing)."""
        self.context.current_date = default_date
        return self._parse_message_with_context(text)