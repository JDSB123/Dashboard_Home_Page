# Data Model

## Raw ingest record (per source row or message)
- sourceType: file|text|image
- sourcePath: location or message id
- sourceTimestamp: when received (optional)
- body: original text/value for audit
- parsedFields: loose fields detected (date string, league guess, matchup text, segment text, pick text, odds text, stake text)

## Normalized pick record
- id: stable hash of date + league + matchup + segment + pick + odds
- league: nfl|ncaaf|nba|ncaam|other
- matchup: { awayNameRaw, homeNameRaw, inferredDateCST, inferredTimeCST }
- teams: { awayCode, homeCode, awayDisplay, homeDisplay }
- segment: fg|1h|2h|1q|2q|3q|4q|ot|prop
- pick: { side: away|home|total|prop, market: spread|moneyline|total|team-total|prop, line: number|null, oddsAmerican: int, pickTextRaw }
- stake: { risk: number, toWin: number, baseRuleApplied: bool, overrideNote: string|null }
- metadata: { sourceType, sourcePath, notes }

## Resolved game record
- schedule: { kickoffCST, venue, season, week, status }
- teams: { away: { code, record, score }, home: { code, record, score } }
- closingOdds: { away, home, total, spread }
- result: { hitMiss: win|loss|push|unknown, pnl: number, gradedAt: datetime }
- trace: { datasource: sportsdataio|oddsapi|espn|web, diagnostics: string }

## Tracker row (output for dashboard)
- dateCST, timeCST
- league
- matchupLabel: "Away @ Home" with records
- segment
- pickLabel: cleaned pick text with odds
- risk, toWin
- boxScore: scores + key stats
- hitMiss
- pnl
- resolutionSource: which datasource graded it
- issues: list of unresolved fields or conflicts
