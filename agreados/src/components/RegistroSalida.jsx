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

const initialForm = {
  cliente_nombre: '',
  cliente_celular: '',
  precio_unitario: '',
  cantidad: '1',
  estado_pago: 'Pagado',
  monto_recibido: '',
  gasto_petroleo: '',
  material_tipo: '',
};

const RegistroSalida = () => {
  const [loading, setLoading] = useState(false);
  const [enviarWA, setEnviarWA] = useState(true);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [form, setForm] = useState(initialForm);

  const handleNumberChange = (field, value) => {
    const regex = /^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const totalVenta = (parseFloat(form.cantidad) || 0) * (parseFloat(form.precio_unitario) || 0);

  let montoFinalRecibido = 0;
  if (form.estado_pago === 'Pagado') {
    montoFinalRecibido = totalVenta;
  } else if (form.estado_pago === 'Fiado') {
    montoFinalRecibido = 0;
  } else {
    montoFinalRecibido = parseFloat(form.monto_recibido) || 0;
  }

  const saldoPendiente = totalVenta - montoFinalRecibido;

  // Validar celular: exactamente 9 dígitos
  const celularValido = /^[0-9]{9}$/.test(form.cliente_celular);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalVenta <= 0) return alert('El total debe ser mayor a 0');
    if (!form.material_tipo.trim()) return alert('Por favor ingresa el tipo de material');
    if (enviarWA && !celularValido) return alert('El celular debe tener exactamente 9 dígitos');

    setLoading(true);

    const { error } = await supabase.from('movimientos').insert([{
      cliente_nombre:   form.cliente_nombre,
      cliente_celular:  form.cliente_celular,
      cantidad_cubos:   parseFloat(form.cantidad),
      monto_total:      totalVenta,
      monto_recibido:   montoFinalRecibido,
      estado_pago:      form.estado_pago,
      gasto_combustible: parseFloat(form.gasto_petroleo) || 0,
      material_tipo:    form.material_tipo.trim(),
    }]);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      if (enviarWA && form.cliente_celular) {
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

        const boleta =
          `*🧾 BOLETA DE DESPACHO*%0A` +
          `*AGREGADOS Y MATERIALES*%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `📅 Fecha: ${fecha}  🕐 ${hora}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `👤 *Cliente:* ${form.cliente_nombre}%0A` +
          `🪨 *Material:* ${form.material_tipo}%0A` +
          `📦 *Cantidad:* ${form.cantidad} m³%0A` +
          `💵 *Precio x m³:* S/ ${parseFloat(form.precio_unitario).toFixed(2)}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `💰 *Total venta:* S/ ${totalVenta.toFixed(2)}%0A` +
          `✅ *A cuenta:*   S/ ${montoFinalRecibido.toFixed(2)}%0A` +
          (saldoPendiente > 0
            ? `⚠️ *Saldo deuda:* S/ ${saldoPendiente.toFixed(2)}%0A`
            : ``) +
          `📋 *Estado:* ${form.estado_pago}%0A` +
          `━━━━━━━━━━━━━━━━━━━━━━%0A` +
          `¡Gracias por su preferencia! 🙏`;

        window.open(`https://wa.me/51${form.cliente_celular}?text=${boleta}`, '_blank');
      }

      alert('✅ Registro guardado correctamente');
      setForm(initialForm); // Reset limpio sin recargar la página
    }

    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ textAlign: 'center', color: '#065f46', marginBottom: '20px' }}>
        🚚 Control de Despacho
      </h2>

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

        {/* TIPO DE MATERIAL */}
        <label style={labelStyle}>Tipo de Material</label>
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Ej: Arena fina, Piedra chancada 3/4&quot;..."
            required
            value={form.material_tipo}
            onFocus={() => setMostrarSugerencias(true)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
            onChange={(e) => setForm({ ...form, material_tipo: e.target.value })}
            style={{ ...inputStyle, marginBottom: 0 }}
          />
          {mostrarSugerencias && (
            <div style={sugerenciasStyle}>
              {MATERIALES_SUGERIDOS
                .filter(m => m.toLowerCase().includes(form.material_tipo.toLowerCase()))
                .map((mat) => (
                  <div
                    key={mat}
                    onMouseDown={() => setForm({ ...form, material_tipo: mat })}
                    style={sugerenciaItemStyle}
                    onMouseEnter={e => e.target.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.target.style.background = '#fff'}
                  >
                    🪨 {mat}
                  </div>
                ))}
              <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
                O escribe el tuyo propio ↑
              </div>
            </div>
          )}
        </div>

        {/* PRECIO Y CANTIDAD */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Precio x m³</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="S/ 0.00"
              required
              value={form.precio_unitario}
              onChange={(e) => handleNumberChange('precio_unitario', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Cant. m³</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.cantidad}
              required
              onChange={(e) => handleNumberChange('cantidad', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* RESUMEN */}
        <div style={resumenStyle}>
          <div style={{ fontSize: '18px' }}>
            Total: <strong>S/ {totalVenta.toFixed(2)}</strong>
          </div>
          {saldoPendiente > 0 && (
            <div style={{ color: '#dc2626', fontSize: '14px', marginTop: '5px' }}>
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
              onChange={(e) => handleNumberChange('monto_recibido', e.target.value)}
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
          onChange={(e) => handleNumberChange('gasto_petroleo', e.target.value)}
          style={inputStyle}
        />

        <hr style={{ border: '0.5px solid #eee', margin: '20px 0' }} />

        {/* OPCIÓN BOLETA WHATSAPP */}
        <div style={boletaBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: enviarWA ? '12px' : '0' }}>
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
                Se enviará una boleta con todos los detalles del despacho al cliente.
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

const containerStyle = {
  maxWidth: '450px', margin: '20px auto', padding: '25px',
  background: '#fff', borderRadius: '15px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif',
};
const labelStyle = {
  display: 'block', marginBottom: '5px', fontSize: '14px',
  fontWeight: '600', color: '#374151',
};
const inputStyle = {
  width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box', outline: 'none',
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