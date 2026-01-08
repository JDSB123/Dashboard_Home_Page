#!/usr/bin/env python3
"""Generate final comprehensive ROI report."""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent

# Load unified master (already reconciled + scaled to base $50,000 units)
master = pd.read_csv(ROOT / 'output/reconciled/master_all_picks.csv')
hit = master['Hit/Miss'].astype(str).str.lower()
graded = master[hit.isin(['win', 'loss', 'push'])].copy()

REPORT_PATH = ROOT / "output" / "reconciled" / "final_report.txt"
lines = []
lines.append('=' * 70)
lines.append('COMPLETE SEASON DATA RECONCILIATION REPORT')
lines.append('=' * 70)
lines.append('')

def summarize(label: str, df: pd.DataFrame):
    hm = df['Hit/Miss'].astype(str).str.lower()
    wins = int((hm == 'win').sum())
    losses = int((hm == 'loss').sum())
    pushes = int((hm == 'push').sum())
    pnl = float(df['PnL'].sum())
    risk = float(df['Risk'].sum())
    lines.append(f'{label}:')
    lines.append(f'  Picks: {len(df)}')
    lines.append(f'  Record: {wins}W - {losses}L - {pushes}P')
    lines.append(f'  Total Risk: ${risk:,.2f}')
    lines.append(f'  Total PnL: ${pnl:,.2f}')
    lines.append(f'  ROI: {(pnl/risk)*100:.2f}%')
    lines.append('')

# Source breakdown (historical tracker + recent vs telegram gap picks)
if 'Source' in graded.columns:
    for src, g in graded.groupby('Source'):
        summarize(src.upper(), g)

# Combined totals
total_picks = len(graded)
total_wins = int((graded['Hit/Miss'].astype(str).str.lower() == 'win').sum())
total_losses = int((graded['Hit/Miss'].astype(str).str.lower() == 'loss').sum())
total_pushes = int((graded['Hit/Miss'].astype(str).str.lower() == 'push').sum())
total_pnl = float(graded['PnL'].sum())
total_risk = float(graded['Risk'].sum())

lines.append('=' * 70)
lines.append('COMBINED SEASON TOTALS (Nov 29, 2025 - Jan 6, 2026)')
lines.append('=' * 70)
lines.append(f'Total Graded Picks: {total_picks}')
lines.append(f'Record: {total_wins}W - {total_losses}L - {total_pushes}P')
lines.append(f'Win Rate: {total_wins/(total_wins+total_losses)*100:.1f}%')
lines.append(f'Total Risk: ${total_risk:,.2f}')
lines.append(f'Total PnL: ${total_pnl:,.2f}')
lines.append(f'ROI: {(total_pnl/total_risk)*100:.2f}%')
lines.append('')

# Ungraded summary
ungraded = master[~hit.isin(['win', 'loss', 'push'])]
lines.append(f'Unverifiable picks: {len(ungraded)}')
lines.append('  (Games not in ESPN database, missing context, or unmatched)')
if len(ungraded) > 0:
    for _, row in ungraded.iterrows():
        raw_text = row.get('RawText')
        pick_text = row.get('Pick')
        if pd.isna(raw_text) or raw_text is None or str(raw_text).strip() == '':
            raw_text = pick_text
        if pd.isna(raw_text) or raw_text is None:
            raw_text = ''
        raw = str(raw_text)[:50]
        lines.append(f"    {row.get('Date')} | {raw}")

report = "\n".join(lines) + "\n"
print(report, end="")
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.write_text(report, encoding="utf-8")
