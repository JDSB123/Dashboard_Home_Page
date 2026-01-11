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
        - Formatted summary: "Bears +7.5 NFL HIT +$33,000"
        
        Args:
            text: Conversation text
            default_date: Default date for picks
            
        Returns:
            List of Pick objects
        """
        picks = []
        
        # First, try to parse formatted summary format (easier to parse)
        formatted_picks = self._parse_formatted_summary(text, default_date)
        if formatted_picks:
            picks.extend(formatted_picks)
            return picks
        
        # Split by lines or common separators, and by semicolons (for multi-pick messages)
        lines = re.split(r'[\n\r]+|<br>|<br/>|;', text)
        
        current_matchup = None
        current_league = None
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Skip non-betting messages
            if self._is_non_betting_message(line):
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
            
            # Try to parse conversational/abbreviated format
            line_picks = self._parse_conversational_line(line, current_matchup, current_league, default_date)
            if line_picks:
                picks.extend(line_picks)
                continue
            
            # Pattern 2: Pick with odds (original patterns for well-formatted picks)
            # Match patterns like: "Under 24 (-110)", "Bears +7.5 -110", "Over 54 CFB -110"
            pick_patterns = [
                # Pattern: "Team +7.5 NFL -110" or "Team +7.5 -110 NFL"
                r'\b([A-Z][A-Za-z\s&]+?)\s+([+\-]\d+\.?\d*)\s+(?:NFL|CFB|NCAAF|NBA|NCAAM|CBB)\s+([+\-]\d{3,})',
                r'\b([A-Z][A-Za-z\s&]+?)\s+([+\-]\d+\.?\d*)\s+([+\-]\d{3,})\s+(?:NFL|CFB|NCAAF|NBA|NCAAM|CBB)',
                # Pattern: "Pick Description (Odds) League"
                r'([A-Z][^\(]+?)\s*\(([+\-]\d+)\)\s+(?:NFL|CFB|NCAAF|NBA|NCAAM|CBB)',
                # Pattern: "Under/Over 24 CFB -110"
                r'(Under|Over)\s+(\d+\.?\d*)\s+(?:NFL|CFB|NCAAF|NBA|NCAAM|CBB)\s+([+\-]\d{3,})',
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
    
    def _is_non_betting_message(self, line: str) -> bool:
        """Check if line is likely not a betting message."""
        non_betting_keywords = [
            r'^(deal|thanks?|thx|ok|k|yes|no|sure|alright|okay)$',
            r'^(we open|how much|what do you want)$',
            r'^(will do|am|pm)$',
            r'^[$]?\d+ (ea|each)$',
        ]
        line_lower = line.lower().strip()
        for pattern in non_betting_keywords:
            if re.match(pattern, line_lower):
                return True
        return False
    
    def _parse_formatted_summary(self, text: str, default_date: Optional[str]) -> List[Pick]:
        """
        Parse formatted summary format like:
        "Bears +7.5 NFL HIT +$33,000"
        "Texas A&M -2 CFB MISS -$60,000"
        """
        picks = []
        
        # Look for summary format pattern: Team Pick League RESULT +$amount or -$amount
        # Pattern: Team/Description [Segment] League [RESULT] [+/-]$amount
        summary_pattern = r'([A-Z][A-Za-z\s&/\-\.]+?)\s+(?:(1H|2H|1ST HALF|2ND HALF|Q1|Q2|Q3|Q4|ML|TT)\s+)?([+\-]?\d+\.?\d*|Under|Over)\s+(?:(\d+\.?\d*)\s+)?(?:TT\s+)?(NFL|CFB|NCAAF|NBA|NCAAM|CBB)\s+(?:HIT|MISS|PUSH)?\s*([+\-]\$?\d+(?:,\d+)?)'
        
        matches = re.finditer(summary_pattern, text, re.IGNORECASE)
        for match in matches:
            try:
                pick = Pick()
                pick.date = default_date
                
                # Extract components
                team_desc = match.group(1).strip()
                segment_key = match.group(2) if match.group(2) else None
                pick_type = match.group(3).strip() if match.group(3) else None
                total_value = match.group(4) if match.group(4) else None
                league = match.group(5).strip().upper()
                pnl_str = match.group(6) if match.group(6) else None
                
                # Set league
                pick.league = LEAGUE_MAP.get(league, league)
                
                # Set segment
                if segment_key:
                    pick.segment = SEGMENT_MAP.get(segment_key.upper(), segment_key)
                else:
                    pick.segment = "Full Game"
                
                # Build pick description
                desc_parts = []
                if team_desc and not team_desc.lower() in ['under', 'over']:
                    desc_parts.append(team_desc)
                if pick_type:
                    if pick_type.lower() in ['under', 'over']:
                        if total_value:
                            desc_parts.append(f"{pick_type} {total_value}")
                        else:
                            desc_parts.append(pick_type)
                    else:
                        desc_parts.append(pick_type)
                
                pick.pick_description = ' '.join(desc_parts).strip()
                
                # Extract status from PnL (if negative amount and no HIT/MISS, skip for now)
                # We'll leave status as Pending since we don't have odds
                pick.status = "Pending"
                pick.source_text = match.group(0)
                
                picks.append(pick)
            except Exception as e:
                continue
        
        return picks if picks else []
    
    def _parse_conversational_line(self, line: str, current_matchup: Optional[str], 
                                   current_league: Optional[str], default_date: Optional[str]) -> List[Pick]:
        """
        Parse conversational/abbreviated format like:
        "a and m: -.5 2h , -135, o24 total 2h"
        "indiana -13.5 -125; o23.5 -125"
        """
        picks = []
        
        # Normalize abbreviations
        line_normalized = line
        # Replace abbreviated Over/Under
        line_normalized = re.sub(r'\bo\s+(\d)', r'Over \1', line_normalized, flags=re.IGNORECASE)
        line_normalized = re.sub(r'\bu\s+(\d)', r'Under \1', line_normalized, flags=re.IGNORECASE)
        
        # Pattern for conversational format: Team: spread/total [segment] odds
        # Example: "a and m: -.5 2h , -135"
        conversational_patterns = [
            # Pattern: "Team: spread segment , odds" or "Team: spread , odds"
            r'([A-Za-z\s&]+?):\s*([+\-]?\d+\.?\d*)\s*(?:([12]h|1st half|2nd half|tt)\s*)?,?\s*([+\-]\d{3,})',
            # Pattern: "Team spread segment odds"
            r'\b([A-Z][A-Za-z\s&]+?)\s+([+\-]?\d+\.?\d*)\s+([12]h|1st half|2nd half|tt)?\s+([+\-]\d{3,})',
            # Pattern: "Over/Under total [segment] odds"
            r'(Over|Under)\s+(\d+\.?\d*)\s+(?:([12]h|1st half|2nd half|total)\s+)?([+\-]\d{3,})',
        ]
        
        for pattern in conversational_patterns:
            matches = re.finditer(pattern, line_normalized, re.IGNORECASE)
            for match in matches:
                try:
                    pick = Pick()
                    pick.date = default_date
                    pick.matchup = current_matchup
                    pick.league = current_league
                    
                    if match.lastindex >= 4:
                        # Extract odds (last group should be odds)
                        odds = match.group(match.lastindex)
                        pick.odds = odds
                        
                        # Extract segment
                        segment_key = None
                        for i in range(2, match.lastindex):
                            seg_text = match.group(i)
                            if seg_text and seg_text.lower() in ['1h', '2h', '1st half', '2nd half', 'tt', 'total']:
                                segment_key = seg_text.upper()
                                break
                        
                        if segment_key:
                            if segment_key == 'TOTAL':
                                segment_key = '2H'  # "total 2h" usually means 2H total
                            pick.segment = SEGMENT_MAP.get(segment_key, segment_key)
                        else:
                            pick.segment = "Full Game"
                        
                        # Build description
                        desc_parts = []
                        if match.group(1) and match.group(1).lower() not in ['over', 'under']:
                            desc_parts.append(match.group(1).strip())
                        if match.group(2):
                            val = match.group(2)
                            if match.group(1) and match.group(1).lower() in ['over', 'under']:
                                desc_parts.append(f"{match.group(1)} {val}")
                            else:
                                desc_parts.append(val)
                        
                        pick.pick_description = ' '.join(desc_parts).strip()
                        if pick.pick_description:
                            pick.pick_description += f" ({odds})"
                        
                        pick.set_odds_and_amounts(odds)
                        pick.source_text = line
                        pick.status = "Pending"
                        
                        picks.append(pick)
                except Exception as e:
                    continue
        
        return picks
    
    def _parse_pick_match(self, match: re.Match, pattern: str, line: str, 
                         default_matchup: Optional[str], default_league: Optional[str],
                         default_date: Optional[str]) -> Optional[Pick]:
        """Parse a single pick from a regex match."""
        pick = Pick()
        pick.date = default_date
        pick.matchup = default_matchup
        pick.league = default_league
        
        # Extract odds - look for 3+ digit numbers (odds are typically -110, -120, +105, etc.)
        # Avoid matching spreads/totals which are typically 1-2 digits with decimals
        odds_patterns = [
            r'\(([+\-]\d{3,})\)',  # Odds in parentheses: (-110)
            r'\b([+\-]\d{3,})\s*$',  # Odds at end of line
            r'\b([+\-]\d{3,})\s+(?:NFL|CFB|NCAAF|NBA|NCAAM|CBB)',  # Odds before league
            r'(?:NFL|CFB|NCAAF|NBA|NCAAM|CBB)\s+([+\-]\d{3,})',  # Odds after league
            r',\s*([+\-]\d{3,})',  # Odds after comma
        ]
        
        odds = None
        for odds_pattern in odds_patterns:
            odds_match = re.search(odds_pattern, line)
            if odds_match:
                odds = odds_match.group(1)
                break
        
        if not odds:
            # Fallback: last 3+ digit number with +/-
            all_odds_matches = re.findall(r'([+\-]\d{3,})', line)
            if all_odds_matches:
                odds = all_odds_matches[-1]  # Take the last one
        
        if not odds:
            return None
        
        # Extract league
        league_match = re.search(r'\b(NFL|CFB|NCAAF|NBA|NCAAM|CBB)\b', line, re.IGNORECASE)
        if league_match:
            pick.league = LEAGUE_MAP.get(league_match.group(1).upper(), league_match.group(1).upper())
        elif not pick.league:
            # Try to infer from context if possible
            pass
        
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
        desc_line = re.sub(r'\b[+\-]\d{3,}\b', '', desc_line)  # Remove odds (3+ digits)
        desc_line = re.sub(r'\b(NFL|CFB|NCAAF|NBA|NCAAM|CBB)\b', '', desc_line, flags=re.IGNORECASE)
        desc_line = re.sub(r'\b(HIT|MISS|PUSH)\b', '', desc_line, flags=re.IGNORECASE)
        desc_line = desc_line.strip()
        
        # Extract team name if present
        team_match = re.search(r'([A-Z][A-Za-z\s&/\-\.]+?)(?:\s+(?:[+\-]?\d+\.?\d*|Under|Over|ML|TT))', desc_line)
        
        # Build pick description
        pick_desc_parts = []
        if team_match:
            team_name = team_match.group(1).strip()
            # Don't add if it's just "Under" or "Over"
            if team_name.lower() not in ['under', 'over']:
                pick_desc_parts.append(team_name)
        
        # Add spread/total
        over_under_match = re.search(r'(Under|Over)\s+(\d+\.?\d*)', desc_line, re.IGNORECASE)
        spread_match = re.search(r'([+\-]\d+\.?\d*)\b(?!\s*[+\-])', desc_line)  # Spread not followed by another +/-
        
        if over_under_match:
            pick_desc_parts.append(f"{over_under_match.group(1)} {over_under_match.group(2)}")
        elif spread_match:
            val = spread_match.group(1)
            if val:
                pick_desc_parts.append(val)
        
        pick.pick_description = ' '.join(pick_desc_parts) if pick_desc_parts else desc_line
        pick.pick_description = pick.pick_description.strip()
        
        # Add odds to description
        if pick.pick_description:
            pick.pick_description += f" ({odds})"
        else:
            pick.pick_description = f"Pick ({odds})"
        
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
