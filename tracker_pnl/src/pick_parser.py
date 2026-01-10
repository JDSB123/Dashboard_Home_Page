"""
Pick Parser Module
Extracts betting picks from conversation-style strings and HTML messages.
"""

import re
from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from bs4 import BeautifulSoup
import pytz

from .pick_tracker import Pick, PickTracker

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
    "ML": "Full Game",  # Moneyline is full game
    "TT": "Full Game"  # Team Total is full game (unless specified otherwise)
}


class PickParser:
    """Parses betting picks from various text formats."""
    
    def __init__(self):
        self.cst = pytz.timezone('America/Chicago')
    
    def parse_html_conversation(self, html_content: str, default_date: Optional[str] = None) -> List[Pick]:
        """
        Parse picks from HTML Telegram conversation.
        
        Args:
            html_content: HTML content from Telegram export
            default_date: Default date if not found in message
            
        Returns:
            List of Pick objects
        """
        soup = BeautifulSoup(html_content, 'lxml')
        picks = []
        
        # Find all message bodies
        messages = soup.find_all('div', class_='message default clearfix')
        
        for message in messages:
            # Extract message text
            text_div = message.find('div', class_='text')
            if not text_div:
                continue
                
            # Get date from message
            date_div = message.find('div', class_='pull_right date details')
            message_date = default_date
            if date_div and 'title' in date_div.attrs:
                # Parse date from title attribute
                date_str = date_div['title']
                try:
                    # Format: "15.12.2025 07:48:17 UTC-06:00"
                    dt = datetime.strptime(date_str.split(' UTC')[0], "%d.%m.%Y %H:%M:%S")
                    # Convert to CST
                    dt_utc = pytz.UTC.localize(dt) if dt.tzinfo is None else dt
                    dt_cst = dt_utc.astimezone(self.cst)
                    message_date = dt_cst.strftime("%Y-%m-%d")
                except:
                    pass
            
            # Extract text (handling HTML entities)
            text = text_div.get_text(separator=' ', strip=True)
            
            # Parse picks from text
            parsed = self.parse_text_conversation(text, message_date)
            picks.extend(parsed)
        
        return picks
    
    def parse_text_conversation(self, text: str, default_date: Optional[str] = None) -> List[Pick]:
        """
        Parse picks from plain text conversation.
        
        Looks for patterns like:
        - "Bears +7.5 NFL -110"
        - "Under 24 (-110)"
        - "Giants TT Under 23.5 +105"
        - "Bears/Eagles 1H Under 23 -110"
        
        Args:
            text: Conversation text
            default_date: Default date for picks
            
        Returns:
            List of Pick objects
        """
        picks = []
        
        # Split by lines or common separators
        lines = re.split(r'[\n\r]+|<br>|<br/>', text)
        
        current_matchup = None
        current_league = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Try to extract picks from line
            # Pattern 1: Team/Game name pattern (may indicate new matchup)
            matchup_match = re.search(r'([A-Z][^/]*?)\s*(?:@|vs?\.?|/)\s*([A-Z][^/\d]+?)(?:\s+(NFL|CFB|NCAAF|NBA|NCAAM|CBB))', line, re.IGNORECASE)
            if matchup_match:
                away = matchup_match.group(1).strip()
                home = matchup_match.group(2).strip()
                current_matchup = f"{away} @ {home}"
                current_league = LEAGUE_MAP.get(matchup_match.group(3).upper(), matchup_match.group(3).upper())
                continue
            
            # Pattern 2: Pick with odds
            # Match patterns like: "Under 24 (-110)", "Bears +7.5 -110", "Over 54 CFB -110"
            pick_patterns = [
                # Full pattern: "Team Pick Odds League"
                r'([A-Z][A-Za-z\s]+?)\s+([+\-]?\d+\.?\d*)\s+(NFL|CFB|NCAAF|NBA|NCAAM|CBB)?\s*([+\-]\d+)',
                # Pattern: "Pick Description (Odds)"
                r'([A-Z][^\(]+?)\s*\(([+\-]\d+)\)',
                # Pattern: "Team +7.5 -110"
                r'([A-Z][A-Za-z\s]+?)\s+([+\-]?\d+\.?\d*)\s+([+\-]\d+)',
                # Pattern: "Under/Over 24 -110"
                r'(Under|Over)\s+(\d+\.?\d*)\s+([+\-]\d+)',
            ]
            
            for pattern in pick_patterns:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    try:
                        pick = self._parse_pick_match(match, pattern, line, current_matchup, current_league, default_date)
                        if pick:
                            picks.append(pick)
                    except Exception as e:
                        # Skip malformed picks
                        continue
        
        return picks
    
    def _parse_pick_match(self, match: re.Match, pattern: str, line: str, 
                         default_matchup: Optional[str], default_league: Optional[str],
                         default_date: Optional[str]) -> Optional[Pick]:
        """Parse a single pick from a regex match."""
        pick = Pick()
        pick.date = default_date
        
        # Extract odds (usually the last number with +/-)
        odds_match = re.search(r'([+\-]\d+)', line)
        if not odds_match:
            return None
        
        odds = odds_match.group(1)
        
        # Extract league
        league_match = re.search(r'\b(NFL|CFB|NCAAF|NBA|NCAAM|CBB)\b', line, re.IGNORECASE)
        pick.league = LEAGUE_MAP.get(league_match.group(1).upper(), default_league) if league_match else default_league
        
        # Extract segment (1H, 2H, Q1, etc.)
        segment_match = re.search(r'\b(1H|1ST HALF|2H|2ND HALF|Q1|Q2|Q3|Q4|FG|ML|TT)\b', line, re.IGNORECASE)
        if segment_match:
            seg_key = segment_match.group(1).upper()
            pick.segment = SEGMENT_MAP.get(seg_key, seg_key)
        else:
            pick.segment = "Full Game"
        
        # Extract pick description
        # Remove odds and league from line to get description
        desc_line = re.sub(r'\([+\-]\d+\)', '', line)
        desc_line = re.sub(r'\b(NFL|CFB|NCAAF|NBA|NCAAM|CBB)\b', '', desc_line, flags=re.IGNORECASE)
        desc_line = desc_line.strip()
        
        # Extract team name if present
        team_match = re.search(r'([A-Z][A-Za-z\s]+?)(?:\s+(?:[+\-]?\d+|Under|Over))', desc_line)
        if team_match and not pick.matchup:
            team_name = team_match.group(1).strip()
            # Try to infer matchup if we have a team
            if default_matchup:
                pick.matchup = default_matchup
        
        # Build pick description
        pick_desc_parts = []
        if team_match:
            pick_desc_parts.append(team_match.group(1).strip())
        
        # Add spread/total
        spread_total_match = re.search(r'([+\-]?\d+\.?\d*)', desc_line)
        over_under_match = re.search(r'(Under|Over)\s+(\d+\.?\d*)', desc_line, re.IGNORECASE)
        
        if over_under_match:
            pick_desc_parts.append(f"{over_under_match.group(1)} {over_under_match.group(2)}")
        elif spread_total_match:
            val = spread_total_match.group(1)
            if val.startswith('+') or val.startswith('-'):
                pick_desc_parts.append(val)
        
        pick.pick_description = ' '.join(pick_desc_parts) if pick_desc_parts else desc_line
        pick.pick_description = pick.pick_description.strip()
        
        # Add odds to description
        if pick.pick_description:
            pick.pick_description += f" ({odds})"
        
        # Set matchup if not set
        if not pick.matchup:
            pick.matchup = default_matchup
        
        # Calculate bet amounts
        pick.set_odds_and_amounts(odds)
        
        pick.source_text = line
        pick.status = "Pending"
        
        return pick
    
    def parse_structured_text(self, text: str, date: Optional[str] = None) -> List[Pick]:
        """
        Parse structured text format (like from Excel or formatted output).
        
        This is a fallback parser for more structured formats.
        """
        # Implementation for structured formats if needed
        return self.parse_text_conversation(text, date)
