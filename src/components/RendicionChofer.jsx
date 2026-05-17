import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const getRangoFecha = (filtro, desde, hasta) => {
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const offset = 5 * 60 * 60 * 1000;
  if (filtro === 'hoy') return { desde: new Date(hoyLocal.getTime() + offset).toISOString(), hasta: null };
  if (filtro === 'semana') {
    const ini = new Date(hoyLocal);
    const d = ini.getDay();
    ini.setDate(ini.getDate() - d + (d === 0 ? -6 : 1));
    return { desde: new Date(ini.getTime() + offset).toISOString(), hasta: null };
  }
  if (filtro === 'mes') {
    const ini = new Date(hoyLocal.getFullYear(), hoyLocal.getMonth(), 1);
    return { desde: new Date(ini.getTime() + offset).toISOString(), hasta: null };
  }
  if (filtro === 'personalizado' && desde) {
    const d = new Date(desde + 'T00:00:00');
    const h = hasta ? new Date(hasta + 'T23:59:59') : null;
    return {
      desde: new Date(d.getTime() + offset).toISOString(),
      hasta: h ? new Date(h.getTime() + offset).toISOString() : null,
    };
  }
  return { desde: null, hasta: null };
};

const RendicionChofer = ({ usuario }) => {
  const navigate = useNavigate();

  const [movimientos, setMovimientos]           = useState([]);
  const [gastos, setGastos]                     = useState([]);
  const [cargando, setCargando]                 = useState(true);
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [nuevoGasto, setNuevoGasto]             = useState({ descripcion: '', monto: '' });
  const [guardandoGasto, setGuardandoGasto]     = useState(false);
  const [confirmando, setConfirmando]           = useState(null);

  const [filtroFecha, setFiltroFecha] = useState('semana');
  const [fechaDesde, setFechaDesde]   = useState('');
  const [fechaHasta, setFechaHasta]   = useState('');

  const cargarDatos = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);

    const { desde, hasta } = getRangoFecha(filtroFecha, fechaDesde, fechaHasta);

    let queryMovs = supabase
      .from('movimientos')
      .select('id, cliente_nombre, monto_total, monto_recibido, estado_pago, creado_en')
      .eq('usuario_id', usuario.id)
      .order('creado_en', { ascending: false });
    if (desde) queryMovs = queryMovs.gte('creado_en', desde);
    if (hasta) queryMovs = queryMovs.lte('creado_en', hasta);

    let queryGsts = supabase
      .from('gastos_chofer')
      .select('id, descripcion, monto, creado_en')
      .eq('usuario_id', usuario.id)
      .order('creado_en', { ascending: false });
    if (desde) queryGsts = queryGsts.gte('creado_en', desde);
    if (hasta) queryGsts = queryGsts.lte('creado_en', hasta);

    const [{ data: movs }, { data: gsts }] = await Promise.all([queryMovs, queryGsts]);
    setMovimientos(movs || []);
    setGastos(gsts || []);
    setCargando(false);
  }, [usuario?.id, filtroFecha, fechaDesde, fechaHasta]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const totalCobrado = movimientos.reduce((a, m) => a + (parseFloat(m.monto_recibido) || 0), 0);
  const totalGastos  = gastos.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);
  const netoEntregar = totalCobrado - totalGastos;
  const pendientes   = movimientos.filter(m => m.estado_pago === 'Fiado' || m.estado_pago === 'Adelanto');

  const confirmarPago = async (mov) => {
    setConfirmando(mov.id);
    const { error } = await supabase
      .from('movimientos')
      .update({ monto_recibido: mov.monto_total, estado_pago: 'Pagado' })
      .eq('id', mov.id);
    if (error) alert('Error al confirmar pago: ' + error.message);
    else await cargarDatos();
    setConfirmando(null);
  };

  const guardarGasto = async () => {
    if (!nuevoGasto.descripcion.trim()) return alert('Escribe una descripción');
    if (!nuevoGasto.monto || parseFloat(nuevoGasto.monto) <= 0) return alert('Ingresa un monto válido');
    setGuardandoGasto(true);
    const { error } = await supabase.from('gastos_chofer').insert([{
      usuario_id: usuario.id,
      descripcion: nuevoGasto.descripcion.trim(),
      monto: parseFloat(nuevoGasto.monto),
    }]);
    if (error) alert('Error al guardar gasto: ' + error.message);
    else { setNuevoGasto({ descripcion: '', monto: '' }); setMostrarFormGasto(false); await cargarDatos(); }
    setGuardandoGasto(false);
  };

  const eliminarGasto = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    await supabase.from('gastos_chofer').delete().eq('id', id);
    await cargarDatos();
  };

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const labelFiltro = () => {
    if (filtroFecha === 'hoy') return 'hoy';
    if (filtroFecha === 'semana') return 'esta semana';
    if (filtroFecha === 'mes') return 'este mes';
    if (filtroFecha === 'personalizado' && fechaDesde) return `${fechaDesde}${fechaHasta ? ' al ' + fechaHasta : ''}`;
    return 'el período';
  };

  if (cargando) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
        Cargando tu rendición...
      </div>
    );
  }

  return (
    <div style={containerStyle}>

      {/* Header */}
      <div style={headerStyle}>
        <button onClick={() => navigate('/inicio')} style={btnVolverStyle}>← Volver</button>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#065f46' }}>📊 Mi Rendición</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Revisa tus cobros y gastos</div>
        </div>
      </div>

      {/* ── FILTROS DE FECHA ──────────────────────────────────── */}
      <div style={filtrosBoxStyle}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          📅 Período
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[['hoy','Hoy'], ['semana','Esta semana'], ['mes','Este mes'], ['personalizado','Rango']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroFecha(val)}
              style={{ ...btnFiltroStyle, background: filtroFecha === val ? '#065f46' : '#f3f4f6', color: filtroFecha === val ? '#fff' : '#374151', fontWeight: filtroFecha === val ? '700' : '400' }}>
              {label}
            </button>
          ))}
        </div>
        {filtroFecha === 'personalizado' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputFechaStyle} />
            <span style={{ fontSize: '12px', color: '#6b7280' }}>hasta</span>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputFechaStyle} />
            <button onClick={cargarDatos} style={{ ...btnFiltroStyle, background: '#374151', color: '#fff', padding: '6px 14px' }}>Buscar</button>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 1: Resumen financiero ─────────────────────── */}
      <div style={seccionStyle}>
        <div style={seccionTituloStyle}>💰 Resumen — {labelFiltro()}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={filaResumenStyle}>
            <span style={{ color: '#374151' }}>Total cobrado</span>
            <strong style={{ color: '#059669', fontSize: '16px' }}>S/ {totalCobrado.toFixed(2)}</strong>
          </div>
          <div style={filaResumenStyle}>
            <span style={{ color: '#374151' }}>Gastos extras</span>
            <strong style={{ color: '#dc2626', fontSize: '16px' }}>− S/ {totalGastos.toFixed(2)}</strong>
          </div>
          <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ ...filaResumenStyle, backgroundColor: netoEntregar >= 0 ? '#f0fdf4' : '#fef2f2', padding: '12px', borderRadius: '10px', border: `1px solid ${netoEntregar >= 0 ? '#a7f3d0' : '#fecaca'}` }}>
            <span style={{ fontWeight: '700', color: '#111827' }}>Neto a entregar</span>
            <strong style={{ fontSize: '20px', color: netoEntregar >= 0 ? '#065f46' : '#dc2626' }}>
              S/ {netoEntregar.toFixed(2)}
            </strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          {[
            { label: 'Viajes', val: movimientos.length, color: '#111827' },
            { label: 'Pendientes', val: pendientes.length, color: pendientes.length > 0 ? '#d97706' : '#059669' },
            { label: 'Gastos', val: gastos.length, color: '#111827' },
          ].map(({ label, val, color }) => (
            <div key={label} style={miniCardStyle}>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{label}</span>
              <strong style={{ fontSize: '22px', color }}>{val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECCIÓN 2: Clientes con saldo pendiente ───────────── */}
      <div style={seccionStyle}>
        <div style={seccionTituloStyle}>⚠️ Clientes con Saldo Pendiente</div>
        {pendientes.length === 0 ? (
          <div style={vacioPStyle}>✅ Sin pendientes en {labelFiltro()}</div>
        ) : (
          pendientes.map(mov => {
            const saldo = (parseFloat(mov.monto_total) || 0) - (parseFloat(mov.monto_recibido) || 0);
            return (
              <div key={mov.id} style={clientePendienteStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>{mov.cliente_nombre}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{formatFecha(mov.creado_en)}</div>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={badgePendienteStyle(mov.estado_pago)}>{mov.estado_pago}</span>
                    <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '700' }}>Debe: S/ {saldo.toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={() => confirmarPago(mov)} disabled={confirmando === mov.id} style={btnConfirmarStyle}>
                  {confirmando === mov.id ? '...' : '✅ Pagó'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── SECCIÓN 3: Gastos extra ───────────────────────────── */}
      <div style={seccionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={seccionTituloStyle}>🧾 Mis Gastos Extra</div>
          <button onClick={() => setMostrarFormGasto(!mostrarFormGasto)} style={btnAgregarGastoStyle}>
            {mostrarFormGasto ? '✕ Cancelar' : '+ Agregar'}
          </button>
        </div>
        {mostrarFormGasto && (
          <div style={formGastoStyle}>
            <label style={labelStyle}>Descripción</label>
            <input type="text" placeholder="Ej: Almuerzo, peaje, gaseosa..." value={nuevoGasto.descripcion}
              onChange={e => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })} style={inputStyle} />
            <label style={labelStyle}>Monto (S/)</label>
            <input type="text" inputMode="decimal" placeholder="0.00" value={nuevoGasto.monto}
              onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setNuevoGasto({ ...nuevoGasto, monto: e.target.value }); }}
              style={inputStyle} />
            <button onClick={guardarGasto} disabled={guardandoGasto} style={btnGuardarGastoStyle}>
              {guardandoGasto ? 'Guardando...' : '💾 Guardar Gasto'}
            </button>
          </div>
        )}
        {gastos.length === 0 ? (
          <div style={vacioPStyle}>Sin gastos en {labelFiltro()}</div>
        ) : (
          gastos.map(g => (
            <div key={g.id} style={filaGastoStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>{g.descripcion}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{formatFecha(g.creado_en)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ color: '#dc2626' }}>S/ {parseFloat(g.monto).toFixed(2)}</strong>
                <button onClick={() => eliminarGasto(g.id)} style={btnEliminarStyle}>✕</button>
              </div>
            </div>
          ))
        )}
        {gastos.length > 0 && (
          <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
            Total gastos: <strong style={{ color: '#dc2626' }}>S/ {totalGastos.toFixed(2)}</strong>
          </div>
        )}
      </div>

    </div>
  );
};

// ── Estilos ────────────────────────────────────────────────────
const containerStyle        = { maxWidth: '480px', margin: '20px auto', padding: '20px', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' };
const headerStyle           = { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' };
const btnVolverStyle        = { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: '600' };
const filtrosBoxStyle       = { backgroundColor: '#fff', borderRadius: '14px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' };
const btnFiltroStyle        = { padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px' };
const inputFechaStyle       = { padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px' };
const seccionStyle          = { backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' };
const seccionTituloStyle    = { fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.3px' };
const filaResumenStyle      = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' };
const miniCardStyle         = { flex: 1, backgroundColor: '#f9fafb', borderRadius: '10px', padding: '10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #e5e7eb' };
const vacioPStyle           = { textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '20px 0' };
const clientePendienteStyle = { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#fffbeb', borderRadius: '10px', marginBottom: '10px', border: '1px solid #fef3c7' };
const badgePendienteStyle   = (estado) => ({ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', backgroundColor: estado === 'Fiado' ? '#fee2e2' : '#fef3c7', color: estado === 'Fiado' ? '#b91c1c' : '#92400e' });
const btnConfirmarStyle     = { backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' };
const formGastoStyle        = { backgroundColor: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #e5e7eb' };
const labelStyle            = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
const inputStyle            = { width: '100%', padding: '11px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '15px', boxSizing: 'border-box', outline: 'none' };
const btnGuardarGastoStyle  = { width: '100%', padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' };
const btnAgregarGastoStyle  = { backgroundColor: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' };
const filaGastoStyle        = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' };
const btnEliminarStyle      = { background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' };

export default RendicionChofer;