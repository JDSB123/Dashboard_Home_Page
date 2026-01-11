"""
Contextual Pick Parser
A sophisticated parser that understands conversation context and flow to extract betting picks.
"""

import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple
from decimal import Decimal
from bs4 import BeautifulSoup
import pytz

from .pick_tracker import Pick

# Team name mappings (abbreviated → full name)
TEAM_ABBREVIATIONS = {
    # College Football
    "a and m": "Texas A&M",
    "a&m": "Texas A&M",
    "aggies": "Texas A&M",
    "texas a&m": "Texas A&M",
    "uga": "Georgia",
    "gt": "Georgia Tech",
    "usafa": "Air Force",
    "afa": "Air Force",
    "new mex": "New Mexico State",
    "nmsu": "New Mexico State",
    "sdsu": "San Diego State",
    "wky": "Western Kentucky",
    "w. kentucky": "Western Kentucky",
    "jmu": "James Madison",
    "pitt": "Pittsburgh",
    "mich": "Michigan",
    "ohio state": "Ohio State",
    "wvu": "West Virginia",
    "utsa": "UTSA",
    "lsu": "LSU",
    "elon": "Elon",
    "fsu": "Florida State",
    "duke": "Duke",
    "army": "Army",
    "penn st": "Penn State",
    "uf": "Florida",
    "oregon st": "Oregon State",
    "wash st": "Washington State",
    "uva": "Virginia",
    "tulane": "Tulane",
    "indiana": "Indiana",
    "purdue": "Purdue",
    "ind": "Indiana",
    "smu": "SMU",
    "miss st": "Mississippi State",
    
    # NFL
    "bears": "Chicago Bears",
    "chi": "Chicago Bears",
    "chicago": "Chicago Bears",
    "eagles": "Philadelphia Eagles",
    "philly": "Philadelphia Eagles",
    "commanders": "Washington Commanders",
    "raiders": "Las Vegas Raiders",
    
    # NBA
    "mavs": "Dallas Mavericks",
    "mavericks": "Dallas Mavericks",
    "lakers": "Los Angeles Lakers",
    "grizz": "Memphis Grizzlies",
    "grizzlies": "Memphis Grizzlies",
    "clippers": "LA Clippers",
    "suns": "Phoenix Suns",
    "pistons": "Detroit Pistons",
    "nets": "Brooklyn Nets",
    "bkn nets": "Brooklyn Nets",
    "heat": "Miami Heat",
    "pels": "New Orleans Pelicans",
    "pelicans": "New Orleans Pelicans",
    "knicks": "New York Knicks",
    "magic": "Orlando Magic",
    "spurs": "San Antonio Spurs",
    "thunder": "Oklahoma City Thunder",
    "bulls": "Chicago Bulls",
    "bucks": "Milwaukee Bucks",
    "rockets": "Houston Rockets",
    
    # NCAAM
    "drake": "Drake",
    "north dakota": "North Dakota",
}

# League mappings
LEAGUE_MAP = {
    "NFL": "NFL",
    "CFB": "NCAAF",
    "NCAAF": "NCAAF",
    "NBA": "NBA",
    "NCAAM": "NCAAM",
    "CBB": "NCAAM",
    "NCAA": "NCAAM"
}

# Segment mappings
SEGMENT_MAP = {
    "1H": "1st Half",
    "1ST HALF": "1st Half",
    "FIRST HALF": "1st Half",
    "2H": "2nd Half",
    "2ND HALF": "2nd Half",
    "SECOND HALF": "2nd Half",
    "Q1": "Q1",
    "Q2": "Q2",
    "Q3": "Q3",
    "Q4": "Q4",
    "FG": "Full Game",
    "FULL GAME": "Full Game",
    "ML": "Full Game",
    "TT": "Team Total"
}


class ConversationContext:
    """Tracks context across multiple messages in a conversation."""
    
    def __init__(self):
        self.current_matchup: Optional[str] = None
        self.current_league: Optional[str] = None
        self.current_team: Optional[str] = None
        self.current_date: Optional[str] = None
        self.pending_picks: List[Dict] = []  # Picks waiting for confirmation/details
        self.last_message_time: Optional[datetime] = None
        self.bet_amount: Optional[str] = None  # Default bet amount from "how much" responses
        
    def reset(self, time_gap_minutes: int = 30):
        """Reset context if conversation has been idle."""
        self.current_matchup = None
        self.current_league = None
        self.current_team = None
        self.pending_picks = []
        
    def is_new_conversation(self, message_time: datetime, threshold_minutes: int = 30) -> bool:
        """Check if this message starts a new conversation topic."""
        if not self.last_message_time:
            return True
        time_diff = (message_time - self.last_message_time).total_seconds() / 60
        return time_diff > threshold_minutes


class ContextualPickParser:
    """Parser that understands conversation context and flow."""
    
    def __init__(self):
        self.cst = pytz.timezone('America/Chicago')
        self.context = ConversationContext()
        
    def normalize_team_name(self, team_text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Normalize team name from abbreviated/conversational format.
        Returns: (normalized_name, inferred_league)
        """
        team_lower = team_text.lower().strip()
        
        # Check direct mappings
        if team_lower in TEAM_ABBREVIATIONS:
            normalized = TEAM_ABBREVIATIONS[team_lower]
            # Infer league from team
            league = self._infer_league_from_team(normalized)
            return normalized, league
        
        # Check if it's already a full name
        for abbrev, full_name in TEAM_ABBREVIATIONS.items():
            if team_lower == full_name.lower():
                league = self._infer_league_from_team(full_name)
                return full_name, league
        
        # Return capitalized version if no match
        return team_text.title(), None
    
    def _infer_league_from_team(self, team_name: str) -> Optional[str]:
        """Infer league from team name."""
        team_lower = team_name.lower()
        
        # NFL teams typically have city + name
        nfl_indicators = ["bears", "eagles", "raiders", "commanders", "patriots", 
                         "bills", "cowboys", "packers"]
        if any(ind in team_lower for ind in nfl_indicators):
            return "NFL"
        
        # NBA teams
        nba_indicators = ["mavericks", "lakers", "grizzlies", "clippers", "suns",
                         "pistons", "nets", "heat", "pelicans", "knicks", "magic",
                         "spurs", "thunder", "bulls", "bucks", "rockets"]
        if any(ind in team_lower for ind in nba_indicators):
            return "NBA"
        
        # College teams (typically single name or state + name)
        college_indicators = ["texas a&m", "georgia", "duke", "michigan", "alabama",
                            "indiana", "purdue", "drake", "kentucky"]
        if any(ind in team_lower for ind in college_indicators):
            return "NCAAF"  # Default to football, but could be basketball
        
        return None
    
    def parse_html_conversation(self, html_content: str, default_date: Optional[str] = None) -> List[Pick]:
        """
        Parse picks from HTML Telegram conversation with full context awareness.
        """
        soup = BeautifulSoup(html_content, 'lxml')
        picks = []
        
        # Find all message bodies
        messages = soup.find_all('div', class_='message default clearfix')
        
        # Reset context for fresh parse
        self.context = ConversationContext()
        self.context.current_date = default_date
        
        for i, message in enumerate(messages):
            # Extract message components
            text_div = message.find('div', class_='text')
            if not text_div:
                continue
            
            # Get message metadata
            date_div = message.find('div', class_='pull_right date details')
            from_name_div = message.find('div', class_='from_name')
            
            message_time = None
            if date_div and 'title' in date_div.attrs:
                date_str = date_div['title']
                try:
                    # Format: "28.11.2025 18:38:40 UTC-06:00"
                    dt = datetime.strptime(date_str.split(' UTC')[0], "%d.%m.%Y %H:%M:%S")
                    dt_cst = pytz.UTC.localize(dt).astimezone(self.cst)
                    message_time = dt_cst
                    self.context.current_date = dt_cst.strftime("%Y-%m-%d")
                except:
                    pass
            
            sender = from_name_div.get_text(strip=True) if from_name_div else "Unknown"
            
            # Extract text
            text = text_div.get_text(separator=' ', strip=True)
            
            # Check if new conversation (reset context if needed)
            if message_time and self.context.is_new_conversation(message_time):
                self.context.reset()
            
            if message_time:
                self.context.last_message_time = message_time
            
            # Parse this message in context
            message_picks = self._parse_message_with_context(
                text, sender, message_time, i, messages
            )
            
            picks.extend(message_picks)
        
        return picks
    
    def _parse_message_with_context(self, text: str, sender: str, 
                                    message_time: Optional[datetime],
                                    message_idx: int,
                                    all_messages: List) -> List[Pick]:
        """Parse a single message with full context awareness."""
        picks = []
        
        # Skip empty or very short messages
        if not text or len(text) < 2:
            return picks
        
        text_lower = text.lower().strip()
        
        # Skip obviously non-betting messages
        if self._is_non_betting_message(text_lower):
            return picks
        
        # Check for bet amount confirmation
        bet_amount_match = re.match(r'^\$?(\d+)\s*(ea|each|on both)?$', text_lower)
        if bet_amount_match:
            self.context.bet_amount = bet_amount_match.group(1)
            return picks
        
        # Check for formatted summary (completed picks with results)
        if 'HIT' in text or 'MISS' in text or 'PUSH' in text:
            return self._parse_formatted_summary(text)
        
        # Parse conversational betting message
        return self._parse_conversational_betting_message(text, message_time)
    
    def _is_non_betting_message(self, text_lower: str) -> bool:
        """Check if message is likely not a betting pick."""
        # Short confirmations/responses
        if text_lower in ['ok', 'k', 'yes', 'no', 'thanks', 'thx', 'deal', 'sure', 
                         'will do', 'all in', 'you in', 'im in', "let's do it",
                         'alright', 'sounds good', 'got it', 'perfect']:
            return True
        
        # Check for non-betting keywords
        non_betting_patterns = [
            r'^(deal to|what do you want|how much|we open|can i do)',
            r'(just reading|nobody in america|you capped me)',
            r'(meaning if|okay u can bet|minimum payments)',
            r'(the term|is not recognized|spelling)',  # Command line errors
            r'^(if we can agree|when balance is)',
            r'^so put them on',
            r'book these bets',
        ]
        
        for pattern in non_betting_patterns:
            if re.search(pattern, text_lower):
                return True
        
        # Skip if message is too long (likely explanation/conversation)
        if len(text_lower) > 200:
            return True
        
        return False
    
    def _parse_formatted_summary(self, text: str) -> List[Pick]:
        """Parse formatted summary with results."""
        picks = []
        
        # Split by line breaks
        lines = re.split(r'<br>|<br/>|\n', text)
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 5:
                continue
            
            # Pattern: Team/Pick Segment Spread/Total League RESULT +/-$amount
            # Example: "Bears +7.5 NFL HIT +$33,000"
            # Example: "Indiana 2H -13.5 CFB HIT +$33,000"
            # Example: "Mavs/Lakers Under 233 NBA MISS -$55,000"
            
            pattern = r'([A-Za-z\s/&\-\.]+?)\s+(?:(1H|2H|1st Half|2nd Half|ML|TT)\s+)?([+\-]?\d+\.?\d*|Under|Over|Pick)\s*(?:(\d+\.?\d*)\s*)?(NFL|CFB|NCAAF|NBA|NCAAM|CBB)?\s+(HIT|MISS|PUSH)?\s*([+\-]\$?\d+(?:,\d+)?)'
            
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                pick = Pick()
                pick.date = self.context.current_date
                
                # Extract components
                team_or_matchup = match.group(1).strip()
                segment = match.group(2)
                pick_value = match.group(3)
                total_value = match.group(4)
                league = match.group(5)
                result = match.group(6)
                pnl = match.group(7)
                
                # Normalize team name
                if '/' in team_or_matchup:
                    # It's a matchup
                    teams = team_or_matchup.split('/')
                    normalized_teams = []
                    for team in teams:
                        norm_team, inferred_league = self.normalize_team_name(team.strip())
                        normalized_teams.append(norm_team)
                        if not league and inferred_league:
                            league = inferred_league
                    pick.matchup = f"{normalized_teams[0]} @ {normalized_teams[1]}"
                else:
                    # Single team
                    normalized_team, inferred_league = self.normalize_team_name(team_or_matchup)
                    pick.matchup = normalized_team
                    if not league and inferred_league:
                        league = inferred_league
                
                # Set league
                if league:
                    pick.league = LEAGUE_MAP.get(league.upper(), league.upper())
                
                # Set segment
                if segment:
                    pick.segment = SEGMENT_MAP.get(segment.upper(), segment)
                else:
                    pick.segment = "Full Game"
                
                # Build pick description
                desc_parts = []
                if pick_value:
                    if pick_value.lower() in ['under', 'over']:
                        if total_value:
                            desc_parts.append(f"{pick_value} {total_value}")
                        else:
                            desc_parts.append(pick_value)
                    elif pick_value.lower() == 'pick':
                        desc_parts.append("Pick'em")
                    else:
                        desc_parts.append(pick_value)
                
                pick.pick_description = ' '.join(desc_parts) if desc_parts else line[:50]
                
                # Set result
                if result:
                    pick.status = result.capitalize()
                
                pick.source_text = line
                picks.append(pick)
        
        return picks
    
    def _parse_conversational_betting_message(self, text: str, 
                                             message_time: Optional[datetime]) -> List[Pick]:
        """Parse conversational betting message with context."""
        picks = []
        
        # Normalize text - expand abbreviations
        text_normalized = self._normalize_betting_text(text)
        
        # Split by semicolons for multi-pick messages
        segments = [s.strip() for s in re.split(r';|\n|<br>|<br/>', text_normalized)]
        
        for segment in segments:
            if not segment or len(segment) < 3:
                continue
            
            # Try to parse this segment
            segment_picks = self._parse_betting_segment(segment, message_time)
            picks.extend(segment_picks)
        
        return picks
    
    def _normalize_betting_text(self, text: str) -> str:
        """Normalize betting text by expanding abbreviations."""
        normalized = text
        
        # Expand Over/Under abbreviations
        # "o24" → "Over 24", "u49" → "Under 49"
        normalized = re.sub(r'\bo(\d+\.?\d*)', r'Over \1', normalized, flags=re.IGNORECASE)
        normalized = re.sub(r'\bu(\d+\.?\d*)', r'Under \1', normalized, flags=re.IGNORECASE)
        
        # Expand "TT" or "tto" to "Team Total"
        normalized = re.sub(r'\btto\b', 'TT Over', normalized, flags=re.IGNORECASE)
        
        return normalized
    
    def _parse_betting_segment(self, segment: str, 
                               message_time: Optional[datetime]) -> List[Pick]:
        """Parse a single betting segment (could be one or more picks)."""
        picks = []
        
        segment_lower = segment.lower().strip()
        
        # Skip if segment is too short or looks non-betting
        if len(segment_lower) < 3:
            return picks
        
        # Skip segments with non-betting keywords
        skip_keywords = ['okay u can', 'meaning if', 'balance is', 'nobody in', 
                        'reading chat', 'capped me', 'agree to', 'going to pay']
        if any(keyword in segment_lower for keyword in skip_keywords):
            return picks
        
        # Pattern 1: "Team: pick segment odds" 
        # Example: "a and m: -.5 2h , -135"
        pattern1 = r'([a-z\s&]+?):\s*([+\-]?\d+\.?\d*)\s*(?:(1h|2h|1st half|2nd half|tt|ml)\s*,?\s*)?([+\-]\d{3,})'
        match1 = re.search(pattern1, segment_lower, re.IGNORECASE)
        
        if match1:
            team_text = match1.group(1).strip()
            # Validate it's a reasonable team name (not too long)
            if len(team_text) < 30 and not any(skip in team_text for skip in ['okay', 'meaning', 'reading']):
                spread_total = match1.group(2)
                segment_key = match1.group(3)
                odds = match1.group(4)
                
                pick = self._create_pick_from_components(
                    team_text, spread_total, None, segment_key, odds, segment
                )
                if pick:
                    picks.append(pick)
            return picks
        
        # Pattern 2: "Team spread/total segment odds $amount"
        # Example: "Suns +9 1h -108 $50"
        # Example: "Raiders 7.5 1h -107 $50"
        pattern2 = r'([a-z\s&]+?)\s+([+\-]?\d+\.?\d*)\s*(?:(1h|2h|1st half|2nd half|tt|ml)\s*)?([+\-]\d{3,})?\s*(?:\$(\d+))?'
        matches2 = re.finditer(pattern2, segment_lower, re.IGNORECASE)
        
        found_picks = 0
        for match in matches2:
            if found_picks >= 5:  # Limit picks per segment to avoid over-matching
                break
                
            team_text = match.group(1).strip()
            spread_total = match.group(2)
            segment_key = match.group(3)
            odds = match.group(4)
            bet_amount = match.group(5)
            
            # Skip if team text is invalid
            if (len(team_text) < 2 or len(team_text) > 30 or 
                team_text.isdigit() or
                any(skip in team_text for skip in ['okay', 'meaning', 'reading', 'capped', 'can bet'])):
                continue
            
            # Must have odds or be a known team
            if not odds and team_text not in TEAM_ABBREVIATIONS:
                continue
            
            pick = self._create_pick_from_components(
                team_text, spread_total, None, segment_key, odds, segment
            )
            if pick:
                picks.append(pick)
                found_picks += 1
        
        # Pattern 3: "Over/Under total segment odds"
        # Example: "Over 24 2h -115"
        pattern3 = r'(Over|Under)\s+(\d+\.?\d*)\s*(?:(1h|2h|1st half|2nd half|total)\s*)?([+\-]\d{3,})?'
        matches3 = re.finditer(pattern3, segment, re.IGNORECASE)
        
        for match in matches3:
            over_under = match.group(1)
            total = match.group(2)
            segment_key = match.group(3)
            odds = match.group(4)
            
            pick = self._create_pick_from_components(
                None, None, f"{over_under} {total}", segment_key, odds, segment
            )
            if pick:
                picks.append(pick)
        
        return picks
    
    def _create_pick_from_components(self, team_text: Optional[str],
                                     spread_total: Optional[str],
                                     over_under: Optional[str],
                                     segment_key: Optional[str],
                                     odds: Optional[str],
                                     source_text: str) -> Optional[Pick]:
        """Create a Pick object from parsed components."""
        pick = Pick()
        pick.date = self.context.current_date
        pick.source_text = source_text
        
        # Normalize team name if provided
        if team_text:
            normalized_team, inferred_league = self.normalize_team_name(team_text)
            pick.matchup = normalized_team
            
            # Use inferred league if not set in context
            if inferred_league:
                pick.league = inferred_league
                self.context.current_league = inferred_league
            elif self.context.current_league:
                pick.league = self.context.current_league
        else:
            pick.matchup = self.context.current_matchup
            pick.league = self.context.current_league
        
        # Set segment
        if segment_key:
            key_upper = segment_key.upper()
            if key_upper == 'TOTAL':
                key_upper = '2H'  # "total 2h" usually means 2H
            pick.segment = SEGMENT_MAP.get(key_upper, key_upper)
        else:
            pick.segment = "Full Game"
        
        # Build pick description
        desc_parts = []
        if over_under:
            desc_parts.append(over_under)
        elif spread_total:
            desc_parts.append(spread_total)
        
        if odds:
            pick.odds = odds
            pick.pick_description = ' '.join(desc_parts) + f" ({odds})" if desc_parts else f"Pick ({odds})"
            pick.set_odds_and_amounts(odds)
        else:
            pick.pick_description = ' '.join(desc_parts) if desc_parts else source_text[:50]
        
        # Only return if we have meaningful data
        if pick.odds or (pick.matchup and desc_parts):
            pick.status = "Pending"
            return pick
        
        return None
