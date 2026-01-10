def main():
    print("Loading missing picks...")
    df = pd.read_csv(INPUT_FILE)
    print(f"  {len(df)} picks to grade")

    # Get unique dates
    dates = df['Date'].unique()
    print(f"  Dates: {min(dates)} to {max(dates)}")

    # Load master schedule (Source of Truth)
    print("\nLoading master schedule...")
    if not MASTER_SCHEDULE.exists():
        print(f"ERROR: Master schedule not found at {MASTER_SCHEDULE}")
        return

    master_df = pd.read_csv(MASTER_SCHEDULE)
    print(f"  Loaded {len(master_df)} games from master schedule")
    
    # helper to normalize identifying info
    all_games = {}
    
    print("Indexing games...")
    for idx, row in master_df.iterrows():
        g_date = str(row['date'])
        
        # Populate game dict
        # Ensure keys match what grade_pick expects
        g = {
            'home_team': str(row['home_team_full']) if pd.notna(row.get('home_team_full')) else str(row['home_team']),
            'away_team': str(row['away_team_full']) if pd.notna(row.get('away_team_full')) else str(row['away_team']),
            'home_score': float(row['home_score']) if pd.notna(row['home_score']) else 0,
            'away_score': float(row['away_score']) if pd.notna(row['away_score']) else 0,
            'league': row['league']
        }
        
        # Keys for lookup
        home_norm = normalize_team(g['home_team'])
        away_norm = normalize_team(g['away_team'])
        
        # Key 1: League_Date_Home_Away
        k1 = f"{row['league']}_{g_date}_{home_norm}_{away_norm}"
        all_games[k1] = g
        
        # Key 2: Date_Home_Away (league might be missing/wrong in picks)
        k2 = f"ANY_{g_date}_{home_norm}_{away_norm}"
        all_games[k2] = g

    print(f"  Indexed {len(all_games)} lookup keys")

    # Grade each pick
    print("\nGrading picks...")
    results = []
    graded = 0
    ungraded = 0

    for idx, row in df.iterrows():
        date = row['Date']
        team = normalize_team(row['Matchup'])
        league = row['League']

        # Find matching game
        matching_game = None
        
        # Try exact date match first
        for key, game in all_games.items():
            if f"_{date}_" in key:
                if league != 'UNKNOWN' and league not in key and "ANY" not in key:
                    continue
                    
                home = normalize_team(game.get('home_team', ''))
                away = normalize_team(game.get('away_team', ''))
                if team in home or team in away:
                    matching_game = game
                    break
        
        # If no match, try +/- 1 day (common common sense rule)
        if not matching_game:
            try:
                dt = datetime.strptime(date, "%Y-%m-%d")
                dates_to_check = [
                    (dt - timedelta(days=1)).strftime("%Y-%m-%d"),
                    (dt + timedelta(days=1)).strftime("%Y-%m-%d")
                ]
                for d in dates_to_check:
                    for key, game in all_games.items():
                        if f"_{d}_" in key:
                            if league != 'UNKNOWN' and league not in key and "ANY" not in key:
                                continue
                            home = normalize_team(game.get('home_team', ''))
                            away = normalize_team(game.get('away_team', ''))
                            if team in home or team in away:
                                matching_game = game
                                break
                    if matching_game: break
            except:
                pass

        if matching_game:
            result, pnl = grade_pick(row, matching_game)
            if result:
                row['Hit/Miss'] = result
                row['PnL'] = pnl
                graded += 1
            else:
                row['Hit/Miss'] = ''
                row['PnL'] = 0
                ungraded += 1
        else:
            row['Hit/Miss'] = ''
            row['PnL'] = 0
            ungraded += 1

        results.append(row)

    print(f"  Graded: {graded}")
    print(f"  Ungraded: {ungraded}")

    # Save results
    result_df = pd.DataFrame(results)
    result_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved to {OUTPUT_FILE}")

    # Summary
    wins = len(result_df[result_df['Hit/Miss'] == 'win'])
    losses = len(result_df[result_df['Hit/Miss'] == 'loss'])
    pushes = len(result_df[result_df['Hit/Miss'] == 'push'])

    print("\n" + "=" * 50)
    print("GRADING SUMMARY FOR MISSING PICKS")
    print("=" * 50)
    print(f"Record: {wins}W - {losses}L - {pushes}P")
    print(f"Total Risk: ${result_df['Risk'].sum():,.2f}")
    print(f"Total PnL: ${result_df['PnL'].sum():,.2f}")

    return result_df
