const axios = require("axios");
const { validateSharedKey } = require('../shared/auth');

/**
 * Teams Webhook Notification Function
 * POST /api/notify
 * 
 * Sends pick alerts to Microsoft Teams channel
 * 
 * Request body:
 * {
 *   "type": "new_pick" | "pick_result" | "model_status" | "alert",
 *   "data": { ... pick or status data ... }
 * }
 */
module.exports = async function (context, req) {
    context.log('Teams notification request received');

    if (req.method !== 'POST') {
        context.res = { status: 405, body: { error: 'Method not allowed' } };
        return;
    }

    const auth = validateSharedKey(req, context, { requireEnv: 'REQUIRE_NOTIFY_KEY' });
    if (!auth.ok) {
        context.res = { status: 401, body: { error: auth.reason } };
        return;
    }

    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
    
    if (!webhookUrl) {
        context.log.error('TEAMS_WEBHOOK_URL not configured');
        context.res = {
            status: 500,
            body: { error: 'Teams webhook not configured' }
        };
        return;
    }

    const { type, data } = req.body || {};

    if (!type || !data) {
        context.res = {
            status: 400,
            body: { error: 'Missing type or data' }
        };
        return;
    }

    try {
        let card;

        switch (type) {
            case 'new_pick':
                card = buildNewPickCard(data);
                break;
            case 'pick_result':
                card = buildResultCard(data);
                break;
            case 'model_status':
                card = buildModelStatusCard(data);
                break;
            case 'daily_summary':
                card = buildDailySummaryCard(data);
                break;
            case 'alert':
            default:
                card = buildAlertCard(data);
                break;
        }

        await axios.post(webhookUrl, card, {
            headers: { 'Content-Type': 'application/json' }
        });

        context.res = {
            status: 200,
            body: { success: true, message: 'Notification sent' }
        };

    } catch (error) {
        context.log.error('Teams notification error:', error);
        context.res = {
            status: 500,
            body: { error: 'Failed to send notification', details: error.message }
        };
    }
};

/**
 * Build Teams Adaptive Card for new pick
 */
function buildNewPickCard(pick) {
    const emoji = getLeagueEmoji(pick.league);
    const edgeColor = pick.edge >= 5 ? 'good' : pick.edge >= 3 ? 'warning' : 'default';
    
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": `New ${pick.league} Pick: ${pick.pick}`,
        "sections": [{
            "activityTitle": `${emoji} New ${pick.league} Pick`,
            "facts": [
                { "name": "Matchup", "value": `${pick.awayTeam} @ ${pick.homeTeam}` },
                { "name": "Pick", "value": pick.pick },
                { "name": "Odds", "value": pick.odds || 'N/A' },
                { "name": "Edge", "value": `${pick.edge}%` },
                { "name": "Game Time", "value": `${pick.gameDate} ${pick.gameTime}` }
            ],
            "markdown": true
        }],
        "potentialAction": [{
            "@type": "OpenUri",
            "name": "View Dashboard",
            "targets": [{ "os": "default", "uri": "https://www.greenbiersportventures.com/weekly-lineup" }]
        }]
    };
}

/**
 * Build Teams card for pick result
 */
function buildResultCard(result) {
    const emoji = result.outcome === 'win' ? '✅' : result.outcome === 'loss' ? '❌' : '➖';
    const color = result.outcome === 'win' ? '00FF00' : result.outcome === 'loss' ? 'FF0000' : 'FFFF00';
    
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": color,
        "summary": `${emoji} ${result.outcome.toUpperCase()}: ${result.pick}`,
        "sections": [{
            "activityTitle": `${emoji} Pick Result: ${result.outcome.toUpperCase()}`,
            "facts": [
                { "name": "Pick", "value": result.pick },
                { "name": "Final Score", "value": result.finalScore || 'N/A' },
                { "name": "P/L", "value": result.profitLoss || 'N/A' }
            ],
            "markdown": true
        }]
    };
}

/**
 * Build Teams card for model status
 */
function buildModelStatusCard(status) {
    const emoji = status.status === 'success' ? '✅' : status.status === 'error' ? '❌' : '⚙️';
    
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": status.status === 'success' ? '00FF00' : status.status === 'error' ? 'FF0000' : '0076D7',
        "summary": `${emoji} Model ${status.model}: ${status.status}`,
        "sections": [{
            "activityTitle": `${emoji} Model Status Update`,
            "facts": [
                { "name": "Model", "value": status.model },
                { "name": "Status", "value": status.status },
                { "name": "Message", "value": status.message || '' },
                { "name": "Picks Generated", "value": status.pickCount?.toString() || '0' }
            ],
            "markdown": true
        }]
    };
}

/**
 * Build daily summary card
 */
function buildDailySummaryCard(summary) {
    const winRate = summary.wins + summary.losses > 0 
        ? ((summary.wins / (summary.wins + summary.losses)) * 100).toFixed(1) 
        : 'N/A';
    
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": `📊 Daily Summary: ${summary.wins}W-${summary.losses}L`,
        "sections": [{
            "activityTitle": "📊 Daily Picks Summary",
            "facts": [
                { "name": "Date", "value": summary.date },
                { "name": "Record", "value": `${summary.wins}W - ${summary.losses}L - ${summary.pushes}P` },
                { "name": "Win Rate", "value": `${winRate}%` },
                { "name": "Net P/L", "value": summary.netPL || 'N/A' },
                { "name": "Best Pick", "value": summary.bestPick || 'N/A' }
            ],
            "markdown": true
        }],
        "potentialAction": [{
            "@type": "OpenUri",
            "name": "View Full Report",
            "targets": [{ "os": "default", "uri": "https://www.greenbiersportventures.com/" }]
        }]
    };
}

/**
 * Build generic alert card
 */
function buildAlertCard(data) {
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": data.color || "FFA500",
        "summary": data.title || "GBSV Alert",
        "sections": [{
            "activityTitle": data.title || "🔔 Alert",
            "text": data.message || JSON.stringify(data),
            "markdown": true
        }]
    };
}

/**
 * Get emoji for league
 */
function getLeagueEmoji(league) {
    const emojis = {
        'NBA': '🏀',
        'NCAAM': '🏀',
        'NCAAB': '🏀',
        'NFL': '🏈',
        'NCAAF': '🏈',
        'NHL': '🏒',
        'MLB': '⚾'
    };
    return emojis[league?.toUpperCase()] || '🎯';
}
