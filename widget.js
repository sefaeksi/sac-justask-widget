// Capture base URL BEFORE IIFE so dynamic script load works
const _WIDGET_BASE = (function () {
  const s = document.currentScript;
  if (s && s.src) return s.src.replace(/\/[^/]*$/, "/");
  // fallback: scan all scripts for widget.js
  const scripts = document.querySelectorAll("script[src]");
  for (const sc of scripts) {
    if (sc.src.includes("widget.js"))
      return sc.src.replace(/\/[^/]*$/, "/");
  }
  return "";
})();

(function () {
  "use strict";

  // =========================================================================
  // CHART.JS — dynamic loader with CDN fallback
  // =========================================================================
  function _loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  let _chartJsReady = (async () => {
    if (typeof Chart !== "undefined") return;
    // 1) local chart.min.js (from ZIP)
    const local = await _loadScript(_WIDGET_BASE + "chart.min.js");
    if (typeof Chart !== "undefined") return;
    // 2) CDN fallback
    if (!local) await _loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js");
  })();

  // =========================================================================
  // ALIASES
  // =========================================================================
  const DIM_ALIASES = {
    "sarki":"track_name","şarkı":"track_name","parcalar":"track_name","parça":"track_name","parca":"track_name","muzik":"track_name",
    "tur":"genre","tür":"genre","muzik turu":"genre","muzik türü":"genre","kategori":"genre","turler":"genre","türler":"genre","turlere":"genre","türlere":"genre","turunde":"genre","türünde":"genre",
    "ulke":"country","ülke":"country","ulkeler":"country","ulkeyi":"country","ülkeyi":"country","ulkeleri":"country","ülkeleri":"country","bolge":"country","bölge":"country",
    "yön":"trend","yon":"trend","durum":"trend","egilim":"trend","eğilim":"trend",
    "sanatci":"artist_name","sanatçı":"artist_name","sanatcilar":"artist_name","sanatçılar":"artist_name","sanatcinin":"artist_name","sanatçının":"artist_name",
    "populerlik kategorisi":"popularity_category","popülerlik kategorisi":"popularity_category","populerlik":"popularity_category","popülerlik":"popularity_category",
  };
  const MEAS_ALIASES = {
    "dinlenme":"streams","dinleme":"streams","stream sayisi":"streams","stream sayısı":"streams",
    "viral skor":"viral_score","viral skoru":"viral_score","virality":"viral_score","popülarite":"viral_score",
    "stream degisimi":"stream_change","stream değişimi":"stream_change","degisim":"stream_change","değişim":"stream_change",
    "artis":"stream_change","artış":"stream_change","dusus":"stream_change","düşüş":"stream_change","buyume":"stream_change","büyüme":"stream_change",
    "kalicilik":"longevity","kalıcılık":"longevity",
  };

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function applyAliases(q, dimFieldSet, measFieldSet) {
    let out = q;
    Object.entries(MEAS_ALIASES).sort((a,b)=>b[0].length-a[0].length).forEach(([al,real])=>{
      if (measFieldSet.has(real.toLowerCase()))
        out = out.replace(new RegExp("(?<!\\w)"+escapeRe(al)+"(?!\\w)","gi"), real);
    });
    Object.entries(DIM_ALIASES).sort((a,b)=>b[0].length-a[0].length).forEach(([al,real])=>{
      if (dimFieldSet.has(real.toLowerCase()))
        out = out.replace(new RegExp("(?<!\\w)"+escapeRe(al)+"(?!\\w)","gi"), real);
    });
    return out;
  }

  // =========================================================================
  // KEYWORDS
  // =========================================================================
  const SORT_DESC_KW = new Set(["highest","largest","biggest","en yüksek","en buyuk","en büyük","max","en fazla","en cok","en çok","en yuksek","descending","en populer","en popüler","en iyi","en viral"]);
  const SORT_ASC_KW  = new Set(["lowest","smallest","en düşük","en dusuk","en küçük","en kucuk","min","ascending"]);
  const CHART_TYPES  = {
    bar:["bar","bar chart","çubuk","çubuk grafik","sütun grafik","bar grafik"],
    hbar:["horizontal bar","yatay çubuk","yatay bar"],
    line:["line","line chart","çizgi","cizgi","çizgi grafik"],
    pie:["pie","pie chart","pasta","pasta grafik","daire grafik"],
    stacked:["stacked","stacked bar","yığılmış","yigilmis"],
    area:["area","area chart","alan","alan grafik"],
    table:["tablo","table","liste","hepsi","tümü"],
  };
  const GENERIC_CHART_KW = new Set(["grafik","chart","görselleştir","visualize","graph","plot"]);
  const SCALE_VALUES = {"bin":1000,"bın":1000,"thousand":1000,"milyon":1000000,"million":1000000,"milyar":1000000000,"billion":1000000000};
  const COUNTRY_ABBR = {"abd":"US","usa":"US","uk":"GB","ingiltere":"GB","almanya":"DE","fransa":"FR","japonya":"JP","kore":"KR","avustralya":"AU","italya":"IT","ispanya":"ES","brezilya":"BR","turkiye":"TR","türkiye":"TR","rusya":"RU","cin":"CN","hindistan":"IN","meksika":"MX","kanada":"CA"};
  const AGG_KEYWORDS = {"avg":"avg","average":"avg","ortalama":"avg","ort":"avg","max":"max","maximum":"max","min":"min","minimum":"min","count":"count","adet":"count","sayı":"count","sayi":"count"};

  // =========================================================================
  // PARSER
  // =========================================================================
  function editDist(a,b){const dp=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){let p=dp[0];dp[0]=i+1;for(let j=0;j<b.length;j++){const t=dp[j+1];dp[j+1]=a[i]===b[j]?p:1+Math.min(p,dp[j],dp[j+1]);p=t;}}return dp[b.length];}
  function simil(a,b){const l=Math.max(a.length,b.length);return l===0?1:(l-editDist(a,b))/l;}
  function closest(w,cands,cut=0.82){let best=null,bs=0;for(const c of cands){const s=simil(w,c);if(s>bs&&s>=cut){bs=s;best=c;}}return best;}

  function findChangeMeasure(mn,ml){const kw=["change","degisim","değişim","stream_change"];for(const[k,v]of Object.entries({...mn,...ml})){if(kw.some(w=>k.includes(w)))return v;}return null;}
  function findTrendDim(dn,dl){const kw=["trend","status","durum","egilim"];if(dn["trend"])return dn["trend"];for(const[k,v]of Object.entries({...dn,...dl})){if(kw.some(w=>k.includes(w)))return v;}return null;}

  function parseQuestion(question, metadata) {
    let q = question.toLowerCase().replace(/coc/g,"cok").replace(/cöc/g,"çok");
    const dn={},dl={},mn={},ml={};
    for(const d of metadata.dimensions){dn[d.name.toLowerCase()]=d.name;dl[d.label.toLowerCase()]=d.name;}
    for(const m of metadata.measures){mn[m.name.toLowerCase()]=m.name;ml[m.label.toLowerCase()]=m.name;}
    const dfs=new Set(Object.values(dn).map(v=>v.toLowerCase()));
    const mfs=new Set(Object.values(mn).map(v=>v.toLowerCase()));
    const changeField=findChangeMeasure(mn,ml), trendField=findTrendDim(dn,dl);
    q=applyAliases(q,dfs,mfs);

    const filters=[],sd=new Set(),sm=new Set();
    let top=50,orderby=null,sortDir="desc",chartType=null,topMatch=false,sortOverride=null;
    const aggMap={},scaleMap={};

    if(/^(?:all|tümü|tumü|tumu|hepsi|hepsini|tüm)$/.test(q.trim())||q.trim()==="")
      return{filters:[],derived:[],scale:{},agg:{},dimensions:metadata.dimensions.filter(d=>d.name!=="Version").map(d=>d.name),measures:metadata.measures.map(m=>m.name),top:1000,orderby:null,chart_type:"table"};

    // Year
    for(const m of q.matchAll(/\b(20[0-3]\d)\b/g)){
      if(metadata.dimensions.some(d=>d.name==="Date"))filters.push({field:"Date",op:"startswith",value:m[1]});
      else if(metadata.dimensions.some(d=>d.name==="GJAHR"))filters.push({field:"GJAHR",op:"eq",value:m[1]});
    }
    // Numeric filters — symbol-based: "Goals > 10"
    for(const src of[question,q]){
      for(const m of src.matchAll(/\b(\w+)\s*([><=!]{1,2})\s*(\d+(?:[.,]\d+)?)/gi)){
        const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
        if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:m[2],value:parseFloat(m[3].replace(",",".")),kind:"numeric"});
      }
    }
    // Turkish comparison: "Goals 10'dan büyük/fazla/yüksek" → Goals > 10
    for(const m of q.matchAll(/\b(\w+)\s+(\d+(?:[.,]\d+)?)[''']?(?:dan|den|tan|ten)\s+(?:büyük|buyuk|fazla|yüksek|yuksek|daha\s*fazla|büyükeş|büyükeşit)/gi)){
      const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
      if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:">",value:parseFloat(m[2].replace(",",".")),kind:"numeric"});
    }
    // Turkish comparison: "Goals 10'dan küçük/az/düşük" → Goals < 10
    for(const m of q.matchAll(/\b(\w+)\s+(\d+(?:[.,]\d+)?)[''']?(?:dan|den|tan|ten)\s+(?:küçük|kucuk|az|düşük|dusuk|daha\s*az)/gi)){
      const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
      if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:"<",value:parseFloat(m[2].replace(",",".")),kind:"numeric"});
    }
    // "Goals en az 10" / "en az 10 Goals" → Goals >= 10
    for(const m of q.matchAll(/\b(\w+)\s+en\s+az\s+(\d+(?:[.,]\d+)?)/gi)){
      const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
      if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:">=",value:parseFloat(m[2].replace(",",".")),kind:"numeric"});
    }
    for(const m of q.matchAll(/\ben\s+az\s+(\d+(?:[.,]\d+)?)\s+(\w+)/gi)){
      const meas=mn[m[2].toLowerCase()]||ml[m[2].toLowerCase()];
      if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:">=",value:parseFloat(m[1].replace(",",".")),kind:"numeric"});
    }
    // "Goals en fazla 10" → Goals <= 10
    for(const m of q.matchAll(/\b(\w+)\s+en\s+fazla\s+(\d+(?:[.,]\d+)?)/gi)){
      const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
      if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:"<=",value:parseFloat(m[2].replace(",",".")),kind:"numeric"});
    }
    // "Goals N veya daha fazla/büyük" → Goals >= N
    for(const m of q.matchAll(/\b(\w+)\s+(\d+(?:[.,]\d+)?)\s+(?:veya\s+)?daha\s+(?:fazla|büyük|buyuk|yüksek|yuksek)/gi)){
      const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
      if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:">=",value:parseFloat(m[2].replace(",",".")),kind:"numeric"});
    }
    // "N ile M arasında Goals" / "Goals N ile M arasında" → N <= Goals <= M
    for(const m of q.matchAll(/\b(\w+)\s+(\d+)\s+ile\s+(\d+)\s+aras[iı]nda/gi)){
      const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];
      if(meas){if(!filters.some(f=>f.field===meas&&f.op===">="))filters.push({field:meas,op:">=",value:parseFloat(m[2]),kind:"numeric"});
               if(!filters.some(f=>f.field===meas&&f.op==="<="))filters.push({field:meas,op:"<=",value:parseFloat(m[3]),kind:"numeric"});}
    }
    for(const m of q.matchAll(/\b(\d+)\s+ile\s+(\d+)\s+aras[iı]nda\s+(\w+)/gi)){
      const meas=mn[m[3].toLowerCase()]||ml[m[3].toLowerCase()];
      if(meas){if(!filters.some(f=>f.field===meas&&f.op===">="))filters.push({field:meas,op:">=",value:parseFloat(m[1]),kind:"numeric"});
               if(!filters.some(f=>f.field===meas&&f.op==="<="))filters.push({field:meas,op:"<=",value:parseFloat(m[2]),kind:"numeric"});}
    }
    // pozitif/negatif
    for(const m of q.matchAll(/\b(\w+)\s+pozitif\b/gi)){const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:">",value:0,kind:"numeric"});}
    for(const m of q.matchAll(/\b(\w+)\s+negatif\b/gi)){const meas=mn[m[1].toLowerCase()]||ml[m[1].toLowerCase()];if(meas&&!filters.some(f=>f.field===meas))filters.push({field:meas,op:"<",value:0,kind:"numeric"});}
    // Rising
    if(/\b(?:yukselis\w*|yükseliş\w*|artan|yukselen|yükselen)\b/i.test(question)&&changeField&&!filters.some(f=>f.field===changeField)){filters.push({field:changeField,op:">",value:0,kind:"numeric"});sm.add(changeField);}
    // Country
    if(dn["country"]){for(const[abbr,code]of Object.entries(COUNTRY_ABBR)){if(new RegExp("(?<!\\w)"+escapeRe(abbr)+"(?!\\w)","i").test(question)&&!filters.some(f=>f.field==="country")){filters.push({field:"country",op:"eq",value:code});break;}}}

    // Detect fields
    for(const[nl,n]of Object.entries(dn)){if(q.includes(nl)&&n!=="Version")sd.add(n);}
    for(const[ll,n]of Object.entries(dl)){if(q.includes(ll)&&n!=="Version")sd.add(n);}
    for(const[nl,n]of Object.entries(mn)){if(q.includes(nl))sm.add(n);}
    for(const[ll,n]of Object.entries(ml)){if(q.includes(ll))sm.add(n);}
    // Fuzzy
    const allNL=[...Object.keys(dn),...Object.keys(dl),...Object.keys(mn),...Object.keys(ml)];
    const allL={...dn,...dl,...mn,...ml};
    for(const m of q.matchAll(/\w+/g)){const wl=m[0];if(allL[wl])continue;const best=closest(wl,allNL);if(best){const matched=allL[best];if(!matched||matched==="Version")continue;if(dn[best]||dl[best])sd.add(matched);else sm.add(matched);}}
    // by X / X bazında
    for(const m of q.matchAll(/\b(?:by|baz[iı]nda|bazli|bazl[iı]|göre|gore)\s+(\w+)/gi)){const w=m[1].toLowerCase();if(dn[w])sd.add(dn[w]);else if(dl[w])sd.add(dl[w]);}
    for(const m of q.matchAll(/\b(\w+)\s+(?:baz[iı]nda|bazli|bazl[iı]|göre|gore)\b/gi)){const w=m[1].toLowerCase();if(dn[w])sd.add(dn[w]);else if(dl[w])sd.add(dl[w]);}
    // hangi X
    for(const m of question.matchAll(/\bhangi\s+(\w+)/gi)){const matched=dn[m[1].toLowerCase()]||dl[m[1].toLowerCase()];if(matched&&matched!=="Version")sd.add(matched);}
    // Top N
    const topM=/\b(?:top|first|ilk)\s*(\d+)/i.exec(q);
    if(topM){top=parseInt(topM[1],10);topMatch=true;}
    if(!topMatch){const cm=/\b(\d+)\s+(?:sarki\w*|parca\w*|sanatci\w*|muzik\w*|parça\w*|şarkı\w*|tane\b|ulke\w*|ülke\w*|tur\b|tür\b)/i.exec(question.toLowerCase());if(cm){top=parseInt(cm[1],10);topMatch=true;}}
    if(!topMatch&&/\b(?:hangisi|nedir|kimdir|ne|kim)\s*\??\s*$/i.test(question.trim()))top=1;
    // Aggregation
    for(const m of question.matchAll(new RegExp("\\b("+Object.keys(AGG_KEYWORDS).join("|")+")\\s+(\\w+)","gi"))){const func=AGG_KEYWORDS[m[1].toLowerCase()],meas=mn[m[2].toLowerCase()]||ml[m[2].toLowerCase()];if(meas){aggMap[meas]=func;sm.add(meas);}}
    // Scale
    const unitMs=[...question.matchAll(/\b(bin|bın|thousand|milyon|million|milyar|billion)\b/gi)].map(m=>m[1].toLowerCase());
    if(unitMs.length>0){for(const u of unitMs){const d=SCALE_VALUES[u];for(const[nl,n]of Object.entries({...mn,...ml})){if(q.includes(nl)){scaleMap[n]={divisor:d,unit:u};sm.add(n);}}}if(Object.keys(scaleMap).length===0&&metadata.measures.length>0){const f=metadata.measures[0].name;scaleMap[f]={divisor:SCALE_VALUES[unitMs[0]],unit:unitMs[0]};sm.add(f);}}
    // Sort
    const goreM=/\b(\w+)\s+gore\b/i.exec(q);if(goreM){const meas=mn[goreM[1].toLowerCase()]||ml[goreM[1].toLowerCase()];if(meas){sortOverride=meas;orderby=true;sortDir="desc";}}
    const enazM=/\ben\s+az\s+(\w+)/i.exec(q);if(enazM){const meas=mn[enazM[1].toLowerCase()]||ml[enazM[1].toLowerCase()];if(meas){sortOverride=meas;sortDir="asc";orderby=true;}}
    const encokM=/\ben\s+(?:cok|fazla|yuksek|buyuk)\s+(\w+)/i.exec(q);if(encokM&&!orderby){const meas=mn[encokM[1].toLowerCase()]||ml[encokM[1].toLowerCase()];if(meas)sortOverride=meas;sortDir="desc";orderby=true;}
    const dusenM=/\ben\s+(?:cok|fazla)?\s*(?:dusen|düşen|azalan)\s+(\w+)/i.exec(q);if(dusenM){const meas=mn[dusenM[1].toLowerCase()]||ml[dusenM[1].toLowerCase()];if(meas)sortOverride=meas;sortDir="asc";orderby=true;}
    if(!orderby){for(const kw of SORT_DESC_KW){if(new RegExp("(?<!\\w)"+escapeRe(kw)+"(?!\\w)").test(q)){sortDir="desc";orderby=true;break;}}}
    if(!orderby){for(const kw of SORT_ASC_KW){if(new RegExp("(?<!\\w)"+escapeRe(kw)+"(?!\\w)").test(q)){sortDir="asc";orderby=true;break;}}}
    // Chart type
    for(const[type,kws]of Object.entries(CHART_TYPES)){for(const kw of kws){if(q.includes(kw)){chartType=type;break;}}if(chartType)break;}
    if(!chartType){for(const kw of GENERIC_CHART_KW){if(q.includes(kw)){chartType="bar";break;}}}
    // Remove filtered dims
    for(const f of filters){if(sd.has(f.field))sd.delete(f.field);}
    // Defaults
    if(sm.size===0&&metadata.measures.length>0)sm.add(metadata.measures[0].name);
    if(sd.size===0){const nv=metadata.dimensions.filter(d=>d.name!=="Version");if(nv.length>0)sd.add(nv[0].name);}
    const sortMeas=sortOverride||(sm.size>0?[...sm][0]:null);
    const orderbyFinal=(orderby&&sortMeas)?{field:sortMeas,dir:sortDir}:null;
    return{filters,dimensions:[...sd],measures:[...sm],top,orderby:orderbyFinal,chart_type:chartType,scale:scaleMap,agg:aggMap,derived:[]};
  }

  // =========================================================================
  // CLIENT-SIDE PLAN APPLICATION
  // =========================================================================
  function applyPlan(rows, plan) {
    let data = [...rows];
    for (const f of plan.filters) {
      data = data.filter(row => {
        const val = row[f.field];
        if (f.kind === "numeric") {
          const n = typeof val === "object" ? parseFloat(val?.raw ?? val?.value ?? 0) : parseFloat(val);
          if (isNaN(n)) return false;
          if (f.op === ">")  return n > f.value;
          if (f.op === ">=") return n >= f.value;
          if (f.op === "<")  return n < f.value;
          if (f.op === "<=") return n <= f.value;
          if (f.op === "!=" || f.op === "<>") return n !== f.value;
          return n === f.value;
        }
        if (f.op === "eq") return String(val||"").toLowerCase() === String(f.value).toLowerCase();
        if (f.op === "startswith") return String(val||"").startsWith(String(f.value));
        return true;
      });
    }
    if (plan.orderby) {
      const { field, dir } = plan.orderby;
      data.sort((a, b) => {
        const av = parseFloat(a[field]) || 0, bv = parseFloat(b[field]) || 0;
        return dir === "desc" ? bv - av : av - bv;
      });
    }
    return data.slice(0, plan.top);
  }

  // =========================================================================
  // RENDERER
  // =========================================================================
  const SAC_COLORS = ["#0070F2","#E8A000","#5C8A00","#BB0000","#6E4B7B","#0040B0","#C87D00","#3D6600","#8C0000","#4A3356","#00A3E0","#F0C000","#7CB000","#D04040","#9060A0"];

  function fmt(val, scale) {
    if (val===null||val===undefined) return "—";
    if (typeof val==="string") return val;
    if (scale&&scale.divisor) return (val/scale.divisor).toLocaleString("tr-TR",{maximumFractionDigits:2})+" "+scale.unit;
    if (Math.abs(val)>=1000000) return (val/1000000).toLocaleString("tr-TR",{maximumFractionDigits:1})+"M";
    if (Math.abs(val)>=1000)    return (val/1000).toLocaleString("tr-TR",{maximumFractionDigits:1})+"K";
    return Number(val).toLocaleString("tr-TR",{maximumFractionDigits:2});
  }

  function buildTable(data, plan, metadata) {
    const dims  = plan.dimensions.length ? plan.dimensions : (metadata.dimensions||[]).map(d=>d.name);
    const meas  = plan.measures.length   ? plan.measures   : (metadata.measures||[]).map(m=>m.name);
    const cols  = [...dims, ...meas];
    const labelOf = {};
    (metadata.dimensions||[]).forEach(d=>labelOf[d.name]=d.label||d.name);
    (metadata.measures||[]).forEach(m=>labelOf[m.name]=m.label||m.name);
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;height:100%;overflow:auto;box-sizing:border-box;";
    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px;";
    const hr = table.createTHead().insertRow();
    cols.forEach(c=>{ const th=document.createElement("th"); th.textContent=labelOf[c]||c; th.style.cssText="padding:6px 8px;background:#0070F2;color:#fff;text-align:left;white-space:nowrap;position:sticky;top:0;"; hr.appendChild(th); });
    const tb = table.createTBody();
    data.forEach((row,i)=>{ const tr=tb.insertRow(); tr.style.background=i%2===0?"#fff":"#f7f7f7"; cols.forEach(c=>{ const td=tr.insertCell(); const v=row[c]; td.textContent=typeof v==="number"?fmt(v,plan.scale&&plan.scale[c]):(v??"—"); td.style.cssText="padding:5px 8px;border-bottom:1px solid #e0e0e0;"; }); });
    wrap.appendChild(table);
    return wrap;
  }

  function renderChart(container, data, plan, metadata) {
    container.innerHTML = "";
    if (!data||data.length===0) { container.innerHTML='<div style="padding:24px;color:#999;text-align:center;">Sonuç bulunamadı.</div>'; return null; }
    const type = plan.chart_type || "bar";
    if (type === "table") { container.appendChild(buildTable(data,plan,metadata)); return null; }
    if (typeof Chart === "undefined") { container.innerHTML='<div style="padding:12px;color:#c00;font-size:12px;">Chart.js yüklenemedi. Tablo görünümünü deneyin.</div>'; return null; }
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    container.appendChild(canvas);
    const dim = plan.dimensions[0], meas = plan.measures[0];
    const scale = plan.scale&&plan.scale[meas]?plan.scale[meas]:null;
    const labels = data.map(r=>r[dim]??"—");
    const values = data.map(r=>{ const v=r[meas]; return scale?v/scale.divisor:(v??0); });
    let cfg;
    if (type==="pie") {
      cfg={type:"pie",data:{labels,datasets:[{data:values,backgroundColor:SAC_COLORS.slice(0,labels.length).map(c=>c+"CC"),borderColor:"#fff",borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"right"}}}};
    } else if (type==="line"||type==="area") {
      cfg={type:"line",data:{labels,datasets:[{label:meas,data:values,borderColor:SAC_COLORS[0],backgroundColor:SAC_COLORS[0]+"33",tension:0.3,fill:type==="area"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#333",maxRotation:45}},y:{ticks:{color:"#333"}}}}};
    } else {
      cfg={type:"bar",data:{labels,datasets:[{label:meas,data:values,backgroundColor:SAC_COLORS.slice(0,labels.length).map(c=>c+"CC"),borderColor:SAC_COLORS.slice(0,labels.length),borderWidth:1}]},options:{indexAxis:type==="hbar"?"y":"x",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{stacked:type==="stacked",ticks:{color:"#333",maxRotation:45}},y:{stacked:type==="stacked",ticks:{color:"#333"}}}}};
    }
    return new Chart(canvas, cfg);
  }

  // =========================================================================
  // WEB COMPONENT
  // =========================================================================
  class JustAskWidget extends HTMLElement {
    constructor() {
      super();
      this._root = this.attachShadow({ mode:"open" });
      this._metadata = { dimensions:[], measures:[] };
      this._allRows   = [];   // full data from SAC binding
      this._lastPlan  = null;
      this._chartInst = null;
      this._maxRows   = 50;
      this._chartType = null;
      this._lastQ     = "";
    }

    // ── SAC lifecycle ──────────────────────────────────────────────────────
    onCustomWidgetBeforeUpdate(changed) {
      if ("maxRows" in changed) this._maxRows = parseInt(changed.maxRows.newVal,10)||50;
      if ("defaultChartType" in changed) this._chartType = changed.defaultChartType.newVal||null;
      if ("dimensionNames" in changed) this._applyNameConfig(changed.dimensionNames.newVal, null);
      if ("measureNames"   in changed) this._applyNameConfig(null, changed.measureNames.newVal);
    }

    // Apply comma-separated name strings to _metadata labels
    _applyNameConfig(dimStr, measStr) {
      if (dimStr !== null && dimStr !== undefined) {
        const names = dimStr.split(",").map(s => s.trim()).filter(Boolean);
        names.forEach((lbl, i) => {
          const key = "dimensions_" + i;
          const entry = this._metadata.dimensions.find(d => d.name === key);
          if (entry) entry.label = lbl;
          else this._metadata.dimensions.push({ name: key, label: lbl, type: "string" });
        });
        this._savedDimNames = dimStr;
      }
      if (measStr !== null && measStr !== undefined) {
        const names = measStr.split(",").map(s => s.trim()).filter(Boolean);
        names.forEach((lbl, i) => {
          const key = "measures_" + i;
          const entry = this._metadata.measures.find(m => m.name === key);
          if (entry) entry.label = lbl;
          else this._metadata.measures.push({ name: key, label: lbl, type: "decimal" });
        });
        this._savedMeasNames = measStr;
      }
    }

    // Persist / restore field names via localStorage
    _saveNames(dimStr, measStr) {
      try {
        const key = "justask_names_" + (this.id || "default");
        localStorage.setItem(key, JSON.stringify({ dims: dimStr, meas: measStr }));
      } catch(e) {}
    }
    _loadNames() {
      try {
        const key = "justask_names_" + (this.id || "default");
        return JSON.parse(localStorage.getItem(key) || "{}");
      } catch(e) { return {}; }
    }

    // Property setter — SAC new SDK injects data this way (key = binding name)
    set myDataSource(dataBinding) {
      this._onBinding(dataBinding);
    }

    // Lifecycle callbacks — SAC old SDK
    onDataBindingInit(dataBinding)   { this._onBinding(dataBinding); }
    onDataBindingUpdate(dataBinding) { this._onBinding(dataBinding); }

    _onBinding(dataBinding) {
      if (!dataBinding) return;
      this._dataBinding = dataBinding;
      this._extractMeta(dataBinding);
      const state = dataBinding.state;
      // state can be: 'loading', 'success', 'error', 'noData', or undefined (old SDK)
      if (!state || state === "success") {
        this._extractRows(dataBinding);
        if (this._lastQ) this._runQuery(this._lastQ);
        this._setStatus(
          this._allRows.length
            ? this._allRows.length + " satır yüklendi. Soru yazıp Sorgula'ya tıklayın."
            : "Veri bağlandı. Soru yazıp Sorgula'ya tıklayın."
        );
      } else if (state === "loading") {
        this._setStatus("Veri yükleniyor…");
      } else if (state === "noData") {
        this._setStatus("Veri yok — Builder'da model seçin.");
      }
    }

    connectedCallback() { this._render(); }

    // ── Metadata extraction — supports both old and new SAC SDK ───────────
    _extractMeta(db) {
      try {
        // Dump the full binding object so we can see its shape
        try {
          const dbDump = JSON.stringify(db, null, 0);
          console.log("[JustAsk] db dump:", dbDump.slice(0, 1200));
        } catch(e) {
          const dbKeys = [];
          for (const k in db) dbKeys.push(k + "=" + typeof db[k]);
          console.log("[JustAsk] db keys (for-in):", dbKeys.join(", "));
          try { console.log("[JustAsk] db.metadata:", JSON.stringify(db.metadata)?.slice(0, 800)); } catch(e2){}
        }

        const md = db.metadata;
        const mdKeys = Object.keys(md || {});
        console.log("[JustAsk] metadata keys:", JSON.stringify(mdKeys));
        // Log ALL metadata keys and their content to find where labels live
        for (const k of mdKeys) {
          if (k !== "feeds") console.log("[JustAsk] md." + k + ":", JSON.stringify(md[k])?.slice(0, 400));
        }
        console.log("[JustAsk] feeds raw:", JSON.stringify(md?.feeds)?.slice(0, 500));

        const toMeta = (arr, type) => (arr || []).map(v => {
          if (!v) return null;
          if (typeof v === "string") return { name: v, label: v, type };
          // v.key is the data-row key (e.g. "dimensions_0"); prefer it over v.id
          const name  = v.key || v.id || v.name || null;
          const label = v.description || v.label || v.text || v.id || name;
          return name ? { name, label: label || name, type } : null;
        }).filter(Boolean);

        // Path 1: feeds.{feedId}.values — new SAC SDK (Optimized Story)
        const feeds = md?.feeds;
        let dimVals  = feeds?.dimensions?.values  || feeds?.Dimensions?.values  || [];
        let measVals = feeds?.measures?.values    || feeds?.Measures?.values    || feeds?.mainStructureMembers?.values || [];

        // If nothing found yet, scan every feed key for arrays of metadata entries
        if (!dimVals.length && !measVals.length && feeds && typeof feeds === "object") {
          const feedKeys = Object.keys(feeds);
          console.log("[JustAsk] feed keys:", feedKeys);
          for (const fk of feedKeys) {
            const arr = feeds[fk]?.values || feeds[fk];
            if (Array.isArray(arr) && arr.length) {
              // Heuristic: if any item has 'raw', it's a measure; otherwise dimension
              const hasMeasure = arr.some(x => x && typeof x === "object" && ("raw" in x || x.type === "Measure" || /measure/i.test(x.type||"")));
              if (hasMeasure) measVals = [...measVals, ...arr];
              else            dimVals  = [...dimVals,  ...arr];
            }
          }
        }

        // Build from feeds (Path 1) — feeds only gives generic key strings in Optimized Story
        if (dimVals.length || measVals.length) {
          this._metadata = {
            dimensions: toMeta(dimVals,  "string"),
            measures:   toMeta(measVals, "decimal"),
          };
          console.log("[JustAsk] meta (feeds, no labels yet):", JSON.stringify(this._metadata));
          // Don't return yet — try to enrich with real labels from Path 3 below
        }

        // Path 2: md.dimensions / md.measures as arrays (some SAC versions)
        if (Array.isArray(md?.dimensions) && md.dimensions.length) {
          const fromMd = {
            dimensions: toMeta(md.dimensions, "string"),
            measures:   toMeta(md.measures || md.mainStructureMembers || [], "decimal"),
          };
          // Only use if we got real labels (label differs from name)
          if (fromMd.dimensions.some(d => d.label !== d.name)) {
            this._metadata = fromMd;
            console.log("[JustAsk] meta (md arrays):", JSON.stringify(this._metadata));
            return;
          }
        }

        // Path 3: getDataSource() — works in old SDK and some new SDK versions
        // Use it to enrich labels on top of feed-detected keys
        try {
          const ds = db.getDataSource?.();
          if (ds) {
            const dsDims  = (ds.getDimensions?.() || []);
            const dsMeas  = (ds.getMeasures?.()   || []);
            console.log("[JustAsk] getDataSource dims:", JSON.stringify(dsDims.map(d=>({id:d.getId?.(),desc:d.getDescription?.()}))));
            console.log("[JustAsk] getDataSource meas:", JSON.stringify(dsMeas.map(m=>({id:m.getId?.(),desc:m.getDescription?.()}))));
            // Build a label map: generic key (dimensions_0) → real label
            // Try to match by index (SAC preserves order)
            if (this._metadata.dimensions.length) {
              this._metadata.dimensions.forEach((d, i) => {
                const label = dsDims[i]?.getDescription?.() || dsDims[i]?.getId?.();
                if (label && label !== d.name) d.label = label;
              });
              this._metadata.measures.forEach((m, i) => {
                const label = dsMeas[i]?.getDescription?.() || dsMeas[i]?.getId?.();
                if (label && label !== m.name) m.label = label;
              });
              console.log("[JustAsk] meta enriched via getDataSource:", JSON.stringify(this._metadata));
            } else {
              // No feeds found — build purely from old SDK
              this._metadata = {
                dimensions: dsDims.map(d=>({name:d.getId?.(),label:d.getDescription?.()??d.getId?.(),type:"string"})).filter(d=>d.name),
                measures:   dsMeas.map(m=>({name:m.getId?.(),  label:m.getDescription?.()??m.getId?.(),  type:"decimal"})).filter(m=>m.name),
              };
              console.log("[JustAsk] meta (old SDK full):", JSON.stringify(this._metadata));
            }
            return;
          }
        } catch(e3) { console.warn("[JustAsk] getDataSource error:", e3.message); }

        if (this._metadata.dimensions.length || this._metadata.measures.length) return; // feeds were enough

        console.warn("[JustAsk] meta extraction failed — full metadata:", JSON.stringify(md)?.slice(0, 2000));
      } catch(e) { console.warn("[JustAsk] meta extract error:", e.message, e); }

      // Always apply saved/configured names on top of whatever was extracted
      const saved = this._loadNames();
      if (saved.dims) this._applyNameConfig(saved.dims, null);
      if (saved.meas) this._applyNameConfig(null, saved.meas);
    }

    // ── Row extraction from binding data ─────────────────────────────────
    _extractRows(db) {
      try {
        const raw = db.data || [];
        if (!raw.length) { this._allRows = []; return; }

        // Auto-detect all keys from first row if metadata is empty
        if (!this._metadata.dimensions.length && !this._metadata.measures.length) {
          const keys = Object.keys(raw[0]);
          const numKeys = keys.filter(k => typeof this._numVal(raw[0][k]) === "number");
          const strKeys = keys.filter(k => !numKeys.includes(k));

          // Try to enrich labels from any available metadata path
          const labelMap = {};
          const scanFeeds = (feedsObj) => {
            if (!feedsObj || typeof feedsObj !== "object") return;
            const feedKeys = Object.keys(feedsObj);
            for (const fk of feedKeys) {
              const feedVal = feedsObj[fk];
              const values = feedVal?.values || (Array.isArray(feedVal) ? feedVal : null);
              if (!values) continue;
              for (const v of values) {
                if (!v || typeof v !== "object") continue;
                const key = v.key || v.id || v.name;
                const lbl = v.description || v.label || v.text || v.id;
                if (key && lbl && key !== lbl) labelMap[key] = lbl;
              }
            }
          };
          // Try all likely paths in order
          scanFeeds(db?.metadata?.feeds);
          scanFeeds(db?.feeds);
          if (Array.isArray(db?.metadata?.feeds)) {
            for (const f of db.metadata.feeds) scanFeeds({ [f.id || f.key]: f });
          }
          console.log("[JustAsk] enriched labelMap:", JSON.stringify(labelMap));

          this._metadata.dimensions = strKeys.map(k => ({ name: k, label: labelMap[k] || k, type: "string" }));
          this._metadata.measures   = numKeys.map(k => ({ name: k, label: labelMap[k] || k, type: "decimal" }));
          console.log("[JustAsk] auto-detected meta:", JSON.stringify(this._metadata));
        }

        this._allRows = raw.map(row => {
          const obj = {};
          for (const d of this._metadata.dimensions) {
            const cell = row[d.name];
            obj[d.name] = cell == null ? null
              : typeof cell === "object" ? (cell.label ?? cell.description ?? cell.id ?? null)
              : String(cell);
          }
          for (const m of this._metadata.measures) {
            const cell = row[m.name];
            obj[m.name] = this._numVal(cell);
          }
          return obj;
        });
        console.log("[JustAsk] rows:", this._allRows.length, "sample:", JSON.stringify(this._allRows[0]));
      } catch(e) {
        this._allRows = [];
        console.warn("[JustAsk] row extract failed:", e);
      }
    }

    _numVal(cell) {
      if (cell == null) return 0;
      if (typeof cell === "number") return cell;
      if (typeof cell === "object") {
        const v = cell.raw ?? cell.value ?? cell.formattedValue;
        return parseFloat(v) || 0;
      }
      return parseFloat(cell) || 0;
    }

    // ── Render shell ──────────────────────────────────────────────────────
    _render() {
      this._root.innerHTML = `
        <style>
          :host{display:flex;flex-direction:column;width:100%;height:100%;font-family:"72","Helvetica Neue",Arial,sans-serif;font-size:13px;box-sizing:border-box;background:#fff;}
          .tb{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid #e5e5e5;align-items:center;flex-shrink:0;}
          .inp{flex:1;padding:6px 10px;border:1px solid #b0b0b0;border-radius:4px;font-size:13px;outline:none;}
          .inp:focus{border-color:#0070F2;}
          .btn{padding:6px 14px;background:#0070F2;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;}
          .btn:hover{background:#0058c8;}
          .btn.sec{background:#f0f0f0;color:#333;}
          .btn.sec:hover{background:#e0e0e0;}
          .btn.cfg{padding:6px 10px;background:#f0f0f0;color:#555;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:13px;}
          .btn.cfg:hover{background:#e0e0e0;}
          .types{display:flex;gap:4px;padding:4px 10px;border-bottom:1px solid #f0f0f0;flex-shrink:0;flex-wrap:wrap;}
          .tbtn{padding:3px 10px;border:1px solid #ccc;border-radius:12px;background:#fff;color:#555;cursor:pointer;font-size:11px;}
          .tbtn.active{background:#0070F2;color:#fff;border-color:#0070F2;}
          .cfg-panel{display:none;padding:8px 10px;border-bottom:1px solid #e5e5e5;background:#fafafa;flex-shrink:0;max-height:260px;overflow-y:auto;}
          .cfg-panel.open{display:block;}
          .cfg-section{font-size:11px;font-weight:bold;color:#0070F2;margin:6px 0 4px;}
          .cfg-row{display:flex;gap:6px;align-items:center;margin-bottom:5px;}
          .cfg-slot{font-size:10px;color:#999;width:90px;flex-shrink:0;font-family:monospace;}
          .cfg-inp{flex:1;padding:3px 7px;border:1px solid #ccc;border-radius:3px;font-size:12px;}
          .cfg-sample{font-size:10px;color:#aaa;width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;}
          .cfg-hint{font-size:10px;color:#aaa;margin-top:2px;}
          .ca{flex:1;padding:10px;overflow:hidden;position:relative;min-height:0;}
          .st{padding:4px 10px;font-size:11px;color:#888;border-top:1px solid #f0f0f0;flex-shrink:0;}
        </style>
        <div class="tb">
          <input class="inp" id="q" type="text" placeholder="Soru yazın… (örn: Name bazında en çok Goals top 10)">
          <button class="btn" id="go">Sorgula</button>
          <button class="btn sec" id="clr">Temizle</button>
          <button class="btn cfg" id="cfgBtn" title="Alan adlarını yapılandır">⚙</button>
        </div>
        <div class="cfg-panel" id="cfgPanel">
          <div id="cfgFields"><div class="cfg-hint" style="padding:4px 0;">Model bağlandıktan sonra alan adları burada görünür.</div></div>
          <div class="cfg-row" style="margin-top:6px;">
            <button class="btn" id="cfgSave" style="font-size:11px;padding:4px 12px;">Kaydet</button>
            <span class="cfg-hint" id="cfgMsg"></span>
          </div>
        </div>
        <div class="types" id="types">
          <button class="tbtn" data-type="bar">Bar</button>
          <button class="tbtn" data-type="hbar">Yatay Bar</button>
          <button class="tbtn" data-type="line">Çizgi</button>
          <button class="tbtn" data-type="pie">Pasta</button>
          <button class="tbtn" data-type="stacked">Yığılmış</button>
          <button class="tbtn" data-type="area">Alan</button>
          <button class="tbtn active" data-type="table">Tablo</button>
        </div>
        <div class="ca" id="chart"></div>
        <div class="st" id="status">Model bağlandıktan sonra soru yazın.</div>`;

      const inp = this._root.getElementById("q");
      this._root.getElementById("go").addEventListener("click", ()=>this._onQuery(inp.value.trim()));
      inp.addEventListener("keydown", e=>{ if(e.key==="Enter") this._onQuery(inp.value.trim()); });
      this._root.getElementById("clr").addEventListener("click", ()=>{
        inp.value=""; this._root.getElementById("chart").innerHTML="";
        this._setStatus("Temizlendi."); this._lastPlan=null; this._lastQ="";
      });

      // Settings panel toggle
      this._root.getElementById("cfgBtn").addEventListener("click", () => {
        const panel = this._root.getElementById("cfgPanel");
        panel.classList.toggle("open");
        if (panel.classList.contains("open")) this._buildCfgFields();
      });
      this._root.getElementById("cfgSave").addEventListener("click", () => {
        const saved = this._loadNames();
        const dimNames = [], measNames = [];
        this._root.querySelectorAll("[data-cfg-dim]").forEach(inp => dimNames.push(inp.value.trim()));
        this._root.querySelectorAll("[data-cfg-meas]").forEach(inp => measNames.push(inp.value.trim()));
        const dimStr  = dimNames.join(",");
        const measStr = measNames.join(",");
        this._applyNameConfig(dimStr, measStr);
        this._saveNames(dimStr, measStr);
        this._root.getElementById("cfgMsg").textContent = "✓ Kaydedildi";
        setTimeout(() => { this._root.getElementById("cfgMsg").textContent = ""; }, 2000);
        if (this._lastQ) this._runQuery(this._lastQ);
        else if (this._allRows.length) this._setStatus(this._allRows.length + " satır yüklendi.");
      });
      this._root.getElementById("types").addEventListener("click", e=>{
        const btn=e.target.closest("[data-type]"); if(!btn) return;
        this._chartType=btn.dataset.type;
        this._root.querySelectorAll(".tbtn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        if(this._lastPlan&&this._allRows.length){ this._lastPlan.chart_type=this._chartType; this._draw(applyPlan(this._allRows,this._lastPlan),this._lastPlan); }
      });
    }

    // ── Build dynamic config fields based on current metadata ───────────
    _buildCfgFields() {
      const container = this._root.getElementById("cfgFields");
      if (!container) return;
      const saved = this._loadNames();
      const savedDims  = (saved.dims  || "").split(",").map(s => s.trim());
      const savedMeas  = (saved.meas  || "").split(",").map(s => s.trim());
      const dims  = this._metadata.dimensions;
      const meas  = this._metadata.measures;
      if (!dims.length && !meas.length) {
        container.innerHTML = '<div class="cfg-hint" style="padding:4px 0;">Model bağlandıktan sonra burası dolar.</div>';
        return;
      }
      // Gather sample values from first few rows
      const sample = {};
      for (const row of this._allRows.slice(0, 5)) {
        for (const k of Object.keys(row)) {
          if (!sample[k]) sample[k] = [];
          if (row[k] != null && sample[k].length < 3) sample[k].push(String(row[k]));
        }
      }
      let html = '';
      if (dims.length) {
        html += '<div class="cfg-section">Boyutlar (Dimensions)</div>';
        dims.forEach((d, i) => {
          const ex = (sample[d.name] || []).join(", ");
          const val = savedDims[i] || (d.label !== d.name ? d.label : "");
          html += `<div class="cfg-row">
            <span class="cfg-slot">${d.name}</span>
            <input class="cfg-inp" data-cfg-dim="${i}" type="text" value="${val}" placeholder="Alan adı…">
            <span class="cfg-sample" title="${ex}">${ex}</span>
          </div>`;
        });
      }
      if (meas.length) {
        html += '<div class="cfg-section">Ölçümler (Measures)</div>';
        meas.forEach((m, i) => {
          const ex = (sample[m.name] || []).join(", ");
          const val = savedMeas[i] || (m.label !== m.name ? m.label : "");
          html += `<div class="cfg-row">
            <span class="cfg-slot">${m.name}</span>
            <input class="cfg-inp" data-cfg-meas="${i}" type="text" value="${val}" placeholder="Alan adı…">
            <span class="cfg-sample" title="${ex}">${ex}</span>
          </div>`;
        });
      }
      container.innerHTML = html;
    }

    async _onQuery(question) {
      if (!question) return;
      this._lastQ = question;
      this._setStatus("Sorgu işleniyor…");
      await _chartJsReady;
      try {
        // Refresh data if binding available
        if (this._dataBinding) this._extractRows(this._dataBinding);
        const plan = parseQuestion(question, this._metadata);
        if (this._chartType) plan.chart_type = this._chartType;
        plan.top = Math.min(plan.top, this._maxRows||50);
        this._lastPlan = plan;
        this._runQuery(question);
      } catch(err) { this._setStatus("Hata: "+err.message); console.error("[JustAsk]",err); }
    }

    _runQuery(question) {
      const plan = this._lastPlan || parseQuestion(question, this._metadata);
      const source = this._allRows.length ? this._allRows : this._mockData(plan);
      const data = applyPlan(source, plan);
      this._draw(data, plan);
      this._setStatus((this._allRows.length ? "" : "[Mock] ") + data.length + " satır gösteriliyor.");
    }

    _draw(data, plan) {
      if (this._chartInst) { try { this._chartInst.destroy(); } catch(e){} this._chartInst = null; }
      this._chartInst = renderChart(this._root.getElementById("chart"), data, plan, this._metadata);
    }

    _mockData(plan) {
      const dim  = plan.dimensions[0] || (this._metadata.dimensions[0]?.name) || "name";
      const meas = plan.measures[0]   || (this._metadata.measures[0]?.name)   || "value";
      // Patch plan so renderer knows which columns to use
      if (!plan.dimensions.length) plan.dimensions = [dim];
      if (!plan.measures.length)   plan.measures   = [meas];
      const names=["Alpha","Beta","Gamma","Delta","Epsilon","Zeta","Eta","Theta","Iota","Kappa"];
      return Array.from({length:Math.min(plan.top,10)},(_,i)=>{ const r={}; r[dim]=names[i]||"Item "+(i+1); r[meas]=Math.round(Math.random()*9000000+100000); return r; });
    }

    _setStatus(msg) { const el=this._root.getElementById("status"); if(el) el.textContent=msg; }
  }

  customElements.define("com-custom-justask", JustAskWidget);
})();
