import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
hist_df = pd.read_csv(ROOT_DIR / 'data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv')
audit_df = pd.read_excel(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')

# Convert dates
hist_df['Date'] = pd.to_datetime(hist_df['Date'])
audit_df['Date'] = pd.to_datetime(audit_df['Date'])

# Filter to Dec 14 where discrepancy is large
audit_dec = audit_df[(audit_df['Date'] == '2025-12-14') & (audit_df['Matchup'] != 'ALL')]
hist_dec = hist_df[hist_df['Date'] == '2025-12-14']

print('=== AUDIT Dec 14 ===')
print(f'Rows: {len(audit_dec)}')
audit_total = 0
for _, r in audit_dec.iterrows():
    pick = str(r['Pick (Odds)'])[:50]
    pnl = r['PnL']
    audit_total += pnl if not pd.isna(pnl) else 0
    print(f"  {pick} | PnL: {pnl}")
print(f"AUDIT TOTAL: ${audit_total:,.0f}")

print()
print('=== HISTORICAL Dec 14 ===')
print(f'Rows: {len(hist_dec)}')
hist_total = 0
for _, r in hist_dec.iterrows():
    pick = str(r['Pick'])[:50]
    pnl = r['PnL']
    hist_total += pnl if not pd.isna(pnl) else 0
    print(f"  {pick} | PnL: {pnl}")
print(f"HIST TOTAL: ${hist_total:,.0f}")

# Try normalization comparison
def normalize(s):
    if pd.isna(s): return ""
    return str(s).lower().strip().replace(" ", "")

print()
print('=== NORMALIZED COMPARISON ===')
audit_picks = set(normalize(p) for p in audit_dec['Pick (Odds)'])
hist_picks = set(normalize(p) for p in hist_dec['Pick'])

print(f"Audit picks (normalized): {len(audit_picks)}")
print(f"Hist picks (normalized): {len(hist_picks)}")

overlap = audit_picks & hist_picks
print(f"Overlapping: {len(overlap)}")

# Show non-matching
audit_only = audit_picks - hist_picks
hist_only = hist_picks - audit_picks

if audit_only:
    print(f"\nIn Audit but not in Hist ({len(audit_only)}):")
    for p in list(audit_only)[:10]:
        print(f"  '{p}'")
        
if hist_only:
    print(f"\nIn Hist but not in Audit ({len(hist_only)}):")
    for p in list(hist_only)[:10]:
        print(f"  '{p}'")
