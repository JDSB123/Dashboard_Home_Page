import pandas as pd
from pathlib import Path

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TARGET_FILES = [
    ROOT_DIR / 'data-pipeline/pick-analysis-tracker/output/graded_all_historical.csv',
    ROOT_DIR / 'output/reconciled/missing_picks_graded.csv'
]
AUDIT_PATH = Path(r'c:\Users\JB\Green Bier Capital\Early Stage Sport Ventures - Documents\Daily Picks\20251222_bombay711_tracker_consolidated.xlsx')

def clean_money(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    val = str(val).replace('$', '').replace(',', '').replace(' ', '').replace('(', '-').replace(')', '')
    try:
        return float(val)
    except:
        return 0.0

def normalize_string(s):
    if pd.isna(s): return ""
    return str(s).lower().strip().replace(" ", "")

def main():
    print("--- Applying Audit Corrections ---")
    
    if not AUDIT_PATH.exists():
        print(f"Error: Audit file not found at {AUDIT_PATH}")
        return

    print(f"Loading Audit: {AUDIT_PATH}")
    audit_df = pd.read_excel(AUDIT_PATH)
    audit_df['Date'] = pd.to_datetime(audit_df['Date'])
    audit_df['PnL'] = audit_df['PnL'].apply(clean_money)
    
    # Filter Audit to relevant rows (remove summaries)
    audit_items = audit_df[audit_df['Matchup'] != 'ALL'].copy()
    
    print(f"Loaded {len(audit_items)} audit items.")
    
    total_updates_all = 0
    total_pnl_impact_all = 0.0

    for file_path in TARGET_FILES:
        if not file_path.exists():
            print(f"Skipping {file_path.name} (not found)")
            continue
            
        print(f"\nProcessing {file_path.name}...")
        try:
            hist_df = pd.read_csv(file_path)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            continue

        # Ensure Date is datetime for comparison
        hist_df['Date'] = pd.to_datetime(hist_df['Date'])
        
        updates_count = 0
        pnl_impact = 0.0
        
        # Iterate through Audit items and find matches
        for idx, audit_row in audit_items.iterrows():
            date = audit_row['Date']
            pick_col = 'Pick (Odds)' if 'Pick (Odds)' in audit_items.columns else 'Pick'
            audit_pick = str(audit_row[pick_col])
            audit_pnl = audit_row['PnL']
            
            # Filter by date
            date_matches = hist_df[hist_df['Date'] == date]
            
            if len(date_matches) == 0:
                continue
                
            # Find matches by Pick string
            normalized_audit_pick = normalize_string(audit_pick)
            best_match_idx = -1
            
            # Try direct match
            for h_idx in date_matches.index:
                h_pick = normalize_string(hist_df.at[h_idx, 'Pick'])
                if h_pick == normalized_audit_pick:
                    best_match_idx = h_idx
                    break
                    
            # Try containment
            if best_match_idx == -1:
                for h_idx in date_matches.index:
                    h_pick = normalize_string(hist_df.at[h_idx, 'Pick'])
                    if normalized_audit_pick in h_pick or h_pick in normalized_audit_pick:
                        best_match_idx = h_idx
                        break
            
            if best_match_idx != -1:
                current_pnl = hist_df.at[best_match_idx, 'PnL']
                if pd.isna(current_pnl): current_pnl = 0.0
                
                diff = abs(current_pnl - audit_pnl)
                if diff > 1.0:
                    old_pnl = current_pnl
                    hist_df.at[best_match_idx, 'PnL'] = audit_pnl
                    
                    if audit_pnl > 0:
                        hist_df.at[best_match_idx, 'Hit/Miss'] = 'Win'
                    elif audit_pnl < 0:
                        hist_df.at[best_match_idx, 'Hit/Miss'] = 'Loss'
                    else:
                        hist_df.at[best_match_idx, 'Hit/Miss'] = 'Push'
                    
                    updates_count += 1
                    pnl_impact += (audit_pnl - old_pnl)
        
        print(f"  Updates: {updates_count}")
        print(f"  PnL Impact: ${pnl_impact:,.2f}")
        
        hist_df['Date'] = hist_df['Date'].dt.strftime('%Y-%m-%d')
        hist_df.to_csv(file_path, index=False)
        
        total_updates_all += updates_count
        total_pnl_impact_all += pnl_impact

    print(f"\nGRAND TOTAL - Updates: {total_updates_all}, PnL Impact: ${total_pnl_impact_all:,.2f}")

if __name__ == "__main__":
    main()
