"""
Audit missing 1H/2H scores in consolidated historical data.
Identifies which games have "unknown" scores and need enrichment.
"""

import pandas as pd
from pathlib import Path
from collections import Counter

def main():
    csv_path = Path("data-pipeline/consolidated_historical_data.csv")
    if not csv_path.exists():
        print(f"ERROR: {csv_path} not found")
        return
    
    df = pd.read_csv(csv_path)
    
    print(f"{'='*80}")
    print(f"Missing Score Audit")
    print(f"{'='*80}")
    print(f"\nTotal games: {len(df):,}")
    
    # Identify missing 1H scores
    missing_1h = df[
        df['home_score_1h'].isna() | 
        (df['home_score_1h'] == 'unknown') |
        (df['away_score_1h'].isna()) |
        (df['away_score_1h'] == 'unknown')
    ]
    
    print(f"Missing 1H scores: {len(missing_1h):,} ({len(missing_1h)/len(df)*100:.1f}%)")
    
    # Break down by league
    print(f"\n{'League':<10} {'Total':<10} {'Missing':<10} {'%':<10}")
    print(f"{'-'*40}")
    
    for league in sorted(df['league'].unique()):
        league_df = df[df['league'] == league]
        league_missing = missing_1h[missing_1h['league'] == league]
        pct = (len(league_missing) / len(league_df) * 100) if len(league_df) > 0 else 0
        print(f"{league:<10} {len(league_df):<10} {len(league_missing):<10} {pct:<10.1f}")
    
    # Break down by date range
    print(f"\n{'='*80}")
    print(f"Missing by Date Range")
    print(f"{'='*80}")
    
    df['game_date'] = pd.to_datetime(df['game_date'])
    missing_1h_dates = missing_1h.copy()
    missing_1h_dates['game_date'] = pd.to_datetime(missing_1h_dates['game_date'])
    
    # Group by month
    df['month'] = df['game_date'].dt.to_period('M')
    missing_1h_dates['month'] = missing_1h_dates['game_date'].dt.to_period('M')
    
    month_counts = df.groupby('month').size()
    month_missing = missing_1h_dates.groupby('month').size()
    
    print(f"\n{'Month':<15} {'Total':<10} {'Missing':<10} {'%':<10}")
    print(f"{'-'*45}")
    
    for month in sorted(month_counts.index)[-12:]:  # Last 12 months
        total = month_counts.get(month, 0)
        missing = month_missing.get(month, 0)
        pct = (missing / total * 100) if total > 0 else 0
        print(f"{str(month):<15} {total:<10} {missing:<10} {pct:<10.1f}")
    
    # Sample of missing games
    print(f"\n{'='*80}")
    print(f"Sample of Missing 1H Scores (recent games)")
    print(f"{'='*80}")
    
    recent_missing = missing_1h.sort_values('game_date', ascending=False).head(20)
    
    print(f"\n{'Date':<12} {'League':<8} {'Matchup':<30} {'Final':<15}")
    print(f"{'-'*70}")
    
    for _, row in recent_missing.iterrows():
        matchup = f"{row['away_team']} @ {row['home_team']}"
        final = f"{row['away_score']}-{row['home_score']}"
        print(f"{row['game_date']:<12} {row['league']:<8} {matchup:<30} {final:<15}")
    
    # Check if any have 2H but not 1H
    has_2h_no_1h = df[
        (df['home_score_2h'].notna()) & 
        (df['home_score_2h'] != 'unknown') &
        (df['home_score_1h'].isna() | (df['home_score_1h'] == 'unknown'))
    ]
    
    print(f"\n{'='*80}")
    print(f"Games with 2H scores but no 1H scores: {len(has_2h_no_1h)}")
    if len(has_2h_no_1h) > 0:
        print(f"{'='*80}")
        for _, row in has_2h_no_1h.head(10).iterrows():
            print(f"  {row['game_date']} {row['league']}: {row['away_team']} @ {row['home_team']}")

if __name__ == "__main__":
    main()
