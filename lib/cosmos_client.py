"""
Azure Cosmos DB interface for picks archival and metrics tracking

Usage:
    from lib.cosmos_client import CosmosPicksClient

    client = CosmosPicksClient()

    # Insert a pick
    client.insert_pick({
        "id": "nba-2025-12-28-lakers-vs-celtics",
        "league": "NBA",
        "date": "2025-12-28",
        "matchup": "Lakers vs Celtics",
        "pick": "Lakers -3.5",
        "odds": -110,
        "risk": 100,
        "to_win": 90.91,
        "result": "WIN",
        "pnl": 90.91,
        "segment": "1H",
        "model": "gbsv-nbav3-aca v3.0"
    })

    # Query picks
    picks = client.query_picks(league="NBA", season=2025)

    # Upsert metrics
    client.upsert_metrics({
        "id": "nba-2025-season",
        "league": "NBA",
        "season": 2025,
        "picks_count": 127,
        "wins": 71,
        "losses": 56,
        "win_rate": 0.559,
        "total_risk": 12700,
        "total_pnl": 1205.50,
        "roe": 0.0948
    })
"""

import os
from azure.cosmos import CosmosClient, PartitionKey, exceptions
from typing import Dict, List, Optional
from datetime import datetime


class CosmosPicksClient:
    """Client for Cosmos DB picks collection"""

    def __init__(self):
        self.endpoint = os.getenv(
            "COSMOS_ENDPOINT", "https://gbsv-picks-db.documents.azure.com:443/"
        )
        self.key = os.getenv("COSMOS_KEY")
        self.database_name = "picks-db"
        self.picks_container = "picks"
        self.metrics_container = "metrics"

        if not self.key:
            raise ValueError("COSMOS_KEY environment variable not set")

        self.client = CosmosClient(self.endpoint, self.key)
        self.database = self.client.get_database_client(self.database_name)

    def insert_pick(self, pick_doc: Dict) -> Dict:
        """Insert a single pick into the picks collection"""
        try:
            picks_container = self.database.get_container_client(self.picks_container)

            # Ensure required fields
            if "id" not in pick_doc:
                raise ValueError("Pick document must have an 'id' field")
            if "league" not in pick_doc:
                raise ValueError("Pick document must have a 'league' field (partition key)")

            # Add timestamp if not present
            if "timestamp" not in pick_doc:
                pick_doc["timestamp"] = datetime.utcnow().isoformat()

            result = picks_container.create_item(body=pick_doc)
            return result
        except exceptions.CosmosResourceExistsError:
            print(f"Pick {pick_doc.get('id')} already exists")
            return pick_doc
        except Exception as e:
            print(f"Error inserting pick: {e}")
            raise

    def insert_picks_batch(self, picks: List[Dict]) -> int:
        """Batch insert multiple picks"""
        picks_container = self.database.get_container_client(self.picks_container)
        inserted = 0

        for pick in picks:
            try:
                self.insert_pick(pick)
                inserted += 1
            except Exception as e:
                print(f"Failed to insert pick {pick.get('id')}: {e}")
                continue

        return inserted

    def query_picks(self, league: str, season: Optional[int] = None, **filters) -> List[Dict]:
        """Query picks with filters"""
        picks_container = self.database.get_container_client(self.picks_container)

        # Build WHERE clause
        where_clauses = [f"p.league = '{league}'"]

        if season:
            where_clauses.append(f"p.season = {season}")

        for key, value in filters.items():
            if isinstance(value, str):
                where_clauses.append(f"p.{key} = '{value}'")
            else:
                where_clauses.append(f"p.{key} = {value}")

        where_str = " AND ".join(where_clauses)
        query = f"SELECT * FROM c p WHERE {where_str} ORDER BY p.date DESC"

        results = list(
            picks_container.query_items(query=query, parameters=[], partition_key=league)
        )

        return results

    def upsert_metrics(self, metrics_doc: Dict) -> Dict:
        """Insert or update metrics document"""
        try:
            metrics_container = self.database.get_container_client(self.metrics_container)

            # Ensure required fields
            if "id" not in metrics_doc:
                raise ValueError("Metrics document must have an 'id' field")
            if "league" not in metrics_doc:
                raise ValueError("Metrics document must have a 'league' field (partition key)")

            # Add/update timestamp
            metrics_doc["timestamp"] = datetime.utcnow().isoformat()

            result = metrics_container.upsert_item(body=metrics_doc)
            return result
        except Exception as e:
            print(f"Error upserting metrics: {e}")
            raise

    def get_metrics(self, league: str, season: Optional[int] = None) -> Optional[Dict]:
        """Get metrics for a league/season"""
        metrics_container = self.database.get_container_client(self.metrics_container)

        if season:
            query = f"SELECT * FROM c WHERE c.league = '{league}' AND c.season = {season}"
        else:
            query = f"SELECT * FROM c WHERE c.league = '{league}' ORDER BY c.timestamp DESC LIMIT 1"

        results = list(
            metrics_container.query_items(query=query, parameters=[], partition_key=league)
        )

        return results[0] if results else None

    def calculate_season_metrics(self, picks: List[Dict]) -> Dict:
        """Calculate metrics from a list of picks"""
        if not picks:
            return {
                "picks_count": 0,
                "wins": 0,
                "losses": 0,
                "pushes": 0,
                "win_rate": 0.0,
                "total_risk": 0.0,
                "total_pnl": 0.0,
                "roe": 0.0,
                "avg_odds": 0.0,
            }

        wins = sum(1 for p in picks if p.get("result") == "WIN")
        losses = sum(1 for p in picks if p.get("result") == "LOSS")
        pushes = sum(1 for p in picks if p.get("result") == "PUSH")
        total_risk = sum(float(p.get("risk", 0)) for p in picks)
        total_pnl = sum(float(p.get("pnl", 0)) for p in picks)
        avg_odds = sum(float(p.get("odds", 0)) for p in picks) / len(picks) if picks else 0

        roe = (total_pnl / total_risk * 100) if total_risk > 0 else 0
        win_rate = (wins / len(picks)) if picks else 0

        return {
            "picks_count": len(picks),
            "wins": wins,
            "losses": losses,
            "pushes": pushes,
            "win_rate": round(win_rate, 4),
            "total_risk": round(total_risk, 2),
            "total_pnl": round(total_pnl, 2),
            "roe": round(roe, 4),
            "avg_odds": round(avg_odds, 2),
        }


if __name__ == "__main__":
    # Test connection
    client = CosmosPicksClient()
    print(f"✓ Connected to {client.endpoint}")
    print(f"✓ Database: {client.database_name}")
    print(f"✓ Picks container: {client.picks_container}")
    print(f"✓ Metrics container: {client.metrics_container}")
