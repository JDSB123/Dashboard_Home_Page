"""Quick verification script for NCAAM team data."""
import json

# Load data
with open('assets/data/team-variants/ncaam_team_variants.json') as f:
    data = json.load(f)

print(f'Total NCAAM teams: {len(data)}')
print('\nSample teams:')
for k, v in list(data.items())[:10]:
    print(f'  {k}: {v["name"]} ({v["nickname"]})')

print('\nMajor programs:')
major = ['DUKE', 'UNC', 'UK', 'KU', 'UVA', 'GONZ', 'ARIZ', 'UCLA', 'MICH', 'MSU']
for k in major:
    if k in data:
        conf = data[k].get('conference', 'N/A')
        print(f'  {k}: {data[k]["name"]} - {conf}')
    else:
        print(f'  {k}: NOT FOUND')

print('\nTeams with multiple abbreviations:')
multi_abbrev = {k: v for k, v in data.items() if len(v['abbreviations']) > 1}
print(f'  Found {len(multi_abbrev)} teams with alternate abbreviations')
for k, v in list(multi_abbrev.items())[:5]:
    print(f'  {k}: {v["abbreviations"]} - {v["name"]}')
