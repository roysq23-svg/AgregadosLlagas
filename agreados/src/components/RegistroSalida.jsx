import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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
  mostrarSugerencias: false,
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

  // ── Helpers de items ──────────────────────────────────────────
  const actualizarItem = (id, campo, valor) => {
    // Solo números decimales en campos numéricos
    if ((campo === 'cantidad' || campo === 'precio_unitario') && valor !== '') {
      if (!/^[0-9]*\.?[0-9]*$/.test(valor)) return;
    }
    setItems(prev => prev.map(it => it.id === id ? { ...it, [campo]: valor } : it));
  };

  const agregarItem = () => setItems(prev => [...prev, nuevoItem()]);

  const quitarItem = (id) => {
    if (items.length === 1) return; // Mínimo 1 fila
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

    // Validaciones
    const itemsValidos = items.filter(it => it.material_tipo.trim() && parseFloat(it.cantidad) > 0 && parseFloat(it.precio_unitario) > 0);
    if (itemsValidos.length === 0) return alert('Agrega al menos un material con cantidad y precio');
    if (totalVenta <= 0)           return alert('El total debe ser mayor a 0');
    if (enviarWA && !celularValido) return alert('El celular debe tener exactamente 9 dígitos');

    setLoading(true);

    // 1. Insertar movimiento principal
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
        material_tipo:     itemsValidos.map(it => it.material_tipo).join(', '), // Resumen legible
        usuario_id:        usuario.id,
      }])
      .select()
      .single();

    if (movError) {
      alert('Error al guardar: ' + movError.message);
      setLoading(false);
      return;
    }

    // 2. Insertar detalle de materiales
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
      alert('Movimiento guardado pero hubo un error en el detalle: ' + detError.message);
    } else {
      // 3. WhatsApp
      if (enviarWA && form.cliente_celular) {
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

        const lineasMateriales = itemsValidos.map(it => {
          const sub = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
          return `  🪨 ${it.material_tipo}: ${it.cantidad} m³ × S/ ${parseFloat(it.precio_unitario).toFixed(2)} = S/ ${sub.toFixed(2)}`;
        }).join('%0A');

        const boleta =
          `*🧾 BOLETA DE DESPACHO*%0A` +
          `*AGREGADOS Y MATERIALES*%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `📅 Fecha: ${fecha}  🕐 ${hora}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `👤 *Cliente:* ${form.cliente_nombre}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `📦 *Materiales despachados:*%0A` +
          `${lineasMateriales}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `💰 *Total venta:* S/ ${totalVenta.toFixed(2)}%0A` +
          `✅ *A cuenta:*   S/ ${montoFinalRecibido.toFixed(2)}%0A` +
          (saldoPendiente > 0 ? `⚠️ *Saldo deuda:* S/ ${saldoPendiente.toFixed(2)}%0A` : '') +
          `📋 *Estado:* ${form.estado_pago}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `¡Gracias por su preferencia! 🙏`;

        window.open(`https://wa.me/51${form.cliente_celular}?text=${boleta}`, '_blank');
      }

      alert('✅ Registro guardado correctamente');
      setForm(initialForm);
      setItems([nuevoItem()]);
    }

    setLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>

      {/* Header con info de usuario */}
   

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

        {/* ── MATERIALES (lista dinámica) ── */}
        <label style={labelStyle}>Materiales Despachados</label>

        {items.map((item, idx) => (
          <div key={item.id} style={itemBoxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                Material #{idx + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarItem(item.id)}
                  style={btnQuitarStyle}
                >
                  ✕ Quitar
                </button>
              )}
            </div>

            {/* Selector de material con autocompletado */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Tipo de material..."
                required
                value={item.material_tipo}
                onFocus={() => actualizarItem(item.id, 'mostrarSugerencias', true)}
                onBlur={() => setTimeout(() => actualizarItem(item.id, 'mostrarSugerencias', false), 150)}
                onChange={(e) => actualizarItem(item.id, 'material_tipo', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
              {item.mostrarSugerencias && (
                <div style={sugerenciasStyle}>
                  {MATERIALES_SUGERIDOS
                    .filter(m => m.toLowerCase().includes(item.material_tipo.toLowerCase()))
                    .map(mat => (
                      <div
                        key={mat}
                        onMouseDown={() => actualizarItem(item.id, 'material_tipo', mat)}
                        style={sugerenciaItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        🪨 {mat}
                      </div>
                    ))}
                  <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
                    O escribe el tuyo ↑
                  </div>
                </div>
              )}
            </div>

            {/* Cantidad y Precio */}
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

            {/* Subtotal del item */}
            {parseFloat(item.cantidad) > 0 && parseFloat(item.precio_unitario) > 0 && (
              <div style={subtotalStyle}>
                Subtotal: <strong>S/ {((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0)).toFixed(2)}</strong>
              </div>
            )}
          </div>
        ))}

        {/* Botón agregar material */}
        <button type="button" onClick={agregarItem} style={btnAgregarStyle}>
          ＋ Agregar otro material
        </button>

        {/* RESUMEN TOTAL */}
        <div style={resumenStyle}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>
            Total: S/ {totalVenta.toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {items.filter(it => it.material_tipo.trim()).length} tipo(s) de material ·{' '}
            {items.reduce((a, it) => a + (parseFloat(it.cantidad) || 0), 0).toFixed(1)} m³ total
          </div>
          {saldoPendiente > 0 && (
            <div style={{ color: '#dc2626', fontSize: '14px', marginTop: '6px' }}>
              Deuda pendiente: S/ {saldoPendiente.toFixed(2)}
            </div>
          )}
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

        {/* BOLETA WHATSAPP */}
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
                Se enviará la boleta con todos los materiales al cliente.
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
              {form.cliente_celular && !celularValido && (
                <p style={{ fontSize: '12px', color: '#dc2626', margin: '4px 0 0' }}>
                  Debe tener exactamente 9 dígitos
                </p>
              )}
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

// ── Estilos ────────────────────────────────────────────────────
const containerStyle = {
  maxWidth: '480px', margin: '20px auto', padding: '25px',
  background: '#fff', borderRadius: '15px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif',
};
const headerBarStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb',
};
const btnLogoutStyle = {
  padding: '7px 14px', background: '#f3f4f6', border: 'none',
  borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  color: '#374151', fontWeight: '600',
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
  marginBottom: '12px', border: '1px solid #e5e7eb',
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
};
const resumenStyle = {
  padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px',
  marginBottom: '20px', textAlign: 'center', border: '1px solid #dcfce7',
};
const adelantoBoxStyle = {
  padding: '15px', backgroundColor: '#fffbeb', borderRadius: '10px',
  marginBottom: '15px', border: '1px solid #fef3c7',
};
const boletaBoxStyle = {
  padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '10px',
  marginBottom: '20px', border: '1px solid #bbf7d0',
};
const sugerenciasStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, marginTop: '4px',
  overflow: 'hidden',
};
const sugerenciaItemStyle = {
  padding: '10px 12px', cursor: 'pointer', fontSize: '14px',
  color: '#374151', background: '#fff', transition: 'background 0.1s',
};
const buttonStyle = {
  width: '100%', padding: '16px', backgroundColor: '#059669',
  color: 'white', border: 'none', borderRadius: '10px',
  fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
};

export default RegistroSalida;