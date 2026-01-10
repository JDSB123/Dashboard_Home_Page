import pandas as pd
import os

# Check master files for missing values, duplicates, data type issues
files = {
    'pnl_tracker_2025-12-28.csv': 'output/reconciled/pnl_tracker_2025-12-28.csv',
    'telegram_graded_since_inception.csv': 'output/reconciled/telegram_graded_since_inception.csv',
    'final_tracker_complete.csv': 'output/reconciled/final_tracker_complete.csv',
    'all_graded_combined.csv': 'output/reconciled/all_graded_combined.csv',
}

for label, path in files.items():
    if not os.path.exists(path):
        print(f"❌ {label}: FILE NOT FOUND\n")
        continue
    
    try:
        df = pd.read_csv(path)
        print(f"\n📊 {label}")
        print(f"   Shape: {df.shape[0]} rows × {df.shape[1]} columns")
        print(f"   Columns: {list(df.columns)}")
        print(f"   Missing values: {df.isnull().sum().sum()}")
        print(f"   Duplicates: {df.duplicated().sum()}")
        
        # Check for common issues
        if 'Result' in df.columns or 'Hit/Miss' in df.columns:
            col = 'Result' if 'Result' in df.columns else 'Hit/Miss'
            print(f"   {col} values: {df[col].value_counts().to_dict()}")
        if 'PnL' in df.columns:
            print(f"   PnL stats: min={df['PnL'].min():.2f}, max={df['PnL'].max():.2f}, sum={df['PnL'].sum():.2f}")
        if 'League' in df.columns:
            print(f"   Leagues: {df['League'].value_counts().to_dict()}")
    except Exception as e:
        print(f"❌ {label}: ERROR - {e}\n")
