"""
SharePoint Integration Module
Handles uploading and updating tracker files in SharePoint.
"""

import os
from typing import Optional
from pathlib import Path
from office365.sharepoint.client_context import ClientContext
from office365.runtime.auth.authentication_context import AuthenticationContext

from .excel_exporter import ExcelExporter
from .pick_tracker import PickTracker


class SharePointIntegration:
    """Handles SharePoint integration for tracker files."""
    
    def __init__(self, site_url: str, username: str, password: str):
        """
        Initialize SharePoint integration.
        
        Args:
            site_url: SharePoint site URL
            username: SharePoint username
            password: SharePoint password
        """
        self.site_url = site_url
        self.username = username
        self.password = password
        self.ctx = None
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with SharePoint."""
        try:
            # Authenticate
            auth_ctx = AuthenticationContext(self.site_url)
            auth_ctx.acquire_token_for_user(self.username, self.password)
            
            # Create context
            self.ctx = ClientContext(self.site_url, auth_ctx)
        except Exception as e:
            print(f"SharePoint authentication error: {e}")
            raise
    
    def upload_file(self, local_file_path: str, sharepoint_folder_path: str,
                   file_name: Optional[str] = None):
        """
        Upload file to SharePoint.
        
        Args:
            local_file_path: Path to local file
            sharepoint_folder_path: Folder path in SharePoint (e.g., "Shared Documents/Trackers")
            file_name: Optional file name (defaults to local file name)
        """
        if not self.ctx:
            raise ValueError("Not authenticated with SharePoint")
        
        if file_name is None:
            file_name = Path(local_file_path).name
        
        try:
            # Get folder
            target_folder = self.ctx.web.get_folder_by_server_relative_url(
                sharepoint_folder_path
            )
            
            # Read file
            with open(local_file_path, 'rb') as f:
                file_content = f.read()
            
            # Upload file
            uploaded_file = target_folder.upload_file(file_name, file_content)
            self.ctx.execute_query()
            
            print(f"Successfully uploaded {file_name} to SharePoint")
            
        except Exception as e:
            print(f"Error uploading file to SharePoint: {e}")
            raise
    
    def download_file(self, sharepoint_file_path: str, local_file_path: str):
        """
        Download file from SharePoint.
        
        Args:
            sharepoint_file_path: Path to file in SharePoint
            local_file_path: Local path to save file
        """
        if not self.ctx:
            raise ValueError("Not authenticated with SharePoint")
        
        try:
            # Get file
            file = self.ctx.web.get_file_by_server_relative_url(sharepoint_file_path)
            self.ctx.load(file)
            self.ctx.execute_query()
            
            # Download file
            with open(local_file_path, 'wb') as f:
                file.download(f)
                self.ctx.execute_query()
            
            print(f"Successfully downloaded file from SharePoint to {local_file_path}")
            
        except Exception as e:
            print(f"Error downloading file from SharePoint: {e}")
            raise
    
    def upload_tracker(self, tracker: PickTracker, sharepoint_folder_path: str,
                      file_name: str = "betting_tracker.xlsx"):
        """
        Upload tracker to SharePoint.
        
        Args:
            tracker: PickTracker instance
            sharepoint_folder_path: Folder path in SharePoint
            file_name: Name for the Excel file
        """
        # Export to temporary file
        temp_file = Path("temp") / file_name
        temp_file.parent.mkdir(exist_ok=True)
        
        exporter = ExcelExporter()
        exporter.export_tracker_to_excel(tracker, str(temp_file))
        
        # Upload to SharePoint
        self.upload_file(str(temp_file), sharepoint_folder_path, file_name)
        
        # Clean up
        if temp_file.exists():
            temp_file.unlink()
