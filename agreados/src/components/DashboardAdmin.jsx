import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ITEMS_POR_PAGINA = 10;

const DashboardAdmin = () => {
  const [movimientos, setMovimientos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [paginaActual, setPaginaActual] = useState(1);
  const [vistaDeudores, setVistaDeudores] = useState(false);

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
      else fetchMovimientos();
    }
  };

  // ── Cálculos globales ──────────────────────────────────────────
  const totalCaja  = movimientos.reduce((acc, m) => acc + (Number(m.monto_recibido) || 0), 0);
  const totalDeuda = movimientos.reduce((acc, m) => acc + Math.max(0, Number(m.monto_total) - Number(m.monto_recibido)), 0);
  const totalDeudores = movimientos.filter(m => (Number(m.monto_total) - Number(m.monto_recibido)) > 0).length;

  // ── Filtrado ───────────────────────────────────────────────────
  let lista = movimientos.filter(m =>
    m.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  if (vistaDeudores) {
    lista = lista.filter(m => (Number(m.monto_total) - Number(m.monto_recibido)) > 0);
  }

  // ── Paginación ─────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(lista.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicio = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const paginados = lista.slice(inicio, inicio + ITEMS_POR_PAGINA);

  // Al cambiar búsqueda o vista, volver a página 1
  const cambiarBusqueda = (v) => { setBusqueda(v); setPaginaActual(1); };
  const toggleDeudores  = () => { setVistaDeudores(v => !v); setPaginaActual(1); };

  return (
    <div style={wrapStyle}>
      <h2 style={{ color: '#111827', marginBottom: '20px' }}>📊 Control de Administración</h2>

      {/* ── TARJETAS ── */}
      <div style={gridStyle}>

        {/* Dinero en mano */}
        <div style={{ ...cardStyle, borderLeft: '5px solid #059669', background: '#ecfdf5' }}>
          <small style={{ color: '#065f46', fontWeight: 600 }}>💰 Dinero en Mano</small>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#065f46', margin: '4px 0' }}>
            S/ {totalCaja.toFixed(2)}
          </div>
          <small style={{ color: '#6b7280' }}>Total cobrado</small>
        </div>

        {/* Total por cobrar — clickeable para filtrar deudores */}
        <div
          onClick={toggleDeudores}
          style={{
            ...cardStyle,
            borderLeft: '5px solid #dc2626',
            background: vistaDeudores ? '#fca5a5' : '#fef2f2',
            cursor: 'pointer',
            transition: 'background 0.2s',
            outline: vistaDeudores ? '2px solid #dc2626' : 'none',
          }}
          title="Haz clic para ver quiénes deben"
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

      {/* ── BANNER deudores activo ── */}
      {vistaDeudores && (
        <div style={bannerDeudoresStyle}>
          🔴 Mostrando solo clientes con saldo pendiente — {totalDeudores} {totalDeudores === 1 ? 'deudor' : 'deudores'}
          <button onClick={toggleDeudores} style={btnClearStyle}>✕ Quitar filtro</button>
        </div>
      )}

      {/* ── BUSCADOR ── */}
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

      {/* ── TABLA ── */}
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
                <th style={th}>Material</th>
                <th style={th}>m³</th>
                <th style={th}>Total</th>
                <th style={th}>Saldo</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((m) => {
                const saldo = Number(m.monto_total) - Number(m.monto_recibido);
                const tieneSaldo = saldo > 0;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6', background: tieneSaldo ? '#fff9f9' : '#fff' }}>
                    <td style={td}>
                      <strong style={{ color: '#111827' }}>{m.cliente_nombre}</strong><br />
                      <small style={{ color: '#9ca3af' }}>
                        {new Date(m.creado_en).toLocaleDateString('es-PE')}
                        {' · '}
                        {new Date(m.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </td>
                    <td style={td}>
                      <span style={materialBadgeStyle}>
                        🪨 {m.material_tipo || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {Number(m.cantidad_cubos).toFixed(1)}
                    </td>
                    <td style={td}>S/ {Number(m.monto_total).toFixed(2)}</td>
                    <td style={{ ...td, fontWeight: 'bold', color: tieneSaldo ? '#dc2626' : '#059669' }}>
                      {tieneSaldo ? `S/ ${saldo.toFixed(2)}` : '✅ PAGADO'}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAGINACIÓN ── */}
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
                        color:      item === paginaSegura ? '#fff'    : '#374151',
                        fontWeight: item === paginaSegura ? '700'     : '400',
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

      {/* ── PIE: resumen de página ── */}
      {lista.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af', marginTop: '12px' }}>
          Mostrando {inicio + 1}–{Math.min(inicio + ITEMS_POR_PAGINA, lista.length)} de {lista.length} registros
        </div>
      )}
    </div>
  );
};

// ── Estilos ────────────────────────────────────────────────────────────────
const wrapStyle         = { maxWidth: '1000px', margin: 'auto', padding: '20px', fontFamily: 'system-ui, sans-serif' };
const gridStyle         = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' };
const cardStyle         = { padding: '20px', borderRadius: '12px' };
const inputBusqueda     = { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' };
const btnRefresh        = { padding: '10px 20px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };
const tableStyle        = { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' };
const th                = { padding: '12px 15px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
const td                = { padding: '14px 15px', textAlign: 'left', fontSize: '14px', verticalAlign: 'middle' };
const btnCobrar         = { backgroundColor: '#059669', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };
const btnEliminar       = { backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const bannerDeudoresStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: '#991b1b', fontWeight: '600' };
const btnClearStyle     = { background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#dc2626', fontSize: '13px' };
const emptyStyle        = { textAlign: 'center', padding: '40px', color: '#6b7280', background: '#f9fafb', borderRadius: '10px', fontSize: '15px' };
const materialBadgeStyle = { display: 'inline-block', background: '#f3f4f6', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: '#374151' };
const paginacionStyle   = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' };
const btnPagStyle       = { padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#374151', fontSize: '14px', transition: 'all 0.15s' };

export default DashboardAdmin;