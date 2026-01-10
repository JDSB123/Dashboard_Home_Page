import pandas as pd
import os

CSV_PATH = 'data-pipeline/consolidated_historical_data.csv'
BACKUP_PATH = 'data-pipeline/consolidated_historical_data.backup.csv'

if not os.path.exists(CSV_PATH):
    print('MISSING')
    raise SystemExit(1)

print('Loading CSV...')
df = pd.read_csv(CSV_PATH, low_memory=False)
print('Rows:', len(df))

if 'game_id' not in df.columns:
    print('No game_id column; cannot dedupe by id. Exiting.')
    raise SystemExit(1)

# Count duplicates
dup_mask = df.duplicated(subset=['game_id'], keep=False)
dup_count = dup_mask.sum()
unique_ids = df['game_id'].nunique()
print('Unique game_id:', unique_ids)
print('Duplicate rows:', dup_count)

# Check conflicting scores per game_id
conflicts = []
for gid, group in df.groupby('game_id'):
    hs = group['home_score'].dropna().unique().tolist()
    as_ = group['away_score'].dropna().unique().tolist()
    if len(hs) > 1 or len(as_) > 1:
        conflicts.append((gid, hs, as_))

print('Conflicting game_ids with multiple score values:', len(conflicts))
if conflicts:
    print('Sample conflicts (up to 5):')
    for c in conflicts[:5]:
        print(c)

# If duplicates or conflicts, dedupe by keeping the last occurrence by game_date+game_datetime_cst
if dup_count > 0 or conflicts:
    print('Creating backup...')
    df.to_csv(BACKUP_PATH, index=False)

    # prefer rows with non-null 1H/2H and latest datetime
    df['sort_dt'] = pd.to_datetime(df['game_datetime_cst'], errors='coerce')
    df = df.sort_values(['game_id', 'sort_dt'])
    deduped = df.groupby('game_id').last().reset_index()
    # drop helper
    deduped = deduped.drop(columns=[c for c in ['sort_dt'] if c in deduped.columns])
    print('After dedupe rows:', len(deduped))
    deduped.to_csv(CSV_PATH, index=False)
    print('Dedupe complete, CSV overwritten. Backup saved to', BACKUP_PATH)
else:
    print('No duplicates or conflicts found. CSV is clean.')
