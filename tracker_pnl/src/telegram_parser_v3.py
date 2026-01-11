"""
Version 3 of Telegram parser - optimized for actual message formats.
Handles both conversational and structured betting formats.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup

from src.pick_tracker import Pick
from src.team_registry import team_registry


@dataclass  
class MessageContext:
    """Track context across messages."""
    current_date: Optional[str] = None
    current_matchup: Optional[str] = None
    current_league: Optional[str] = None
    last_team: Optional[str] = None
    last_segment: str = "FG"
    last_message_time: Optional[datetime] = None
    pending_bets: List[Dict] = None
    
    def __post_init__(self):
        if self.pending_bets is None:
            self.pending_bets = []


class TelegramParserV3:
    """Enhanced Telegram parser for actual message formats."""
    
    def __init__(self):
        self.context = MessageContext()
        self.team_registry = team_registry
        
        # Common betting patterns from actual messages
        self.bet_patterns = [
            # Format: "Team spread odds $amount" e.g. "Mavs 8 -110 $50"
            r"^([A-Za-z][A-Za-z\s&'.-]*?)\s+([-+]?\d+\.?\d*)\s+([-+]\d+)\s+\$(\d+)",
            
            # Format: "Team o/u total odds $amount" e.g. "Nets o219 -112 $50"
            r"^([A-Za-z][A-Za-z\s&'.-]*?)\s+([ou])(\d+\.?\d*)\s+([-+]\d+)\s+\$(\d+)",
            
            # Format: "Over/Under total odds $amount" e.g. "Under 121 (-125) $50"
            r"^(over|under)\s+(\d+\.?\d*)\s*\(?([-+]\d+)\)?\s+\$(\d+)",
            
            # Format without amount: "Team spread odds" e.g. "Lakers -6.5 -110"
            r"^([A-Za-z][A-Za-z\s&'.-]*?)\s+([-+]?\d+\.?\d*)\s+([-+]\d+)$",
            
            # Format: Team and spread/total only
            r"^([A-Za-z][A-Za-z\s&'.-]*?)\s+([-+]?\d+\.?\d*)$",
            
            # Over/Under format variations
            r"^([ou])(\d+\.?\d*)\s+([-+]\d+)",
            r"^(over|under)\s+(\d+\.?\d*)",
            
            # Team ML format
            r"^([A-Za-z][A-Za-z\s&'.-]*?)\s+ML\s*([-+]\d+)?",
        ]
        
        # Segment indicators
        self.segment_patterns = {
            r"\b1h\b": "1H", r"\bfh\b": "1H", r"first half": "1H",
            r"\b2h\b": "2H", r"\bsh\b": "2H", r"second half": "2H",
            r"\bfg\b": "FG", r"full game": "FG", r"\bgame\b": "FG",
            r"\b1q\b": "1Q", r"first quarter": "1Q",
            r"\b2q\b": "2Q", r"second quarter": "2Q",
            r"\b3q\b": "3Q", r"third quarter": "3Q",
            r"\b4q\b": "4Q", r"fourth quarter": "4Q",
        }
    
    def parse_html(self, html_content: str, default_date: Optional[str] = None) -> List[Pick]:
        """Parse Telegram HTML export."""
        soup = BeautifulSoup(html_content, 'html.parser')
        picks = []
        self.context.current_date = default_date
        
        messages = soup.find_all('div', class_='message')
        
        for i, message_div in enumerate(messages):
            # Extract text
            body_div = message_div.find('div', class_='body')
            if not body_div:
                continue
            
            text_divs = body_div.find_all('div', class_='text')
            if not text_divs:
                continue
            
            message_text = ' '.join(div.get_text(strip=True) for div in text_divs)
            
            # Extract timestamp
            date_div = message_div.find('div', class_='date')
            if date_div and date_div.get('title'):
                try:
                    timestamp = datetime.strptime(date_div['title'], "%d.%m.%Y %H:%M:%S")
                    self.context.current_date = timestamp.strftime("%Y-%m-%d")
                    self.context.last_message_time = timestamp
                except:
                    pass
            
            # Parse the message
            message_picks = self._parse_message(message_text, i)
            picks.extend(message_picks)
        
        return picks
    
    def _parse_message(self, text: str, msg_index: int) -> List[Pick]:
        """Parse a single message."""
        picks = []
        text = text.strip()
        
        if not text or len(text) < 3:
            return []
        
        # Check for segment indicators first
        self._update_segment(text)
        
        # Check for matchup announcements
        if self._extract_matchup(text):
            # Continue to check for picks in same message
            pass
        
        # Try betting patterns
        for pattern in self.bet_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                pick = self._create_pick_from_pattern_match(match, pattern, text)
                if pick:
                    picks.append(pick)
                    break
        
        # If no structured pattern matched, try contextual parsing
        if not picks and self._looks_like_bet(text):
            contextual_pick = self._parse_contextual_bet(text)
            if contextual_pick:
                picks.append(contextual_pick)
        
        return picks
    
    def _update_segment(self, text: str):
        """Update current segment from text."""
        text_lower = text.lower()
        for pattern, segment in self.segment_patterns.items():
            if re.search(pattern, text_lower):
                self.context.last_segment = segment
                return
    
    def _extract_matchup(self, text: str) -> bool:
        """Extract matchup from text."""
        patterns = [
            r"([A-Za-z][A-Za-z\s&'.-]*?)\s+(?:vs\.?|versus|v\.?)\s+([A-Za-z][A-Za-z\s&'.-]*)",
            r"([A-Za-z][A-Za-z\s&'.-]*?)\s+@\s+([A-Za-z][A-Za-z\s&'.-]*)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                team1 = match.group(1).strip()
                team2 = match.group(2).strip()
                
                # Normalize teams
                team1_norm, league1 = self.team_registry.normalize_team(team1)
                team2_norm, league2 = self.team_registry.normalize_team(team2)
                
                if team1_norm or team2_norm:
                    t1 = team1_norm or team1
                    t2 = team2_norm or team2
                    self.context.current_matchup = f"{t1} vs {t2}"
                    
                    # Update league
                    if league1:
                        self.context.current_league = league1
                    elif league2:
                        self.context.current_league = league2
                    
                    return True
        
        return False
    
    def _create_pick_from_pattern_match(self, match: re.Match, pattern: str, full_text: str) -> Optional[Pick]:
        """Create pick from regex match."""
        groups = match.groups()
        
        # Determine pick type based on pattern
        if "ML" in pattern:
            # Moneyline bet
            team = groups[0]
            odds = groups[1] if len(groups) > 1 else None
            
            team_norm, league = self.team_registry.normalize_team(team, self.context.current_league)
            
            return Pick(
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{team_norm or team} ML",
                segment=self.context.last_segment,
                odds=odds,
                league=league or self.context.current_league
            )
        
        elif any(x in pattern.lower() for x in ["over", "under", r"\b[ou]\b"]):
            # Total bet
            if groups[0].lower() in ["over", "under", "o", "u"]:
                ou_type = "Over" if groups[0].lower() in ["over", "o"] else "Under"
                total = groups[1]
                odds = groups[2] if len(groups) > 2 else None
            else:
                # Team total format "Nets o219"
                team = groups[0]
                ou_type = "Over" if groups[1].lower() == "o" else "Under"
                total = groups[2]
                odds = groups[3] if len(groups) > 3 else None
                
                team_norm, league = self.team_registry.normalize_team(team, self.context.current_league)
                if team_norm:
                    self.context.last_team = team_norm
                    if league:
                        self.context.current_league = league
            
            return Pick(
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{ou_type} {total}",
                segment=self.context.last_segment,
                odds=odds,
                league=self.context.current_league
            )
        
        else:
            # Spread bet
            team = groups[0]
            spread = groups[1]
            odds = groups[2] if len(groups) > 2 else None
            
            team_norm, league = self.team_registry.normalize_team(team, self.context.current_league)
            
            if team_norm:
                self.context.last_team = team_norm
                if league:
                    self.context.current_league = league
            
            # Create pick description
            team_str = team_norm or team
            
            # Ensure spread has sign
            if spread and not spread.startswith(('+', '-')):
                # If no sign, determine based on context
                if any(word in full_text.lower() for word in ["dog", "underdog", "plus", "getting"]):
                    spread = f"+{spread}"
                else:
                    spread = f"-{spread}"
            
            return Pick(
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{team_str} {spread}" if spread else team_str,
                segment=self.context.last_segment,
                odds=odds,
                league=league or self.context.current_league
            )
    
    def _looks_like_bet(self, text: str) -> bool:
        """Check if text looks like a betting message."""
        indicators = [
            r'\d+\.?\d*',  # Contains numbers
            r'[-+]\d+',     # Contains odds
            r'\$\d+',       # Contains dollar amounts
            'over', 'under', 'spread', 'total', 'ml', 'moneyline',
            r'\-', r'\+', 'fg', '1h', '2h', '1q', '2q', '3q', '4q'
        ]
        
        text_lower = text.lower()
        matches = sum(1 for ind in indicators if re.search(ind, text_lower))
        return matches >= 2
    
    def _parse_contextual_bet(self, text: str) -> Optional[Pick]:
        """Parse bet from context when no pattern matches."""
        text_lower = text.lower()
        
        # Try to extract any team name
        words = text.split()
        for word in words:
            if len(word) > 2:
                team_norm, league = self.team_registry.normalize_team(word, self.context.current_league)
                if team_norm:
                    # Found a team, try to extract spread/total
                    numbers = re.findall(r'[-+]?\d+\.?\d*', text)
                    if numbers:
                        spread = numbers[0]
                        # Look for odds
                        odds = None
                        if len(numbers) > 1:
                            for num in numbers[1:]:
                                if num.startswith(('+', '-')) and len(num) >= 3:
                                    odds = num
                                    break
                        
                        return Pick(
                            date=self.context.current_date,
                            matchup=self.context.current_matchup,
                            pick_description=f"{team_norm} {spread}",
                            segment=self.context.last_segment,
                            odds=odds,
                            league=league or self.context.current_league
                        )
        
        # Check for over/under without team
        ou_match = re.search(r'(over|under|o|u)\s*(\d+\.?\d*)', text_lower)
        if ou_match:
            ou_type = "Over" if ou_match.group(1) in ["over", "o"] else "Under"
            total = ou_match.group(2)
            
            # Look for odds
            odds_match = re.search(r'[-+]\d{3,4}', text)
            odds = odds_match.group(0) if odds_match else None
            
            return Pick(
                date=self.context.current_date,
                matchup=self.context.current_matchup,
                pick_description=f"{ou_type} {total}",
                segment=self.context.last_segment,
                odds=odds,
                league=self.context.current_league
            )
        
        return None