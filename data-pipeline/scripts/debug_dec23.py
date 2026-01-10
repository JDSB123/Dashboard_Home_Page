import pandas as pd
from pathlib import Path
import sys

# Paths
generated_file = Path(r'c:\Users\JB\green-bier-ventures\DASHBOARD_main\output\reconciled\final_tracker_complete.csv')
audit_file = Path(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')

def clean_money(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    val = str(val).replace('$', '').replace(',', '').replace(' ', '')
    try:
        return float(val)
    except:
        return 0.0

def main():
    my_df = pd.read_csv(generated_file)
    my_df['Date'] = pd.to_datetime(my_df['Date'])
    
    audit_df = pd.read_excel(audit_file)
    audit_df['Date'] = pd.to_datetime(audit_df['Date'])
    audit_df = audit_df[audit_df['Matchup'] != 'ALL'] # Itemized only
    
    target_date = '2025-12-23'
    
    print(f"--- Analysis for {target_date} ---")
    
    my_day = my_df[my_df['Date'] == target_date].copy()
    audit_day = audit_df[audit_df['Date'] == target_date].copy()
    
    # Clean PnL
    my_day['PnL'] = my_day['PnL'].apply(clean_money)
    audit_day['PnL'] = audit_day['PnL'].apply(clean_money)
    
    print(f"My Count: {len(my_day)}")
    print(f"Audit Count: {len(audit_day)}")
    
    print(f"My PnL: ${my_day['PnL'].sum():,.0f}")
    print(f"Audit PnL: ${audit_day['PnL'].sum():,.0f}")
    
    print("\n--- My Picks (Dec 23) ---")
    print(my_day[['League', 'Matchup', 'Pick', 'Grade', 'PnL']].to_string())
    
    print("\n--- Audit Picks (Dec 23) ---")
    print(audit_day[['League', 'Matchup', 'Pick (Odds)', 'PnL']].to_string())

if __name__ == "__main__":
    main()
