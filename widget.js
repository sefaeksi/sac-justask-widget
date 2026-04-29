// SAC Custom Widget — Just Ask NLP
// chart.min.js is the UMD build of Chart.js 4.x — it exposes a global `Chart`
// object and self-registers all components, so no import/register needed.
// The <script> tag in the host page (or SAC) must load chart.min.js first.

import { parseQuestion } from "./nlp/parser.js";
import { renderChart }   from "./chart/renderer.js";

// ---------------------------------------------------------------------------
// Web Component
// ---------------------------------------------------------------------------

class JustAskWidget extends HTMLElement {
  constructor() {
    super();
    this._root      = this.attachShadow({ mode: "open" });
    this._metadata  = { dimensions: [], measures: [] };
    this._lastPlan  = null;
    this._lastData  = null;
    this._chartInst = null;
    this._maxRows   = 50;
    this._chartType = null; // UI override
  }

  // ── SAC lifecycle ────────────────────────────────────────────────────────

  onCustomWidgetBeforeUpdate(changedProperties) {
    if ("maxRows" in changedProperties)
      this._maxRows = parseInt(changedProperties.maxRows.newVal, 10) || 50;
    if ("defaultChartType" in changedProperties)
      this._chartType = changedProperties.defaultChartType.newVal || null;
  }

  onCustomWidgetAfterUpdate() {
    this._refreshChart();
  }

  // Called when a data source is bound in Analytics Designer
  onDataBindingInit(dataBinding) {
    this._dataBinding = dataBinding;
    this._metadata = this._extractMetadata(dataBinding);
    this._buildDynamicAliases();
  }

  // Called when bound data updates (filter, drill, etc.)
  onDataBindingUpdate() {
    if (this._lastPlan) this._fetchAndRender(this._lastPlan);
  }

  // ── DOM lifecycle ─────────────────────────────────────────────────────────

  connectedCallback() {
    this._render();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _render() {
    this._root.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          font-family: "72", "Helvetica Neue", Arial, sans-serif;
          font-size: 13px;
          box-sizing: border-box;
          background: #fff;
        }
        .ja-toolbar {
          display: flex;
          gap: 6px;
          padding: 8px 10px;
          border-bottom: 1px solid #e5e5e5;
          align-items: center;
          flex-shrink: 0;
        }
        .ja-input {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid #b0b0b0;
          border-radius: 4px;
          font-size: 13px;
          outline: none;
          transition: border-color .15s;
        }
        .ja-input:focus { border-color: #0070F2; }
        .ja-btn {
          padding: 6px 14px;
          background: #0070F2;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          white-space: nowrap;
        }
        .ja-btn:hover { background: #0058c8; }
        .ja-btn.secondary { background: #f0f0f0; color: #333; }
        .ja-btn.secondary:hover { background: #e0e0e0; }
        .ja-chart-bar    { --ct: bar; }
        .ja-chart-hbar   { --ct: hbar; }
        .ja-chart-line   { --ct: line; }
        .ja-chart-pie    { --ct: pie; }
        .ja-chart-table  { --ct: table; }
        .ja-type-btns {
          display: flex;
          gap: 4px;
          padding: 4px 10px;
          border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .ja-type-btn {
          padding: 3px 10px;
          border: 1px solid #ccc;
          border-radius: 12px;
          background: #fff;
          color: #555;
          cursor: pointer;
          font-size: 11px;
        }
        .ja-type-btn.active { background: #0070F2; color: #fff; border-color: #0070F2; }
        .ja-chart-area {
          flex: 1;
          padding: 10px;
          overflow: hidden;
          position: relative;
          min-height: 0;
        }
        .ja-status {
          padding: 4px 10px;
          font-size: 11px;
          color: #888;
          border-top: 1px solid #f0f0f0;
          flex-shrink: 0;
        }
      </style>

      <div class="ja-toolbar">
        <input class="ja-input" id="ja-q" type="text"
               placeholder="Türkçe veya İngilizce soru yazın… (örn: en çok dinlenen 10 şarkı)">
        <button class="ja-btn" id="ja-go">Sorgula</button>
        <button class="ja-btn secondary" id="ja-clear">Temizle</button>
      </div>

      <div class="ja-type-btns" id="ja-types">
        <button class="ja-type-btn" data-type="bar">Bar</button>
        <button class="ja-type-btn" data-type="hbar">Yatay Bar</button>
        <button class="ja-type-btn" data-type="line">Çizgi</button>
        <button class="ja-type-btn" data-type="pie">Pasta</button>
        <button class="ja-type-btn" data-type="stacked">Yığılmış</button>
        <button class="ja-type-btn" data-type="area">Alan</button>
        <button class="ja-type-btn" data-type="table">Tablo</button>
      </div>

      <div class="ja-chart-area" id="ja-chart"></div>
      <div class="ja-status" id="ja-status">Veri yüklenmedi.</div>
    `;

    const input   = this._root.getElementById("ja-q");
    const goBtn   = this._root.getElementById("ja-go");
    const clrBtn  = this._root.getElementById("ja-clear");
    const typeBar = this._root.getElementById("ja-types");

    goBtn.addEventListener("click", () => this._onQuery(input.value.trim()));
    input.addEventListener("keydown", e => { if (e.key === "Enter") this._onQuery(input.value.trim()); });
    clrBtn.addEventListener("click", () => {
      input.value = "";
      this._root.getElementById("ja-chart").innerHTML = "";
      this._root.getElementById("ja-status").textContent = "Temizlendi.";
      this._lastPlan = null;
    });

    typeBar.addEventListener("click", e => {
      const btn = e.target.closest("[data-type]");
      if (!btn) return;
      this._chartType = btn.dataset.type;
      typeBar.querySelectorAll(".ja-type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (this._lastPlan && this._lastData) {
        this._lastPlan.chart_type = this._chartType;
        this._drawChart(this._lastData, this._lastPlan);
      }
    });
  }

  async _onQuery(question) {
    if (!question) return;
    this._setStatus("Sorgu işleniyor…");
    try {
      const plan = parseQuestion(question, this._metadata);
      if (this._chartType) plan.chart_type = this._chartType;
      plan.top = Math.min(plan.top, this._maxRows);
      this._lastPlan = plan;
      await this._fetchAndRender(plan);
    } catch (err) {
      this._setStatus("Hata: " + err.message);
      console.error("[JustAsk]", err);
    }
  }

  async _fetchAndRender(plan) {
    this._setStatus("Veri alınıyor…");
    try {
      const data = await this._fetchData(plan);
      this._lastData = data;
      this._drawChart(data, plan);
      this._setStatus(`${data.length} satır gösteriliyor.`);
    } catch (err) {
      this._setStatus("Veri alınamadı: " + err.message);
      console.error("[JustAsk]", err);
    }
  }

  _drawChart(data, plan) {
    if (this._chartInst) { this._chartInst.destroy(); this._chartInst = null; }
    const container = this._root.getElementById("ja-chart");
    this._chartInst = renderChart(container, data, plan, this._metadata) || null;
  }

  // ── SAC Data Binding API ─────────────────────────────────────────────────

  _extractMetadata(dataBinding) {
    try {
      const ds = dataBinding.getDataSource();
      const dims = ds.getDimensions().map(d => ({
        name:  d.getId(),
        label: d.getDescription() || d.getId(),
        type:  "string",
      }));
      const meas = ds.getMeasures().map(m => ({
        name:  m.getId(),
        label: m.getDescription() || m.getId(),
        type:  "decimal",
      }));
      return { dimensions: dims, measures: meas };
    } catch {
      // No data source bound yet — return empty metadata
      return { dimensions: [], measures: [] };
    }
  }

  async _fetchData(plan) {
    if (!this._dataBinding) return this._mockData(plan);

    try {
      const ds = this._dataBinding.getDataSource();

      // Set selected dimensions and measures
      ds.setDimensions(plan.dimensions);
      ds.setMeasures(plan.measures);

      // Apply filters
      ds.clearFilters();
      for (const f of plan.filters) {
        if (f.kind === "numeric") {
          ds.addMeasureFilter(f.field, f.op, f.value);
        } else {
          ds.addDimensionFilter(f.field, f.op, f.value);
        }
      }

      // Apply sort
      if (plan.orderby) {
        ds.setSort(plan.orderby.field, plan.orderby.dir === "desc" ? "DESC" : "ASC");
      }

      ds.setResultSetMaxRows(plan.top);
      const resultSet = await ds.getResultSet();
      return this._parseResultSet(resultSet, plan);
    } catch (err) {
      console.warn("[JustAsk] SAC data binding failed, using mock:", err);
      return this._mockData(plan);
    }
  }

  _parseResultSet(resultSet, plan) {
    const rows = [];
    for (const row of resultSet) {
      const obj = {};
      for (const dim of plan.dimensions) obj[dim] = row.getDimensionMemberDescription(dim);
      for (const meas of plan.measures)   obj[meas] = row.getMeasureValue(meas);
      rows.push(obj);
    }
    return rows;
  }

  // ── Dynamic alias generation ──────────────────────────────────────────────
  // When model is bound, try to create Turkish fonetik aliases from field labels
  _buildDynamicAliases() {
    // This is handled inside parser.js applyAliases — the static alias map
    // already covers common spoken Turkish forms. No extra work needed here
    // unless the model has custom field labels that need runtime mapping.
    // Future: implement fuzzy label → alias generator here.
  }

  _setStatus(msg) {
    const el = this._root.getElementById("ja-status");
    if (el) el.textContent = msg;
  }

  _refreshChart() {
    if (this._lastPlan && this._lastData) {
      if (this._chartType) this._lastPlan.chart_type = this._chartType;
      this._drawChart(this._lastData, this._lastPlan);
    }
  }

  // ── Mock data for development (no SAC binding) ────────────────────────────
  _mockData(plan) {
    const dim  = plan.dimensions[0] || "item";
    const meas = plan.measures[0]   || "value";
    const rows = [];
    const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon",
                   "Zeta", "Eta", "Theta", "Iota", "Kappa"];
    for (let i = 0; i < Math.min(plan.top, 10); i++) {
      const row = {};
      row[dim]  = names[i] || `Item ${i + 1}`;
      row[meas] = Math.round(Math.random() * 9_000_000 + 100_000);
      rows.push(row);
    }
    return rows;
  }
}

customElements.define("com-custom-justask", JustAskWidget);
