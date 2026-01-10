"""
Command-line script for ingesting picks into the tracker.
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.main import main

if __name__ == '__main__':
    main()
