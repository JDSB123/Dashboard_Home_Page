"""
Import the audit file as the authoritative source for historical picks.
The audit file is the source of truth for Dec 8-27 period.
"""
import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AUDIT_PATH = Path(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')
OUTPUT_PATH = ROOT_DIR / 'data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv'

def main():
    print("Importing audit file as historical data...")
    
    if not AUDIT_PATH.exists():
        print(f"Error: Audit file not found at {AUDIT_PATH}")
        return
        
    # Load audit file
    audit_df = pd.read_excel(AUDIT_PATH)
    
    # Filter out summary rows
    audit_items = audit_df[audit_df['Matchup'] != 'ALL'].copy()
    print(f"Loaded {len(audit_items)} itemized picks from audit")
    
    # Rename columns to match our format
    audit_items = audit_items.rename(columns={
        'Pick (Odds)': 'Pick',
        'To Win': 'ToWin',
        'Hit/Miss': 'Hit/Miss'
    })
    
    # Normalize Hit/Miss values (audit has typos like 'MIss', 'Hiit', 'Hitt')
    def normalize_result(val):
        if pd.isna(val):
            return ''
        val = str(val).lower().strip()
        if val in ['hit', 'hiit', 'hitt']:
            return 'Win'
        elif val in ['miss', 'miss', 'miiss']:
            return 'Loss'
        elif val == 'push':
            return 'Push'
        return val
    
    audit_items['Hit/Miss'] = audit_items['Hit/Miss'].apply(normalize_result)
    
    # Ensure proper date format
    audit_items['Date'] = pd.to_datetime(audit_items['Date']).dt.strftime('%Y-%m-%d')
    
    # Standardize columns
    required_cols = ['Date', 'League', 'Matchup', 'Segment', 'Pick', 'Odds', 'Risk', 'ToWin', 'Hit/Miss', 'PnL', 'StakeRule']
    for col in required_cols:
        if col not in audit_items.columns:
            audit_items[col] = ''
    
    # Ensure numeric columns are numeric
    for col in ['Risk', 'ToWin', 'PnL']:
        audit_items[col] = pd.to_numeric(audit_items[col], errors='coerce').fillna(0)
    
    # Ensure we have the columns in the right order
    audit_items = audit_items[required_cols]
    
    # Save
    audit_items.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {len(audit_items)} picks to {OUTPUT_PATH}")
    
    # Stats
    print(f"\nDate range: {audit_items['Date'].min()} to {audit_items['Date'].max()}")
    wins = len(audit_items[audit_items['Hit/Miss'].astype(str).str.lower() == 'win'])
    losses = len(audit_items[audit_items['Hit/Miss'].astype(str).str.lower() == 'loss'])
    total_pnl = audit_items['PnL'].sum()
    print(f"Record: {wins}W - {losses}L")
    print(f"Total PnL: ${total_pnl:,.2f}")

if __name__ == "__main__":
    main()
