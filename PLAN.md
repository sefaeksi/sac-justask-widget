# SAC Custom Widget — Just Ask NLP Widget

## Uygulama Durumu: ✅ TAMAMLANDI (2026-04-29)

Tüm dosyalar oluşturuldu:
- `webcomponent.json` — SAC manifest
- `nlp/aliases.js` — DIM_ALIASES + MEAS_ALIASES + applyAliases()
- `nlp/keywords.js` — Tüm regex pattern'lar ve keyword set'ler
- `nlp/parser.js` — parseQuestion() (nlp_engine.py'nin tam JS portu)
- `chart/renderer.js` — Chart.js render (bar/hbar/line/pie/stacked/area/table)
- `widget.js` — Web Component (Shadow DOM, SAC data binding API, mock data)

**Bir sonraki adım:** `chart.min.js`'i indirip CW/ dizinine ekle, sonra GitHub Pages'e yükle ve `webcomponent.json` içindeki `url` alanını güncelle.

---

## Hedef

SAP Analytics Cloud dashboarduna eklenebilen, Türkçe doğal dil sorgusu alıp bağlı SAC modelinden veri çeken ve Chart.js ile görselleştiren bir Custom Widget.

---

## Mimari

```
[SAC Dashboard]
     │
     ▼
[Custom Widget]
  ┌─────────────────────────────────┐
  │  Text Input (NL Sorgu)          │
  │         ↓                       │
  │  JS NLP Engine (parse_question) │
  │         ↓                       │
  │  SAC Data Binding API           │
  │  (dimension + measure + filter) │
  │         ↓                       │
  │  Chart.js render                │
  │  (bar / line / pie / tablo)     │
  └─────────────────────────────────┘
```

**Backend yok.** Widget tamamen tarayıcı içinde çalışır.

---

## Dosya Yapısı

```
CW/
├── PLAN.md                  ← bu dosya
├── webcomponent.json        ← SAC widget manifest
├── widget.js                ← Ana widget dosyası (Web Component)
├── nlp/
│   ├── aliases.js           ← _DIM_ALIASES + _MEAS_ALIASES (Python dict → JS)
│   ├── keywords.js          ← SORT_DESC_KW, SORT_ASC_KW, CHART_TYPES, tüm regex pattern'lar
│   └── parser.js            ← parse_question() fonksiyonu (Python → JS port)
└── chart/
    └── renderer.js          ← Chart.js render mantığı (bar, hbar, line, pie, stacked, area, tablo)
```

---

## Adım Adım Yapılacaklar

### Adım 1 — `webcomponent.json` manifest

SAC'ın widget'ı tanıması için gerekli. Şunları içermeli:

```json
{
  "id": "com.custom.justask",
  "version": "1.0.0",
  "name": "Just Ask NLP",
  "description": "Türkçe doğal dil ile SAC model sorgusu",
  "webcomponentFiles": ["widget.js"],
  "url": "<widget'ın host edildiği HTTPS URL>",
  "dataBindings": {
    "myDataSource": {
      "feeds": [
        { "id": "dimensions", "description": "Dimensions", "type": "dimension" },
        { "id": "measures",   "description": "Measures",   "type": "measure"   }
      ]
    }
  },
  "properties": {
    "maxRows": {
      "type": "integer",
      "default": 50,
      "description": "Maksimum satır sayısı"
    }
  }
}
```

**Not:** `url` alanı production'da HTTPS olmalı. Development için SAP BTP veya GitHub Pages kullanılabilir.

---

### Adım 2 — `nlp/aliases.js` (Python dict → JS)

`nlp_engine.py` içindeki `_DIM_ALIASES` ve `_MEAS_ALIASES` dict'leri JS object olarak çıkarılır.

```js
// nlp/aliases.js
export const DIM_ALIASES = {
  "sarki": "track_name",
  "şarkı": "track_name",
  "parcalar": "track_name",
  // ... nlp_engine.py satır 334-363 arası tüm alias'lar
};

export const MEAS_ALIASES = {
  "dinlenme": "streams",
  "dinleme": "streams",
  "viral skor": "viral_score",
  // ... nlp_engine.py satır 364-381 arası tüm alias'lar
};
```

**Önemli:** Alias'lar bu projede müzik modeline özgü yazılmış (`track_name`, `streams`, `genre` vb.).
Yeni projede bağlı modelin field adlarına göre ya güncellenmeli ya da dinamik hale getirilmeli.

**Dinamik alias önerisi:** Kullanıcı model bağladığında widget field listesini okur,
alias'ları field label'larıyla otomatik eşleştirir (fuzzy match).

---

### Adım 3 — `nlp/keywords.js` (Regex pattern'lar ve keyword set'ler)

`nlp_engine.py`'den portlanacak sabitler:

```js
// nlp/keywords.js
export const SORT_DESC_KW = new Set([
  "highest", "largest", "en yüksek", "en buyuk", "en büyük",
  "en fazla", "en cok", "en çok", "max", "en populer", "en iyi"
  // ... nlp_engine.py satır 297-299
]);

export const SORT_ASC_KW = new Set([
  "lowest", "smallest", "en düşük", "en dusuk", "min"
  // ... nlp_engine.py satır 300-302
]);

export const CHART_TYPES = {
  "bar":     ["bar", "çubuk", "sütun grafik", "bar grafik", "bar chart"],
  "hbar":    ["horizontal bar", "yatay çubuk", "yatay bar"],
  "line":    ["line", "çizgi", "cizgi", "çizgi grafik", "trend"],
  "pie":     ["pie", "pasta", "pasta grafik", "daire grafik"],
  "stacked": ["stacked", "yığılmış", "yigilmis", "yığılmış çubuk"],
  "area":    ["area", "alan", "alan grafik"],
};

export const GENERIC_CHART_KW = new Set([
  "grafik", "chart", "görselleştir", "visualize", "graph", "plot"
]);

// Regex pattern'lar (nlp_engine.py satır 312-314)
export const YEAR_PATTERN = /\b(20[0-3]\d)\b/g;
export const TOP_PATTERN  = /\b(?:top|first|ilk)\s*(\d+)(?:['’]?[a-zçğışöü]\w*)?/gi;
```

---

### Adım 4 — `nlp/parser.js` (parse_question port)

`nlp_engine.py:317` → `parse_question(question, metadata)` fonksiyonunun JS karşılığı.

**Giriş:**
```js
parse_question("en çok dinlenen 10 şarkı bar grafik", {
  dimensions: [{ name: "track_name", label: "Şarkı", type: "string" }, ...],
  measures:   [{ name: "streams",    label: "Dinlenme", type: "decimal" }, ...]
})
```

**Çıkış (query plan):**
```js
{
  filters: [],
  dimensions: ["track_name"],
  measures: ["streams"],
  top: 10,
  orderby: "streams",
  sort_dir: "desc",
  chart_type: "bar",
  scale: {},
  agg: {},
  derived: []
}
```

**Portlanacak bloklar (sırayla):**

1. Alias uygulama — `_DIM_ALIASES` + `_MEAS_ALIASES` (satır 383-390)
2. "all/hepsi" shortcut (satır 444-453)
3. Yıl filtresi — `YEAR_PATTERN` (satır 455-461)
4. Numerik filtreler — `>`, `>=`, `<`, `<=` pattern'lar (satır 465-553)
5. Pozitif/negatif filtreler (satır 500-516)
6. Scaled numerik filtreler — "milyon", "milyar", "bin" (satır 526-569)
7. "Kaç" → count aggregation (satır 418-428)
8. Rising/falling trend tespiti (satır 620-684)
9. "Yeni giren / listeye giren" filtresi (satır 631-638)
10. Ülke tespiti — `_COUNTRY_ABBR` + locative suffix (satır 748-791)
11. Genre tespiti (satır 699-745)
12. "TOP N" tespiti — `TOP_PATTERN` (satır 314)
13. Sıralama yönü — `SORT_DESC_KW` / `SORT_ASC_KW`
14. Grafik tipi tespiti — `CHART_TYPES` + `GENERIC_CHART_KW`
15. Dimension ve measure seçimi (token bazlı eşleştirme)

---

### Adım 5 — `chart/renderer.js` (Chart.js render)

SAC temasına yakın görünüm için renk paleti:

```js
const SAC_COLORS = [
  "#0070F2", "#E8A000", "#5C8A00", "#BB0000", "#6E4B7B",
  "#0040B0", "#C87D00", "#3D6600", "#8C0000", "#4A3356"
];
```

Her grafik tipi için render fonksiyonu:

| Fonksiyon | Chart.js type |
|---|---|
| `renderBar(data, plan)` | `bar` |
| `renderHBar(data, plan)` | `bar` + `indexAxis: 'y'` |
| `renderLine(data, plan)` | `line` |
| `renderPie(data, plan)` | `pie` |
| `renderStacked(data, plan)` | `bar` + `stacked: true` |
| `renderArea(data, plan)` | `line` + `fill: true` |
| `renderTable(data, plan)` | HTML tablo |

---

### Adım 6 — `widget.js` (Ana Web Component)

```js
class JustAskWidget extends HTMLElement {
  connectedCallback() {
    // Shadow DOM oluştur
    // Input kutusu + Grafik alanı render et
    // SAC data binding'e bağlan
  }

  // SAC data binding API — model bağlandığında çağrılır
  onDataBindingInit(dataBinding) {
    // Model metadata'sını oku (dimensions, measures)
    this._metadata = extractMetadata(dataBinding);
  }

  async _onQuery(question) {
    const plan = parse_question(question, this._metadata);
    const data = await this._fetchData(plan);  // SAC data binding API'si
    renderChart(data, plan, this._canvas);
  }
}

customElements.define("com-custom-justask", JustAskWidget);
```

**SAC Data Binding API kullanımı:**

```js
// Dimension + measure seçimi ile veri çekme
const resultSet = await dataBinding.getDataSource().getResultSet();
// ya da filtering API ile
```

SAC custom widget SDK dokümantasyonu:
- Builder/Styling panel: `onCustomWidgetBeforeUpdate` / `onCustomWidgetAfterUpdate`
- Data binding: `myWidget.getDataSource().getDimensions()` / `.getMeasures()`

---

### Adım 7 — Host ve SAC'a Yükleme

1. Tüm dosyaları HTTPS erişilebilir bir yere yükle:
   - **GitHub Pages** (ücretsiz, hızlı test için)
   - **SAP BTP HTML5 Application Repository** (production için)
   - **Azure Static Web Apps / AWS S3 + CloudFront**

2. SAC'ta:
   - *Analytics Designer* → *Custom Widgets* → *+ Add Custom Widget*
   - `webcomponent.json` URL'sini gir
   - Widget story'e eklenir, model data binding yapılır

---

## Kritik Notlar

### Alias sistemi hakkında

Mevcut `nlp_engine.py` alias'ları müzik modeline (`track_name`, `streams`, `genre`, `artist_name`) özgü yazılmış.
Yeni widget farklı bir modelle çalışacaksa iki seçenek var:

**A — Statik alias (kolay):** Her model için ayrı alias JSON dosyası yaz, widget'a yükle.

**B — Dinamik alias (önerilen):** Widget model bağlandığında field label'larını okur,
Türkçe fonetik benzerliğe göre alias'ları otomatik üretir. Örneğin label "Net Gelir" ise
"gelir", "net gelir", "kazanç" gibi Türkçe eşdeğerleri otomatik üretilir.

### SAC Data Binding limitleri

SAC'ın data binding API'si widget'a filtrelenmiş/aggregated veri döner.
`parse_question` çıktısındaki `filters`, `dimensions`, `measures` doğrudan
SAC data binding API'sine geçirilmeli — client-side filtreleme değil,
SAC kendi engine'ini kullanarak veriyi getirmeli.

### Chart.js versiyonu

`widget.js` içinde CDN yerine bundle edilmiş Chart.js kullan:
```html
<!-- Kötü: CDN bağımlılığı -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- İyi: widget.js içine import -->
// import { Chart } from './chart.min.js';  // yerel kopyası
```

---

## Bağımlılıklar

| Kütüphane | Versiyon | Amaç |
|---|---|---|
| Chart.js | 4.x | Grafik render |
| Yok | — | NLP (pure JS, no dep) |

---

## Test Senaryoları

```
"en çok dinlenen 10 şarkı"           → bar, streams desc, top 10
"ülkelere göre toplam gelir"          → bar, country group by, revenue sum
"2024 yılı satışları çizgi grafik"    → line, date filter 2024
"pasta grafik türlere göre dağılım"   → pie, genre group by
"ABD'deki viral şarkılar"             → bar, country=US, viral_score filter
"en yüksek değişim gösteren 20 parça" → bar, stream_change desc, top 20
"tümü"                                → tablo, tüm field'lar
```
