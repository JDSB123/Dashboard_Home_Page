#!/usr/bin/env python3
"""
Telegram Notifier - Send box score notifications to Telegram

Configuration via environment variables:
    TELEGRAM_BOT_TOKEN: Bot token from @BotFather
    TELEGRAM_CHAT_ID: Chat ID to send messages to

Usage:
    from telegram_notifier import TelegramNotifier
    
    notifier = TelegramNotifier()
    notifier.send_score_notification(results, date)
    notifier.send_text(message)
"""

import os
import json
import logging
from typing import Dict, Optional
from datetime import datetime
import requests

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Send notifications to Telegram"""
    
    def __init__(self, bot_token: str = None, chat_id: str = None):
        self.bot_token = bot_token or os.environ.get("TELEGRAM_BOT_TOKEN")
        self.chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID")
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        self.enabled = bool(self.bot_token and self.chat_id)
        
        if not self.enabled:
            logger.warning("Telegram notifier not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
    
    def send_text(self, text: str) -> bool:
        """Send plain text message"""
        if not self.enabled:
            logger.debug("Telegram disabled, skipping notification")
            return False
        
        try:
            response = requests.post(
                f"{self.base_url}/sendMessage",
                json={
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": "HTML"
                },
                timeout=10
            )
            
            if response.ok:
                logger.info("Telegram message sent successfully")
                return True
            else:
                logger.error(f"Telegram API error: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")
            return False
    
    def send_score_notification(self, results: Dict, date: str) -> bool:
        """Send formatted score notification"""
        message = self._format_message(results, date)
        return self.send_text(message)
    
    def _format_message(self, results: Dict, date: str) -> str:
        """Format results into Telegram message"""
        lines = [
            "📊 <b>BOX SCORES AVAILABLE</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            ""
        ]
        
        # Format each sport
        for sport in ["NBA", "NCAAM", "NFL", "NCAAF"]:
            stats = results.get(sport, {})
            
            if "error" in stats:
                lines.append(f"🏀 <b>{sport}</b> - ❌ {stats['error']}")
            else:
                completed = stats.get("completed", 0)
                if completed > 0:
                    emoji = "🏀" if sport in ["NBA", "NCAAM"] else "🏈"
                    lines.append(f"{emoji} <b>{sport}</b> ({date})")
                    lines.append(f"   ✓ {completed} completed")
                else:
                    emoji = "🏀" if sport in ["NBA", "NCAAM"] else "🏈"
                    lines.append(f"{emoji} <b>{sport}</b> - No completed games")
            
            lines.append("")
        
        # Add footer
        lines.extend([
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"⏱️  Fetched: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            "📍 Data: ESPN/SportsDataIO"
        ])
        
        return "\n".join(lines)
    
    def send_error_notification(self, sport: str, error: str) -> bool:
        """Send error notification"""
        message = (
            "⚠️ <b>BOX SCORE FETCH ERROR</b>\n"
            f"Sport: {sport}\n"
            f"Error: {error}\n"
            f"Time: {datetime.utcnow().isoformat()}"
        )
        return self.send_text(message)


class TelegramStatusMonitor:
    """Monitor and report fetch status"""
    
    def __init__(self, notifier: TelegramNotifier = None):
        self.notifier = notifier or TelegramNotifier()
        self.errors = []
        self.warnings = []
    
    def add_error(self, sport: str, error: str) -> None:
        """Record an error"""
        self.errors.append({"sport": sport, "error": error, "time": datetime.utcnow().isoformat()})
    
    def add_warning(self, message: str) -> None:
        """Record a warning"""
        self.warnings.append({"message": message, "time": datetime.utcnow().isoformat()})
    
    def send_report(self, results: Dict, date: str) -> bool:
        """Send full status report"""
        if not self.notifier.enabled:
            return False
        
        lines = [
            "📋 <b>BOX SCORE FETCH REPORT</b>",
            f"Date: {date}",
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            ""
        ]
        
        # Results
        lines.append("<b>Results:</b>")
        for sport, stats in results.items():
            if "error" in stats:
                lines.append(f"  {sport}: ❌ {stats['error']}")
            else:
                total = stats.get("total", 0)
                completed = stats.get("completed", 0)
                lines.append(f"  {sport}: {completed}/{total} completed")
        
        lines.append("")
        
        # Warnings
        if self.warnings:
            lines.append(f"<b>⚠️  Warnings ({len(self.warnings)}):</b>")
            for w in self.warnings:
                lines.append(f"  • {w['message']}")
            lines.append("")
        
        # Errors
        if self.errors:
            lines.append(f"<b>❌ Errors ({len(self.errors)}):</b>")
            for e in self.errors:
                lines.append(f"  • {e['sport']}: {e['error']}")
            lines.append("")
        
        # Footer
        lines.extend([
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"Report time: {datetime.utcnow().isoformat()}"
        ])
        
        message = "\n".join(lines)
        return self.notifier.send_text(message)


# Example usage for testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Test notifier
    notifier = TelegramNotifier()
    
    if notifier.enabled:
        # Send test message
        test_message = (
            "🧪 <b>Box Score Fetcher - Test Message</b>\n"
            f"Sent: {datetime.utcnow().isoformat()}\n"
            "Configuration is working!"
        )
        notifier.send_text(test_message)
    else:
        print("Telegram notifier not configured.")
        print("Set these environment variables:")
        print("  TELEGRAM_BOT_TOKEN=your_token")
        print("  TELEGRAM_CHAT_ID=your_chat_id")
