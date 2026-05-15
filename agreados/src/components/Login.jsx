import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Correo o contraseña incorrectos');
    }
    // Si es exitoso, el listener en App.jsx detecta la sesión automáticamente
    setLoading(false);
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        {/* Logo / encabezado */}
        <div style={headerStyle}>
          <div style={iconCircleStyle}>🪨</div>
          <h1 style={titleStyle}>Agregados & Materiales</h1>
          <p style={subtitleStyle}>Sistema de Control de Despacho</p>
        </div>

        <form onSubmit={handleLogin}>
          <label style={labelStyle}>Correo electrónico</label>
          <input
            type="email"
            placeholder="usuario@empresa.com"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <div style={errorStyle}>⚠️ {error}</div>
          )}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Ingresando...' : '🔐 Ingresar'}
          </button>
        </form>

        <p style={footerStyle}>
          ¿Problemas para ingresar? Contacta al administrador.
        </p>
      </div>
    </div>
  );
};

const wrapStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
  padding: '20px',
  fontFamily: 'system-ui, sans-serif',
};
const cardStyle = {
  background: '#fff',
  borderRadius: '20px',
  padding: '40px 35px',
  width: '100%',
  maxWidth: '400px',
  boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
};
const headerStyle = {
  textAlign: 'center',
  marginBottom: '30px',
};
const iconCircleStyle = {
  fontSize: '40px',
  background: '#f0fdf4',
  borderRadius: '50%',
  width: '72px',
  height: '72px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 12px',
  border: '2px solid #dcfce7',
};
const titleStyle = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#064e3b',
  margin: '0 0 4px',
};
const subtitleStyle = {
  fontSize: '13px',
  color: '#6b7280',
  margin: 0,
};
const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
};
const inputStyle = {
  width: '100%',
  padding: '13px',
  marginBottom: '16px',
  borderRadius: '10px',
  border: '1.5px solid #d1d5db',
  fontSize: '15px',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s',
};
const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#dc2626',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '13px',
  marginBottom: '16px',
};
const btnStyle = {
  width: '100%',
  padding: '15px',
  backgroundColor: '#059669',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '16px',
  fontWeight: '700',
  cursor: 'pointer',
  marginTop: '4px',
};
const footerStyle = {
  textAlign: 'center',
  fontSize: '12px',
  color: '#9ca3af',
  marginTop: '20px',
  marginBottom: 0,
};

export default Login;