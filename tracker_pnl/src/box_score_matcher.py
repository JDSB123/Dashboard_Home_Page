"""
Box Score Matcher Module
Matches picks with box scores to extract scores and segment information.
"""

import json
import os
from typing import Optional, List, Dict
from datetime import datetime

from .pick_tracker import Pick


class BoxScoreMatcher:
    """Matches picks with box scores from stored JSON files."""
    
    def __init__(self, box_scores_dir: str = "box_scores"):
        """
        Initialize box score matcher.
        
        Args:
            box_scores_dir: Directory containing box score JSON files
        """
        self.box_scores_dir = box_scores_dir
        self.box_scores_cache: Dict[str, List[Dict]] = {}
    
    def load_box_scores_for_date(self, date: str, league: str) -> List[Dict]:
        """
        Load box scores for a specific date and league.
        
        Args:
            date: Date in YYYY-MM-DD format
            league: League code (NBA, NFL, NCAAF, NCAAM)
            
        Returns:
            List of box score dictionaries
        """
        cache_key = f"{league}_{date}"
        if cache_key in self.box_scores_cache:
            return self.box_scores_cache[cache_key]
        
        file_path = os.path.join(self.box_scores_dir, league, f"{date}.json")
        if not os.path.exists(file_path):
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                scores = json.load(f)
                self.box_scores_cache[cache_key] = scores
                return scores
        except Exception as e:
            print(f"Error loading box scores from {file_path}: {e}")
            return []
    
    def match_pick_to_game(self, pick: Pick) -> Optional[Dict]:
        """
        Match a pick to a box score game.
        
        Args:
            pick: Pick object to match
            
        Returns:
            Matched box score dictionary or None
        """
        if not pick.date or not pick.league:
            return None
        
        # Load box scores for date and league
        box_scores = self.load_box_scores_for_date(pick.date, pick.league)
        if not box_scores:
            return None
        
        # Extract teams from matchup
        if not pick.matchup:
            return None
        
        # Parse matchup (format: "Away @ Home")
        matchup_parts = pick.matchup.split(' @ ')
        if len(matchup_parts) != 2:
            # Try other formats
            matchup_parts = pick.matchup.split(' vs ')
            if len(matchup_parts) != 2:
                matchup_parts = pick.matchup.split('/')
        
        if len(matchup_parts) != 2:
            return None
        
        away_team = matchup_parts[0].strip()
        home_team = matchup_parts[1].strip()
        
        # Try to match teams
        for game in box_scores:
            game_away = game.get('away_team', '').upper()
            game_home = game.get('home_team', '').upper()
            game_away_full = (game.get('away_team_full') or '').upper()
            game_home_full = (game.get('home_team_full') or '').upper()
            
            # Try various matching strategies
            away_match = (
                away_team.upper() in game_away or
                game_away in away_team.upper() or
                away_team.upper() in game_away_full or
                game_away_full and away_team.upper() in game_away_full
            )
            
            home_match = (
                home_team.upper() in game_home or
                game_home in home_team.upper() or
                home_team.upper() in game_home_full or
                game_home_full and home_team.upper() in game_home_full
            )
            
            if away_match and home_match:
                return game
        
        return None
    
    def get_segment_score(self, game: Dict, segment: str, team: Optional[str] = None) -> Optional[float]:
        """
        Extract score for a specific segment.
        
        Args:
            game: Box score dictionary
            segment: Segment name (e.g., "1st Half", "2nd Half", "Q1")
            team: Optional team name if team total
            
        Returns:
            Score value or None
        """
        half_scores = game.get('half_scores', {})
        quarter_scores = game.get('quarter_scores', {})
        
        # Map segment names
        segment_lower = segment.lower()
        
        # First half
        if '1st half' in segment_lower or segment_lower == '1h':
            if 'H1' in half_scores:
                h1 = half_scores['H1']
                home_score = h1.get('home', 0)
                away_score = h1.get('away', 0)
                if team:
                    # Team total
                    if 'home' in team.lower() or game.get('home_team_full', '').upper() in team.upper():
                        return home_score
                    elif 'away' in team.lower() or game.get('away_team_full', '').upper() in team.upper():
                        return away_score
                return home_score + away_score
        
        # Second half
        if '2nd half' in segment_lower or segment_lower == '2h':
            if 'H2' in half_scores:
                h2 = half_scores['H2']
                home_score = h2.get('home', 0)
                away_score = h2.get('away', 0)
                if team:
                    if 'home' in team.lower() or game.get('home_team_full', '').upper() in team.upper():
                        return home_score
                    elif 'away' in team.lower() or game.get('away_team_full', '').upper() in team.upper():
                        return away_score
                return home_score + away_score
        
        # Quarters
        if segment_lower in ['q1', 'q2', 'q3', 'q4']:
            quarter_key = segment_lower.upper()
            if quarter_key in quarter_scores:
                q = quarter_scores[quarter_key]
                home_score = q.get('home', 0)
                away_score = q.get('away', 0)
                if team:
                    if 'home' in team.lower() or game.get('home_team_full', '').upper() in team.upper():
                        return home_score
                    elif 'away' in team.lower() or game.get('away_team_full', '').upper() in team.upper():
                        return away_score
                return home_score + away_score
        
        # Full game
        if 'full game' in segment_lower or segment_lower == 'fg' or segment_lower == 'ml':
            home_score = game.get('home_score', 0)
            away_score = game.get('away_score', 0)
            if team:
                if 'home' in team.lower() or game.get('home_team_full', '').upper() in team.upper():
                    return home_score
                elif 'away' in team.lower() or game.get('away_team_full', '').upper() in team.upper():
                    return away_score
            return home_score + away_score
        
        return None
    
    def format_score_string(self, game: Dict, segment: Optional[str] = None) -> str:
        """
        Format score string for display.
        
        Args:
            game: Box score dictionary
            segment: Optional segment name
            
        Returns:
            Formatted score string
        """
        home_team = game.get('home_team_full') or game.get('home_team', 'Home')
        away_team = game.get('away_team_full') or game.get('away_team', 'Away')
        home_score = game.get('home_score', 0)
        away_score = game.get('away_score', 0)
        
        if segment and ('1st half' in segment.lower() or segment.lower() == '1h'):
            # Get first half scores
            half_scores = game.get('half_scores', {})
            if 'H1' in half_scores:
                h1 = half_scores['H1']
                home_score = h1.get('home', 0)
                away_score = h1.get('away', 0)
        
        return f"{away_team} {away_score} - {home_team} {home_score}"
    
    def update_pick_with_box_score(self, pick: Pick) -> bool:
        """
        Update pick with box score information.
        
        Args:
            pick: Pick object to update
            
        Returns:
            True if match found and updated, False otherwise
        """
        game = self.match_pick_to_game(pick)
        if not game:
            return False
        
        pick.game_id = str(game.get('game_id', ''))
        pick.final_score = self.format_score_string(game)
        
        # Format first half score
        half_scores = game.get('half_scores', {})
        if 'H1' in half_scores:
            h1 = half_scores['H1']
            home_team = game.get('home_team_full') or game.get('home_team', 'Home')
            away_team = game.get('away_team_full') or game.get('away_team', 'Away')
            pick.first_half_score = f"{away_team} {h1.get('away', 0)} - {home_team} {h1.get('home', 0)}"
        
        return True
