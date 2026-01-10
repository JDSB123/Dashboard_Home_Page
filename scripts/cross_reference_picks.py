#!/usr/bin/env python3
"""
Cross-reference telegram parsed picks with audited spreadsheet.
"""
import pandas as pd
from datetime import datetime

# Load audited data from spreadsheet
excel_path = r"C:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx"
audited = pd.read_excel(excel_path, sheet_name='audited 12.15 thru 12.27')
audited_sheet1 = pd.read_excel(excel_path, sheet_name='Sheet1')

# Convert dates
audited['Date'] = pd.to_datetime(audited['Date'])
audited_sheet1['Date'] = pd.to_datetime(audited_sheet1['Date'])

# Load our parsed picks (corrected version)
parsed = pd.read_csv('output/telegram_parsed/telegram_all_picks_corrected.csv')
parsed['Date'] = pd.to_datetime(parsed['Date'])

# Filter parsed to match audited date range (12/15 - 12/27)
audited_range = parsed[(parsed['Date'] >= '2025-12-15') & (parsed['Date'] <= '2025-12-27')].copy()

print("="*80)
print("CROSS-REFERENCE: Telegram Parsed vs Audited Spreadsheet")
print("="*80)

print(f"\nAudited Sheet 1 (12.15 thru 12.27): {len(audited)} rows")
print(f"Audited Sheet 2: {len(audited_sheet1)} rows")
print(f"\nParsed picks (12/15-12/27): {len(audited_range)} rows")

# Show league breakdown comparison
print(f"\n{'='*80}")
print("PARSED PICKS BREAKDOWN (12/15-12/27):")
print(f"{'='*80}")
print(audited_range['League'].value_counts().sort_index())

print(f"\n{'='*80}")
print("AUDITED SPREADSHEET BREAKDOWN (12/15-12/27):")
print(f"{'='*80}")
print(audited[audited['Date'].between('2025-12-15', '2025-12-27')]['League'].value_counts())

# Show all audited picks by date
print(f"\n{'='*80}")
print("ALL AUDITED PICKS (12.15 thru 12.27):")
print(f"{'='*80}")
audited_filtered = audited[audited['Date'].between('2025-12-15', '2025-12-27')].copy()
print(audited_filtered[['Date', 'League', 'Matchup', 'Segment', 'Pick (Odds)', 'Risk', 'To Win', 'Hit/Miss']].to_string())

# Try to match picks between datasets
print(f"\n{'='*80}")
print("MATCH ANALYSIS:")
print(f"{'='*80}")

# Group by date for easier comparison
for date in sorted(audited_range['Date'].unique()):
    parsed_for_date = audited_range[audited_range['Date'] == date]
    audited_for_date = audited_filtered[audited_filtered['Date'] == date]
    
    print(f"\n{date.strftime('%Y-%m-%d')}:")
    print(f"  Parsed: {len(parsed_for_date)} picks")
    print(f"  Audited: {len(audited_for_date)} picks")
    
    if len(audited_for_date) > 0:
        print(f"  Audited picks:")
        for _, row in audited_for_date.iterrows():
            print(f"    - {row['League']:6s} {row['Matchup']:40s} {row['Segment']:4s} {row['Pick (Odds)']}")
