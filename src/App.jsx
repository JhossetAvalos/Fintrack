import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Categorías ────────────────────────────────────────────────────────────────
const CATS_GASTO = [
  { id:"alimentacion",    label:"Alimentación",    icon:"🍽️", color:"#F59E0B" },
  { id:"transporte",      label:"Transporte",      icon:"🚗", color:"#3B82F6" },
  { id:"vivienda",        label:"Vivienda",        icon:"🏠", color:"#8B5CF6" },
  { id:"salud",           label:"Salud",           icon:"💊", color:"#EF4444" },
  { id:"entretenimiento", label:"Entretenimiento", icon:"🎬", color:"#EC4899" },
  { id:"ropa",            label:"Ropa",            icon:"👗", color:"#14B8A6" },
  { id:"educacion",       label:"Educación",       icon:"📚", color:"#F97316" },
  { id:"servicios",       label:"Servicios",       icon:"💡", color:"#6366F1" },
  { id:"otros",           label:"Otros",           icon:"📦", color:"#64748B" },
];
const CATS_INGRESO = [
  { id:"sueldo",     label:"Sueldo",      icon:"💼", color:"#10B981" },
  { id:"freelance",  label:"Freelance",   icon:"💻", color:"#06B6D4" },
  { id:"negocio",    label:"Negocio",     icon:"🏪", color:"#84CC16" },
  { id:"inversión",  label:"Inversión",   icon:"📈", color:"#A78BFA" },
  { id:"regalo",     label:"Regalo",      icon:"🎁", color:"#F472B6" },
  { id:"otros_ing",  label:"Otros",       icon:"💰", color:"#94A3B8" },
];
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const LS_URL  = "fintrack_sheets_url";
const LS_DATA = "fintrack_local_data";

const SAMPLE = [];

// ─── Parser gratuito (sin API) ─────────────────────────────────────────────────
const KW_GASTO = {
  alimentacion:    ["comida","almuerzo","desayuno","cena","restaurante","ceviche","pollo","pizza","burger","mercado","supermercado","bodega","pan","café","cafe","delivery","rappi","helado","chifa","pollería","polleria","menú","menu"],
  transporte:      ["taxi","uber","cabify","indriver","bus","combi","metro","pasaje","gasolina","combustible","estacionamiento","peaje","moto","beat","scooter"],
  vivienda:        ["alquiler","renta","agua","luz","gas","internet","cable","wifi","mantenimiento","condominio","plomero","electricista","ferretería","ferreteria"],
  salud:           ["farmacia","medicina","medicamento","pastilla","doctor","médico","medico","clínica","clinica","hospital","análisis","analisis","dentista","gym","gimnasio","vitamina","suplemento","lentes"],
  entretenimiento: ["cine","película","pelicula","netflix","spotify","disney","hbo","amazon","juego","videojuego","concierto","teatro","bar","discoteca","karaoke","bowling","hotel","hostal"],
  ropa:            ["ropa","camisa","pantalón","pantalon","zapatos","zapatillas","polo","vestido","casaca","medias","saga","ripley","oechsle"],
  educacion:       ["curso","clase","libro","universidad","colegio","instituto","taller","seminario","capacitación","capacitacion","udemy","coursera","platzi","inglés","ingles","maestría","maestria"],
  servicios:       ["electricidad","teléfono","telefono","celular","plan","recarga","seguro","banco","comisión","comision","impuesto","sunat","notaría","notaria","abogado"],
};
const KW_INGRESO = {
  sueldo:    ["sueldo","salario","quincena","pago mensual","remuneración","remuneracion"],
  freelance: ["freelance","proyecto","cliente","honorario","consultoría","consultoria","servicio prestado"],
  negocio:   ["venta","negocio","tienda","local","chips","ganancia","utilidad"],
  inversión: ["dividendo","interés","interes","inversión","inversion","acción","accion","fondo"],
  regalo:    ["regalo","propina","bono","gratificación","gratificacion","aguinaldo"],
};
const KW_TIPO_INGRESO = ["recibí","recibi","ingresó","ingreso","cobré","cobre","vendí","vendi","me pagaron","me depositaron","gané","gane","entró","entro"];
const KW_TIPO_GASTO   = ["gasté","gaste","pagué","pague","compré","compre","cuesta","costó","costo","salí a","fui a"];

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function detectarTipo(t) {
  const n = norm(t);
  if (KW_TIPO_INGRESO.some(k => n.includes(norm(k)))) return "ingreso";
  if (KW_TIPO_GASTO.some(k => n.includes(norm(k))))   return "gasto";
  // si no hay keyword, buscar categoría de ingreso
  for (const [, kws] of Object.entries(KW_INGRESO)) {
    if (kws.some(k => n.includes(norm(k)))) return "ingreso";
  }
  return "gasto";
}
function detectarMonto(t) {
  const n = norm(t);
  const pats = [
    /s\/\s*(\d+(?:[.,]\d{1,2})?)/,
    /(\d+(?:[.,]\d{1,2})?)\s*sol(?:es)?/,
    /(\d+(?:[.,]\d{1,2})?)\s*pen\b/,
    /gast[eé]\s+(\d+(?:[.,]\d{1,2})?)/,
    /pagu[eé]\s+(\d+(?:[.,]\d{1,2})?)/,
    /recib[ií]\s+(\d+(?:[.,]\d{1,2})?)/,
    /cobr[eé]\s+(\d+(?:[.,]\d{1,2})?)/,
    /gan[eé]\s+(\d+(?:[.,]\d{1,2})?)/,
    /(\d+(?:[.,]\d{1,2})?)/,
  ];
  for (const p of pats) {
    const m = n.match(p);
    if (m) return parseFloat(m[1].replace(",","."));
  }
  return 0;
}
function detectarCategoria(t, tipo) {
  const n = norm(t);
  const mapa = tipo === "ingreso" ? KW_INGRESO : KW_GASTO;
  for (const [cat, kws] of Object.entries(mapa)) {
    if (kws.some(k => n.includes(norm(k)))) return cat;
  }
  return tipo === "ingreso" ? "otros_ing" : "otros";
}
function detectarFecha(t) {
  const n    = norm(t);
  const hoy  = new Date();
  const fmt  = d => d.toISOString().split("T")[0];
  if (n.includes("ayer"))   { const d=new Date(hoy); d.setDate(hoy.getDate()-1); return fmt(d); }
  if (n.includes("antier")) { const d=new Date(hoy); d.setDate(hoy.getDate()-2); return fmt(d); }
  const dias = {lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6,domingo:0};
  for (const [dia,num] of Object.entries(dias)) {
    if (n.includes(dia)) {
      const d=new Date(hoy); const diff=(hoy.getDay()-num+7)%7||7; d.setDate(hoy.getDate()-diff); return fmt(d);
    }
  }
  const mesesNom = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
  for (const [mes,num] of Object.entries(mesesNom)) {
    const m = n.match(new RegExp(`(\\d{1,2})\\s+de\\s+${mes}`));
    if (m) return fmt(new Date(hoy.getFullYear(), num-1, parseInt(m[1])));
  }
  const mNum = n.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (mNum) return fmt(new Date(hoy.getFullYear(), parseInt(mNum[2])-1, parseInt(mNum[1])));
  return fmt(hoy);
}
function limpiarDesc(t) {
  return t
    .replace(/gasté|pagué|compré|recibí|cobré|gané|vendí|fui a|salí a|me pagaron|me depositaron/gi,"")
    .replace(/\d+([.,]\d{1,2})?\s*(soles?|sol|s\/|pen\b)/gi,"")
    .replace(/\s{2,}/g," ").trim()
    .replace(/^[,.\-enEn]+|[,.\-]+$/g,"").trim()
    || t.trim();
}
function parsearTexto(texto) {
  const tipo       = detectarTipo(texto);
  const monto      = detectarMonto(texto);
  const categoria  = detectarCategoria(texto, tipo);
  const fecha      = detectarFecha(texto);
  const descripcion= limpiarDesc(texto);
  return { tipo, monto, categoria, fecha, descripcion, nota: texto };
}

// ─── Parsear CSV de Google Sheets / Forms ─────────────────────────────────────
// Formato Forms: "Marca de tiempo","Tu gasto o ingreso"
// Formato Sheets manual: fecha,descripcion,categoria,monto,nota
function splitCSVLine(linea) {
  const cols = [];
  let cur = "", inQ = false;
  for (const ch of linea) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parsearFechaTimestamp(ts) {
  // Google Forms Peru: DD/MM/YYYY HH:MM:SS → "2/4/2026 12:51:40" = 2 de abril 2026
  if (!ts) return new Date().toISOString().split("T")[0];
  const m = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const dia = m[1].padStart(2,"0");
    const mes = m[2].padStart(2,"0");
    const anio = m[3];
    return `${anio}-${mes}-${dia}`;
  }
  return new Date().toISOString().split("T")[0];
}

function parsearCSV(texto) {
  const lineas = texto.trim().split("\n");
  if (lineas.length < 2) return [];
  const header = lineas[0].toLowerCase();

  // Detectar si es formato Google Forms (tiene "marca" o "timestamp")
  const esGoogleForms = header.includes("marca") || header.includes("timestamp");

  const resultado = [];
  lineas.slice(1).forEach((linea, i) => {
    if (!linea.trim()) return;
    const cols = splitCSVLine(linea);

    if (esGoogleForms) {
      // col 0 = timestamp ("2/4/2026 12:51:40"), col 1 = texto libre
      const timestamp  = cols[0] || "";
      const textoLibre = cols[1] || "";
      if (!textoLibre.trim()) return;
      const parsed = parsearTexto(textoLibre);
      if (parsed.monto === 0) return;
      const fecha = parsearFechaTimestamp(timestamp) || parsed.fecha;
      resultado.push({ id:`sheet_${i}_${Date.now()}`, ...parsed, fecha, fuente:"sheets" });
    } else {
      // Formato manual: fecha, descripcion, tipo, categoria, monto, nota
      let fecha, descripcion, tipo, categoria, monto, nota;
      if (cols.length >= 6) {
        [fecha, descripcion, tipo, categoria, monto, nota] = cols;
      } else {
        [fecha, descripcion, categoria, monto, nota] = cols;
        tipo = ["sueldo","freelance","negocio","inversión","regalo","otros_ing"].includes(categoria) ? "ingreso" : "gasto";
      }
      const montoNum = parseFloat(monto);
      if (!fecha || isNaN(montoNum)) return;
      resultado.push({
        id: `sheet_${i}_${Date.now()}`,
        tipo: tipo||"gasto", fecha: fecha.trim(),
        descripcion: descripcion?.trim()||"Sin desc",
        categoria: categoria?.trim()||"otros",
        monto: montoNum, nota: nota?.trim()||"", fuente:"sheets",
      });
    }
  });
  return resultado;
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────
const fmt = n => `S/ ${Number(n).toLocaleString("es-PE",{minimumFractionDigits:2})}`;
const hoy = () => new Date().toISOString().split("T")[0];
// Extrae mes 0-11 directo del string "YYYY-MM-DD" sin conversión UTC
const mesDeF = f => { const p = String(f).split("-"); return p.length >= 2 ? parseInt(p[1]) - 1 : new Date().getMonth(); };
const getCat = (tipo, id) => {
  const lista = tipo==="ingreso" ? CATS_INGRESO : CATS_GASTO;
  return lista.find(c=>c.id===id) || (tipo==="ingreso" ? CATS_INGRESO[5] : CATS_GASTO[8]);
};
const Tooltip_ = ({active,payload}) => active&&payload?.length ? (
  <div style={{background:"#0F172A",border:"1px solid #1E293B",borderRadius:8,padding:"8px 14px"}}>
    <p style={{color:"#94A3B8",fontSize:12,margin:0}}>{payload[0].name||payload[0].dataKey}</p>
    <p style={{color:"#F1F5F9",fontSize:14,fontWeight:700,margin:"2px 0 0"}}>{fmt(payload[0].value)}</p>
  </div>
) : null;

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,         setView]         = useState("dashboard");
  const [localData,    setLocalData]    = useState(() => { try { const d = JSON.parse(localStorage.getItem(LS_DATA)); return Array.isArray(d) ? d : []; } catch { return []; } });
  const [sheetsData,   setSheetsData]   = useState([]);
  const [sheetsUrl,    setSheetsUrl]    = useState(() => localStorage.getItem(LS_URL)||"");
  const [urlInput,     setUrlInput]     = useState(() => localStorage.getItem(LS_URL)||"");
  const [syncStatus,   setSyncStatus]   = useState("idle");
  const [syncMsg,      setSyncMsg]      = useState("");
  const [lastSync,     setLastSync]     = useState(null);
  const [showConfig,   setShowConfig]   = useState(false);
  const [ignorados,    setIgnorados]    = useState(() => { try { return JSON.parse(localStorage.getItem("fintrack_ignorados"))||[]; } catch { return []; } });
  const [countdown,    setCountdown]    = useState(300);
  const [toast,        setToast]        = useState(null);
  const [filtroMes,    setFiltroMes]    = useState(String(new Date().getMonth()));
  const [filtroTipo,   setFiltroTipo]   = useState("all");
  const [filtroCat,    setFiltroCat]    = useState("all");
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState({tipo:"gasto",descripcion:"",categoria:"alimentacion",monto:"",fecha:hoy(),nota:""});
  const [textoRapido,  setTextoRapido]  = useState("");
  const [previewParsed,setPreviewParsed]= useState(null);

  useEffect(() => { try { localStorage.setItem(LS_DATA, JSON.stringify(localData)); } catch {} }, [localData]);
  useEffect(() => { try { localStorage.setItem("fintrack_ignorados", JSON.stringify(ignorados)); } catch {} }, [ignorados]);

  const todos = useMemo(() =>
    [...localData,...sheetsData].sort((a,b)=>b.fecha.localeCompare(a.fecha)), [localData,sheetsData]);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // ── Clave única por registro para deduplicar ────────────────
  const claveRegistro = (g) => `${g.fecha}__${String(g.monto)}__${String(g.descripcion).toLowerCase().trim().slice(0,20)}`;

  // ── Sync inteligente ─────────────────────────────────────────
  const sincronizar = async (url, silencioso=false) => {
    const u = url||sheetsUrl;
    if (!u) { showToast("Pega la URL del Sheet","error"); return; }
    if (!silencioso) setSyncStatus("loading");
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      const data = parsearCSV(txt);
      if (!data.length) throw new Error("Sin datos. Verifica que el Sheet tenga filas y el CSV sea público.");

      // Obtener claves de registros ya editados localmente
      const clavesLocales = new Set(
        JSON.parse(localStorage.getItem("fintrack_local_data") || "[]")
          .filter(g => g.fuente === "manual")
          .map(g => claveRegistro(g))
      );
      // Obtener IDs ignorados (editados o eliminados)
      const idsIgnorados = new Set(JSON.parse(localStorage.getItem("fintrack_ignorados") || "[]"));

      // Filtrar: no importar si ya fue editado localmente o ignorado
      const nuevos = data.filter(g => {
        if (idsIgnorados.has(g.id)) return false;
        if (clavesLocales.has(claveRegistro(g))) return false;
        return true;
      });

      setSheetsData(nuevos);
      setSyncStatus("ok");
      setLastSync(new Date());
      const nuevosCount = nuevos.length;
      const totalCount  = data.length;
      const saltados    = totalCount - nuevosCount;
      setSyncMsg(`${nuevosCount} registros${saltados>0?" ("+saltados+" ya editados)":""}`);
      if (!silencioso) showToast(`✅ ${nuevosCount} registros · ${saltados} protegidos`);
      setShowConfig(false);
    } catch(e) {
      setSyncStatus("error");
      setSyncMsg(e.message);
      if (!silencioso) showToast("Error: "+e.message,"error");
    }
  };

  // ── Auto-sync cada 5 minutos ─────────────────────────────────
  useEffect(() => {
    if (!sheetsUrl) return;
    const timer = setInterval(() => sincronizar(sheetsUrl, true), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [sheetsUrl]);

  // ── Countdown visual del auto-sync ─────────────────────────
  useEffect(() => {
    if (!sheetsUrl || syncStatus !== "ok") return;
    setCountdown(300);
    const tick = setInterval(() => setCountdown(c => { if (c <= 1) { setCountdown(300); return 300; } return c - 1; }), 1000);
    return () => clearInterval(tick);
  }, [sheetsUrl, lastSync]);

  const guardarUrl = () => {
    const u = urlInput.trim();
    if (!u.includes("docs.google.com")) { showToast("URL inválida","error"); return; }
    setSheetsUrl(u); localStorage.setItem(LS_URL,u); sincronizar(u);
  };
  const desconectar = () => {
    setSheetsUrl(""); setUrlInput(""); setSheetsData([]);
    setSyncStatus("idle"); setSyncMsg(""); setLastSync(null);
    setIgnorados([]); localStorage.removeItem(LS_URL);
    localStorage.removeItem("fintrack_ignorados");
    showToast("Desconectado");
  };

  // ── Texto rápido ─────────────────────────────────────────────
  const handleTextoRapido = () => {
    if (!textoRapido.trim()) return;
    const p = parsearTexto(textoRapido);
    if (p.monto===0) { showToast("No detecté un monto en el texto","error"); return; }
    setPreviewParsed(p);
  };
  const confirmarTextoRapido = () => {
    if (!previewParsed) return;
    setLocalData(prev=>[...prev,{...previewParsed,id:Date.now(),fuente:"manual"}]);
    showToast("✅ Registrado correctamente");
    setTextoRapido(""); setPreviewParsed(null);
  };

  // ── Filtros ──────────────────────────────────────────────────
  const filtrados = useMemo(() => todos.filter(g => {
    const mes = mesDeF(g.fecha);
    return (filtroMes==="all"||mes===Number(filtroMes)) &&
           (filtroTipo==="all"||g.tipo===filtroTipo) &&
           (filtroCat==="all"||g.categoria===filtroCat);
  }), [todos, filtroMes, filtroTipo, filtroCat]);

  const mesTodos = useMemo(()=>todos.filter(g=>mesDeF(g.fecha)===new Date().getMonth()),[todos]);
  const totalIngresosMes = useMemo(()=>mesTodos.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0),[mesTodos]);
  const totalGastosMes   = useMemo(()=>mesTodos.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0),[mesTodos]);
  const balance          = totalIngresosMes - totalGastosMes;

  const dataPie = useMemo(()=>{
    const gastos = filtrados.filter(g=>g.tipo==="gasto");
    const map = {};
    gastos.forEach(g=>{ map[g.categoria]=(map[g.categoria]||0)+g.monto; });
    return CATS_GASTO.filter(c=>map[c.id]).map(c=>({name:c.label,value:map[c.id],color:c.color,icon:c.icon}));
  },[filtrados]);

  const dataMensual = useMemo(()=>{
    const mapG={}, mapI={};
    todos.forEach(g=>{ const m=mesDeF(g.fecha); if(g.tipo==="gasto") mapG[m]=(mapG[m]||0)+g.monto; else mapI[m]=(mapI[m]||0)+g.monto; });
    return MESES.map((mes,i)=>({mes,gastos:mapG[i]||0,ingresos:mapI[i]||0})).filter(d=>d.gastos>0||d.ingresos>0);
  },[todos]);

  // ── CRUD ─────────────────────────────────────────────────────
  const handleSubmit = () => {
    if(!form.descripcion||!form.monto||!form.fecha){showToast("Completa los campos","error");return;}
    if(editId!==null){
      setLocalData(p=>p.map(g=>g.id===editId?{...g,...form,monto:Number(form.monto)}:g));
      showToast("Actualizado ✓"); setEditId(null);
    } else {
      setLocalData(p=>[...p,{...form,id:Date.now(),monto:Number(form.monto),fuente:"manual"}]);
      showToast("Registrado ✓");
    }
    setForm({tipo:"gasto",descripcion:"",categoria:"alimentacion",monto:"",fecha:hoy(),nota:""});
    setView("dashboard");
  };
  const startEdit = (g)=>{
    if(g.fuente==="sheets"){
      // Marcar ID como ignorado para futuros syncs
      setIgnorados(prev => {
        const nuevos = [...new Set([...prev, g.id])];
        localStorage.setItem("fintrack_ignorados", JSON.stringify(nuevos));
        return nuevos;
      });
      // Copiar a localData para editar
      const copia = {...g, id: Date.now(), fuente:"manual", idSheets: g.id};
      setLocalData(p=>[...p, copia]);
      setSheetsData(p=>p.filter(x=>x.id!==g.id));
      setForm({tipo:copia.tipo,descripcion:copia.descripcion,categoria:copia.categoria,monto:String(copia.monto),fecha:copia.fecha,nota:copia.nota||""});
      setEditId(copia.id);
    } else {
      setForm({tipo:g.tipo,descripcion:g.descripcion,categoria:g.categoria,monto:String(g.monto),fecha:g.fecha,nota:g.nota||""});
      setEditId(g.id);
    }
    setView("registro");
  };
  const del = (g)=>{
    if(g.fuente==="sheets"){
      // Marcar como ignorado para que no vuelva en el sync
      setIgnorados(prev => {
        const nuevos = [...new Set([...prev, g.id])];
        localStorage.setItem("fintrack_ignorados", JSON.stringify(nuevos));
        return nuevos;
      });
      setSheetsData(p=>p.filter(x=>x.id!==g.id));
    } else {
      setLocalData(p=>p.filter(x=>x.id!==g.id));
    }
    showToast("Eliminado","error");
  };

  const catActual = form.tipo==="ingreso"?CATS_INGRESO:CATS_GASTO;

  return (
    <div style={{minHeight:"100vh",background:"#060D1B",fontFamily:"'DM Sans',sans-serif",color:"#E2E8F0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0F172A}::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
        input,select,textarea{outline:none}
        .nb{background:none;border:none;cursor:pointer;padding:9px 13px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:600;transition:all .2s}
        .nb.on{background:#1E293B;color:#38BDF8} .nb:not(.on){color:#64748B} .nb:not(.on):hover{color:#94A3B8;background:#0F172A}
        .card{background:#0F172A;border:1px solid #1E293B;border-radius:16px;padding:20px}
        .scard{background:linear-gradient(135deg,#0F172A,#162032);border:1px solid #1E293B;border-radius:16px;padding:18px}
        .ifield{width:100%;background:#1E293B;border:1px solid #334155;border-radius:10px;padding:11px 14px;color:#E2E8F0;font-family:inherit;font-size:14px;transition:border .2s}
        .ifield:focus{border-color:#38BDF8} .ifield::placeholder{color:#475569}
        .row{background:#0F172A;border:1px solid #1E293B;border-radius:12px;padding:13px 15px;display:flex;align-items:center;gap:11px;transition:border .2s}
        .row:hover{border-color:#334155}
        .bp{background:linear-gradient(135deg,#0EA5E9,#0284C7);border:none;border-radius:10px;padding:12px 22px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s}
        .bp:hover{opacity:.88}
        .bg{background:linear-gradient(135deg,#059669,#047857);border:none;border-radius:10px;padding:11px 18px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s;display:flex;align-items:center;gap:6px;justify-content:center}
        .bg:hover{opacity:.88}
        .bgh{background:#1E293B;border:1px solid #334155;border-radius:10px;padding:10px 18px;color:#94A3B8;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
        .bgh:hover{background:#263549;color:#E2E8F0}
        .br{background:#1E293B;border:1px solid #EF4444;border-radius:10px;padding:10px 14px;color:#EF4444;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
        .sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center}
        .toast{position:fixed;top:20px;right:20px;padding:11px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:999;animation:sIn .3s ease;max-width:300px}
        @keyframes sIn{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}
        .fab{position:fixed;bottom:26px;right:22px;width:52px;height:52px;background:linear-gradient(135deg,#0EA5E9,#0284C7);border:none;border-radius:15px;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(14,165,233,.35);display:flex;align-items:center;justify-content:center;transition:transform .2s;z-index:100}
        .fab:hover{transform:scale(1.07)}
        .ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:flex-end;justify-content:center}
        .mod{background:#0A1628;border:1px solid #1E293B;border-top:1px solid #334155;border-radius:20px 20px 0 0;padding:22px 20px 38px;width:100%;max-width:680px;animation:sU .3s ease}
        @keyframes sU{from{transform:translateY(70px);opacity:0}to{transform:translateY(0);opacity:1}}
        .pulse{animation:pu 1.2s infinite}
        @keyframes pu{0%,100%{opacity:1}50%{opacity:.3}}
        .badge{display:inline-flex;align-items:center;gap:3px;background:#064E3B;border:1px solid #10B981;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;color:#6EE7B7;white-space:nowrap;flex-shrink:0}
        .tab{padding:7px 14px;border-radius:8px;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
        .fp{background:#1E293B;border:1px solid #334155;border-radius:8px;padding:7px 12px;color:#94A3B8;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
        .fp.on{background:#0EA5E9;border-color:#0EA5E9;color:#fff}
      `}</style>

      {/* Toast */}
      {toast&&<div className="toast" style={{background:toast.type==="error"?"#991B1B":"#064E3B",color:toast.type==="error"?"#FCA5A5":"#6EE7B7",border:`1px solid ${toast.type==="error"?"#EF4444":"#10B981"}`}}>{toast.msg}</div>}

      {/* ── Modal Sheets ── */}
      {showConfig&&(
        <div className="ov" onClick={e=>{if(e.target===e.currentTarget)setShowConfig(false)}}>
          <div className="mod">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontSize:20}}>📊</span>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:"#F1F5F9"}}>Conectar Google Forms / Sheets</p>
              </div>
              <button onClick={()=>setShowConfig(false)} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:20}}>✕</button>
            </div>

            <div style={{background:"#0D2137",border:"1px solid #1E3A5F",borderRadius:12,padding:14,marginBottom:16}}>
              <p style={{fontSize:12,color:"#38BDF8",fontWeight:700,marginBottom:10}}>📋 Opción A — Google Forms (recomendado)</p>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {["1. Crea un Form con UN solo campo: «¿Cuál fue tu movimiento?»","2. En Respuestas → vincula a Google Sheets (ícono verde)","3. En el Sheet resultante: Archivo → Publicar en la web → CSV","4. Pega la URL abajo"].map((s,i)=>(
                  <p key={i} style={{fontSize:12,color:"#94A3B8"}}>{s}</p>
                ))}
              </div>
              <p style={{fontSize:11,color:"#475569",marginTop:8}}>Ejemplo de respuesta en el Form: <span style={{color:"#38BDF8"}}>"gasté s/50 en farmacia"</span> · <span style={{color:"#10B981"}}>"recibí 3500 de sueldo"</span></p>
            </div>

            <div style={{background:"#0D2137",border:"1px solid #1E3A5F",borderRadius:12,padding:14,marginBottom:16}}>
              <p style={{fontSize:12,color:"#38BDF8",fontWeight:700,marginBottom:8}}>📋 Opción B — Google Sheets manual</p>
              <p style={{fontSize:12,color:"#94A3B8"}}>Columnas: <span style={{color:"#E2E8F0",fontFamily:"monospace"}}>fecha, descripcion, tipo, categoria, monto, nota</span></p>
              <p style={{fontSize:11,color:"#475569",marginTop:4}}>tipo = "gasto" o "ingreso"</p>
            </div>

            <label style={{fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,display:"block",marginBottom:8}}>URL pública CSV del Sheet</label>
            <textarea className="ifield" rows={3} placeholder="https://docs.google.com/spreadsheets/d/XXXXX/pub?gid=0&single=true&output=csv"
              value={urlInput} onChange={e=>setUrlInput(e.target.value)} style={{resize:"none",fontSize:12,fontFamily:"monospace"}}/>

            {syncStatus==="error"&&<div style={{background:"#2D1515",border:"1px solid #EF4444",borderRadius:10,padding:"9px 13px",marginTop:10}}>
              <p style={{fontSize:12,color:"#FCA5A5"}}>⚠️ {syncMsg}</p>
            </div>}

            <div style={{display:"flex",gap:10,marginTop:14}}>
              {sheetsUrl&&<button className="br" onClick={desconectar}>Desconectar</button>}
              <button className="bg" style={{flex:1}} onClick={guardarUrl} disabled={syncStatus==="loading"}>
                {syncStatus==="loading"?<><span className="pulse">⏳</span>Conectando...</>:<><span>🔗</span>Conectar y sincronizar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{background:"#0A1628",borderBottom:"1px solid #1E293B",padding:"0 20px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:30,height:30,background:"linear-gradient(135deg,#0EA5E9,#7C3AED)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>💰</div>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,color:"#F1F5F9"}}>FinTrack</span>
            {syncStatus==="ok"&&<span className="badge">● Sheets</span>}
          </div>
          <nav style={{display:"flex",gap:1}}>
            {[["dashboard","Dashboard"],["historial","Historial"],["registro","+ Nuevo"]].map(([v,l])=>(
              <button key={v} className={`nb ${view===v?"on":""}`}
                onClick={()=>{if(v==="registro"){setEditId(null);setForm({tipo:"gasto",descripcion:"",categoria:"alimentacion",monto:"",fecha:hoy(),nota:""});}setView(v);}}>
                {l}
              </button>
            ))}
            <button className="nb" onClick={()=>setShowConfig(true)}
              style={{color:syncStatus==="ok"?"#10B981":syncStatus==="error"?"#EF4444":"#64748B",fontSize:15}}
              title="Conectar Google Forms / Sheets">
              {syncStatus==="loading"?<span className="pulse">⏳</span>:"📊"}
            </button>
          </nav>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"22px 18px 80px"}}>

        {/* ════ DASHBOARD ════ */}
        {view==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* Banner estado */}
            {syncStatus==="ok"?(
              <div style={{background:"#022C22",border:"1px solid #065F46",borderRadius:13,padding:"11px 15px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{fontSize:16}}>📊</span>
                  <div>
                    <p style={{fontSize:13,fontWeight:700,color:"#6EE7B7"}}>Google Forms conectado</p>
                    <p style={{fontSize:11,color:"#047857"}}>
                    {syncMsg} · sync en {Math.floor(countdown/60)}:{String(countdown%60).padStart(2,"0")}
                  </p>
                  </div>
                </div>
                <button onClick={()=>sincronizar()} style={{background:"none",border:"1px solid #065F46",borderRadius:8,padding:"5px 11px",color:"#6EE7B7",font:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Sync</button>
              </div>
            ):(
              <div style={{background:"#0F172A",border:"1px dashed #334155",borderRadius:13,padding:"11px 15px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setShowConfig(true)}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{fontSize:16}}>📊</span>
                  <p style={{fontSize:13,color:"#64748B"}}>Conecta Google Forms para sincronizar automáticamente</p>
                </div>
                <span style={{color:"#38BDF8",fontSize:13,fontWeight:700,flexShrink:0}}>Conectar →</span>
              </div>
            )}

            {/* Entrada rápida */}
            <div className="card">
              <p style={{fontSize:12,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>⚡ Registro rápido</p>
              <p style={{fontSize:11,color:"#475569",marginBottom:10}}>Escribe en lenguaje natural — la app detecta el tipo, monto y categoría automáticamente</p>
              <div style={{display:"flex",gap:8}}>
                <input className="ifield" placeholder="Ej: gasté s/50 en farmacia  •  recibí 3500 de sueldo"
                  value={textoRapido} onChange={e=>{setTextoRapido(e.target.value);setPreviewParsed(null);}}
                  onKeyDown={e=>{if(e.key==="Enter")handleTextoRapido();}}
                  style={{flex:1}}/>
                <button className="bp" style={{padding:"11px 16px",flexShrink:0}} onClick={handleTextoRapido}>Parsear</button>
              </div>

              {previewParsed&&(
                <div style={{marginTop:12,background:"#162032",border:"1px solid #1E3A5F",borderRadius:12,padding:"13px 15px"}}>
                  <p style={{fontSize:11,color:"#38BDF8",fontWeight:700,marginBottom:8}}>Vista previa — ¿todo correcto?</p>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <span style={{fontSize:22}}>{getCat(previewParsed.tipo,previewParsed.categoria).icon}</span>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <p style={{fontSize:14,fontWeight:600,color:"#E2E8F0"}}>{previewParsed.descripcion}</p>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700,
                            background:previewParsed.tipo==="ingreso"?"#064E3B":"#1E293B",
                            color:previewParsed.tipo==="ingreso"?"#6EE7B7":"#94A3B8",
                            border:`1px solid ${previewParsed.tipo==="ingreso"?"#10B981":"#334155"}`}}>
                            {previewParsed.tipo==="ingreso"?"↑ INGRESO":"↓ GASTO"}
                          </span>
                        </div>
                        <p style={{fontSize:11,color:"#475569",marginTop:1}}>{getCat(previewParsed.tipo,previewParsed.categoria).label} · {previewParsed.fecha}</p>
                      </div>
                    </div>
                    <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:previewParsed.tipo==="ingreso"?"#10B981":"#38BDF8"}}>{fmt(previewParsed.monto)}</p>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="bgh" style={{flex:1}} onClick={()=>{setPreviewParsed(null);setTextoRapido("");}}>Cancelar</button>
                    <button className="bg" style={{flex:2}} onClick={confirmarTextoRapido}>✅ Confirmar registro</button>
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de mes para KPIs */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
              <button className={`fp ${filtroMes==="all"?"on":""}`} onClick={()=>setFiltroMes("all")}>Todo</button>
              {MESES.map((m,i)=>(
                <button key={i} className={`fp ${filtroMes===String(i)?"on":""}`} onClick={()=>setFiltroMes(String(i))}>{m}</button>
              ))}
            </div>

            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div className="scard">
                <p style={{fontSize:10,color:"#10B981",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Ingresos</p>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:"#10B981",letterSpacing:"-0.5px"}}>
                  {fmt(filtroMes==="all"?todos.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0):filtrados.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0))}
                </p>
              </div>
              <div className="scard">
                <p style={{fontSize:10,color:"#EF4444",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Gastos</p>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:"#EF4444",letterSpacing:"-0.5px"}}>
                  {fmt(filtroMes==="all"?todos.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0):filtrados.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0))}
                </p>
              </div>
              <div className="scard">
                <p style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Balance</p>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,letterSpacing:"-0.5px",
                  color: (()=>{ const ing=filtroMes==="all"?todos.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0):filtrados.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0); const gas=filtroMes==="all"?todos.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0):filtrados.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0); return ing-gas>=0?"#10B981":"#EF4444"; })()
                }}>
                  {(()=>{ const ing=filtroMes==="all"?todos.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0):filtrados.filter(g=>g.tipo==="ingreso").reduce((s,g)=>s+g.monto,0); const gas=filtroMes==="all"?todos.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0):filtrados.filter(g=>g.tipo==="gasto").reduce((s,g)=>s+g.monto,0); return fmt(ing-gas); })()}
                </p>
              </div>
            </div>

            {/* Gráfica mensual barras */}
            <div className="card">
              <p style={{fontSize:12,fontWeight:700,color:"#94A3B8",marginBottom:14,textTransform:"uppercase",letterSpacing:.8}}>Ingresos vs Gastos por mes</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dataMensual} barSize={14} barGap={3}>
                  <XAxis dataKey="mes" tick={{fill:"#475569",fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip content={<Tooltip_/>} cursor={{fill:"#1E293B"}}/>
                  <Bar dataKey="ingresos" fill="#059669" radius={[4,4,0,0]} name="Ingresos"/>
                  <Bar dataKey="gastos"   fill="#0EA5E9" radius={[4,4,0,0]} name="Gastos"/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie gastos */}
            {dataPie.length>0&&(
              <div className="card">
                <p style={{fontSize:12,fontWeight:700,color:"#94A3B8",marginBottom:14,textTransform:"uppercase",letterSpacing:.8}}>Distribución de gastos</p>
                <div style={{display:"flex",alignItems:"center",gap:18}}>
                  <PieChart width={120} height={120}>
                    <Pie data={dataPie} cx={56} cy={56} innerRadius={35} outerRadius={56} paddingAngle={3} dataKey="value">
                      {dataPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip content={<Tooltip_/>}/>
                  </PieChart>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
                    {dataPie.slice(0,5).map((d,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:d.color}}/>
                          <span style={{fontSize:12,color:"#94A3B8"}}>{d.icon} {d.name}</span>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:"#E2E8F0"}}>{fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recientes */}
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <p style={{fontSize:12,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:.8}}>Recientes</p>
                <button onClick={()=>setView("historial")} style={{background:"none",border:"none",color:"#38BDF8",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ver todos →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {todos.slice(0,6).map(g=>{
                  const cat=getCat(g.tipo,g.categoria);
                  return(
                    <div key={g.id} className="row">
                      <div style={{width:36,height:36,background:cat.color+"20",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <p style={{fontSize:13,fontWeight:600,color:"#E2E8F0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.descripcion}</p>
                          {g.fuente==="sheets"&&<span className="badge">Forms</span>}
                        </div>
                        <p style={{fontSize:11,color:"#475569",marginTop:1}}>{cat.label} · {g.fecha}</p>
                      </div>
                      <p style={{fontSize:14,fontWeight:700,color:g.tipo==="ingreso"?"#10B981":"#F1F5F9",flexShrink:0}}>{g.tipo==="ingreso"?"+":"-"}{fmt(g.monto)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════ HISTORIAL ════ */}
        {view==="historial"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:19,fontWeight:700,color:"#F1F5F9"}}>Historial</p>
              <p style={{fontSize:13,color:"#38BDF8",fontWeight:700}}>{fmt(filtrados.reduce((s,g)=>s+g.monto,0))}</p>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <select className="fp sel on" style={{paddingRight:26}} value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
                <option value="all">Todos los meses</option>
                {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select className="fp sel" style={{paddingRight:26}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
                <option value="all">Gastos e ingresos</option>
                <option value="gasto">Solo gastos</option>
                <option value="ingreso">Solo ingresos</option>
              </select>
              <select className="fp sel" style={{paddingRight:26}} value={filtroCat} onChange={e=>setFiltroCat(e.target.value)}>
                <option value="all">Todas las cat.</option>
                {[...CATS_GASTO,...CATS_INGRESO].map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {filtrados.length===0&&<div style={{textAlign:"center",padding:"36px 0",color:"#475569"}}><p style={{fontSize:28,marginBottom:8}}>🔍</p><p>Sin resultados</p></div>}
              {filtrados.map(g=>{
                const cat=getCat(g.tipo,g.categoria);
                return(
                  <div key={g.id} className="row">
                    <div style={{width:36,height:36,background:cat.color+"20",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <p style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>{g.descripcion}</p>
                        {g.fuente==="sheets"&&<span className="badge">Forms</span>}
                        <span style={{fontSize:10,padding:"1px 6px",borderRadius:5,fontWeight:700,background:g.tipo==="ingreso"?"#064E3B":"#1E293B",color:g.tipo==="ingreso"?"#6EE7B7":"#64748B",border:`1px solid ${g.tipo==="ingreso"?"#10B981":"#334155"}`}}>
                          {g.tipo==="ingreso"?"↑":"↓"}
                        </span>
                      </div>
                      <p style={{fontSize:11,color:"#475569",marginTop:1}}>{cat.label} · {g.fecha}</p>
                      {g.nota&&g.nota!==g.descripcion&&<p style={{fontSize:11,color:"#334155",marginTop:2,fontStyle:"italic",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.nota}</p>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <p style={{fontSize:14,fontWeight:700,color:g.tipo==="ingreso"?"#10B981":"#F1F5F9"}}>{g.tipo==="ingreso"?"+":""}{fmt(g.monto)}</p>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>startEdit(g)} style={{background:"none",border:"none",color:"#38BDF8",cursor:"pointer",fontSize:13}}>✏️</button>
                        <button onClick={()=>del(g)} style={{background:"none",border:"none",color:"#EF4444",cursor:"pointer",fontSize:13}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ REGISTRO ════ */}
        {view==="registro"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:19,fontWeight:700,color:"#F1F5F9"}}>{editId?"Editar":"Nuevo registro"}</p>
            <div className="card" style={{display:"flex",flexDirection:"column",gap:15}}>

              {/* Tipo gasto/ingreso */}
              <div style={{display:"flex",gap:8}}>
                {[["gasto","↓ Gasto","#0EA5E9"],["ingreso","↑ Ingreso","#10B981"]].map(([t,l,c])=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,tipo:t,categoria:t==="ingreso"?"sueldo":"alimentacion"}))}
                    style={{flex:1,padding:"10px",borderRadius:10,border:`2px solid ${form.tipo===t?c:"#334155"}`,background:form.tipo===t?c+"20":"#1E293B",color:form.tipo===t?c:"#64748B",font:"inherit",fontSize:14,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Categoría */}
              <div>
                <label style={{fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:9}}>Categoría</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {catActual.map(c=>(
                    <button key={c.id} onClick={()=>setForm(f=>({...f,categoria:c.id}))}
                      style={{background:form.categoria===c.id?c.color+"25":"#1E293B",border:`1.5px solid ${form.categoria===c.id?c.color:"#334155"}`,borderRadius:9,padding:"6px 11px",color:form.categoria===c.id?c.color:"#64748B",font:"inherit",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:7}}>Descripción *</label>
                <input className="ifield" placeholder="¿Qué fue?" value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div>
                  <label style={{fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:7}}>Monto (S/) *</label>
                  <input className="ifield" type="number" min="0" placeholder="0.00" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:7}}>Fecha *</label>
                  <input className="ifield" type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,color:"#64748B",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:7}}>Nota (opcional)</label>
                <textarea className="ifield" rows={2} placeholder="Comentario adicional..." value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))} style={{resize:"none"}}/>
              </div>
              {form.monto&&(
                <div style={{background:"#162032",border:"1px solid #1E3A5F",borderRadius:11,padding:"13px 15px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <span style={{fontSize:20}}>{getCat(form.tipo,form.categoria).icon}</span>
                    <div>
                      <p style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>{form.descripcion||"Sin descripción"}</p>
                      <p style={{fontSize:11,color:"#475569"}}>{getCat(form.tipo,form.categoria).label} · {form.tipo}</p>
                    </div>
                  </div>
                  <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:19,fontWeight:700,color:form.tipo==="ingreso"?"#10B981":"#38BDF8"}}>{fmt(form.monto)}</p>
                </div>
              )}
              <div style={{display:"flex",gap:9,marginTop:3}}>
                <button className="bgh" onClick={()=>setView("dashboard")}>Cancelar</button>
                <button className="bp" style={{flex:1}} onClick={handleSubmit}>{editId?"Guardar cambios":"Registrar"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {view!=="registro"&&(
        <button className="fab" onClick={()=>{setEditId(null);setForm({tipo:"gasto",descripcion:"",categoria:"alimentacion",monto:"",fecha:hoy(),nota:""});setView("registro");}}>+</button>
      )}
    </div>
  );
}