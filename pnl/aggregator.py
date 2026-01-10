import pandas as pd
from pathlib import Path
import json
from typing import Union


def compute_aggregates(input_csv: Union[str, Path]):
    p = Path(input_csv)
    df = pd.read_csv(p)
    if 'Hit/Miss' in df.columns:
        df['Hit/Miss'] = df['Hit/Miss'].astype(str).str.strip().str.lower()
    else:
        df['Hit/Miss'] = ''

    summary = df.groupby('League').agg({'Risk':'sum','PnL':'sum','Hit/Miss':lambda x: (x=='win').sum(),'Pick (Odds)':'count'})
    summary.columns=['Total Risk_k','Total PnL_k','Wins','Pick Count']
    summary['Win %'] = (summary['Wins']/summary['Pick Count']*100).round(1)
    summary['ROE %'] = (summary['Total PnL_k']/summary['Total Risk_k']*100).round(1)

    return summary


def write_outputs(summary: pd.DataFrame, out_dir: Union[str, Path]):
    outp = Path(out_dir)
    outp.mkdir(parents=True, exist_ok=True)
    csv_path = outp / 'aggregates_by_league.csv'
    json_path = outp / 'aggregates_by_league.json'

    # Save CSV (keep numeric columns readable)
    summary.to_csv(csv_path)

    # Save JSON (convert numeric types to native Python types)
    j = summary.reset_index().to_dict(orient='records')
    # ensure floats are plain
    def norm(v):
        if isinstance(v, (float,)):
            return float(v)
        return v
    j = [{k: norm(v) for k, v in rec.items()} for rec in j]
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(j, f, indent=2)

    return {'csv': str(csv_path), 'json': str(json_path)}


def aggregate_and_write(input_csv: Union[str, Path], out_dir: Union[str, Path] = 'data/derived'):
    summary = compute_aggregates(input_csv)
    paths = write_outputs(summary, out_dir)
    return summary, paths
