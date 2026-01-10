import pandas as pd

# Load the graded picks
df = pd.read_csv('output/graded/picks_dec28_jan6_fully_graded.csv')

print(f"Total graded picks: {len(df)}")
print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
print(f"\nColumns: {df.columns.tolist()}")
print(f"\nFirst few rows:")
print(df.head(3).to_string())

# Check for league/pnl columns
if 'League' in df.columns and 'PnL' in df.columns:
    print("\n" + "="*90)
    print("ROE & PNL BY LEAGUE")
    print("="*90)
    
    summary = df.groupby('League').agg({
        'Risk': 'sum',
        'Pick (Odds)': 'count',
        'PnL': 'sum',
        'Hit/Miss': lambda x: (x == 'win').sum()
    }).round(2)
    summary.columns = ['Total Risk', 'Pick Count', 'Total PnL', 'Wins']
    summary['Win %'] = (summary['Wins'] / summary['Pick Count'] * 100).round(1)
    summary['ROE %'] = (summary['Total PnL'] / summary['Total Risk'] * 100).round(1)
    
    print(summary[['Pick Count', 'Wins', 'Win %', 'Total Risk', 'Total PnL', 'ROE %']].to_string())
    
    print("\n" + "="*90)
    total_risk = df['Risk'].sum()
    total_pnl = df['PnL'].sum()
    total_wins = (df['Hit/Miss'] == 'win').sum()
    total_picks = len(df)
    
    print(f"TOTAL: {total_picks} picks | {total_wins} wins ({total_wins/total_picks*100:.1f}%) | Risk: ${total_risk:,.2f} | PnL: ${total_pnl:,.2f} | ROE: {total_pnl/total_risk*100:.1f}%")
    print("="*90)

