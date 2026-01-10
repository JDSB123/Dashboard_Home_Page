"""
Result Evaluator Module
Determines Hit/Miss/Push status for picks based on box scores.
"""

import re
from typing import Optional, Dict
from decimal import Decimal

from .pick_tracker import Pick
from .box_score_matcher import BoxScoreMatcher


class ResultEvaluator:
    """Evaluates pick results based on box scores."""
    
    def __init__(self, box_score_matcher: BoxScoreMatcher):
        """
        Initialize result evaluator.
        
        Args:
            box_score_matcher: BoxScoreMatcher instance
        """
        self.box_score_matcher = box_score_matcher
    
    def evaluate_pick(self, pick: Pick) -> str:
        """
        Evaluate a pick and return status (Hit/Miss/Push).
        
        Args:
            pick: Pick object to evaluate
            
        Returns:
            Status string: "Hit", "Miss", "Push", or "Pending"
        """
        # Get matching game
        game = self.box_score_matcher.match_pick_to_game(pick)
        if not game or game.get('status') != 'final':
            return "Pending"
        
        # Extract pick type and value
        pick_desc = pick.pick_description or ""
        
        # Determine pick type
        is_over = 'over' in pick_desc.lower()
        is_under = 'under' in pick_desc.lower()
        is_spread = not (is_over or is_under)
        
        # Extract team name if it's a spread or team total
        team_name = None
        if is_spread or 'tt' in pick_desc.lower():
            # Extract team name (usually first word)
            team_match = re.search(r'^([A-Z][A-Za-z\s]+?)(?:\s+[+\-]?\d)', pick_desc)
            if team_match:
                team_name = team_match.group(1).strip()
        
        # Extract line value
        line_match = re.search(r'([+\-]?\d+\.?\d*)', pick_desc)
        if not line_match:
            return "Pending"
        
        try:
            line_value = float(line_match.group(1))
        except:
            return "Pending"
        
        # Get segment score
        segment = pick.segment or "Full Game"
        actual_score = self.box_score_matcher.get_segment_score(game, segment, team_name)
        
        if actual_score is None:
            return "Pending"
        
        # Evaluate result
        if is_over:
            if actual_score > line_value:
                status = "Hit"
            elif actual_score < line_value:
                status = "Miss"
            else:
                status = "Push"
        
        elif is_under:
            if actual_score < line_value:
                status = "Hit"
            elif actual_score > line_value:
                status = "Miss"
            else:
                status = "Push"
        
        else:
            # Spread or moneyline
            # For spread, need to determine which team
            # For moneyline, check if team won
            
            # Get team scores
            if segment.lower() in ['1st half', '1h']:
                half_scores = game.get('half_scores', {})
                if 'H1' in half_scores:
                    h1 = half_scores['H1']
                    away_score = h1.get('away', 0)
                    home_score = h1.get('home', 0)
                else:
                    return "Pending"
            elif segment.lower() in ['2nd half', '2h']:
                half_scores = game.get('half_scores', {})
                if 'H2' in half_scores:
                    h2 = half_scores['H2']
                    away_score = h2.get('away', 0)
                    home_score = h2.get('home', 0)
                else:
                    return "Pending"
            else:
                # Full game
                away_score = game.get('away_score', 0)
                home_score = game.get('home_score', 0)
            
            # Determine which team the pick is for
            is_away = False
            is_home = False
            
            if team_name:
                away_team = game.get('away_team_full') or game.get('away_team', '')
                home_team = game.get('home_team_full') or game.get('home_team', '')
                
                if team_name.upper() in away_team.upper() or away_team.upper() in team_name.upper():
                    is_away = True
                elif team_name.upper() in home_team.upper() or home_team.upper() in team_name.upper():
                    is_home = True
            
            # If moneyline (no + or - in line_value, and line_value is typically 100+)
            if abs(line_value) > 100 or (not ('+' in pick_desc or '-' in pick_desc.split()[0])):
                # Moneyline - just check if team won
                if is_away:
                    if away_score > home_score:
                        status = "Hit"
                    else:
                        status = "Miss"
                elif is_home:
                    if home_score > away_score:
                        status = "Hit"
                    else:
                        status = "Miss"
                else:
                    return "Pending"
            else:
                # Spread - apply spread to score
                if is_away:
                    adjusted_score = away_score + line_value
                    if adjusted_score > home_score:
                        status = "Hit"
                    elif adjusted_score < home_score:
                        status = "Miss"
                    else:
                        status = "Push"
                elif is_home:
                    adjusted_score = home_score + line_value
                    if adjusted_score > away_score:
                        status = "Hit"
                    elif adjusted_score < away_score:
                        status = "Miss"
                    else:
                        status = "Push"
                else:
                    return "Pending"
        
        # Update pick status and P&L
        pick.status = status
        self._update_pnl(pick)
        
        return status
    
    def _update_pnl(self, pick: Pick):
        """Update P&L for a pick based on status."""
        if pick.status == "Hit":
            pick.pnl = pick.to_win_amount
        elif pick.status == "Miss":
            pick.pnl = -pick.risk_amount if pick.risk_amount else Decimal(0)
        elif pick.status == "Push":
            pick.pnl = Decimal(0)
        else:
            pick.pnl = None
    
    def evaluate_all_picks(self, picks: list):
        """
        Evaluate all picks in a list.
        
        Args:
            picks: List of Pick objects
        """
        for pick in picks:
            if pick.status == "Pending":
                self.evaluate_pick(pick)
