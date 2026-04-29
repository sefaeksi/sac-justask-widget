// Dimension aliases: spoken Turkish → actual SAC field name
// Only activated when the field exists in model metadata
export const DIM_ALIASES = {
  // Track / song
  "sarki": "track_name", "şarkı": "track_name", "parcalar": "track_name",
  "parça": "track_name", "parca": "track_name", "muzik": "track_name",
  // Genre
  "tur": "genre", "tür": "genre", "muzik turu": "genre", "muzik türü": "genre",
  "kategori": "genre", "turler": "genre", "türler": "genre",
  "turlere": "genre", "türlere": "genre",
  "turunde": "genre", "türünde": "genre",
  // Country
  "ulke": "country", "ülke": "country", "ulkeler": "country",
  "ulkeyi": "country", "ülkeyi": "country",
  "ulkeleri": "country", "ülkeleri": "country",
  "bolge": "country", "bölge": "country",
  // Trend / status
  "yön": "trend", "yon": "trend", "durum": "trend",
  "egilim": "trend", "eğilim": "trend",
  // Artist
  "sanatci": "artist_name", "sanatçı": "artist_name",
  "sanatcilar": "artist_name", "sanatçılar": "artist_name",
  "sanatciyi": "artist_name", "sanatçıyı": "artist_name",
  "sanatcilari": "artist_name", "sanatçıları": "artist_name",
  "sanatcinin": "artist_name", "sanatçının": "artist_name",
  // Popularity category
  "populerlik kategorisi": "popularity_category",
  "popülerlik kategorisi": "popularity_category",
  "popularlik kategorisi": "popularity_category",
  "populerlik": "popularity_category", "popülerlik": "popularity_category",
  "popularlik": "popularity_category",
  "popularlik kategorilerine": "popularity_category",
  "popülerlik kategorilerine": "popularity_category",
};

// Measure aliases: spoken Turkish → actual SAC field name
export const MEAS_ALIASES = {
  // Streams
  "dinlenme": "streams", "dinleme": "streams",
  "stream sayisi": "streams", "stream sayısı": "streams",
  "dinlenme sayisi": "streams",
  // Viral score
  "viral skor": "viral_score", "viral skoru": "viral_score",
  "virality": "viral_score", "popülarite": "viral_score", "popularite": "viral_score",
  "viralite": "viral_score", "virallik": "viral_score",
  // Stream change
  "stream degisimi": "stream_change", "stream değişimi": "stream_change",
  "degisim": "stream_change", "değişim": "stream_change",
  "degisimi": "stream_change", "değişimi": "stream_change",
  "artis": "stream_change", "artış": "stream_change",
  "dusus": "stream_change", "düşüş": "stream_change",
  "buyume": "stream_change", "büyüme": "stream_change",
  // Longevity
  "kalicilik": "longevity", "kalıcılık": "longevity",
  "listede kalma suresi": "longevity", "listede kalma süresi": "longevity",
};

/**
 * Apply aliases to a query string, replacing spoken words with field names.
 * Only replaces when the target field exists in the model's available fields.
 * Processes longest aliases first to avoid partial matches.
 */
export function applyAliases(q, dimFieldSet, measFieldSet) {
  let out = q;

  // Measure aliases (longest first)
  const measEntries = Object.entries(MEAS_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, real] of measEntries) {
    if (measFieldSet.has(real.toLowerCase())) {
      out = out.replace(new RegExp(`(?<!\\w)${escapeRegex(alias)}(?!\\w)`, "gi"), real);
    }
  }

  // Dimension aliases (longest first)
  const dimEntries = Object.entries(DIM_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, real] of dimEntries) {
    if (dimFieldSet.has(real.toLowerCase())) {
      out = out.replace(new RegExp(`(?<!\\w)${escapeRegex(alias)}(?!\\w)`, "gi"), real);
    }
  }

  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
