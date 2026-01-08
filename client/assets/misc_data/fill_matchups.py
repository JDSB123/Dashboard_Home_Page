import re
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd
import requests

FILE_PATH = Path(__file__).parent / "20251222_bombay711_tracker_consolidated.xlsx"
OUTPUT_PATH = Path(__file__).parent / "20251222_completed_matchups.csv"
TARGET_DATE = datetime(2025, 12, 22)

LEAGUE_PATHS = {
    "nba": "basketball/nba",
    "nfl": "football/nfl",
    "ncaam": "basketball/mens-college-basketball",
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).strip().lower())


def espn_scoreboard(date: datetime, path: str):
    url = f"https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates={date.strftime('%Y%m%d')}"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return r.json()


def build_team_index(sb_json):
    index = {}
    for ev in sb_json.get("events", []):
        comps = ev.get("competitions", [])
        if not comps:
            continue
        teams = comps[0].get("competitors", [])
        if len(teams) < 2:
            continue
        names = []
        for t in teams:
            tm = t.get("team", {})
            for key in ("displayName", "shortDisplayName", "name", "abbreviation"):
                if tm.get(key):
                    names.append(norm(tm.get(key)))
        # Create index entries for each name mapping to this event and the opponent
        for i, t in enumerate(teams):
            tm = t.get("team", {})
            t_names = [norm(tm.get(k, "")) for k in ("displayName", "shortDisplayName", "name", "abbreviation")]
            opp = teams[1 - i]
            opp_nm = norm(opp.get("team", {}).get("displayName", ""))
            for nm in t_names:
                if nm:
                    index[nm] = {"event": ev, "opponent_name": opp_nm}
    return index


def candidate_team_from_row(matchup: str, pick: str):
    m = norm(matchup)
    p = norm(pick)
    # Prefer explicit team in matchup if present before '@ Opponent TBD'
    mt = re.match(r"([a-z .]+)\s*@\s*opponent tbd", m)
    if mt:
        return mt.group(1).strip()
    # Fall back to first word(s) in pick string before odds
    odds_cut = re.split(r"\s*[+\-][0-9]{2,3}", p)[0]
    # Keep alphabetic tokens
    tokens = re.findall(r"[a-z]+", odds_cut)
    return " ".join(tokens[-2:]) if tokens else None


def infer_matchup(row, team_indexes, default_league: str):
    matchup = str(row.get("Matchup", ""))
    pick = str(row.get("Pick (Odds)", ""))
    league = norm(row.get("League", default_league))
    team_guess = candidate_team_from_row(matchup, pick)
    if not team_guess:
        return None
    idx = team_indexes.get(league)
    # If league is wrong/missing, search across all leagues
    search_spaces = [idx] if idx else list(team_indexes.values())

    # Try direct match, else fuzzy contains
    tg = norm(team_guess)
    for space in search_spaces:
        if not space:
            continue
        if tg in space:
            # Determine away/home ordering from event competitors
            ev = space[tg]["event"]
            comps = ev.get("competitions", [])
            teams = comps[0].get("competitors", [])
            away_disp = teams[0].get('team', {}).get('displayName', '')
            home_disp = teams[1].get('team', {}).get('displayName', '')
            # Use display order from the event
            return f"{away_disp} @ {home_disp}"

    # Fuzzy contains: find any index key contained in team_guess or vice versa
    for space in search_spaces:
        if not space:
            continue
        for key in space.keys():
            if key in tg or tg in key:
                ev = space[key]["event"]
                comps = ev.get("competitions", [])
                teams = comps[0].get("competitors", [])
                return f"{teams[0].get('team', {}).get('displayName', '')} @ {teams[1].get('team', {}).get('displayName', '')}"
    return None


def main():
    xl = pd.ExcelFile(FILE_PATH)
    df = xl.parse(xl.sheet_names[0])
    # Normalize Date column and filter to target date
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    picks_df = df[df["Date"].dt.date == TARGET_DATE.date()].copy()
    if picks_df.empty:
        print(f"No rows found for {TARGET_DATE.date()}.")
        return

    # Build scoreboards and indexes per league
    team_indexes = {}
    for lg, path in LEAGUE_PATHS.items():
        try:
            # Merge indexes for target date and +/- 1 day as fallback
            idx = {}
            for d in [TARGET_DATE - timedelta(days=1), TARGET_DATE, TARGET_DATE + timedelta(days=1)]:
                sb = espn_scoreboard(d, path)
                part = build_team_index(sb)
                idx.update(part)
            team_indexes[lg] = idx
        except Exception as e:
            print(f"Warning: league {lg} scoreboard fetch failed: {e}")

    completed = []
    for _, row in picks_df.iterrows():
        cur_matchup = str(row.get("Matchup", ""))
        if cur_matchup and "opponent tbd" not in norm(cur_matchup) and "tbd" not in norm(cur_matchup):
            completed.append(cur_matchup)
            continue
        new_matchup = infer_matchup(row, team_indexes, default_league="nba")
        completed.append(new_matchup or cur_matchup)

    # Write an output CSV with updated matchups
    out_df = picks_df.copy()
    out_df.loc[:, "Matchup"] = completed
    out_df.to_csv(OUTPUT_PATH, index=False)
    print(f"Completed matchups written to: {OUTPUT_PATH}")
    print(out_df[["League", "Segment", "Pick (Odds)", "Matchup"]].to_string(index=False))


if __name__ == "__main__":
    main()
