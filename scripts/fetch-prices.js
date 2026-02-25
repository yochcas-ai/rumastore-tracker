/**
 * fetch-prices.js
 * Corre en GitHub Actions 3x/día.
 * Llama eBay Finding API → calcula mediana de sold listings → escribe public/data/prices.json
 */

import fs from "fs";
import path from "path";

const APP_ID = process.env.EBAY_CLIENT_ID;
const TC     = 3.35; // Tipo de cambio USD → Soles (actualiza manualmente cuando cambie)
const OUT    = path.resolve("public/data/prices.json");

// ─── CATÁLOGO ──────────────────────────────────────────────────────────────
// Para agregar un mix nuevo: copia un objeto y edita sus campos.
const CARS = [
  { mix:"Mix 1", code:"956N", name:"Nissan Skyline GT-R (BNR34)", franchise:"Godzilla",         upc:"194735337279", retail:7.99, chase:true  },
  { mix:"Mix 1", code:"956N", name:"1983 BMW 733i",                franchise:"Stranger Things",  upc:"194735337354", retail:7.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"'64 Lincoln Continental",      franchise:"The Matrix",       upc:"194735337118", retail:6.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"Animated Series Batmobile",    franchise:"Batman TAS",       upc:"194735337132", retail:6.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"Reptar Wagon",                 franchise:"Rugrats",          upc:"194735337170", retail:5.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Airwolf Helicopter",           franchise:"Airwolf",          upc:"194735262946", retail:7.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Porsche 906 Carrera 6",        franchise:"TBD",              upc:"194735337316", retail:7.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"H.I.S.S. Tank",               franchise:"G.I. Joe",         upc:"194735337194", retail:7.99, chase:true  },
  { mix:"Mix 3", code:"956Q", name:"Custom GMC Panel Van",         franchise:"TBD",              upc:"194735337255", retail:6.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Spider-Mobile",                franchise:"Marvel Spider-Man",upc:"194735337187", retail:6.99, chase:false },
];

// ─── eBay Finding API ──────────────────────────────────────────────────────
async function fetchSoldPrices(keyword) {
  const q = encodeURIComponent(`Hot Wheels ${keyword} Pop Culture 2026`);
  const url = [
    `https://svcs.ebay.com/services/search/FindingService/v1`,
    `?OPERATION-NAME=findCompletedItems`,
    `&SERVICE-VERSION=1.0.0`,
    `&SECURITY-APPNAME=${APP_ID}`,
    `&RESPONSE-DATA-FORMAT=JSON`,
    `&keywords=${q}`,
    `&itemFilter(0).name=SoldItemsOnly`,
    `&itemFilter(0).value=true`,
    `&itemFilter(1).name=Condition`,
    `&itemFilter(1).value=New`,
    `&sortOrder=EndTimeSoonest`,
    `&paginationInput.entriesPerPage=40`,
  ].join("");

  const res  = await fetch(url);
  const json = await res.json();

  const items = json
    ?.findCompletedItemsResponse?.[0]
    ?.searchResult?.[0]
    ?.item || [];

  const prices = items
    .map(i => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__))
    .filter(p => !isNaN(p) && p > 0)
    .sort((a, b) => a - b);

  if (!prices.length) return { market_usd: null, samples: 0, trend: "flat" };

  const median = prices[Math.floor(prices.length / 2)];

  // Tendencia: compara primer cuartil vs último cuartil
  const q1avg = avg(prices.slice(0, Math.floor(prices.length / 4) || 1));
  const q3avg = avg(prices.slice(Math.ceil(prices.length * 3 / 4)));
  const trend = q3avg > q1avg * 1.05 ? "up" : q3avg < q1avg * 0.95 ? "down" : "flat";

  return { market_usd: +median.toFixed(2), samples: prices.length, trend };
}

function avg(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  if (!APP_ID) throw new Error("EBAY_CLIENT_ID secret no configurado en GitHub Actions.");

  console.log(`🔍 Iniciando fetch — ${new Date().toISOString()}`);

  const results = {};
  for (const car of CARS) {
    try {
      console.log(`  → ${car.name}`);
      const data = await fetchSoldPrices(car.name);
      results[car.upc] = {
        ...data,
        market_soles: data.market_usd ? +(data.market_usd * TC).toFixed(2) : null,
        premium_pct:  data.market_usd ? Math.round(((data.market_usd - car.retail) / car.retail) * 100) : null,
        updated_at:   new Date().toISOString(),
      };
    } catch (e) {
      console.error(`  ✗ Error en ${car.name}:`, e.message);
      results[car.upc] = { market_usd: null, samples: 0, trend: "flat", updated_at: null };
    }
    // Pausa entre requests para no saturar la API
    await new Promise(r => setTimeout(r, 500));
  }

  const output = {
    generated_at: new Date().toISOString(),
    tc: TC,
    prices: results,
    cars: CARS,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`✅ prices.json generado con ${Object.keys(results).length} modelos.`);
}

main().catch(e => { console.error(e); process.exit(1); });
