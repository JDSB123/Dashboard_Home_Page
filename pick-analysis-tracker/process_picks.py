import re
import json
from pathlib import Path
import pandas as pd

BASE_STAKE = 50_000
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parent / "assets" / "misc_data"
OUTPUT_DIR = ROOT / "output"
TEAM_CONFIG_PATH = ROOT.parent / "assets" / "data" / "team-config.json"
ALIAS_PATH = ROOT / "team-aliases.json"

SEGMENT_MAP = {
    "fg": "fg",
    "full game": "fg",
    "full": "fg",
    "1h": "1h",
    "1q": "1q",
    "2h": "2h",
    "2q": "2q",
    "3q": "3q",
    "4q": "4q",
}


def ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR


def load_supporting_maps():
    team_config = json.loads(TEAM_CONFIG_PATH.read_text(encoding="utf-8")) if TEAM_CONFIG_PATH.exists() else {}
    aliases = json.loads(ALIAS_PATH.read_text(encoding="utf-8")) if ALIAS_PATH.exists() else {}
    return team_config, aliases


def load_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Source not found: {path}")
    if path.suffix.lower() in {".xlsx", ".xls"}:
        xl = pd.ExcelFile(path)
        sheet = xl.sheet_names[0]
        return xl.parse(sheet)
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    raise ValueError(f"Unsupported file type: {path.suffix}")


def normalize_headers(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {
        "Pick (Odds)": "Pick",
        "Hit/Miss": "HitMiss",
        "To Win": "ToWin",
    }
    df = df.rename(columns=rename_map)
    return df


def extract_odds_from_pick(pick_text: str):
    if not isinstance(pick_text, str):
        return None
    lower = pick_text.lower()
    if "even" in lower or "evens" in lower or "ev" == lower.strip() or "pk" in lower or "pick" in lower:
        return 100
    match = re.search(r"([-+]\d{3,4})", pick_text)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def american_to_risk_to_win(odds: int, risk: float | None, to_win: float | None):
    if odds is None:
        return risk, to_win, "missing-odds"
    if risk and to_win:
        return risk, to_win, "explicit"
    if odds < 0:
        # To win 50k; compute required risk
        computed_risk = abs(odds) * BASE_STAKE / 100
        return computed_risk if risk is None else risk, BASE_STAKE if to_win is None else to_win, "rule-negative"
    # Positive odds: risk 50k; compute to-win
    computed_to_win = BASE_STAKE * odds / 100
    return BASE_STAKE if risk is None else risk, computed_to_win if to_win is None else to_win, "rule-positive"


def map_segment(segment_text: str):
    if not isinstance(segment_text, str):
        return None
    key = segment_text.strip().lower()
    return SEGMENT_MAP.get(key, key)


def normalize_rows(df: pd.DataFrame) -> pd.DataFrame:
    records = []
    for _, row in df.iterrows():
        pick_text = row.get("Pick")
        odds = row.get("Odds") if "Odds" in row else None
        if pd.isna(odds):
            odds = None
        odds = int(odds) if isinstance(odds, (int, float)) and not pd.isna(odds) else odds
        if odds is None:
            odds = extract_odds_from_pick(pick_text)
        # If still missing odds but text hints (pk/even/odds not provided), assume +100 per instruction to infer from context
        if odds is None and isinstance(pick_text, str):
            if any(hint in pick_text.lower() for hint in ["pk", "pick", "even", "evens", "odds not provided"]):
                odds = 100
        # If still missing odds, default to -110 per user instruction
        if odds is None:
            odds = -110
        risk = row.get("Risk") if "Risk" in row else None
        to_win = row.get("ToWin") if "ToWin" in row else None
        try:
            risk = float(risk) if risk not in (None, "", pd.NA) and not pd.isna(risk) else None
        except Exception:
            risk = None
        try:
            to_win = float(to_win) if to_win not in (None, "", pd.NA) and not pd.isna(to_win) else None
        except Exception:
            to_win = None
        risk, to_win, stake_rule = american_to_risk_to_win(odds, risk, to_win)
        league_val = str(row.get("League") or "").strip().upper()
        if league_val == "ALL" and str(pick_text or "").strip().upper() == "ALL":
            continue  # skip summary row
        record = {
            "Date": row.get("Date"),
            "League": league_val,
            "Matchup": str(row.get("Matchup") or "").strip(),
            "Segment": map_segment(str(row.get("Segment") or "")),
            "Pick": pick_text,
            "Odds": odds,
            "Risk": risk,
            "ToWin": to_win,
            "StakeRule": stake_rule,
            "HitMiss": row.get("HitMiss"),
            "PnL": row.get("PnL"),
        }
        records.append(record)
    return pd.DataFrame(records)


def main():
    team_config, aliases = load_supporting_maps()
    _ = team_config, aliases  # placeholders for upcoming team/date inference
    ensure_output_dir()
    source = DATA_DIR / "20251222_bombay711_tracker_consolidated.xlsx"
    df_raw = load_table(source)
    df_raw = normalize_headers(df_raw)
    df_norm = normalize_rows(df_raw)
    output_path = OUTPUT_DIR / "normalized_preview.csv"
    df_norm.to_csv(output_path, index=False)
    print(f"Normalized rows: {len(df_norm)} -> {output_path}")
    unresolved_odds = df_norm[df_norm["Odds"].isna()]
    if not unresolved_odds.empty:
        print("Rows missing odds (need manual/advanced parse):")
        print(unresolved_odds[["Date", "League", "Matchup", "Segment", "Pick"]].head(15).to_string(index=False))


if __name__ == "__main__":
    main()
