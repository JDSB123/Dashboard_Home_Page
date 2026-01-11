"""
Box Score Sequencer Module
Provides timeline/sequencing features for box score history.
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from .box_score_database import BoxScoreDatabase


class BoxScoreSequencer:
    """Provides sequencing and timeline features for box scores."""
    
    def __init__(self, db: BoxScoreDatabase):
        """
        Initialize sequencer.
        
        Args:
            db: BoxScoreDatabase instance
        """
        self.db = db
    
    def get_chronological_sequence(self, start_date: str, end_date: str,
                                   league: Optional[str] = None) -> List[Dict]:
        """
        Get games in chronological order with sequence numbers.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            league: Optional league filter
            
        Returns:
            List of games with sequence information
        """
        games = self.db.get_date_range(start_date, end_date, league)
        
        # Sort by date, then by game_id for consistency
        games.sort(key=lambda x: (x['date'], x['game_id']))
        
        # Add sequence numbers
        for idx, game in enumerate(games, 1):
            game['sequence_number'] = idx
            game['day_number'] = self._get_day_number(game['date'], start_date)
        
        return games
    
    def get_daily_sequence(self, date: str, league: Optional[str] = None) -> List[Dict]:
        """
        Get games for a single day in sequence order.
        
        Args:
            date: Date in YYYY-MM-DD format
            league: Optional league filter
            
        Returns:
            List of games for the day
        """
        games = self.db.get_games_by_date(date, league)
        
        # Sort by game_id or time if available
        games.sort(key=lambda x: x.get('game_id', ''))
        
        for idx, game in enumerate(games, 1):
            game['sequence_in_day'] = idx
        
        return games
    
    def get_timeline_summary(self, start_date: str, end_date: str,
                            league: Optional[str] = None) -> Dict:
        """
        Get timeline summary with game counts by date.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            league: Optional league filter
            
        Returns:
            Dictionary with timeline summary
        """
        games = self.db.get_date_range(start_date, end_date, league)
        
        # Group by date
        games_by_date = defaultdict(list)
        for game in games:
            games_by_date[game['date']].append(game)
        
        # Create timeline
        timeline = []
        current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        while current_date <= end_dt:
            date_str = current_date.strftime("%Y-%m-%d")
            day_games = games_by_date.get(date_str, [])
            
            timeline.append({
                'date': date_str,
                'game_count': len(day_games),
                'leagues': list(set(g['league'] for g in day_games)) if day_games else [],
                'statuses': {
                    status: sum(1 for g in day_games if g['status'] == status)
                    for status in ['final', 'scheduled', 'live', 'postponed']
                }
            })
            
            current_date += timedelta(days=1)
        
        return {
            'start_date': start_date,
            'end_date': end_date,
            'total_games': len(games),
            'total_days': len(timeline),
            'days_with_games': sum(1 for day in timeline if day['game_count'] > 0),
            'timeline': timeline
        }
    
    def get_league_sequence(self, league: str, start_date: Optional[str] = None,
                           end_date: Optional[str] = None) -> List[Dict]:
        """
        Get all games for a league in chronological sequence.
        
        Args:
            league: League code
            start_date: Optional start date
            end_date: Optional end date
            
        Returns:
            List of games with sequence numbers
        """
        if start_date and end_date:
            games = self.db.get_date_range(start_date, end_date, league)
        else:
            # Get all dates for league
            dates = self.db.get_available_dates(league)
            games = []
            for date_str in dates:
                games.extend(self.db.get_games_by_date(date_str, league))
        
        # Sort chronologically
        games.sort(key=lambda x: (x['date'], x['game_id']))
        
        # Add sequence numbers
        for idx, game in enumerate(games, 1):
            game['sequence_number'] = idx
        
        return games
    
    def get_game_gaps(self, league: Optional[str] = None) -> List[Dict]:
        """
        Identify gaps in game coverage (dates with no games).
        
        Args:
            league: Optional league filter
            
        Returns:
            List of gap periods
        """
        dates = self.db.get_available_dates(league)
        if not dates:
            return []
        
        dates.sort()
        gaps = []
        
        for i in range(len(dates) - 1):
            current = datetime.strptime(dates[i], "%Y-%m-%d").date()
            next_date = datetime.strptime(dates[i + 1], "%Y-%m-%d").date()
            
            gap_days = (next_date - current).days - 1
            
            if gap_days > 0:
                gaps.append({
                    'start_date': dates[i],
                    'end_date': dates[i + 1],
                    'gap_days': gap_days,
                    'missing_dates': [
                        (current + timedelta(days=d)).strftime("%Y-%m-%d")
                        for d in range(1, gap_days + 1)
                    ]
                })
        
        return gaps
    
    def get_coverage_statistics(self, league: Optional[str] = None) -> Dict:
        """
        Get coverage statistics showing completeness.
        
        Args:
            league: Optional league filter
            
        Returns:
            Dictionary with coverage statistics
        """
        dates = self.db.get_available_dates(league)
        if not dates:
            return {"error": "No data available"}
        
        dates.sort()
        earliest = datetime.strptime(dates[0], "%Y-%m-%d").date()
        latest = datetime.strptime(dates[-1], "%Y-%m-%d").date()
        
        total_days = (latest - earliest).days + 1
        days_with_data = len(dates)
        coverage_percent = (days_with_data / total_days) * 100
        
        gaps = self.get_game_gaps(league)
        
        return {
            'date_range': {
                'earliest': dates[0],
                'latest': dates[-1],
                'total_days': total_days
            },
            'coverage': {
                'days_with_data': days_with_data,
                'days_without_data': total_days - days_with_data,
                'coverage_percent': coverage_percent
            },
            'gaps': {
                'total_gaps': len(gaps),
                'total_gap_days': sum(g['gap_days'] for g in gaps),
                'largest_gap_days': max([g['gap_days'] for g in gaps] + [0]),
                'gap_details': gaps[:10]  # First 10 gaps
            }
        }
    
    def _get_day_number(self, date_str: str, start_date: str) -> int:
        """Calculate day number from start date."""
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        start_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        return (date_obj - start_obj).days + 1
