#!/usr/bin/env python3
"""
Fix Data Integrity Issues
- Merge Pick columns
- Normalize Risk units (cents -> dollars)
- Remove duplicates
- Create unified master file
"""
import re
import pandas as pd
from pathlib import Path
import requests

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / "output" / "reconciled"


def _coerce_american_odds(v):
    try:
        o = int(str(v).strip())
    except Exception:
        return None
    return o if abs(o) >= 100 else None


def _extract_odds_from_pick(pick_str: str):
    s = str(pick_str or "").strip()
    if not s:
        return None

    m = re.search(r"\(\s*(EVEN|[+-]?\d{2,4})\s*\)\s*$", s, re.IGNORECASE)
    if m:
        token = m.group(1).upper()
        if token == "EVEN":
            return 100
        return _coerce_american_odds(token)

    m = re.search(r"\b([+-]\d{2,4})\b\s*$", s)
    if m:
        return _coerce_american_odds(m.group(1))

    return None


def _infer_odds_from_risk_to_win(risk, to_win):
    try:
        r = float(risk)
        w = float(to_win)
    except Exception:
        return None
    if pd.isna(r) or pd.isna(w):
        return None
    if r <= 0 or w <= 0:
        return None
    ratio = w / r
    if ratio <= 1:
        o = -round(100 / ratio)
    else:
        o = round(100 * ratio)
    return _coerce_american_odds(o)


def _calc_to_win(risk, odds):
    try:
        r = float(risk)
        o = int(float(odds))
    except Exception:
        return None
    if r <= 0 or abs(o) < 100:
        return None
    if o > 0:
        return r * (o / 100)
    return r * (100 / abs(o))


def _calc_pnl(result: str, risk, odds):
    res = str(result or "").strip().lower()
    try:
        r = float(risk)
        o = int(float(odds))
    except Exception:
        return None
    if r <= 0 or abs(o) < 100:
        return None
    if res == "push":
        return 0.0
    if res == "loss":
        return -r
    if res != "win":
        return None
    if o > 0:
        return r * (o / 100)
    return r * (100 / abs(o))


def fix_combined_file():
    """Fix issues in combined graded file."""
    print("Loading combined file...")
    df = pd.read_csv(OUTPUT / "all_graded_combined.csv")

    print(f"Original rows: {len(df)}")

    # 1. Merge Pick columns
    print("\n1. Merging Pick columns...")
    missing_pick = df['Pick'].isna().sum()
    df['Pick'] = df['Pick'].fillna(df['Pick (Odds)'])
    print(f"   Filled {missing_pick} missing Pick values from Pick (Odds)")

    # 2. Risk is already in dollars ($50,000 base unit)
    print("\n2. Verifying Risk units (already in dollars)...")
    print(f"   Total Risk: ${df['Risk'].sum():,.2f}")
    print(f"   Avg Risk per pick: ${df['Risk'].mean():,.2f}")

    # 3. Remove duplicates
    print("\n3. Removing duplicates...")
    before = len(df)
    # Only drop exact duplicate rows. Bets can share (Date, Pick, Risk) across different games.
    df = df.drop_duplicates(keep='first')
    after = len(df)
    print(f"   Removed {before - after} duplicate rows")

    # 4. Fill missing Odds from Pick / Risk+ToWin
    print("\n4. Filling missing Odds/ToWin...")
    if "Odds" in df.columns:
        df["Odds"] = pd.to_numeric(df["Odds"], errors="coerce")
        missing_odds = df["Odds"].isna()
        if missing_odds.any():
            parsed = df.loc[missing_odds, "Pick"].apply(_extract_odds_from_pick)
            df.loc[missing_odds, "Odds"] = pd.to_numeric(parsed, errors="coerce")
        # Still missing? infer from Risk/ToWin.
        missing_odds = df["Odds"].isna()
        if missing_odds.any() and "Risk" in df.columns and "ToWin" in df.columns:
            inferred = df.loc[missing_odds].apply(lambda r: _infer_odds_from_risk_to_win(r.get("Risk"), r.get("ToWin")), axis=1)
            df.loc[missing_odds, "Odds"] = pd.to_numeric(inferred, errors="coerce")

    # Fill missing ToWin from Risk/Odds
    if "ToWin" in df.columns and "Risk" in df.columns and "Odds" in df.columns:
        df["Risk"] = pd.to_numeric(df["Risk"], errors="coerce")
        df["ToWin"] = pd.to_numeric(df["ToWin"], errors="coerce")
        missing_towin = df["ToWin"].isna()
        if missing_towin.any():
            filled = df.loc[missing_towin].apply(lambda r: _calc_to_win(r.get("Risk"), r.get("Odds")), axis=1)
            df.loc[missing_towin, "ToWin"] = pd.to_numeric(filled, errors="coerce")

    # 5. Clean up columns
    drop_cols = ['Pick (Odds)', 'To Win'] if 'Pick (Odds)' in df.columns else []
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors='ignore')

    # 6. Exclude placeholder / incomplete rows (kept in a sidecar file)
    print("\n5. Excluding incomplete/placeholder rows...")
    excluded = []
    hm = df.get("Hit/Miss")
    hm_norm = hm.astype(str).str.lower().str.strip() if hm is not None else pd.Series([""] * len(df))
    valid_hm = hm_norm.isin(["win", "loss", "push"])

    bad_hm = ~valid_hm
    if bad_hm.any():
        tmp = df.loc[bad_hm].copy()
        tmp["ExclusionReason"] = "invalid_hit_miss"
        excluded.append(tmp)
        df = df.loc[valid_hm].copy()
        hm_norm = hm_norm.loc[valid_hm]

    # Missing required numeric fields for PnL accounting
    for col in ["Risk", "PnL"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    missing_required = df["Risk"].isna() | df["PnL"].isna() | (df["Risk"] <= 0)
    if missing_required.any():
        tmp = df.loc[missing_required].copy()
        tmp["ExclusionReason"] = "missing_risk_or_pnl"
        excluded.append(tmp)
        df = df.loc[~missing_required].copy()

    excluded_df = pd.concat(excluded, ignore_index=True) if excluded else pd.DataFrame()
    return df, excluded_df


def create_master_file():
    """Create unified master file from all sources."""
    print("=" * 70)
    print("CREATING MASTER DATA FILE")
    print("=" * 70)

    # Fix combined file
    combined, excluded_combined = fix_combined_file()

    # Load deep dive file
    print("\nLoading deep dive file...")
    deep_dive = pd.read_csv(OUTPUT / "complete_graded.csv")
    print(f"Deep dive rows: {len(deep_dive)}")

    # Drop obvious non-pick rows if present
    if 'Resolution' in deep_dive.columns:
        before = len(deep_dive)
        deep_dive = deep_dive[deep_dive['Resolution'].astype(str).str.lower() != 'not_a_pick'].copy()
        removed = before - len(deep_dive)
        if removed:
            print(f"Filtered not-a-pick rows: {removed}")

    def _extract_stake(raw_text, fallback):
        m = re.search(r'\$(\d+(?:\.\d+)?)', str(raw_text or ''))
        if m:
            return float(m.group(1))
        try:
            return float(fallback)
        except Exception:
            return None

    def _extract_odds(raw_text, fallback):
        text = str(raw_text or '')

        def _coerce_american(v):
            try:
                o = int(str(v).strip())
            except Exception:
                return None
            return o if abs(o) >= 100 else None

        # Prefer odds immediately before $stake (e.g., "-110 $50")
        matches = list(re.finditer(r'([+-]\d{2,4})\s*\$\d', text))
        if matches:
            o = _coerce_american(matches[-1].group(1))
            if o is not None:
                return o
        # Or odds immediately after $stake (e.g., "$50 -110")
        matches = list(re.finditer(r'\$\d+(?:\.\d+)?\s*([+-]\d{2,4})', text))
        if matches:
            o = _coerce_american(matches[-1].group(1))
            if o is not None:
                return o
        # Fall back to existing column if usable
        try:
            if pd.notna(fallback):
                o = _coerce_american(int(float(fallback)))
                if o is not None:
                    return o
        except Exception:
            pass
        # Last-resort: use the last odds-like token in the string
        tokens = re.findall(r'([+-]\d{2,4})', text)
        for tok in reversed(tokens):
            o = _coerce_american(tok)
            if o is not None:
                return o
        return None

    def _normalize_deep_dive_row(row):
        raw = row.get('RawText')
        stake = _extract_stake(raw, row.get('Risk'))
        odds = _extract_odds(raw, row.get('Odds'))

        # If we can't parse, keep existing values.
        if stake is None:
            return pd.Series({'Odds': row.get('Odds'), 'Risk': row.get('Risk'), 'ToWin': row.get('ToWin'), 'PnL': row.get('PnL')})

        # Default invalid/missing odds to -110 (common pricing) to avoid blowing up PnL on bad parses like "-12".
        if odds is None:
            odds = -110

        # Stake convention: Telegram $ amounts are treated as RISK (same as tracker)
        risk = float(stake)
        if odds < 0:
            to_win = float(stake) * (100.0 / abs(int(odds)))
        else:
            to_win = float(stake) * (int(odds) / 100.0)

        result = str(row.get('Hit/Miss') or '').strip().lower()
        if result == 'win':
            pnl = to_win
        elif result == 'loss':
            pnl = -risk
        elif result == 'push':
            pnl = 0.0
        else:
            pnl = row.get('PnL', 0.0)

        return pd.Series({'Odds': odds, 'Risk': risk, 'ToWin': to_win, 'PnL': pnl})

    if 'RawText' in deep_dive.columns:
        print("Normalizing Telegram stake convention and odds parsing...")
        fixed = deep_dive.apply(_normalize_deep_dive_row, axis=1)
        for col in ['Odds', 'Risk', 'ToWin', 'PnL']:
            if col in fixed.columns:
                deep_dive[col] = fixed[col]

        # Keep the displayed odds inside the Pick string consistent with normalized Odds.
        if 'Pick' in deep_dive.columns and 'Odds' in deep_dive.columns:
            def _fix_pick_odds(pick, odds):
                try:
                    if pd.isna(pick):
                        return pick
                except Exception:
                    pass
                pick_str = str(pick)
                try:
                    o = int(float(odds))
                except Exception:
                    return pick_str
                # Replace trailing "(...)" if present; otherwise append.
                if re.search(r'\([+-]?\d{2,4}\)\s*$', pick_str):
                    return re.sub(r'\([+-]?\d{2,4}\)\s*$', f'({o})', pick_str)
                return f"{pick_str} ({o})"

            deep_dive['Pick'] = deep_dive.apply(lambda r: _fix_pick_odds(r.get('Pick'), r.get('Odds')), axis=1)

    # Standardize columns
    print("\nStandardizing columns...")

    # Combined file columns we want
    combined_cols = ['Date', 'League', 'Matchup', 'Segment', 'Pick', 'Odds', 'Risk', 'ToWin', 'Hit/Miss', 'PnL']
    combined_cols = [c for c in combined_cols if c in combined.columns]
    combined = combined[combined_cols].copy()
    combined['Source'] = 'historical'

    # Deep dive columns we want
    deep_cols = [
        'Date', 'League', 'Matchup', 'Segment', 'Pick', 'Odds', 'Risk', 'ToWin', 'Hit/Miss', 'PnL', 'RawText',
        'MatchedLeague', 'MatchedGame', 'FinalScore', 'MatchScore', 'ResolvedTeam', 'Resolution', 'PrevHitMiss', 'PrevPnL',
    ]
    deep_cols = [c for c in deep_cols if c in deep_dive.columns]
    deep_dive = deep_dive[deep_cols].copy()

    # Scale Telegram data: "$50" in text = $50,000 base unit
    print("   Scaling Telegram Risk/ToWin/PnL to match base unit ($50 -> $50,000)...")
    for col in ['Risk', 'ToWin', 'PnL', 'PrevPnL']:
        if col in deep_dive.columns:
            deep_dive[col] = pd.to_numeric(deep_dive[col], errors='coerce') * 1000
    # Clean up numeric formatting
    for col in ['Risk', 'ToWin', 'PnL', 'PrevPnL']:
        if col in deep_dive.columns:
            deep_dive[col] = pd.to_numeric(deep_dive[col], errors='coerce').round(2)
    deep_dive['Source'] = 'telegram_deep_dive'

    excluded = []
    if not excluded_combined.empty:
        tmp = excluded_combined.copy()
        tmp["Source"] = "historical"
        excluded.append(tmp)

    # Exclude ungraded telegram picks from the master file (kept in a sidecar file).
    if "Hit/Miss" in deep_dive.columns:
        hm_dd = deep_dive["Hit/Miss"].astype(str).str.lower().str.strip()
        valid_dd = hm_dd.isin(["win", "loss", "push"])
        if (~valid_dd).any():
            tmp = deep_dive.loc[~valid_dd].copy()
            tmp["ExclusionReason"] = "ungraded_telegram_pick"
            excluded.append(tmp)
            deep_dive = deep_dive.loc[valid_dd].copy()

    # Check for overlap
    print("\nChecking for date overlap...")
    combined_dates = set(combined['Date'].unique())
    deep_dates = set(deep_dive['Date'].unique())
    overlap = combined_dates & deep_dates
    print(f"   Combined dates: {min(combined_dates)} to {max(combined_dates)}")
    print(f"   Deep dive dates: {min(deep_dates)} to {max(deep_dates)}")
    print(f"   Overlapping dates: {len(overlap)}")

    if overlap:
        print(f"   Overlapping dates: {sorted(overlap)}")
        # Keep deep dive for overlapping dates (has raw text)
        combined = combined[~combined['Date'].isin(overlap)]
        print(f"   Removed {len(overlap)} dates from combined to avoid duplicates")

    # Merge
    print("\nMerging files...")
    master = pd.concat([combined, deep_dive], ignore_index=True)
    master = master.sort_values('Date').reset_index(drop=True)

    # Light formatting cleanup for CSV readability
    for col in ['Risk', 'ToWin', 'PnL', 'PrevPnL', 'MatchScore']:
        if col in master.columns:
            master[col] = pd.to_numeric(master[col], errors='coerce').round(2)
    if 'Odds' in master.columns:
        master['Odds'] = pd.to_numeric(master['Odds'], errors='coerce').round(0)
    if 'League' in master.columns:
        master['League'] = master['League'].astype(str).str.upper()
        master.loc[master['League'].isin(['NAN', 'NONE']), 'League'] = ''
        # Prefer MatchedLeague when present
        if "MatchedLeague" in master.columns:
            ml = master["MatchedLeague"].astype(str).str.upper()
            mask_unknown = master["League"].isin(["", "UNKNOWN"])
            mask_matched = ~ml.isin(["", "NAN", "NONE"])
            master.loc[mask_unknown & mask_matched, "League"] = ml
        # Minimal inference for common Telegram aliases that failed schedule matching
        if "Matchup" in master.columns:
            matchup_lower = master["Matchup"].astype(str).str.lower()
            master.loc[master["League"].isin(["", "UNKNOWN"]) & matchup_lower.str.contains(r"\bucsb\b|santa barbara", regex=True, na=False), "League"] = "NCAAM"
    if 'Segment' in master.columns:
        master['Segment'] = master['Segment'].astype(str).str.upper()
        master.loc[master['Segment'].isin(['NAN', 'NONE']), 'Segment'] = 'FG'

    # Fill missing Odds in master (historical rows commonly omit it)
    if "Odds" in master.columns:
        master["Odds"] = pd.to_numeric(master["Odds"], errors="coerce")
        miss = master["Odds"].isna()
        if miss.any() and "Pick" in master.columns:
            parsed = master.loc[miss, "Pick"].apply(_extract_odds_from_pick)
            master.loc[miss, "Odds"] = pd.to_numeric(parsed, errors="coerce")
        miss = master["Odds"].isna()
        if miss.any() and "Risk" in master.columns and "ToWin" in master.columns:
            inferred = master.loc[miss].apply(lambda r: _infer_odds_from_risk_to_win(r.get("Risk"), r.get("ToWin")), axis=1)
            master.loc[miss, "Odds"] = pd.to_numeric(inferred, errors="coerce")
        master["Odds"] = master["Odds"].round(0)

    # Resolve placeholder matchups ("TBD"/"Opponent") using ESPN scoreboards
    def _scoreboard_url(date_str: str, league: str) -> str:
        date_fmt = str(date_str).replace("-", "")
        lg = str(league or "").upper()
        urls = {
            "NFL": f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={date_fmt}",
            "NCAAF": f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates={date_fmt}&groups=80&limit=1000",
            "NBA": f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={date_fmt}",
            "NCAAM": f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={date_fmt}&groups=50&limit=1000",
        }
        return urls.get(lg, "")

    def _fetch_games(date_str: str, league: str):
        url = _scoreboard_url(date_str, league)
        if not url:
            return []
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

        games = []
        for event in data.get("events", []):
            comp = (event.get("competitions") or [{}])[0]
            competitors = comp.get("competitors") or []
            if len(competitors) != 2:
                continue
            home = next((c for c in competitors if c.get("homeAway") == "home"), None)
            away = next((c for c in competitors if c.get("homeAway") == "away"), None)
            if not home or not away:
                continue
            home_team = str((home.get("team") or {}).get("displayName") or (home.get("team") or {}).get("shortDisplayName") or "").strip()
            away_team = str((away.get("team") or {}).get("displayName") or (away.get("team") or {}).get("shortDisplayName") or "").strip()
            try:
                home_score = int(float(home.get("score"))) if home.get("score") is not None else None
            except Exception:
                home_score = None
            try:
                away_score = int(float(away.get("score"))) if away.get("score") is not None else None
            except Exception:
                away_score = None
            status = str(event.get("status") or {}).strip()
            status = event.get("status", {}).get("type", {}).get("name", "")
            games.append(
                {
                    "name": event.get("name", ""),
                    "home_team": home_team,
                    "away_team": away_team,
                    "home_score": home_score,
                    "away_score": away_score,
                    "status": status,
                }
            )
        return games

    def _team_hint_from_row(r) -> str:
        matchup = str(r.get("Matchup") or "").strip()
        s = re.sub(r"\s+", " ", matchup)
        s = re.sub(r"^\s*(?:CFP|CFB)\s*-\s*", "", s, flags=re.IGNORECASE)

        left = ""
        if "@" in s:
            left = s.split("@", 1)[0].strip()
        elif re.search(r"\bvs\b", s, re.IGNORECASE):
            left = re.split(r"\bvs\b", s, flags=re.IGNORECASE)[0].strip()
        else:
            left = s

        left = re.sub(r"\b(opponent|tbd)\b", "", left, flags=re.IGNORECASE).strip()
        left = re.sub(r"[-–]+\s*$", "", left).strip()
        if left:
            return left

        pick = str(r.get("Pick") or "").strip()
        # Prefer explicit team prefix from pick strings like "49ers ML ..." or "Pacers -4 ..."
        m = re.match(r"^([A-Za-z]+(?:\s+[A-Za-z]+){0,3})\s+(?:ML|[+-]?\d)", pick, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return ""

    placeholder_mask = master["Matchup"].astype(str).str.contains(r"(?:TBD|Opponent)", case=False, na=False)
    if placeholder_mask.any():
        print(f"Resolving placeholder matchups: {int(placeholder_mask.sum())} rows")
        cache = {}
        def _norm_key(s: str) -> str:
            return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())

        alias = {
            "sdstate": "sandiegostate",
            "missstate": "mississippistate",
            "youngstownst": "youngstownstate",
            "odu": "olddominion",
            "uf": "florida",
        }

        unresolved_placeholder_idx = []
        for idx, row in master.loc[placeholder_mask].iterrows():
            date = row.get("Date")
            league = row.get("League")
            team_hint_raw = _team_hint_from_row(row)
            team_hint = _norm_key(team_hint_raw)
            team_hint = alias.get(team_hint, team_hint)
            if not team_hint:
                unresolved_placeholder_idx.append(idx)
                continue
            cache_key = (date, league)
            if cache_key not in cache:
                cache[cache_key] = _fetch_games(date, league)
            games = cache[cache_key]
            match = None
            for g in games:
                if team_hint in _norm_key(g["home_team"]) or team_hint in _norm_key(g["away_team"]):
                    match = g
                    break
            if not match:
                unresolved_placeholder_idx.append(idx)
                continue
            master.at[idx, "Matchup"] = match["name"] or master.at[idx, "Matchup"]
            if "MatchedGame" in master.columns and pd.isna(master.at[idx, "MatchedGame"]):
                master.at[idx, "MatchedGame"] = match["name"]
            if "MatchedLeague" in master.columns and pd.isna(master.at[idx, "MatchedLeague"]):
                master.at[idx, "MatchedLeague"] = str(league or "").upper()
            if "FinalScore" in master.columns and match.get("away_score") is not None and match.get("home_score") is not None:
                master.at[idx, "FinalScore"] = f"{match['away_score']} - {match['home_score']}"

        # Drop any remaining unresolved placeholders from the master file (kept in excluded file).
        still_placeholder = master["Matchup"].astype(str).str.contains(r"(?:TBD|Opponent)", case=False, na=False)
        if still_placeholder.any():
            tmp = master.loc[still_placeholder].copy()
            tmp["ExclusionReason"] = "unresolved_placeholder_matchup"
            excluded.append(tmp)
            master = master.loc[~still_placeholder].copy()

    # Persist excluded rows for review
    if excluded:
        excluded_df = pd.concat(excluded, ignore_index=True)
        excluded_path = OUTPUT / "excluded_picks.csv"
        excluded_df.to_csv(excluded_path, index=False)
        print(f"\nExcluded rows saved to: {excluded_path}")

    # Final stats
    print("\n" + "=" * 70)
    print("MASTER FILE SUMMARY")
    print("=" * 70)

    graded = master[master['Hit/Miss'].str.lower().isin(['win', 'loss', 'push'])]
    wins = len(graded[graded['Hit/Miss'].str.lower() == 'win'])
    losses = len(graded[graded['Hit/Miss'].str.lower() == 'loss'])
    pushes = len(graded[graded['Hit/Miss'].str.lower() == 'push'])

    print(f"Total picks: {len(master)}")
    print(f"Graded picks: {len(graded)}")
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"Win rate: {wins/(wins+losses)*100:.1f}%")
    print(f"Total Risk: ${graded['Risk'].sum():,.2f}")
    print(f"Total PnL: ${graded['PnL'].sum():,.2f}")
    print(f"ROI: {(graded['PnL'].sum()/graded['Risk'].sum())*100:.2f}%")
    print(f"Date range: {master['Date'].min()} to {master['Date'].max()}")

    # Save
    output_path = OUTPUT / "master_all_picks.csv"
    master.to_csv(output_path, index=False)
    print(f"\nSaved to: {output_path}")

    return master


if __name__ == "__main__":
    master = create_master_file()
