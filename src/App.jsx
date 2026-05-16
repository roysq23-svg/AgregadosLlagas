import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Login from './components/Login';
import RegistroSalida from './components/RegistroSalida';
import DashboardAdmin from './components/DashboardAdmin';

function App() {
  const [sesion, setSesion]     = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      setCargando(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  // ── Pantalla de carga ─────────────────────────────────────────
  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', backgroundColor: '#f3f4f6' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🪨</div>
          <div style={{ fontSize: '16px', fontWeight: '500' }}>Cargando sistema de cantera...</div>
        </div>
      </div>
    );
  }

  // ── Sin sesión → Login ────────────────────────────────────────
  if (!sesion) {
    return <Login />;
  }

  const usuario = sesion.user;
  console.log('USUARIO COMPLETO:', JSON.stringify(usuario));

  const esAdmin =
    (usuario.user_metadata || {}).rol === 'admin' ||
    (usuario.app_metadata || {}).rol === 'admin';

  console.log('ES ADMIN:', esAdmin);

  // ── Con sesión → rutas protegidas por rol ────────────────────
  return (
    <Router>
      <div className="App" style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>

        {/* Barra de navegación global fija en la parte superior */}
        <nav style={navStyle}>
          <div style={navContainer}>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.5px' }}>
              Agregados Llagas 🚚
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '13px', opacity: 0.9, backgroundColor: 'rgba(0,0,0,0.12)', padding: '5px 10px', borderRadius: '20px' }}>
                👤 {usuario.email}
              </span>
              <button onClick={cerrarSesion} style={btnLogoutStyle}>
                Salir →
              </button>
            </div>
          </div>
        </nav>

        {/* Contenedor principal de vistas */}
        <main style={{ padding: '10px 15px', maxWidth: '1150px', margin: '0 auto' }}>
          <Routes>
            {esAdmin ? (
              <>
                <Route path="/"         element={<Navigate to="/admin" replace />} />
                <Route path="/despacho" element={<Navigate to="/admin" replace />} />
                <Route path="/admin"    element={<DashboardAdmin usuario={usuario} />} />
                <Route path="*"         element={<Navigate to="/admin" replace />} />
              </>
            ) : (
              <>
                <Route path="/"         element={<Navigate to="/despacho" replace />} />
                <Route path="/admin"    element={<Navigate to="/despacho" replace />} />
                <Route path="/despacho" element={<RegistroSalida usuario={usuario} />} />
                <Route path="*"         element={<Navigate to="/despacho" replace />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// ── Estilos del Nav Global ───────────────────────────────────────────────
const navStyle = {
  backgroundColor: '#059669',
  color: 'white',
  padding: '12px 20px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
  fontFamily: 'system-ui, sans-serif'
};
const navContainer = {
  maxWidth: '1100px',
  margin: 'auto',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px',
};
const btnLogoutStyle = {
  padding: '6px 14px',
  background: 'rgba(255,255,255,0.18)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '6px',
  color: 'white',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '12.5px',
  transition: 'background 0.2s',
};

export default App;