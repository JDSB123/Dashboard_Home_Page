"""Debug remaining discrepancies for Dec 13, 22, 23"""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

# Load final tracker and audit
tracker = pd.read_csv(ROOT / 'output/reconciled/final_tracker_complete.csv')
tracker['Date'] = pd.to_datetime(tracker['Date'])

audit = pd.read_excel(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')
audit['Date'] = pd.to_datetime(audit['Date'])
audit = audit[audit['Matchup'] != 'ALL']

def normalize(s):
    if pd.isna(s): return ""
    return str(s).lower().strip().replace(" ", "")

for date_str in ['2025-12-13', '2025-12-22', '2025-12-23']:
    date = pd.Timestamp(date_str)
    
    t_day = tracker[tracker['Date'] == date]
    a_day = audit[audit['Date'] == date]
    
    print(f"\n{'='*60}")
    print(f"=== {date_str} ===")
    print(f"Tracker: {len(t_day)} picks, PnL: ${t_day['PnL'].sum():,.0f}")
    print(f"Audit: {len(a_day)} picks, PnL: ${a_day['PnL'].sum():,.0f}")
    
    # Find picks in tracker but not audit
    t_picks_norm = {normalize(str(p)): i for i, p in t_day['Pick'].items()}
    a_picks_norm = {normalize(str(p)): i for i, p in a_day['Pick (Odds)'].items()}
    
    t_only = set(t_picks_norm.keys()) - set(a_picks_norm.keys())
    a_only = set(a_picks_norm.keys()) - set(t_picks_norm.keys())
    
    if t_only:
        print(f"\nIn Tracker only ({len(t_only)}):")
        for p in list(t_only)[:5]:
            idx = t_picks_norm[p]
            pnl = tracker.loc[idx, 'PnL']
            print(f"  {tracker.loc[idx, 'Pick'][:40]} | PnL: ${pnl:,.0f}")
    
    if a_only:
        print(f"\nIn Audit only ({len(a_only)}):")
        for p in list(a_only)[:5]:
            idx = a_picks_norm[p]
            pnl = audit.loc[idx, 'PnL']
            print(f"  {audit.loc[idx, 'Pick (Odds)'][:40]} | PnL: ${pnl:,.0f}")
    
    # Check for PnL mismatches on matched picks
    common = set(t_picks_norm.keys()) & set(a_picks_norm.keys())
    print(f"\nMatched picks with PnL diff:")
    for p in common:
        t_idx = t_picks_norm[p]
        a_idx = a_picks_norm[p]
        t_pnl = tracker.loc[t_idx, 'PnL']
        a_pnl = audit.loc[a_idx, 'PnL']
        if abs(t_pnl - a_pnl) > 100:
            print(f"  {tracker.loc[t_idx, 'Pick'][:40]} | T: ${t_pnl:,.0f} vs A: ${a_pnl:,.0f}")
