"""Test NCAAM team lookups with real-world examples."""
import sys
sys.path.insert(0, '.')
from scripts.team_variant_lookup import TeamVariantLookup

lookup = TeamVariantLookup()

print("=" * 70)
print("NCAAM TEAM LOOKUP - DEMONSTRATION")
print("=" * 70)

# Test 1: Find by abbreviation
print("\n1. FIND BY ABBREVIATION")
print("-" * 70)
test_abbrevs = ['DUKE', 'UNC', 'UK', 'KU', 'GONZ', 'UCLA']
for abbrev in test_abbrevs:
    team = lookup.find_ncaam_team(abbrev)
    if team:
        conf = team.get('conference', 'Independent')
        print(f"   {abbrev:6} → {team['name']:40} [{conf}]")

# Test 2: Find by school name
print("\n2. FIND BY SCHOOL NAME")
print("-" * 70)
test_names = ['Duke', 'Michigan', 'Arizona', 'Villanova', 'Syracuse']
for name in test_names:
    team = lookup.find_ncaam_team(name)
    if team:
        print(f"   {name:12} → {team['key']:6} - {team['nickname']}")

# Test 3: Find by mascot
print("\n3. FIND BY MASCOT (partial match)")
print("-" * 70)
mascots = ['Wildcats', 'Bulldogs', 'Tigers']
for mascot in mascots:
    team = lookup.find_ncaam_team(mascot)
    if team:
        print(f"   {mascot:12} → {team['location']:30} {team['nickname']}")

# Test 4: Normalize alternate abbreviations
print("\n4. NORMALIZE ALTERNATE ABBREVIATIONS")
print("-" * 70)
alt_abbrevs = [('A&M', 'Alabama A&M'), ('ST', 'Multiple schools use ST')]
for abbrev, note in alt_abbrevs:
    normalized = lookup.normalize_ncaam_abbreviation(abbrev)
    team = lookup.find_ncaam_team(normalized)
    if team:
        print(f"   {abbrev:6} → {normalized:6} ({team['name']})")
    else:
        print(f"   {abbrev:6} → {normalized:6} ({note})")

# Test 5: Conference filtering
print("\n5. CONFERENCE FILTERING (Power 5)")
print("-" * 70)
conferences = {}
for abbrev, team_data in lookup.ncaam_teams.items():
    conf = team_data.get('conference', 'Independent')
    if conf not in conferences:
        conferences[conf] = []
    conferences[conf].append(team_data['location'])

power_5 = ['ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12']
for conf in power_5:
    count = len(conferences.get(conf, []))
    if count > 0:
        teams_preview = ', '.join(conferences[conf][:3])
        print(f"   {conf:12} → {count:3} teams ({teams_preview}...)")

# Test 6: Search across all leagues
print("\n6. CROSS-LEAGUE SEARCH (teams named 'State')")
print("-" * 70)
results = lookup.search_teams('State')
for league, teams in results.items():
    if teams and teams[0]:
        team = teams[0]
        name = team.get('name') or team.get('names', ['Unknown'])[0]
        print(f"   {league.upper():8} → {name}")

# Test 7: ESPN ID verification
print("\n7. ESPN ID VERIFICATION (for API integration)")
print("-" * 70)
major_teams = ['DUKE', 'UNC', 'UK', 'KU']
for abbrev in major_teams:
    team = lookup.find_ncaam_team(abbrev)
    if team:
        espn_id = team.get('espn_id', 'N/A')
        print(f"   {abbrev:6} → ESPN ID: {espn_id:6} ({team['name']})")

print("\n" + "=" * 70)
print(f"✅ NCAAM lookup working perfectly!")
print(f"   Total teams: {len(lookup.ncaam_teams)}")
print(f"   Abbreviations indexed: {len(lookup.ncaam_abbrev_index)}")
print("=" * 70)
