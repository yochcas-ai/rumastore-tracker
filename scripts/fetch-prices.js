/**
 * fetch-prices.js
 * Corre en GitHub Actions 3x/día.
 * Fuentes: eBay Finding API + Koban.pe (scraping público) + MercadoLibre Perú API
 * Escribe → public/data/prices.json
 */

import fs   from "fs";
import path from "path";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const EBAY_APP_ID = process.env.EBAY_CLIENT_ID;
const ML_APP_ID   = process.env.MERCADOLIBRE_APP_ID; // opcional por ahora
const TC          = 3.35;
const OUT         = path.resolve("public/data/prices.json");

// Pesos para el precio final ponderado
const WEIGHTS = { mercadolibre: 0.55, koban: 0.25, ebay: 0.20 };

// ─── CATÁLOGO ────────────────────────────────────────────────────────────────
const CARS = [
  { mix:"Mix 1", code:"956N", name:"Nissan Skyline GT-R (BNR34)",   franchise:"Godzilla",          upc:"194735337279", retail:7.99, chase:true,  kobanQuery:"Nissan Skyline GT-R BNR34 Hot Wheels" },
  { mix:"Mix 1", code:"956N", name:"1983 BMW 733i",                  franchise:"Stranger Things",   upc:"194735337354", retail:7.99, chase:false, kobanQuery:"BMW 733i Hot Wheels Stranger Things" },
  { mix:"Mix 1", code:"956N", name:"'64 Lincoln Continental",        franchise:"The Matrix",        upc:"194735337118", retail:6.99, chase:false, kobanQuery:"Lincoln Continental Hot Wheels Matrix" },
  { mix:"Mix 1", code:"956N", name:"Animated Series Batmobile",      franchise:"Batman TAS",        upc:"194735337132", retail:6.99, chase:false, kobanQuery:"Batmobile Animated Series Hot Wheels" },
  { mix:"Mix 1", code:"956N", name:"Reptar Wagon",                   franchise:"Rugrats",           upc:"194735337170", retail:5.99, chase:false, kobanQuery:"Reptar Wagon Hot Wheels Rugrats" },
  { mix:"Mix 3", code:"956Q", name:"Airwolf Helicopter",             franchise:"Airwolf",           upc:"194735262946", retail:7.99, chase:false, kobanQuery:"Airwolf Helicopter Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"Porsche 906 Carrera 6",          franchise:"TBD",               upc:"194735337316", retail:7.99, chase:false, kobanQuery:"Porsche 906 Carrera 6 Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"H.I.S.S. Tank",                  franchise:"G.I. Joe",          upc:"194735337194", retail:7.99, chase:true,  kobanQuery:"HISS Tank GI Joe Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"Custom GMC Panel Van",           franchise:"TBD",               upc:"194735337255", retail:6.99, chase:false, kobanQuery:"GMC Panel Van Hot Wheels" },
  { mix:"Mix 3", code:"956Q", name:"Spider-Mobile",                  franchise:"Marvel Spider-Man", upc:"194735337187", retail:6.99, chase:false, kobanQuery:"Spider-Mobile Hot Wheels Marvel" },
  ];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const median = arr => {
    if (!arr.length) return null;
    const s = [...arr].sort((a,b)=>a-b);
    return s[Math.floor(s.length/2)];
};
const avg = arr => arr.reduce((s,v) => s+v, 0) / arr.length;

function weightedPrice(sources) {
    let totalWeight = 0, weightedSum = 0;
    for (const [key, val] of Object.entries(sources)) {
          if (val?.median > 0 && WEIGHTS[key]) {
                  weightedSum  += val.median * WEIGHTS[key];
                  totalWeight  += WEIGHTS[key];
          }
    }
    return totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(2) : null;
}

function calcConfidence(sources) {
    const active = Object.values(sources).filter(s => s?.median > 0).length;
    if (active >= 3) return "high";
    if (active === 2) return "medium";
    if (active === 1) return "low";
    return "none";
}

function calcTrend(prices) {
    if (prices.length < 4) return "flat";
    const q1 = avg(prices.slice(0, Math.floor(prices.length / 4)));
    const q3 = avg(prices.slice(Math.ceil(prices.length * 3 / 4)));
    if (q3 > q1 * 1.05) return "up";
    if (q3 < q1 * 0.95) return "down";
    return "flat";
}

// ─── FUENTE 1: eBay Finding API ──────────────────────────────────────────────
// Usa findItemsByKeywords (listados ACTIVOS) en lugar de findCompletedItems
// para obtener muchos más resultados con productos nuevos de 2026
async function fetchEbay(carName) {
    if (!EBAY_APP_ID) return null;
    try {
          // Solo el nombre del modelo sin año ni colección — más resultados
      const q   = encodeURIComponent(`Hot Wheels ${carName}`);
          const url = `https://svcs.ebay.com/services/search/FindingService/v1`
            + `?OPERATION-NAME=findItemsByKeywords`
            + `&SERVICE-VERSION=1.0.0`
            + `&SECURITY-APPNAME=${EBAY_APP_ID}`
            + `&RESPONSE-DATA-FORMAT=JSON`
            + `&keywords=${q}`
            + `&itemFilter(0).name=Condition&itemFilter(0).value=New`
            + `&itemFilter(1).name=MinPrice&itemFilter(1).value=3&itemFilter(1).paramName=Currency&itemFilter(1).paramValue=USD`
            + `&itemFilter(2).name=MaxPrice&itemFilter(2).value=200&itemFilter(2).paramName=Currency&itemFilter(2).paramValue=USD`
            + `&sortOrder=PricePlusShippingLowest`
            + `&paginationInput.entriesPerPage=40`;

      const res   = await fetch(url);
          const json  = await res.json();
          const items = json?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

      const prices = items
            .map(i => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__))
            .filter(p => !isNaN(p) && p > 0)
            .sort((a,b) => a - b);

      console.log(`   eBay [${carName}]: ${prices.length} items encontrados`);
          if (!prices.length) return null;

      return {
              median:   +median(prices).toFixed(2),
              low:      prices[Math.floor(prices.length * 0.25)],
              high:     prices[Math.floor(prices.length * 0.75)],
              samples:  prices.length,
              trend:    calcTrend(prices),
              currency: "USD",
      };
    } catch(e) {
          console.warn(`   eBay error [${carName}]:`, e.message);
          return null;
    }
}

// ─── FUENTE 2: Koban.pe (scraping público) ────────────────────────────────────
// Koban usa Shopify → su buscador devuelve JSON en /search/suggest.json
async function fetchKoban(query) {
    try {
          const q   = encodeURIComponent(query);
          const url = `https://koban.pe/search/suggest.json?q=${q}&resources[type]=product&resources[limit]=5`;
          const res = await fetch(url, {
                  headers: { "User-Agent": "Mozilla/5.0 (compatible; RumaStoreBot/1.0; price research)" }
          });
          if (!res.ok) return null;
          const json     = await res.json();
          const products = json?.resources?.results?.products || [];
          if (!products.length) return null;

      const prices = products
            .map(p => {
                      const raw = p.price || p.variants?.[0]?.price;
                      if (!raw) return null;
                      const num = typeof raw === "number"
                        ? raw / 100
                                  : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
                      return isNaN(num) || num <= 0 ? null : num;
            })
            .filter(Boolean)
            .sort((a,b) => a - b);

      if (!prices.length) return null;
          console.log(`   Koban [${query}]: ${prices.length} resultados → S/ ${median(prices)}`);
          return {
                  median:   +median(prices).toFixed(2),
                  low:      prices[0],
                  high:     prices[prices.length - 1],
                  samples:  prices.length,
                  currency: "PEN",
          };
    } catch(e) {
          console.warn(`   Koban error [${query}]:`, e.message);
          return null;
    }
}

// ─── FUENTE 3: MercadoLibre Perú API ─────────────────────────────────────────
// Query más corta (3 palabras) + filtro por título para evitar ruido
async function fetchMercadoLibre(carName) {
    try {
          // Solo las primeras 3 palabras del nombre para más resultados
      const shortName = carName.split(" ").slice(0, 3).join(" ");
          const q   = encodeURIComponent(`Hot Wheels ${shortName}`);
          const url = `https://api.mercadolibre.com/sites/MPE/search?q=${q}&condition=new&limit=50`;
          const res = await fetch(url, { headers: { "User-Agent": "RumaStoreBot/1.0" } });
          if (!res.ok) return null;
          const json  = await res.json();
          const items = json?.results || [];

      const prices = items
            // Filtrar que el título contenga "hot wheels" y precio S/5–S/500
        .filter(i => i.title?.toLowerCase().includes("hot wheels") && i.price >= 5 && i.price <= 500)
            .map(i => i.price)
            .sort((a,b) => a - b);

      console.log(`   MercadoLibre [${shortName}]: ${prices.length} listados`);
          if (!prices.length) return null;

      return {
              median:   +median(prices).toFixed(2),
              low:      prices[Math.floor(prices.length * 0.25)],
              high:     prices[Math.floor(prices.length * 0.75)],
              samples:  prices.length,
              currency: "PEN",
      };
    } catch(e) {
          console.warn(`   MercadoLibre error [${carName}]:`, e.message);
          return null;
    }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🚗 Ruma Store Price Fetcher — ${new Date().toISOString()}`);
    console.log(`📡 Fuentes activas: eBay${EBAY_APP_ID ? " ✓" : " ✗"} | Koban ✓ | MercadoLibre ✓\n`);

  const results = {};

  for (const car of CARS) {
        console.log(`→ ${car.name} (${car.mix})`);

      const [ebay, koban, ml] = await Promise.all([
              fetchEbay(car.name),
              fetchKoban(car.kobanQuery),
              fetchMercadoLibre(car.name),
              sleep(300),
            ]);

      const sources = {
              ebay: ebay ? {
                        ...ebay,
                        median:     +(ebay.median * TC).toFixed(2),
                        low:        +(ebay.low    * TC).toFixed(2),
                        high:       +(ebay.high   * TC).toFixed(2),
                        median_usd: ebay.median
              } : null,
              koban:         koban || null,
              mercadolibre:  ml    || null,
      };

      const marketPriceSoles = weightedPrice(sources);
        const confidence       = calcConfidence(sources);
        const trend            = ebay?.trend || "flat";
        const retailSoles      = +(car.retail * TC).toFixed(2);
        const premiumPct       = marketPriceSoles
          ? Math.round(((marketPriceSoles - retailSoles) / retailSoles) * 100)
                : null;

      const allLows  = [sources.ebay?.low,  sources.koban?.low,  sources.mercadolibre?.low ].filter(Boolean);
        const allHighs = [sources.ebay?.high, sources.koban?.high, sources.mercadolibre?.high].filter(Boolean);

      results[car.upc] = {
              market_price_soles: marketPriceSoles,
              market_price_usd:   marketPriceSoles ? +(marketPriceSoles / TC).toFixed(2) : null,
              low_soles:          allLows.length  ? +Math.min(...allLows).toFixed(2)  : null,
              high_soles:         allHighs.length ? +Math.max(...allHighs).toFixed(2) : null,
              retail_soles:       retailSoles,
              premium_pct:        premiumPct,
              trend,
              confidence,
              sources: {
                        ebay: sources.ebay ? {
                                    median_soles: sources.ebay.median,
                                    median_usd:   sources.ebay.median_usd,
                                    samples:      ebay.samples
                        } : null,
                        koban: sources.koban ? {
                                    median_soles: sources.koban.median,
                                    samples:      koban.samples
                        } : null,
                        mercadolibre: sources.mercadolibre ? {
                                    median_soles: sources.mercadolibre.median,
                                    samples:      ml.samples
                        } : null,
              },
              updated_at: new Date().toISOString(),
      };

      const p = results[car.upc];
        console.log(`   ✓ S/ ${p.market_price_soles ?? "—"} | conf: ${confidence} | trend: ${trend}`);
        console.log(`   eBay: S/${sources.ebay?.median ?? "—"} | Koban: S/${sources.koban?.median ?? "—"} | ML: S/${sources.mercadolibre?.median ?? "—"}`);
  }

  const output = {
        generated_at: new Date().toISOString(),
        tc:           TC,
        sources_active: {
                ebay:         !!EBAY_APP_ID,
                koban:        true,
                mercadolibre: true,
        },
        prices: results,
        cars:   CARS,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2));

  const withData = Object.values(results).filter(r => r.market_price_soles > 0).length;
    console.log(`\n✅ Completado: ${withData}/${CARS.length} modelos con precio · ${new Date().toISOString()}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
