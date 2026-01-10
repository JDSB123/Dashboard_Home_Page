#!/usr/bin/env python3
"""Show picks for a specific day from the source of truth file."""
import pandas as pd
import sys

SOURCE_FILE = 'C:/Users/JB/green-bier-ventures/Dashboard_main_local/output/analysis/telegram_analysis_2025-12-28.xlsx'

def main():
    date = sys.argv[1] if len(sys.argv) > 1 else '2026-01-06'
    
    df = pd.read_excel(SOURCE_FILE)
    day_df = df[df['Date'] == date]
    
    if len(day_df) == 0:
        print(f'No picks found for {date}')
        return
    
    wins = len(day_df[day_df['Hit/Miss'] == 'Win'])
    losses = len(day_df[day_df['Hit/Miss'] == 'Loss'])
    pnl = day_df['PnL'].sum()
    risked = day_df['To Risk'].sum()
    
    print(f'{date} PICKS')
    print('='*130)
    print(day_df[['Date', 'League', 'Matchup', 'Segment', 'Pick', 'Odds', 'Hit/Miss', 'Full Score', 'To Risk', 'PnL']].to_string(index=False))
    print('='*130)
    print(f'TOTAL: {len(day_df)} picks | {wins}W-{losses}L | Risked: ${risked:,.0f} | PnL: ${pnl:,.0f}')

if __name__ == '__main__':
    main()
