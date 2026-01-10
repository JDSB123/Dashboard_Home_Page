import os
import csv
import argparse
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECONCILED_DIR = os.path.join(ROOT, 'output', 'reconciled')
ANALYSIS_DIR = os.path.join(ROOT, 'output', 'analysis')
CONSOLIDATED_CSV = os.path.join(ROOT, 'data-pipeline', 'consolidated_historical_data.csv')


def load_reconcile_module():
    # Import reconcile module by path to access helper functions
    import importlib.util
    path = os.path.join(os.path.dirname(__file__), 'reconcile_nfl_scores.py')
    spec = importlib.util.spec_from_file_location('reconcile', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def parse_amount_token(tok):
    # Interpret shorthand like '25$' => 25000
    if not tok:
        return None
    s = str(tok).strip()
    # If contains '$' after number like '25$' or '$25'
    s2 = s.replace('$', '')
    try:
        val = float(s2)
    except:
        return None
    # If original used trailing dollar symbol or short token (no thousands sep), treat as thousands
    if s.endswith('$') or (len(s2) <= 3 and float(val) < 1000):
        return int(val * 1000)
    return int(val)


def compute_risk_win(odds, base_bet):
    # odds: integer, e.g. -120 or 220
    try:
        o = int(float(odds))
    except:
        return base_bet, base_bet
    if o < 0:
        to_risk = base_bet
        to_win = round(base_bet * (100.0 / abs(o)), 2)
    else:
        to_win = base_bet
        to_risk = round(base_bet * (100.0 / o), 2) if o != 0 else base_bet
    return float(to_risk), float(to_win)


def format_row_standard(row, mod, base_bet):
    # row is a dict from reconcile CSV
    # Use mod.load_data() helpers to compute scores
    game_map = mod.load_data()
    matchup = row.get('Match-Up (Away vs Home)') or row.get('Match-Up (Away vs Home)')
    segment = row.get('Segment')
    odds_raw = row.get('Odds')
    # normalize odds to int
    try:
        odds = int(float(str(odds_raw).replace('+','')))
        if str(odds_raw).strip().startswith('+'):
            odds = abs(odds)
    except:
        try:
            odds = int(odds_raw)
        except:
            odds = 0

    # Find game
    away_abbr = home_abbr = ''
    if matchup and '@' in matchup:
        away_abbr, home_abbr = [x.strip() for x in matchup.split('@')]

    game = game_map.get(home_abbr) or game_map.get(away_abbr)
    scores = {'Home': {'Final': None, '1H': None, '2H': None}, 'Away': {'Final': None, '1H': None, '2H': None}}
    if game:
        scores = mod.calculate_period_scores(game)

    # Hit or Miss
    result = row.get('Result') or ''

    # 1H Score: away, home, total
    a1 = scores['Away'].get('1H') if scores['Away'].get('1H') is not None else 'unknown'
    h1 = scores['Home'].get('1H') if scores['Home'].get('1H') is not None else 'unknown'
    try:
        t1 = (a1 + h1) if isinstance(a1, (int,float)) and isinstance(h1, (int,float)) else 'unknown'
    except:
        t1 = 'unknown'

    # 2H + OT (we will report 2H as computed including OT in reconcile logic)
    a2 = scores['Away'].get('2H') if scores['Away'].get('2H') is not None else 'unknown'
    h2 = scores['Home'].get('2H') if scores['Home'].get('2H') is not None else 'unknown'
    try:
        t2 = (a2 + h2) if isinstance(a2, (int,float)) and isinstance(h2, (int,float)) else 'unknown'
    except:
        t2 = 'unknown'

    # Full game score
    fa = scores['Away'].get('Final') if scores['Away'].get('Final') is not None else 'unknown'
    fh = scores['Home'].get('Final') if scores['Home'].get('Final') is not None else 'unknown'

    # To Risk / To Win: prefer existing columns else compute from odds & base_bet
    tr_raw = row.get('To Risk $')
    tw_raw = row.get('To Win $')
    tr = parse_amount_token(tr_raw) if tr_raw not in (None, '', 'nan') else None
    tw = parse_amount_token(tw_raw) if tw_raw not in (None, '', 'nan') else None
    if tr is None or tw is None:
        computed_tr, computed_tw = compute_risk_win(odds, base_bet)
        if tr is None:
            tr = computed_tr
        if tw is None:
            tw = computed_tw

    pnl = row.get('PnL')
    try:
        pnl_val = float(pnl)
    except:
        pnl_val = 0.0

    out = {
        'DateTime (CST)': f"{row.get('Date')}, {row.get('Time (CST)')}",
        'League': row.get('League'),
        'Matchup': matchup,
        'Segment': segment,
        'Pick': row.get('Pick'),
        'Odds': odds,
        'Hit/Miss': result,
        '1H_Away': a1,
        '1H_Home': h1,
        '1H_Total': t1,
        '2H+OT_Away': a2,
        '2H+OT_Home': h2,
        '2H+OT_Total': t2,
        'Full_Away': fa,
        'Full_Home': fh,
        'To Risk': tr,
        'To Win': tw,
        'PnL': round(pnl_val,2)
    }
    return out


def run_for_date(date_str, input_csv=None, base_bet=50000):
    mod = load_reconcile_module()
    if not input_csv:
        input_csv = os.path.join(RECONCILED_DIR, f'pnl_tracker_{date_str}.csv')
    if not os.path.exists(input_csv):
        raise FileNotFoundError(f"Input CSV not found: {input_csv}")

    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    out_csv = os.path.join(ANALYSIS_DIR, f'telegram_analysis_{date_str}.csv')

    with open(input_csv, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)

    standardized = []
    for r in rows:
        standardized.append(format_row_standard(r, mod, base_bet))

    # Write CSV
    keys = ['DateTime (CST)','League','Matchup','Segment','Pick','Odds','Hit/Miss',
            '1H_Away','1H_Home','1H_Total','2H+OT_Away','2H+OT_Home','2H+OT_Total',
            'Full_Away','Full_Home','To Risk','To Win','PnL']
    with open(out_csv, 'w', newline='', encoding='utf-8') as of:
        writer = csv.DictWriter(of, fieldnames=keys)
        writer.writeheader()
        for r in standardized:
            writer.writerow(r)

    # Also print formatted lines
    for r in standardized:
        dt = r['DateTime (CST)']
        line = f"{dt} | {r['League']} | {r['Matchup']} | {r['Segment']} | {r['Pick']} | {r['Odds']} | {r['Hit/Miss']} | 1H: {r['1H_Away']},{r['1H_Home']} (Total: {r['1H_Total']}) | 2H+OT: {r['2H+OT_Away']},{r['2H+OT_Home']} (Total: {r['2H+OT_Total']}) | Full: {r['Full_Away']}-{r['Full_Home']} | ToRisk: {r['To Risk']} | ToWin: {r['To Win']} | PnL: {r['PnL']}"
        print(line)

    return out_csv


def cli():
    p = argparse.ArgumentParser()
    p.add_argument('--date', '-d', default=datetime.now().strftime('%Y-%m-%d'))
    p.add_argument('--input', '-i', help='Input reconciled CSV path (optional)')
    p.add_argument('--base', '-b', help='Base bet amount (e.g. 50000 or 25$)', default='50000')
    args = p.parse_args()
    base = parse_amount_token(args.base) or 50000
    out = run_for_date(args.date, args.input, base)
    print(f"Wrote analysis to {out}")


if __name__ == '__main__':
    cli()
