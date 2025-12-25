import json
import re
from pathlib import Path

def extract_ncaam():
    sql_path = Path(r"C:\Users\JB\green-bier-ventures\NCAAM_main\database\migrations\005_complete_team_data.sql")
    if not sql_path.exists():
        print("NCAAM SQL not found")
        return {}
    
    content = sql_path.read_text(encoding="utf-8")
    
    aliases = {}

    # 1. Extract canonical names from INSERT INTO teams
    # Pattern: ('Name', 'BartName', 'Conf')
    teams_match = re.search(r"INSERT INTO\s+teams\s+\(canonical_name,.*?\)\s+VALUES\s+(.*?);", content, re.DOTALL | re.IGNORECASE)
    if teams_match:
        values_block = teams_match.group(1)
        # Find all ('Name', 'BartName', ...)
        team_entries = re.findall(r"\(\s*'([^']+)'\s*,\s*'([^']+)'", values_block)
        for canonical, bart in team_entries:
            canonical = canonical.replace("''", "'")
            bart = bart.replace("''", "'")
            code = canonical.upper().replace(" ", "_")[:10]
            aliases[canonical.lower()] = {"canonical": canonical, "code": code}
            aliases[bart.lower()] = {"canonical": canonical, "code": code}

    # 2. Look for VALUES (...) blocks in INSERT INTO team_aliases
    # Pattern: ('Canonical', 'Alias')
    matches = re.findall(r"\('([^']+)',\s*'([^']+)'\)", content)
    
    for canonical, alias in matches:
        # Clean up SQL escapes
        canonical = canonical.replace("''", "'")
        alias = alias.replace("''", "'")
        aliases[alias.lower()] = {"canonical": canonical, "code": canonical.upper().replace(" ", "_")[:10]}
        # Also add canonical itself if not present
        if canonical.lower() not in aliases:
            aliases[canonical.lower()] = {"canonical": canonical, "code": canonical.upper().replace(" ", "_")[:10]}
            
    return aliases

def extract_nba():
    aliases = {}
    
    # 1. team_mapping.json
    mapping_path = Path(r"C:\Users\JB\green-bier-ventures\NBA_main\src\ingestion\team_mapping.json")
    if mapping_path.exists():
        data = json.loads(mapping_path.read_text(encoding="utf-8"))
        for code, variants in data.items():
            canonical = variants[0].title()
            clean_code = code.replace("nba_", "").upper()
            for v in variants:
                aliases[v.lower()] = {"canonical": canonical, "code": clean_code}
                
    # 2. team_name_variants.jsonl
    jsonl_path = Path(r"C:\Users\JB\green-bier-ventures\NBA_main\data\processed\cache\team_name_variants.jsonl")
    if jsonl_path.exists():
        for line in jsonl_path.read_text(encoding="utf-8").splitlines():
            if not line.strip(): continue
            try:
                item = json.loads(line)
                raw = item.get("raw", "").lower()
                norm = item.get("normalized", "")
                if raw and norm:
                    code = norm.upper().replace(" ", "_")[:10]
                    if raw not in aliases:
                        aliases[raw] = {"canonical": norm, "code": code}
            except: continue
            
    # 3. team_variant_overrides.json
    overrides_path = Path(r"C:\Users\JB\green-bier-ventures\NBA_main\data\processed\cache\team_variant_overrides.json")
    if overrides_path.exists():
        try:
            data = json.loads(overrides_path.read_text(encoding="utf-8"))
            for raw, norm in data.items():
                code = norm.upper().replace(" ", "_")[:10]
                aliases[raw.lower()] = {"canonical": norm, "code": code}
        except: pass
        
    return aliases

def main():
    ncaam = extract_ncaam()
    nba = extract_nba()
    
    Path("assets/data/ncaam_variants.json").write_text(json.dumps(ncaam, indent=2), encoding="utf-8")
    Path("assets/data/nba_variants.json").write_text(json.dumps(nba, indent=2), encoding="utf-8")
    
    print(f"Extracted {len(ncaam)} NCAAM aliases and {len(nba)} NBA aliases")

if __name__ == "__main__":
    main()
