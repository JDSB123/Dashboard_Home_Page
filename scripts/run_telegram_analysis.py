import os
import csv
import argparse
from datetime import datetime
from team_variant_lookup import TeamVariantLookup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECONCILED_DIR = os.path.join(ROOT, 'output', 'reconciled')
ANALYSIS_DIR = os.path.join(ROOT, 'output', 'analysis')
CONSOLIDATED_CSV = os.path.join(ROOT, 'data-pipeline', 'consolidated_historical_data.csv')


# Initialize team variant lookup (singleton)
_team_lookup = None

def get_team_lookup():
    global _team_lookup
    if _team_lookup is None:
        _team_lookup = TeamVariantLookup()
    return _team_lookup


def normalize_team_name(team_str, league):
    """
    Normalize team shorthand/variants to proper abbreviation.
    Examples: 'raiders' -> 'LV', 'Lakers' -> 'LAL', 'Duke' -> 'DUKE'
    """
    if not team_str:
        return team_str
    
    lookup = get_team_lookup()
    team_str = team_str.strip()
    
    # Try to find team in appropriate league
    try:
        if league == 'NFL':
            result = lookup.find_nfl_team(team_str)
            if result:
                return result['key']  # Return canonical abbreviation
        elif league == 'NBA':
            result = lookup.find_nba_team(team_str)
            if result:
                return result['key']
        elif league == 'NCAAM':
            result = lookup.find_ncaam_team(team_str)
            if result:
                return result['key']
        elif league == 'NCAAF':
            # Try CFB if available, else fallback to NCAAM
            result = lookup.find_ncaam_team(team_str)  # TODO: add find_cfb_team if needed
            if result:
                return result['key']
    except Exception as e:
        print(f"Warning: Team lookup error for '{team_str}' in {league}: {e}")
    
    # Return original if not found
    return team_str


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


def validate_pick_timing(segment, ticket_placed_date, ticket_placed_time, game_datetime_cst):
    """
    Validate if pick timing makes logical sense.
    Returns: 'OK', 'WARNING', or specific issue description.
    """
    if game_datetime_cst == 'unknown':
        return 'WARN: Game time unknown'
    
    try:
        from datetime import datetime
        # Parse game datetime
        if 'T' in str(game_datetime_cst):
            game_dt = datetime.fromisoformat(str(game_datetime_cst).replace('Z', ''))
        else:
            game_dt = datetime.strptime(str(game_datetime_cst), '%Y-%m-%d %H:%M:%S %Z')
        
        # Parse ticket placed datetime
        ticket_dt_str = f"{ticket_placed_date} {ticket_placed_time}"
        try:
            ticket_dt = datetime.strptime(ticket_dt_str, '%Y-%m-%d %I:%M %p')
        except:
            try:
                ticket_dt = datetime.strptime(ticket_dt_str, '%Y-%m-%d %H:%M:%S')
            except:
                return 'WARN: Ticket time format unknown'
        
        # Validation logic
        time_diff_minutes = (ticket_dt - game_dt).total_seconds() / 60
        
        # 2H picks must be placed after game starts (at least after 1H ends, ~60min into game)
        if segment and '2H' in str(segment).upper():
            if time_diff_minutes < 60:  # Placed before game or during 1H
                return f'ERROR: 2H pick placed {abs(time_diff_minutes):.0f}min before 1H ends'
        
        # 1H picks placed after game starts are suspicious
        if segment and '1H' in str(segment).upper():
            if time_diff_minutes > 10:  # Placed more than 10min after game start
                return f'WARN: 1H pick placed {time_diff_minutes:.0f}min after kickoff'
        
        # FG picks placed after game ends
        if segment and 'FG' in str(segment).upper():
            if time_diff_minutes > 180:  # Placed more than 3 hours after start (most games done)
                return f'WARN: FG pick placed {time_diff_minutes:.0f}min after kickoff'
        
        return 'OK'
    
    except Exception as e:
        return f'WARN: Validation error - {str(e)}'


def validate_pick_timing(segment, ticket_placed_date, ticket_placed_time, game_datetime_cst):
    """
    Validate if pick timing makes logical sense.
    Returns: 'OK', 'WARNING', or specific issue description.
    """
    if game_datetime_cst == 'unknown':
        return 'OK (Game time unknown)'
    
    try:
        from datetime import datetime
        # Parse game datetime - handle "2026-01-04 15:25:00 CST" format
        game_dt_str = str(game_datetime_cst)
        # Remove timezone suffix (CST, CDT, etc.)
        for tz in [' CST', ' CDT', ' EST', ' EDT', ' PST', ' PDT', ' MST', ' MDT']:
            game_dt_str = game_dt_str.replace(tz, '')
        game_dt = datetime.strptime(game_dt_str.strip(), '%Y-%m-%d %H:%M:%S')
        
        # Parse ticket placed datetime
        ticket_dt_str = f"{ticket_placed_date} {ticket_placed_time}"
        try:
            ticket_dt = datetime.strptime(ticket_dt_str, '%Y-%m-%d %I:%M %p')
        except:
            try:
                ticket_dt = datetime.strptime(ticket_dt_str, '%Y-%m-%d %H:%M:%S')
            except:
                return 'OK (Ticket time format unknown)'
        
        # Validation logic
        time_diff_minutes = (ticket_dt - game_dt).total_seconds() / 60
        
        # 2H picks must be placed after game starts (at least after 1H ends, ~60min into game)
        if segment and '2H' in str(segment).upper():
            if time_diff_minutes < 60:  # Placed before game or during 1H
                return f'ERROR: 2H pick placed {abs(time_diff_minutes):.0f}min before 1H ends'
        
        # 1H picks placed after game starts are suspicious
        if segment and '1H' in str(segment).upper():
            if time_diff_minutes > 10:  # Placed more than 10min after game start
                return f'WARN: 1H pick placed {time_diff_minutes:.0f}min after kickoff'
        
        # FG picks placed after game ends
        if segment and 'FG' in str(segment).upper():
            if time_diff_minutes > 180:  # Placed more than 3 hours after start (most games done)
                return f'WARN: FG pick placed {time_diff_minutes:.0f}min after kickoff'
        
        return 'OK'
    
    except Exception as e:
        return f'OK (Validation error: {str(e)[:30]})'


def format_row_standard(row, mod, base_bet):
    # row is a dict from reconcile CSV
    # Use mod.load_data() helpers to compute scores
    game_map = mod.load_data()
    matchup = row.get('Match-Up (Away vs Home)') or row.get('Match-Up (Away vs Home)')
    league = row.get('League')
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

    # Find game - normalize team names using variant lookup
    away_abbr = home_abbr = ''
    if matchup and '@' in matchup:
        away_raw, home_raw = [x.strip() for x in matchup.split('@')]
        # Normalize using team variant lookup
        away_abbr = normalize_team_name(away_raw, league)
        home_abbr = normalize_team_name(home_raw, league)

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

    # Format scores as single-cell strings
    h1_score = f"{a1}-{h1} (Total: {t1})" if isinstance(a1, (int,float)) and isinstance(h1, (int,float)) else "unknown"
    h2_score = f"{a2}-{h2} (Total: {t2})" if isinstance(a2, (int,float)) and isinstance(h2, (int,float)) else "unknown"
    full_score = f"{fa}-{fh}" if isinstance(fa, (int,float)) and isinstance(fh, (int,float)) else "unknown"

    # Extract game datetime from consolidated data
    game_datetime_cst = 'unknown'
    if game:
        game_datetime_cst = game.get('game_datetime_cst') or 'unknown'

    # Ticket placed time (from reconciled CSV or default to same as Date/Time)
    ticket_placed_date = row.get('Ticket Placed Date') or row.get('Date')
    ticket_placed_time = row.get('Ticket Placed Time') or row.get('Time (CST)')

    # Validation: Check if pick timing makes sense
    validation_flag = validate_pick_timing(segment, ticket_placed_date, ticket_placed_time, game_datetime_cst)

    out = {
        'Date': row.get('Date'),
        'Time (CST)': row.get('Time (CST)'),
        'Game DateTime (CST)': game_datetime_cst,
        'Ticket Placed Date': ticket_placed_date,
        'Ticket Placed Time': ticket_placed_time,
        'League': row.get('League'),
        'Matchup': matchup,
        'Segment': segment,
        'Pick': row.get('Pick'),
        'Odds': odds,
        'Hit/Miss': result,
        '1H Score': h1_score,
        '2H+OT Score': h2_score,
        'Full Score': full_score,
        'To Risk': tr,
        'To Win': tw,
        'PnL': round(pnl_val,2),
        'Validation': validation_flag
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
    keys = ['Date','Time (CST)','Game DateTime (CST)','Ticket Placed Date','Ticket Placed Time',
            'League','Matchup','Segment','Pick','Odds','Hit/Miss',
            '1H Score','2H+OT Score','Full Score','To Risk','To Win','PnL','Validation']
    with open(out_csv, 'w', newline='', encoding='utf-8') as of:
        writer = csv.DictWriter(of, fieldnames=keys)
        writer.writeheader()
        for r in standardized:
            writer.writerow(r)

    # Also print formatted lines
    for r in standardized:
        dt = f"{r['Date']}, {r['Time (CST)']}"
        line = f"{dt} | {r['League']} | {r['Matchup']} | {r['Segment']} | {r['Pick']} | {r['Odds']} | {r['Hit/Miss']} | 1H: {r['1H Score']} | 2H+OT: {r['2H+OT Score']} | Full: {r['Full Score']} | ToRisk: {r['To Risk']} | ToWin: {r['To Win']} | PnL: {r['PnL']}"
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
