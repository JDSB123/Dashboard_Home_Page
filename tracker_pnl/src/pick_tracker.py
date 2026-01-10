"""
Pick Tracker Module
Handles data models and core tracking logic for sports betting picks.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Tuple
import re


@dataclass
class Pick:
    """Represents a single betting pick."""
    
    # Core fields
    date_time_cst: Optional[datetime] = None
    date: Optional[str] = None
    league: Optional[str] = None
    matchup: Optional[str] = None  # Format: "Away @ Home"
    segment: Optional[str] = None  # e.g., "1st Half", "Q1", "2H", "Full Game"
    pick_description: Optional[str] = None  # e.g., "Under 24 (-110)"
    odds: Optional[str] = None  # e.g., "-110", "+105"
    risk_amount: Optional[Decimal] = None
    to_win_amount: Optional[Decimal] = None
    
    # Result fields
    final_score: Optional[str] = None  # e.g., "Bills 35 - Patriots 31"
    first_half_score: Optional[str] = None  # e.g., "Bills 7 - Patriots 24"
    status: str = "Pending"  # "Pending", "Hit", "Miss", "Push"
    pnl: Optional[Decimal] = None
    
    # Metadata
    source_text: Optional[str] = None  # Original conversation text
    game_id: Optional[str] = None  # Matched game ID from box scores
    
    BASE_UNIT = Decimal("50000.00")  # $50,000 default
    
    def calculate_bet_amounts(self, odds: str, base_unit: Decimal = None) -> Tuple[Decimal, Decimal]:
        """
        Calculate risk and to_win amounts based on odds.
        
        Rules:
        - If odds are negative: bet is to WIN base_unit (so risk more)
        - If odds are positive: bet is to RISK base_unit (so win more)
        
        Args:
            odds: Odds string like "-110" or "+105"
            base_unit: Base unit amount (defaults to BASE_UNIT)
            
        Returns:
            Tuple of (risk_amount, to_win_amount)
        """
        if base_unit is None:
            base_unit = self.BASE_UNIT
            
        # Parse odds
        odds_match = re.search(r'([+-]?\d+)', odds)
        if not odds_match:
            raise ValueError(f"Invalid odds format: {odds}")
            
        odds_value = int(odds_match.group(1))
        
        if odds_value < 0:
            # Negative odds: bet to WIN base_unit
            # If odds are -110, to win $100, you risk $110
            # So to win $50k at -110, you risk $55k
            to_win = base_unit
            risk = base_unit * abs(odds_value) / 100
        else:
            # Positive odds: bet to RISK base_unit
            # If odds are +105, risk $100 to win $105
            # So risk $50k at +105, you win $52.5k
            risk = base_unit
            to_win = base_unit * odds_value / 100
            
        return (risk, to_win)
    
    def set_odds_and_amounts(self, odds: str, base_unit: Decimal = None):
        """Set odds and calculate risk/to_win amounts."""
        self.odds = odds
        self.risk_amount, self.to_win_amount = self.calculate_bet_amounts(odds, base_unit)
    
    def format_risk_amount(self) -> str:
        """Format risk amount as currency string."""
        if self.risk_amount is None:
            return ""
        return f"${self.risk_amount:,.2f}"
    
    def format_to_win_amount(self) -> str:
        """Format to_win amount as currency string."""
        if self.to_win_amount is None:
            return ""
        return f"${self.to_win_amount:,.2f}"
    
    def format_pnl(self) -> str:
        """Format P&L amount as currency string."""
        if self.pnl is None:
            return ""
        sign = "+" if self.pnl >= 0 else ""
        return f"{sign}${self.pnl:,.2f}"
    
    def to_dict(self) -> dict:
        """Convert pick to dictionary for export."""
        return {
            "Date & Time (CST)": self.date_time_cst.strftime("%m/%d/%Y %H:%M") if self.date_time_cst else "",
            "Date": self.date or "",
            "League": self.league or "",
            "Matchup (Away @ Home)": self.matchup or "",
            "Segment": self.segment or "",
            "Pick (Odds)": self.pick_description or "",
            "Risk ($)": self.format_risk_amount(),
            "To Win ($)": self.format_to_win_amount(),
            "Final Score": self.final_score or "",
            "1H Score": self.first_half_score or "",
            "Hit/Miss/Push": self.status
        }
    
    def __str__(self) -> str:
        return f"Pick({self.matchup}, {self.pick_description}, {self.status})"


class PickTracker:
    """Manages a collection of picks and provides tracking functionality."""
    
    def __init__(self):
        self.picks: List[Pick] = []
    
    def add_pick(self, pick: Pick):
        """Add a pick to the tracker."""
        self.picks.append(pick)
    
    def add_picks(self, picks: List[Pick]):
        """Add multiple picks to the tracker."""
        self.picks.extend(picks)
    
    def get_pending_picks(self) -> List[Pick]:
        """Get all picks with status 'Pending'."""
        return [pick for pick in self.picks if pick.status == "Pending"]
    
    def get_completed_picks(self) -> List[Pick]:
        """Get all picks that are not pending."""
        return [pick for pick in self.picks if pick.status != "Pending"]
    
    def get_picks_by_league(self, league: str) -> List[Pick]:
        """Get all picks for a specific league."""
        return [pick for pick in self.picks if pick.league == league]
    
    def get_picks_by_date(self, date: str) -> List[Pick]:
        """Get all picks for a specific date."""
        return [pick for pick in self.picks if pick.date == date]
    
    def get_total_pnl(self) -> Decimal:
        """Calculate total P&L across all completed picks."""
        return sum(pick.pnl for pick in self.get_completed_picks() if pick.pnl is not None)
    
    def get_record(self) -> dict:
        """Get win/loss/push record."""
        completed = self.get_completed_picks()
        hits = sum(1 for pick in completed if pick.status == "Hit")
        misses = sum(1 for pick in completed if pick.status == "Miss")
        pushes = sum(1 for pick in completed if pick.status == "Push")
        return {
            "hits": hits,
            "misses": misses,
            "pushes": pushes,
            "total": len(completed),
            "win_rate": hits / len(completed) if completed else 0
        }
    
    def to_dataframe_dict(self) -> List[dict]:
        """Convert all picks to list of dictionaries for pandas DataFrame."""
        return [pick.to_dict() for pick in self.picks]
