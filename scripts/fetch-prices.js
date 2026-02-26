/**
 * fetch-prices.js — Ruma Store · Hot Wheels Market Tracker
 * Fuentes: eBay Sold Listings (scraping, sin API key) + Koban.pe + WheelCollectors (USD)
 */
import fs from "fs";
import path from "path";

const TC = 3.35;
const OUT = path.resolve("public/data/prices.json");
const WEIGHTS = { wheelcollectors: 0.50, koban: 0.30, ebay: 0.20 };

// ─── CATÁLOGO ──────────────────────────────────────────────────────────────────
const CARS = [
  { mix:"Mix 1", code:"956N", name:"Nissan Skyline GT-R (BNR34)", franchise:"Godzilla",         upc:"194735337279", retail:7.99, chase:true,  kobanQuery:"Nissan Skyline GT-R BNR34 Hot Wheels",      wcQuery:"Nissan Skyline GT-R BNR34 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 1", code:"956N", name:"1983 BMW 733i",                franchise:"Stranger Things", upc:"194735337354", retail:7.99, chase:false, kobanQuery:"BMW 733i Hot Wheels Stranger Things",       wcQuery:"BMW 733i Stranger Things 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 1", code:"956N", name:"'64 Lincoln Continental",      franchise:"The Matrix",      upc:"194735337118", retail:6.99, chase:false, kobanQuery:"Lincoln Continental Hot Wheels Matrix",     wcQuery:"Lincoln Continental Matrix 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 1", code:"956N", name:"Animated Series Batmobile",    franchise:"Batman TAS",      upc:"194735337132", retail:6.99, chase:false, kobanQuery:"Batmobile Animated Series Hot Wheels",     wcQuery:"Animated Series Batmobile Batman 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 1", code:"956N", name:"Reptar Wagon",                 franchise:"Rugrats",         upc:"194735337170", retail:5.99, chase:false, kobanQuery:"Reptar Wagon Hot Wheels Rugrats",           wcQuery:"Reptar Wagon Rugrats 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 3", code:"956Q", name:"Airwolf Helicopter",           franchise:"Airwolf",         upc:"194735262946", retail:7.99, chase:false, kobanQuery:"Airwolf Helicopter Hot Wheels",             wcQuery:"Airwolf Helicopter 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 3", code:"956Q", name:"Porsche 906 Carrera 6",        franchise:"TBD",             upc:"194735337316", retail:7.99, chase:false, kobanQuery:"Porsche 906 Carrera 6 Hot Wheels",         wcQuery:"Porsche 906 Carrera 6 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 3", code:"956Q", name:"H.I.S.S. Tank",               franchise:"G.I. Joe",        upc:"194735337194", retail:7.99, chase:true,  kobanQuery:"HISS Tank GI Joe Hot Wheels",              wcQuery:"HISS Tank GI Joe 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 3", code:"956Q", name:"Custom GMC Panel Van",         franchise:"TBD",             upc:"194735337255", retail:6.99, chase:false, kobanQuery:"GMC Panel Van Hot Wheels",                 wcQuery:"Custom GMC Panel Van 2026 Hot Wheels Pop Culture" },
  { mix:"Mix 3", code:"956Q", name:"Spider-Mobile",                franchise:"Marvel Spider-Man",upc:"194735337187", retail:6.99, chase:false, kobanQuery:"Spider-Mobile Hot Wheels Marvel",         wcQuery:"Spider-Mobile Spider-Man 2026 Hot Wheels Pop Culture" },
  ];

// ─── UTILS ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = arr => {
    if (!arr.length) return null;
    const s = [...arr].sort((a,b) => a-b);
    return s[Math.floor(s.length/2)];
};
const avg = arr => arr.reduce((s,v) => s+v, 0) / arr.length;

function weightedPrice(sources) {
    let tw = 0, ws = 0;
    for (const [k,v] of Object.entries(sources)) {
          if (v?.median > 0 && WEIGHTS[k]) {
                  ws += v.median * WEIGHTS[k];
                  tw += WEIGHTS[k];
          }
    }
    return tw > 0 ? +(ws/tw).toFixed(2) : null;
}

function calcConfidence(sources) {
    const active = Object.values(sources).filter(s => s?.median > 0);
    const n = active.length;
    if (n === 0) return "none";
    if (n >= 3) return "high";
    if (n === 2) return "medium";
    const totalSamples = active.reduce((sum, s) => sum + (s.samples || 1), 0);
    return totalSamples >= 3 ? "medium" : "low";
}

function calcTrend(prices) {
    if (prices.length < 4) return "flat";
    const q1 = avg(prices.slice(0, Math.floor(prices.length/4)));
    const q3 = avg(prices.slice(Math.ceil(prices.length*3/4)));
    return q3 > q1*1.05 ? "up" : q3 < q1*0.95 ? "down" : "flat";
}

// ─── EBAY SOLD LISTINGS (scraping público, sin API key) ──────────────────────
async function fetchEbay(carName) {
    try {
          const simpleName = carName.replace(/[()'"]/g,"").replace(/\s+/g," ").trim();
          const q = encodeURIComponent(`Hot Wheels ${simpleName} Pop Culture 2026`);
          const url = `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sacat=0&_ipg=60`;
          const res = await fetch(url, {
                  headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.5",
                  }
          });
          if (!res.ok) { console.warn(`  eBay scrape ${res.status} [${simpleName}]`); return null; }
          const html = await res.text();
          const priceRegex = /\$\s*(\d+\.\d{2})/g;
          const prices = [];
          let m;
          while ((m = priceRegex.exec(html)) !== null) {
                  const p = parseFloat(m[1]);
                  if (p >= 3 && p <= 150) prices.push(p);
          }
          prices.sort((a,b) => a-b);
          if (!prices.length) { console.warn(`  eBay [${simpleName}]: 0 precios`); return null; }
          console.log(`  eBay [${simpleName}]: ${prices.length} precios → $${median(prices)}`);
          return {
                  median: +median(prices).toFixed(2),
                  low:    prices[Math.floor(prices.length*0.25)] || prices[0],
                  high:   prices[Math.floor(prices.length*0.75)] || prices[prices.length-1],
                  samples: prices.length,
                  trend:  calcTrend(prices),
                  currency: "USD",
          };
    } catch(e) {
          console.warn(`  eBay error [${carName}]:`, e.message);
          return null;
    }
}

// ─── KOBAN.PE ──────────────────────────────────────────────────────────────────
async function fetchKoban(query) {
    try {
          const q = encodeURIComponent(query);
          const url = `https://koban.pe/search/suggest.json?q=${q}&resources[type]=product&resources[limit]=5`;
          const res = await fetch(url, { headers:{"User-Agent":"Mozilla/5.0 (compatible; RumaStoreBot/1.0)"} });
          if (!res.ok) return null;
          const json = await res.json();
          const products = json?.resources?.results?.products || [];
          if (!products.length) return null;
          const prices = products.map(p => {
                  const raw = p.price || p.variants?.[0]?.price;
                  if (!raw) return null;
                  const num = typeof raw==="number" ? raw/100 : parseFloat(String(raw).replace(/[^0-9.]/g,""));
                  return isNaN(num)||num<=0 ? null : num;
          }).filter(Boolean).sort((a,b) => a-b);
          if (!prices.length) return null;
          console.log(`  Koban [${query}]: ${prices.length} → S/ ${median(prices)}`);
          return { median: +median(prices).toFixed(2), low: prices[0], high: prices[prices.length-1], samples: prices.length, currency:"PEN" };
    } catch(e) {
          console.warn(`  Koban error [${query}]:`, e.message);
          return null;
    }
}

// ─── WHEELCOLLECTORS (Shopify API pública, precios en USD) ────────────────────
async function fetchWheelCollectors(query) {
    try {
          const q = encodeURIComponent(query);
          const url = `https://wheelcollectors.com/search/suggest.json?q=${q}&resources[type]=product&resources[limit]=5`;
          const res = await fetch(url, {
                  headers: {
                            "User-Agent": "Mozilla/5.0 (compatible; RumaStoreBot/1.0)",
                            "Accept": "application/json",
                  }
          });
          if (!res.ok) { console.warn(`  WheelCollectors HTTP ${res.status} [${query}]`); return null; }
          const json = await res.json();
          const products = json?.resources?.results?.products || [];
          if (!products.length) { console.warn(`  WheelCollectors [${query}]: 0 resultados`); return null; }

      const prices = products
            .filter(p => {
                      const title = p.title?.toLowerCase() || "";
                      return title.includes("hot wheels") && title.includes("pop culture");
            })
            .map(p => {
                      const raw = p.price || p.price_min;
                      if (!raw) return null;
                      const num = typeof raw === "number" ? raw / 100 : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
                      return isNaN(num) || num <= 0 ? null : num;
            })
            .filter(Boolean)
            .sort((a, b) => a - b);

      // Si no hay resultados con filtro Pop Culture, intentar sin filtro
      const allPrices = prices.length ? prices : products
            .filter(p => p.title?.toLowerCase().includes("hot wheels"))
            .map(p => {
                      const raw = p.price || p.price_min;
                      if (!raw) return null;
                      const num = typeof raw === "number" ? raw / 100 : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
                      return isNaN(num) || num <= 0 ? null : num;
            })
            .filter(Boolean)
            .sort((a, b) => a - b);

      if (!allPrices.length) { console.warn(`  WheelCollectors [${query}]: 0 precios válidos`); return null; }

      const med = +median(allPrices).toFixed(2);
          const medSoles = +(med * TC).toFixed(2);
          console.log(`  WheelCollectors [${query}]: ${allPrices.length} → $${med} (S/ ${medSoles})`);
          return {
                  median:     medSoles,
                  median_usd: med,
                  low:        +(allPrices[Math.floor(allPrices.length * 0.25)] || allPrices[0]).toFixed(2) * TC,
                  high:       +(allPrices[Math.floor(allPrices.length * 0.75)] || allPrices[allPrices.length - 1]).toFixed(2) * TC,
                  samples:    allPrices.length,
                  currency:   "PEN",
          };
    } catch(e) {
          console.warn(`  WheelCollectors error [${query}]:`, e.message);
          return null;
    }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🚗 Ruma Store Price Fetcher — ${new Date().toISOString()}`);
    console.log(`📡 eBay Sold Scraping ✓ | Koban ✓ | WheelCollectors ✓\n`);

  const results = {};

  for (const car of CARS) {
        console.log(`→ ${car.name} (${car.mix})`);

      const [ebay, koban, wc] = await Promise.all([
              fetchEbay(car.name),
              fetchKoban(car.kobanQuery),
              fetchWheelCollectors(car.wcQuery),
              sleep(500),
            ]);

      const sources = {
              ebay: ebay ? {
                        median:     +(ebay.median * TC).toFixed(2),
                        low:        +(ebay.low * TC).toFixed(2),
                        high:       +(ebay.high * TC).toFixed(2),
                        median_usd: ebay.median,
                        samples:    ebay.samples,
              } : null,
              koban: koban || null,
              wheelcollectors: wc || null,
      };

      const marketPriceSoles = weightedPrice(sources);
        const retailSoles      = +(car.retail * TC).toFixed(2);
        const allLows  = [sources.ebay?.low,  sources.koban?.low,  sources.wheelcollectors?.low ].filter(Boolean);
        const allHighs = [sources.ebay?.high, sources.koban?.high, sources.wheelcollectors?.high].filter(Boolean);

      results[car.upc] = {
              market_price_soles: marketPriceSoles,
              market_price_usd:   marketPriceSoles ? +(marketPriceSoles / TC).toFixed(2) : null,
              low_soles:          allLows.length  ? +Math.min(...allLows).toFixed(2)  : null,
              high_soles:         allHighs.length ? +Math.max(...allHighs).toFixed(2) : null,
              retail_soles:       retailSoles,
              premium_pct:        marketPriceSoles ? Math.round(((marketPriceSoles - retailSoles) / retailSoles) * 100) : null,
              trend:              ebay?.trend || "flat",
              confidence:         calcConfidence(sources),
              sources: {
                        ebay: sources.ebay ? {
                                    median_soles: sources.ebay.median,
                                    median_usd:   sources.ebay.median_usd,
                                    samples:      sources.ebay.samples,
                        } : null,
                        koban: sources.koban ? {
                                    median_soles: sources.koban.median,
                                    samples:      sources.koban.samples,
                        } : null,
                        wheelcollectors: sources.wheelcollectors ? {
                                    median_soles: sources.wheelcollectors.median,
                                    median_usd:   sources.wheelcollectors.median_usd,
                                    samples:      sources.wheelcollectors.samples,
                        } : null,
              },
              updated_at: new Date().toISOString(),
      };

      const r = results[car.upc];
        console.log(`  ✓ S/ ${r.market_price_soles ?? "—"} | conf: ${r.confidence} | trend: ${r.trend}`);
        console.log(`  eBay: $${ebay?.median ?? "—"} | Koban: S/${sources.koban?.median ?? "—"} | WC: $${wc?.median_usd ?? "—"}`);
  }

  const output = {
        generated_at: new Date().toISOString(),
        tc: TC,
        sources_active: { ebay: true, koban: true, wheelcollectors: true },
        prices: results,
        cars: CARS,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2));

  const withData = Object.values(results).filter(r => r.market_price_soles > 0).length;
    console.log(`\n✅ Completado: ${withData}/${CARS.length} con precio · ${new Date().toISOString()}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
