import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const LOGO_B64 = "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";

const MATERIALES_SUGERIDOS = [
  'Arena fina', 'Arena gruesa', 'Arena Amarilla',
  'Piedra chancada 1/2"', 'Piedra chancada 3/4"',
  'Piedra base', 'Afirmado', 'Hormigon',
];

const nuevoItem = () => ({
  id: Date.now() + Math.random(),
  material_tipo: '',
  cantidad: '',
  precio_unitario: '',
});

const initialForm = {
  cliente_nombre: '',
  cliente_celular: '',
  estado_pago: 'Pagado',
  monto_recibido: '',
  gasto_petroleo: '',
};

// Filtro de fechas UTC-5 Peru
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

const RegistroSalida = ({ usuario }) => {
  const navigate = useNavigate();
  const [form, setForm]         = useState(initialForm);
  const [items, setItems]       = useState([nuevoItem()]);
  const [loading, setLoading]   = useState(false);
  const [enviarWA, setEnviarWA] = useState(true);

  // Estadisticas
  const [viajesHoy, setViajesHoy]               = useState(0);
  const [viajesSemana, setViajesSemana]         = useState(0);
  const [cubosDespachados, setCubosDespachados] = useState(0);

  // Historial con filtros
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial]               = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filtroFecha, setFiltroFecha]           = useState('semana');
  const [fechaDesde, setFechaDesde]             = useState('');
  const [fechaHasta, setFechaHasta]             = useState('');

  const cargarEstadisticasChofer = useCallback(async () => {
    if (!usuario?.id) return;
    try {
      const hoy = new Date();
      const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const hoyISO   = new Date(hoyLocal.getTime() + 5 * 60 * 60 * 1000).toISOString();
      const inicioSemana = new Date(hoyLocal);
      const diaSemana    = inicioSemana.getDay();
      const diff         = inicioSemana.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      inicioSemana.setDate(diff);
      const semanaISO = new Date(inicioSemana.getTime() + 5 * 60 * 60 * 1000).toISOString();

      const { count: countHoy } = await supabase
        .from('movimientos').select('*', { count: 'exact', head: true })
        .eq('usuario_id', usuario.id).gte('creado_en', hoyISO);

      const { data: dataSemana } = await supabase
        .from('movimientos').select('cantidad_cubos')
        .eq('usuario_id', usuario.id).gte('creado_en', semanaISO);

      setViajesHoy(countHoy || 0);
      if (dataSemana) {
        setViajesSemana(dataSemana.length);
        setCubosDespachados(dataSemana.reduce((acc, m) => acc + (parseFloat(m.cantidad_cubos) || 0), 0));
      }
    } catch (err) {
      console.error('Error cargando metricas:', err);
    }
  }, [usuario?.id]);

  const cargarHistorial = useCallback(async () => {
    if (!usuario?.id) return;
    setLoadingHistorial(true);
    try {
      const { desde, hasta } = getRangoFecha(filtroFecha, fechaDesde, fechaHasta);
      let query = supabase
        .from('movimientos')
        .select('id, cliente_nombre, material_tipo, cantidad_cubos, monto_total, monto_recibido, estado_pago, creado_en')
        .eq('usuario_id', usuario.id)
        .order('creado_en', { ascending: false });
      if (desde) query = query.gte('creado_en', desde);
      if (hasta) query = query.lte('creado_en', hasta);
      const { data } = await query;
      setHistorial(data || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
    setLoadingHistorial(false);
  }, [usuario?.id, filtroFecha, fechaDesde, fechaHasta]);

  useEffect(() => { cargarEstadisticasChofer(); }, [cargarEstadisticasChofer]);
  useEffect(() => { if (mostrarHistorial) cargarHistorial(); }, [mostrarHistorial, cargarHistorial]);

  const actualizarItem = (id, campo, valor) => {
    if ((campo === 'cantidad' || campo === 'precio_unitario') && valor !== '') {
      if (!/^[0-9]*\.?[0-9]*$/.test(valor)) return;
    }
    setItems(prev => prev.map(it => it.id === id ? { ...it, [campo]: valor } : it));
  };

  const agregarItem = () => setItems(prev => [...prev, nuevoItem()]);
  const quitarItem  = (id) => { if (items.length > 1) setItems(prev => prev.filter(it => it.id !== id)); };

  const totalVenta = items.reduce((acc, it) =>
    acc + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0);

  let montoFinalRecibido = 0;
  if (form.estado_pago === 'Pagado')     montoFinalRecibido = totalVenta;
  else if (form.estado_pago === 'Fiado') montoFinalRecibido = 0;
  else                                   montoFinalRecibido = parseFloat(form.monto_recibido) || 0;

  const saldoPendiente = totalVenta - montoFinalRecibido;
  const celularValido  = /^[0-9]{9}$/.test(form.cliente_celular);

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const badgeEstado = (estado) => {
    if (estado === 'Pagado')   return { background: '#dcfce7', color: '#15803d' };
    if (estado === 'Adelanto') return { background: '#fef3c7', color: '#b45309' };
    return { background: '#fee2e2', color: '#b91c1c' };
  };

  // PDF
  const generarPDF = (itemsValidos, numeroBoleta) => {
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297, M = 12, W = PW - M * 2;
    const hH = 42;
    doc.setDrawColor(30, 64, 120);
    doc.setLineWidth(0.5);
    doc.rect(M, M, W, hH);
    const col1W = 48;
    try { doc.addImage(LOGO_B64, 'JPEG', M + 2, M + 4, 44, 34); } catch(e) {}
    doc.line(M + col1W, M, M + col1W, M + hH);
    const col2X = M + col1W + 4;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 64, 120);
    doc.text('AGREGADOS LLAGAS', col2X, M + 10);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 50, 50);
    doc.text('MZA. ALFONSO UGARTE N 553 - CIUDAD ETEN', col2X, M + 17);
    doc.text('Cel: 971 377 451 / 942 981 403', col2X, M + 22);
    doc.text('llagnec.neciosup4324@gmail.com', col2X, M + 27);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(30, 64, 120);
    doc.text('VENTA DE AGREGADOS · CHANCADO 1/2 Y 3/4 · ARENA · PIEDRA · HORMIGON', col2X, M + 34);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 50);
    doc.text('Deposito: Costado del cementerio - Ciudad Eten', col2X, M + 40);
    const col3X = PW - M - 38;
    doc.line(col3X, M, col3X, M + hH);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
    doc.text('RUC:', col3X + 19, M + 7, { align: 'center' });
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 64, 120);
    doc.text('20609118998', col3X + 19, M + 13, { align: 'center' });
    doc.setFillColor(30, 64, 120);
    doc.rect(col3X + 1, M + 15, 36, 7, 'F');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.text('PROFORMA', col3X + 19, M + 20.5, { align: 'center' });
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 64, 120);
    doc.text('P001-' + String(numeroBoleta).padStart(3, '0'), col3X + 19, M + 29, { align: 'center' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
    doc.text('FEC: ' + fecha, col3X + 19, M + 35, { align: 'center' });
    doc.text('HORA: ' + hora, col3X + 19, M + 40, { align: 'center' });
    let curY = M + hH + 4;
    const mitad = M + W / 2;
    const halfW = W / 2 - 1;
    const celdaCliente = (label, valor, x, y, ancho) => {
      doc.setFillColor(240, 244, 255); doc.rect(x, y, 22, 7, 'F');
      doc.setDrawColor(200, 210, 230); doc.setLineWidth(0.2); doc.rect(x, y, ancho, 7);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 64, 120);
      doc.text(label, x + 1.5, y + 4.8);
      doc.setFont('Helvetica', 'normal'); doc.setTextColor(31, 41, 55);
      doc.text(String(valor), x + 24, y + 4.8);
    };
    celdaCliente('CLIENTE:', form.cliente_nombre.toUpperCase(), M, curY, halfW);
    celdaCliente('TELF./CEL.:', form.cliente_celular || '—', mitad + 1, curY, halfW);
    curY += 7;
    doc.setFillColor(240, 244, 255); doc.rect(M, curY, 22, 7, 'F');
    doc.setDrawColor(200, 210, 230); doc.setLineWidth(0.2); doc.rect(M, curY, halfW, 7);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 64, 120);
    doc.text('ESTADO:', M + 1.5, curY + 4.8);
    const ec = form.estado_pago === 'Pagado' ? [5,150,105] : form.estado_pago === 'Fiado' ? [220,38,38] : [217,119,6];
    doc.setTextColor(ec[0], ec[1], ec[2]); doc.setFont('Helvetica', 'bold');
    doc.text(form.estado_pago.toUpperCase(), M + 24, curY + 4.8);
    celdaCliente('REG.:', usuario?.email?.split('@')[0] || 'Chofer', mitad + 1, curY, halfW);
    curY += 11;
    const filasTabla = itemsValidos.map(it => {
      const sub = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
      return [parseFloat(it.cantidad).toFixed(1), 'm\u00B3', it.material_tipo, 'S/ ' + parseFloat(it.precio_unitario).toFixed(2), 'S/ ' + sub.toFixed(2)];
    });
    autoTable(doc, {
      startY: curY,
      head: [['CANT.', 'UNID.', 'DESCRIPCION', 'P. UNIT.', 'IMPORTE']],
      body: filasTabla,
      theme: 'grid',
      headStyles: { fillColor: [30,64,120], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 3 },
      bodyStyles: { fontSize: 9, textColor: [31,41,55], cellPadding: 3, minCellHeight: 10 },
      columnStyles: { 0: { halign: 'center', cellWidth: 18 }, 1: { halign: 'center', cellWidth: 16 }, 2: { halign: 'left', cellWidth: 90 }, 3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 30 } },
      alternateRowStyles: { fillColor: [248,250,255] },
      tableLineColor: [200,210,230], tableLineWidth: 0.2,
      margin: { left: M, right: M },
    });
    const finalY = doc.lastAutoTable.finalY + 4;
    const anchoTotales = 86, xTotales = PW - M - anchoTotales, anchoObs = xTotales - M - 4;
    doc.setDrawColor(200,210,230); doc.setLineWidth(0.2); doc.rect(M, finalY, anchoObs, 38);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80,80,80);
    doc.text('OBSERVACIONES', M + 2, finalY + 5);
    doc.line(M, finalY + 7, M + anchoObs, finalY + 7);
    const gastoComb = parseFloat(form.gasto_petroleo) || 0;
    if (gastoComb > 0) {
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100,100,100);
      doc.text('Gasto combustible: S/ ' + gastoComb.toFixed(2), M + 2, finalY + 14);
    }
    const filasT = [
      { label: 'SUB TOTAL', valor: 'S/ ' + totalVenta.toFixed(2), color: [31,41,55], bold: false },
      { label: 'COBRADO', valor: 'S/ ' + montoFinalRecibido.toFixed(2), color: [5,150,105], bold: true },
      { label: 'SALDO PEND.', valor: 'S/ ' + saldoPendiente.toFixed(2), color: saldoPendiente > 0 ? [220,38,38] : [100,100,100], bold: saldoPendiente > 0 },
    ];
    let ty = finalY;
    filasT.forEach(({ label, valor, color, bold }) => {
      doc.setFillColor(248,250,255); doc.rect(xTotales, ty, anchoTotales, 8, 'F');
      doc.setDrawColor(200,210,230); doc.setLineWidth(0.2); doc.rect(xTotales, ty, anchoTotales, 8);
      doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
      doc.text(label, xTotales + 3, ty + 5.2);
      doc.setTextColor(color[0], color[1], color[2]); doc.setFont('Helvetica', bold ? 'bold' : 'normal');
      doc.text(valor, PW - M - 2, ty + 5.2, { align: 'right' });
      ty += 8;
    });
    doc.setFillColor(30,64,120); doc.rect(xTotales, ty, anchoTotales, 12, 'F');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text('TOTAL', xTotales + 3, ty + 7.8);
    doc.text('S/ ' + totalVenta.toFixed(2), PW - M - 2, ty + 7.8, { align: 'right' });
    const pieY = PH - 18;
    doc.setFillColor(5,150,105); doc.rect(M, pieY, W, 2, 'F');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130,130,130);
    doc.text('Documento generado por el sistema de despacho  ·  Agregados Llagas  ·  Ciudad Eten, Chiclayo', PW / 2, pieY + 7, { align: 'center' });
    const nombreArchivo = 'Boleta_' + form.cliente_nombre.replace(/\s+/g, '_') + '_P001-' + String(numeroBoleta).padStart(3, '0') + '.pdf';
    doc.save(nombreArchivo);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemsValidos = items.filter(it => it.material_tipo.trim() && parseFloat(it.cantidad) > 0 && parseFloat(it.precio_unitario) > 0);
    if (itemsValidos.length === 0) return alert('Agrega al menos un material con cantidad y precio');
    if (totalVenta <= 0) return alert('El total debe ser mayor a 0');
    if (enviarWA && !celularValido) return alert('El celular debe tener exactamente 9 digitos');
    setLoading(true);
    try {
      const { count: totalMovs } = await supabase.from('movimientos').select('*', { count: 'exact', head: true });
      const numeroBoleta = (totalMovs || 0) + 1;
      const { data: movData, error: movError } = await supabase.from('movimientos').insert([{
        cliente_nombre: form.cliente_nombre, cliente_celular: form.cliente_celular,
        cantidad_cubos: itemsValidos.reduce((a, it) => a + (parseFloat(it.cantidad) || 0), 0),
        monto_total: totalVenta, monto_recibido: montoFinalRecibido,
        estado_pago: form.estado_pago, gasto_combustible: parseFloat(form.gasto_petroleo) || 0,
        material_tipo: itemsValidos.map(it => it.material_tipo).join(', '), usuario_id: usuario?.id,
      }]).select().single();
      if (movError) throw new Error('Tabla movimientos: ' + movError.message);
      const detalles = itemsValidos.map(it => ({ movimiento_id: movData.id, material_tipo: it.material_tipo.trim(), cantidad: parseFloat(it.cantidad), precio_unitario: parseFloat(it.precio_unitario) }));
      const { error: detError } = await supabase.from('detalle_movimientos').insert(detalles);
      if (detError) throw new Error('Tabla detalle_movimientos: ' + detError.message);
      generarPDF(itemsValidos, numeroBoleta);
      if (enviarWA && form.cliente_celular) {
        const mensajeWA = '*AGREGADOS LLAGAS*%0A*RUC:* 20609118998%0A*Proforma:* P001-' + String(numeroBoleta).padStart(3,'0') + '%0AHola *' + form.cliente_nombre + '*, gracias por su compra.%0A%0ATotal: S/ ' + totalVenta.toFixed(2) + '%0ACobrado: S/ ' + montoFinalRecibido.toFixed(2) + '%0A' + (saldoPendiente > 0 ? 'Saldo pendiente: S/ ' + saldoPendiente.toFixed(2) + '%0A' : '') + 'Estado: ' + form.estado_pago + '%0AGracias por su confianza!';
        window.open('https://wa.me/51' + form.cliente_celular + '?text=' + mensajeWA, '_blank');
      }
      alert('Registro guardado correctamente');
      setForm(initialForm); setItems([nuevoItem()]);
      cargarEstadisticasChofer();
      if (mostrarHistorial) cargarHistorial();
    } catch (err) {
      alert('Error: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <datalist id="materiales-lista">
        {MATERIALES_SUGERIDOS.map(mat => <option key={mat} value={mat} />)}
      </datalist>

      {/* Boton volver */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={() => navigate('/inicio')} style={btnVolverStyle}>← Inicio</button>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#065f46' }}>📋 Registrar Despacho</div>
      </div>

      {/* Panel estadisticas */}
      <div style={panelRendimientoStyle}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#047857', marginBottom: '8px', textTransform: 'uppercase' }}>
          Mi Resumen de Despacho
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div style={cardMetricaStyle}><span style={{ fontSize: '11px', color: '#6b7280' }}>Viajes Hoy</span><strong style={{ fontSize: '18px', color: '#111827' }}>{viajesHoy}</strong></div>
          <div style={cardMetricaStyle}><span style={{ fontSize: '11px', color: '#6b7280' }}>Esta Semana</span><strong style={{ fontSize: '18px', color: '#111827' }}>{viajesSemana}</strong></div>
          <div style={cardMetricaStyle}><span style={{ fontSize: '11px', color: '#6b7280' }}>Volumen (m3)</span><strong style={{ fontSize: '18px', color: '#059669' }}>{cubosDespachados.toFixed(1)}</strong></div>
        </div>
      </div>

      {/* Historial de viajes con filtros */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setMostrarHistorial(!mostrarHistorial)}
          style={btnHistorialStyle}
        >
          {mostrarHistorial ? '▲ Ocultar historial' : '📅 Ver historial de viajes'}
        </button>

        {mostrarHistorial && (
          <div style={historialBoxStyle}>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[['hoy','Hoy'], ['semana','Esta semana'], ['mes','Este mes'], ['personalizado','Rango']].map(([val, label]) => (
                <button key={val} onClick={() => setFiltroFecha(val)}
                  style={{ ...btnFiltroStyle, background: filtroFecha === val ? '#065f46' : '#f3f4f6', color: filtroFecha === val ? '#fff' : '#374151', fontWeight: filtroFecha === val ? '700' : '400' }}>
                  {label}
                </button>
              ))}
            </div>

            {filtroFecha === 'personalizado' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputFechaStyle} />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>hasta</span>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputFechaStyle} />
                <button onClick={cargarHistorial} style={{ ...btnFiltroStyle, background: '#374151', color: '#fff' }}>Buscar</button>
              </div>
            )}

            {/* Resumen del periodo */}
            {!loadingHistorial && historial.length > 0 && (
              <div style={resumenHistorialStyle}>
                <span>{historial.length} viaje{historial.length !== 1 ? 's' : ''}</span>
                <span>{historial.reduce((a,m) => a + (parseFloat(m.cantidad_cubos)||0), 0).toFixed(1)} m³</span>
                <span style={{ color: '#059669', fontWeight: '700' }}>S/ {historial.reduce((a,m) => a + (parseFloat(m.monto_recibido)||0), 0).toFixed(2)} cobrado</span>
              </div>
            )}

            {/* Lista */}
            {loadingHistorial ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Cargando...</div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>Sin viajes en este periodo</div>
            ) : (
              historial.map(m => {
                const saldo = (parseFloat(m.monto_total)||0) - (parseFloat(m.monto_recibido)||0);
                return (
                  <div key={m.id} style={{ ...tarjetaViajeStyle, borderLeft: saldo > 0 ? '3px solid #dc2626' : '3px solid #059669' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{m.cliente_nombre}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{formatFecha(m.creado_en)}</div>
                        <div style={{ fontSize: '12px', color: '#374151', marginTop: '3px' }}>🪨 {m.material_tipo} · {parseFloat(m.cantidad_cubos).toFixed(1)} m³</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <span style={{ ...badgeEstado(m.estado_pago), padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>{m.estado_pago}</span>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: saldo > 0 ? '#dc2626' : '#059669', marginTop: '4px' }}>
                          {saldo > 0 ? 'Debe S/ ' + saldo.toFixed(2) : 'S/ ' + parseFloat(m.monto_total).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Formulario de registro */}
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Nombre / Razon Social del Cliente</label>
        <input type="text" placeholder="Ej: Manuela Ferreteria" required value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} style={inputStyle} />

        <label style={labelStyle}>Materiales Despachados</label>
        {items.map((item, idx) => (
          <div key={item.id} style={itemBoxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>Material #{idx + 1}</span>
              {items.length > 1 && <button type="button" onClick={() => quitarItem(item.id)} style={btnQuitarStyle}>Quitar</button>}
            </div>
            <input type="text" list="materiales-lista" placeholder="Escribe o selecciona material..." required value={item.material_tipo} onChange={(e) => actualizarItem(item.id, 'material_tipo', e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Cantidad (m3)</label>
                <input type="text" inputMode="decimal" placeholder="0.00" required value={item.cantidad} onChange={(e) => actualizarItem(item.id, 'cantidad', e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Precio x m3 (S/)</label>
                <input type="text" inputMode="decimal" placeholder="0.00" required value={item.precio_unitario} onChange={(e) => actualizarItem(item.id, 'precio_unitario', e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
            </div>
            {parseFloat(item.cantidad) > 0 && parseFloat(item.precio_unitario) > 0 && (
              <div style={subtotalStyle}>Subtotal: <strong>S/ {((parseFloat(item.cantidad)||0)*(parseFloat(item.precio_unitario)||0)).toFixed(2)}</strong></div>
            )}
          </div>
        ))}

        <button type="button" onClick={agregarItem} style={btnAgregarStyle}>+ Agregar otro material</button>

        <div style={resumenStyle}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>Total: S/ {totalVenta.toFixed(2)}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {items.filter(it => it.material_tipo.trim()).length} tipo(s) · {items.reduce((a,it)=>a+(parseFloat(it.cantidad)||0),0).toFixed(1)} m3 total
          </div>
        </div>

        <label style={labelStyle}>Estado de Pago</label>
        <select style={inputStyle} value={form.estado_pago} onChange={(e) => setForm({ ...form, estado_pago: e.target.value, monto_recibido: '' })}>
          <option value="Pagado">Pagado Completo</option>
          <option value="Adelanto">Adelanto (Parte)</option>
          <option value="Fiado">Todo Fiado</option>
        </select>

        {form.estado_pago === 'Adelanto' && (
          <div style={adelantoBoxStyle}>
            <label style={labelStyle}>Cuanto dinero recibio el chofer?</label>
            <input type="text" inputMode="decimal" placeholder="S/ 0.00" required value={form.monto_recibido} onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setForm({ ...form, monto_recibido: e.target.value }); }} style={inputStyle} />
          </div>
        )}

        <label style={labelStyle}>Gasto Combustible (S/)</label>
        <input type="text" inputMode="decimal" placeholder="0.00 (Opcional)" value={form.gasto_petroleo} onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setForm({ ...form, gasto_petroleo: e.target.value }); }} style={inputStyle} />

        <hr style={{ border: '0.5px solid #eee', margin: '20px 0' }} />

        <div style={boletaBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: enviarWA ? '12px' : 0 }}>
            <input type="checkbox" id="wa-check" checked={enviarWA} onChange={(e) => setEnviarWA(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
            <label htmlFor="wa-check" style={{ fontSize: '14px', fontWeight: '600', cursor: 'pointer', color: '#065f46' }}>Enviar boleta por WhatsApp</label>
          </div>
          {enviarWA && (
            <>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px', paddingLeft: '28px' }}>Se emitira el PDF y se notificara por WhatsApp.</p>
              <input type="tel" placeholder="Celular del cliente (9 digitos)" required={enviarWA} value={form.cliente_celular} onChange={(e) => setForm({ ...form, cliente_celular: e.target.value.replace(/\D/g, '').slice(0, 9) })} style={{ ...inputStyle, marginBottom: 0, borderColor: form.cliente_celular && !celularValido ? '#dc2626' : '#d1d5db' }} />
            </>
          )}
        </div>

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Guardando...' : 'REGISTRAR SALIDA'}
        </button>
      </form>
    </div>
  );
};

const containerStyle      = { maxWidth: '480px', margin: '20px auto', padding: '25px', background: '#fff', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' };
const btnVolverStyle      = { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: '600' };
const panelRendimientoStyle = { backgroundColor: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '15px', marginBottom: '16px', boxSizing: 'border-box' };
const cardMetricaStyle    = { flex: 1, backgroundColor: '#ffffff', borderRadius: '8px', padding: '10px', textAlign: 'center', display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb' };
const btnHistorialStyle   = { width: '100%', padding: '11px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', color: '#1d4ed8', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '0', boxSizing: 'border-box' };
const historialBoxStyle   = { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginTop: '10px', marginBottom: '4px' };
const btnFiltroStyle      = { padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px' };
const inputFechaStyle     = { padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px' };
const resumenHistorialStyle = { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', backgroundColor: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#374151' };
const tarjetaViajeStyle   = { backgroundColor: '#fff', borderRadius: '10px', padding: '12px', marginBottom: '8px', border: '1px solid #e5e7eb' };
const labelStyle          = { display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600', color: '#374151' };
const inputStyle          = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box', outline: 'none' };
const itemBoxStyle        = { background: '#f9fafb', borderRadius: '12px', padding: '15px', marginBottom: '12px', border: '1px solid #e5e7eb', boxSizing: 'border-box' };
const btnQuitarStyle      = { background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' };
const subtotalStyle       = { marginTop: '8px', textAlign: 'right', fontSize: '13px', color: '#059669', fontWeight: '600' };
const btnAgregarStyle     = { width: '100%', padding: '12px', background: '#f0fdf4', border: '2px dashed #86efac', borderRadius: '10px', color: '#059669', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px', boxSizing: 'border-box' };
const resumenStyle        = { padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px', marginBottom: '20px', textAlign: 'center', border: '1px solid #dcfce7', boxSizing: 'border-box' };
const adelantoBoxStyle    = { padding: '15px', backgroundColor: '#fffbeb', borderRadius: '10px', marginBottom: '15px', border: '1px solid #fef3c7', boxSizing: 'border-box' };
const boletaBoxStyle      = { padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px', marginBottom: '20px', border: '1px solid #bbf7d0', boxSizing: 'border-box' };
const buttonStyle         = { width: '100%', padding: '16px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxSizing: 'border-box' };

export default RegistroSalida;