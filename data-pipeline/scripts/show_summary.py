"""Display summary of all team variant files."""
import json
import os

files = {
    'NFL': 'nfl_team_variants.json',
    'NBA': 'nba_team_variants.json',
    'NCAAM': 'ncaam_team_variants.json'
}

print("=" * 60)
print("TEAM VARIANTS DATA - COMPLETE SUMMARY")
print("=" * 60)

total_teams = 0
total_size = 0

for league, filename in files.items():
    filepath = f'assets/data/team-variants/{filename}'
    with open(filepath) as f:
        data = json.load(f)
    
    size_kb = os.path.getsize(filepath) / 1024
    count = len(data)
    total_teams += count
    total_size += size_kb
    
    print(f"\n{league}:")
    print(f"  File: {filename}")
    print(f"  Teams: {count}")
    print(f"  Size: {size_kb:.1f} KB")

print(f"\n{'=' * 60}")
print(f"TOTAL: {total_teams} teams across 3 leagues")
print(f"TOTAL SIZE: {total_size:.1f} KB")
print("=" * 60)
print("\n✅ All data successfully extracted and cached!")
print("\nQuick access:")
print("  - Extraction script: scripts/extract_team_variants.py")
print("  - Lookup utility: scripts/team_variant_lookup.py")
print("  - Documentation: assets/data/team-variants/README.md")
print("  - NCAAM summary: NCAAM_EXTRACTION_SUMMARY.md")
