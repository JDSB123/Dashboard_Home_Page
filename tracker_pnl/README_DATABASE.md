# Box Score Database Infrastructure

Robust SQLite-based storage, reporting, and sequencing system for box score history across all leagues.

## Overview

This infrastructure provides:
- **SQLite Database**: Normalized storage with proper indexing
- **Reporting & Analytics**: Comprehensive reporting with pandas/Excel
- **Sequencing & Timeline**: Chronological sequencing and gap analysis
- **Migration Tools**: Import existing JSON files into database

## Components

### 1. BoxScoreDatabase (`src/box_score_database.py`)
SQLite database with normalized schema:
- `games` table: Core game information
- `quarter_scores` table: Quarter-by-quarter scores
- `half_scores` table: Half scores
- Indexed for fast queries by date, league, status

### 2. BoxScoreReporter (`src/box_score_reporter.py`)
Reporting and analytics:
- Generate summary statistics
- Export to Excel with multiple sheets
- Date coverage reports
- League-specific reports

### 3. BoxScoreSequencer (`src/box_score_sequencer.py`)
Timeline and sequencing features:
- Chronological sequences with sequence numbers
- Timeline summaries
- Gap analysis (identify missing dates)
- Coverage statistics

## Quick Start

### 1. Import Existing JSON Files

Import all your existing box scores into the database:

```bash
python import_box_scores.py --stats
```

Import specific league:
```bash
python import_box_scores.py --league NBA --stats
```

Import and generate report:
```bash
python import_box_scores.py --stats --report box_scores_report.xlsx
```

### 2. Query the Database

Show statistics:
```bash
python query_box_scores.py --stats
```

Query games by date:
```bash
python query_box_scores.py --date 2025-12-14
```

Query date range:
```bash
python query_box_scores.py --start-date 2025-12-01 --end-date 2025-12-31 --league NBA
```

Show coverage and gaps:
```bash
python query_box_scores.py --coverage --gaps
```

Generate Excel report:
```bash
python query_box_scores.py --start-date 2025-10-01 --end-date 2026-01-08 --report full_report.xlsx
```

## Database Schema

### Games Table
```sql
CREATE TABLE games (
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
```

### Quarter Scores Table
```sql
CREATE TABLE quarter_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    league TEXT NOT NULL,
    quarter TEXT NOT NULL,
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    FOREIGN KEY (game_id, league) REFERENCES games(game_id, league),
    UNIQUE(game_id, league, quarter)
)
```

### Half Scores Table
```sql
CREATE TABLE half_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    league TEXT NOT NULL,
    half TEXT NOT NULL,
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    FOREIGN KEY (game_id, league) REFERENCES games(game_id, league),
    UNIQUE(game_id, league, half)
)
```

## Programmatic Usage

### Database Operations

```python
from src.box_score_database import BoxScoreDatabase

# Initialize database
db = BoxScoreDatabase("box_scores.db")

# Import JSON files
db.import_from_directory("box_scores")

# Query games
games = db.get_games_by_date("2025-12-14", league="NBA")
games_range = db.get_date_range("2025-12-01", "2025-12-31", league="NBA")

# Get statistics
stats = db.get_statistics()
stats_nba = db.get_statistics(league="NBA")

# Get available dates
dates = db.get_available_dates(league="NBA")
```

### Reporting

```python
from src.box_score_reporter import BoxScoreReporter

reporter = BoxScoreReporter(db)

# Get DataFrame
df = reporter.get_games_dataframe(start_date="2025-12-01", end_date="2025-12-31", league="NBA")

# Generate summary
summary = reporter.generate_summary_report(league="NBA")

# Export to Excel
reporter.export_to_excel("report.xlsx", start_date="2025-12-01", end_date="2025-12-31")
```

### Sequencing

```python
from src.box_score_sequencer import BoxScoreSequencer

sequencer = BoxScoreSequencer(db)

# Get chronological sequence
sequence = sequencer.get_chronological_sequence("2025-12-01", "2025-12-31", league="NBA")

# Get timeline summary
timeline = sequencer.get_timeline_summary("2025-12-01", "2025-12-31")

# Get coverage statistics
coverage = sequencer.get_coverage_statistics(league="NBA")

# Find gaps
gaps = sequencer.get_game_gaps(league="NBA")
```

## Features

### Storage Benefits
- **Normalized Schema**: Efficient storage with proper relationships
- **Indexed Queries**: Fast lookups by date, league, status
- **Data Integrity**: Primary keys and foreign keys ensure consistency
- **Scalability**: SQLite handles large datasets efficiently

### Reporting Benefits
- **Flexible Queries**: Filter by date, league, status
- **Excel Export**: Multi-sheet reports with summaries
- **Statistics**: Comprehensive analytics on games and scores
- **Coverage Analysis**: Identify gaps and completeness

### Sequencing Benefits
- **Chronological Ordering**: Sequence numbers for timeline analysis
- **Gap Detection**: Identify missing dates/games
- **Coverage Metrics**: Calculate completeness percentages
- **Timeline Visualization**: Day-by-day game counts

## Migration from JSON Files

The system can import all your existing JSON files:

```bash
# Import all leagues
python import_box_scores.py

# Import and show statistics
python import_box_scores.py --stats

# Import and generate report
python import_box_scores.py --stats --report initial_report.xlsx
```

The import process:
1. Scans `box_scores/` directory structure
2. Processes all JSON files (individual dates + historical files)
3. Normalizes data structure
4. Stores in SQLite with proper relationships
5. Handles duplicates (upsert based on game_id + league)

## Integration with Existing System

The database works alongside the existing JSON file structure:
- JSON files remain as backup/source
- Database provides fast queries and analytics
- Can sync/update database from JSON files
- Export back to JSON format if needed

## Performance

- **Fast Queries**: Indexed columns for quick lookups
- **Efficient Storage**: Normalized schema reduces redundancy
- **Scalable**: SQLite handles thousands of games efficiently
- **Memory Efficient**: Query only what you need

## Future Enhancements

- [ ] Sync/update database from new JSON files
- [ ] Backfill missing data from APIs
- [ ] Advanced analytics (scoring trends, team performance)
- [ ] Web dashboard integration
- [ ] Automated reporting schedules
