const USER_AGENT = 'Sisyphus/3.0 (https://github.com/cwoland/Sisyphus)';
const SEARCH_HOST = 'https://search.openfoodfacts.org';
const PRODUCT_HOST = 'https://world.openfoodfacts.org';
const TIMEOUT_MS = 6000;

const FIELDS = 'code,product_name,brands,nutriments';

const bucket = { tokens: 8, max: 8, refillPerSec: 8 / 60, last: Date.now() };

const take = () => {
  const now = Date.now();
  bucket.tokens = Math.min(bucket.max, bucket.tokens + ((now - bucket.last) / 1000) * bucket.refillPerSec);
  bucket.last = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
};

const recentTerms = new Map();
const TERM_TTL_MS = 10 * 60 * 1000;

const seenRecently = (term) => {
  const at = recentTerms.get(term);
  if (at && Date.now() - at < TERM_TTL_MS) return true;

  recentTerms.set(term, Date.now());
  if (recentTerms.size > 200) {
    for (const [key, time] of recentTerms) {
      if (Date.now() - time > TERM_TTL_MS) recentTerms.delete(key);
    }
  }
  return false;
};

const kcalOf = (nutriments) => {
  const direct = Number(nutriments?.['energy-kcal_100g']);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const kj = Number(nutriments?.energy_100g);
  if (Number.isFinite(kj) && kj > 0) return kj / 4.184;

  return 0;
};

const toProduct = (raw) => {
  const name = (raw?.product_name || '').trim();
  const kcal = kcalOf(raw?.nutriments);
  if (!raw?.code || !name || kcal <= 0) return null;

  const macro = (key) => {
    const v = Number(raw.nutriments?.[key]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0;
  };

  const brands = raw.brands;
  const brand = Array.isArray(brands) ? brands[0] : brands;

  return {
    barcode: String(raw.code),
    name: name.slice(0, 200),
    brand: brand ? String(brand).split(',')[0].trim().slice(0, 120) : null,
    kcal_100g: Math.round(kcal * 100) / 100,
    protein_100g: macro('proteins_100g'),
    fat_100g: macro('fat_100g'),
    carbs_100g: macro('carbohydrates_100g'),
  };
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const searchOff = async (term) => {
  if (term.length < 3 || seenRecently(term) || !take()) return [];

  const params = new URLSearchParams({ q: term, page_size: '20', fields: FIELDS });
  const data = await fetchJson(`${SEARCH_HOST}/search?${params}`);

  return (data?.hits || []).map(toProduct).filter(Boolean);
};

export const fetchOffProduct = async (barcode) => {
  if (!take()) return null;

  const params = new URLSearchParams({ fields: FIELDS });
  const data = await fetchJson(`${PRODUCT_HOST}/api/v2/product/${barcode}.json?${params}`);

  return data?.product ? toProduct(data.product) : null;
};
