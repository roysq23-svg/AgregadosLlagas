import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MATERIALES_SUGERIDOS = [
  'Arena fina',
  'Arena gruesa',
  'Piedra chancada 1/2"',
  'Piedra chancada 3/4"',
  'Piedra base',
  'Afirmado',
  'Hormigón',
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

const RegistroSalida = ({ usuario }) => {
  const [form, setForm]       = useState(initialForm);
  const [items, setItems]     = useState([nuevoItem()]);
  const [loading, setLoading] = useState(false);
  const [enviarWA, setEnviarWA] = useState(true);

  // Estados para el control de viajes del chofer
  const [viajesHoy, setViajesHoy] = useState(0);
  const [viajesSemana, setViajesSemana] = useState(0);
  const [cubosDespachados, setCubosDespachados] = useState(0);

  // ── Cargar Estadísticas del Chofer Corregido según Esquema Real ───────────────────
  const cargarEstadisticasChofer = useCallback(async () => {
    if (!usuario?.id) return;

    try {
      // Formato ISO estricto para evitar errores 400 en Supabase
      const hoy = new Date();
      const hoyStr = hoy.toISOString().split('T')[0] + 'T00:00:00.000Z';

      const inicioSemana = new Date();
      const diaSemana = inicioSemana.getDay();
      const diferencia = inicioSemana.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      inicioSemana.setDate(diferencia);
      const semanaStr = inicioSemana.toISOString().split('T')[0] + 'T00:00:00.000Z';

      // Consulta de hoy usando filtro OR para verificar tanto chofer_id como usuario_id
      const { count: countHoy, error: errHoy } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .or(`usuario_id.eq.${usuario.id},chofer_id.eq.${usuario.id}`)
        .gte('creado_en', hoyStr); // Usando 'creado_en' que figura en tu esquema de base de datos

      if (errHoy) console.error("Error consultas hoy:", errHoy.message);

      // Consulta de la semana con filtro OR
      const { data: dataSemana, error: errSemana } = await supabase
        .from('movimientos')
        .select('cantidad_cubos')
        .or(`usuario_id.eq.${usuario.id},chofer_id.eq.${usuario.id}`)
        .gte('creado_en', semanaStr);

      if (errSemana) console.error("Error consultas semana:", errSemana.message);

      if (!errHoy) setViajesHoy(countHoy || 0);
      if (!errSemana && dataSemana) {
        setViajesSemana(dataSemana.length);
        const totalm3 = dataSemana.reduce((acc, mov) => acc + (parseFloat(mov.cantidad_cubos) || 0), 0);
        setCubosDespachados(totalm3);
      }
    } catch (error) {
      console.error('Error cargando métricas de chofer:', error);
    }
  }, [usuario?.id]);

  useEffect(() => {
    cargarEstadisticasChofer();
  }, [cargarEstadisticasChofer]);

  // ── Helpers de items ──────────────────────────────────────────
  const actualizarItem = (id, campo, valor) => {
    if ((campo === 'cantidad' || campo === 'precio_unitario') && valor !== '') {
      if (!/^[0-9]*\.?[0-9]*$/.test(valor)) return;
    }
    setItems(prev => prev.map(it => it.id === id ? { ...it, [campo]: valor } : it));
  };

  const agregarItem = () => setItems(prev => [...prev, nuevoItem()]);

  const quitarItem = (id) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // ── Totales ───────────────────────────────────────────────────
  const totalVenta = items.reduce((acc, it) => {
    return acc + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
  }, 0);

  let montoFinalRecibido = 0;
  if (form.estado_pago === 'Pagado')   montoFinalRecibido = totalVenta;
  else if (form.estado_pago === 'Fiado') montoFinalRecibido = 0;
  else montoFinalRecibido = parseFloat(form.monto_recibido) || 0;

  const saldoPendiente = totalVenta - montoFinalRecibido;
  const celularValido = /^[0-9]{9}$/.test(form.cliente_celular);

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    const itemsValidos = items.filter(it => it.material_tipo.trim() && parseFloat(it.cantidad) > 0 && parseFloat(it.precio_unitario) > 0);
    if (itemsValidos.length === 0) return alert('Agrega al menos un material con cantidad y precio');
    if (totalVenta <= 0)           return alert('El total debe ser mayor a 0');
    if (enviarWA && !celularValido) return alert('El celular debe tener exactamente 9 dígitos');

    setLoading(true);

    try {
      // 1. Insertar movimiento principal respetando nombres de columnas exactos de tu esquema
      const { data: movData, error: movError } = await supabase
        .from('movimientos')
        .insert([{
          cliente_nombre:    form.cliente_nombre,
          cliente_celular:   form.cliente_celular,
          cantidad_cubos:    itemsValidos.reduce((a, it) => a + (parseFloat(it.cantidad) || 0), 0),
          monto_total:       totalVenta,
          monto_recibido:    montoFinalRecibido,
          estado_pago:       form.estado_pago,
          gasto_combustible: parseFloat(form.gasto_petroleo) || 0,
          material_tipo:     itemsValidos.map(it => it.material_tipo).join(', '),
          usuario_id:        usuario?.id // Se inserta en la columna correspondiente
        }])
        .select()
        .single();

      if (movError) {
        throw new Error('Tabla movimientos: ' + movError.message);
      }

      // 2. Insertar detalle de materiales usando la estructura correcta
      const detalles = itemsValidos.map(it => ({
        movimiento_id:   movData.id,
        material_tipo:   it.material_tipo.trim(),
        cantidad:        parseFloat(it.cantidad),
        precio_unitario: parseFloat(it.precio_unitario),
      }));

      const { error: detError } = await supabase
        .from('detalle_movimientos')
        .insert(detalles);

      if (detError) {
        throw new Error('Tabla detalle_movimientos: ' + detError.message);
      }

      // 3. GENERACIÓN DE BOLETA PDF SIN CORREOS Y CON CUADRE PERFECTO
      const ahora = new Date();
      const fecha = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

      // Encabezado Corporativo
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(5, 150, 105);
      doc.text("CONSTRUCTORA Y COMERCIALIZADORA JEAN LLAGAS", 10, 15, { maxWidth: 128 });
      
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.setFont("Helvetica", "normal");
      doc.text(`RUC: 20609118998`, 10, 24);
      doc.text(`Fecha: ${fecha}      Hora: ${hora}`, 10, 29);
      
      // EXCLUSIÓN DE PRIVACIDAD: Mostrar nombre legible en vez del correo electrónico
      const nombreOperador = usuario?.user_metadata?.nombre || usuario?.user_metadata?.full_name || "Despacho Cantera";
      doc.text(`Atendido por: ${nombreOperador}`, 10, 34);

      // Línea divisoria nítida
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.3);
      doc.line(10, 37, 138, 37);

      // Datos del Cliente
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(`CLIENTE:`, 10, 43);
      doc.setFont("Helvetica", "normal");
      doc.text(`${form.cliente_nombre.toUpperCase()}`, 32, 43);

      if (form.cliente_celular) {
        doc.setFont("Helvetica", "bold");
        doc.text(`CELULAR:`, 10, 48);
        doc.setFont("Helvetica", "normal");
        doc.text(`${form.cliente_celular}`, 32, 48);
      }

      const columnasTabla = ["Material / Agregado", "Cant (m³)", "P. Unit", "Subtotal"];
      const filasTabla = itemsValidos.map(it => {
        const sub = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
        return [it.material_tipo, `${parseFloat(it.cantidad).toFixed(2)} m³`, `S/ ${parseFloat(it.precio_unitario).toFixed(2)}`, `S/ ${sub.toFixed(2)}`];
      });

      // Render de tabla organizada
      autoTable(doc, {
        startY: 53,
        head: [columnasTabla],
        body: filasTabla,
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
        columnStyles: { 
          0: { cellWidth: 52, halign: 'left' }, 
          1: { cellWidth: 22, halign: 'right' }, 
          2: { cellWidth: 22, halign: 'right' }, 
          3: { cellWidth: 24, halign: 'right' } 
        },
        margin: { left: 10, right: 10 }
      });

      // REAJUSTE DE MARGENES: Bajamos de X:138 a X:128 para evitar que los números se monten al borde
      const finalY = doc.lastAutoTable.finalY + 8;
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Total Venta:`, 70, finalY);
      doc.setFont("Helvetica", "bold");
      doc.text(`S/ ${totalVenta.toFixed(2)}`, 128, finalY, { halign: 'right' });

      doc.setFont("Helvetica", "normal");
      doc.text(`Monto Cobrado:`, 70, finalY + 5);
      doc.setFont("Helvetica", "bold");
      doc.text(`S/ ${montoFinalRecibido.toFixed(2)}`, 128, finalY + 5, { halign: 'right' });

      if (saldoPendiente > 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFont("Helvetica", "normal");
        doc.text(`Saldo Deuda:`, 70, finalY + 10);
        doc.setFont("Helvetica", "bold");
        doc.text(`S/ ${saldoPendiente.toFixed(2)}`, 128, finalY + 10, { halign: 'right' });
      }

      // Zona de Firma
      const firmaY = finalY + 18;
      doc.setDrawColor(156, 163, 175);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(25, firmaY + 10, 75, firmaY + 10);
      doc.setLineDashPattern([], 0);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text("Firma de Conformidad Cliente", 50, firmaY + 14, { halign: 'center' });

      // Mensaje de Cierre
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(156, 163, 175);
      doc.text("¡Gracias por su preferencia! Material despachado conforme en cantera.", 74, firmaY + 24, { halign: 'center' });

      // Guardar el PDF resultante
      const nombreArchivo = `Boleta_${form.cliente_nombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      doc.save(nombreArchivo);

      // Despacho por chat de WhatsApp
      if (enviarWA && form.cliente_celular) {
        const mensajeWA = 
          `*🏗️ CONSTRUCTORA Y COMERCIALIZADORA JEAN LLAGAS*%0A` +
          `*RUC:* 20609118998%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `Hola *${form.cliente_nombre}*, se ha registrado su despacho con éxito. Su boleta oficial en PDF ha sido emitida por nuestro sistema logístico.%0A%0A` +
          `💰 *Monto Total:* S/ ${totalVenta.toFixed(2)}%0A` +
          `✅ *A cuenta:* S/ ${montoFinalRecibido.toFixed(2)}%0A` +
          (saldoPendiente > 0 ? `⚠️ *Saldo pendiente:* S/ ${saldoPendiente.toFixed(2)}%0A` : '') +
          `📋 *Condición:* ${form.estado_pago}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `¡Gracias por su confianza! 🛠️`;

        window.open(`https://wa.me/51${form.cliente_celular}?text=${mensajeWA}`, '_blank');
      }

      alert('✅ Registro guardado correctamente');
      setForm(initialForm);
      setItems([nuevoItem()]);
      cargarEstadisticasChofer(); 

    } catch (err) {
      console.error("Error detectado en el proceso:", err);
      alert('❌ Error: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <datalist id="materiales-lista">
        {MATERIALES_SUGERIDOS.map(mat => <option key={mat} value={mat} />)}
      </datalist>

      {/* Panel de Rendimiento Diario */}
      <div style={panelRendimientoStyle}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#047857', marginBottom: '8px', textTransform: 'uppercase' }}>
          📊 Mi Resumen de Despacho
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div style={cardMetricaStyle}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Viajes Hoy</span>
            <strong style={{ fontSize: '18px', color: '#111827' }}>{viajesHoy}</strong>
          </div>
          <div style={cardMetricaStyle}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Esta Semana</span>
            <strong style={{ fontSize: '18px', color: '#111827' }}>{viajesSemana}</strong>
          </div>
          <div style={cardMetricaStyle}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Volumen (m³)</span>
            <strong style={{ fontSize: '18px', color: '#059669' }}>{cubosDespachados.toFixed(1)}</strong>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* NOMBRE */}
        <label style={labelStyle}>Nombre del Cliente</label>
        <input
          type="text"
          placeholder="Ej: Juan Pérez"
          required
          value={form.cliente_nombre}
          onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })}
          style={inputStyle}
        />

        {/* MATERIALES */}
        <label style={labelStyle}>Materiales Despachados</label>

        {items.map((item, idx) => (
          <div key={item.id} style={itemBoxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                Material #{idx + 1}
              </span>
              {items.length > 1 && (
                <button type="button" onClick={() => quitarItem(item.id)} style={btnQuitarStyle}>
                  ✕ Quitar
                </button>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                list="materiales-lista"
                placeholder="Escribe o selecciona material..."
                required
                value={item.material_tipo}
                onChange={(e) => actualizarItem(item.id, 'material_tipo', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Cantidad (m³)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  value={item.cantidad}
                  onChange={(e) => actualizarItem(item.id, 'cantidad', e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Precio x m³ (S/)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  value={item.precio_unitario}
                  onChange={(e) => actualizarItem(item.id, 'precio_unitario', e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              </div>
            </div>

            {parseFloat(item.cantidad) > 0 && parseFloat(item.precio_unitario) > 0 && (
              <div style={subtotalStyle}>
                Subtotal: <strong>S/ {((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0)).toFixed(2)}</strong>
              </div>
            )}
          </div>
        ))}

        <button type="button" onClick={agregarItem} style={btnAgregarStyle}>
          ＋ Agregar otro material
        </button>

        {/* RESUMEN TOTAL */}
        <div style={resumenStyle}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>
            Total: S/ {totalVenta.toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {items.filter(it => it.material_tipo.trim()).length} tipo(s) ·{' '}
            {items.reduce((a, it) => a + (parseFloat(it.cantidad) || 0), 0).toFixed(1)} m³ total
          </div>
        </div>

        {/* ESTADO DE PAGO */}
        <label style={labelStyle}>Estado de Pago</label>
        <select
          style={inputStyle}
          value={form.estado_pago}
          onChange={(e) => setForm({ ...form, estado_pago: e.target.value, monto_recibido: '' })}
        >
          <option value="Pagado">Pagado Completo</option>
          <option value="Adelanto">Adelanto (Parte)</option>
          <option value="Fiado">Todo Fiado</option>
        </select>

        {form.estado_pago === 'Adelanto' && (
          <div style={adelantoBoxStyle}>
            <label style={labelStyle}>¿Cuánto dinero recibió el chofer?</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="S/ 0.00"
              required
              value={form.monto_recibido}
              onChange={(e) => {
                if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
                  setForm({ ...form, monto_recibido: e.target.value });
              }}
              style={inputStyle}
            />
          </div>
        )}

        {/* GASTO COMBUSTIBLE */}
        <label style={labelStyle}>Gasto Combustible (S/)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00 (Opcional)"
          value={form.gasto_petroleo}
          onChange={(e) => {
            if (/^[0-9]*\.?[0-9]*$/.test(e.target.value))
              setForm({ ...form, gasto_petroleo: e.target.value });
          }}
          style={inputStyle}
        />

        <hr style={{ border: '0.5px solid #eee', margin: '20px 0' }} />

        {/* SECCIÓN WHATSAPP */}
        <div style={boletaBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: enviarWA ? '12px' : 0 }}>
            <input
              type="checkbox"
              checked={enviarWA}
              onChange={(e) => setEnviarWA(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#25d366' }}
              id="wa-check"
            />
            <label htmlFor="wa-check" style={{ fontSize: '14px', fontWeight: '600', cursor: 'pointer', color: '#065f46' }}>
              📲 Enviar boleta por WhatsApp
            </label>
          </div>

          {enviarWA && (
            <>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px', paddingLeft: '28px' }}>
                Se emitirá el documento PDF corporativo y se notificará por chat.
              </p>
              <input
                type="tel"
                placeholder="Celular del cliente (9 dígitos)"
                required={enviarWA}
                value={form.cliente_celular}
                onChange={(e) => setForm({ ...form, cliente_celular: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                style={{
                  ...inputStyle,
                  marginBottom: 0,
                  borderColor: form.cliente_celular && !celularValido ? '#dc2626' : '#d1d5db',
                }}
              />
            </>
          )}
        </div>

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Guardando...' : '📋 REGISTRAR SALIDA'}
        </button>
      </form>
    </div>
  );
};

// ── Diseños de Estilos Estables ────────────────────────────────
const containerStyle = {
  maxWidth: '480px', margin: '20px auto', padding: '25px',
  background: '#fff', borderRadius: '15px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif',
  boxSizing: 'border-box'
};
const panelRendimientoStyle = {
  backgroundColor: '#f0fdf4', border: '1px solid #a7f3d0',
  borderRadius: '12px', padding: '15px', marginBottom: '20px',
  boxSizing: 'border-box'
};
const cardMetricaStyle = {
  flex: 1, backgroundColor: '#ffffff', borderRadius: '8px',
  padding: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb'
};
const labelStyle = {
  display: 'block', marginBottom: '5px', fontSize: '14px',
  fontWeight: '600', color: '#374151',
};
const inputStyle = {
  width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box', outline: 'none',
};
const itemBoxStyle = {
  background: '#f9fafb', borderRadius: '12px', padding: '15px',
  marginBottom: '12px', border: '1px solid #e5e7eb', boxSizing: 'border-box'
};
const btnQuitarStyle = {
  background: '#fee2e2', color: '#b91c1c', border: 'none',
  borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
};
const subtotalStyle = {
  marginTop: '8px', textAlign: 'right', fontSize: '13px',
  color: '#059669', fontWeight: '600',
};
const btnAgregarStyle = {
  width: '100%', padding: '12px', background: '#f0fdf4',
  border: '2px dashed #86efac', borderRadius: '10px', color: '#059669',
  fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px',
  boxSizing: 'border-box'
};
const resumenStyle = {
  padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px',
  marginBottom: '20px', textAlign: 'center', border: '1px solid #dcfce7', boxSizing: 'border-box'
};
const adelantoBoxStyle = {
  padding: '15px', backgroundColor: '#fffbeb', borderRadius: '10px',
  marginBottom: '15px', border: '1px solid #fef3c7', boxSizing: 'border-box'
};
const boletaBoxStyle = {
  padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px',
  marginBottom: '20px', border: '1px solid #bbf7d0', boxSizing: 'border-box'
};
const buttonStyle = {
  width: '100%', padding: '16px', backgroundColor: '#059669',
  color: 'white', border: 'none', borderRadius: '10px',
  fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxSizing: 'border-box'
};

export default RegistroSalida;