import pandas as pd
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT_DIR / "output" / "reconciled"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def main():
    print("Combining final tracker...")
    
    # Load base graded
    base_file = OUTPUT_DIR / "all_graded_combined.csv"
    if not base_file.exists():
        print(f"Error: {base_file} not found. Run reconcile_all_picks.py first.")
        return
        
    base_df = pd.read_csv(base_file)
    print(f"Loaded base graded: {len(base_df)} picks")
    
    # Load newly graded missing picks
    missing_file = OUTPUT_DIR / "missing_picks_graded.csv"
    if not missing_file.exists():
        print(f"Error: {missing_file} not found. Run grade_missing_picks.py first.")
        return
        
    missing_df = pd.read_csv(missing_file)
    print(f"Loaded newly graded: {len(missing_df)} picks")
    
    # Only keep missing picks for dates NOT already in base
    # Normalize both date columns to string format for comparison
    base_df['Date'] = pd.to_datetime(base_df['Date']).dt.strftime('%Y-%m-%d')
    missing_df['Date'] = pd.to_datetime(missing_df['Date']).dt.strftime('%Y-%m-%d')
    base_dates = set(base_df['Date'])
    
    # Include picks for dates not in base (will be combined)
    missing_filtered = missing_df[~missing_df['Date'].isin(base_dates)]
    print(f"After filtering overlapping dates: {len(missing_filtered)} picks from missing")
    
    # Combine
    # Ensure columns match. mismatching columns will be NaN
    final_df = pd.concat([base_df, missing_filtered], ignore_index=True)

    # Normalize Date format for dedup
    final_df['_date_norm'] = pd.to_datetime(final_df['Date']).dt.strftime('%Y-%m-%d')
    final_df['_pick_norm'] = final_df['Pick'].astype(str).str.lower().str.strip()
    final_df['_matchup_norm'] = final_df['Matchup'].astype(str).str.lower().str.strip()
    
    # Deduplicate based on normalized Date + Pick + Matchup (same pick on different games is valid!)
    before_dedup = len(final_df)
    final_df = final_df.drop_duplicates(subset=['_date_norm', '_pick_norm', '_matchup_norm'], keep='first')
    final_df = final_df.drop(columns=['_date_norm', '_pick_norm', '_matchup_norm'])
    if before_dedup != len(final_df):
        print(f"Removed {before_dedup - len(final_df)} duplicate picks")
    if 'Date' in final_df.columns:
        final_df = final_df.sort_values('Date', ascending=False)
    
    # Save CSV
    csv_path = OUTPUT_DIR / "final_tracker_complete.csv"
    final_df.to_csv(csv_path, index=False)
    print(f"Saved CSV: {csv_path}")
    
    # Save Excel
    xlsx_path = OUTPUT_DIR / "final_tracker_complete.xlsx"
    final_df.to_excel(xlsx_path, index=False)
    print(f"Saved Excel: {xlsx_path}")
    
    # Final Stats
    print("\nFINAL TRACKER STATS")
    print("="*30)
    
    # Fill NaN Hit/Miss for stats calculation
    if 'Hit/Miss' in final_df.columns:
        wins = len(final_df[final_df['Hit/Miss'].astype(str).str.lower() == 'win'])
        losses = len(final_df[final_df['Hit/Miss'].astype(str).str.lower() == 'loss'])
        pushes = len(final_df[final_df['Hit/Miss'].astype(str).str.lower() == 'push'])
        
        print(f"Record: {wins}W - {losses}L - {pushes}P")
        
    if 'PnL' in final_df.columns:
        total_pnl = final_df['PnL'].sum()
        print(f"Total PnL: ${total_pnl:,.2f}")
    
    if 'Risk' in final_df.columns:
        total_risk = final_df['Risk'].sum()
        print(f"Total Risk: ${total_risk:,.2f}")
        
        if total_risk > 0:
            roi = (total_pnl / total_risk) * 100
            print(f"ROI: {roi:.2f}%")

if __name__ == "__main__":
    main()
