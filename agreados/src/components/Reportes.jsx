import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const Reportes = () => {
  // ── Filtros de Tiempo ───────────────────────────────────────────
  const [filtroTiempo, setFiltroTiempo] = useState('hoy'); // hoy | semana | mes | personalizado
  const [fechaInicio, setFechaInicio]   = useState('');
  const [fechaFin, setFechaFin]         = useState('');

  // ── Datos de la Base de Datos ───────────────────────────────────
  const [movimientos, setMovimientos]   = useState([]);
  const [loading, setLoading]           = useState(false);

  // ── Estados de las Sumas Dinámicas ──────────────────────────────
  const [metricas, setMetricas] = useState({
    totalFacturado: 0,
    cajaReal: 0,
    cuentasPorCobrar: 0,
    gastoCombustible: 0,
    totalViajes: 0,
    volumenTotal: 0
  });

  // ── Helper: Construcción de Fechas en Rango ISO ──────────────────
  const obtenerFechasFiltro = useCallback(() => {
    const ahora = new Date();
    let inicioISO = '';
    let finISO = ahora.toISOString();

    if (filtroTiempo === 'hoy') {
      inicioISO = ahora.toISOString().split('T')[0] + 'T00:00:00.000Z';
    } else if (filtroTiempo === 'semana') {
      const inicioSemana = new Date();
      const dia = inicioSemana.getDay();
      const diferencia = inicioSemana.getDate() - dia + (dia === 0 ? -6 : 1); // Forzar Lunes
      inicioSemana.setDate(diferencia);
      inicioISO = inicioSemana.toISOString().split('T')[0] + 'T00:00:00.000Z';
    } else if (filtroTiempo === 'mes') {
      inicioISO = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-01T00:00:00.000Z';
    } else if (filtroTiempo === 'personalizado') {
      if (fechaInicio) inicioISO = new Date(fechaInicio).toISOString().split('T')[0] + 'T00:00:00.000Z';
      if (fechaFin) finISO = new Date(fechaFin).toISOString().split('T')[0] + 'T23:59:59.999Z';
    }

    return { inicioISO, finISO };
  }, [filtroTiempo, fechaInicio, fechaFin]);

  // ── Consulta de Registros a Supabase ────────────────────────────
  const cargarReportesFinancieros = useCallback(async () => {
    setLoading(true);
    try {
      const { inicioISO, finISO } = obtenerFechasFiltro();

      let query = supabase
        .from('movimientos')
        .select('*')
        .order('creado_en', { ascending: false }); // Mostrar los últimos movimientos primero

      if (inicioISO) query = query.gte('creado_en', inicioISO);
      if (finISO)   query = query.lte('creado_en', finISO);

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setMovimientos(data);

        // Variables acumuladoras basadas en tu esquema
        let facturado = 0;
        let caja = 0;
        let porCobrar = 0;
        let combustible = 0;
        let volumen = 0;

        data.forEach(mov => {
          const total = parseFloat(mov.monto_total) || 0;
          const recibido = parseFloat(mov.monto_recibido) || 0;
          const gas = parseFloat(mov.gasto_combustible) || 0;
          const cubos = parseFloat(mov.cantidad_cubos) || 0;

          facturado += total;
          caja += recibido;
          porCobrar += (total - recibido);
          combustible += gas;
          volumen += cubos;
        });

        setMetricas({
          totalFacturado: facturado,
          cajaReal: caja,
          cuentasPorCobrar: porCobrar,
          gastoCombustible: combustible,
          totalViajes: data.length,
          volumenTotal: volumen
        });
      }
    } catch (error) {
      console.error('Error cargando reportes:', error.message);
      alert('Hubo un inconveniente al conectar con la base de datos de movimientos.');
    } finally {
      setLoading(false);
    }
  }, [obtenerFechasFiltro]);

  useEffect(() => {
    cargarReportesFinancieros();
  }, [cargarReportesFinancieros, filtroTiempo]);

  // ── Generador e Inyector del Archivo Excel ──────────────────────
  const exportarExcel = () => {
    if (movimientos.length === 0) return alert('No se encontraron registros para exportar en este rango.');

    const encabezados = [
      'Fecha y Hora',
      'Cliente',
      'Celular',
      'Materiales Despachados',
      'Volumen Total (m3)',
      'Total Venta (S/)',
      'Monto Cobrado (S/)',
      'Saldo Pendiente (S/)',
      'Estado de Pago',
      'Gasto Combustible (S/)'
    ];

    const filas = movimientos.map(mov => {
      const fechaFormateada = new Date(mov.creado_en).toLocaleString('es-PE');
      const total = parseFloat(mov.monto_total) || 0;
      const recibido = parseFloat(mov.monto_recibido) || 0;
      const pendiente = total - recibido;

      return [
        `"${fechaFormateada}"`,
        `"${mov.cliente_nombre.toUpperCase()}"`,
        `"${mov.cliente_celular || 'Sin Registro'}"`,
        `"${mov.material_tipo || 'Agregados'}"`,
        mov.cantidad_cubos,
        total.toFixed(2),
        recibido.toFixed(2),
        pendiente.toFixed(2),
        `"${mov.estado_pago}"`,
        (parseFloat(mov.gasto_combustible) || 0).toFixed(2)
      ];
    });

    // Formatear usando punto y coma (;) para garantizar celdas nativas en Excel Latinoamérica
    const contenidoCsv = [encabezados.join(';'), ...filas.map(f => f.join(';'))].join('\n');
    
    // Inyectar BOM UTF-8 para evitar caracteres extraños en los nombres de los materiales o clientes
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Cantera_${filtroTiempo}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={containerStyle}>
      {/* SECCIÓN TITULAR */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, color: '#065f46', fontSize: '22px' }}>📊 Reportes y Contabilidad de Cantera</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>Control diario y semanal de ventas para administración</p>
        </div>
        <button onClick={exportarExcel} style={btnExcelStyle}>
          🟢 Exportar a Excel
        </button>
      </div>

      {/* FILTROS INTEGRADOS */}
      <div style={filtroBoxStyle}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroTiempo('hoy')} style={filtroTiempo === 'hoy' ? btnActivo : btnInactivo}>Hoy</button>
          <button onClick={() => setFiltroTiempo('semana')} style={filtroTiempo === 'semana' ? btnActivo : btnInactivo}>Esta Semana</button>
          <button onClick={() => setFiltroTiempo('mes')} style={filtroTiempo === 'mes' ? btnActivo : btnInactivo}>Mes Actual</button>
          <button onClick={() => setFiltroTiempo('personalizado')} style={filtroTiempo === 'personalizado' ? btnActivo : btnInactivo}>Rango Personalizado 📅</button>
        </div>

        {filtroTiempo === 'personalizado' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputDateStyle} />
            <span style={{ color: '#6b7280', fontSize: '13px' }}>hasta</span>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputDateStyle} />
            <button onClick={cargarReportesFinancieros} style={btnCalcularEspecial}>Calcular</button>
          </div>
        )}
      </div>

      {/* CUADROS FINANCIEROS CLAVE (KPIs) */}
      <div style={gridStyle}>
        <div style={{ ...cardStyle, borderLeft: '5px solid #059669' }}>
          <span style={cardTituloStyle}>💰 TOTAL FACTURADO</span>
          <strong style={{ ...cardMontoStyle, color: '#065f46' }}>S/ {metricas.totalFacturado.toFixed(2)}</strong>
          <span style={cardSubtituloStyle}>Monto bruto total vendido</span>
        </div>

        <div style={{ ...cardStyle, borderLeft: '5px solid #2563eb' }}>
          <span style={cardTituloStyle}>💵 CAJA REAL (INGRESOS)</span>
          <strong style={{ ...cardMontoStyle, color: '#1d4ed8' }}>S/ {metricas.cajaReal.toFixed(2)}</strong>
          <span style={cardSubtituloStyle}>Efectivo real en manos de caja</span>
        </div>

        <div style={{ ...cardStyle, borderLeft: '5px solid #dc2626' }}>
          <span style={cardTituloStyle}>⚠️ CUENTAS POR COBRAR</span>
          <strong style={{ ...cardMontoStyle, color: '#b91c1c' }}>S/ {metricas.cuentasPorCobrar.toFixed(2)}</strong>
          <span style={cardSubtituloStyle}>Saldos pendientes / Fiados</span>
        </div>

        <div style={{ ...cardStyle, borderLeft: '5px solid #d97706' }}>
          <span style={cardTituloStyle}>⛽ GASTOS DE RUTA</span>
          <strong style={{ ...cardMontoStyle, color: '#b45309' }}>S/ {metricas.gastoCombustible.toFixed(2)}</strong>
          <span style={cardSubtituloStyle}>Combustible reportado por chofer</span>
        </div>
      </div>

      {/* METRICAS DE RESUMEN LOGÍSTICO */}
      <div style={bannerLogisticaStyle}>
        <span>🔊 Se registraron <strong>{metricas.totalViajes} despachos</strong> con un volumen movilizado de <strong>{metricas.volumenTotal.toFixed(1)} m³</strong> de agregados en este lapso.</span>
      </div>

      {/* TABLA HISTÓRICA */}
      <div style={tablaCardStyle}>
        <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>📋 Listado y Detalle de Despachos</h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '25px', color: '#6b7280' }}>Sincronizando con Supabase...</div>
        ) : movimientos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
            No se registran movimientos para el filtro seleccionado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={mainTablaStyle}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={thStyle}>Fecha / Hora</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Agregado</th>
                  <th style={thStyle}>Cant (m³)</th>
                  <th style={thStyle}>Venta</th>
                  <th style={thStyle}>Cobrado</th>
                  <th style={thStyle}>Pendiente</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(mov => {
                  const vTotal = parseFloat(mov.monto_total) || 0;
                  const vRecibido = parseFloat(mov.monto_recibido) || 0;
                  const vPendiente = vTotal - vRecibido;

                  return (
                    <tr key={mov.id} style={trStyle}>
                      <td style={tdStyle}>{new Date(mov.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                      <td style={{ ...tdStyle, fontWeight: '600' }}>{mov.cliente_nombre.toUpperCase()}</td>
                      <td style={tdStyle}>{mov.material_tipo || 'Varios'}</td>
                      <td style={tdStyle}>{parseFloat(mov.cantidad_cubos).toFixed(1)} m³</td>
                      <td style={tdStyle}>S/ {vTotal.toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: '#047857' }}>S/ {vRecibido.toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: vPendiente > 0 ? '#b91c1c' : '#374151', fontWeight: vPendiente > 0 ? '600' : 'normal' }}>
                        {vPendiente > 0 ? `S/ ${vPendiente.toFixed(2)}` : 'S/ 0.00'}
                      </td>
                      <td style={tdStyle}>
                        <span style={obtenerEstiloCondicion(mov.estado_pago)}>
                          {mov.estado_pago}
                        </span>
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

// ── Badge Dinámico de Estado ─────────────────────────────────────
const obtenerEstiloCondicion = (estado) => {
  const base = { padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' };
  if (estado === 'Pagado') return { ...base, backgroundColor: '#dcfce7', color: '#15803d' };
  if (estado === 'Adelanto') return { ...base, backgroundColor: '#fef3c7', color: '#b45309' };
  return { ...base, backgroundColor: '#fee2e2', color: '#b91c1c' }; // Fiado
};

// ── Estilos CSS-in-JS Limpios y Estables ──────────────────────────
const containerStyle = {
  maxWidth: '1050px', margin: '20px auto', padding: '20px',
  background: '#ffffff', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
  fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box'
};
const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderBottom: '1px solid #edf2f7', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px'
};
const btnExcelStyle = {
  backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 18px',
  borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'
};
const filtroBoxStyle = {
  backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #f3f4f6'
};
const btnInactivo = {
  background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
};
const btnActivo = {
  background: '#065f46', color: '#fff', border: '1px solid #065f46', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
};
const inputDateStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' };
const btnCalcularEspecial = { background: '#4b5563', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' };

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '20px' };
const cardStyle = { backgroundColor: '#fff', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', boxSizing: 'border-box' };
const cardTituloStyle = { fontSize: '11px', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.5px' };
const cardMontoStyle = { fontSize: '22px', fontWeight: '800', margin: '5px 0 2px' };
const cardSubtituloStyle = { fontSize: '11px', color: '#a0aec0' };

const bannerLogisticaStyle = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', fontSize: '13.5px', color: '#1e293b', marginBottom: '20px' };
const tablaCardStyle = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' };
const mainTablaStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' };
const thStyle = { padding: '12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontWeight: '600', textAlign: 'left' };
const tdStyle = { padding: '12px', borderBottom: '1px solid #f3f4f6', color: '#374151' };
const trStyle = { borderBottom: '1px solid #f3f4f6' };

export default Reportes;