import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import Reportes from './Reportes';

const ITEMS_POR_PAGINA = 10;

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

const DashboardAdmin = ({ usuario }) => {
  const esMobile = useEsMobile();

  const [vistaActiva, setVistaActiva]         = useState('dashboard');
  const [movimientos, setMovimientos]         = useState([]);
  const [choferes, setChoferes]               = useState([]);
  const [busqueda, setBusqueda]               = useState('');
  const [loading, setLoading]                 = useState(true);
  const [loadingChoferes, setLoadingChoferes] = useState(false);
  const [paginaActual, setPaginaActual]       = useState(1);
  const [vistaDeudores, setVistaDeudores]     = useState(false);
  const [expandido, setExpandido]             = useState(null);
  const [detalles, setDetalles]               = useState({});
  const [datosChoferes, setDatosChoferes]     = useState([]);
  const [confirmando, setConfirmando]         = useState(null);

  const fetchMovimientos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .order('creado_en', { ascending: false });
    if (!error) setMovimientos(data || []);
    setLoading(false);
  };

  const fetchChoferes = useCallback(async () => {
    setLoadingChoferes(true);
    const { data: choferesData } = await supabase
      .from('choferes')
      .select('id, nombre, usuario')
      .eq('activo', true);

    if (!choferesData || choferesData.length === 0) {
      setDatosChoferes([]);
      setLoadingChoferes(false);
      return;
    }
    setChoferes(choferesData);

    const hoy       = new Date();
    const hoyLocal  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diaSemana = hoyLocal.getDay();
    const diff      = hoyLocal.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const inicioSemana = new Date(hoyLocal);
    inicioSemana.setDate(diff);
    const semanaISO = new Date(inicioSemana.getTime() + 5 * 60 * 60 * 1000).toISOString();

    const resultados = await Promise.all(
      choferesData.map(async (chofer) => {
        const [{ data: movs }, { data: gsts }] = await Promise.all([
          supabase
            .from('movimientos')
            .select('id, cliente_nombre, monto_total, monto_recibido, estado_pago, cantidad_cubos, creado_en')
            .eq('usuario_id', chofer.id)
            .gte('creado_en', semanaISO),
          supabase
            .from('gastos_chofer')
            .select('id, descripcion, monto')
            .eq('usuario_id', chofer.id)
            .gte('creado_en', semanaISO),
        ]);

        const movsSemana   = movs || [];
        const gstsSemana   = gsts || [];
        const totalCobrado = movsSemana.reduce((a, m) => a + (parseFloat(m.monto_recibido) || 0), 0);
        const totalGastos  = gstsSemana.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);
        const totalM3      = movsSemana.reduce((a, m) => a + (parseFloat(m.cantidad_cubos) || 0), 0);
        const pendientes   = movsSemana.filter(m => m.estado_pago === 'Fiado' || m.estado_pago === 'Adelanto');

        return {
          ...chofer,
          viajes: movsSemana.length,
          totalM3,
          totalCobrado,
          totalGastos,
          netoEntregar: totalCobrado - totalGastos,
          pendientes,
          gastos: gstsSemana,
        };
      })
    );

    setDatosChoferes(resultados);
    setLoadingChoferes(false);
  }, []);

  useEffect(() => { 
  fetchMovimientos(); 
  // Cargar choferes al inicio para mostrar nombres en el panel
  supabase
    .from('choferes')
    .select('id, nombre, usuario')
    .eq('activo', true)
    .then(({ data }) => { if (data) setChoferes(data); });
}, []);
  useEffect(() => { if (vistaActiva === 'choferes') fetchChoferes(); }, [vistaActiva, fetchChoferes]);

  const confirmarPagoAdmin = async (mov) => {
    setConfirmando(mov.id);
    const { error } = await supabase
      .from('movimientos')
      .update({ monto_recibido: mov.monto_total, estado_pago: 'Pagado' })
      .eq('id', mov.id);
    if (error) alert('Error: ' + error.message);
    else await fetchChoferes();
    setConfirmando(null);
  };

  const toggleDetalle = async (id) => {
    if (expandido === id) { setExpandido(null); return; }
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
    if (!window.confirm('¿Eliminar este registro?')) return;
    const { error } = await supabase.from('movimientos').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar');
    } else {
      fetchMovimientos();
      setDetalles(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (expandido === id) setExpandido(null);
    }
  };

  const nombreChofer = (usuario_id) => {
    const c = choferes.find(c => c.id === usuario_id);
    return c ? c.nombre : '—';
  };

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const totalCaja     = movimientos.reduce((acc, m) => acc + (Number(m.monto_recibido) || 0), 0);
  const totalDeuda    = movimientos.reduce((acc, m) => acc + Math.max(0, Number(m.monto_total) - Number(m.monto_recibido)), 0);
  const totalDeudores = movimientos.filter(m => (Number(m.monto_total) - Number(m.monto_recibido)) > 0).length;

  let lista = movimientos.filter(m =>
    m.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  if (vistaDeudores) lista = lista.filter(m => (Number(m.monto_total) - Number(m.monto_recibido)) > 0);

  const totalPaginas = Math.max(1, Math.ceil(lista.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicio       = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const paginados    = lista.slice(inicio, inicio + ITEMS_POR_PAGINA);

  const cambiarBusqueda = (v) => { setBusqueda(v); setPaginaActual(1); };
  const toggleDeudores  = ()  => { setVistaDeudores(v => !v); setPaginaActual(1); };

  // ── Tarjeta móvil ─────────────────────────────────────────────
  const TarjetaMovil = ({ m }) => {
    const saldo      = Number(m.monto_total) - Number(m.monto_recibido);
    const tieneSaldo = saldo > 0;
    const abierto    = expandido === m.id;

    return (
      <div style={{ ...tarjetaMovilStyle, borderLeft: tieneSaldo ? '4px solid #dc2626' : '4px solid #059669' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div style={{ flex: 1, paddingRight: '10px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>{m.cliente_nombre}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{formatFecha(m.creado_en)}</div>
            <div style={{ marginTop: '4px' }}>
              <span style={usuarioBadgeStyle}>{nombreChofer(m.usuario_id)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: tieneSaldo ? '#dc2626' : '#059669' }}>
              {tieneSaldo ? `Debe S/ ${saldo.toFixed(2)}` : '✅ PAGADO'}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Total: S/ {Number(m.monto_total).toFixed(2)}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{Number(m.cantidad_cubos).toFixed(1)} m³</div>
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={chipStyle}>🪨 {m.material_tipo || '—'}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => toggleDetalle(m.id)} style={btnDetalleStyle}>
            {abierto ? '▲ Ocultar' : '▼ Ver detalle'}
          </button>
          {tieneSaldo && (
            <button onClick={() => marcarComoPagado(m.id, m.monto_total)} style={btnCobrar}>✅ Cobrar</button>
          )}
          <button onClick={() => eliminarRegistro(m.id)} style={btnEliminar}>🗑️</button>
        </div>

        {abierto && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
            {!detalles[m.id] ? (
              <div style={{ color: '#9ca3af', fontSize: '13px' }}>Cargando...</div>
            ) : detalles[m.id].length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '13px' }}>Sin detalle registrado</div>
            ) : (
              detalles[m.id].map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#374151' }}>🪨 {d.material_tipo} · {Number(d.cantidad).toFixed(1)} m³</span>
                  <span style={{ fontWeight: '600', color: '#059669', marginLeft: '8px', flexShrink: 0 }}>
                    S/ {Number(d.subtotal).toFixed(2)}
                  </span>
                </div>
              ))
            )}
            {m.gasto_combustible > 0 && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                ⛽ Combustible: S/ {Number(m.gasto_combustible).toFixed(2)}
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: '8px', fontWeight: '700', color: '#065f46', fontSize: '14px' }}>
              Total: S/ {Number(m.monto_total).toFixed(2)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={wrapStyle}>

      {/* Pestañas */}
      <div style={menuTabsStyle}>
        {[['dashboard', '🎛️ Panel'], ['choferes', '👥 Choferes'], ['reportes', '📊 Reportes']].map(([id, label]) => (
          <button key={id} onClick={() => setVistaActiva(id)} style={vistaActiva === id ? tabActivoStyle : tabInactivoStyle}>
            {label}
          </button>
        ))}
      </div>

      {/* Reportes */}
      {vistaActiva === 'reportes' && <Reportes />}

      {/* Choferes */}
      {vistaActiva === 'choferes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '18px' }}>👥 Rendición Semanal por Chofer</h2>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Esta semana (lunes — hoy)</div>
            </div>
            <button onClick={fetchChoferes} style={btnRefresh}>↻ Actualizar</button>
          </div>

          {loadingChoferes ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Cargando choferes...</div>
          ) : datosChoferes.length === 0 ? (
            <div style={emptyStyle}>No hay choferes activos registrados.</div>
          ) : datosChoferes.map(chofer => (
            <div key={chofer.id} style={cardChoferStyle}>
              <div style={{ ...cabChoferStyle, flexWrap: esMobile ? 'wrap' : 'nowrap' }}>
                <div style={avatarStyle}>{chofer.nombre.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{chofer.nombre}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{chofer.usuario}</div>
                </div>
                <div style={{
                  ...badgeNetoStyle,
                  backgroundColor: chofer.netoEntregar >= 0 ? '#f0fdf4' : '#fef2f2',
                  borderColor:     chofer.netoEntregar >= 0 ? '#a7f3d0' : '#fecaca',
                  color:           chofer.netoEntregar >= 0 ? '#065f46' : '#dc2626',
                  width:           esMobile ? '100%' : 'auto',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '500' }}>Neto a entregar</div>
                  <div style={{ fontSize: '20px', fontWeight: '800' }}>S/ {chofer.netoEntregar.toFixed(2)}</div>
                </div>
              </div>

              {/* KPIs: 2 columnas en móvil, 4 en desktop */}
              <div style={{ display: 'grid', gridTemplateColumns: esMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  ['Viajes', chofer.viajes, '#111827'],
                  ['Volumen m³', chofer.totalM3.toFixed(1), '#111827'],
                  ['Cobrado', `S/ ${chofer.totalCobrado.toFixed(2)}`, '#059669'],
                  ['Gastos extra', `S/ ${chofer.totalGastos.toFixed(2)}`, '#dc2626'],
                ].map(([label, val, color]) => (
                  <div key={label} style={kpiStyle}>
                    <span style={kpiLabelStyle}>{label}</span>
                    <strong style={{ fontSize: '18px', color }}>{val}</strong>
                  </div>
                ))}
              </div>

              {chofer.pendientes.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={subtituloStyle}>⚠️ Clientes con saldo pendiente ({chofer.pendientes.length})</div>
                  {chofer.pendientes.map(mov => {
                    const saldo = (parseFloat(mov.monto_total) || 0) - (parseFloat(mov.monto_recibido) || 0);
                    return (
                      <div key={mov.id} style={filaPendienteStyle}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827' }}>{mov.cliente_nombre}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{formatFecha(mov.creado_en)}</div>
                          <div style={{ marginTop: '3px' }}>
                            <span style={badgeEstadoStyle(mov.estado_pago)}>{mov.estado_pago}</span>
                            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700', marginLeft: '8px' }}>
                              Debe: S/ {saldo.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => confirmarPagoAdmin(mov)} disabled={confirmando === mov.id} style={btnConfirmarStyle}>
                          {confirmando === mov.id ? '...' : '✅ Pagó'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {chofer.gastos.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={subtituloStyle}>🧾 Gastos extra registrados</div>
                  {chofer.gastos.map(g => (
                    <div key={g.id} style={filaGastoStyle}>
                      <span style={{ fontSize: '13px', color: '#374151' }}>{g.descripcion}</span>
                      <strong style={{ fontSize: '13px', color: '#dc2626', flexShrink: 0, marginLeft: '8px' }}>
                        S/ {parseFloat(g.monto).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              {chofer.viajes === 0 && chofer.pendientes.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '12px 0', marginTop: '8px' }}>
                  Sin actividad esta semana
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dashboard */}
      {vistaActiva === 'dashboard' && (
        <>
          <div style={gridStyle}>
            <div style={{ ...cardStyle, borderLeft: '5px solid #059669', background: '#ecfdf5' }}>
              <small style={{ color: '#065f46', fontWeight: 600 }}>💰 Dinero en Mano</small>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#065f46', margin: '4px 0' }}>S/ {totalCaja.toFixed(2)}</div>
              <small style={{ color: '#6b7280' }}>Total cobrado</small>
            </div>
            <div onClick={toggleDeudores} style={{ ...cardStyle, borderLeft: '5px solid #dc2626', background: vistaDeudores ? '#fca5a5' : '#fef2f2', cursor: 'pointer', outline: vistaDeudores ? '2px solid #dc2626' : 'none' }}>
              <small style={{ color: '#991b1b', fontWeight: 600 }}>
                {vistaDeudores ? '👁️ Viendo deudores — clic para volver' : '⚠️ Total por Cobrar'}
              </small>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#991b1b', margin: '4px 0' }}>S/ {totalDeuda.toFixed(2)}</div>
              <small style={{ color: '#6b7280' }}>{totalDeudores} {totalDeudores === 1 ? 'persona debe' : 'personas deben'}</small>
            </div>
          </div>

          {vistaDeudores && (
            <div style={bannerDeudoresStyle}>
              🔴 Solo deudores — {totalDeudores} {totalDeudores === 1 ? 'deudor' : 'deudores'}
              <button onClick={toggleDeudores} style={btnClearStyle}>✕ Quitar</button>
            </div>
          )}

          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="🔍 Buscar cliente..." style={inputBusqueda} value={busqueda} onChange={(e) => cambiarBusqueda(e.target.value)} />
            <button onClick={fetchMovimientos} style={btnRefresh}>↻</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Cargando...</div>
          ) : lista.length === 0 ? (
            <div style={emptyStyle}>{vistaDeudores ? '🎉 ¡Sin deudas pendientes!' : 'No se encontraron registros.'}</div>
          ) : esMobile ? (
            // Vista móvil: tarjetas
            <div>{paginados.map(m => <TarjetaMovil key={m.id} m={m} />)}</div>
          ) : (
            // Vista desktop: tabla
            <div style={{ overflowX: 'auto', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}>
              <table style={tableStyle}>
                <thead style={{ backgroundColor: '#f3f4f6' }}>
                  <tr>{['Cliente', 'Materiales', 'm³', 'Total', 'Saldo', 'Chofer', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {paginados.map((m) => {
                    const saldo = Number(m.monto_total) - Number(m.monto_recibido);
                    const tieneSaldo = saldo > 0;
                    const abierto = expandido === m.id;
                    return (
                      <React.Fragment key={m.id}>
                        <tr style={{ borderBottom: '1px solid #f3f4f6', background: tieneSaldo ? '#fff9f9' : '#fff' }}>
                          <td style={td}>
                            <strong style={{ color: '#111827' }}>{m.cliente_nombre}</strong><br />
                            <small style={{ color: '#9ca3af' }}>{new Date(m.creado_en).toLocaleDateString('es-PE')} · {new Date(m.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</small>
                          </td>
                          <td style={td}>
                            <button onClick={() => toggleDetalle(m.id)} style={btnDetalleStyle}>
                              🪨 {m.material_tipo || '—'} <span style={{ fontSize: '10px' }}>{abierto ? '▲' : '▼'}</span>
                            </button>
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>{Number(m.cantidad_cubos).toFixed(1)}</td>
                          <td style={td}>S/ {Number(m.monto_total).toFixed(2)}</td>
                          <td style={{ ...td, fontWeight: 'bold', color: tieneSaldo ? '#dc2626' : '#059669' }}>
                            {tieneSaldo ? `S/ ${saldo.toFixed(2)}` : '✅ PAGADO'}
                          </td>
                          <td style={td}><span style={usuarioBadgeStyle}>{nombreChofer(m.usuario_id)}</span></td>
                          <td style={td}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {tieneSaldo && <button onClick={() => marcarComoPagado(m.id, m.monto_total)} style={btnCobrar}>✅ Cobrar</button>}
                              <button onClick={() => eliminarRegistro(m.id)} style={btnEliminar}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                        {abierto && (
                          <tr style={{ background: '#f9fafb' }}>
                            <td colSpan={7} style={{ padding: '0 15px 15px' }}>
                              <div style={detalleBoxStyle}>
                                <strong style={{ fontSize: '13px', color: '#065f46', display: 'block', marginBottom: '8px' }}>📦 Detalle de materiales</strong>
                                {!detalles[m.id] ? <div style={{ color: '#9ca3af' }}>Cargando...</div>
                                  : detalles[m.id].length === 0 ? <div style={{ color: '#9ca3af' }}>Sin detalle</div>
                                  : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                      <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <th style={thSmall}>Material</th>
                                        <th style={{ ...thSmall, textAlign: 'center' }}>Cantidad</th>
                                        <th style={{ ...thSmall, textAlign: 'right' }}>Precio x m³</th>
                                        <th style={{ ...thSmall, textAlign: 'right' }}>Subtotal</th>
                                      </tr></thead>
                                      <tbody>
                                        {detalles[m.id].map(d => (
                                          <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={tdSmall}>🪨 {d.material_tipo}</td>
                                            <td style={{ ...tdSmall, textAlign: 'center' }}>{Number(d.cantidad).toFixed(1)} m³</td>
                                            <td style={{ ...tdSmall, textAlign: 'right' }}>S/ {Number(d.precio_unitario).toFixed(2)}</td>
                                            <td style={{ ...tdSmall, textAlign: 'right', fontWeight: '600', color: '#059669' }}>S/ {Number(d.subtotal).toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot><tr>
                                        <td colSpan={3} style={{ ...tdSmall, textAlign: 'right', fontWeight: '700', paddingTop: '8px' }}>Total:</td>
                                        <td style={{ ...tdSmall, textAlign: 'right', fontWeight: '700', color: '#065f46', paddingTop: '8px' }}>S/ {Number(m.monto_total).toFixed(2)}</td>
                                      </tr></tfoot>
                                    </table>
                                  )}
                                {m.gasto_combustible > 0 && <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>⛽ Combustible: S/ {Number(m.gasto_combustible).toFixed(2)}</div>}
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

          {totalPaginas > 1 && (
            <div style={paginacionStyle}>
              <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaSegura === 1} style={{ ...btnPagStyle, opacity: paginaSegura === 1 ? 0.4 : 1 }}>← Ant</button>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1)
                  .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
                  .map((item, idx) => item === '...'
                    ? <span key={`e${idx}`} style={{ color: '#9ca3af' }}>…</span>
                    : <button key={item} onClick={() => setPaginaActual(item)} style={{ ...btnPagStyle, background: item === paginaSegura ? '#059669' : '#f3f4f6', color: item === paginaSegura ? '#fff' : '#374151', fontWeight: item === paginaSegura ? '700' : '400', minWidth: '36px' }}>{item}</button>
                  )}
              </div>
              <button onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas} style={{ ...btnPagStyle, opacity: paginaSegura === totalPaginas ? 0.4 : 1 }}>Sig →</button>
            </div>
          )}
          {lista.length > 0 && <div style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af', marginTop: '12px' }}>Mostrando {inicio + 1}–{Math.min(inicio + ITEMS_POR_PAGINA, lista.length)} de {lista.length} registros</div>}
        </>
      )}
    </div>
  );
};

// ── Estilos ────────────────────────────────────────────────────
const menuTabsStyle      = { display: 'flex', gap: '8px', marginBottom: '22px', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px', flexWrap: 'wrap' };
const tabInactivoStyle   = { padding: '9px 14px', background: '#f9fafb', color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' };
const tabActivoStyle     = { padding: '9px 14px', background: '#065f46', color: '#ffffff', border: '1px solid #065f46', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(6,95,70,0.15)' };
const wrapStyle          = { maxWidth: '1100px', margin: 'auto', padding: '16px', fontFamily: 'system-ui, sans-serif' };
const gridStyle          = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' };
const cardStyle          = { padding: '20px', borderRadius: '12px' };
const inputBusqueda      = { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' };
const btnRefresh         = { padding: '10px 16px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };
const tableStyle         = { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' };
const th                 = { padding: '12px 15px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
const td                 = { padding: '14px 15px', textAlign: 'left', fontSize: '14px', verticalAlign: 'middle' };
const thSmall            = { padding: '6px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' };
const tdSmall            = { padding: '6px 8px', fontSize: '13px', verticalAlign: 'middle' };
const btnCobrar          = { backgroundColor: '#059669', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };
const btnEliminar        = { backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const btnDetalleStyle    = { background: '#f3f4f6', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#374151', fontWeight: '600', whiteSpace: 'nowrap' };
const detalleBoxStyle    = { background: '#fff', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb', marginTop: '4px' };
const usuarioBadgeStyle  = { display: 'inline-block', background: '#ede9fe', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: '#5b21b6', fontWeight: '600', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const bannerDeudoresStyle= { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: '#991b1b', fontWeight: '600', flexWrap: 'wrap', gap: '8px' };
const btnClearStyle      = { background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#dc2626', fontSize: '13px' };
const emptyStyle         = { textAlign: 'center', padding: '40px', color: '#6b7280', background: '#f9fafb', borderRadius: '10px', fontSize: '15px' };
const paginacionStyle    = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' };
const btnPagStyle        = { padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#374151', fontSize: '14px' };
const tarjetaMovilStyle  = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' };
const chipStyle          = { display: 'inline-block', background: '#f3f4f6', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', color: '#374151' };
const cardChoferStyle    = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' };
const cabChoferStyle     = { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' };
const avatarStyle        = { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#065f46', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', flexShrink: 0 };
const badgeNetoStyle     = { padding: '10px 16px', borderRadius: '12px', border: '1px solid', textAlign: 'center', minWidth: '130px' };
const kpiStyle           = { backgroundColor: '#f9fafb', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '4px' };
const kpiLabelStyle      = { fontSize: '11px', color: '#6b7280' };
const subtituloStyle     = { fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px' };
const filaPendienteStyle = { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: '#fffbeb', borderRadius: '8px', marginBottom: '8px', border: '1px solid #fef3c7', flexWrap: 'wrap' };
const badgeEstadoStyle   = (estado) => ({ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', backgroundColor: estado === 'Fiado' ? '#fee2e2' : '#fef3c7', color: estado === 'Fiado' ? '#b91c1c' : '#92400e' });
const btnConfirmarStyle  = { backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' };
const filaGastoStyle     = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' };

export default DashboardAdmin;