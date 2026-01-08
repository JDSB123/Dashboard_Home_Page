"""
Test NCAAM team variant lookups using the unified ingestor.
"""

import sys
import json
from pathlib import Path

script_dir = Path(__file__).parent
tracker_dir = script_dir.parent
sys.path.insert(0, str(tracker_dir))

from ingestors import NCAAMIngestor

def main():
    variants_file = tracker_dir / "variants" / "ncaam_variants.json"
    
    if not variants_file.exists():
        print("❌ Variants file not found! Run extract_team_variants.py first.")
        return
    
    ingestor = NCAAMIngestor()
    
    print("\n📊 Testing NCAAM Team Lookups")
    print("=" * 50)
    
    test_cases = [
        ("duke blue devils", "Duke"),
        ("unc", "North Carolina"),
        ("n.c. state", "N.C. State"),
        ("florida int'l golden panthers", "Florida International"),
        ("st mary's gaels", "Saint Mary's"),
        ("ole miss rebels", "Mississippi"),
        ("uconn huskies", "Connecticut"),
        ("loyola (chi) ramblers", "Loyola Chicago"),
        ("mt. st. mary's mountaineers", "Mount St. Mary's"),
        ("app state mountaineers", "Appalachian State"),
        ("idaho st bengals", "Idaho State"),
        ("csu bakersfield roadrunners", "Cal State Bakersfield"),
        ("uc irvine anteaters", "UC Irvine"),
        ("st. john's red storm", "St. John's"),
        ("saint peter's peacocks", "Saint Peter's"),
        # Add more test cases as needed
    ]
    
    passed = 0
    failed = 0
    
    for input_name, expected in test_cases:
        resolved = ingestor.resolve_team(input_name)
        status = "✅" if resolved == expected else "❌"
        if status == "✅":
            passed += 1
        else:
            failed += 1
        print(f"{status} Input: '{input_name}' → Resolved: '{resolved}' (Expected: '{expected}')")
    
    print("\n" + "=" * 50)
    print(f"Test Summary: {passed} passed, {failed} failed ({passed + failed} total)")
    print("=" * 50 + "\n")

if __name__ == "__main__":
    main()
