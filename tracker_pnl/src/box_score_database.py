"""
Box Score Database Module
Robust storage, retrieval, and sequencing of box score history using SQLite.
"""

import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime, date
from contextlib import contextmanager


class BoxScoreDatabase:
    """SQLite database for robust box score storage and querying."""
    
    def __init__(self, db_path: str = "box_scores.db"):
        """
        Initialize box score database.
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Games table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    game_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    league TEXT NOT NULL,
                    home_team TEXT NOT NULL,
                    away_team TEXT NOT NULL,
                    home_team_full TEXT,
                    away_team_full TEXT,
                    home_score INTEGER NOT NULL,
                    away_score INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    source TEXT,
                    fetched_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (game_id, league)
                )
            """)
            
            # Quarter scores table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quarter_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT NOT NULL,
                    league TEXT NOT NULL,
                    quarter TEXT NOT NULL,
                    home_score INTEGER NOT NULL,
                    away_score INTEGER NOT NULL,
                    FOREIGN KEY (game_id, league) REFERENCES games(game_id, league),
                    UNIQUE(game_id, league, quarter)
                )
            """)
            
            # Half scores table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS half_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT NOT NULL,
                    league TEXT NOT NULL,
                    half TEXT NOT NULL,
                    home_score INTEGER NOT NULL,
                    away_score INTEGER NOT NULL,
                    FOREIGN KEY (game_id, league) REFERENCES games(game_id, league),
                    UNIQUE(game_id, league, half)
                )
            """)
            
            # Create indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_league ON games(league)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_date_league ON games(date, league)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_quarters_game ON quarter_scores(game_id, league)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_halves_game ON half_scores(game_id, league)")
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Get database connection context manager."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
        finally:
            conn.close()
    
    def import_from_json(self, json_data: List[Dict], league: str, source: str = "import"):
        """
        Import box scores from JSON data.
        
        Args:
            json_data: List of box score dictionaries
            league: League code
            source: Source identifier
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            for game_data in json_data:
                game_id = str(game_data.get("game_id", ""))
                if not game_id:
                    continue
                
                # Insert or update game
                cursor.execute("""
                    INSERT OR REPLACE INTO games 
                    (game_id, date, league, home_team, away_team, home_team_full, away_team_full,
                     home_score, away_score, status, source, fetched_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    game_id,
                    game_data.get("date", ""),
                    league,
                    game_data.get("home_team", ""),
                    game_data.get("away_team", ""),
                    game_data.get("home_team_full"),
                    game_data.get("away_team_full"),
                    game_data.get("home_score", 0),
                    game_data.get("away_score", 0),
                    game_data.get("status", "pending"),
                    source,
                    game_data.get("fetched_at", datetime.now().isoformat()),
                    datetime.now().isoformat()
                ))
                
                # Insert quarter scores
                quarter_scores = game_data.get("quarter_scores", {})
                for quarter, scores in quarter_scores.items():
                    if isinstance(scores, dict):
                        home_score = scores.get("home")
                        away_score = scores.get("away")
                        # Skip if scores are None
                        if home_score is None or away_score is None:
                            continue
                        cursor.execute("""
                            INSERT OR REPLACE INTO quarter_scores
                            (game_id, league, quarter, home_score, away_score)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            game_id,
                            league,
                            quarter,
                            int(home_score),
                            int(away_score)
                        ))
                
                # Insert half scores
                half_scores = game_data.get("half_scores", {})
                for half, scores in half_scores.items():
                    if isinstance(scores, dict):
                        home_score = scores.get("home")
                        away_score = scores.get("away")
                        # Skip if scores are None
                        if home_score is None or away_score is None:
                            continue
                        cursor.execute("""
                            INSERT OR REPLACE INTO half_scores
                            (game_id, league, half, home_score, away_score)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            game_id,
                            league,
                            half,
                            int(home_score),
                            int(away_score)
                        ))
            
            conn.commit()
    
    def import_from_json_file(self, json_file_path: str, league: str, source: str = "file"):
        """
        Import box scores from a JSON file.
        
        Args:
            json_file_path: Path to JSON file
            league: League code (if not in filename)
            source: Source identifier
        """
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Determine league from path if not provided
        if not league:
            path_parts = Path(json_file_path).parts
            if len(path_parts) >= 2:
                league = path_parts[-2]
        
        self.import_from_json(data, league, source)
    
    def import_from_directory(self, directory: str):
        """
        Import all JSON files from a directory structure.
        
        Args:
            directory: Root directory containing league subdirectories
        """
        directory_path = Path(directory)
        
        for league_dir in directory_path.iterdir():
            if not league_dir.is_dir():
                continue
            
            league = league_dir.name
            print(f"Importing {league}...")
            
            json_files = list(league_dir.glob("*.json"))
            print(f"  Found {len(json_files)} JSON files")
            
            for json_file in json_files:
                try:
                    self.import_from_json_file(str(json_file), league, source=f"file_{json_file.stem}")
                except Exception as e:
                    print(f"  Error importing {json_file.name}: {e}")
            
            print(f"  Completed {league}")
    
    def get_game(self, game_id: str, league: str) -> Optional[Dict]:
        """
        Get a single game with all scores.
        
        Args:
            game_id: Game ID
            league: League code
            
        Returns:
            Game dictionary with quarter and half scores, or None
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Get game
            cursor.execute("""
                SELECT * FROM games WHERE game_id = ? AND league = ?
            """, (game_id, league))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            game = dict(row)
            
            # Get quarter scores
            cursor.execute("""
                SELECT quarter, home_score, away_score 
                FROM quarter_scores 
                WHERE game_id = ? AND league = ?
                ORDER BY quarter
            """, (game_id, league))
            
            quarters = {}
            for row in cursor.fetchall():
                quarters[row['quarter']] = {
                    "home": row['home_score'],
                    "away": row['away_score']
                }
            game['quarter_scores'] = quarters
            
            # Get half scores
            cursor.execute("""
                SELECT half, home_score, away_score 
                FROM half_scores 
                WHERE game_id = ? AND league = ?
                ORDER BY half
            """, (game_id, league))
            
            halves = {}
            for row in cursor.fetchall():
                halves[row['half']] = {
                    "home": row['home_score'],
                    "away": row['away_score']
                }
            game['half_scores'] = halves
            
            return game
    
    def get_games_by_date(self, game_date: str, league: Optional[str] = None) -> List[Dict]:
        """
        Get all games for a specific date.
        
        Args:
            game_date: Date in YYYY-MM-DD format
            league: Optional league filter
            
        Returns:
            List of game dictionaries
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if league:
                cursor.execute("""
                    SELECT * FROM games 
                    WHERE date = ? AND league = ?
                    ORDER BY home_team, away_team
                """, (game_date, league))
            else:
                cursor.execute("""
                    SELECT * FROM games 
                    WHERE date = ?
                    ORDER BY league, home_team, away_team
                """, (game_date,))
            
            games = []
            for row in cursor.fetchall():
                game = dict(row)
                game_id = game['game_id']
                game_league = game['league']
                
                # Get quarter scores
                cursor.execute("""
                    SELECT quarter, home_score, away_score 
                    FROM quarter_scores 
                    WHERE game_id = ? AND league = ?
                    ORDER BY quarter
                """, (game_id, game_league))
                
                quarters = {}
                for q_row in cursor.fetchall():
                    quarters[q_row['quarter']] = {
                        "home": q_row['home_score'],
                        "away": q_row['away_score']
                    }
                game['quarter_scores'] = quarters
                
                # Get half scores
                cursor.execute("""
                    SELECT half, home_score, away_score 
                    FROM half_scores 
                    WHERE game_id = ? AND league = ?
                    ORDER BY half
                """, (game_id, game_league))
                
                halves = {}
                for h_row in cursor.fetchall():
                    halves[h_row['half']] = {
                        "home": h_row['home_score'],
                        "away": h_row['away_score']
                    }
                game['half_scores'] = halves
                
                games.append(game)
            
            return games
    
    def get_date_range(self, start_date: str, end_date: str, 
                      league: Optional[str] = None) -> List[Dict]:
        """
        Get games in a date range.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            league: Optional league filter
            
        Returns:
            List of game dictionaries
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if league:
                cursor.execute("""
                    SELECT * FROM games 
                    WHERE date >= ? AND date <= ? AND league = ?
                    ORDER BY date, home_team, away_team
                """, (start_date, end_date, league))
            else:
                cursor.execute("""
                    SELECT * FROM games 
                    WHERE date >= ? AND date <= ?
                    ORDER BY date, league, home_team, away_team
                """, (start_date, end_date))
            
            games = []
            for row in cursor.fetchall():
                game = dict(row)
                game_id = game['game_id']
                game_league = game['league']
                
                # Get quarter scores
                cursor.execute("""
                    SELECT quarter, home_score, away_score 
                    FROM quarter_scores 
                    WHERE game_id = ? AND league = ?
                    ORDER BY quarter
                """, (game_id, game_league))
                
                quarters = {}
                for q_row in cursor.fetchall():
                    quarters[q_row['quarter']] = {
                        "home": q_row['home_score'],
                        "away": q_row['away_score']
                    }
                game['quarter_scores'] = quarters
                
                # Get half scores
                cursor.execute("""
                    SELECT half, home_score, away_score 
                    FROM half_scores 
                    WHERE game_id = ? AND league = ?
                    ORDER BY half
                """, (game_id, game_league))
                
                halves = {}
                for h_row in cursor.fetchall():
                    halves[h_row['half']] = {
                        "home": h_row['home_score'],
                        "away": h_row['away_score']
                    }
                game['half_scores'] = halves
                
                games.append(game)
            
            return games
    
    def get_statistics(self, league: Optional[str] = None) -> Dict:
        """
        Get database statistics.
        
        Args:
            league: Optional league filter
            
        Returns:
            Statistics dictionary
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if league:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_games,
                        MIN(date) as earliest_date,
                        MAX(date) as latest_date,
                        COUNT(DISTINCT date) as unique_dates
                    FROM games
                    WHERE league = ?
                """, (league,))
            else:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_games,
                        MIN(date) as earliest_date,
                        MAX(date) as latest_date,
                        COUNT(DISTINCT date) as unique_dates
                    FROM games
                """)
            
            row = cursor.fetchone()
            stats = dict(row)
            
            # Games by league
            cursor.execute("""
                SELECT league, COUNT(*) as count
                FROM games
                GROUP BY league
            """)
            
            stats['by_league'] = {row['league']: row['count'] for row in cursor.fetchall()}
            
            # Games by status
            cursor.execute("""
                SELECT status, COUNT(*) as count
                FROM games
                GROUP BY status
            """)
            
            stats['by_status'] = {row['status']: row['count'] for row in cursor.fetchall()}
            
            return stats
    
    def get_available_dates(self, league: Optional[str] = None) -> List[str]:
        """
        Get list of dates with games.
        
        Args:
            league: Optional league filter
            
        Returns:
            Sorted list of dates in YYYY-MM-DD format
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if league:
                cursor.execute("""
                    SELECT DISTINCT date 
                    FROM games 
                    WHERE league = ?
                    ORDER BY date
                """, (league,))
            else:
                cursor.execute("""
                    SELECT DISTINCT date 
                    FROM games 
                    ORDER BY date
                """)
            
            return [row['date'] for row in cursor.fetchall()]
    
    def export_to_json(self, output_file: str, start_date: Optional[str] = None,
                      end_date: Optional[str] = None, league: Optional[str] = None):
        """
        Export games to JSON file.
        
        Args:
            output_file: Output JSON file path
            start_date: Optional start date filter
            end_date: Optional end date filter
            league: Optional league filter
        """
        if start_date and end_date:
            games = self.get_date_range(start_date, end_date, league)
        elif start_date:
            games = self.get_games_by_date(start_date, league)
        else:
            # Export all
            dates = self.get_available_dates(league)
            games = []
            for date_str in dates:
                games.extend(self.get_games_by_date(date_str, league))
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(games, f, indent=2, ensure_ascii=False)
