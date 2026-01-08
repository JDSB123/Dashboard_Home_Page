#!/usr/bin/env python3
"""
Integration script to connect pick analysis tracker with dashboard
Uploads processed picks to Azure Storage for dashboard consumption
"""

import json
import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import pandas as pd
from azure.storage.blob import BlobServiceClient
from azure.data.tables import TableServiceClient
from azure.identity import DefaultAzureCredential
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DashboardIntegrator:
    """Integrates pick analysis with dashboard system"""
    
    def __init__(self, storage_connection: str, orchestrator_url: str = None):
        """
        Initialize the integrator
        
        Args:
            storage_connection: Azure Storage connection string
            orchestrator_url: Optional orchestrator API URL
        """
        self.storage_connection = storage_connection
        self.orchestrator_url = orchestrator_url
        
        # Initialize Azure clients
        self.blob_service = BlobServiceClient.from_connection_string(storage_connection)
        self.table_service = TableServiceClient.from_connection_string(storage_connection)
        
        # Containers and tables
        self.picks_container = "picks-data"
        self.analysis_container = "picks-analysis"
        self.picks_table = "pickshistory"
        
        self._ensure_resources_exist()
    
    def _ensure_resources_exist(self):
        """Ensure required containers and tables exist"""
        # Create blob containers
        for container_name in [self.picks_container, self.analysis_container]:
            try:
                container = self.blob_service.create_container(container_name)
                logger.info(f"Created container: {container_name}")
            except Exception as e:
                if "ContainerAlreadyExists" not in str(e):
                    logger.error(f"Error creating container {container_name}: {e}")
        
        # Create tables
        try:
            table_client = self.table_service.create_table_if_not_exists(self.picks_table)
            logger.info(f"Ensured table exists: {self.picks_table}")
        except Exception as e:
            logger.error(f"Error creating table {self.picks_table}: {e}")
    
    def upload_picks_json(self, picks_data: List[Dict], filename: str = None) -> str:
        """
        Upload picks data as JSON to blob storage
        
        Args:
            picks_data: List of pick dictionaries
            filename: Optional filename (defaults to timestamp)
            
        Returns:
            Blob URL
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"picks_{timestamp}.json"
        
        container_client = self.blob_service.get_container_client(self.picks_container)
        blob_client = container_client.get_blob_client(filename)
        
        # Upload JSON
        json_data = json.dumps(picks_data, indent=2, default=str)
        blob_client.upload_blob(json_data, overwrite=True)
        
        blob_url = blob_client.url
        logger.info(f"Uploaded picks JSON to: {blob_url}")
        
        return blob_url
    
    def upload_picks_csv(self, picks_df: pd.DataFrame, filename: str = None) -> str:
        """
        Upload picks data as CSV to blob storage
        
        Args:
            picks_df: Pandas DataFrame with picks
            filename: Optional filename (defaults to timestamp)
            
        Returns:
            Blob URL
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"picks_{timestamp}.csv"
        
        container_client = self.blob_service.get_container_client(self.picks_container)
        blob_client = container_client.get_blob_client(filename)
        
        # Convert to CSV
        csv_data = picks_df.to_csv(index=False)
        blob_client.upload_blob(csv_data, overwrite=True)
        
        blob_url = blob_client.url
        logger.info(f"Uploaded picks CSV to: {blob_url}")
        
        return blob_url
    
    def store_pick_in_table(self, pick: Dict) -> None:
        """
        Store individual pick in Azure Table Storage
        
        Args:
            pick: Pick dictionary
        """
        table_client = self.table_service.get_table_client(self.picks_table)
        
        # Create entity
        entity = {
            'PartitionKey': pick.get('league', 'unknown').lower(),
            'RowKey': pick.get('id', datetime.now().isoformat()),
            'Timestamp': datetime.now(),
            'game': pick.get('game', ''),
            'selection': pick.get('selection', ''),
            'odds': pick.get('odds', ''),
            'risk': float(pick.get('risk', 0)),
            'win': float(pick.get('win', 0)),
            'status': pick.get('status', 'pending'),
            'result': pick.get('result', ''),
            'pnl': float(pick.get('pnl', 0)),
            'source': pick.get('source', 'tracker'),
            'accepted': pick.get('accepted', datetime.now().isoformat()),
            'gameDate': pick.get('gameDate', ''),
            'gameTime': pick.get('gameTime', ''),
            'book': pick.get('book', 'manual')
        }
        
        # Store in table
        try:
            table_client.upsert_entity(entity)
            logger.debug(f"Stored pick in table: {entity['RowKey']}")
        except Exception as e:
            logger.error(f"Error storing pick: {e}")
    
    def upload_analysis_report(self, report_data: Dict, report_type: str = "daily") -> str:
        """
        Upload analysis report to blob storage
        
        Args:
            report_data: Report dictionary
            report_type: Type of report (daily, weekly, etc.)
            
        Returns:
            Blob URL
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"analysis_{report_type}_{timestamp}.json"
        
        container_client = self.blob_service.get_container_client(self.analysis_container)
        blob_client = container_client.get_blob_client(filename)
        
        # Upload report
        json_data = json.dumps(report_data, indent=2, default=str)
        blob_client.upload_blob(json_data, overwrite=True)
        
        blob_url = blob_client.url
        logger.info(f"Uploaded analysis report to: {blob_url}")
        
        return blob_url
    
    def notify_orchestrator(self, event_type: str, data: Dict) -> bool:
        """
        Notify orchestrator of new picks or analysis
        
        Args:
            event_type: Type of event (picks_uploaded, analysis_complete, etc.)
            data: Event data
            
        Returns:
            Success status
        """
        if not self.orchestrator_url:
            logger.warning("Orchestrator URL not configured, skipping notification")
            return False
        
        try:
            response = requests.post(
                f"{self.orchestrator_url}/api/events",
                json={
                    'eventType': event_type,
                    'timestamp': datetime.now().isoformat(),
                    'data': data
                },
                timeout=10
            )
            
            if response.ok:
                logger.info(f"Notified orchestrator of {event_type}")
                return True
            else:
                logger.error(f"Orchestrator notification failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error notifying orchestrator: {e}")
            return False
    
    def sync_with_models(self, league: str) -> List[Dict]:
        """
        Sync picks with model predictions
        
        Args:
            league: League to sync (nba, ncaam, nfl, ncaaf)
            
        Returns:
            List of enriched picks
        """
        if not self.orchestrator_url:
            logger.warning("Orchestrator URL not configured, cannot sync with models")
            return []
        
        try:
            # Get latest model predictions
            response = requests.get(
                f"{self.orchestrator_url}/api/predictions/{league}/latest",
                timeout=10
            )
            
            if response.ok:
                predictions = response.json()
                logger.info(f"Retrieved {len(predictions)} predictions for {league}")
                return predictions
            else:
                logger.error(f"Failed to get predictions: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error syncing with models: {e}")
            return []
    
    def process_and_upload_batch(self, input_file: str, output_format: str = "both") -> Dict:
        """
        Process a batch of picks and upload to dashboard
        
        Args:
            input_file: Path to input file (CSV/XLSX/JSON)
            output_format: Output format (json, csv, both)
            
        Returns:
            Upload results
        """
        # Load input file
        file_path = Path(input_file)
        if not file_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_file}")
        
        logger.info(f"Processing {input_file}")
        
        # Load data based on file type
        if file_path.suffix.lower() == '.csv':
            df = pd.read_csv(file_path)
        elif file_path.suffix.lower() in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        elif file_path.suffix.lower() == '.json':
            with open(file_path, 'r') as f:
                data = json.load(f)
            df = pd.DataFrame(data)
        else:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")
        
        logger.info(f"Loaded {len(df)} picks from {input_file}")
        
        # Convert to list of dicts
        picks_data = df.to_dict('records')
        
        # Process each pick
        processed_picks = []
        for pick in picks_data:
            # Add metadata
            pick['uploadedAt'] = datetime.now().isoformat()
            pick['source'] = 'tracker'
            
            # Store in table
            self.store_pick_in_table(pick)
            
            processed_picks.append(pick)
        
        # Upload to blob storage
        results = {}
        
        if output_format in ['json', 'both']:
            json_url = self.upload_picks_json(processed_picks)
            results['json_url'] = json_url
        
        if output_format in ['csv', 'both']:
            csv_url = self.upload_picks_csv(df)
            results['csv_url'] = csv_url
        
        # Generate analysis report
        analysis_report = self.generate_analysis_report(processed_picks)
        report_url = self.upload_analysis_report(analysis_report)
        results['report_url'] = report_url
        
        # Notify orchestrator
        self.notify_orchestrator('picks_uploaded', {
            'count': len(processed_picks),
            'urls': results
        })
        
        logger.info(f"Successfully processed and uploaded {len(processed_picks)} picks")
        return results
    
    def generate_analysis_report(self, picks: List[Dict]) -> Dict:
        """
        Generate analysis report from picks
        
        Args:
            picks: List of pick dictionaries
            
        Returns:
            Analysis report
        """
        df = pd.DataFrame(picks)
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_picks': len(picks),
            'date_range': {
                'start': df['gameDate'].min() if 'gameDate' in df else None,
                'end': df['gameDate'].max() if 'gameDate' in df else None
            },
            'by_league': {},
            'by_status': {},
            'performance': {},
            'risk_metrics': {}
        }
        
        # Analysis by league
        if 'league' in df:
            for league in df['league'].unique():
                league_df = df[df['league'] == league]
                report['by_league'][league] = {
                    'count': len(league_df),
                    'win_rate': (league_df['status'] == 'win').mean() if 'status' in league_df else 0,
                    'total_risk': league_df['risk'].sum() if 'risk' in league_df else 0,
                    'total_pnl': league_df['pnl'].sum() if 'pnl' in league_df else 0
                }
        
        # Analysis by status
        if 'status' in df:
            status_counts = df['status'].value_counts().to_dict()
            report['by_status'] = status_counts
        
        # Performance metrics
        if 'pnl' in df:
            report['performance'] = {
                'total_pnl': float(df['pnl'].sum()),
                'avg_pnl': float(df['pnl'].mean()),
                'best_pick': float(df['pnl'].max()),
                'worst_pick': float(df['pnl'].min()),
                'roi': float(df['pnl'].sum() / df['risk'].sum() * 100) if df['risk'].sum() > 0 else 0
            }
        
        # Risk metrics
        if 'risk' in df:
            report['risk_metrics'] = {
                'total_risk': float(df['risk'].sum()),
                'avg_risk': float(df['risk'].mean()),
                'max_risk': float(df['risk'].max()),
                'risk_distribution': df['risk'].describe().to_dict()
            }
        
        return report


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(description='Integrate pick analysis with dashboard')
    parser.add_argument('--storage-connection', required=True, help='Azure Storage connection string')
    parser.add_argument('--orchestrator-url', help='Orchestrator API URL')
    parser.add_argument('--input-file', help='Input file to process')
    parser.add_argument('--output-format', default='both', choices=['json', 'csv', 'both'],
                       help='Output format')
    parser.add_argument('--sync-models', action='store_true', help='Sync with model predictions')
    parser.add_argument('--league', help='League to sync (if --sync-models)')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize integrator
    integrator = DashboardIntegrator(
        storage_connection=args.storage_connection,
        orchestrator_url=args.orchestrator_url
    )
    
    # Process input file if provided
    if args.input_file:
        results = integrator.process_and_upload_batch(
            input_file=args.input_file,
            output_format=args.output_format
        )
        print(f"Upload complete:")
        for key, url in results.items():
            print(f"  {key}: {url}")
    
    # Sync with models if requested
    if args.sync_models and args.league:
        predictions = integrator.sync_with_models(args.league)
        print(f"Synced {len(predictions)} predictions for {args.league}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())