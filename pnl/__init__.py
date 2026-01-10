"""
PnL Tracker Package
===================
Track P&L from graded picks and generate Excel reports.

Modules:
- aggregator: Compute league-level aggregates
- box_scores: Load and match box scores from cache
- generate_tracker_excel: Generate full Excel tracker with all columns
- cli: Command-line interface
"""

__all__ = ["aggregator", "box_scores", "generate_tracker_excel", "cli"]
