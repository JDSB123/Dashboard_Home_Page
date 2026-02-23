import logging
import re
import json
from datetime import datetime
from pathlib import Path
import pandas as pd
import requests

logger = logging.getLogger(__name__)

FILE_PATH = Path(__file__).parent / "20251222_bombay711_tracker_consolidated.xlsx"
OUTPUT_PATH = Path(__file__).parent / "20251222_bombay711_tracker_results.csv"
TARGET_DATE = datetime(2025, 12, 22)

NBA_TEAM_ALIASES = {
    "clippers": ["los angeles clippers", "la clippers", "clippers"],
    "rockets": ["houston rockets", "rockets"],
    "spurs": ["san antonio spurs", "spurs"],
    "pacers": ["indiana pacers", "pacers"],
    "lakers": ["los angeles lakers", "lakers"],
    "celtics": ["boston celtics", "celtics"],
    "warriors": ["golden state warriors", "warriors"],
    "grizzlies": ["memphis grizzlies", "grizzlies"],
    # add as needed
}

# Extend for NFL and NCAAM as minimal support
NBA_TEAM_ALIASES.update({
    "49ers": ["san francisco 49ers", "49ers"],
    "byu": ["byu cougars", "brigham young", "byu"],
})

# Reverse lookup map for quick matching
ALIAS_TO_KEY = {}
for key, aliases in NBA_TEAM_ALIASES.items():
    for a in aliases:
        ALIAS_TO_KEY[a] = key


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def extract_pick_details(pick_str: str, matchup: str, segment: str):
    s = norm(pick_str)
    m = norm(matchup)
    seg = norm(segment)

    # Detect pick type
    pick_type = None
    team = None
    line = None
    ou_total = None
    ou_dir = None  # 'over' or 'under'

    # Parse Over/Under team total first (e.g., "Clippers Team Total Under 42.5")
    ou_tt = re.search(r"([a-z .]+) team total (over|under) ([0-9]+\.?[0-9]*)", s)
    if ou_tt:
        team_raw = ou_tt.group(1).strip()
        ou_dir = ou_tt.group(2)
        ou_total = float(ou_tt.group(3))
        pick_type = "team_total"
        team = team_raw
    else:
        # Parse spread like "Pacers -4" or "Clippers +3"
        sp = re.search(r"([a-z .]+) ([+\-][0-9]+\.?[0-9]*)", s)
        if sp:
            team_raw = sp.group(1).strip()
            line = float(sp.group(2))
            pick_type = "spread"
            team = team_raw
        else:
            # Parse moneyline when just team name and odds present (e.g., "Clippers +120" or "Clippers -115")
            ml = re.search(r"^([a-z .]+) ([+\-][0-9]{2,3})$", s)
            if ml:
                team_raw = ml.group(1).strip()
                pick_type = "moneyline"
                team = team_raw

    # Fallback: sometimes pick string might be just team name without odds (rare)
    if not pick_type:
        # try get team from matchup and assume moneyline
        mt = re.search(r"([a-z .]+)\s*@\s*([a-z .]+)", m)
        if mt:
            away, home = mt.group(1).strip(), mt.group(2).strip()
            # If pick string contains away or home team name
            for candidate in [away, home]:
                if candidate in s:
                    team = candidate
                    pick_type = "moneyline"
                    break

    return {
        "type": pick_type,
        "team": team,
        "line": line,
        "ou_total": ou_total,
        "ou_dir": ou_dir,
        "segment": seg,
    }


def espn_scoreboard(date: datetime, league: str):
    league = norm(league)
    if "nba" in league:
        path = "basketball/nba"
    elif "nfl" in league:
        path = "football/nfl"
    elif "ncaam" in league or "ncaa m" in league or "college" in league:
        path = "basketball/mens-college-basketball"
    else:
        # default to nba
        path = "basketball/nba"
    url = f"https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates={date.strftime('%Y%m%d')}"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return r.json()


def find_game(event_data, matchup: str, fallback_team: str | None = None):
    m = norm(matchup)
    mt = re.search(r"([a-z .]+)\s*@\s*([a-z .]+)", m)
    away = home = None
    if mt:
        away, home = mt.group(1).strip(), mt.group(2).strip()

    def match_team(name: str):
        nk = norm(name)
        for alias, key in ALIAS_TO_KEY.items():
            if alias in nk:
                return key
        # also try last word heuristic
        last = nk.split()[-1]
        return ALIAS_TO_KEY.get(last)

    away_key = match_team(away) if away else None
    home_key = match_team(home) if home else None
    fb_key = match_team(fallback_team) if fallback_team else None

    for ev in event_data.get("events", []):
        comps = ev.get("competitions", [])
        if not comps:
            continue
        teams = comps[0].get("competitors", [])
        if len(teams) < 2:
            continue
        tkeys = []
        for t in teams:
            nm = t.get("team", {}).get("displayName", "")
            key = match_team(nm)
            tkeys.append(key)
        if away_key and home_key and away_key in tkeys and home_key in tkeys:
            return ev
        # fallback: if we only have one team, match by presence
        if fb_key and fb_key in tkeys:
            return ev
    return None


def get_period_points(ev, team_key: str, period: str):
    comps = ev.get("competitions", [])
    teams = comps[0].get("competitors", [])
    target = None
    for t in teams:
        nm = t.get("team", {}).get("displayName", "").lower()
        # map displayName to key
        actual_key = None
        for alias, key in ALIAS_TO_KEY.items():
            if alias in nm:
                actual_key = key
                break
        if actual_key == team_key:
            target = t
            break
    if not target:
        return None

    ls = target.get("linescores")
    if not ls:
        # fallback to total
        total = int(target.get("score", 0))
        if period == "fg":
            return total
        return None

    # Period mapping: FG=all quarters, 1H=Q1+Q2, 1Q=Q1
    if period == "1q":
        return int(ls[0].get("value", 0)) if len(ls) >= 1 else None
    if period == "1h":
        return int(ls[0].get("value", 0)) + (int(ls[1].get("value", 0)) if len(ls) >= 2 else 0)
    # fg
    return sum(int(q.get("value", 0)) for q in ls)


def evaluate_pick(ev, parsed):
    seg = parsed["segment"]
    period = "fg"
    if "1h" in seg:
        period = "1h"
    elif "1q" in seg:
        period = "1q"

    # Resolve team key
    team_key = None
    if parsed["team"]:
        tk = None
        tn = norm(parsed["team"]) 
        for alias, key in ALIAS_TO_KEY.items():
            if alias in tn:
                tk = key
                break
        team_key = tk

    comps = ev.get("competitions", [])
    teams = comps[0].get("competitors", [])

    # Identify opponent
    opp_key = None
    if team_key:
        for t in teams:
            nm = t.get("team", {}).get("displayName", "").lower()
            k = None
            for alias, key in ALIAS_TO_KEY.items():
                if alias in nm:
                    k = key
                    break
            if k and k != team_key:
                opp_key = k
                break

    # Compute evaluation
    if parsed["type"] == "moneyline" and team_key:
        # Compare final scores
        team_pts = get_period_points(ev, team_key, "fg")
        opp_pts = get_period_points(ev, opp_key, "fg") if opp_key else None
        if team_pts is None or opp_pts is None:
            return "unknown", None
        return ("Hit" if team_pts > opp_pts else "Miss"), None

    if parsed["type"] == "spread" and team_key and parsed["line"] is not None:
        team_pts = get_period_points(ev, team_key, period)
        opp_pts = get_period_points(ev, opp_key, period) if opp_key else None
        if team_pts is None or opp_pts is None:
            return "unknown", None
        line = parsed["line"]
        margin = team_pts - opp_pts
        # For negative line (favorite), need margin > abs(line). For positive (dog), need margin + line > 0
        if line < 0:
            result = "Hit" if margin > abs(line) else "Miss"
        else:
            result = "Hit" if margin + line > 0 else "Miss"
        return result, None

    if parsed["type"] == "team_total" and team_key and parsed["ou_total"] is not None and parsed["ou_dir"]:
        team_pts = get_period_points(ev, team_key, period)
        if team_pts is None:
            return "unknown", None
        if parsed["ou_dir"] == "over":
            result = "Hit" if team_pts > parsed["ou_total"] else "Miss"
        else:
            result = "Hit" if team_pts < parsed["ou_total"] else "Miss"
        return result, None

    return "unknown", None


def main():
    xl = pd.ExcelFile(FILE_PATH)
    df = xl.parse(xl.sheet_names[0])
    # Normalize columns
    cols = {norm(c): c for c in df.columns}
    # Expected columns present from preview
    col_date = cols.get("date")
    col_matchup = cols.get("matchup")
    col_segment = cols.get("segment")
    col_pick = cols.get("pick (odds)")
    col_risk = cols.get("risk")
    col_to_win = cols.get("to win")

    if not all([col_date, col_matchup, col_segment, col_pick]):
        raise ValueError("Required columns not found: Date, Matchup, Segment, Pick (Odds)")

    # Filter to target date
    df[col_date] = pd.to_datetime(df[col_date], errors="coerce")
    picks_df = df[df[col_date].dt.date == TARGET_DATE.date()].copy()
    if picks_df.empty:
        logger.info(f"No picks found for {TARGET_DATE.date()}.")
        return

    # Optional: override Matchup using SportsDataIO-completed CSV if present
    sdio_csv = Path(__file__).parent / "20251222_completed_matchups_sdio.csv"
    if sdio_csv.exists():
        try:
            sdio_df = pd.read_csv(sdio_csv)
            # Coerce date for safe join
            if "Date" in sdio_df.columns:
                sdio_df["Date"] = pd.to_datetime(sdio_df["Date"], errors="coerce")
            # Build join keys present in both
            join_keys = []
            for k in ["Date", cols.get("league"), col_segment, col_pick]:
                if k and (k in picks_df.columns) and (k in sdio_df.columns):
                    join_keys.append(k)
            if join_keys:
                # Only bring Matchup from SDIO
                sdio_subset_cols = ["Matchup"] + join_keys if "Matchup" in sdio_df.columns else join_keys
                merged = picks_df.merge(sdio_df[sdio_subset_cols], on=join_keys, how="left", suffixes=("", "_sdio"))
                if "Matchup" in merged.columns and col_matchup:
                    # Prefer SDIO-completed matchup when available
                    picks_df[col_matchup] = merged["Matchup"].fillna(picks_df[col_matchup])
        except Exception as e:
            logger.warning(f"Could not merge SDIO matchups CSV: {e}")

    # Fetch scoreboard per league for the date
    league_col = cols.get("league")
    leagues_in_day = sorted(set(norm(str(x)) for x in picks_df[league_col].dropna())) if league_col else ["nba"]
    sb_map = {lg: espn_scoreboard(TARGET_DATE, lg) for lg in leagues_in_day}

    results = []
    def parse_float(val):
        if pd.isna(val):
            return None
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val)
        # Extract first numeric with optional sign and decimal
        m = re.search(r"[+\-]?[0-9]+\.?[0-9]*", s)
        if m:
            try:
                return float(m.group(0))
            except ValueError:
                return None
        return None

    for _, row in picks_df.iterrows():
        matchup = str(row[col_matchup])
        segment = str(row[col_segment])
        pick_str = str(row[col_pick])
        risk = parse_float(row[col_risk]) if col_risk in row else None
        to_win = parse_float(row[col_to_win]) if col_to_win in row else None

        parsed = extract_pick_details(pick_str, matchup, segment)
        league_val = str(row.get(league_col, "nba")) if league_col else "nba"
        sb = sb_map.get(norm(league_val))
        fb_team = parsed["team"]
        ev = find_game(sb, matchup, fallback_team=fb_team)
        if not ev:
            result = "unknown"
        else:
            result, _ = evaluate_pick(ev, parsed)

        pnl = None
        if result == "Hit" and to_win is not None:
            pnl = to_win
        elif result == "Miss" and risk is not None:
            pnl = -risk

        results.append({
            "Date": row[col_date].date().isoformat(),
            "League": str(row.get(cols.get("league"), "")),
            "Matchup": matchup,
            "Segment": segment,
            "Pick": pick_str,
            "Risk": risk,
            "To Win": to_win,
            "Hit/Miss": result,
            "PnL": pnl,
        })

    out_df = pd.DataFrame(results)
    out_df.to_csv(OUTPUT_PATH, index=False)
    logger.info(f"Results written to: {OUTPUT_PATH}")
    logger.info(out_df.to_string(index=False))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
