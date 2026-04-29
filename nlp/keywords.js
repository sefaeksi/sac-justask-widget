// Sorting keyword sets
export const SORT_DESC_KW = new Set([
  "highest", "largest", "biggest", "en yüksek", "en buyuk", "en büyük", "max",
  "en fazla", "en cok", "en çok", "en yuksek", "descending",
  "en populer", "en popüler", "en hit", "en iyi", "en viral",
]);

export const SORT_ASC_KW = new Set([
  "lowest", "smallest", "en düşük", "en dusuk", "en küçük", "en kucuk",
  "min", "ascending",
]);

// Chart type keyword → canonical type
export const CHART_TYPES = {
  bar:     ["bar", "bar chart", "çubuk", "çubuk grafik", "sütun grafik", "bar grafik", "sutun grafik"],
  hbar:    ["horizontal bar", "yatay çubuk", "yatay bar", "yatay cubuk"],
  line:    ["line", "line chart", "çizgi", "cizgi", "çizgi grafik", "trend"],
  pie:     ["pie", "pie chart", "pasta", "pasta grafik", "daire grafik"],
  stacked: ["stacked", "stacked bar", "yığılmış", "yigilmis", "yığılmış çubuk"],
  area:    ["area", "area chart", "alan", "alan grafik"],
  table:   ["tablo", "table", "liste", "list", "hepsi", "tümü"],
};

export const GENERIC_CHART_KW = new Set([
  "grafik", "chart", "görselleştir", "gorsellestir", "visualize", "graph", "plot",
]);

// Scale word → numeric multiplier
export const SCALE_VALUES = {
  "bin": 1_000, "bın": 1_000, "thousand": 1_000,
  "milyon": 1_000_000, "million": 1_000_000,
  "milyar": 1_000_000_000, "billion": 1_000_000_000,
};

// Country abbreviation → ISO code
export const COUNTRY_ABBR = {
  "abd": "US", "usa": "US", "uk": "GB", "ingiltere": "GB",
  "almanya": "DE", "fransa": "FR", "japonya": "JP", "kore": "KR",
  "avustralya": "AU", "italya": "IT", "ispanya": "ES", "brezilya": "BR",
  "turkiye": "TR", "türkiye": "TR", "rusya": "RU", "cin": "CN",
  "hindistan": "IN", "meksika": "MX", "kanada": "CA",
};

// Aggregation keyword → function name
export const AGG_KEYWORDS = {
  "avg": "avg", "average": "avg", "ortalama": "avg", "ort": "avg",
  "max": "max", "maximum": "max",
  "min": "min", "minimum": "min",
  "count": "count", "adet": "count", "sayı": "count", "sayi": "count",
};

// Regex patterns (compiled once)
export const YEAR_PATTERN     = /\b(20[0-3]\d)\b/g;
export const TOP_PATTERN      = /\b(?:top|first|ilk)\s*(\d+)(?:['’]?[a-zçğışöü]\w*)?/gi;
export const BY_PATTERN       = /\b(?:by|baz[iı]nda|bazli|bazl[iı]|göre|gore)\s+(\w+)/gi;
export const PRE_BY_PATTERN   = /\b(\w+)\s+(?:baz[iı]nda|bazli|bazl[iı]|göre|gore)\b/gi;
export const HANGI_PATTERN    = /\bhangi\s+(\w+)/gi;
export const HANGI_ULKE_PAT   = /\bhangi\s+(?:ülkede|ulkede|ülke|ulke|ülkelerde|ulkelerde)\b/i;
export const COUNT_PATTERN    = /\bka[cç]\s+(?:tane\s+)?(\w+)\b|\bka[cç]\s+(?:tane)?\b/i;
export const GENITIVE_KAC_PAT = /\b([A-ZÇĞİÖŞÜ][a-zA-ZçğışöüÇĞİÖŞÜ]+(?:\s+[A-ZÇĞİÖŞÜ][a-zA-ZçğışöüÇĞİÖŞÜ]+)*)'?(?:in|ın|nin|nın|un|ün|nun|nün)\s+ka[çc]/;

export const RISING_PAT = /\b(?:yukselis\w*|yükseliş\w*|art[ıi][şs](?!t)\w*|artt\w*|artan|yukselen|yükselen|trende\s+giren|yukseliyor\w*)\b/i;
export const YENI_GIREN_PAT = /\b(?:yeni\s+giren|listeye\s+(?:yeni\s+)?giren|ilk\s+kez\s+giren|ilk\s+giren)\b/i;
export const ORTA_PAT = /\borta\s+(?:seviye\w*|kategori\w*|düzey\w*|duzey\w*|popülerlik\w*|popularlik\w*)\b/i;
export const YUKSEK_POP_PAT = /\b(?:yüksek|yuksek|high)\s+(?:pop[uü]l[ae]rlik|popularlik|popularity)\s*(?:kategori\w*)?\b/i;
export const DUSUK_POP_PAT  = /\b(?:d[uü][sş][uü]k|low)\s+(?:pop[uü]l[ae]rlik|popularlik|popularity)\s*(?:kategori\w*)?\b|\bpop[uü]l[ae]rlik\s+kategori\w*\s+(?:hala\s+)?(?:d[uü][sş][uü]k|low)\b/i;
export const BUYUME_PAT = /\b(?:buyume\s+(?:gosteren\w*|saglay\w*)|büyüme\s+(?:gösteren\w*|sağlay\w*)|istikrarl[iı]\s+(?:buyume|büyüme)\w*|surekli\s+(?:buyuyen|büyüyen)\w*)\b/i;
export const VIRAL_PAT = /\bviral\b/i;
export const SINGULAR_END_PAT = /\b(?:hangisi|nedir|kimdir|ne|kim)\s*\??\s*$/i;
export const POP_NEGATED_PAT  = /\b(?:ula[sş]amamı[sş]\w*|ulasamamis\w*|girememis\w*|giremedik\w*|olmayan\w*|degil\w*)\b/i;

export const NUM_FILTER_PAT = /\b(\w+)\s*(?:>|>=|<|<=|!=)\s*(\d+(?:[.,]\d+)?)|\b(\w+)\s+(\d+(?:[.,]\d+)?)\s*(?:den|dan)\s+(b[uü]y[uü]k|fazla|k[uü][cç][uü]k|az|e[sş]it)/gi;
export const POZITIF_PAT    = /\b(\w+)\s+pozitif\b/gi;
export const NEGATIF_PAT    = /\b(\w+)\s+negatif\b/gi;
export const NEGATIF_REV    = /\bnegatif\s+(\w+)\b/gi;
export const NUM_SUFFIX_PAT = /\b(\w+)\s+(\d+(?:[.,]\d+)?)(?:in|ın|un|ün|'in|'ın|'un|'ün)?\s+(?:uzerinde|üzerinde|fazla|üstünde|ustunde)/gi;

export const SCALED_NUM_PAT = /\b(\w+)\s+(\d+(?:[.,]\d+)?)\s*(milyon|milyar|bin)\w*\s*(?:un\s+|in\s+|nin\s+|nun\s+|u\s+|ü\s+)?(uzerinde|üzerinde|ustunde|üstünde|fazla|buyuk|büyük|altında|altinda|az|kucuk|küçük|ge[çc]en\w*)/gi;
export const PLAIN_GECEN_PAT = /\b(\w+)\s+(\d+(?:[.,]\d+)?)\s*(?:ü\s+|u\s+|yi\s+|yı\s+)?ge[çc]en\w*\b/gi;
export const CTX_SCALED_GECEN = /\b(\d+(?:[.,]\d+)?)\s*(milyon|milyar|bin)\w*\s*(?:u\s+|ü\s+|yi\s+|yı\s+|nu\s+|nü\s+)?ge[çc]en\w*\b/gi;

export const LOCATIVE_PAT = /\b([A-ZÇĞİÖŞÜ][a-zA-ZçğışöüÇĞİÖŞÜ]{1,})'?\s*(?:de|da|te|ta|deki|daki|teki|taki)\b/g;
export const LOC_STOP = new Set([
  "bazinda", "bazında", "trendinde", "turunde", "türünde", "uzerinde", "üzerinde",
  "altinda", "altında", "icinde", "içinde", "disinda", "dışında",
  "listede", "tabloda", "sirada", "basinda", "başında",
]);

export const GENRE_OWNER_PAT = /\b([\w\-]+)\s+(?:sarkilar\w*|muzik\w*|parcalar\w*|sarkisinin|muzigi\w*)\b/gi;
export const GENRE_ADJECTIVES = new Set([
  "dinlenen", "dinleme", "populer", "popüler", "popular", "yeni", "eski", "hit",
  "viral", "trending", "yukselis", "yükseliş", "artan", "dusuk", "düşük",
  "yuksek", "yüksek", "iyi", "kotu", "kötü", "buyuk", "büyük", "kucuk", "küçük",
  "efsane", "kalici", "kalıcı", "mucize",
  "dusen", "düşen", "kalan", "olmayan", "yasayan", "yaşayan",
  "giren", "tirmanan", "tırmanan", "azalan", "gerileyen", "artarken",
  "cikan", "çıkan", "dusarken", "yukselenlerden",
  "nis", "niş", "potansiyel", "organik", "global", "kuresel", "küresel",
  "oldugu", "olduğu", "sanatcinin", "sanatçının",
  "sanatcilarin", "sanatçıların",
  "kategorisindeki", "kategorisinde", "seviyedeki", "seviyede",
  "yapan", "doldurmus", "dolduran", "doldurmuş",
  "benzer", "sabir", "sabirli", "sabırlı",
  "lider", "lideri", "basarili", "başarılı",
  "istikrarsiz", "istikrarsız", "degisken", "değişken",
]);

export const SUFFIX_ENDINGS = new Set([
  "turundeki", "turunde", "turunden", "turlu",
  "trendindeki", "trendinde", "trendinin", "trendli",
  "ulkesinde", "ulkede",
]);

export const SUFFIX_DIM_MAP = {
  "trendinde":   "trend", "trendindeki": "trend", "trendinin": "trend", "trendli": "trend",
  "turunde":     "genre", "turundeki":   "genre", "turunden":  "genre", "turlu":   "genre",
  "ulkesinde":   "country", "ulkede":    "country",
};

export const SCALE_KW_PATTERN = /\b(bin|bın|thousand|milyon|million|milyar|billion)\b/gi;
export const PCT_PATTERN = /(\w+)\s*(%|yüzde|yuzde|percent)/gi;
export const MEAS_ARITH_PAT = /(\w+)\s*([+\-*/])\s*(\w+)/g;
export const CONST_ARITH_PAT = /(\w+)\s*([+\-*/])\s*(\d+\.?\d*)/g;
