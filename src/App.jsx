/**
 * App.jsx — Ruma Store · Hot Wheels Market Tracker
 * Lee /data/prices.json — generado por GitHub Actions 3x/día
 * Muestra precio ponderado de eBay + Koban.pe + WheelCollectors (USD)
 */
import { useState, useEffect } from "react";

// ─── HELPERS ──────────────────────────────────────────────────────────────
const fmt = (n, d=2) => n != null ? n.toFixed(d) : null;
const fmtSoles = n => n != null ? `S/ ${fmt(n)}` : "—";
const fmtUsd   = n => n != null ? `$ ${fmt(n)}` : "—";

function premiumClass(pct) {
  if (pct == null) return "none";
  if (pct <= 0) return "none";
  if (pct < 30) return "low";
  if (pct < 100) return "med";
  return "high";
}

function confidenceDot(level) {
  const map   = { high:"#00e676", medium:"#ffd600", low:"#ff8c00", none:"#3a3a5a" };
  const label = { high:"Alta", medium:"Media", low:"Baja", none:"Sin datos" };
  return { color: map[level]||map.none, label: label[level]||"—" };
}

function getTimeSlot() {
  const h = new Date().getHours();
  if (h < 12) return "🌅 Apertura";
  if (h < 18) return "🌇 Atardecer";
  return "🌙 Cierre";
}

// ─── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

:root {
  --bg: #0d0d14;
  --surface: #13131e;
  --surface2: #1c1c2a;
  --surface3: #242436;
  --border: #2e2e45;
  --border-bright: #3d3d5c;
  --accent: #ff4500;
  --accent-dim: rgba(255,69,0,.15);
  --green: #00e676;
  --green-dim: rgba(0,230,118,.12);
  --yellow: #ffd600;
  --yellow-dim: rgba(255,214,0,.12);
  --red: #ff1744;
  --blue: #64b5f6;
  --blue-dim: rgba(100,181,246,.12);
  --muted: #6b6b90;
  --muted2: #4a4a6a;
  --text: #eaeaf5;
  --text2: #c0c0d8;
  --gold: #f5c842;
  --gold-dim: rgba(245,200,66,.15);
}

body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; }

.root { min-height:100vh; padding:24px 16px; }
.wrapper { max-width:1280px; margin:0 auto; }

/* ── Header ── */
.header {
  display:flex; justify-content:space-between; align-items:flex-end;
  flex-wrap:wrap; gap:12px; margin-bottom:20px;
}
h1 { font-family:'Bebas Neue',sans-serif; font-size:38px; letter-spacing:2px; line-height:1; }
h1 span { color:var(--accent); text-shadow:0 0 30px rgba(255,69,0,.4); }
.sub { font-size:11px; color:var(--muted); margin-top:5px; font-family:'DM Mono',monospace; letter-spacing:.5px; }

.badges { display:flex; gap:6px; flex-wrap:wrap; }
.badge {
  font-size:10px; font-weight:600; padding:4px 10px; border-radius:20px;
  letter-spacing:.8px; text-transform:uppercase; font-family:'DM Mono',monospace;
  background:var(--surface2); border:1px solid var(--border); color:var(--muted);
}
.badge.live { background:rgba(0,230,118,.08); border-color:rgba(0,230,118,.3); color:#69f0ae; animation:pulse 2s infinite; }
.badge.slot { background:var(--blue-dim); border-color:rgba(100,181,246,.3); color:var(--blue); }
.badge.src  { background:rgba(255,214,0,.08); border-color:rgba(255,214,0,.3); color:#ffdd44; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

/* ── Stats ── */
.stats {
  display:grid; grid-template-columns:repeat(4,1fr);
  gap:12px; margin-bottom:20px;
}
.stat {
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:16px 14px; position:relative; overflow:hidden;
  transition:border-color .2s, transform .2s;
}
.stat::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:var(--accent);
}
.stat.g::before { background:var(--green); }
.stat.y::before { background:var(--yellow); }
.stat.b::before { background:var(--blue); }
.stat:hover { border-color:var(--border-bright); transform:translateY(-1px); }

.stat-l { font-size:9px; text-transform:uppercase; letter-spacing:1.8px; color:var(--muted); margin-bottom:6px; font-weight:600; }
.stat-v { font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:1px; line-height:1; }
.stat.g .stat-v { color:var(--green); }
.stat.y .stat-v { color:var(--yellow); }
.stat.b .stat-v { color:var(--blue); }
.stat-s { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:4px; }

/* ── Controls ── */
.controls { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; align-items:center; }
.fbtn {
  padding:6px 14px; border-radius:20px; font-size:12px; font-weight:500;
  cursor:pointer; background:var(--surface2); border:1px solid var(--border);
  color:var(--muted); font-family:'DM Sans',sans-serif; transition:all .15s; letter-spacing:.3px;
}
.fbtn.active, .fbtn:hover { background:var(--green-dim); border-color:rgba(0,230,118,.4); color:var(--green); }
.ts { margin-left:auto; font-size:10px; color:var(--muted2); font-family:'DM Mono',monospace; }

/* ── Table wrapper ── */
.tbl-wrap {
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.4);
}
.tbl-top {
  padding:12px 16px; background:var(--surface2); border-bottom:1px solid var(--border);
  display:flex; justify-content:space-between; align-items:center; gap:8px;
}
.tbl-top span { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.8px; font-family:'DM Mono',monospace; }
.tbl-top span:first-child::before { content:'●'; color:var(--green); margin-right:6px; }

/* ── DESKTOP TABLE ── */
table { width:100%; border-collapse:collapse; }

thead th {
  padding:10px 12px; text-align:left; font-size:10px; font-weight:600;
  text-transform:uppercase; letter-spacing:1.5px; color:var(--muted);
  font-family:'DM Mono',monospace; background:#0d0d14; white-space:nowrap;
  border-bottom:1px solid var(--border);
}
thead th:not(:first-child) { text-align:right; }

tbody tr { border-top:1px solid var(--border); transition:background .15s; }
tbody tr:hover { background:var(--surface2); }

td { padding:13px 12px; vertical-align:middle; }
td:not(:first-child) { text-align:right; }

/* ── Car info ── */
.car-name { font-weight:600; font-size:13px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; color:var(--text); }
.car-meta { font-size:11px; color:var(--muted); margin-top:3px; font-family:'DM Mono',monospace; }
.car-upc  { font-size:10px; color:var(--muted2); font-family:'DM Mono',monospace; margin-top:2px; }
.chase {
  background:linear-gradient(135deg,#ff6a00,#ff4500); color:#fff;
  font-size:9px; font-weight:700; padding:2px 7px; border-radius:10px;
  letter-spacing:.8px; white-space:nowrap; box-shadow:0 0 10px rgba(255,69,0,.4);
}

/* ── Prices ── */
.retail-sol { font-family:'DM Mono',monospace; font-size:13px; color:var(--text2); font-weight:500; }
.retail-usd { font-family:'DM Mono',monospace; font-size:10px; color:var(--muted); margin-top:2px; }

.mkt-sol   { font-family:'DM Mono',monospace; font-size:16px; font-weight:600; color:var(--gold); letter-spacing:.5px; }
.mkt-range { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:3px; }
.no-data   { color:var(--muted2); font-size:11px; font-family:'DM Mono',monospace; font-style:italic; }

/* ── Premium badge ── */
.prem {
  font-size:11px; font-family:'DM Mono',monospace; padding:3px 9px;
  border-radius:20px; display:inline-block; font-weight:600;
}
.prem.high { background:var(--green-dim); color:var(--green); border:1px solid rgba(0,230,118,.3); }
.prem.med  { background:rgba(255,140,0,.12); color:#ff8c00; border:1px solid rgba(255,140,0,.3); }
.prem.low  { background:rgba(255,100,100,.1); color:#ff7070; border:1px solid rgba(255,100,100,.25); }
.prem.none { background:var(--surface2); color:var(--muted); border:1px solid var(--border); }

/* ── Tendencia ── */
.trend-up   { color:var(--green); font-size:12px; font-weight:700; }
.trend-down { color:var(--red);   font-size:12px; font-weight:700; }
.trend-flat { color:var(--muted); font-size:12px; }

/* ── Fuentes ── */
.sources-cell { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.src-row { display:flex; align-items:center; gap:5px; }
.src-label { font-size:9px; text-transform:uppercase; letter-spacing:.8px; color:var(--muted); font-family:'DM Mono',monospace; width:28px; text-align:right; }
.src-val { font-size:11px; font-family:'DM Mono',monospace; }
.src-val.active { color:var(--text2); }
.src-val.none   { color:var(--muted2); }
.src-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

/* ── Confianza ── */
.conf-cell { display:flex; flex-direction:column; align-items:flex-end; }
.conf-label { font-size:11px; font-family:'DM Mono',monospace; display:flex; align-items:center; gap:5px; }
.conf-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

/* ── Loading / error ── */
.loading-row td { text-align:center !important; padding:48px; color:var(--muted); font-family:'DM Mono',monospace; }
.spinner { display:inline-block; width:16px; height:16px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; margin-right:8px; vertical-align:middle; }
@keyframes spin { to { transform:rotate(360deg); } }
.error-banner { background:rgba(255,23,68,.08); border:1px solid rgba(255,23,68,.25); border-radius:10px; padding:10px 16px; margin-bottom:16px; font-size:12px; color:#ff7070; font-family:'DM Mono',monospace; }

/* ── Footer ── */
.footer { margin-top:16px; font-size:10px; color:var(--muted2); font-family:'DM Mono',monospace; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; }

/* ════════════════════════════════════════════════
   RESPONSIVE — MOBILE CARDS
   ════════════════════════════════════════════════ */
@media(max-width:1024px) {
  thead th:nth-child(6), td:nth-child(6) { display:none; }
}

@media(max-width:768px) {
  .stats { grid-template-columns:repeat(2,1fr); }
  h1 { font-size:30px; }
  .root { padding:16px 12px; }

  /* Ocultar tabla normal en móvil */
  .desktop-table { display:none; }

  /* Activar cards en móvil */
  .mobile-cards { display:flex; flex-direction:column; }
}

@media(min-width:769px) {
  /* Ocultar cards en desktop */
  .mobile-cards { display:none; }
}

/* ── Mobile card ── */
.car-card {
  border-top:1px solid var(--border); padding:14px 16px;
  transition:background .15s;
}
.car-card:first-child { border-top:none; }
.car-card:hover { background:var(--surface2); }

.card-header { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px; }
.card-title-block { flex:1; }
.card-title { font-weight:600; font-size:14px; color:var(--text); line-height:1.3; }
.card-meta  { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:3px; }

.card-mkt {
  text-align:right; flex-shrink:0;
  background:var(--gold-dim); border:1px solid rgba(245,200,66,.25);
  border-radius:10px; padding:6px 10px;
  min-width:90px;
}
.card-mkt-label { font-size:8px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); font-family:'DM Mono',monospace; margin-bottom:2px; }
.card-mkt-price { font-family:'DM Mono',monospace; font-size:18px; font-weight:700; color:var(--gold); line-height:1; }
.card-mkt-range { font-size:9px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:3px; }
.card-mkt-nodata { font-family:'DM Mono',monospace; font-size:12px; color:var(--muted2); font-style:italic; padding:4px 0; }

.card-row {
  display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:8px;
}
.card-pill {
  display:flex; align-items:center; gap:4px; background:var(--surface2);
  border:1px solid var(--border); border-radius:20px; padding:3px 9px;
  font-size:10px; font-family:'DM Mono',monospace; color:var(--text2);
}
.card-pill-label { color:var(--muted); font-size:9px; margin-right:1px; }

.card-sources {
  display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; padding-top:8px;
  border-top:1px solid var(--border);
}
.card-src-item {
  display:flex; flex-direction:column; align-items:center; gap:2px;
  background:var(--surface2); border:1px solid var(--border);
  border-radius:8px; padding:5px 8px; min-width:60px;
}
.card-src-name { font-size:8px; text-transform:uppercase; letter-spacing:.8px; color:var(--muted); font-family:'DM Mono',monospace; }
.card-src-price { font-size:11px; font-family:'DM Mono',monospace; color:var(--text); font-weight:500; }
.card-src-price.none { color:var(--muted2); font-style:italic; }
.card-src-dot { width:5px; height:5px; border-radius:50%; margin-top:1px; }

@media(max-width:400px) {
  .card-mkt-price { font-size:16px; }
  .card-mkt { min-width:80px; padding:5px 8px; }
  h1 { font-size:24px; }
}
`;

// ─── CATÁLOGO FALLBACK ───────────────────────────────────────────────────
const CARS_FALLBACK = [
  { mix:"Mix 1", code:"956N", name:"Nissan Skyline GT-R (BNR34)", franchise:"Godzilla",         upc:"194735337279", retail:7.99, chase:true  },
  { mix:"Mix 1", code:"956N", name:"1983 BMW 733i",               franchise:"Stranger Things",  upc:"194735337354", retail:7.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"'64 Lincoln Continental",     franchise:"The Matrix",       upc:"194735337118", retail:6.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"Animated Series Batmobile",   franchise:"Batman TAS",       upc:"194735337132", retail:6.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"Reptar Wagon",                franchise:"Rugrats",          upc:"194735337170", retail:5.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Airwolf Helicopter",          franchise:"Airwolf",          upc:"194735262946", retail:7.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Porsche 906 Carrera 6",       franchise:"TBD",              upc:"194735337316", retail:7.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"H.I.S.S. Tank",              franchise:"G.I. Joe",         upc:"194735337194", retail:7.99, chase:true  },
  { mix:"Mix 3", code:"956Q", name:"Custom GMC Panel Van",        franchise:"TBD",              upc:"194735337255", retail:6.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Spider-Mobile",               franchise:"Marvel Spider-Man",upc:"194735337187", retail:6.99, chase:false },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/prices.json?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch(e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cars   = data?.cars?.length ? data.cars : CARS_FALLBACK;
  const prices = data?.prices || {};
  const tc     = data?.tc || 3.35;
  const mixes  = [...new Set(cars.map(c => c.mix))];
  const visible = filter === "all" ? cars : cars.filter(c => c.mix === filter);

  // Stats
  const withMkt = cars.filter(c => prices[c.upc]?.market_price_soles > 0);
  const avgSoles = withMkt.length
    ? withMkt.reduce((s,c) => s + prices[c.upc].market_price_soles, 0) / withMkt.length
    : null;
  const highConf = cars.filter(c => prices[c.upc]?.confidence === "high").length;
  const trendUp  = cars.filter(c => prices[c.upc]?.trend === "up").length;
  const srcActive = data?.sources_active
    ? Object.values(data.sources_active).filter(Boolean).length : 0;
  const generatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString("es-PE",{timeZone:"America/Lima",dateStyle:"short",timeStyle:"short"})
    : null;

  // Row renderer (shared logic)
  function renderDesktopRow(car) {
    const p    = prices[car.upc] || {};
    const mkt  = p.market_price_soles;
    const pct  = p.premium_pct ?? null;
    const conf = confidenceDot(p.confidence || "none");
    const srcs = p.sources || {};
    return (
      <tr key={car.upc}>
        <td>
          <div className="car-name">
            {car.name}
            {car.chase && <span className="chase">🔥 Chase</span>}
          </div>
          <div className="car-meta">{car.franchise} · {car.mix} · {car.code}</div>
          <div className="car-upc">{car.upc}</div>
        </td>
        <td>
          <div className="retail-sol">{fmtSoles(p.retail_soles || car.retail*tc)}</div>
          <div className="retail-usd">{fmtUsd(car.retail)}</div>
        </td>
        <td>
          {mkt ? <>
            <div className="mkt-sol">{fmtSoles(mkt)}</div>
            {p.low_soles && p.high_soles &&
              <div className="mkt-range">{fmtSoles(p.low_soles)} – {fmtSoles(p.high_soles)}</div>}
          </> : <span className="no-data">sin datos</span>}
        </td>
        <td>
          <span className={`prem ${premiumClass(pct)}`}>
            {pct != null ? `${pct>=0?"+":""}${pct}%` : "—"}
          </span>
        </td>
        <td>
          {p.trend === "up"   && <span className="trend-up">▲ UP</span>}
          {p.trend === "down" && <span className="trend-down">▼ DOWN</span>}
          {(!p.trend || p.trend === "flat") && <span className="trend-flat">— —</span>}
        </td>
        <td>
          <div className="sources-cell">
            {[{key:"ebay",label:"eBay"},{key:"koban",label:"KBN"},{key:"wheelcollectors",label:"WC"}].map(({key,label}) => {
              const s = srcs[key];
              return (
                <div key={key} className="src-row">
                  <span className="src-label">{label}</span>
                  <span className={`src-val ${s?.median_soles?"active":"none"}`}>
                    {s?.median_soles ? fmtSoles(s.median_soles) : "—"}
                  </span>
                  <span className="src-dot" style={{background: s?.median_soles?"#00e676":"#2a2a3a"}}/>
                </div>
              );
            })}
          </div>
        </td>
        <td>
          <div className="conf-cell">
            <span className="conf-label">
              <span className="conf-dot" style={{background:conf.color}}/>
              {conf.label}
            </span>
          </div>
        </td>
      </tr>
    );
  }

  function renderMobileCard(car) {
    const p    = prices[car.upc] || {};
    const mkt  = p.market_price_soles;
    const pct  = p.premium_pct ?? null;
    const conf = confidenceDot(p.confidence || "none");
    const srcs = p.sources || {};
    return (
      <div key={car.upc} className="car-card">
        <div className="card-header">
          <div className="card-title-block">
            <div className="card-title">
              {car.name}
              {car.chase && <> <span className="chase">🔥 Chase</span></>}
            </div>
            <div className="card-meta">{car.franchise} · {car.mix} · {car.code}</div>
          </div>
          <div className="card-mkt">
            <div className="card-mkt-label">Market Price</div>
            {mkt ? <>
              <div className="card-mkt-price">{fmtSoles(mkt)}</div>
              {p.low_soles && p.high_soles &&
                <div className="card-mkt-range">{fmtSoles(p.low_soles)}–{fmtSoles(p.high_soles)}</div>}
            </> : <div className="card-mkt-nodata">sin datos</div>}
          </div>
        </div>

        <div className="card-row">
          <div className="card-pill">
            <span className="card-pill-label">Retail</span>
            {fmtSoles(p.retail_soles || car.retail*tc)}
          </div>
          <span className={`prem ${premiumClass(pct)}`}>
            {pct != null ? `${pct>=0?"+":""}${pct}%` : "—"}
          </span>
          <div className="card-pill">
            {p.trend === "up"   && <span className="trend-up">▲ UP</span>}
            {p.trend === "down" && <span className="trend-down">▼ DOWN</span>}
            {(!p.trend || p.trend === "flat") && <span className="trend-flat">— —</span>}
          </div>
          <div className="card-pill" style={{gap:"5px"}}>
            <span className="conf-dot" style={{background:conf.color, width:'7px', height:'7px', borderRadius:'50%', flexShrink:0}}/>
            <span style={{fontSize:'10px', fontFamily:"'DM Mono',monospace"}}>{conf.label}</span>
          </div>
        </div>

        <div className="card-sources">
          {[{key:"ebay",label:"eBay"},{key:"koban",label:"KBN"},{key:"wheelcollectors",label:"WC"}].map(({key,label}) => {
            const s = srcs[key];
            return (
              <div key={key} className="card-src-item">
                <span className="card-src-name">{label}</span>
                <span className={`card-src-price ${s?.median_soles?"":"none"}`}>
                  {s?.median_soles ? fmtSoles(s.median_soles) : "—"}
                </span>
                <span className="card-src-dot" style={{background: s?.median_soles?"#00e676":"#2a2a3a"}}/>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="root">
        <div className="wrapper">

          <div className="header">
            <div>
              <h1>HOT WHEELS <span>POP CULTURE 2026</span></h1>
              <div className="sub">Market Price Tracker · Ruma Store · TC: S/ {tc.toFixed(2)} × USD</div>
            </div>
            <div className="badges">
              <span className="badge live">● Live</span>
              <span className="badge slot">{getTimeSlot()}</span>
              <span className="badge src">⚡ {srcActive} fuentes</span>
              <span className="badge">3× día</span>
            </div>
          </div>

          {error && <div className="error-banner">⚠ {error}</div>}

          <div className="stats">
            <div className="stat">
              <div className="stat-l">Precio mediano</div>
              <div className="stat-v">{avgSoles ? fmtSoles(avgSoles) : "—"}</div>
              <div className="stat-s">{avgSoles ? fmtUsd(avgSoles/tc)+" USD equiv." : loading?"cargando…":"sin datos"}</div>
            </div>
            <div className="stat g">
              <div className="stat-l">Confianza alta</div>
              <div className="stat-v">{highConf} modelos</div>
              <div className="stat-s">3 fuentes confirman</div>
            </div>
            <div className="stat y">
              <div className="stat-l">Tendencia ▲</div>
              <div className="stat-v">{trendUp} modelos</div>
              <div className="stat-s">subiendo en mercado</div>
            </div>
            <div className="stat b">
              <div className="stat-l">Fuentes activas</div>
              <div className="stat-v">{srcActive} / 3</div>
              <div className="stat-s">eBay · Koban · WheelCollectors</div>
            </div>
          </div>

          <div className="controls">
            <button className={`fbtn${filter==="all"?" active":""}`} onClick={()=>setFilter("all")}>Todos</button>
            {mixes.map(m => (
              <button key={m} className={`fbtn${filter===m?" active":""}`} onClick={()=>setFilter(m)}>{m}</button>
            ))}
            {generatedAt && <span className="ts">↻ {generatedAt} Lima</span>}
          </div>

          <div className="tbl-wrap">
            <div className="tbl-top">
              <span>eBay sold · Koban.pe · WheelCollectors — precio ponderado</span>
              <span>TC S/ {tc} × USD</span>
            </div>

            {/* DESKTOP TABLE */}
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Retail S/</th>
                  <th>Market Price S/</th>
                  <th>Premium</th>
                  <th>Tendencia</th>
                  <th>Fuentes</th>
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="loading-row">
                    <td colSpan={7}><span className="spinner"/>Cargando precios…</td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr className="loading-row"><td colSpan={7}>Sin modelos para este filtro.</td></tr>
                ) : visible.map(renderDesktopRow)}
              </tbody>
            </table>

            {/* MOBILE CARDS */}
            <div className="mobile-cards">
              {loading ? (
                <div style={{padding:'40px', textAlign:'center', color:'var(--muted)', fontFamily:"'DM Mono',monospace"}}>
                  <span className="spinner"/>Cargando precios…
                </div>
              ) : visible.length === 0 ? (
                <div style={{padding:'40px', textAlign:'center', color:'var(--muted)', fontFamily:"'DM Mono',monospace"}}>
                  Sin modelos para este filtro.
                </div>
              ) : visible.map(renderMobileCard)}
            </div>
          </div>

          <div className="footer">
            <span>Precio ponderado: eBay 20% · Koban.pe 30% · WheelCollectors 50% · New/Sealed · 3× día</span>
            <span>Ruma Store Intelligence · rumastore.shop</span>
          </div>

        </div>
      </div>
    </>
  );
}
