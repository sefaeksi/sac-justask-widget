// SAC-themed color palette
const SAC_COLORS = [
  "#0070F2", "#E8A000", "#5C8A00", "#BB0000", "#6E4B7B",
  "#0040B0", "#C87D00", "#3D6600", "#8C0000", "#4A3356",
  "#00A3E0", "#F0C000", "#7CB000", "#D04040", "#9060A0",
];

// ---------------------------------------------------------------------------
// Data formatting helpers
// ---------------------------------------------------------------------------

function formatValue(val, scale) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  if (scale && scale.divisor) {
    val = val / scale.divisor;
    return val.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " " + scale.unit;
  }
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + "M";
  if (Math.abs(val) >= 1_000)     return (val / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + "K";
  return val.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function getScale(plan, measName) {
  return plan.scale && plan.scale[measName] ? plan.scale[measName] : null;
}

// ---------------------------------------------------------------------------
// Chart render functions — each returns a Chart.js config object
// ---------------------------------------------------------------------------

function buildBarConfig(data, plan, horizontal = false) {
  const dim  = plan.dimensions[0];
  const meas = plan.measures[0];
  const scale = getScale(plan, meas);
  const labels = data.map(r => r[dim] ?? "—");
  const values = data.map(r => {
    const v = r[meas];
    return scale ? v / scale.divisor : (v ?? 0);
  });

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: meas,
        data: values,
        backgroundColor: SAC_COLORS.slice(0, labels.length).map(c => c + "CC"),
        borderColor: SAC_COLORS.slice(0, labels.length),
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => " " + formatValue(ctx.raw * (scale ? scale.divisor : 1), scale),
          },
        },
      },
      scales: {
        x: { ticks: { color: "#333", maxRotation: 45 } },
        y: { ticks: { color: "#333" } },
      },
    },
  };
  return config;
}

function buildLineConfig(data, plan) {
  const dim  = plan.dimensions[0];
  const labels = data.map(r => r[dim] ?? "—");

  const datasets = plan.measures.map((meas, i) => {
    const scale = getScale(plan, meas);
    return {
      label: meas,
      data: data.map(r => {
        const v = r[meas];
        return scale ? v / scale.divisor : (v ?? 0);
      }),
      borderColor: SAC_COLORS[i % SAC_COLORS.length],
      backgroundColor: SAC_COLORS[i % SAC_COLORS.length] + "22",
      tension: 0.3,
      pointRadius: 3,
    };
  });

  return {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: plan.measures.length > 1 } },
      scales: {
        x: { ticks: { color: "#333", maxRotation: 45 } },
        y: { ticks: { color: "#333" } },
      },
    },
  };
}

function buildAreaConfig(data, plan) {
  const cfg = buildLineConfig(data, plan);
  cfg.data.datasets.forEach(ds => { ds.fill = true; });
  return cfg;
}

function buildPieConfig(data, plan) {
  const dim    = plan.dimensions[0];
  const meas   = plan.measures[0];
  const scale  = getScale(plan, meas);
  const labels = data.map(r => r[dim] ?? "—");
  const values = data.map(r => {
    const v = r[meas];
    return scale ? v / scale.divisor : (v ?? 0);
  });

  return {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: SAC_COLORS.slice(0, labels.length).map(c => c + "CC"),
        borderColor: "#fff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } },
    },
  };
}

function buildStackedConfig(data, plan) {
  const cfg = buildBarConfig(data, plan);
  cfg.options.scales.x.stacked = true;
  cfg.options.scales.y.stacked = true;

  // Multi-measure stacked
  if (plan.measures.length > 1) {
    const dim = plan.dimensions[0];
    cfg.data.datasets = plan.measures.map((meas, i) => {
      const scale = getScale(plan, meas);
      return {
        label: meas,
        data: data.map(r => {
          const v = r[meas];
          return scale ? v / scale.divisor : (v ?? 0);
        }),
        backgroundColor: SAC_COLORS[i % SAC_COLORS.length] + "CC",
        borderColor: SAC_COLORS[i % SAC_COLORS.length],
        borderWidth: 1,
      };
    });
    cfg.options.plugins.legend = { display: true };
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Table renderer — returns an HTMLElement (not a Chart.js config)
// ---------------------------------------------------------------------------

function buildTableElement(data, plan, metadata) {
  const allCols = [
    ...plan.dimensions,
    ...plan.measures,
    ...plan.derived.map(d => d.name),
  ];

  // Label map
  const labelOf = {};
  for (const d of (metadata?.dimensions || [])) labelOf[d.name] = d.label || d.name;
  for (const m of (metadata?.measures   || [])) labelOf[m.name] = m.label || m.name;
  for (const d of plan.derived) labelOf[d.name] = d.label || d.name;

  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px;";

  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  for (const col of allCols) {
    const th = document.createElement("th");
    th.textContent = labelOf[col] || col;
    th.style.cssText = "padding:6px 8px;background:#0070F2;color:#fff;text-align:left;white-space:nowrap;";
    headerRow.appendChild(th);
  }

  const tbody = table.createTBody();
  for (const row of data) {
    const tr = tbody.insertRow();
    for (const col of allCols) {
      const td = tr.insertCell();
      const val = row[col];
      td.textContent = typeof val === "number" ? formatValue(val, getScale(plan, col)) : (val ?? "—");
      td.style.cssText = "padding:5px 8px;border-bottom:1px solid #e0e0e0;";
    }
  }
  return table;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Render query results into a container element.
 *
 * @param {HTMLElement} container  The DOM element to render into
 * @param {Array}       data       Rows of {fieldName: value} objects
 * @param {object}      plan       Query plan from parseQuestion()
 * @param {object}      metadata   SAC model metadata (optional, used for table labels)
 */
export function renderChart(container, data, plan, metadata = {}) {
  // Clear previous content
  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = `<div style="padding:24px;color:#999;text-align:center;">Sonuç bulunamadı.</div>`;
    return;
  }

  const type = plan.chart_type || "bar";

  // Table renders directly as HTML
  if (type === "table" || type === null && plan.dimensions.length > 1) {
    container.style.overflow = "auto";
    container.appendChild(buildTableElement(data, plan, metadata));
    return;
  }

  // All other types use Chart.js
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;";
  container.appendChild(canvas);

  let config;
  switch (type) {
    case "hbar":    config = buildBarConfig(data, plan, true);  break;
    case "line":    config = buildLineConfig(data, plan);        break;
    case "area":    config = buildAreaConfig(data, plan);        break;
    case "pie":     config = buildPieConfig(data, plan);         break;
    case "stacked": config = buildStackedConfig(data, plan);     break;
    default:        config = buildBarConfig(data, plan, false);  break;
  }

  // Chart.js must be available in scope — loaded via widget.js
  if (typeof Chart === "undefined") {
    container.innerHTML = `<div style="padding:12px;color:red;">Chart.js yüklenemedi.</div>`;
    return;
  }

  return new Chart(canvas, config);
}
