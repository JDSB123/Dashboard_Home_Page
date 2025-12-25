"""
Extract and merge NCAAM team variants from multiple sources into unified JSON format.
Sources:
- Local assets/data/ncaam_variants.json
- Explicit mappings from team_name_mapper.py (extracted from GitHub repo)
- Additional common variants

Output format:
{
  "canonical_team": ["variant1", "variant2", "abbr", ...]
}
"""

import json
from pathlib import Path

# Explicit mappings extracted from team_name_mapper.py
EXPLICIT_MAPPINGS = {
    "florida international panthers": "florida int'l golden panthers",
    "saint mary's gaels": ["saint mary's gaels", "st mary's gaels"],
    "mississippi rebels": "ole miss rebels",
    "connecticut huskies": "uconn huskies",
    "lsu tigers": "lsu tigers",
    "ucf knights": "ucf knights",
    "vcu rams": "vcu rams",
    "smu mustangs": "smu mustangs",
    "tcu horned frogs": "tcu horned frogs",
    "unlv rebels": ["unlv runnin' rebels", "unlv rebels"],
    "usc trojans": "usc trojans",
    "ucla bruins": "ucla bruins",
    "utep miners": "utep miners",
    "utsa roadrunners": "utsa roadrunners",
    "jackson state tigers": "jackson st tigers",
    "alcorn state braves": "alcorn st braves",
    "grambling tigers": "grambling st tigers",
    "prairie view a&m panthers": "prairie view a&m panthers",
    "southern jaguars": "southern u jaguars",
    "alabama state hornets": "alabama st hornets",
    "mississippi valley state delta devils": "mississippi valley st delta devils",
    "arkansas pine bluff golden lions": "arkansas-pine bluff golden lions",
    "texas southern tigers": "texas southern tigers",
    "boston university terriers": ["boston univ. terriers", "boston university terriers"],
    "se missouri state redhawks": ["southeast missouri st redhawks", "southeast missouri state redhawks"],
    "san jose state spartans": "san jose st spartans",
    "delaware state hornets": "delaware st hornets",
    "south carolina state bulldogs": "south carolina st bulldogs",
    "north carolina a&t aggies": "north carolina a&t aggies",
    "north carolina central eagles": ["nc central eagles", "north carolina central eagles"],
    "florida a&m rattlers": "florida a&m rattlers",
    "tennessee state tigers": "tennessee st tigers",
    "eastern kentucky colonels": "eastern kentucky colonels",
    "cleveland state vikings": "cleveland st vikings",
    "loyola chicago ramblers": "loyola (chi) ramblers",
    "loyola maryland greyhounds": "loyola (md) greyhounds",
    "loyola marymount lions": "loyola marymount lions",
    "mount st. mary's mountaineers": "mt. st. mary's mountaineers",
    "saint francis red flash": "st. francis (pa) red flash",
    "st. francis brooklyn terriers": "st. francis (bkn) terriers",
    "st. john's red storm": "st. john's red storm",
    "saint peter's peacocks": "st. peter's peacocks",
    "st. bonaventure bonnies": "st. bonaventure bonnies",
    "saint joseph's hawks": "st. joseph's hawks",
    "st. thomas tommies": "st. thomas - minnesota tommies",
    "le moyne dolphins": "le moyne dolphins",
    "sacred heart pioneers": "sacred heart pioneers",
    "fairleigh dickinson knights": "fairleigh dickinson knights",
    "long island university sharks": "liu sharks",
    "queens royals": "queens university royals",
    "appalachian state mountaineers": ["app state mountaineers", "appalachian st mountaineers"],
    "arkansas state red wolves": "arkansas st red wolves",
    "idaho state bengals": "idaho st bengals",
    "indiana state sycamores": "indiana st sycamores",
    "illinois state redbirds": "illinois st redbirds",
    "utah state aggies": "utah st aggies",
    "montana state bobcats": "montana st bobcats",
    "weber state wildcats": "weber st wildcats",
    "portland state vikings": "portland st vikings",
    "northern arizona lumberjacks": "northern arizona lumberjacks",
    "sacramento state hornets": "sacramento st hornets",
    "cal poly mustangs": "cal poly mustangs",
    "cal state bakersfield roadrunners": "csu bakersfield roadrunners",
    "uc davis aggies": "uc davis aggies",
    "uc irvine anteaters": "uc irvine anteaters",
    "uc riverside highlanders": "uc riverside highlanders",
    "uc san diego tritons": "uc san diego tritons",
    "uc santa barbara gauchos": "uc santa barbara gauchos",
    "wichita state shockers": "wichita st shockers",
    "wright state raiders": "wright st raiders",
    "youngstown state penguins": "youngstown st penguins",
    "murray state racers": "murray st racers",
    "morehead state eagles": "morehead st eagles",
    "norfolk state spartans": "norfolk st spartans",
    "coppin state eagles": "coppin st eagles",
    "morgan state bears": "morgan st bears"
    # Add more from the repo as needed
}

# Additional mappings for known problematic teams
PROBLEMATIC_MAPPINGS = {
    "california baptist lancers": ["california baptist", "cal baptist", "cbu"],
    "eastern washington eagles": ["eastern washington", "e wash", "ewu"],
    "mississippi state bulldogs": ["mississippi state", "miss state", "ms state", "msst"],
    "south dakota state jackrabbits": ["sd state", "south dakota state", "s dakota st", "sdst"],
    "south carolina gamecocks": ["sc", "south carolina", "s carolina", "scar"],
    "north carolina a&t aggies": ["nc a&t", "n.c. a&t", "north carolina a&t", "nca&t"],
    "unc greensboro spartans": ["uncg", "unc greensboro", "unc-greensboro", "unc greensb"],
    "kansas city roos": ["umkc", "kansas city", "umkc kangaroos"],
    "oral roberts golden eagles": ["oral rob", "oral roberts", "oru"],
    "missouri state bears": ["mo st", "missouri state", "mo state", "most"],
    "etsu buccaneers": ["etsu", "east tennessee state", "e tenn st"],
    "abilene christian wildcats": ["acu", "abilene christian", "abilene chr"],
    "north dakota fighting hawks": ["north dakota", "n dakota", "ndak"]
}

# Merge with explicit
EXPLICIT_MAPPINGS.update(PROBLEMATIC_MAPPINGS)

def load_local_variants(file_path: str) -> dict:
    """Load existing ncaam_variants.json"""
    path = Path(file_path)
    if not path.exists():
        return {}
    
    with open(path, 'r') as f:
        data = json.load(f)
    
    # Convert from {"key": {"canonical": "Name", "code": "CODE"}} to {"Name": ["key", "CODE"]}
    variants = {}
    for key, info in data.items():
        canonical = info.get("canonical")
        code = info.get("code")
        if canonical:
            if canonical not in variants:
                variants[canonical] = []
            variants[canonical].append(key.lower())
            if code and code.lower() not in variants[canonical]:
                variants[canonical].append(code.lower())
    
    return variants

def merge_variants(local_variants: dict, explicit: dict) -> dict:
    """Merge local variants with explicit mappings"""
    merged = local_variants.copy()
    
    for explicit_canonical, explicit_variants in explicit.items():
        canonical = normalize_name(explicit_canonical)
        if isinstance(explicit_variants, str):
            explicit_variants = [explicit_variants]
        
        if canonical not in merged:
            merged[canonical] = []
        
        for variant in explicit_variants:
            norm_variant = normalize_name(variant)
            if norm_variant not in merged[canonical]:
                merged[canonical].append(norm_variant)
    
    # Add common variants
    for canonical in list(merged.keys()):
        norm_canonical = normalize_name(canonical)
        if norm_canonical not in merged[canonical]:
            merged[canonical].append(norm_canonical)
        
        # Add abbreviated forms
        abbr = ''.join(word[0] for word in norm_canonical.split() if word).upper()
        if len(abbr) >= 2 and abbr not in merged[canonical]:
            merged[canonical].append(abbr)
    
    return merged

def normalize_name(name: str) -> str:
    """Basic normalization"""
    name = name.lower().strip()
    name = name.replace(".", "").replace("'", "").replace("-", " ")
    name = ' '.join(name.split())
    return name

def main():
    script_dir = Path(__file__).parent
    tracker_dir = script_dir.parent
    local_file = tracker_dir / "assets" / "data" / "ncaam_variants.json"
    output_file = tracker_dir / "variants" / "ncaam_variants.json"
    
    local_variants = load_local_variants(local_file)
    merged = merge_variants(local_variants, EXPLICIT_MAPPINGS)
    
    # Sort variants for each team
    for team in merged:
        merged[team] = sorted(set(merged[team]))
    
    # Sort the dictionary by canonical name
    sorted_merged = dict(sorted(merged.items()))
    
    with open(output_file, 'w') as f:
        json.dump(sorted_merged, f, indent=2)
    
    print(f"Extracted and merged {len(sorted_merged)} teams with variants")
    print(f"Output saved to: {output_file}")

if __name__ == "__main__":
    main()
