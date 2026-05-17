import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// ── Hook responsive ───────────────────────────────────────────
const useEsMobile = () => {
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return esMobile;
};

const Reportes = () => {
  const esMobile = useEsMobile();

  const [filtroTiempo, setFiltroTiempo] = useState('hoy');
  const [fechaInicio, setFechaInicio]   = useState('');
  const [fechaFin, setFechaFin]         = useState('');
  const [movimientos, setMovimientos]   = useState([]);
  const [loading, setLoading]           = useState(false);
  const [metricas, setMetricas] = useState({
    totalFacturado: 0, cajaReal: 0, cuentasPorCobrar: 0,
    gastoCombustible: 0, totalViajes: 0, volumenTotal: 0,
  });

  // ── Corrección zona horaria UTC-5 Perú ───────────────────────
  const localToISO = (fecha, finDeDia = false) => {
    const d = new Date(fecha);
    const offset = 5 * 60 * 60 * 1000;
    if (finDeDia) {
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) + offset).toISOString();
    }
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) + offset).toISOString();
  };

  const obtenerFechasFiltro = useCallback(() => {
    const ahora  = new Date();
    const hoy    = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    let inicioISO = '';
    let finISO    = new Date(ahora.getTime() + 5 * 60 * 60 * 1000).toISOString();

    if (filtroTiempo === 'hoy') {
      inicioISO = localToISO(hoy);
    } else if (filtroTiempo === 'semana') {
      const ini = new Date(hoy);
      const dia = ini.getDay();
      ini.setDate(ini.getDate() - dia + (dia === 0 ? -6 : 1));
      inicioISO = localToISO(ini);
    } else if (filtroTiempo === 'mes') {
      inicioISO = localToISO(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
    } else if (filtroTiempo === 'personalizado') {
      if (fechaInicio) inicioISO = localToISO(new Date(fechaInicio + 'T00:00:00'));
      if (fechaFin)    finISO    = localToISO(new Date(fechaFin    + 'T00:00:00'), true);
    }
    return { inicioISO, finISO };
  }, [filtroTiempo, fechaInicio, fechaFin]);

  const cargarReportes = useCallback(async () => {
    setLoading(true);
    try {
      const { inicioISO, finISO } = obtenerFechasFiltro();
      let query = supabase.from('movimientos').select('*').order('creado_en', { ascending: false });
      if (inicioISO) query = query.gte('creado_en', inicioISO);
      if (finISO)    query = query.lte('creado_en', finISO);

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setMovimientos(data);
        let facturado = 0, caja = 0, porCobrar = 0, combustible = 0, volumen = 0;
        data.forEach(mov => {
          const total    = parseFloat(mov.monto_total)       || 0;
          const recibido = parseFloat(mov.monto_recibido)    || 0;
          const gas      = parseFloat(mov.gasto_combustible) || 0;
          const cubos    = parseFloat(mov.cantidad_cubos)    || 0;
          facturado   += total;
          caja        += recibido;
          porCobrar   += (total - recibido);
          combustible += gas;
          volumen     += cubos;
        });
        setMetricas({ totalFacturado: facturado, cajaReal: caja, cuentasPorCobrar: porCobrar, gastoCombustible: combustible, totalViajes: data.length, volumenTotal: volumen });
      }
    } catch (err) {
      console.error('Error cargando reportes:', err.message);
      alert('Error al conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  }, [obtenerFechasFiltro]);

  useEffect(() => { cargarReportes(); }, [cargarReportes, filtroTiempo]);

  // ── Exportar CSV ──────────────────────────────────────────────
  const exportarExcel = () => {
    if (movimientos.length === 0) return alert('No hay registros para exportar en este rango.');
    const encabezados = ['Fecha y Hora','Cliente','Celular','Materiales','Volumen (m3)','Total Venta (S/)','Monto Cobrado (S/)','Saldo Pendiente (S/)','Estado de Pago','Gasto Combustible (S/)'];
    const filas = movimientos.map(mov => {
      const total    = parseFloat(mov.monto_total)    || 0;
      const recibido = parseFloat(mov.monto_recibido) || 0;
      return [
        `"${new Date(mov.creado_en).toLocaleString('es-PE')}"`,
        `"${mov.cliente_nombre.toUpperCase()}"`,
        `"${mov.cliente_celular || 'Sin Registro'}"`,
        `"${mov.material_tipo  || 'Agregados'}"`,
        mov.cantidad_cubos,
        total.toFixed(2), recibido.toFixed(2), (total - recibido).toFixed(2),
        `"${mov.estado_pago}"`,
        (parseFloat(mov.gasto_combustible) || 0).toFixed(2),
      ];
    });
    const csv  = [encabezados.join(';'), ...filas.map(f => f.join(';'))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', `Reporte_${filtroTiempo}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const badgeEstado = (estado) => {
    const base = { padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' };
    if (estado === 'Pagado')   return { ...base, backgroundColor: '#dcfce7', color: '#15803d' };
    if (estado === 'Adelanto') return { ...base, backgroundColor: '#fef3c7', color: '#b45309' };
    return { ...base, backgroundColor: '#fee2e2', color: '#b91c1c' };
  };

  // ── Tarjeta móvil por movimiento ──────────────────────────────
  const TarjetaMovilReporte = ({ mov }) => {
    const vTotal    = parseFloat(mov.monto_total)    || 0;
    const vRecibido = parseFloat(mov.monto_recibido) || 0;
    const vPend     = vTotal - vRecibido;

    return (
      <div style={{ ...tarjetaMovilStyle, borderLeft: vPend > 0 ? '4px solid #dc2626' : '4px solid #059669' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1, paddingRight: '10px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>
              {mov.cliente_nombre.toUpperCase()}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              {new Date(mov.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
          <span style={badgeEstado(mov.estado_pago)}>{mov.estado_pago}</span>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <span style={chipStyle}>🪨 {mov.material_tipo || 'Varios'}</span>
          <span style={{ ...chipStyle, marginLeft: '6px' }}>{parseFloat(mov.cantidad_cubos).toFixed(1)} m³</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          <div style={miniKpiStyle}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>Venta</span>
            <strong style={{ fontSize: '13px', color: '#111827' }}>S/ {vTotal.toFixed(2)}</strong>
          </div>
          <div style={miniKpiStyle}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>Cobrado</span>
            <strong style={{ fontSize: '13px', color: '#059669' }}>S/ {vRecibido.toFixed(2)}</strong>
          </div>
          <div style={miniKpiStyle}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>Pendiente</span>
            <strong style={{ fontSize: '13px', color: vPend > 0 ? '#dc2626' : '#6b7280' }}>
              S/ {vPend.toFixed(2)}
            </strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={containerStyle}>

      {/* Encabezado */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, color: '#065f46', fontSize: esMobile ? '17px' : '20px' }}>📊 Reportes y Contabilidad</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>Control de ventas para administración</p>
        </div>
        <button onClick={exportarExcel} style={btnExcelStyle}>🟢 {esMobile ? 'Excel' : 'Exportar Excel'}</button>
      </div>

      {/* Filtros de tiempo */}
      <div style={filtroBoxStyle}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[['hoy','Hoy'], ['semana','Semana'], ['mes','Mes'], ['personalizado','Rango 📅']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroTiempo(val)}
              style={filtroTiempo === val ? btnActivo : btnInactivo}>
              {label}
            </button>
          ))}
        </div>
        {filtroTiempo === 'personalizado' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputDateStyle} />
            <span style={{ color: '#6b7280', fontSize: '13px' }}>hasta</span>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputDateStyle} />
            <button onClick={cargarReportes} style={btnCalcular}>Calcular</button>
          </div>
        )}
      </div>

      {/* KPIs — 2 columnas en móvil, 4 en desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: esMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { titulo: '💰 FACTURADO',   monto: metricas.totalFacturado,    color: '#065f46', borde: '#059669', sub: 'Monto bruto total' },
          { titulo: '💵 CAJA REAL',   monto: metricas.cajaReal,          color: '#1d4ed8', borde: '#2563eb', sub: 'Efectivo cobrado' },
          { titulo: '⚠️ POR COBRAR',  monto: metricas.cuentasPorCobrar,  color: '#b91c1c', borde: '#dc2626', sub: 'Saldos pendientes' },
          { titulo: '⛽ COMBUSTIBLE', monto: metricas.gastoCombustible,  color: '#b45309', borde: '#d97706', sub: 'Gasto de ruta' },
        ].map(({ titulo, monto, color, borde, sub }) => (
          <div key={titulo} style={{ ...cardKpiStyle, borderLeft: `4px solid ${borde}` }}>
            <span style={cardTituloStyle}>{titulo}</span>
            <strong style={{ fontSize: esMobile ? '18px' : '22px', fontWeight: '800', margin: '4px 0 2px', color }}>
              S/ {monto.toFixed(2)}
            </strong>
            <span style={cardSubStyle}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Banner logístico */}
      <div style={bannerStyle}>
        <strong>{metricas.totalViajes} despachos</strong> · <strong>{metricas.volumenTotal.toFixed(1)} m³</strong> en este período
      </div>

      {/* Lista / Tabla */}
      <div style={tablaCardStyle}>
        <h3 style={{ margin: '0 0 15px', color: '#374151', fontSize: '15px' }}>📋 Listado de Despachos</h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '25px', color: '#6b7280' }}>Cargando datos...</div>
        ) : movimientos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
            No hay registros para este filtro.
          </div>
        ) : esMobile ? (
          // ── VISTA MÓVIL: tarjetas ─────────────────────────────
          <div>
            {movimientos.map(mov => <TarjetaMovilReporte key={mov.id} mov={mov} />)}
          </div>
        ) : (
          // ── VISTA DESKTOP: tabla ──────────────────────────────
          <div style={{ overflowX: 'auto' }}>
            <table style={tablaStyle}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {['Fecha / Hora','Cliente','Material','m³','Venta','Cobrado','Pendiente','Estado'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.map(mov => {
                  const vTotal    = parseFloat(mov.monto_total)    || 0;
                  const vRecibido = parseFloat(mov.monto_recibido) || 0;
                  const vPend     = vTotal - vRecibido;
                  return (
                    <tr key={mov.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>
                        {new Date(mov.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: '600' }}>{mov.cliente_nombre.toUpperCase()}</td>
                      <td style={tdStyle}>{mov.material_tipo || 'Varios'}</td>
                      <td style={tdStyle}>{parseFloat(mov.cantidad_cubos).toFixed(1)}</td>
                      <td style={tdStyle}>S/ {vTotal.toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: '#047857' }}>S/ {vRecibido.toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: vPend > 0 ? '#b91c1c' : '#374151', fontWeight: vPend > 0 ? '600' : 'normal' }}>
                        {vPend > 0 ? `S/ ${vPend.toFixed(2)}` : 'S/ 0.00'}
                      </td>
                      <td style={tdStyle}>
                        <span style={badgeEstado(mov.estado_pago)}>{mov.estado_pago}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Estilos ────────────────────────────────────────────────────
const containerStyle  = { maxWidth: '1050px', margin: '0 auto', padding: '16px', background: '#ffffff', borderRadius: '14px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' };
const headerStyle     = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', paddingBottom: '14px', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' };
const btnExcelStyle   = { backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' };
const filtroBoxStyle  = { backgroundColor: '#f9fafb', padding: '12px 14px', borderRadius: '10px', marginBottom: '18px', border: '1px solid #f3f4f6' };
const btnInactivo     = { background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', padding: '7px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' };
const btnActivo       = { background: '#065f46', color: '#fff', border: '1px solid #065f46', padding: '7px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' };
const inputDateStyle  = { padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' };
const btnCalcular     = { background: '#4b5563', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' };
const cardKpiStyle    = { backgroundColor: '#fff', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', boxSizing: 'border-box' };
const cardTituloStyle = { fontSize: '11px', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.4px' };
const cardSubStyle    = { fontSize: '11px', color: '#a0aec0' };
const bannerStyle     = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#1e293b', marginBottom: '18px' };
const tablaCardStyle  = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' };
const tablaStyle      = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
const thStyle         = { padding: '11px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontWeight: '600', textAlign: 'left', whiteSpace: 'nowrap' };
const tdStyle         = { padding: '11px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' };
//movil
// Estilos tarjeta móvil
const tarjetaMovilStyle = { backgroundColor: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' };
const chipStyle         = { display: 'inline-block', background: '#f3f4f6', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: '#374151' };
const miniKpiStyle      = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid #e5e7eb' };

export default Reportes;