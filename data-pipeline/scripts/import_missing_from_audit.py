"""
Import missing picks from the audit file into the historical graded data.
The audit file is the source of truth - if picks exist there but not in our data, add them.
"""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
HISTORICAL_PATH = ROOT_DIR / 'data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv'
AUDIT_PATH = Path(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')

def normalize(s):
    if pd.isna(s): return ""
    return str(s).lower().strip().replace(" ", "")

def clean_money(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    val = str(val).replace('$', '').replace(',', '').replace(' ', '').replace('(', '-').replace(')', '')
    try:
        return float(val)
    except:
        return 0.0

def main():
    print("=== Importing Missing Picks from Audit ===")
    
    # Load files
    hist_df = pd.read_csv(HISTORICAL_PATH)
    hist_df['Date'] = pd.to_datetime(hist_df['Date'])
    
    audit_df = pd.read_excel(AUDIT_PATH)
    audit_df['Date'] = pd.to_datetime(audit_df['Date'])
    audit_df['PnL'] = audit_df['PnL'].apply(clean_money)
    
    # Filter to itemized picks only
    audit_items = audit_df[audit_df['Matchup'] != 'ALL'].copy()
    
    print(f"Historical: {len(hist_df)} picks")
    print(f"Audit (itemized): {len(audit_items)} picks")
    
    # Get unique dates in audit
    audit_dates = audit_items['Date'].unique()
    
    new_rows = []
    
    for date in audit_dates:
        audit_day = audit_items[audit_items['Date'] == date]
        hist_day = hist_df[hist_df['Date'] == date]
        
        # Normalize picks for comparison
        hist_picks_normalized = set(normalize(p) for p in hist_day['Pick'])
        
        for _, audit_row in audit_day.iterrows():
            audit_pick = str(audit_row['Pick (Odds)'])
            audit_pick_norm = normalize(audit_pick)
            
            if audit_pick_norm not in hist_picks_normalized:
                # Missing pick - add it
                pnl = audit_row['PnL']
                hit_miss = 'Win' if pnl > 0 else ('Loss' if pnl < 0 else 'Push')
                risk = abs(pnl) if pnl < 0 else 50000  # If loss, risk = loss amount; else default
                
                new_row = {
                    'Date': date.strftime('%Y-%m-%d'),
                    'League': audit_row.get('League', ''),
                    'Matchup': audit_row.get('Matchup', ''),
                    'Segment': audit_row.get('Segment', 'fg'),
                    'Pick': audit_pick,
                    'Odds': '',  # Will parse from pick string if needed
                    'Risk': risk,
                    'ToWin': audit_row.get('To Win', 50000),
                    'Hit/Miss': hit_miss,
                    'PnL': pnl,
                    'StakeRule': ''
                }
                new_rows.append(new_row)
                print(f"  Adding: {date.strftime('%Y-%m-%d')} | {audit_pick[:40]}... | PnL: ${pnl:,.0f}")
    
    print(f"\nTotal picks to add: {len(new_rows)}")
    
    if new_rows:
        # Add new rows to historical
        new_df = pd.DataFrame(new_rows)
        hist_df['Date'] = hist_df['Date'].dt.strftime('%Y-%m-%d')
        combined = pd.concat([hist_df, new_df], ignore_index=True)
        
        # Sort by date
        combined = combined.sort_values('Date')
        
        # Save
        combined.to_csv(HISTORICAL_PATH, index=False)
        print(f"\nSaved updated historical file: {HISTORICAL_PATH}")
        print(f"New total: {len(combined)} picks")
        
        # Calculate new PnL
        total_pnl = combined['PnL'].sum()
        print(f"New Historical PnL: ${total_pnl:,.2f}")

if __name__ == "__main__":
    main()
