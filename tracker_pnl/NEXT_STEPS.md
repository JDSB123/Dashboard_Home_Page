# Next Steps for Sports Betting Tracker

## Immediate Priorities

### 1. Test and Validate Box Score Fetching ⚠️
**Priority: HIGH**

- [ ] Test API connections with actual API keys
- [ ] Verify box score data structure matches expectations
- [ ] Test fetching for a recent date
- [ ] Validate segment/period data is properly captured
- [ ] Fix any API endpoint or data parsing issues

**Action**: Run `python fetch_box_scores.py --date 2025-12-14` to test

### 2. Improve Pick Parser for Real Conversation Format 🔍
**Priority: HIGH**

The HTML messages have complex formatting. Current parser may need enhancement:
- [ ] Test parser with actual Telegram HTML files
- [ ] Improve pattern matching for picks like "Bears +7.5 NFL HIT +$33,000"
- [ ] Handle formatted tables/structured data in HTML
- [ ] Extract dates from message timestamps properly
- [ ] Parse team names with various formats (e.g., "Bears vs Eagles", "Bears/Eagles")

**Action**: Test with `telegram_text_history_data/messages.html`

### 3. End-to-End Integration Test 🧪
**Priority: HIGH**

- [ ] Parse picks from conversation
- [ ] Match picks with box scores
- [ ] Evaluate results (Hit/Miss/Push)
- [ ] Export to Excel
- [ ] Verify output format matches requirements

**Action**: Create a test script that exercises the full workflow

### 4. Handle Pending Picks ⏳
**Priority: MEDIUM**

- [ ] Create system to check and update pending picks
- [ ] Schedule/automate box score fetching for recent dates
- [ ] Re-evaluate pending picks when box scores become available

### 5. Enhance SharePoint Integration 📤
**Priority: MEDIUM**

- [ ] Test SharePoint authentication
- [ ] Verify file upload/download works
- [ ] Set up automated upload schedule
- [ ] Handle file merging/updates in SharePoint

## Secondary Enhancements

### 6. Advanced Parsing Features 📝
- [ ] Support for different conversation formats
- [ ] Extract custom bet amounts (when not using base unit)
- [ ] Parse multiple picks from single message
- [ ] Handle pick cancellations/modifications

### 7. Data Quality & Validation ✅
- [ ] Validate pick data before storing
- [ ] Check for duplicate picks
- [ ] Validate box score data completeness
- [ ] Error handling and logging improvements

### 8. Analytics & Reporting 📊
- [ ] Generate summary statistics by league
- [ ] Calculate win rates by segment type
- [ ] Track P&L over time
- [ ] Identify profitable strategies

### 9. Automation & Scheduling 🤖
- [ ] Schedule daily box score fetching
- [ ] Automated pick evaluation
- [ ] Automated Excel generation
- [ ] Email/Slack notifications for results

### 10. UI/Dashboard (Optional) 🎨
- [ ] Simple web dashboard
- [ ] Visual charts and graphs
- [ ] Real-time pick tracking
- [ ] Filtering and search capabilities

## Recommended Order of Execution

1. **Week 1**: Test box score fetching + Improve pick parser + End-to-end test
2. **Week 2**: Handle pending picks + SharePoint integration testing
3. **Week 3**: Advanced parsing + Data validation
4. **Week 4**: Analytics + Automation setup

## Quick Start Testing

1. **Test box score fetching**:
   ```bash
   python fetch_box_scores.py --date 2025-12-14 --league NBA
   ```

2. **Test pick parsing**:
   ```python
   from src.pick_parser import PickParser
   parser = PickParser()
   with open('telegram_text_history_data/messages.html', 'r') as f:
       picks = parser.parse_html_conversation(f.read())
   print(f"Parsed {len(picks)} picks")
   ```

3. **Test full workflow**:
   ```python
   # See example_usage.py
   python example_usage.py
   ```
