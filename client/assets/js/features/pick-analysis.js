const SOURCE = "pick-analysis-tracker/output/graded_picks.csv";
const leagueFilter = document.getElementById("league-filter");
const segmentFilter = document.getElementById("segment-filter");
const resultFilter = document.getElementById("result-filter");
const tableBody = document.querySelector("#picks-table tbody");
const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("data-status");
const refreshBtn = document.getElementById("refresh-btn");

let rows = [];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(/,(?![^\"]*\"[^\"]*$)/).map((c) => c.replace(/^\"|\"$/g, "").trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });
}

function badge(result) {
  const r = (result || "").toLowerCase();
  if (r === "win") return `<span class="badge-win">Win</span>`;
  if (r === "loss") return `<span class="badge-loss">Loss</span>`;
  return `<span class="badge-unknown">Unknown</span>`;
}

function formatCurrency(val) {
  if (val === undefined || val === null || val === "") return "";
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function applyFilters() {
  const lg = leagueFilter.value.toLowerCase();
  const seg = segmentFilter.value.toLowerCase();
  const res = resultFilter.value.toLowerCase();
  return rows.filter((r) => {
    const leagueOk = !lg || (r.League || "").toLowerCase() === lg;
    const segOk = !seg || (r.Segment || "").toLowerCase() === seg;
    const resOk = !res || (r["Hit/Miss"] || "").toLowerCase() === res;
    return leagueOk && segOk && resOk;
  });
}

function renderTable(data) {
  tableBody.innerHTML = data
    .map(
      (r) => `
        <tr>
          <td>${r.Date || ""}</td>
          <td>${r.League || ""}</td>
          <td>${r.Matchup || ""}</td>
          <td>${r.Segment || ""}</td>
          <td>${r.Pick || ""}</td>
          <td>${r.Odds || ""}</td>
          <td>${formatCurrency(r.Risk)}</td>
          <td>${formatCurrency(r.ToWin)}</td>
          <td>${badge(r["Hit/Miss"])}</td>
          <td>${formatCurrency(r.PnL)}</td>
        </tr>
      `
    )
    .join("");
}

function renderSummary(data) {
  const total = data.length;
  const wins = data.filter((r) => (r["Hit/Miss"] || "").toLowerCase() === "win").length;
  const losses = data.filter((r) => (r["Hit/Miss"] || "").toLowerCase() === "loss").length;
  const pnl = data.reduce((acc, r) => {
    const v = Number(r.PnL);
    if (!Number.isNaN(v)) acc += v;
    return acc;
  }, 0);
  summaryEl.innerHTML = `
    <div>Total: ${total}</div>
    <div>Wins: ${wins}</div>
    <div>Losses: ${losses}</div>
    <div>Net PnL: ${formatCurrency(pnl)}</div>
  `;
}

async function loadData() {
  statusEl.textContent = "Loading…";
  try {
    const res = await fetch(SOURCE, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const text = await res.text();
    rows = parseCsv(text);
    const leagues = Array.from(new Set(rows.map((r) => r.League).filter(Boolean)));
    leagueFilter.innerHTML = `<option value="">All</option>` + leagues.map((l) => `<option value="${l}">${l}</option>`).join("");
    const filtered = applyFilters();
    renderTable(filtered);
    renderSummary(filtered);
    statusEl.textContent = `Loaded ${rows.length} rows`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Load failed";
    tableBody.innerHTML = `<tr><td colspan="10">Could not load ${SOURCE}. Ensure grade_picks.py has been run.</td></tr>`;
  }
}

leagueFilter.addEventListener("change", () => {
  const data = applyFilters();
  renderTable(data);
  renderSummary(data);
});
segmentFilter.addEventListener("change", () => {
  const data = applyFilters();
  renderTable(data);
  renderSummary(data);
});
resultFilter.addEventListener("change", () => {
  const data = applyFilters();
  renderTable(data);
  renderSummary(data);
});
refreshBtn.addEventListener("click", loadData);

loadData();
