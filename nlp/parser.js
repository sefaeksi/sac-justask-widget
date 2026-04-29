import { applyAliases } from "./aliases.js";
import {
  SORT_DESC_KW, SORT_ASC_KW, CHART_TYPES, GENERIC_CHART_KW,
  YEAR_PATTERN, TOP_PATTERN, BY_PATTERN, PRE_BY_PATTERN,
  HANGI_PATTERN, HANGI_ULKE_PAT, COUNT_PATTERN, GENITIVE_KAC_PAT,
  RISING_PAT, YENI_GIREN_PAT, ORTA_PAT, YUKSEK_POP_PAT, DUSUK_POP_PAT,
  BUYUME_PAT, VIRAL_PAT, SINGULAR_END_PAT, POP_NEGATED_PAT,
  NUM_FILTER_PAT, POZITIF_PAT, NEGATIF_PAT, NEGATIF_REV, NUM_SUFFIX_PAT,
  SCALED_NUM_PAT, PLAIN_GECEN_PAT, CTX_SCALED_GECEN,
  LOCATIVE_PAT, LOC_STOP, GENRE_OWNER_PAT, GENRE_ADJECTIVES,
  SUFFIX_ENDINGS, SUFFIX_DIM_MAP, SCALE_VALUES, SCALE_KW_PATTERN,
  PCT_PATTERN, MEAS_ARITH_PAT, CONST_ARITH_PAT,
  COUNTRY_ABBR, AGG_KEYWORDS,
} from "./keywords.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function re(pattern, flags = "") {
  return new RegExp(pattern, flags);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Simple difflib-like close-match using Levenshtein distance
function closestMatch(word, candidates, cutoff = 0.82) {
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const score = similarity(word, c);
    if (score > bestScore && score >= cutoff) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

function editDistance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = dp[0];
    dp[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const temp = dp[j + 1];
      dp[j + 1] = a[i] === b[j] ? prev : 1 + Math.min(prev, dp[j], dp[j + 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

// Find a measure field whose name/label contains "change" or "değişim" type words
function findChangeMeasure(measNames, measLabels) {
  const kw = ["change", "degisim", "değişim", "degisme", "değişme", "stream_change"];
  for (const [k, v] of Object.entries(measNames)) {
    if (kw.some(w => k.includes(w))) return v;
  }
  for (const [k, v] of Object.entries(measLabels)) {
    if (kw.some(w => k.includes(w))) return v;
  }
  return null;
}

// Find the "trend" dimension field
function findTrendDim(dimNames, dimLabels) {
  const kw = ["trend", "status", "durum", "egilim"];
  if (dimNames["trend"]) return dimNames["trend"];
  for (const [k, v] of Object.entries(dimNames)) {
    if (kw.some(w => k.includes(w))) return v;
  }
  for (const [k, v] of Object.entries(dimLabels)) {
    if (kw.some(w => k.includes(w))) return v;
  }
  return null;
}

// Find a "days in chart / longevity" field
function findDaysField(measNames, measLabels, dimNames, dimLabels) {
  const kw = ["day", "gun", "gün", "longevity", "days_on_chart", "listede"];
  for (const [k, v] of Object.entries({ ...measNames, ...measLabels, ...dimNames, ...dimLabels })) {
    if (kw.some(w => k.includes(w))) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse a Turkish/English natural language question into a SAC query plan.
 *
 * @param {string} question  Raw user input
 * @param {object} metadata  { dimensions: [{name, label, type}], measures: [{name, label, type}] }
 * @returns {object} query plan
 */
export function parseQuestion(question, metadata) {
  let q = question.toLowerCase();
  q = q.replace(/coc/g, "cok").replace(/cöc/g, "çok");

  const dimNames  = {};  // lowercase name  → actual name
  const dimLabels = {};  // lowercase label → actual name
  const measNames = {};
  const measLabels = {};

  for (const d of metadata.dimensions) {
    dimNames[d.name.toLowerCase()]   = d.name;
    dimLabels[d.label.toLowerCase()] = d.name;
  }
  for (const m of metadata.measures) {
    measNames[m.name.toLowerCase()]   = m.name;
    measLabels[m.label.toLowerCase()] = m.name;
  }

  const dimFieldSet  = new Set(Object.values(dimNames).map(v => v.toLowerCase()));
  const measFieldSet = new Set(Object.values(measNames).map(v => v.toLowerCase()));

  // Semantic helpers
  const changeField = findChangeMeasure(measNames, measLabels);
  const trendField  = findTrendDim(dimNames, dimLabels);
  const lonField    = findDaysField(measNames, measLabels, dimNames, dimLabels);

  // Apply aliases
  q = applyAliases(q, dimFieldSet, measFieldSet);

  // State
  const filters      = [];
  const selectDims   = new Set();
  const selectMeas   = new Set();
  let   top          = 50;
  let   orderby      = null;
  let   sortDir      = "desc";
  let   chartType    = null;
  const aggMap       = {};
  const derived      = [];
  const scaleMap     = {};
  let   topMatch     = false;
  let   sortOverride = null;

  // ── "all/hepsi" shortcut ────────────────────────────────────────────────
  const allPat = /^(?:all|tümü|tumü|tumu|hepsi|hepsini|tüm)$/;
  if (allPat.test(q.trim()) || q.trim() === "") {
    return {
      filters: [], derived: [], scale: {}, agg: {},
      dimensions: metadata.dimensions.filter(d => d.name !== "Version").map(d => d.name),
      measures:   metadata.measures.map(m => m.name),
      top: 100, orderby: null, chart_type: null,
    };
  }

  // ── Genitive "Taylor Swift'in kaç şarkısı" ──────────────────────────────
  let genitiveName = null;
  const gkm = GENITIVE_KAC_PAT.exec(question);
  if (gkm) genitiveName = gkm[1].trim();

  // ── Count aggregation ─────────────────────────────────────────────────
  const countM = COUNT_PATTERN.exec(question);
  if (countM) {
    aggMap["__count__"] = "count";
    if (countM[1]) {
      const cand = countM[1].toLowerCase();
      const matched = dimNames[cand] || dimLabels[cand];
      if (matched && matched !== "Version") selectDims.add(matched);
    }
  }

  if (genitiveName) {
    const pref = ["artist_name", "track_name",
      ...metadata.dimensions.filter(d => !["artist_name","track_name","Version"].includes(d.name)).map(d => d.name)];
    for (const dim of pref) {
      if (Object.values(dimNames).includes(dim) && !filters.some(f => f.field === dim)) {
        filters.push({ field: dim, op: "eq", value: genitiveName });
        break;
      }
    }
  }

  // ── Year filter ─────────────────────────────────────────────────────────
  for (const m of q.matchAll(new RegExp(YEAR_PATTERN.source, "g"))) {
    const year = m[1];
    if (metadata.dimensions.some(d => d.name === "Date")) {
      filters.push({ field: "Date", op: "startswith", value: year });
    } else if (metadata.dimensions.some(d => d.name === "GJAHR")) {
      filters.push({ field: "GJAHR", op: "eq", value: year });
    }
  }

  // ── Numeric comparison filters ──────────────────────────────────────────
  for (const src of [question, q]) {
    for (const m of src.matchAll(new RegExp(NUM_FILTER_PAT.source, "gi"))) {
      if (m[1]) {
        const cand = m[1].toLowerCase();
        const rawVal = parseFloat(m[2].replace(",", "."));
        const opStr = (m[0].match(/[><=!]+/) || ["=="])[0];
        const meas = measNames[cand] || measLabels[cand];
        if (meas && !filters.some(f => f.field === meas)) {
          filters.push({ field: meas, op: opStr, value: rawVal, kind: "numeric" });
        }
      } else if (m[3]) {
        const cand = m[3].toLowerCase();
        const rawVal = parseFloat(m[4].replace(",", "."));
        const word  = (m[5] || "").toLowerCase();
        const meas  = measNames[cand] || measLabels[cand];
        if (meas && !filters.some(f => f.field === meas)) {
          const op = /buy|büy|fazla/.test(word) ? ">=" : "<=";
          filters.push({ field: meas, op, value: rawVal, kind: "numeric" });
        }
      }
    }
  }

  for (const m of q.matchAll(new RegExp(POZITIF_PAT.source, "gi"))) {
    const meas = measNames[m[1].toLowerCase()] || measLabels[m[1].toLowerCase()];
    if (meas && !filters.some(f => f.field === meas))
      filters.push({ field: meas, op: ">", value: 0, kind: "numeric" });
  }
  for (const m of q.matchAll(new RegExp(NEGATIF_PAT.source, "gi"))) {
    const meas = measNames[m[1].toLowerCase()] || measLabels[m[1].toLowerCase()];
    if (meas && !filters.some(f => f.field === meas))
      filters.push({ field: meas, op: "<", value: 0, kind: "numeric" });
  }
  for (const m of q.matchAll(new RegExp(NEGATIF_REV.source, "gi"))) {
    const meas = measNames[m[1].toLowerCase()] || measLabels[m[1].toLowerCase()];
    if (meas && !filters.some(f => f.field === meas))
      filters.push({ field: meas, op: "<", value: 0, kind: "numeric" });
  }
  for (const m of q.matchAll(new RegExp(NUM_SUFFIX_PAT.source, "gi"))) {
    const meas = measNames[m[1].toLowerCase()] || measLabels[m[1].toLowerCase()];
    const val  = parseFloat(m[2].replace(",", "."));
    if (meas && !filters.some(f => f.field === meas))
      filters.push({ field: meas, op: ">=", value: val, kind: "numeric" });
  }

  // ── Scaled numeric filters ───────────────────────────────────────────────
  for (const m of question.matchAll(new RegExp(SCALED_NUM_PAT.source, "gi"))) {
    const cand = m[1].toLowerCase();
    const rawVal = parseFloat(m[2].replace(",", "."));
    const scale  = SCALE_VALUES[m[3].toLowerCase()] || 1;
    const dir    = (m[4] || "").toLowerCase();
    const meas   = measNames[cand] || measLabels[cand];
    if (meas) {
      const op = /uzer|üzer|ust|üst|fazla|buy|büy|ge/.test(dir) ? ">=" : "<=";
      filters.push({ field: meas, op, value: rawVal * scale, kind: "numeric" });
    }
  }
  for (const m of question.matchAll(new RegExp(PLAIN_GECEN_PAT.source, "gi"))) {
    const meas = measNames[m[1].toLowerCase()] || measLabels[m[1].toLowerCase()];
    if (meas && !filters.some(f => f.field === meas))
      filters.push({ field: meas, op: ">=", value: parseFloat(m[2].replace(",", ".")), kind: "numeric" });
  }
  for (const m of question.matchAll(new RegExp(CTX_SCALED_GECEN.source, "gi"))) {
    const val  = parseFloat(m[1].replace(",", ".")) * (SCALE_VALUES[m[2].toLowerCase()] || 1);
    const target = selectMeas.size > 0 ? [...selectMeas][0] :
      (metadata.measures.length > 0 ? metadata.measures[0].name : null);
    if (target && !filters.some(f => f.field === target))
      filters.push({ field: target, op: ">=", value: val, kind: "numeric" });
  }

  // ── Viral keyword ────────────────────────────────────────────────────────
  if (VIRAL_PAT.test(question)) {
    const vsField = measNames["viral_score"] || measLabels["viral_score"];
    if (vsField && !selectMeas.has(vsField)) selectMeas.add(vsField);
  }

  // ── Rising trend ─────────────────────────────────────────────────────────
  if (RISING_PAT.test(question)) {
    if (changeField && !filters.some(f => f.field === changeField)) {
      filters.push({ field: changeField, op: ">", value: 0, kind: "numeric" });
      selectMeas.add(changeField);
    }
  }

  // ── "yeni giren" → trend = Rising ────────────────────────────────────────
  if (YENI_GIREN_PAT.test(question)) {
    if (trendField && !filters.some(f => f.field === trendField))
      filters.push({ field: trendField, op: "eq", value: "Rising" });
  }

  // ── Popularity category filters ───────────────────────────────────────────
  const popField = dimNames["popularity_category"] || dimLabels["popularity_category"] ||
                   dimLabels["popularlik kategorisi"];
  if (ORTA_PAT.test(question) && popField && !filters.some(f => f.field === popField))
    filters.push({ field: popField, op: "eq", value: "Medium" });
  if (YUKSEK_POP_PAT.test(question) && !POP_NEGATED_PAT.test(question) &&
      popField && !filters.some(f => f.field === popField))
    filters.push({ field: popField, op: "eq", value: "High" });
  if (DUSUK_POP_PAT.test(question) && popField && !filters.some(f => f.field === popField))
    filters.push({ field: popField, op: "eq", value: "Low" });

  // ── Growth / büyüme filter ────────────────────────────────────────────────
  if (BUYUME_PAT.test(question)) {
    if (changeField && !filters.some(f => f.field === changeField)) {
      filters.push({ field: changeField, op: ">", value: 0, kind: "numeric" });
      selectMeas.add(changeField);
    }
  }

  // ── Genre filters ─────────────────────────────────────────────────────────
  const allFieldKeysEarly = new Set([
    ...Object.keys(dimNames), ...Object.keys(dimLabels),
    ...Object.keys(measNames), ...Object.keys(measLabels),
  ]);
  const GENRE_SKIP = new Set([
    "en", "bu", "bir", "hangi", "ne", "olan", "her", "bazi", "bazı",
    ...allFieldKeysEarly, ...SUFFIX_ENDINGS, ...GENRE_ADJECTIVES,
  ]);
  if (dimNames["genre"] || dimLabels["genre"]) {
    for (const m of question.matchAll(new RegExp(GENRE_OWNER_PAT.source, "gi"))) {
      const val = m[1], valLow = val.toLowerCase();
      if (GENRE_SKIP.has(valLow)) continue;
      if (/(?:lu|li|lü|lı|lik|sel|sal)$/.test(valLow)) continue;
      if (!filters.some(f => f.field === "genre"))
        filters.push({ field: "genre", op: "eq", value: val });
    }
  }

  // ── Country filters ───────────────────────────────────────────────────────
  if (dimNames["country"]) {
    for (const [abbr, code] of Object.entries(COUNTRY_ABBR)) {
      if (re(`(?<!\\w)${escapeRe(abbr)}(?!\\w)`, "i").test(question) &&
          !filters.some(f => f.field === "country")) {
        filters.push({ field: "country", op: "eq", value: code });
        break;
      }
    }
    // Locative suffix match (proper nouns)
    for (const m of question.matchAll(new RegExp(LOCATIVE_PAT.source, "g"))) {
      if (!m[1]) continue;
      const valLow  = m[1].toLowerCase();
      const fullLow = m[0].toLowerCase().trimEnd();
      if (dimNames[valLow] || measNames[valLow]) continue;
      if (LOC_STOP.has(fullLow) || LOC_STOP.has(valLow)) continue;
      if (!filters.some(f => f.field === "country")) {
        const resolved = COUNTRY_ABBR[valLow] || m[1];
        filters.push({ field: "country", op: "eq", value: resolved });
      }
    }
  }

  // ── Suffix-based dimension value filters ──────────────────────────────────
  const SUFFIX_SKIP = new Set([
    "en", "bir", "bu", "su", "hangi", "ne", "sarki", "sarkinin",
    "muzik", "sarkilar", "sarkilarin", ...allFieldKeysEarly, ...SUFFIX_ENDINGS,
  ]);
  for (const [suffix, dimField] of Object.entries(SUFFIX_DIM_MAP)) {
    if (!(dimNames[dimField] || dimLabels[dimField])) continue;
    if (filters.some(f => f.field === dimField)) continue;
    const pat = re(`\\b([\\w\\-]+)\\s*${escapeRe(suffix)}\\b`, "i");
    const sm  = pat.exec(question);
    if (sm && !SUFFIX_SKIP.has(sm[1].toLowerCase()))
      filters.push({ field: dimField, op: "eq", value: sm[1] });
  }

  // ── Detect fields in query ─────────────────────────────────────────────
  for (const [nameLow, name] of Object.entries(dimNames)) {
    if (q.includes(nameLow) && name !== "Version") selectDims.add(name);
  }
  for (const [labelLow, name] of Object.entries(dimLabels)) {
    if (q.includes(labelLow) && name !== "Version") selectDims.add(name);
  }
  for (const [nameLow, name] of Object.entries(measNames)) {
    if (q.includes(nameLow)) selectMeas.add(name);
  }
  for (const [labelLow, name] of Object.entries(measLabels)) {
    if (q.includes(labelLow)) selectMeas.add(name);
  }

  // ── Fuzzy match ───────────────────────────────────────────────────────────
  const allFieldNamesLow = [
    ...Object.keys(dimNames), ...Object.keys(dimLabels),
    ...Object.keys(measNames), ...Object.keys(measLabels),
  ];
  const allLookup = { ...dimNames, ...dimLabels, ...measNames, ...measLabels };
  for (const word of q.matchAll(/\w+/g)) {
    const wl = word[0].toLowerCase();
    if (allLookup[wl]) continue;
    const best = closestMatch(wl, allFieldNamesLow);
    if (best) {
      const matched = allLookup[best];
      if (!matched || matched === "Version") continue;
      if (dimNames[best] || dimLabels[best]) selectDims.add(matched);
      else selectMeas.add(matched);
    }
  }

  // ── "by X" / "X bazında" ──────────────────────────────────────────────────
  for (const m of q.matchAll(new RegExp(BY_PATTERN.source, "gi"))) {
    const w = m[1].toLowerCase();
    if (dimNames[w]) selectDims.add(dimNames[w]);
    else if (dimLabels[w]) selectDims.add(dimLabels[w]);
  }
  for (const m of q.matchAll(new RegExp(PRE_BY_PATTERN.source, "gi"))) {
    const w = m[1].toLowerCase();
    if (dimNames[w]) selectDims.add(dimNames[w]);
    else if (dimLabels[w]) selectDims.add(dimLabels[w]);
  }

  // ── "hangi X" ─────────────────────────────────────────────────────────────
  for (const m of question.matchAll(new RegExp(HANGI_PATTERN.source, "gi"))) {
    const matched = dimNames[m[1].toLowerCase()] || dimLabels[m[1].toLowerCase()];
    if (matched && matched !== "Version") selectDims.add(matched);
  }
  if (HANGI_ULKE_PAT.test(question)) {
    const cf = dimNames["country"];
    if (cf) { selectDims.add(cf); selectDims.delete("track_name"); }
  }

  // ── Top N ─────────────────────────────────────────────────────────────────
  const qRaw = question.toLowerCase();
  const topM = new RegExp(TOP_PATTERN.source, "gi").exec(q);
  if (topM) { top = parseInt(topM[1], 10); topMatch = true; }

  if (!topMatch) {
    const ctxPat = /\b(\d+)\s+(?:sarki\w*|parca\w*|sanatci\w*|muzik\w*|parça\w*|şarkı\w*|sanatç\w*|tane\b|ulke\w*|ülke\w*|tur\b|tür\b|türü\w*|turu\w*|genre\w*)/i;
    const cm = ctxPat.exec(qRaw);
    if (cm) { top = parseInt(cm[1], 10); topMatch = true; }
  }
  if (!topMatch && SINGULAR_END_PAT.test(question.trim())) top = 1;

  // ── Aggregation overrides ─────────────────────────────────────────────────
  const aggPattern = re(`\\b(${Object.keys(AGG_KEYWORDS).join("|")})\\s+(\\w+)`, "gi");
  for (const m of question.matchAll(aggPattern)) {
    const func  = AGG_KEYWORDS[m[1].toLowerCase()];
    const meas  = measNames[m[2].toLowerCase()] || measLabels[m[2].toLowerCase()];
    if (meas) { aggMap[meas] = func; selectMeas.add(meas); }
  }

  // ── Derived columns ────────────────────────────────────────────────────────
  const allMeas = { ...measNames, ...measLabels };
  for (const m of question.matchAll(new RegExp(MEAS_ARITH_PAT.source, "g"))) {
    const aName = allMeas[m[1].toLowerCase()];
    const bName = allMeas[m[3].toLowerCase()];
    if (aName && bName && aName !== bName) {
      derived.push({ name: `_calc_${aName}_${m[2]}_${bName}`, label: `${aName} ${m[2]} ${bName}`,
        type: "meas_op_meas", a: aName, b: bName, op: m[2] });
      selectMeas.add(aName); selectMeas.add(bName);
    }
  }
  for (const m of question.matchAll(new RegExp(CONST_ARITH_PAT.source, "g"))) {
    const mName = allMeas[m[1].toLowerCase()];
    if (mName) {
      const num = parseFloat(m[3]);
      derived.push({ name: `_calc_${mName}_${m[2]}_${num}`, label: `${mName} ${m[2]} ${num}`,
        type: "meas_op_const", measure: mName, op: m[2], value: num });
      selectMeas.add(mName);
    }
  }
  for (const m of question.matchAll(new RegExp(PCT_PATTERN.source, "gi"))) {
    const mName = allMeas[m[1].toLowerCase()];
    if (mName) {
      derived.push({ name: `_calc_${mName}_pct`, label: `${mName} %`, type: "pct", measure: mName });
      selectMeas.add(mName);
    }
  }

  // ── Scale modifiers ────────────────────────────────────────────────────────
  const detectedUnits = [...question.matchAll(new RegExp(SCALE_KW_PATTERN.source, "gi"))]
    .map(m => m[1].toLowerCase());
  if (detectedUnits.length > 0) {
    for (const unit of detectedUnits) {
      const divisor = SCALE_VALUES[unit];
      for (const [nameLow, name] of Object.entries({ ...measNames, ...measLabels })) {
        if (q.includes(nameLow)) { scaleMap[name] = { divisor, unit }; selectMeas.add(name); }
      }
    }
    if (Object.keys(scaleMap).length === 0 && metadata.measures.length > 0) {
      const first = metadata.measures[0].name;
      scaleMap[first] = { divisor: SCALE_VALUES[detectedUnits[0]], unit: detectedUnits[0] };
      selectMeas.add(first);
    }
  }

  // ── Sort direction detection ───────────────────────────────────────────────
  // "X gore sirala"
  const goreM = /\b(\w+)\s+gore\b/i.exec(q);
  if (goreM) {
    const meas = measNames[goreM[1].toLowerCase()] || measLabels[goreM[1].toLowerCase()];
    if (meas) { sortOverride = meas; orderby = true; sortDir = "desc"; }
  }
  // "en az <measure>"
  const enazM = /\ben\s+az\s+(\w+)/i.exec(q);
  if (enazM) {
    const meas = measNames[enazM[1].toLowerCase()] || measLabels[enazM[1].toLowerCase()];
    if (meas) { sortOverride = meas; sortDir = "asc"; orderby = true; }
  }
  // "en büyük düşüş" → stream_change asc
  if (/\ben\s+(?:b[uü]y[uü]k|cok|fazla|yuksek)\s+(?:d[uü][sş][uü][sş]\w*|d[uü][sş][uü]\w*|gerileme\w*)/i.test(question)) {
    if (changeField) { sortOverride = changeField; sortDir = "asc"; orderby = true; }
  }
  // "en pozitif <measure>"
  const enpozM = /\ben\s+pozitif\s+(\w+)/i.exec(q);
  if (enpozM) {
    const meas = measNames[enpozM[1].toLowerCase()] || measLabels[enpozM[1].toLowerCase()];
    if (meas) sortOverride = meas;
    sortDir = "desc"; orderby = true;
  }
  // "en çok/fazla/yüksek <measure>"
  const encokM = /\ben\s+(?:cok|fazla|yuksek|buyuk)\s+(\w+)/i.exec(q);
  if (encokM && !orderby) {
    const meas = measNames[encokM[1].toLowerCase()] || measLabels[encokM[1].toLowerCase()];
    if (meas) sortOverride = meas;
    sortDir = "desc"; orderby = true;
  }
  // "en çok düşen <measure>"
  const dusenM = /\ben\s+(?:cok|fazla)?\s*(?:dusen|düşen|azalan|gerileyen)\s+(\w+)/i.exec(q);
  if (dusenM) {
    const meas = measNames[dusenM[1].toLowerCase()] || measLabels[dusenM[1].toLowerCase()];
    if (meas) sortOverride = meas;
    sortDir = "asc"; orderby = true;
  }
  // "en çok artan <measure/dim>"
  const artanM = /\ben\s+(?:cok|fazla)?\s*(?:artan|yukselenl?|artis)\s+(\w+)/i.exec(q);
  if (artanM) {
    const meas = measNames[artanM[1].toLowerCase()] || measLabels[artanM[1].toLowerCase()];
    sortOverride = meas || changeField || null;
    sortDir = "desc"; orderby = true;
  }
  // Büyüme gösteren → sort by change desc
  if (BUYUME_PAT.test(question) && !sortOverride && changeField) {
    sortOverride = changeField; sortDir = "desc"; orderby = true;
  }
  // Fallback keyword detection
  if (!orderby) {
    for (const kw of SORT_DESC_KW) {
      if (re(`(?<!\\w)${escapeRe(kw)}(?!\\w)`).test(q)) { sortDir = "desc"; orderby = true; break; }
    }
  }
  if (!orderby) {
    for (const kw of SORT_ASC_KW) {
      if (re(`(?<!\\w)${escapeRe(kw)}(?!\\w)`).test(q)) { sortDir = "asc"; orderby = true; break; }
    }
  }

  // ── Chart type detection ───────────────────────────────────────────────────
  for (const [type, keywords] of Object.entries(CHART_TYPES)) {
    for (const kw of keywords) {
      if (q.includes(kw)) { chartType = type; break; }
    }
    if (chartType) break;
  }
  if (!chartType) {
    for (const kw of GENERIC_CHART_KW) {
      if (q.includes(kw)) { chartType = "bar"; break; }
    }
  }

  // ── Remove filtered dimensions from grouping ──────────────────────────────
  for (const f of filters) {
    if (selectDims.has(f.field)) selectDims.delete(f.field);
  }

  // ── Defaults ────────────────────────────────────────────────────────────
  if (selectMeas.size === 0 && metadata.measures.length > 0)
    selectMeas.add(metadata.measures[0].name);

  if (aggMap["__count__"] === "count" && selectDims.size > 1) {
    const bazindaDims = new Set();
    const byPat2 = /\b(\w+)\s+(?:baz[iı]nda|bazli|bazl[iı]|gore|göre)\b/gi;
    for (const m of question.matchAll(byPat2)) {
      const matched = dimNames[m[1].toLowerCase()] || dimLabels[m[1].toLowerCase()];
      if (matched) bazindaDims.add(matched);
    }
    const hangiPat2 = /\bhangi\s+(\w+)/gi;
    for (const m of question.matchAll(hangiPat2)) {
      const matched = dimNames[m[1].toLowerCase()] || dimLabels[m[1].toLowerCase()];
      if (matched) bazindaDims.add(matched);
    }
    if (bazindaDims.size > 0) {
      selectDims.clear();
      for (const d of bazindaDims) selectDims.add(d);
    }
  }

  if (selectDims.size === 0) {
    const nonVersion = metadata.dimensions.filter(d => d.name !== "Version");
    if (nonVersion.length > 0) selectDims.add(nonVersion[0].name);
  }

  const sortMeas = sortOverride || (selectMeas.size > 0 ? [...selectMeas][0] : null);
  const orderbyFinal = (orderby && sortMeas)
    ? { field: sortMeas, dir: sortDir }
    : null;

  return {
    filters,
    dimensions: [...selectDims],
    measures:   [...selectMeas],
    top,
    orderby:    orderbyFinal,
    chart_type: chartType,
    scale:      scaleMap,
    agg:        aggMap,
    derived,
  };
}
