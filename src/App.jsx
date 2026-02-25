
import { useState, useEffect, useCallback } from "react";

const TC = 3.35;

const CARS = [
  { mix:"Mix 1", code:"956N", name:"Nissan Skyline GT-R (BNR34)", franchise:"Godzilla",        upc:"194735337279", retail:7.99, chase:true  },
  { mix:"Mix 1", code:"956N", name:"1983 BMW 733i",               franchise:"Stranger Things",  upc:"194735337354", retail:7.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"'64 Lincoln Continental",     franchise:"The Matrix",       upc:"194735337118", retail:6.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"Animated Series Batmobile",   franchise:"Batman TAS",       upc:"194735337132", retail:6.99, chase:false },
  { mix:"Mix 1", code:"956N", name:"Reptar Wagon",                franchise:"Rugrats",          upc:"194735337170", retail:5.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Airwolf Helicopter",          franchise:"Airwolf",          upc:"194735262946", retail:7.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"'66 Porsche 906 Carrera 6",   franchise:"TBD",              upc:"194735337316", retail:7.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"H.I.S.S. Tank",              franchise:"G.I. Joe",         upc:"194735337194", retail:7.99, chase:true  },
  { mix:"Mix 3", code:"956Q", name:"Custom GMC Panel Van",        franchise:"TBD",              upc:"194735337255", retail:6.99, chase:false },
  { mix:"Mix 3", code:"956Q", name:"Spider-Mobile",               franchise:"Marvel Spider-Man",upc:"194735337187", retail:6.99, chase:false },
];

function getTimeSlot() {
  const h = new Date().getHours();
  if (h < 12) return { label:"🌅 Apertura", next:"12:00" };
  if (h < 18) return { label:"🌇 Atardecer", next:"18:00" };
  return { label:"🌙 Cierre", next:"24:00" };
}

function premiumClass(pct) {
  if (pct <= 0) return "none";
  if (pct < 30) return "low";
  if (pct < 100) return "med";
  return "high";
}

async function fetchPricesForBatch(batch) {
  const list = batch.map((c,i) => `${i+1}. "${c.name}" Hot Wheels Pop Culture 2026`).join("\n");
  const prompt = `Search eBay sold listings for these Hot Wheels Pop Culture 2026 cars and return ONLY a JSON array, no markdown, no explanation:
${list}

For each item return: { "name": "...", "market_usd": number_or_null, "samples": number, "trend": "up"|"down"|"flat" }
Use the median of recent sold prices. If no data found use null.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("["), end = clean.lastIndexOf("]");
  if (start === -1) return [];
  return JSON.parse(clean.slice(start, end + 1));
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0a0a0f; }
  .root { background:#0a0a0f; color:#e8e8f0; font-family:'DM Sans',sans-serif; min-height:100vh; padding:28px 16px; }
  h1 { font-family:'Bebas Neue',sans-serif; font-size:34px; letter-spacing:2px; line-height:1; }
  h1 span { color:#ff4500; }
  .sub { font-size:11px; color:#5a5a7a; margin-top:4px; font-family:'DM Mono',monospace; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:20px; }
  .badges { display:flex; gap:6px; flex-wrap:wrap; }
  .badge { font-size:10px; font-weight:600; padding:3px 9px; border-radius:4px; letter-spacing:1px; text-transform:uppercase; font-family:'DM Mono',monospace; background:#1a1a24; border:1px solid #2a2a3a; color:#5a5a7a; }
  .badge.live { background:#0a2000; border-color:#1a4000; color:#69f0ae; }
  .badge.slot { background:#0a1a2a; border-color:#1a3a5a; color:#64b5f6; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:16px; }
  .stat { background:#111118; border:1px solid #2a2a3a; border-radius:10px; padding:12px; border-left:3px solid #ff4500; }
  .stat.g { border-left-color:#00e676; } .stat.y { border-left-color:#ffd600; }
  .stat-l { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#5a5a7a; margin-bottom:4px; }
  .stat-v { font-family:'Bebas Neue',sans-serif; font-size:22px; }
  .stat-s { font-size:10px; color:#5a5a7a; font-family:'DM Mono',monospace; }
  .controls { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
  .fbtn { padding:5px 13px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; background:#1a1a24; border:1px solid #2a2a3a; color:#5a5a7a; font-family:'DM Sans',sans-serif; transition:all .15s; }
  .fbtn.active, .fbtn:hover { background:#1a2a1a; border-color:#2a5a2a; color:#00e676; }
  .rbtn { padding:5px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; background:#1a0a00; border:1px solid #ff4500; color:#ff4500; font-family:'DM Sans',sans-serif; margin-left:auto; transition:all .15s; }
  .rbtn:hover:not(:disabled) { background:#2a1200; }
  .rbtn:disabled { opacity:.4; cursor:not-allowed; }
  .tbl-wrap { background:#111118; border:1px solid #2a2a3a; border-radius:12px; overflow:hidden; }
  .tbl-top { padding:10px 16px; background:#1a1a24; border-bottom:1px solid #2a2a3a; display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#5a5a7a; letter-spacing:1px; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; }
  thead th { padding:9px 12px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; color:#5a5a7a; font-family:'DM Mono',monospace; background:#0d0d14; white-space:nowrap; }
  thead th:not(:first-child) { text-align:right; }
  tbody tr { border-top:1px solid #2a2a3a; transition:background .15s; }
  tbody tr:hover { background:#1a1a24; }
  td { padding:12px; vertical-align:middle; }
  td:not(:first-child) { text-align:right; }
  .car-name { font-weight:600; font-size:13px; }
  .car-meta { font-size:11px; color:#5a5a7a; margin-top:2px; font-family:'DM Mono',monospace; }
  .car-upc { font-size:10px; color:#3a3a5a; font-family:'DM Mono',monospace; }
  .chase { background:linear-gradient(135deg,#ff8c00,#ff4500); color:#fff; font-size:9px; font-weight:700; padding:2px 5px; border-radius:3px; margin-left:5px; vertical-align:middle; }
  .retail { font-family:'DM Mono',monospace; font-size:12px; color:#5a5a7a; line-height:1.6; }
  .mkt-usd { font-family:'DM Mono',monospace; font-size:14px; font-weight:500; }
  .samples { font-size:10px; color:#5a5a7a; font-family:'DM Mono',monospace; margin-top:2px; }
  .soles { font-family:'DM Mono',monospace; font-size:13px; font-weight:600; color:#f0c060; }
  .prem { font-size:11px; font-family:'DM Mono',monospace; padding:2px 6px; border-radius:4px; display:inline-block; }
  .prem.high { background:#0d2a0d; color:#00e676; border:1px solid #1a5a1a; }
  .prem.med  { background:#2a1a00; color:#ff8c00; border:1px solid #5a3800; }
  .prem.low  { background:#1a0a0a; color:#ff6060; border:1px solid #4a1a1a; }
  .prem.none { background:#111118; color:#5a5a7a; border:1px solid #2a2a3a; }
  .trend-up   { color:#00e676; font-size:12px; font-weight:700; }
  .trend-down { color:#ff1744; font-size:12px; font-weight:700; }
  .trend-flat { color:#5a5a7a; font-size:12px; }
  .no-data { color:#3a3a5a; font-size:12px; font-family:'DM Mono',monospace; }
  .loading-row td { text-align:center!important; padding:28px; }
  .spinner { display:inline-block; width:18px; height:18px; border:2px solid #2a2a3a; border-top-color:#ff4500; border-radius:50%; animation:spin .7s linear infinite; margin-right:8px; vertical-align:middle; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .progress { font-size:11px; color:#5a5a7a; font-family:'DM Mono',monospace; margin-left:4px; }
  .footer { margin-top:12px; font-size:10px; color:#3a3a5a; font-family:'DM Mono',monospace; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; }
  .error-banner { background:#1a0000; border:1px solid #4a0000; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:12px; color:#ff6060; font-family:'DM Mono',monospace; }
  @media(max-width:680px) { .stats{grid-template-columns:repeat(2,1fr)} thead th:nth-child(4),td:nth-child(4){display:none} }
`;

export default function App() {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const slot = getTimeSlot();

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null); setProgress("Buscando precios en eBay...");
    try {
      const mid = Math.ceil(CARS.length / 2);
      const [b1, b2] = [CARS.slice(0, mid), CARS.slice(mid)];
      setProgress(`Consultando lote 1/${2}...`);
      const r1 = await fetchPricesForBatch(b1);
      setProgress(`Consultando lote 2/${2}...`);
      const r2 = await fetchPricesForBatch(b2);
      const all = [...r1, ...r2];
      const map = {};
      CARS.forEach((car, i) => {
        const hit = all.find(r => r?.name && car.name.toLowerCase().includes(r.name.toLowerCase().slice(0,10)));
        map[car.upc] = hit || { market_usd: null, samples: 0, trend: "flat" };
      });
      setPrices(map);
      setLastUpdated(new Date());
    } catch(e) {
      setError("Error al obtener precios: " + e.message);
    } finally {
      setLoading(false); setProgress("");
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const mixes = [...new Set(CARS.map(c => c.mix))];
  const visible = filter === "all" ? CARS : CARS.filter(c => c.mix === filter);

  const withData = CARS.filter(c => prices[c.upc]?.market_usd > 0);
  const avg = withData.length ? withData.reduce((s,c) => s + prices[c.upc].market_usd, 0) / withData.length : 0;
  const trendUp = CARS.filter(c => prices[c.upc]?.trend === "up").length;
  const trendDown = CARS.filter(c => prices[c.upc]?.trend === "down").length;

  return (
    <>
      <style>{css}</style>
      <div className="root">
        <div className="header">
          <div>
            <h1>HOT WHEELS <span>POP CULTURE 2026</span></h1>
            <div className="sub">Market Price Tracker · Ruma Store · TC: S/ {TC.toFixed(2)} por USD</div>
          </div>
          <div className="badges">
            <span className="badge live">● AI Prices</span>
            <span className="badge slot">{slot.label}</span>
            <span className="badge">Fuente: eBay Sold</span>
          </div>
        </div>

        {error && <div className="error-banner">⚠ {error} — Intenta refrescar.</div>}

        <div className="stats">
          <div className="stat">
            <div className="stat-l">Promedio mercado</div>
            <div className="stat-v">{avg > 0 ? `$ ${avg.toFixed(2)}` : "—"}</div>
            <div className="stat-s">{avg > 0 ? `S/ ${(avg*TC).toFixed(2)} / unidad` : "cargando..."}</div>
          </div>
          <div className="stat g">
            <div className="stat-l">Con tendencia ▲</div>
            <div className="stat-v">{trendUp} modelos</div>
            <div className="stat-s">subiendo en mercado</div>
          </div>
          <div className="stat y">
            <div className="stat-l">Con tendencia ▼</div>
            <div className="stat-v">{trendDown} modelos</div>
            <div className="stat-s">bajando en mercado</div>
          </div>
          <div className="stat">
            <div className="stat-l">Mixes activos</div>
            <div className="stat-v">{mixes.length}</div>
            <div className="stat-s">totales 2026</div>
          </div>
        </div>

        <div className="controls">
          <button className={`fbtn${filter==="all"?" active":""}`} onClick={()=>setFilter("all")}>Todos</button>
          {mixes.map(m => (
            <button key={m} className={`fbtn${filter===m?" active":""}`} onClick={()=>setFilter(m)}>{m}</button>
          ))}
          <button className="rbtn" onClick={fetchAll} disabled={loading}>
            {loading ? <><span className="spinner"/>Actualizando...</> : "⟳ Refresh"}
          </button>
        </div>

        <div className="tbl-wrap">
          <div className="tbl-top">
            <span>● {loading ? <>{progress}</> : `Actualizado: ${lastUpdated ? lastUpdated.toLocaleTimeString("es-PE") : "—"}`}</span>
            <span>TC: S/ {TC} x USD</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Modelo / Franquicia</th>
                <th>Retail USD</th>
                <th>Mercado USD</th>
                <th>Mercado S/</th>
                <th>Premium</th>
                <th>Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {loading && Object.keys(prices).length === 0 ? (
                <tr className="loading-row">
                  <td colSpan={6}><span className="spinner"/>Buscando precios en eBay… <span className="progress">{progress}</span></td>
                </tr>
              ) : visible.map(car => {
                const p = prices[car.upc];
                const mkt = p?.market_usd || 0;
                const soles = mkt * TC;
                const pct = mkt > 0 ? Math.round(((mkt - car.retail) / car.retail) * 100) : 0;
                const pc = premiumClass(pct);
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
                      <span className="retail">$ {car.retail.toFixed(2)}<br/><small>S/ {(car.retail*TC).toFixed(2)}</small></span>
                    </td>
                    <td>
                      {mkt > 0
                        ? <><span className="mkt-usd">$ {mkt.toFixed(2)}</span><div className="samples">{p?.samples || 0} ventas</div></>
                        : <span className="no-data">{loading ? "…" : "sin datos"}</span>}
                    </td>
                    <td>
                      {mkt > 0 ? <span className="soles">S/ {soles.toFixed(2)}</span> : <span className="no-data">—</span>}
                    </td>
                    <td>
                      {mkt > 0
                        ? <span className={`prem ${pc}`}>{pct >= 0 ? "+" : ""}{pct}%</span>
                        : <span className="prem none">—</span>}
                    </td>
                    <td>
                      {p?.trend === "up"   && <span className="trend-up">▲ UP</span>}
                      {p?.trend === "down" && <span className="trend-down">▼ DOWN</span>}
                      {(!p || p.trend === "flat") && <span className="trend-flat">— —</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="footer">
          <span>Precios vía búsqueda web · mediana eBay sold · New/Sealed · próxima ventana: {slot.next}</span>
          <span>Ruma Store Intelligence · rumastore.shop</span>
        </div>
      </div>
    </>
  );
}
