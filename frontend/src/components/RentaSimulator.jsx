import React, { useState } from "react";
import {
  simulateRenta,
  compararDeclaraciones,
  downloadBorradorPdf,
} from "../api.js";
import { t } from "../i18n.js";
import { getStyles, FormRow, CheckRow } from "./shared.jsx";

export default function RentaSimulator({ session, onBack, th, lang }) {
  const s = getStyles(th);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("residente");
  const [data, setData] = useState({
    nombre: session?.callerName || "", apellido: session?.callerLastName || "",
    nif: "", estadoCivil: "soltero", hijos: 0, hijosMenuores3: 0, comunidadAutonoma: "",
    edad: "", discapacidad: 0, ascendientes: 0,
    familiaNumerosa: false, familiaNumCategoria: "general",
    rendimientosTrabajo: "", otrosRendimientos: "",
    retencionesIRPF: "", seguridadSocial: "",
    dividendos: "", intereses: "", otrosCapitalMobiliario: "", gastosAdminCustodia: "",
    retencionesCapital: "",
    gananciaPatrimonial: [], inmueblesNoHabituales: [],
    hipoteca: false, importeHipoteca: "", alquiler: false, importeAlquiler: "",
    donativos: "", planPensiones: "", maternidad: false,
    gastosGuarderia: "", gastosEducativos: false, gastosEscolaridad: "", gastosIdiomas: "", gastosUniformes: "",
    autonomo: false, ingresoActividad: "", gastosActividad: "",
    amortizacion: "", segurosActividad: "", suministros: "",
    inicioActividad: false,
    noResidente: false, paisResidencia: "", rendimientosInmuebles: "", gananciasBruta: "",
  });
  const [conyugeData, setConyugeData] = useState({ nombre: "", apellido: "", nif: "", rendimientosTrabajo: "", retencionesIRPF: "", seguridadSocial: "", otrosRendimientos: "", dividendos: "", intereses: "", autonomo: false, ingresoActividad: "", gastosActividad: "" });
  const [result, setResult] = useState(null);
  const [comparativa, setComparativa] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const updateField = (f, v) => setData(p => ({ ...p, [f]: v }));
  const updateConyuge = (f, v) => setConyugeData(p => ({ ...p, [f]: v }));
  const addGanancia = () => setData(p => ({ ...p, gananciaPatrimonial: [...p.gananciaPatrimonial, { tipo: "acciones", descripcion: "", valorVenta: "", valorAdquisicion: "", gastosVenta: "", gastosAdquisicion: "", periodoTenenciaMeses: 13 }] }));
  const updateGanancia = (idx, field, val) => setData(p => ({ ...p, gananciaPatrimonial: p.gananciaPatrimonial.map((g, i) => i === idx ? { ...g, [field]: val } : g) }));
  const removeGanancia = (idx) => setData(p => ({ ...p, gananciaPatrimonial: p.gananciaPatrimonial.filter((_, i) => i !== idx) }));
  const addInmueble = () => setData(p => ({ ...p, inmueblesNoHabituales: [...p.inmueblesNoHabituales, { referenciaCatastral: "", valorCatastral: "", catastroRevisado: false, diasNoAlquilado: 365 }] }));
  const updateInmueble = (idx, field, val) => setData(p => ({ ...p, inmueblesNoHabituales: p.inmueblesNoHabituales.map((im, i) => i === idx ? { ...im, [field]: val } : im) }));
  const removeInmueble = (idx) => setData(p => ({ ...p, inmueblesNoHabituales: p.inmueblesNoHabituales.filter((_, i) => i !== idx) }));

  const ccaaSelect = (
    <select value={data.comunidadAutonoma} onChange={e => updateField("comunidadAutonoma", e.target.value)} style={s.input}>
      <option value="">-- Seleccione su CCAA --</option>
      {[["andalucia","Andalucia"],["aragon","Aragon"],["asturias","Asturias"],["baleares","Islas Baleares"],["canarias","Canarias"],["cantabria","Cantabria"],["castilla-mancha","Castilla-La Mancha"],["castilla-leon","Castilla y Leon"],["cataluna","Cataluna"],["extremadura","Extremadura"],["galicia","Galicia"],["madrid","Madrid"],["murcia","Murcia"],["rioja","La Rioja"],["valencia","Comunidad Valenciana"],["pais-vasco","Pais Vasco"],["navarra","Navarra"],["ceuta","Ceuta"],["melilla","Melilla"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  const steps = [
    { title: "Datos Personales", fields: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[["residente","Residente"],["no_residente","No Residente"],["conjunta","Conjunta"]].map(([m, l]) => (
            <button key={m} onClick={() => { setMode(m); updateField("noResidente", m === "no_residente"); }}
              style={{ ...s.primaryBtn, background: mode === m ? th.accentBg : th.bgTertiary, color: mode === m ? th.accent : th.textSecondary, fontSize: 11, padding: "6px 14px" }}>{l}</button>
          ))}
        </div>
        <FormRow label="Nombre" value={data.nombre} onChange={v => updateField("nombre", v)} styles={s} />
        <FormRow label="NIF/NIE" value={data.nif} onChange={v => updateField("nif", v)} placeholder="12345678A" styles={s} />
        <FormRow label="Edad" value={data.edad} onChange={v => updateField("edad", v)} type="number" styles={s} />
        <FormRow label="Hijos menores de 25" value={data.hijos} onChange={v => updateField("hijos", parseInt(v) || 0)} type="number" styles={s} />
        <div><label style={s.label}>Comunidad Autonoma</label>{ccaaSelect}</div>
      </div>
    )},
    { title: "Rendimientos del Trabajo", fields: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormRow label="Rendimiento integro (0001)" value={data.rendimientosTrabajo} onChange={v => updateField("rendimientosTrabajo", v)} type="number" suffix="€" styles={s} />
        <FormRow label="Retenciones IRPF (0596)" value={data.retencionesIRPF} onChange={v => updateField("retencionesIRPF", v)} type="number" suffix="€" styles={s} />
        <FormRow label="Cotizaciones SS (0012)" value={data.seguridadSocial} onChange={v => updateField("seguridadSocial", v)} type="number" suffix="€" styles={s} />
      </div>
    )},
    { title: "Capital Mobiliario", fields: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormRow label="Dividendos (0029)" value={data.dividendos} onChange={v => updateField("dividendos", v)} type="number" suffix="€" styles={s} />
        <FormRow label="Intereses (0023)" value={data.intereses} onChange={v => updateField("intereses", v)} type="number" suffix="€" styles={s} />
        <FormRow label="Retenciones capital" value={data.retencionesCapital} onChange={v => updateField("retencionesCapital", v)} type="number" suffix="€" styles={s} />
      </div>
    )},
    { title: "Deducciones", fields: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <CheckRow label="Hipoteca anterior a 01/01/2013" checked={data.hipoteca} onChange={v => updateField("hipoteca", v)} th={th} />
        {data.hipoteca && <FormRow label="Pagos hipoteca anuales" value={data.importeHipoteca} onChange={v => updateField("importeHipoteca", v)} type="number" suffix="€" styles={s} />}
        <FormRow label="Donativos (0723)" value={data.donativos} onChange={v => updateField("donativos", v)} type="number" suffix="€" styles={s} />
        <FormRow label="Plan de pensiones (0500)" value={data.planPensiones} onChange={v => updateField("planPensiones", v)} type="number" suffix="€" styles={s} />
        <CheckRow label="Deduccion por maternidad" checked={data.maternidad} onChange={v => updateField("maternidad", v)} th={th} />
      </div>
    )},
    { title: "Autonomos", fields: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <CheckRow label="Es trabajador/a autonomo/a" checked={data.autonomo} onChange={v => updateField("autonomo", v)} th={th} />
        {data.autonomo && <>
          <FormRow label="Ingresos actividad (0109)" value={data.ingresoActividad} onChange={v => updateField("ingresoActividad", v)} type="number" suffix="€" styles={s} />
          <FormRow label="Gastos deducibles (0110)" value={data.gastosActividad} onChange={v => updateField("gastosActividad", v)} type="number" suffix="€" styles={s} />
          <CheckRow label="Inicio de actividad (1er/2do ano)" checked={data.inicioActividad} onChange={v => updateField("inicioActividad", v)} th={th} />
        </>}
      </div>
    )},
  ];

  if (mode === "conjunta") {
    steps.push({ title: "Datos del Conyuge", fields: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormRow label="Nombre" value={conyugeData.nombre} onChange={v => updateConyuge("nombre", v)} styles={s} />
        <FormRow label="Rendimiento trabajo" value={conyugeData.rendimientosTrabajo} onChange={v => updateConyuge("rendimientosTrabajo", v)} type="number" suffix="€" styles={s} />
        <FormRow label="Retenciones IRPF" value={conyugeData.retencionesIRPF} onChange={v => updateConyuge("retencionesIRPF", v)} type="number" suffix="€" styles={s} />
      </div>
    )});
  }

  const calculate = async () => {
    setAiLoading(true);
    try {
      if (mode === "conjunta") {
        const cmpResult = await compararDeclaraciones(data, { ...conyugeData, comunidadAutonoma: data.comunidadAutonoma, edad: data.edad });
        setComparativa(cmpResult);
        setResult(cmpResult.masConveniente === "conjunta" ? cmpResult.conjunta : cmpResult.individual.declarante1);
      } else {
        const apiResult = await simulateRenta(data);
        if (!apiResult.error) { setResult(apiResult); setAiLoading(false); return; }
      }
    } catch (err) { console.error("Error simulacion:", err); }
    setAiLoading(false);
  };

  if (result) {
    const aDevolver = result.resultado === "a_devolver";
    return (
      <div style={{ animation: "fadeIn 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => { setResult(null); setComparativa(null); }} style={s.backBtn}>← {t("back", lang)}</button>
          <h2 style={s.sectionTitle}>Resultado Renta 2025</h2>
          <div style={{ flex: 1 }} />
          <button onClick={() => downloadBorradorPdf(data)} style={{ ...s.primaryBtn, background: th.purpleBg, color: th.purple, fontSize: 12 }}>PDF Borrador</button>
        </div>
        <div style={{
          background: aDevolver ? `linear-gradient(135deg, rgba(0,184,148,0.15), rgba(0,206,201,0.08))` : `linear-gradient(135deg, rgba(214,48,49,0.15), rgba(225,112,85,0.08))`,
          border: aDevolver ? `1px solid rgba(0,184,148,0.3)` : `1px solid rgba(214,48,49,0.3)`,
          borderRadius: 20, padding: "32px 28px", marginBottom: 24, textAlign: "center",
        }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: th.textSecondary, marginBottom: 8 }}>{aDevolver ? "A DEVOLVER" : "A INGRESAR"}</div>
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 48, fontWeight: 700, color: aDevolver ? th.success : th.error }}>
            {aDevolver ? "+" : "-"}{(result.importeResultado || 0).toFixed(2)} €
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["Base General", result.baseImponibleGeneral], ["Base Ahorro", result.baseImponibleAhorro],
            ["Cuota Integra", result.cuotaIntegra], ["Cuota Liquida", result.cuotaLiquida],
            ["Retenciones", result.retencionesIngresos], ["Cuota Diferencial", result.cuotaDiferencial]
          ].filter(([, v]) => v != null).map(([label, value]) => (
            <div key={label} style={{ background: th.bgSecondary, borderRadius: 12, padding: "16px 18px", border: `1px solid ${th.border}` }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: th.textSecondary, marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 18, fontWeight: 600, color: th.text }}>{(value || 0).toFixed(2)} €</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={s.backBtn}>← {t("back", lang)}</button>
        <h2 style={s.sectionTitle}>Simulador Renta 2025</h2>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
        {steps.map((st, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            padding: "8px 16px", borderRadius: 20, border: "none",
            background: step === i ? th.accentBg : th.bgTertiary,
            color: step === i ? th.accent : th.textSecondary,
            fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}>{i + 1}. {st.title}</button>
        ))}
      </div>
      <div style={{ background: th.bgSecondary, borderRadius: 16, padding: "28px 24px", border: `1px solid ${th.border}` }}>
        <h3 style={{ fontFamily: "'Playfair Display'", fontSize: 22, color: th.text, margin: "0 0 20px" }}>{steps[step].title}</h3>
        {steps[step].fields}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ ...s.primaryBtn, opacity: step === 0 ? 0.3 : 1, background: th.bgTertiary, color: th.text }}>← Anterior</button>
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)} style={s.primaryBtn}>Siguiente →</button>
        ) : (
          <button onClick={calculate} disabled={aiLoading} style={{ ...s.primaryBtn, background: th.accentGradient, color: th.bg }}>
            {aiLoading ? "Calculando..." : "Calcular Resultado"}
          </button>
        )}
      </div>
    </div>
  );
}
