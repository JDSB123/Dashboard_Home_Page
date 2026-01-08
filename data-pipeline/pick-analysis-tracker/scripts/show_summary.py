"""
Show summary of ingested schedules and variants across all leagues.
"""

import sys
from pathlib import Path

script_dir = Path(__file__).parent
tracker_dir = script_dir.parent
sys.path.insert(0, str(tracker_dir))

from unified_ingestor import UnifiedIngestor

def main():
    ingestor = UnifiedIngestor()
    ingestor.print_status()

if __name__ == "__main__":
    main()
