"""Simple CLI for the `pnl` aggregator."""

import argparse
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Enable running as script from repo root
repo_root = Path(__file__).parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
from pnl.aggregator import aggregate_and_write


def main():
    p = argparse.ArgumentParser(description='Compute PnL aggregates and write outputs')
    p.add_argument('--input', '-i', default='output/graded/picks_dec28_jan6_fully_graded_corrected.csv')
    p.add_argument('--out', '-o', default='data/derived')
    args = p.parse_args()
    summary, paths = aggregate_and_write(args.input, args.out)
    logger.info(f'Wrote: {paths}')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    main()
