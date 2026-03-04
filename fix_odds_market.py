"""Fix odds-market.html broken HTML structure.

Problem: Lines 131-580 contain a duplicate nested 'My Sports Books' dropdown,
missing nav/main closing/opening tags, KPI tiles outside containers, and
no brand header.

Fix: Replace lines 131-580 with correct structure matching weekly-lineup.html.
"""
import pathlib

SRC = pathlib.Path(r'c:\Users\JDSB\dev\green_bier_sport_ventures\Dashboard_Home_Page\client\odds-market.html')

lines = SRC.read_text(encoding='utf-8').splitlines(keepends=True)
print(f'Read {len(lines)} lines')

# Keep lines 1-130 (0-indexed 0-129) — head + nav through Fetch Picks </li>
before = lines[:130]

# Keep lines 581-end (0-indexed 580+) — Odds Comparison Board + bet slip + scripts
after = lines[580:]
print(f'After section starts with: {after[0].strip()[:60]}')

# Build the replacement section
replacement = r'''        <li class="nav-dropdown">
          <button
            class="nav-link nav-dropdown-trigger"
            id="sportsbooks-trigger"
            aria-expanded="false"
            aria-haspopup="true"
            aria-controls="sportsbooks-menu"
          >
            My Sports Books
          </button>
          <div
            class="nav-dropdown-menu"
            id="sportsbooks-menu"
            aria-labelledby="sportsbooks-trigger"
            role="region"
            aria-label="Connected sportsbooks"
            hidden
          >
            <section
              class="sportsbook-card"
              data-book="hulkwager"
              aria-labelledby="nav-sportsbook-hulkwager-name"
            >
              <div class="sportsbook-card-header">
                <div
                  class="sportsbook-name-group"
                  id="nav-sportsbook-hulkwager-name"
                >
                  <span class="connection-status disconnected"></span>
                  <span class="sportsbook-name">Hulk Wager</span>
                </div>
                <div class="sportsbook-meta-compact">
                  <span class="sportsbook-last-sync"
                    >Last: <span class="sync-time">--</span></span
                  >
                  <button
                    type="button"
                    class="sportsbook-fetch-compact"
                    data-book="hulkwager"
                    aria-label="Fetch picks from Hulk Wager"
                  >
                    <span class="fetch-icon">↻</span>
                  </button>
                </div>
              </div>
              <form class="sportsbook-actions-row">
                <div class="sportsbook-credentials-group">
                  <input
                    type="text"
                    id="nav-hulk-username"
                    class="credential-input-compact"
                    placeholder="Username"
                    name="nav-hulkwager-login"
                    autocomplete="off"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="Hulk Wager username"
                  />
                  <input
                    type="password"
                    id="nav-hulk-password"
                    class="credential-input-compact"
                    placeholder="Password"
                    name="nav-hulkwager-secret"
                    autocomplete="new-password"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="Hulk Wager password"
                  />
                </div>
              </form>
            </section>
            <section
              class="sportsbook-card"
              data-book="bombay711"
              aria-labelledby="nav-sportsbook-bombay711-name"
            >
              <div class="sportsbook-card-header">
                <div
                  class="sportsbook-name-group"
                  id="nav-sportsbook-bombay711-name"
                >
                  <span class="connection-status disconnected"></span>
                  <span class="sportsbook-name">Bombay 711</span>
                </div>
                <div class="sportsbook-meta-compact">
                  <span class="sportsbook-last-sync"
                    >Last: <span class="sync-time">--</span></span
                  >
                  <button
                    type="button"
                    class="sportsbook-fetch-compact"
                    data-book="bombay711"
                    aria-label="Fetch picks from Bombay 711"
                  >
                    <span class="fetch-icon">↻</span>
                  </button>
                </div>
              </div>
              <form class="sportsbook-actions-row">
                <div class="sportsbook-credentials-group">
                  <input
                    type="text"
                    id="nav-bombay-username"
                    class="credential-input-compact"
                    placeholder="Username"
                    name="nav-bombay711-login"
                    autocomplete="off"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="Bombay 711 username"
                  />
                  <input
                    type="password"
                    id="nav-bombay-password"
                    class="credential-input-compact"
                    placeholder="Password"
                    name="nav-bombay711-secret"
                    autocomplete="new-password"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="Bombay 711 password"
                  />
                </div>
              </form>
            </section>
            <section
              class="sportsbook-card"
              data-book="kingofsports"
              aria-labelledby="nav-sportsbook-kingofsports-name"
            >
              <div class="sportsbook-card-header">
                <div
                  class="sportsbook-name-group"
                  id="nav-sportsbook-kingofsports-name"
                >
                  <span class="connection-status disconnected"></span>
                  <span class="sportsbook-name">King of Sports</span>
                </div>
                <div class="sportsbook-meta-compact">
                  <span class="sportsbook-last-sync"
                    >Last: <span class="sync-time">--</span></span
                  >
                  <button
                    type="button"
                    class="sportsbook-fetch-compact"
                    data-book="kingofsports"
                    aria-label="Fetch picks from King of Sports"
                  >
                    <span class="fetch-icon">↻</span>
                  </button>
                </div>
              </div>
              <form class="sportsbook-actions-row">
                <div class="sportsbook-credentials-group">
                  <input
                    type="text"
                    id="nav-kingofsports-username"
                    class="credential-input-compact"
                    placeholder="Username"
                    name="nav-kingofsports-login"
                    autocomplete="off"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="King of Sports username"
                  />
                  <input
                    type="password"
                    id="nav-kingofsports-password"
                    class="credential-input-compact"
                    placeholder="Password"
                    name="nav-kingofsports-secret"
                    autocomplete="new-password"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="King of Sports password"
                  />
                </div>
              </form>
            </section>
            <section
              class="sportsbook-card"
              data-book="primetimeaction"
              aria-labelledby="nav-sportsbook-primetimeaction-name"
            >
              <div class="sportsbook-card-header">
                <div
                  class="sportsbook-name-group"
                  id="nav-sportsbook-primetimeaction-name"
                >
                  <span class="connection-status disconnected"></span>
                  <span class="sportsbook-name">Prime Time Action</span>
                </div>
                <div class="sportsbook-meta-compact">
                  <span class="sportsbook-last-sync"
                    >Last: <span class="sync-time">--</span></span
                  >
                  <button
                    type="button"
                    class="sportsbook-fetch-compact"
                    data-book="primetimeaction"
                    aria-label="Fetch picks from Prime Time Action"
                  >
                    <span class="fetch-icon">↻</span>
                  </button>
                </div>
              </div>
              <form class="sportsbook-actions-row">
                <div class="sportsbook-credentials-group">
                  <input
                    type="text"
                    id="nav-primetime-username"
                    class="credential-input-compact"
                    placeholder="Username"
                    name="nav-primetimeaction-login"
                    autocomplete="off"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="Prime Time Action username"
                  />
                  <input
                    type="password"
                    id="nav-primetime-password"
                    class="credential-input-compact"
                    placeholder="Password"
                    name="nav-primetimeaction-secret"
                    autocomplete="new-password"
                    spellcheck="false"
                    data-form-type="other"
                    inputmode="text"
                    aria-label="Prime Time Action password"
                  />
                </div>
              </form>
            </section>

            <div class="dropdown-section-divider">
              <span class="divider-label">Upload Picks</span>
            </div>

            <section
              class="sportsbook-card upload-picks-card"
              aria-labelledby="upload-picks-title"
            >
              <div class="sportsbook-card-header">
                <div class="sportsbook-name-group">
                  <span class="connection-status connected"></span>
                  <span class="sportsbook-name" id="upload-picks-title"
                    >Upload Picks</span
                  >
                </div>
                <div class="sportsbook-meta-compact">
                  <span class="sportsbook-last-sync"
                    >Attach slips or paste text</span
                  >
                </div>
              </div>
              <div class="sportsbook-upload-shell">
                <div class="upload-destination">
                  <label for="upload-sportsbook-select" class="upload-label"
                    >Assign sportsbook</label
                  >
                  <select
                    id="upload-sportsbook-select"
                    class="sportsbook-select"
                    aria-label="Assign uploaded picks to a sportsbook"
                  >
                    <option value="">Select Book...</option>
                    <option value="hulkwager">Hulk Wager</option>
                    <option value="bombay711">Bombay 711</option>
                    <option value="kingofsports">King of Sports</option>
                    <option value="primetimeaction">Prime Time Action</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div
                  class="sportsbook-actions-compact is-hidden"
                  id="action-buttons"
                >
                  <div class="action-btn-cta">
                    Choose an option to add picks
                  </div>
                  <button
                    class="action-btn-compact add-book-btn-compact"
                    type="button"
                  >
                    + Add Book
                  </button>
                  <button
                    class="action-btn-compact import-picks-btn"
                    type="button"
                  >
                    Upload Picks
                  </button>
                </div>
                <div class="import-options-popup" id="import-options">
                  <div class="import-header">
                    <div class="import-title-group">
                      <span class="import-title">Upload Picks</span>
                      <span class="import-subtitle"
                        >Drag in bet slips or paste picks below.</span
                      >
                    </div>
                    <button
                      type="button"
                      class="import-back-btn"
                      aria-label="Back to sportsbook list"
                    >
                      Back
                    </button>
                  </div>
                  <label
                    for="file-upload"
                    class="import-option-item import-file-zone"
                    id="drop-zone"
                  >
                    <span class="import-option-label">Upload Files</span>
                    <span class="import-option-desc"
                      >PDFs, images, HTML, or text files</span
                    >
                    <input
                      type="file"
                      id="file-upload"
                      name="picks-file"
                      accept=".pdf,.jpg,.jpeg,.png,.html,.htm,.txt,.csv"
                      multiple=""
                      class="file-input-hidden"
                    />
                  </label>
                  <div id="file-list"></div>
                  <button
                    type="button"
                    class="import-option-item import-manual-btn"
                    id="manual-entry-btn"
                  >
                    <span class="import-option-label">Manual Entry</span>
                    <span class="import-option-desc"
                      >Paste picks text directly into parser</span
                    >
                  </button>
                  <div id="manual-entry-area" class="manual-entry-area hidden">
                    <textarea
                      id="manual-picks-input"
                      placeholder="Paste picks text here..."
                    ></textarea>
                    <div class="manual-actions">
                      <button
                        type="button"
                        class="manual-submit-btn"
                        id="submit-manual-picks"
                      >
                        Process Picks
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </li>
      </ul>
    </nav>

    <main class="main-container">
      <div class="main-dashboard-layout">
        <div class="dashboard-topline">
          <div class="brand-header-inline" role="banner">
            <img
              src="assets/Logo%208.5.png?v=20251216"
              alt="Green Bier Sport Ventures"
              class="brand-logo-inline"
              loading="eager"
            />
            <div class="brand-content-inline">
              <div class="brand-text-stacked">
                <span class="brand-line-1">Green Bier</span>
                <span class="brand-line-2"
                  ><span class="brand-word">MARKET ODDS</span></span
                >
              </div>
            </div>
          </div>
          <div class="kpi-tiles">
            <div class="kpi-tile" data-tile-id="1" role="button" tabindex="0">
              <div class="kpi-tile-content">
                <div class="kpi-tile-layer kpi-tile-front active">
                  <div class="kpi-label">Games Today</div>
                  <div class="kpi-value" id="kpi-games">0</div>
                  <div class="kpi-subtext">Live Markets</div>
                </div>
              </div>
            </div>
            <div class="kpi-tile" data-tile-id="2" role="button" tabindex="0">
              <div class="kpi-tile-content">
                <div class="kpi-tile-layer kpi-tile-front active">
                  <div class="kpi-label">Value Plays</div>
                  <div class="kpi-value" id="kpi-value">0</div>
                  <div class="kpi-subtext">Best Lines</div>
                </div>
              </div>
            </div>
            <div class="kpi-tile" data-tile-id="3" role="button" tabindex="0">
              <div class="kpi-tile-content">
                <div class="kpi-tile-layer kpi-tile-front active">
                  <div class="kpi-label">Bet Slip</div>
                  <div class="kpi-value" id="kpi-slip">0</div>
                  <div class="kpi-subtext">Selections</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sport/Market Filters -->
          <div class="date-toggles-container">
            <div class="date-toggle-label">Sport</div>
            <div class="date-toggles" id="sport-tabs">
              <button class="date-toggle-btn active" data-sport="all">
                All
              </button>
              <button class="date-toggle-btn" data-sport="nfl">NFL</button>
              <button class="date-toggle-btn" data-sport="nba">NBA</button>
              <button class="date-toggle-btn" data-sport="ncaaf">NCAAF</button>
              <button class="date-toggle-btn" data-sport="ncaab">NCAAB</button>
            </div>
          </div>
        </div>

'''

result = ''.join(before) + replacement + ''.join(after)
SRC.write_text(result, encoding='utf-8')

# Verify
new_lines = result.splitlines()
print(f'Written {len(new_lines)} lines')

# Check for key structural elements
checks = ['</nav>', '</ul>', '<main', 'dashboard-topline', 'main-dashboard-layout', 'brand-header', 'kpi-tiles']
for c in checks:
    found = [i+1 for i, l in enumerate(new_lines) if c in l]
    print(f'  {c}: lines {found}')
