/**
 * App.jsx — Ruma Store · Hot Wheels Market Tracker
 * Lee /data/prices.json — generado por GitHub Actions 3x/día
 * Muestra precio ponderado de eBay + Koban.pe + MercadoLibre Perú
 */

import { useState, useEffect, useRef } from "react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmt     = (n, d=2) => n != null ? n.toFixed(d) : null;
const fmtSoles = n => n != null ? `S/ ${fmt(n)}` : "—";
const fmtUsd   = n => n != null ? `$ ${fmt(n)}` : "—";

function premiumClass(pct) {
  if (pct == null) return "none";
  if (pct <= 0)   return "none";
  if (pct < 30)   return "low";
  if (pct < 100)  return "med";
  return "high";
}

function confidenceDot(level) {
  const map = { high:"#00e676", medium:"#ffd600", low:"#ff8c00", none:"#3a3a5a" };
  const label = { high:"Alta", medium:"Media", low:"Baja", none:"Sin datos" };
  const color = map[level] || map.none;
  return { color, label: label[level] || "—" };
}

function getTimeSlot() {
  const h = new Date().getHours();
  if (h < 12) return "🌅 Apertura";
  if (h < 18) return "🌇 Atardecer";
  return "🌙 Cierre";
}

// ─── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
:root {
  --bg:#0a0a0f; --surface:#111118; --surface2:#1a1a24; --border:#2a2a3a;
  --accent:#ff4500; --green:#00e676; --yellow:#ffd600; --red:#ff1744;
  --muted:#5a5a7a; --text:#e8e8f0; --gold:#f0c060;
}
body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; }
.root { min-height:100vh; padding:28px 20px; }
.wrapper { max-width:1280px; margin:0 auto; }

/* Header */
.header { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:20px; }
h1 { font-family:'Bebas Neue',sans-serif; font-size:36px; letter-spacing:2px; line-height:1; }
h1 span { color:var(--accent); }
.sub { font-size:11px; color:var(--muted); margin-top:4px; font-family:'DM Mono',monospace; }
.badges { display:flex; gap:6px; flex-wrap:wrap; }
.badge { font-size:10px; font-weight:600; padding:3px 9px; border-radius:4px; letter-spacing:1px; text-transform:uppercase; font-family:'DM Mono',monospace; background:var(--surface2); border:1px solid var(--border); color:var(--muted); }
.badge.live { background:#0a2000; border-color:#1a4000; color:#69f0ae; animation:pulse 2s infinite; }
.badge.slot { background:#0a1a2a; border-color:#1a3a5a; color:#64b5f6; }
.badge.src  { background:#1a1200; border-color:#3a2a00; color:#ffcc44; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

/* Stats */
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
.stat { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:14px; border-left:3px solid var(--accent); }
.stat.g { border-left-color:var(--green); }
.stat.y { border-left-color:var(--yellow); }
.stat.b { border-left-color:#64b5f6; }
.stat-l { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:var(--muted); margin-bottom:4px; }
.stat-v { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:1px; }
.stat-s { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }

/* Controls */
.controls { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
.fbtn { padding:5px 13px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; background:var(--surface2); border:1px solid var(--border); color:var(--muted); font-family:'DM Sans',sans-serif; transition:all .15s; }
.fbtn.active,.fbtn:hover { background:#1a2a1a; border-color:#2a5a2a; color:var(--green); }
.ts { margin-left:auto; font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; }

/* Table */
.tbl-wrap { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.tbl-top { padding:10px 16px; background:var(--surface2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
.tbl-top span { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; }
table { width:100%; border-collapse:collapse; }
thead th { padding:10px 12px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; color:var(--muted); font-family:'DM Mono',monospace; background:#0d0d14; white-space:nowrap; }
thead th:not(:first-child) { text-align:right; }
tbody tr { border-top:1px solid var(--border); transition:background .15s; }
tbody tr:hover { background:var(--surface2); }
td { padding:12px; vertical-align:middle; }
td:not(:first-child) { text-align:right; }

.car-name { font-weight:600; font-size:13px; display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.car-meta { font-size:11px; color:var(--muted); margin-top:3px; font-family:'DM Mono',monospace; }
.car-upc  { font-size:10px; color:#3a3a5a; font-family:'DM Mono',monospace; margin-top:1px; }
.chase { background:linear-gradient(135deg,#ff8c00,#ff4500); color:#fff; font-size:9px; font-weight:700; padding:2px 5px; border-radius:3px; letter-spacing:1px; }

/* Prices */
.retail-usd  { font-family:'DM Mono',monospace; font-size:13px; color:var(--muted); }
.retail-sol  { font-family:'DM Mono',monospace; font-size:11px; color:#3a3a5a; }
.mkt-sol     { font-family:'DM Mono',monospace; font-size:15px; font-weight:600; color:var(--gold); }
.mkt-range   { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.no-data     { color:#3a3a5a; font-size:12px; font-family:'DM Mono',monospace; }

.prem { font-size:11px; font-family:'DM Mono',monospace; padding:3px 7px; border-radius:4px; display:inline-block; }
.prem.high { background:#0d2a0d; color:var(--green);  border:1px solid #1a5a1a; }
.prem.med  { background:#2a1a00; color:#ff8c00;        border:1px solid #5a3800; }
.prem.low  { background:#1a0a0a; color:#ff6060;        border:1px solid #4a1a1a; }
.prem.none { background:var(--surface); color:var(--muted); border:1px solid var(--border); }

/* Fuentes desglose */
.sources-cell { display:flex; flex-direction:column; align-items:flex-end; gap:3px; }
.src-row { display:flex; align-items:center; gap:5px; }
.src-label { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); font-family:'DM Mono',monospace; width:28px; text-align:right; }
.src-val   { font-size:11px; font-family:'DM Mono',monospace; }
.src-val.active { color:var(--text); }
.src-val.none   { color:#3a3a5a; }
.src-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

/* Confianza */
.conf-cell { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.conf-dot  { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:4px; }
.conf-label { font-size:11px; font-family:'DM Mono',monospace; }
.trend-up   { color:var(--green);  font-size:12px; font-weight:700; }
.trend-down { color:var(--red);    font-size:12px; font-weight:700; }
.trend-flat { color:var(--muted);  font-size:12px; }

/* Loading */
.loading-row td { text-align:center !important; padding:40px; color:var(--muted); font-family:'DM Mono',monospace; }
.spinner { display:inline-block; width:16px; height:16px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; margin-right:8px; vertical-align:middle; }
@keyframes spin { to { transform:rotate(360deg); } }
.error-banner { background:#1a0000; border:1px solid #4a0000; border-radius:8px; padding:10px 16px; margin-bottom:14px; font-size:12px; color:#ff6060; font-family:'DM Mono',monospace; }

/* Footer */
.footer { margin-top:14px; font-size:10px; color:#3a3a5a; font-family:'DM Mono',monospace; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; }

/* Responsive */
@media(max-width:1024px) { thead th:nth-child(6),td:nth-child(6) { display:none; } }
@media(max-width:768px)  { .stats{grid-template-columns:repeat(2,1fr)} thead th:nth-child(3),td:nth-child(3),thead th:nth-child(5),td:nth-child(5){display:none} }
@media(max-width:500px)  { h1{font-size:24px} td{padding:9px 7px} }
`;

// ─── COMPONENT ─────────────────────────────────────────────────────────────
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
      } catch(e) { setError(e.message); }
      finally   { setLoading(false); }
    }
    load();
  }, []);

  const cars   = data?.cars   || [];
  const prices = data?.prices || {};
  const tc     = data?.tc     || 3.35;
  const mixes  = [...new Set(cars.map(c => c.mix))];
  const visible = filter === "all" ? cars : cars.filter(c => c.mix === filter);

  // Stats
  const withMkt  = cars.filter(c => prices[c.upc]?.market_price_soles > 0);
  const avgSoles = withMkt.length ? (withMkt.reduce((s,c)=>s+prices[c.upc].market_price_soles,0)/withMkt.length) : null;
  const highConf = cars.filter(c => prices[c.upc]?.confidence === "high").length;
  const trendUp  = cars.filter(c => prices[c.upc]?.trend === "up").length;
  const srcActive = data?.sources_active
    ? Object.values(data.sources_active).filter(Boolean).length : 0;

  const generatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString("es-PE",{timeZone:"America/Lima",dateStyle:"short",timeStyle:"short"})
    : null;

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
              <div className="stat-s">{avgSoles ? fmtUsd(avgSoles/tc) + " USD equiv." : loading ? "cargando…" : "sin datos"}</div>
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
              <div className="stat-s">eBay · Koban · MercadoLibre</div>
            </div>
          </div>

          <div className="controls">
            <button className={`fbtn${filter==="all"?" active":""}`} onClick={()=>setFilter("all")}>Todos</button>
            {mixes.map(m=>(
              <button key={m} className={`fbtn${filter===m?" active":""}`} onClick={()=>setFilter(m)}>{m}</button>
            ))}
            {generatedAt && <span className="ts">↻ {generatedAt} Lima</span>}
          </div>

          <div className="tbl-wrap">
            <div className="tbl-top">
              <span>● eBay sold · Koban.pe · MercadoLibre Perú — precio ponderado</span>
              <span>TC S/ {tc} × USD</span>
            </div>
            <table>
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
                ) : visible.map(car => {
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
                        <div className="retail-usd">{fmtSoles(p.retail_soles || car.retail*tc)}</div>
                        <div className="retail-sol">{fmtUsd(car.retail)}</div>
                      </td>

                      <td>
                        {mkt
                          ? <>
                              <div className="mkt-sol">{fmtSoles(mkt)}</div>
                              {p.low_soles && p.high_soles &&
                                <div className="mkt-range">{fmtSoles(p.low_soles)} – {fmtSoles(p.high_soles)}</div>}
                            </>
                          : <span className="no-data">sin datos</span>}
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
                          {[
                            { key:"ebay",         label:"eBay" },
                            { key:"koban",        label:"KBN"  },
                            { key:"mercadolibre", label:"ML"   },
                          ].map(({key,label}) => {
                            const s = srcs[key];
                            return (
                              <div key={key} className="src-row">
                                <span className="src-label">{label}</span>
                                <span className={`src-val ${s?.median_soles ? "active" : "none"}`}>
                                  {s?.median_soles ? fmtSoles(s.median_soles) : "—"}
                                </span>
                                <span className="src-dot" style={{background: s?.median_soles ? "#00e676" : "#2a2a3a"}}/>
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
                })}
              </tbody>
            </table>
          </div>

          <div className="footer">
            <span>Precio ponderado: eBay 20% · Koban.pe 25% · MercadoLibre Perú 55% · New/Sealed · 3× día</span>
            <span>Ruma Store Intelligence · rumastore.shop</span>
          </div>

        </div>
      </div>
    </>
  );
}
