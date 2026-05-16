import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
// 1. Importamos el nuevo componente que creamos en el archivo anterior
import Reportes from './Reportes'; 

const ITEMS_POR_PAGINA = 10;

const DashboardAdmin = ({ usuario }) => {
  // ── Estado Nuevo para controlar la Pestaña Activa ────────────────
  const [vistaActiva, setVistaActiva]     = useState('dashboard'); // dashboard | reportes

  // ── Tus Estados Originales ───────────────────────────────────────
  const [movimientos, setMovimientos]     = useState([]);
  const [busqueda, setBusqueda]           = useState('');
  const [loading, setLoading]             = useState(true);
  const [paginaActual, setPaginaActual]   = useState(1);
  const [vistaDeudores, setVistaDeudores] = useState(false);
  const [expandido, setExpandido]         = useState(null); 
  const [detalles, setDetalles]           = useState({});  

  const fetchMovimientos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .order('creado_en', { ascending: false });

    if (!error) setMovimientos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMovimientos(); }, []);

  const toggleDetalle = async (id) => {
    if (expandido === id) {
      setExpandido(null);
      return;
    }
    setExpandido(id);
    if (!detalles[id]) {
      const { data } = await supabase
        .from('detalle_movimientos')
        .select('*')
        .order('id', { ascending: true })
        .eq('movimiento_id', id);
      setDetalles(prev => ({ ...prev, [id]: data || [] }));
    }
  };

  const marcarComoPagado = async (id, total) => {
    const { error } = await supabase
      .from('movimientos')
      .update({ monto_recibido: total, estado_pago: 'Pagado' })
      .eq('id', id);
    if (error) alert('Error al actualizar');
    else fetchMovimientos();
  };

  const eliminarRegistro = async (id) => {
    if (window.confirm('¿Estás segura de eliminar este registro?')) {
      const { error } = await supabase.from('movimientos').delete().eq('id', id);
      if (error) alert('Error al eliminar');
      else {
        fetchMovimientos();
        setDetalles(prev => { const n = { ...prev }; delete n[id]; return n; });
        if (expandido === id) setExpandido(null);
      }
    }
  };

  // ── Tus Cálculos originales ─────────────────────────────────────
  const totalCaja     = movimientos.reduce((acc, m) => acc + (Number(m.monto_recibido) || 0), 0);
  const totalDeuda    = movimientos.reduce((acc, m) => acc + Math.max(0, Number(m.monto_total) - Number(m.monto_recibido)), 0);
  const totalDeudores = movimientos.filter(m => (Number(m.monto_total) - Number(m.monto_recibido)) > 0).length;

  // ── Filtrado Original ───────────────────────────────────────────
  let lista = movimientos.filter(m =>
    m.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  if (vistaDeudores) {
    lista = lista.filter(m => (Number(m.monto_total) - Number(m.monto_recibido)) > 0);
  }

  // ── Paginación Original ─────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(lista.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicio       = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const paginados    = lista.slice(inicio, inicio + ITEMS_POR_PAGINA);

  const cambiarBusqueda = (v) => { setBusqueda(v); setPaginaActual(1); };
  const toggleDeudores  = () => { setVistaDeudores(v => !v); setPaginaActual(1); };

  return (
    <div style={wrapStyle}>

      {/* ── MENÚ DE PESTAÑAS (Interconecta Dashboard con Reportes) ── */}
      <div style={menuTabsStyle}>
        <button 
          onClick={() => setVistaActiva('dashboard')} 
          style={vistaActiva === 'dashboard' ? tabActivoStyle : tabInactivoStyle}
        >
          🎛️ Panel de Control Rapido
        </button>
        <button 
          onClick={() => setVistaActiva('reportes')} 
          style={vistaActiva === 'reportes' ? tabActivoStyle : tabInactivoStyle}
        >
          📊 Ver Reportes y Excel
        </button>
      </div>

      {/* RENDERIZADO DINÁMICO */}
      {vistaActiva === 'reportes' ? (
        // Renderizamos la pantalla de reportes completa
        <Reportes />
      ) : (
        // Renderizamos tu Dashboard de control original
        <>
          {/* ── TARJETAS ── */}
          <div style={gridStyle}>
            <div style={{ ...cardStyle, borderLeft: '5px solid #059669', background: '#ecfdf5' }}>
              <small style={{ color: '#065f46', fontWeight: 600 }}>💰 Dinero en Mano</small>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#065f46', margin: '4px 0' }}>
                S/ {totalCaja.toFixed(2)}
              </div>
              <small style={{ color: '#6b7280' }}>Total cobrado</small>
            </div>

            <div
              onClick={toggleDeudores}
              style={{
                ...cardStyle,
                borderLeft: '5px solid #dc2626',
                background: vistaDeudores ? '#fca5a5' : '#fef2f2',
                cursor: 'pointer',
                outline: vistaDeudores ? '2px solid #dc2626' : 'none',
              }}
              title="Clic para ver deudores"
            >
              <small style={{ color: '#991b1b', fontWeight: 600 }}>
                {vistaDeudores ? '👁️ Viendo deudores — clic para volver' : '⚠️ Total por Cobrar'}
              </small>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#991b1b', margin: '4px 0' }}>
                S/ {totalDeuda.toFixed(2)}
              </div>
              <small style={{ color: '#6b7280' }}>
                {totalDeudores} {totalDeudores === 1 ? 'persona debe' : 'personas deben'}
              </small>
            </div>
          </div>

          {/* Banner deudores */}
          {vistaDeudores && (
            <div style={bannerDeudoresStyle}>
              🔴 Mostrando solo clientes con saldo pendiente — {totalDeudores} {totalDeudores === 1 ? 'deudor' : 'deudores'}
              <button onClick={toggleDeudores} style={btnClearStyle}>✕ Quitar filtro</button>
            </div>
          )}

          {/* Buscador */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar cliente..."
              style={inputBusqueda}
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
            />
            <button onClick={fetchMovimientos} style={btnRefresh}>↻ Actualizar</button>
          </div>

          {/* Tabla */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Cargando...</div>
          ) : lista.length === 0 ? (
            <div style={emptyStyle}>
              {vistaDeudores ? '🎉 ¡No hay deudas pendientes!' : 'No se encontraron registros.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}>
              <table style={tableStyle}>
                <thead style={{ backgroundColor: '#f3f4f6' }}>
                  <tr>
                    <th style={th}>Cliente</th>
                    <th style={th}>Materiales</th>
                    <th style={th}>m³</th>
                    <th style={th}>Total</th>
                    <th style={th}>Saldo</th>
                    <th style={th}>Registrado por</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map((m) => {
                    const saldo      = Number(m.monto_total) - Number(m.monto_recibido);
                    const tieneSaldo = saldo > 0;
                    const abierto    = expandido === m.id;

                    return (
                      <React.Fragment key={m.id}>
                        <tr style={{ borderBottom: '1px solid #f3f4f6', background: tieneSaldo ? '#fff9f9' : '#fff' }}>

                          {/* Cliente */}
                          <td style={td}>
                            <strong style={{ color: '#111827' }}>{m.cliente_nombre}</strong><br />
                            <small style={{ color: '#9ca3af' }}>
                              {new Date(m.creado_en).toLocaleDateString('es-PE')}
                              {' · '}
                              {new Date(m.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </td>

                          {/* Materiales — botón expandir */}
                          <td style={td}>
                            <button
                              onClick={() => toggleDetalle(m.id)}
                              style={btnDetalleStyle}
                              title="Ver detalle de materiales"
                            >
                              🪨 {m.material_tipo || '—'}
                              <span style={{ marginLeft: '6px', fontSize: '10px' }}>{abierto ? '▲' : '▼'}</span>
                            </button>
                          </td>

                          {/* m³ */}
                          <td style={{ ...td, textAlign: 'center' }}>
                            {Number(m.cantidad_cubos).toFixed(1)}
                          </td>

                          {/* Total */}
                          <td style={td}>S/ {Number(m.monto_total).toFixed(2)}</td>

                          {/* Saldo */}
                          <td style={{ ...td, fontWeight: 'bold', color: tieneSaldo ? '#dc2626' : '#059669' }}>
                            {tieneSaldo ? `S/ ${saldo.toFixed(2)}` : '✅ PAGADO'}
                          </td>

                          {/* Usuario que registró */}
                          <td style={td}>
                            <span style={usuarioBadgeStyle}>
                              {m.usuario_email || '—'}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td style={td}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {tieneSaldo && (
                                <button onClick={() => marcarComoPagado(m.id, m.monto_total)} style={btnCobrar}>
                                  ✅ Cobrar
                                </button>
                              )}
                              <button onClick={() => eliminarRegistro(m.id)} style={btnEliminar}>🗑️</button>
                            </div>
                          </td>
                        </tr>

                        {/* Fila expandida con detalle de materiales */}
                        {abierto && (
                          <tr style={{ background: '#f9fafb' }}>
                            <td colSpan={7} style={{ padding: '0 15px 15px' }}>
                              <div style={detalleBoxStyle}>
                                <strong style={{ fontSize: '13px', color: '#065f46', display: 'block', marginBottom: '8px' }}>
                                  📦 Detalle de materiales despachados
                                </strong>
                                {!detalles[m.id] ? (
                                  <div style={{ color: '#9ca3af', fontSize: '13px' }}>Cargando...</div>
                                ) : detalles[m.id].length === 0 ? (
                                  <div style={{ color: '#9ca3af', fontSize: '13px' }}>Sin detalle registrado</div>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <th style={thSmall}>Material</th>
                                        <th style={{ ...thSmall, textAlign: 'center' }}>Cantidad</th>
                                        <th style={{ ...thSmall, textAlign: 'right' }}>Precio x m³</th>
                                        <th style={{ ...thSmall, textAlign: 'right' }}>Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detalles[m.id].map(d => (
                                        <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                          <td style={tdSmall}>🪨 {d.material_tipo}</td>
                                          <td style={{ ...tdSmall, textAlign: 'center' }}>{Number(d.cantidad).toFixed(1)} m³</td>
                                          <td style={{ ...tdSmall, textAlign: 'right' }}>S/ {Number(d.precio_unitario).toFixed(2)}</td>
                                          <td style={{ ...tdSmall, textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                                            S/ {Number(d.subtotal).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr>
                                        <td colSpan={3} style={{ ...tdSmall, textAlign: 'right', fontWeight: '700', paddingTop: '8px' }}>
                                          Total:
                                        </td>
                                        <td style={{ ...tdSmall, textAlign: 'right', fontWeight: '700', color: '#065f46', paddingTop: '8px' }}>
                                          S/ {Number(m.monto_total).toFixed(2)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                )}
                                {m.gasto_combustible > 0 && (
                                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                                    ⛽ Gasto combustible: S/ {Number(m.gasto_combustible).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={paginacionStyle}>
              <button
                onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                disabled={paginaSegura === 1}
                style={{ ...btnPagStyle, opacity: paginaSegura === 1 ? 0.4 : 1 }}
              >
                ← Anterior
              </button>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...'
                      ? <span key={`e${idx}`} style={{ color: '#9ca3af', padding: '0 4px' }}>…</span>
                      : <button
                          key={item}
                          onClick={() => setPaginaActual(item)}
                          style={{
                            ...btnPagStyle,
                            background: item === paginaSegura ? '#059669' : '#f3f4f6',
                            color:      item === paginaSegura ? '#fff' : '#374151',
                            fontWeight: item === paginaSegura ? '700' : '400',
                            minWidth: '36px',
                          }}
                        >
                          {item}
                        </button>
                  )}
              </div>

              <button
                onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura === totalPaginas}
                style={{ ...btnPagStyle, opacity: paginaSegura === totalPaginas ? 0.4 : 1 }}
              >
                Siguiente →
              </button>
            </div>
          )}

          {lista.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af', marginTop: '12px' }}>
              Mostrando {inicio + 1}–{Math.min(inicio + ITEMS_POR_PAGINA, lista.length)} de {lista.length} registros
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Nuevos Estilos del Menú Navegación Interna ───────────────────────────────
const menuTabsStyle = {
  display: 'flex', gap: '10px', marginBottom: '22px', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px'
};
const tabInactivoStyle = {
  padding: '10px 16px', background: '#f9fafb', color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
};
const tabActivoStyle = {
  padding: '10px 16px', background: '#065f46', color: '#ffffff', border: '1px solid #065f46', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(6,95,70,0.15)'
};

// ── Tus Estilos Originales ───────────────────────────────────────────────────
const wrapStyle           = { maxWidth: '1100px', margin: 'auto', padding: '20px', fontFamily: 'system-ui, sans-serif' };
const gridStyle           = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' };
const cardStyle           = { padding: '20px', borderRadius: '12px' };
const inputBusqueda       = { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' };
const btnRefresh          = { padding: '10px 20px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };
const tableStyle          = { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' };
const th                  = { padding: '12px 15px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
const td                  = { padding: '14px 15px', textAlign: 'left', fontSize: '14px', verticalAlign: 'middle' };
const thSmall             = { padding: '6px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' };
const tdSmall             = { padding: '6px 8px', fontSize: '13px', verticalAlign: 'middle' };
const btnCobrar           = { backgroundColor: '#059669', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };
const btnEliminar         = { backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const btnDetalleStyle     = { background: '#f3f4f6', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', color: '#374151', fontWeight: '600', whiteSpace: 'nowrap' };
const detalleBoxStyle     = { background: '#fff', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb', marginTop: '4px' };
const usuarioBadgeStyle   = { display: 'inline-block', background: '#ede9fe', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: '#5b21b6', fontWeight: '600', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const bannerDeudoresStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: '#991b1b', fontWeight: '600' };
const btnClearStyle       = { background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#dc2626', fontSize: '13px' };
const emptyStyle          = { textAlign: 'center', padding: '40px', color: '#6b7280', background: '#f9fafb', borderRadius: '10px', fontSize: '15px' };
const paginacionStyle     = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' };
const btnPagStyle         = { padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#374151', fontSize: '14px' };

export default DashboardAdmin;