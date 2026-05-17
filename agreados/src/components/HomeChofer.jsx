import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const HomeChofer = ({ usuario }) => {
  const navigate = useNavigate();
  const [nombreChofer, setNombreChofer] = useState('');
  const [viajesHoy, setViajesHoy]       = useState(0);
  const [viajesSemana, setViajesSemana] = useState(0);

  useEffect(() => {
    if (!usuario?.id) return;

    // Obtener nombre real del chofer desde la tabla choferes
    const cargarDatos = async () => {
      const { data } = await supabase
        .from('choferes')
        .select('nombre')
        .eq('id', usuario.id)
        .single();

      if (data?.nombre) setNombreChofer(data.nombre);

      // Estadísticas rápidas
      const hoy = new Date();
      const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const hoyISO   = new Date(hoyLocal.getTime() + 5 * 60 * 60 * 1000).toISOString();

      const inicioSemana = new Date(hoyLocal);
      const diaSemana    = inicioSemana.getDay();
      const diff         = inicioSemana.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      inicioSemana.setDate(diff);
      const semanaISO = new Date(inicioSemana.getTime() + 5 * 60 * 60 * 1000).toISOString();

      const { count: countHoy } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', usuario.id)
        .gte('creado_en', hoyISO);

      const { data: dataSemana } = await supabase
        .from('movimientos')
        .select('id')
        .eq('usuario_id', usuario.id)
        .gte('creado_en', semanaISO);

      setViajesHoy(countHoy || 0);
      setViajesSemana(dataSemana?.length || 0);
    };

    cargarDatos();
  }, [usuario?.id]);

  const saludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div style={containerStyle}>

      {/* Saludo */}
      <div style={saludoBoxStyle}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
        <div style={{ fontSize: '15px', color: '#6b7280' }}>{saludo()},</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#065f46', marginTop: '2px' }}>
          {nombreChofer || usuario?.email?.split('@')[0]}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', justifyContent: 'center' }}>
          <div style={miniStatStyle}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Hoy</span>
            <strong style={{ fontSize: '20px', color: '#111827' }}>{viajesHoy}</strong>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>viajes</span>
          </div>
          <div style={miniStatStyle}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Semana</span>
            <strong style={{ fontSize: '20px', color: '#059669' }}>{viajesSemana}</strong>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>viajes</span>
          </div>
        </div>
      </div>

      {/* Tarjetas de acción */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <button onClick={() => navigate('/despacho')} style={cardDespachoStyle}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#065f46' }}>
            Registrar Despacho
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>
            Registra la salida de materiales, genera boleta y notifica al cliente
          </div>
          <div style={arrowStyle}>→</div>
        </button>

        <button onClick={() => navigate('/rendicion')} style={cardRendicionStyle}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f' }}>
            Mi Rendición Semanal
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>
            Ve tu resumen de cobros, gastos y clientes con saldo pendiente
          </div>
          <div style={{ ...arrowStyle, color: '#3b82f6' }}>→</div>
        </button>

      </div>
    </div>
  );
};

// ── Estilos ───────────────────────────────────────────────────
const containerStyle = {
  maxWidth: '480px', margin: '20px auto', padding: '20px',
  fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box',
};
const saludoBoxStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
  textAlign: 'center', marginBottom: '20px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
};
const miniStatStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  backgroundColor: '#f9fafb', borderRadius: '10px', padding: '10px 20px',
  border: '1px solid #e5e7eb', minWidth: '80px',
};
const cardDespachoStyle = {
  width: '100%', padding: '24px', backgroundColor: '#f0fdf4',
  border: '2px solid #a7f3d0', borderRadius: '16px', cursor: 'pointer',
  textAlign: 'center', boxSizing: 'border-box', position: 'relative',
  boxShadow: '0 4px 12px rgba(5,150,105,0.1)', transition: 'transform 0.1s',
};
const cardRendicionStyle = {
  width: '100%', padding: '24px', backgroundColor: '#eff6ff',
  border: '2px solid #bfdbfe', borderRadius: '16px', cursor: 'pointer',
  textAlign: 'center', boxSizing: 'border-box', position: 'relative',
  boxShadow: '0 4px 12px rgba(59,130,246,0.1)', transition: 'transform 0.1s',
};
const arrowStyle = {
  position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
  fontSize: '22px', color: '#059669', fontWeight: '700',
};

export default HomeChofer;