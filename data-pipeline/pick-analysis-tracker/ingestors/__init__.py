"""
Unified Sports Data Ingestors
Each league has its own ingestion module, all feeding into cached schedules.
"""

from .base import BaseIngestor
from .nfl import NFLIngestor
from .ncaaf import NCAAFIngestor
from .nba import NBAIngestor
from .ncaam import NCAAMIngestor

__all__ = [
    'BaseIngestor',
    'NFLIngestor', 
    'NCAAFIngestor',
    'NBAIngestor',
    'NCAAMIngestor'
]
