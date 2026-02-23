"""
Box Score Reporter Module
Provides reporting and analytics on box score data.
"""

import logging

import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

from .box_score_database import BoxScoreDatabase


class BoxScoreReporter:
    """Generates reports and analytics from box score database."""
    
    def __init__(self, db: BoxScoreDatabase):
        """
        Initialize reporter.
        
        Args:
            db: BoxScoreDatabase instance
        """
        self.db = db
    
    def get_games_dataframe(self, start_date: Optional[str] = None,
                           end_date: Optional[str] = None,
                           league: Optional[str] = None) -> pd.DataFrame:
        """
        Get games as pandas DataFrame.
        
        Args:
            start_date: Optional start date filter
            end_date: Optional end date filter
            league: Optional league filter
            
        Returns:
            DataFrame with game data
        """
        if start_date and end_date:
            games = self.db.get_date_range(start_date, end_date, league)
        elif start_date:
            games = self.db.get_games_by_date(start_date, league)
        else:
            # Get all available dates
            dates = self.db.get_available_dates(league)
            games = []
            for date_str in dates:
                games.extend(self.db.get_games_by_date(date_str, league))
        
        # Flatten data for DataFrame
        rows = []
        for game in games:
            row = {
                'game_id': game['game_id'],
                'date': game['date'],
                'league': game['league'],
                'home_team': game['home_team'],
                'away_team': game['away_team'],
                'home_team_full': game.get('home_team_full'),
                'away_team_full': game.get('away_team_full'),
                'home_score': game['home_score'],
                'away_score': game['away_score'],
                'status': game['status'],
                'total_score': game['home_score'] + game['away_score'],
                'score_diff': abs(game['home_score'] - game['away_score'])
            }
            
            # Add quarter scores
            quarters = game.get('quarter_scores', {})
            for q in ['Q1', 'Q2', 'Q3', 'Q4']:
                if q in quarters:
                    row[f'{q}_home'] = quarters[q]['home']
                    row[f'{q}_away'] = quarters[q]['away']
                    row[f'{q}_total'] = quarters[q]['home'] + quarters[q]['away']
                else:
                    row[f'{q}_home'] = None
                    row[f'{q}_away'] = None
                    row[f'{q}_total'] = None
            
            # Add half scores
            halves = game.get('half_scores', {})
            for h in ['H1', 'H2']:
                if h in halves:
                    row[f'{h}_home'] = halves[h]['home']
                    row[f'{h}_away'] = halves[h]['away']
                    row[f'{h}_total'] = halves[h]['home'] + halves[h]['away']
                else:
                    row[f'{h}_home'] = None
                    row[f'{h}_away'] = None
                    row[f'{h}_total'] = None
            
            rows.append(row)
        
        return pd.DataFrame(rows)
    
    def generate_summary_report(self, league: Optional[str] = None) -> Dict:
        """
        Generate summary statistics report.
        
        Args:
            league: Optional league filter
            
        Returns:
            Dictionary with summary statistics
        """
        stats = self.db.get_statistics(league)
        
        df = self.get_games_dataframe(league=league)
        
        if len(df) == 0:
            return {"error": "No data available"}
        
        # Calculate additional statistics
        report = {
            "overview": {
                "total_games": len(df),
                "earliest_date": df['date'].min(),
                "latest_date": df['date'].max(),
                "unique_dates": df['date'].nunique(),
                "leagues": df['league'].unique().tolist() if league is None else [league]
            },
            "by_league": df.groupby('league').agg({
                'game_id': 'count',
                'total_score': ['mean', 'median', 'std'],
                'score_diff': ['mean', 'median', 'std']
            }).to_dict() if league is None else {},
            "by_status": df.groupby('status').size().to_dict(),
            "scoring_stats": {
                "avg_total_score": df['total_score'].mean(),
                "median_total_score": df['total_score'].median(),
                "avg_score_diff": df['score_diff'].mean(),
                "median_score_diff": df['score_diff'].median(),
                "highest_total": df['total_score'].max(),
                "lowest_total": df['total_score'].min()
            }
        }
        
        return report
    
    def generate_league_report(self, league: str, output_file: Optional[str] = None) -> pd.DataFrame:
        """
        Generate detailed league report.
        
        Args:
            league: League code
            output_file: Optional CSV output file path
            
        Returns:
            DataFrame with league data
        """
        df = self.get_games_dataframe(league=league)
        
        if output_file:
            df.to_csv(output_file, index=False)
            logger.info(f"Report saved to {output_file}")
        
        return df
    
    def generate_date_coverage_report(self) -> pd.DataFrame:
        """
        Generate report showing date coverage by league.
        
        Returns:
            DataFrame with date coverage information
        """
        leagues = ["NBA", "NFL", "NCAAF", "NCAAM"]
        rows = []
        
        for league in leagues:
            dates = self.db.get_available_dates(league)
            if dates:
                games_by_date = {}
                for date_str in dates:
                    games = self.db.get_games_by_date(date_str, league)
                    games_by_date[date_str] = len(games)
                
                rows.append({
                    'league': league,
                    'total_dates': len(dates),
                    'total_games': sum(games_by_date.values()),
                    'earliest_date': min(dates),
                    'latest_date': max(dates),
                    'avg_games_per_date': sum(games_by_date.values()) / len(dates) if dates else 0
                })
        
        return pd.DataFrame(rows)
    
    def export_to_excel(self, output_file: str, start_date: Optional[str] = None,
                       end_date: Optional[str] = None, league: Optional[str] = None):
        """
        Export games to Excel with multiple sheets.
        
        Args:
            output_file: Output Excel file path
            start_date: Optional start date filter
            end_date: Optional end date filter
            league: Optional league filter
        """
        df = self.get_games_dataframe(start_date, end_date, league)
        
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            # Main games sheet
            df.to_excel(writer, sheet_name='Games', index=False)
            
            # Summary by league
            if league is None:
                for league_code in df['league'].unique():
                    league_df = df[df['league'] == league_code]
                    league_df.to_excel(writer, sheet_name=f'{league_code}_Games', index=False)
            
            # Summary statistics
            summary = self.generate_summary_report(league)
            summary_df = pd.DataFrame([summary['overview']])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # Date coverage
            coverage_df = self.generate_date_coverage_report()
            coverage_df.to_excel(writer, sheet_name='Coverage', index=False)
        
        logger.info(f"Excel report saved to {output_file}")
