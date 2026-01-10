import pandas as pd
from pathlib import Path
import sys

# Paths
generated_file = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\output\reconciled\final_tracker_complete.csv')
audit_file = Path(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')

def clean_money(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    # Remove $ and ,
    val = str(val).replace('$', '').replace(',', '').replace(' ', '')
    try:
        return float(val)
    except:
        return 0.0

def main():
    print("Loading files...")
    if not generated_file.exists():
        print(f"Generated file not found: {generated_file}")
        return
        
    my_df = pd.read_csv(generated_file)
    my_df['Date'] = pd.to_datetime(my_df['Date'])
    my_df['PnL'] = my_df['PnL'].apply(clean_money)
    
    print(f"Generated Loaded: {len(my_df)} rows. Dates: {my_df['Date'].min()} to {my_df['Date'].max()}")
    
    if not audit_file.exists():
        print(f"Audit file not found: {audit_file}")
        return
        
    audit_df = pd.read_excel(audit_file)
    audit_df['Date'] = pd.to_datetime(audit_df['Date'])
    
    # Filter Audit DF - Remove Summary Rows if they exist
    # Looking at the sample, rows with 'ALL' in Matchup seem to be summaries?
    # Let's inspect rows with Matchup == 'ALL'
    summary_rows = audit_df[audit_df['Matchup'] == 'ALL']
    print(f"Found {len(summary_rows)} summary rows/days in audit file.")
    
    # We want to compare the 'Itemized' rows in audit file vs our itemized rows.
    # OR, if the audit file relies on those summary rows for the 'correct' total, we should check that.
    # Let's assume valid bets don't have Matchup == 'ALL'
    
    valid_audit = audit_df[audit_df['Matchup'] != 'ALL'].copy()
    valid_audit['PnL'] = valid_audit['PnL'].apply(clean_money)
    
    print(f"Audit Itemized Loaded: {len(valid_audit)} rows. Dates: {valid_audit['Date'].min()} to {valid_audit['Date'].max()}")

    # Determine overlap range
    start_date = max(my_df['Date'].min(), valid_audit['Date'].min())
    end_date = min(my_df['Date'].max(), valid_audit['Date'].max())
    
    print(f"\nComparing Overlap Period: {start_date.date()} to {end_date.date()}")
    
    my_subset = my_df[(my_df['Date'] >= start_date) & (my_df['Date'] <= end_date)]
    audit_subset = valid_audit[(valid_audit['Date'] >= start_date) & (valid_audit['Date'] <= end_date)]
    
    print("-" * 40)
    print(f"{'Metric':<20} | {'My Tracker':<15} | {'Audit File':<15} | {'Diff':<15}")
    print("-" * 40)
    
    my_total = my_subset['PnL'].sum()
    audit_total = audit_subset['PnL'].sum()
    
    print(f"{'Total PnL':<20} | ${my_total:,.0f} | ${audit_total:,.0f} | ${my_total - audit_total:,.0f}")
    
    my_count = len(my_subset)
    audit_count = len(audit_subset)
    
    print(f"{'Total Picks':<20} | {my_count} | {audit_count} | {my_count - audit_count}")
    
    # Group by Date
    print("\n--- Daily Breakdown (Differences > $50k) ---")
    my_daily = my_subset.groupby('Date')['PnL'].sum()
    audit_daily = audit_subset.groupby('Date')['PnL'].sum()
    
    all_dates = sorted(list(set(my_daily.index) | set(audit_daily.index)))
    
    for d in all_dates:
        m = my_daily.get(d, 0)
        a = audit_daily.get(d, 0)
        diff = m - a
        if abs(diff) > 500: # Show larger diffs
            print(f"{d.date()}: My=${m:,.0f}, Audit=${a:,.0f}, Diff=${diff:,.0f}")

    # Inspect the 'ALL' rows in audit just in case
    print("\n--- Audit Summary Rows (Reference) ---")
    summary_subset = summary_rows[(summary_rows['Date'] >= start_date) & (summary_rows['Date'] <= end_date)]
    print(summary_subset.groupby('Date')['PnL'].sum())

if __name__ == "__main__":
    main()
