import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

df = pd.read_csv(ROOT / 'output/reconciled/final_tracker_complete.csv')
df['Date'] = pd.to_datetime(df['Date'])

pre = df[df['Date'] < '2025-12-08']
mid = df[(df['Date'] >= '2025-12-08') & (df['Date'] <= '2025-12-27')]
post = df[df['Date'] > '2025-12-27']

print(f'Pre (Nov 29 - Dec 07): {len(pre)} picks, PnL: ${pre["PnL"].sum():,.0f}')
print(f'Mid (Dec 08 - Dec 27): {len(mid)} picks, PnL: ${mid["PnL"].sum():,.0f}')
print(f'Post (Dec 28+): {len(post)} picks, PnL: ${post["PnL"].sum():,.0f}')
print(f'Total: {len(df)} picks, PnL: ${df["PnL"].sum():,.0f}')
