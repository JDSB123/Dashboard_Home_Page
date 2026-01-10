import pandas as pd
import glob
import os

files = [
    r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\telegram_parsed\telegram_all_picks.csv',
    r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\telegram_parsed\telegram_picks_v2.csv',
    r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\analysis\telegram_analysis_2025-12-28.xlsx'
]

for f in files:
    if os.path.exists(f):
        print(f"\nChecking {os.path.basename(f)}:")
        try:
            if f.endswith('.xlsx'):
                df = pd.read_excel(f)
            else:
                df = pd.read_csv(f)
            
            if 'Date' in df.columns:
                df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
                min_date = df['Date'].min()
                max_date = df['Date'].max()
                print(f"  Range: {min_date} to {max_date}")
                print(f"  Count >= 2025-12-11: {len(df[df['Date'] >= '2025-12-11'])}")
            else:
                print("  No 'Date' column found")
        except Exception as e:
            print(f"  Error: {e}")
