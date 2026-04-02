import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORIAS = [
  { id: "alimentacion",    label: "Alimentación",    icon: "🍽️", color: "#F59E0B" },
  { id: "transporte",      label: "Transporte",      icon: "🚗", color: "#3B82F6" },
  { id: "vivienda",        label: "Vivienda",        icon: "🏠", color: "#8B5CF6" },
  { id: "salud",           label: "Salud",           icon: "💊", color: "#EF4444" },
  { id: "entretenimiento", label: "Entretenimiento", icon: "🎬", color: "#EC4899" },
  { id: "ropa",            label: "Ropa",            icon: "👗", color: "#14B8A6" },
  { id: "educacion",       label: "Educación",       icon: "📚", color: "#F97316" },
  { id: "servicios",       label: "Servicios",       icon: "💡", color: "#6366F1" },
  { id: "otros",           label: "Otros",           icon: "📦", color: "#64748B" },
];

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const SAMPLE_DATA = [
  { id: 1, descripcion: "Almuerzo",      categoria: "alimentacion",    monto: 25,  fecha: "2026-03-28", nota: "", fuente: "manual" },
  { id: 2, descripcion: "Taxi",          categoria: "transporte",      monto: 15,  fecha: "2026-03-27", nota: "", fuente: "manual" },
  { id: 3, descripcion: "Netflix",       categoria: "entretenimiento", monto: 45,  fecha: "2026-03-25", nota: "", fuente: "manual" },
  { id: 4, descripcion: "Luz",           categoria: "servicios",       monto: 120, fecha: "2026-03-20", nota: "", fuente: "manual" },
  { id: 5, descripcion: "Supermercado",  categoria: "alimentacion",    monto: 180, fecha: "2026-03-18", nota: "", fuente: "manual" },
  { id: 6, descripcion: "Gasolina",      categoria: "transporte",      monto: 60,  fecha: "2026-03-15", nota: "", fuente: "manual" },
  { id: 7, descripcion: "Gym",           categoria: "salud",           monto: 80,  fecha: "2026-03-10", nota: "", fuente: "manual" },
  { id: 8, descripcion: "Ropa nueva",    categoria: "ropa",            monto: 150, fecha: "2026-02-28", nota: "", fuente: "manual" },
  { id: 9, descripcion: "Curso online",  categoria: "educacion",       monto: 200, fecha: "2026-02-20", nota: "", fuente: "manual" },
  { id:10, descripcion: "Cena rest.",    categoria: "alimentacion",    monto: 90,  fecha: "2026-02-14", nota: "", fuente: "manual" },
  { id:11, descripcion: "Alquiler",      categoria: "vivienda",        monto: 800, fecha: "2026-02-01", nota: "", fuente: "manual" },
  { id:12, descripcion: "Alquiler",      categoria: "vivienda",        monto: 800, fecha: "2026-03-01", nota: "", fuente: "manual" },
];

const LS_URL_KEY  = "fintrack_sheets_url";
const LS_DATA_KEY = "fintrack_manual_data";

function formatMoney(n) {
  return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}
function getToday() {
  return new Date().toISOString().split("T")[0];
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:8, padding:"8px 14px" }}>
        <p style={{ color:"#94A3B8", fontSize:12, margin:0 }}>{payload[0].name || payload[0].dataKey}</p>
        <p style={{ color:"#F1F5F9", fontSize:14, fontWeight:700, margin:"2px 0 0" }}>{formatMoney(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

function parsearCSV(texto) {
  const lineas = texto.trim().split("\n").slice(1);
  const resultado = [];
  lineas.forEach((linea, i) => {
    const cols = linea.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const [fecha, descripcion, categoria, monto, nota] = cols;
    if (!fecha || !monto) return;
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum)) return;
    resultado.push({
      id: `sheet_${i}_${Date.now()}`,
      fecha: fecha.trim(),
      descripcion: descripcion?.trim() || "Sin descripción",
      categoria: categoria?.trim() || "otros",
      monto: montoNum,
      nota: nota?.trim() || "",
      fuente: "sheets",
    });
  });
  return resultado;
}

export default function App() {
  const [view,           setView]           = useState("dashboard");
  const [manualData,     setManualData]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_DATA_KEY)) || SAMPLE_DATA; } catch { return SAMPLE_DATA; }
  });
  const [sheetsData,     setSheetsData]     = useState([]);
  const [sheetsUrl,      setSheetsUrl]      = useState(() => localStorage.getItem(LS_URL_KEY) || "");
  const [sheetsUrlInput, setSheetsUrlInput] = useState(() => localStorage.getItem(LS_URL_KEY) || "");
  const [syncStatus,     setSyncStatus]     = useState("idle");
  const [syncMsg,        setSyncMsg]        = useState("");
  const [lastSync,       setLastSync]       = useState(null);
  const [form,           setForm]           = useState({ descripcion:"", categoria:"alimentacion", monto:"", fecha:getToday(), nota:"" });
  const [filtroMes,      setFiltroMes]      = useState("all");
  const [filtroCat,      setFiltroCat]      = useState("all");
  const [editId,         setEditId]         = useState(null);
  const [toast,          setToast]          = useState(null);
  const [showConfig,     setShowConfig]     = useState(false);

  useEffect(() => {
    try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(manualData)); } catch {}
  }, [manualData]);

  const gastos = useMemo(() =>
    [...manualData, ...sheetsData].sort((a,b) => b.fecha.localeCompare(a.fecha)),
    [manualData, sheetsData]);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sincronizar = async (url) => {
    const target = url || sheetsUrl;
    if (!target) { showToast("Primero pega la URL de tu Google Sheet", "error"); return; }
    setSyncStatus("loading");
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
      const res = await fetch(proxy);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const texto = await res.text();
      if (!texto.includes(",")) throw new Error("El archivo no parece un CSV válido");
      const datos = parsearCSV(texto);
      if (datos.length === 0) throw new Error("No se encontraron gastos. Verifica el formato del Sheet.");
      setSheetsData(datos);
      setSyncStatus("ok");
      setLastSync(new Date());
      setSyncMsg(`${datos.length} gastos cargados`);
      showToast(`✅ ${datos.length} gastos sincronizados desde Sheets`);
      setShowConfig(false);
    } catch (err) {
      setSyncStatus("error");
      setSyncMsg(err.message);
      showToast(`Error: ${err.message}`, "error");
    }
  };

  const guardarUrl = () => {
    const url = sheetsUrlInput.trim();
    if (!url.includes("docs.google.com")) { showToast("La URL no parece ser de Google Sheets", "error"); return; }
    setSheetsUrl(url);
    localStorage.setItem(LS_URL_KEY, url);
    sincronizar(url);
  };

  const desconectar = () => {
    setSheetsUrl(""); setSheetsUrlInput(""); setSheetsData([]);
    setSyncStatus("idle"); setSyncMsg(""); setLastSync(null);
    localStorage.removeItem(LS_URL_KEY);
    showToast("Google Sheets desconectado");
  };

  const gastosFiltrados = useMemo(() => gastos.filter(g => {
    const mes = new Date(g.fecha + "T12:00:00").getMonth();
    return (filtroMes === "all" || mes === Number(filtroMes)) &&
           (filtroCat === "all" || g.categoria === filtroCat);
  }), [gastos, filtroMes, filtroCat]);

  const totalFiltrado = useMemo(() => gastosFiltrados.reduce((s,g) => s + Number(g.monto), 0), [gastosFiltrados]);

  const gastosMes = useMemo(() =>
    gastos.filter(g => new Date(g.fecha+"T12:00:00").getMonth() === new Date().getMonth()), [gastos]);
  const totalMes = useMemo(() => gastosMes.reduce((s,g) => s + Number(g.monto), 0), [gastosMes]);

  const dataPie = useMemo(() => {
    const map = {};
    gastosFiltrados.forEach(g => { map[g.categoria] = (map[g.categoria]||0) + Number(g.monto); });
    return CATEGORIAS.filter(c => map[c.id]).map(c => ({ name:c.label, value:map[c.id], color:c.color, icon:c.icon }));
  }, [gastosFiltrados]);

  const dataMensual = useMemo(() => {
    const map = {};
    gastos.forEach(g => { const m = new Date(g.fecha+"T12:00:00").getMonth(); map[m]=(map[m]||0)+Number(g.monto); });
    return MESES.map((mes,i) => ({ mes, total:map[i]||0 })).filter(d => d.total > 0);
  }, [gastos]);

  const topCat = dataPie[0];

  const handleSubmit = () => {
    if (!form.descripcion || !form.monto || !form.fecha) { showToast("Completa los campos obligatorios","error"); return; }
    if (editId !== null) {
      setManualData(prev => prev.map(g => g.id===editId ? {...g,...form,monto:Number(form.monto)} : g));
      showToast("Gasto actualizado ✓"); setEditId(null);
    } else {
      setManualData(prev => [...prev, {...form, id:Date.now(), monto:Number(form.monto), fuente:"manual"}]);
      showToast("Gasto registrado ✓");
    }
    setForm({ descripcion:"", categoria:"alimentacion", monto:"", fecha:getToday(), nota:"" });
    setView("dashboard");
  };

  const handleEdit = (g) => {
    if (g.fuente==="sheets") { showToast("Edita este gasto en Google Sheets","error"); return; }
    setForm({ descripcion:g.descripcion, categoria:g.categoria, monto:String(g.monto), fecha:g.fecha, nota:g.nota||"" });
    setEditId(g.id); setView("registro");
  };

  const handleDelete = (g) => {
    if (g.fuente==="sheets") { showToast("Elimina este gasto en Google Sheets","error"); return; }
    setManualData(prev => prev.filter(x => x.id!==g.id));
    showToast("Gasto eliminado","error");
  };

  const getCat = (id) => CATEGORIAS.find(c => c.id===id) || CATEGORIAS[8];

  return (
    <div style={{ minHeight:"100vh", background:"#060D1B", fontFamily:"'DM Sans',sans-serif", color:"#E2E8F0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0F172A}::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
        input,select,textarea{outline:none}
        .nav-btn{background:none;border:none;cursor:pointer;padding:9px 14px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:600;transition:all .2s}
        .nav-btn.active{background:#1E293B;color:#38BDF8}
        .nav-btn:not(.active){color:#64748B}
        .nav-btn:not(.active):hover{color:#94A3B8;background:#0F172A}
        .card{background:#0F172A;border:1px solid #1E293B;border-radius:16px;padding:20px}
        .stat-card{background:linear-gradient(135deg,#0F172A 0%,#162032 100%);border:1px solid #1E293B;border-radius:16px;padding:20px}
        .input-field{width:100%;background:#1E293B;border:1px solid #334155;border-radius:10px;padding:11px 14px;color:#E2E8F0;font-family:inherit;font-size:14px;transition:border .2s}
        .input-field:focus{border-color:#38BDF8}
        .input-field::placeholder{color:#475569}
        .gasto-row{background:#0F172A;border:1px solid #1E293B;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;transition:border .2s}
        .gasto-row:hover{border-color:#334155}
        .btn-primary{background:linear-gradient(135deg,#0EA5E9,#0284C7);border:none;border-radius:10px;padding:12px 24px;color:white;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s}
        .btn-primary:hover{opacity:.88}
        .btn-ghost{background:#1E293B;border:1px solid #334155;border-radius:10px;padding:10px 20px;color:#94A3B8;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
        .btn-ghost:hover{background:#263549;color:#E2E8F0}
        .btn-green{background:linear-gradient(135deg,#059669,#047857);border:none;border-radius:10px;padding:12px 20px;color:white;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;justify-content:center;transition:opacity .2s}
        .btn-green:hover{opacity:.88}
        .btn-red{background:#1E293B;border:1px solid #EF4444;border-radius:10px;padding:10px 16px;color:#EF4444;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
        .select-field{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
        .toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:999;animation:slideIn .3s ease;max-width:300px}
        @keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
        .fab{position:fixed;bottom:28px;right:24px;width:54px;height:54px;background:linear-gradient(135deg,#0EA5E9,#0284C7);border:none;border-radius:16px;color:white;font-size:24px;cursor:pointer;box-shadow:0 8px 24px rgba(14,165,233,.35);display:flex;align-items:center;justify-content:center;transition:transform .2s;z-index:100}
        .fab:hover{transform:scale(1.07)}
        .filter-pill{background:#1E293B;border:1px solid #334155;border-radius:8px;padding:7px 13px;color:#94A3B8;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:flex-end;justify-content:center}
        .modal{background:#0A1628;border:1px solid #1E293B;border-top:1px solid #334155;border-radius:20px 20px 0 0;padding:24px 20px 40px;width:100%;max-width:680px;animation:slideUp .3s ease}
        @keyframes slideUp{from{transform:translateY(80px);opacity:0}to{transform:translateY(0);opacity:1}}
        .pulse{animation:pulse 1.2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .badge{display:inline-flex;align-items:center;gap:3px;background:#064E3B;border:1px solid #10B981;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;color:#6EE7B7;white-space:nowrap}
      `}</style>

      {toast && (
        <div className="toast" style={{ background:toast.type==="error"?"#991B1B":"#064E3B", color:toast.type==="error"?"#FCA5A5":"#6EE7B7", border:`1px solid ${toast.type==="error"?"#EF4444":"#10B981"}` }}>
          {toast.msg}
        </div>
      )}

      {/* Modal config Sheets */}
      {showConfig && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setShowConfig(false); }}>
          <div className="modal">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:22 }}>📊</span>
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, color:"#F1F5F9" }}>Conectar Google Sheets</p>
              </div>
              <button onClick={() => setShowConfig(false)} style={{ background:"none", border:"none", color:"#64748B", cursor:"pointer", fontSize:20, lineHeight:1 }}>✕</button>
            </div>

            <div style={{ background:"#0D2137", border:"1px solid #1E3A5F", borderRadius:12, padding:14, marginBottom:16 }}>
              <p style={{ fontSize:12, color:"#38BDF8", fontWeight:700, marginBottom:8 }}>📋 Cómo obtener la URL:</p>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  "1. Abre tu Google Sheet con la hoja 'Gastos'",
                  "2. Archivo → Compartir → Publicar en la web",
                  "3. Selecciona hoja 'Gastos' → formato CSV",
                  "4. Clic en Publicar → copia la URL"
                ].map((s,i) => (
                  <p key={i} style={{ fontSize:12, color:"#94A3B8" }}>{s}</p>
                ))}
              </div>
            </div>

            <label style={{ fontSize:11, color:"#64748B", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, display:"block", marginBottom:8 }}>URL pública CSV del Sheet</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="https://docs.google.com/spreadsheets/d/XXXXX/pub?gid=0&single=true&output=csv"
              value={sheetsUrlInput}
              onChange={e => setSheetsUrlInput(e.target.value)}
              style={{ resize:"none", fontSize:12, fontFamily:"monospace" }}
            />

            {syncStatus==="error" && (
              <div style={{ background:"#2D1515", border:"1px solid #EF4444", borderRadius:10, padding:"10px 14px", marginTop:12 }}>
                <p style={{ fontSize:12, color:"#FCA5A5" }}>⚠️ {syncMsg}</p>
              </div>
            )}

            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              {sheetsUrl && <button className="btn-red" onClick={desconectar}>Desconectar</button>}
              <button className="btn-green" style={{ flex:1 }} onClick={guardarUrl} disabled={syncStatus==="loading"}>
                {syncStatus==="loading"
                  ? <><span className="pulse">⏳</span> Conectando...</>
                  : <><span>🔗</span> Conectar y sincronizar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:"#0A1628", borderBottom:"1px solid #1E293B", padding:"0 20px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:680, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, background:"linear-gradient(135deg,#0EA5E9,#7C3AED)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💰</div>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:16, color:"#F1F5F9" }}>FinTrack</span>
            {syncStatus==="ok" && <span className="badge">● Sheets</span>}
          </div>
          <nav style={{ display:"flex", gap:2 }}>
            <button className={`nav-btn ${view==="dashboard"?"active":""}`} onClick={() => setView("dashboard")}>Dashboard</button>
            <button className={`nav-btn ${view==="historial"?"active":""}`} onClick={() => setView("historial")}>Historial</button>
            <button className="nav-btn" onClick={() => setShowConfig(true)}
              style={{ color: syncStatus==="ok"?"#10B981":syncStatus==="error"?"#EF4444":"#64748B", fontSize:16 }}
              title="Conectar Google Sheets">
              {syncStatus==="loading" ? <span className="pulse">⏳</span> : "📊"}
            </button>
            <button className={`nav-btn ${view==="registro"?"active":""}`}
              onClick={() => { setEditId(null); setForm({ descripcion:"", categoria:"alimentacion", monto:"", fecha:getToday(), nota:"" }); setView("registro"); }}>
              + Nuevo
            </button>
          </nav>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 20px 80px" }}>

        {/* ===== DASHBOARD ===== */}
        {view==="dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {syncStatus==="ok" ? (
              <div style={{ background:"#022C22", border:"1px solid #065F46", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>📊</span>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:"#6EE7B7" }}>Google Sheets conectado</p>
                    <p style={{ fontSize:11, color:"#047857" }}>
                      {sheetsData.length} gastos sincronizados
                      {lastSync && ` · ${lastSync.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => sincronizar()} style={{ background:"none", border:"1px solid #065F46", borderRadius:8, padding:"6px 12px", color:"#6EE7B7", font:"inherit", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  🔄 Sync
                </button>
              </div>
            ) : (
              <div style={{ background:"#0F172A", border:"1px dashed #334155", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}
                onClick={() => setShowConfig(true)}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>📊</span>
                  <p style={{ fontSize:13, color:"#64748B" }}>Conecta tu Google Sheet para sincronizar</p>
                </div>
                <span style={{ color:"#38BDF8", fontSize:13, fontWeight:700, flexShrink:0 }}>Conectar →</span>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div className="stat-card" style={{ gridColumn:"1/-1" }}>
                <p style={{ fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1.2, marginBottom:6 }}>Total este mes</p>
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:34, fontWeight:700, color:"#F1F5F9", letterSpacing:"-1px" }}>{formatMoney(totalMes)}</p>
                <p style={{ fontSize:12, color:"#475569", marginTop:4 }}>
                  {gastosMes.length} transacciones
                  {sheetsData.filter(g => new Date(g.fecha+"T12:00:00").getMonth()===new Date().getMonth()).length > 0 && (
                    <span style={{ color:"#6EE7B7", marginLeft:8 }}>
                      ({sheetsData.filter(g => new Date(g.fecha+"T12:00:00").getMonth()===new Date().getMonth()).length} de Sheets)
                    </span>
                  )}
                </p>
              </div>
              <div className="stat-card">
                <p style={{ fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Mayor categoría</p>
                <p style={{ fontSize:20, marginBottom:2 }}>{topCat?.icon||"—"}</p>
                <p style={{ fontSize:14, fontWeight:700, color:"#E2E8F0" }}>{topCat?.name||"—"}</p>
                <p style={{ fontSize:13, color:"#38BDF8", fontWeight:600 }}>{topCat?formatMoney(topCat.value):""}</p>
              </div>
              <div className="stat-card">
                <p style={{ fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Promedio diario</p>
                <p style={{ fontSize:14, fontWeight:700, color:"#E2E8F0", marginTop:6 }}>
                  {formatMoney(totalMes / Math.max(1, new Date().getDate()))}
                </p>
                <p style={{ fontSize:12, color:"#475569", marginTop:2 }}>por día este mes</p>
              </div>
            </div>

            {/* Gráfica mensual */}
            <div className="card">
              <p style={{ fontSize:13, fontWeight:700, color:"#94A3B8", marginBottom:16, textTransform:"uppercase", letterSpacing:.8 }}>Gasto por mes</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dataMensual} barSize={28}>
                  <XAxis dataKey="mes" tick={{ fill:"#475569", fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:"#1E293B" }} />
                  <Bar dataKey="total" radius={[6,6,0,0]}>
                    {dataMensual.map((_,i) => <Cell key={i} fill={i===dataMensual.length-1?"#0EA5E9":"#1E3A5F"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribución */}
            {dataPie.length > 0 && (
              <div className="card">
                <p style={{ fontSize:13, fontWeight:700, color:"#94A3B8", marginBottom:16, textTransform:"uppercase", letterSpacing:.8 }}>Distribución</p>
                <div style={{ display:"flex", alignItems:"center", gap:20 }}>
                  <PieChart width={130} height={130}>
                    <Pie data={dataPie} cx={60} cy={60} innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                      {dataPie.map((e,i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                    {dataPie.slice(0,5).map((d,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:d.color }} />
                          <span style={{ fontSize:13, color:"#94A3B8" }}>{d.icon} {d.name}</span>
                        </div>
                        <span style={{ fontSize:13, fontWeight:700, color:"#E2E8F0" }}>{formatMoney(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recientes */}
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.8 }}>Recientes</p>
                <button onClick={() => setView("historial")} style={{ background:"none", border:"none", color:"#38BDF8", fontSize:12, fontWeight:600, cursor:"pointer" }}>Ver todos →</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {gastos.slice(0,5).map(g => {
                  const cat = getCat(g.categoria);
                  return (
                    <div key={g.id} className="gasto-row">
                      <div style={{ width:38, height:38, background:cat.color+"20", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{cat.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <p style={{ fontSize:14, fontWeight:600, color:"#E2E8F0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.descripcion}</p>
                          {g.fuente==="sheets" && <span className="badge">Sheets</span>}
                        </div>
                        <p style={{ fontSize:11, color:"#475569", marginTop:1 }}>{cat.label} · {g.fecha}</p>
                      </div>
                      <p style={{ fontSize:15, fontWeight:700, color:"#F1F5F9", flexShrink:0 }}>{formatMoney(g.monto)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== HISTORIAL ===== */}
        {view==="historial" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700, color:"#F1F5F9" }}>Historial</p>
              <p style={{ fontSize:13, color:"#38BDF8", fontWeight:700 }}>{formatMoney(totalFiltrado)}</p>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <select className="filter-pill select-field" style={{ paddingRight:28 }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                <option value="all">Todos los meses</option>
                {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select className="filter-pill select-field" style={{ paddingRight:28 }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
                <option value="all">Todas</option>
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {gastosFiltrados.length===0 && (
                <div style={{ textAlign:"center", padding:"40px 0", color:"#475569" }}>
                  <p style={{ fontSize:32, marginBottom:8 }}>🔍</p>
                  <p>Sin resultados para este filtro</p>
                </div>
              )}
              {gastosFiltrados.map(g => {
                const cat = getCat(g.categoria);
                return (
                  <div key={g.id} className="gasto-row">
                    <div style={{ width:38, height:38, background:cat.color+"20", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{cat.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <p style={{ fontSize:14, fontWeight:600, color:"#E2E8F0" }}>{g.descripcion}</p>
                        {g.fuente==="sheets" && <span className="badge">Sheets</span>}
                      </div>
                      <p style={{ fontSize:11, color:"#475569", marginTop:1 }}>{cat.label} · {g.fecha}</p>
                      {g.nota && <p style={{ fontSize:11, color:"#334155", marginTop:2, fontStyle:"italic" }}>{g.nota}</p>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                      <p style={{ fontSize:15, fontWeight:700, color:"#F1F5F9" }}>{formatMoney(g.monto)}</p>
                      {g.fuente!=="sheets" && (
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={() => handleEdit(g)} style={{ background:"none", border:"none", color:"#38BDF8", cursor:"pointer", fontSize:14 }}>✏️</button>
                          <button onClick={() => handleDelete(g)} style={{ background:"none", border:"none", color:"#EF4444", cursor:"pointer", fontSize:14 }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== REGISTRO ===== */}
        {view==="registro" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700, color:"#F1F5F9" }}>
              {editId ? "Editar gasto" : "Nuevo gasto"}
            </p>
            <div className="card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label style={{ fontSize:12, color:"#64748B", fontWeight:600, letterSpacing:.5, textTransform:"uppercase", display:"block", marginBottom:10 }}>Categoría</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {CATEGORIAS.map(c => (
                    <button key={c.id} onClick={() => setForm(f => ({...f, categoria:c.id}))}
                      style={{ background:form.categoria===c.id?c.color+"25":"#1E293B", border:`1.5px solid ${form.categoria===c.id?c.color:"#334155"}`, borderRadius:10, padding:"7px 12px", color:form.categoria===c.id?c.color:"#64748B", font:"inherit", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all .15s" }}>
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748B", fontWeight:600, letterSpacing:.5, textTransform:"uppercase", display:"block", marginBottom:8 }}>Descripción *</label>
                <input className="input-field" placeholder="¿En qué gastaste?" value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion:e.target.value}))} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:"#64748B", fontWeight:600, letterSpacing:.5, textTransform:"uppercase", display:"block", marginBottom:8 }}>Monto (S/) *</label>
                  <input className="input-field" type="number" min="0" placeholder="0.00" value={form.monto} onChange={e => setForm(f => ({...f, monto:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#64748B", fontWeight:600, letterSpacing:.5, textTransform:"uppercase", display:"block", marginBottom:8 }}>Fecha *</label>
                  <input className="input-field" type="date" value={form.fecha} onChange={e => setForm(f => ({...f, fecha:e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748B", fontWeight:600, letterSpacing:.5, textTransform:"uppercase", display:"block", marginBottom:8 }}>Nota (opcional)</label>
                <textarea className="input-field" rows={2} placeholder="Comentario adicional..." value={form.nota} onChange={e => setForm(f => ({...f, nota:e.target.value}))} style={{ resize:"none" }} />
              </div>
              {form.monto && (
                <div style={{ background:"#162032", border:"1px solid #1E3A5F", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>{getCat(form.categoria).icon}</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:600, color:"#E2E8F0" }}>{form.descripcion||"Sin descripción"}</p>
                      <p style={{ fontSize:11, color:"#475569" }}>{getCat(form.categoria).label}</p>
                    </div>
                  </div>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700, color:"#38BDF8" }}>{formatMoney(form.monto)}</p>
                </div>
              )}
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button className="btn-ghost" onClick={() => setView("dashboard")}>Cancelar</button>
                <button className="btn-primary" style={{ flex:1 }} onClick={handleSubmit}>
                  {editId ? "Guardar cambios" : "Registrar gasto"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {view!=="registro" && (
        <button className="fab" onClick={() => { setEditId(null); setForm({ descripcion:"", categoria:"alimentacion", monto:"", fecha:getToday(), nota:"" }); setView("registro"); }}>+</button>
      )}
    </div>
  );
}

