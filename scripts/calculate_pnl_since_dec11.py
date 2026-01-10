import pandas as pd
import sys

# File path
file_path = r'C:\Users\JB\green-bier-ventures\Dashboard_main_local\output\analysis\telegram_analysis_2025-12-28.xlsx'

try:
    df = pd.read_excel(file_path)
    
    # Ensure Date column is datetime
    df['Date'] = pd.to_datetime(df['Date'])
    
    # Filter for dates since 12/11/2025 (inclusive)
    start_date = pd.Timestamp('2025-12-11')
    filtered_df = df[df['Date'] >= start_date]
    
    total_pnl = filtered_df['PnL'].sum()
    
    print(f"PnL since 12/11/2025: {total_pnl}")
    print(f"Number of picks counted: {len(filtered_df)}")
    
    # Show breakdown by day
    print("\nDaily Breakdown:")
    daily_pnl = filtered_df.groupby(df['Date'].dt.date)['PnL'].sum()
    print(daily_pnl)

except Exception as e:
    print(f"Error calculating PnL: {e}")
