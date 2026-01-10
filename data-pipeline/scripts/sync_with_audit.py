"""
Sync historical data with the audit file.
For dates covered by the audit, ONLY keep picks that are in the audit.
This ensures our tracker matches the source of truth.
"""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
HISTORICAL_PATH = ROOT_DIR / 'data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv'
AUDIT_PATH = Path(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')

def normalize(s):
    if pd.isna(s): return ""
    return str(s).lower().strip().replace(" ", "")

def main():
    print("=== Syncing Historical Data with Audit ===")
    
    # Load files
    hist_df = pd.read_csv(HISTORICAL_PATH)
    hist_df['Date'] = pd.to_datetime(hist_df['Date'])
    original_count = len(hist_df)
    original_pnl = hist_df['PnL'].sum()
    
    audit_df = pd.read_excel(AUDIT_PATH)
    audit_df['Date'] = pd.to_datetime(audit_df['Date'])
    
    # Filter to itemized picks only (not summary rows)
    audit_items = audit_df[audit_df['Matchup'] != 'ALL'].copy()
    
    print(f"Historical: {len(hist_df)} picks, PnL: ${original_pnl:,.0f}")
    print(f"Audit (itemized): {len(audit_items)} picks")
    
    # Get audit date range
    audit_min = audit_items['Date'].min()
    audit_max = audit_items['Date'].max()
    print(f"Audit date range: {audit_min.date()} to {audit_max.date()}")
    
    # Split historical into:
    # 1. Picks within audit date range (to be filtered)
    # 2. Picks outside audit date range (to keep as-is)
    
    in_audit_range = hist_df[(hist_df['Date'] >= audit_min) & (hist_df['Date'] <= audit_max)]
    outside_audit_range = hist_df[(hist_df['Date'] < audit_min) | (hist_df['Date'] > audit_max)]
    
    print(f"\nPicks in audit date range: {len(in_audit_range)}")
    print(f"Picks outside audit range: {len(outside_audit_range)}")
    
    # For picks in audit range, only keep those that match an audit pick
    kept_picks = []
    
    for date in in_audit_range['Date'].unique():
        audit_day = audit_items[audit_items['Date'] == date]
        hist_day = in_audit_range[in_audit_range['Date'] == date]
        
        if len(audit_day) == 0:
            # No itemized audit data for this date - skip these picks
            print(f"  {date.date()}: No audit data - dropping {len(hist_day)} picks")
            continue
        
        # Match picks - require exact normalized match only
        audit_picks_norm = set(normalize(str(p)) for p in audit_day['Pick (Odds)'])
        
        for _, hist_row in hist_day.iterrows():
            hist_pick_norm = normalize(str(hist_row['Pick']))
            
            if hist_pick_norm in audit_picks_norm:
                # Exact match only
                kept_picks.append(hist_row)
    
    # Create new dataframe with filtered picks
    if kept_picks:
        filtered_in_range = pd.DataFrame(kept_picks)
    else:
        filtered_in_range = pd.DataFrame(columns=hist_df.columns)
    
    print(f"\nKept {len(filtered_in_range)} picks from audit range (was {len(in_audit_range)})")
    print(f"Dropped {len(in_audit_range) - len(filtered_in_range)} picks not in audit")
    
    # Combine filtered in-range with outside-range
    final_df = pd.concat([filtered_in_range, outside_audit_range], ignore_index=True)
    
    # Sort by date
    final_df = final_df.sort_values('Date')
    
    # Convert date back to string
    final_df['Date'] = final_df['Date'].dt.strftime('%Y-%m-%d')
    
    new_pnl = final_df['PnL'].sum()
    
    print(f"\nFinal count: {len(final_df)} picks")
    print(f"PnL change: ${original_pnl:,.0f} -> ${new_pnl:,.0f}")
    
    # Save
    final_df.to_csv(HISTORICAL_PATH, index=False)
    print(f"\nSaved to: {HISTORICAL_PATH}")

if __name__ == "__main__":
    main()
