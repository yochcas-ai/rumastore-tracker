/**
 * fetch-prices.js — Ruma Store · Hot Wheels Market Tracker
 * eBay Browse API (reemplaza Finding API, decommissionada Feb 5 2025)
 * + Koban.pe scraping + MercadoLibre Perú API
 *
 * Secretos requeridos en GitHub Actions:
 *   EBAY_CLIENT_ID     → App ID (Client ID) de producción
 *   EBAY_CLIENT_SECRET → Cert ID (Client Secret) de producción
 */

import fs   from "fs";
import path from "path";

const EBAY_CLIENT_ID     = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const TC  = 3.35;
const OUT = path.resolve("public/data/prices.json");

const WEIGHTS = { mercadolibre: 0.55, koban: 0.25, ebay: 0.20 };

// ─── CATÁLOGO ──────────────────────────────────────────────────────────────
const CARS = [
  { mix:"Mix 1", code:"956N", name:"Nissan Skyline GT-R (BNR34)", franchise:"Godzilla",         upc:"194735337279", retail:7.99, chase:true,  kobanQuery:"Nissan Skyline GT-R BNR34 Hot Wheels" },
  { mix:"Mix 1", code:"956N", name:"1983 BMW 733i",                franchise:"Stranger Things",  upc:"194735337354", retail:7.99, chase:false, kobanQuery:"BMW 733i Hot Wheels Stranger Things" },
  { mix:"Mix 1", code:"956N", name:"'64 Lincoln Continental",      franchise:"The Matrix",       upc:"194735337118", retail:6.99, chase:false, kobanQuery:"Lincoln Continental Hot Wheels Matrix" },
  { mix:"Mix 1", code:"956N", name:"Animated Series Batmobile",    franchise:"Batman TAS",       upc:"194735337132", retail:6.99, chase:false, kobanQuery:"Batmobile Animated Series Hot Wheels" },
  { mix:"Mix 1", code:"956N", name:"Reptar Wagon",                 franchise:"Rugrats",          upc:"194735337170", retail:5.99, chase:false, kobanQuery:"Reptar Wagon Hot Wheels Rugrats" },
  { mix:"Mix 3", code:"956Q", name:"Airwolf Helicopter",           franchise:"Airwolf",          upc:"194735262946", retail:7.99, chase:false, kobanQuery:"Airwolf Helicopter Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"Porsche 906 Carrera 6",        franchise:"TBD",              upc:"194735337316", retail:7.99, chase:false, kobanQuery:"Porsche 906 Carrera 6 Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"H.I.S.S. Tank",               franchise:"G.I. Joe",         upc:"194735337194", retail:7.99, chase:true,  kobanQuery:"HISS Tank GI Joe Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"Custom GMC Panel Van",         franchise:"TBD",              upc:"194735337255", retail:6.99, chase:false, kobanQuery:"GMC Panel Van Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"Spider-Mobile",                franchise:"Marvel Spider-Man",upc:"194735337187", retail:6.99, chase:false, kobanQuery:"Spider-Mobile Hot Wheels Marvel" },
];

// ─── UTILS ─────────────────────────────────────────────────────────────────
const sleep  = ms  => new Promise(r => setTimeout(r, ms));
const median = arr => { if (!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
const avg    = arr => arr.reduce((s,v)=>s+v,0)/arr.length;

function weightedPrice(sources) {
  let tw=0, ws=0;
  for (const [k,v] of Object.entries(sources)) {
    if (v?.median>0 && WEIGHTS[k]) { ws+=v.median*WEIGHTS[k]; tw+=WEIGHTS[k]; }
  }
  return tw>0 ? +(ws/tw).toFixed(2) : null;
}

function calcConfidence(sources) {
  const n = Object.values(sources).filter(s=>s?.median>0).length;
  return ["none","low","medium","high"][n] || "none";
}

function calcTrend(prices) {
  if (prices.length < 4) return "flat";
  const q1 = avg(prices.slice(0, Math.floor(prices.length/4)));
  const q3 = avg(prices.slice(Math.ceil(prices.length*3/4)));
  return q3>q1*1.05 ? "up" : q3<q1*0.95 ? "down" : "flat";
}

// ─── EBAY BROWSE API — OAuth 2.0 ──────────────────────────────────────────
// Reemplaza Finding API (decommissionada Feb 5, 2025)
let _ebayToken = null;

async function getEbayToken() {
  if (_ebayToken && _ebayToken.expiresAt > Date.now()) return _ebayToken.value;
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return null;

  try {
    const creds  = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
    const res    = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": `Basic ${creds}`,
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`  eBay OAuth error ${res.status}:`, err.slice(0,200));
      return null;
    }

    const data = await res.json();
    _ebayToken = {
      value:     data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000, // -60s margen
    };
    console.log(`  eBay token OK (expira en ${data.expires_in}s)`);
    return _ebayToken.value;
  } catch(e) {
    console.warn("  eBay token fetch error:", e.message);
    return null;
  }
}

async function fetchEbay(carName) {
  const token = await getEbayToken();
  if (!token) return null;

  try {
    // Browse API — item_summary/search (reemplaza findItemsByKeywords)
    const simpleName = carName.replace(/[()'"]/g,"").replace(/\s+/g," ").trim();
    const q = encodeURIComponent(`Hot Wheels ${simpleName} Pop Culture`);
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search`
      + `?q=${q}`
      + `&filter=conditions%3ANEW%2CpriceRange%3A%5B3..200%5D`  // NEW, $3–$200
      + `&sort=price`
      + `&limit=50`;

    const res  = await fetch(url, {
      headers: {
        "Authorization":          `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type":            "application/json",
      }
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`  eBay Browse error ${res.status} [${simpleName}]:`, err.slice(0,200));
      return null;
    }

    const json  = await res.json();
    const items = json?.itemSummaries || [];
    console.log(`    eBay Browse [${simpleName}]: ${items.length} listados`);

    const prices = items
      .map(i => parseFloat(i.price?.value))
      .filter(p => !isNaN(p) && p >= 3 && p <= 200)
      .sort((a,b) => a - b);

    if (!prices.length) return null;

    return {
      median:   +median(prices).toFixed(2),
      low:      prices[Math.floor(prices.length*0.25)] || prices[0],
      high:     prices[Math.floor(prices.length*0.75)] || prices[prices.length-1],
      samples:  prices.length,
      trend:    calcTrend(prices),
      currency: "USD",
    };
  } catch(e) {
    console.warn(`  eBay Browse error [${carName}]:`, e.message);
    return null;
  }
}

// ─── KOBAN.PE — Shopify public search ──────────────────────────────────────
async function fetchKoban(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://koban.pe/search/suggest.json?q=${q}&resources[type]=product&resources[limit]=5`;
    const res  = await fetch(url, { headers:{"User-Agent":"Mozilla/5.0 (compatible; RumaStoreBot/1.0)"} });
    if (!res.ok) return null;
    const json     = await res.json();
    const products = json?.resources?.results?.products || [];
    if (!products.length) return null;
    const prices = products
      .map(p => {
        const raw = p.price || p.variants?.[0]?.price;
        if (!raw) return null;
        const num = typeof raw==="number" ? raw/100 : parseFloat(String(raw).replace(/[^0-9.]/g,""));
        return isNaN(num)||num<=0 ? null : num;
      })
      .filter(Boolean).sort((a,b)=>a-b);
    if (!prices.length) return null;
    console.log(`    Koban [${query}]: ${prices.length} resultados → S/ ${median(prices)}`);
    return {
      median:   +median(prices).toFixed(2),
      low:      prices[0],
      high:     prices[prices.length-1],
      samples:  prices.length,
      currency: "PEN",
    };
  } catch(e) {
    console.warn(`  Koban error [${query}]:`, e.message);
    return null;
  }
}

// ─── MERCADOLIBRE PERÚ ─────────────────────────────────────────────────────
async function fetchMercadoLibre(carName) {
  try {
    const words = carName.replace(/[()'"]/g,"").split(" ").slice(0,3).join(" ");
    const q     = encodeURIComponent(`Hot Wheels ${words}`);
    const url   = `https://api.mercadolibre.com/sites/MPE/search?q=${q}&condition=new&limit=20`;
    const res   = await fetch(url, { headers:{"User-Agent":"RumaStoreBot/1.0","Accept":"application/json"} });
    if (!res.ok) { console.warn(`  ML HTTP ${res.status} [${words}]`); return null; }
    const json  = await res.json();
    const items = json?.results || [];
    console.log(`    MercadoLibre [${words}]: ${items.length} listados`);
    const prices = items
      .filter(i => i.title?.toLowerCase().includes("hot wheels")||i.title?.toLowerCase().includes("hotwheels"))
      .map(i => i.price)
      .filter(p => p>=5 && p<=600)
      .sort((a,b)=>a-b);
    if (!prices.length) return null;
    return {
      median:   +median(prices).toFixed(2),
      low:      prices[Math.floor(prices.length*0.25)] || prices[0],
      high:     prices[Math.floor(prices.length*0.75)] || prices[prices.length-1],
      samples:  prices.length,
      currency: "PEN",
    };
  } catch(e) {
    console.warn(`  MercadoLibre error [${carName}]:`, e.message);
    return null;
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const hasEbay = !!(EBAY_CLIENT_ID && EBAY_CLIENT_SECRET);
  console.log(`\n🚗 Ruma Store Price Fetcher — ${new Date().toISOString()}`);
  console.log(`📡 eBay Browse API${hasEbay?" ✓":" ✗ (falta EBAY_CLIENT_SECRET)"} | Koban ✓ | MercadoLibre ✓\n`);

  const results = {};

  for (const car of CARS) {
    console.log(`→ ${car.name} (${car.mix})`);

    const [ebay, koban, ml] = await Promise.all([
      fetchEbay(car.name),
      fetchKoban(car.kobanQuery),
      fetchMercadoLibre(car.name),
      sleep(400),
    ]);

    // Normalizar todo a Soles
    const sources = {
      ebay:         ebay  ? { median: +(ebay.median*TC).toFixed(2), low: +(ebay.low*TC).toFixed(2), high: +(ebay.high*TC).toFixed(2), median_usd: ebay.median, samples: ebay.samples } : null,
      koban:        koban || null,
      mercadolibre: ml    || null,
    };

    const marketPriceSoles = weightedPrice(sources);
    const retailSoles      = +(car.retail*TC).toFixed(2);
    const allLows  = [sources.ebay?.low,  sources.koban?.low,  sources.mercadolibre?.low ].filter(Boolean);
    const allHighs = [sources.ebay?.high, sources.koban?.high, sources.mercadolibre?.high].filter(Boolean);

    results[car.upc] = {
      market_price_soles: marketPriceSoles,
      market_price_usd:   marketPriceSoles ? +(marketPriceSoles/TC).toFixed(2) : null,
      low_soles:          allLows.length  ? +Math.min(...allLows).toFixed(2)  : null,
      high_soles:         allHighs.length ? +Math.max(...allHighs).toFixed(2) : null,
      retail_soles:       retailSoles,
      premium_pct:        marketPriceSoles ? Math.round(((marketPriceSoles-retailSoles)/retailSoles)*100) : null,
      trend:              ebay?.trend || "flat",
      confidence:         calcConfidence(sources),
      sources: {
        ebay:         sources.ebay         ? { median_soles: sources.ebay.median,         median_usd: sources.ebay.median_usd, samples: sources.ebay.samples } : null,
        koban:        sources.koban        ? { median_soles: sources.koban.median,         samples: sources.koban.samples }  : null,
        mercadolibre: sources.mercadolibre ? { median_soles: sources.mercadolibre.median,  samples: sources.mercadolibre.samples } : null,
      },
      updated_at: new Date().toISOString(),
    };

    const r = results[car.upc];
    console.log(`   ✓ S/ ${r.market_price_soles??'—'} | conf: ${r.confidence} | trend: ${r.trend}`);
    console.log(`     eBay: S/${sources.ebay?.median??'—'} | Koban: S/${sources.koban?.median??'—'} | ML: S/${sources.mercadolibre?.median??'—'}`);
  }

  const output = {
    generated_at:   new Date().toISOString(),
    tc:             TC,
    sources_active: { ebay: hasEbay, koban: true, mercadolibre: true },
    prices:         results,
    cars:           CARS,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  const withData = Object.values(results).filter(r=>r.market_price_soles>0).length;
  console.log(`\n✅ Completado: ${withData}/${CARS.length} con precio · ${new Date().toISOString()}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
