"""Tests for CosmosPicksClient - calculate_season_metrics and query validation."""

import pytest


# Import only the non-DB-dependent parts
# (CosmosPicksClient.__init__ requires env vars, so we test static methods and logic)
def _make_client_class():
    """Import the class without instantiating (avoids needing Cosmos env vars)."""
    import importlib
    import sys
    import os

    # Add project root to path so `from lib.cosmos_client` works
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    from lib.cosmos_client import CosmosPicksClient
    return CosmosPicksClient


class TestCalculateSeasonMetrics:
    """Tests for calculate_season_metrics (pure logic, no DB calls)."""

    @pytest.fixture
    def client_cls(self):
        return _make_client_class()

    def test_empty_picks(self, client_cls):
        # calculate_season_metrics is an instance method but doesn't use self for DB
        # We call it on the class with a dummy self
        result = client_cls.calculate_season_metrics(None, [])
        assert result["picks_count"] == 0
        assert result["wins"] == 0
        assert result["losses"] == 0
        assert result["pushes"] == 0
        assert result["win_rate"] == 0.0
        assert result["total_pnl"] == 0.0
        assert result["roe"] == 0.0

    def test_basic_record(self, client_cls):
        picks = [
            {"result": "WIN", "risk": 100, "pnl": 90.91, "odds": -110},
            {"result": "WIN", "risk": 100, "pnl": 90.91, "odds": -110},
            {"result": "LOSS", "risk": 100, "pnl": -100, "odds": -110},
            {"result": "PUSH", "risk": 100, "pnl": 0, "odds": -110},
        ]
        result = client_cls.calculate_season_metrics(None, picks)
        assert result["picks_count"] == 4
        assert result["wins"] == 2
        assert result["losses"] == 1
        assert result["pushes"] == 1
        assert result["win_rate"] == 0.5
        assert result["total_risk"] == 400.0
        assert result["total_pnl"] == 81.82

    def test_roe_calculation(self, client_cls):
        picks = [
            {"result": "WIN", "risk": 200, "pnl": 181.82, "odds": -110},
            {"result": "LOSS", "risk": 100, "pnl": -100, "odds": -110},
        ]
        result = client_cls.calculate_season_metrics(None, picks)
        # ROE = (total_pnl / total_risk) * 100
        # (81.82 / 300) * 100 = 27.2733...
        assert result["roe"] == 27.2733

    def test_missing_fields_default_to_zero(self, client_cls):
        picks = [
            {"result": "WIN"},  # no risk, pnl, odds
            {"result": "LOSS"},
        ]
        result = client_cls.calculate_season_metrics(None, picks)
        assert result["picks_count"] == 2
        assert result["wins"] == 1
        assert result["losses"] == 1
        assert result["total_risk"] == 0.0
        assert result["total_pnl"] == 0.0


class TestAllowedFilterFields:
    """Tests for the SQL injection prevention allowlist."""

    @pytest.fixture
    def client_cls(self):
        return _make_client_class()

    def test_allowed_fields_exist(self, client_cls):
        assert "result" in client_cls.ALLOWED_FILTER_FIELDS
        assert "status" in client_cls.ALLOWED_FILTER_FIELDS
        assert "sport" in client_cls.ALLOWED_FILTER_FIELDS

    def test_dangerous_fields_blocked(self, client_cls):
        assert "'; DROP" not in client_cls.ALLOWED_FILTER_FIELDS
        assert "__proto__" not in client_cls.ALLOWED_FILTER_FIELDS
        assert "constructor" not in client_cls.ALLOWED_FILTER_FIELDS
