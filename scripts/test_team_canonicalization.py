"""
Test team canonicalization / variant lookup functionality.
Verifies that shorthand team names resolve to proper abbreviations.
"""

from team_variant_lookup import TeamVariantLookup

def test_team_lookup():
    lookup = TeamVariantLookup()
    
    print("="*80)
    print("Team Canonicalization Tests")
    print("="*80)
    
    # Test NFL teams
    print("\n[NFL] Tests:")
    nfl_tests = [
        ("Raiders", "LV"),
        ("raiders", "LV"),
        ("LV", "LV"),
        ("LAS", "LV"),
        ("Cardinals", "ARI"),
        ("ARI", "ARI"),
        ("KC", "KC"),
        ("Chiefs", "KC"),
        ("Packers", "GB"),
        ("GB", "GB"),
    ]
    
    for query, expected in nfl_tests:
        result = lookup.find_nfl_team(query)
        abbrev = result['key'] if result else None
        status = "✓" if abbrev == expected else "✗"
        print(f"  {status} '{query}' -> {abbrev} (expected: {expected})")
    
    # Test NBA teams
    print("\n[NBA] Tests:")
    nba_tests = [
        ("Lakers", "LAL"),
        ("LAL", "LAL"),
        ("LA", "LAL"),
        ("Warriors", "GSW"),
        ("GSW", "GSW"),
        ("Celtics", "BOS"),
        ("BOS", "BOS"),
        ("Nets", "BKN"),
        ("BKN", "BKN"),
        ("BRK", "BKN"),
    ]
    
    for query, expected in nba_tests:
        result = lookup.find_nba_team(query)
        abbrev = result['key'] if result else None
        status = "OK" if abbrev == expected else "FAIL"
        print(f"  {status} '{query}' -> {abbrev} (expected: {expected})")
    
    # Test NCAAM teams
    print("\n[NCAAM] Tests:")
    ncaam_tests = [
        ("Duke", "DUKE"),
        ("DUKE", "DUKE"),
        ("Blue Devils", "DUKE"),
        ("UNC", "UNC"),
        ("North Carolina", "UNC"),
        ("Tar Heels", "UNC"),
        ("Kentucky", "UK"),
        ("UK", "UK"),
        ("Wildcats", "UK"),  # Should match first wildcat team
    ]
    
    for query, expected in ncaam_tests:
        result = lookup.find_ncaam_team(query)
        abbrev = result['key'] if result else None
        status = "OK" if abbrev == expected else "WARN"
        print(f"  {status} '{query}' -> {abbrev} (expected: {expected})")
    
    # Test normalization functions
    print("\n[Normalization] Tests:")
    print(f"  NFL: BRK -> {lookup.normalize_nfl_abbreviation('BRK')}")
    print(f"  NBA: BRK -> {lookup.normalize_nba_abbreviation('BRK')}")
    print(f"  NCAAM: A&M -> {lookup.normalize_ncaam_abbreviation('A&M')}")
    
    print("\n" + "="*80)
    print("Test Complete")
    print("="*80)

if __name__ == "__main__":
    test_team_lookup()
