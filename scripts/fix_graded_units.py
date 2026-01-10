#!/usr/bin/env python3
"""Fix graded picks units (thousands) and regenerate ROI report.

Assumptions:
- Graded CSV: output/graded/picks_dec28_jan6_fully_graded.csv
- Some numeric fields (Risk, To Win, PnL) are in units of $1,000; we will scale them by /1000.
- Update roi_report.txt header date range using CSV min/max dates.
"""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN = ROOT / 'output' / 'graded' / 'picks_dec28_jan6_fully_graded.csv'
OUT = ROOT / 'output' / 'graded' / 'picks_dec28_jan6_fully_graded_corrected.csv'
ROI = ROOT / 'output' / 'graded' / 'roi_report.txt'

print('Loading graded CSV:', IN)
df = pd.read_csv(IN)
print('Columns:', df.columns.tolist())

# Normalize known column names
cols = df.columns.str.strip()
df.columns = cols

# Identify numeric columns potentially in thousands
num_cols = []
for c in ['Risk', 'To Win', 'PnL']:
    if c in df.columns:
        num_cols.append(c)

print('Numeric columns to inspect:', num_cols)

# Heuristic: if median Risk > 1000, assume units are $1,000s and scale down
scale = 1.0
if 'Risk' in df.columns:
    med = df['Risk'].median()
    print('Median Risk:', med)
    if med > 1000:
        scale = 1/1000.0
        print('Detected large units; scaling numeric columns by 1/1000')
    else:
        print('No scaling needed')

if scale != 1.0:
    for c in num_cols:
        df[c] = df[c] * scale

# Standardize Hit/Miss values to lower-case 'win'/'loss' for consistency
if 'Hit/Miss' in df.columns:
    df['Hit/Miss'] = df['Hit/Miss'].astype(str).str.strip().str.lower()

# Compute summary by league
if 'League' in df.columns and 'PnL' in df.columns:
    summary = df.groupby('League').agg({
        'Risk': 'sum',
        'Hit/Miss': lambda x: (x == 'win').sum(),
        'PnL': 'sum',
        'Pick (Odds)': 'count'
    }).rename(columns={'Hit/Miss':'Wins', 'Pick (Odds)':'Pick Count'})
    summary['Win %'] = (summary['Wins'] / summary['Pick Count'] * 100).round(1)
    summary['ROE %'] = (summary['PnL'] / summary['Risk'] * 100).round(1)

    print('\nSummary by league (scaled):')
    print(summary[['Pick Count','Wins','Win %','Risk','PnL','ROE %']].to_string())

# Save corrected CSV
print('\nSaving corrected CSV to', OUT)
df.to_csv(OUT, index=False)

# Regenerate ROI report
min_date = pd.to_datetime(df['Date']).min().date()
max_date = pd.to_datetime(df['Date']).max().date()

total_picks = len(df)
total_risk = df['Risk'].sum()
total_pnl = df['PnL'].sum()
win_count = (df['Hit/Miss'] == 'win').sum()

report = []
report.append('=========================================')
report.append(f'ROI REPORT: {min_date} to {max_date}')
report.append('=========================================')
report.append(f'Total Picks: {total_picks}')
report.append(f'Record: {win_count}W - {total_picks - win_count}L')
report.append(f'Total Risk: ${total_risk:,.2f}')
report.append(f'Total PnL:  ${total_pnl:,.2f}')
roi = (total_pnl/total_risk*100) if total_risk!=0 else 0.0
report.append(f'ROI:        {roi:.2f}%')
report.append('=========================================')

print('\nWriting ROI report to', ROI)
ROI.write_text('\n'.join(report))
print('Done')
