import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import RegistroSalida from './components/RegistroSalida';
import DashboardAdmin from './components/DashboardAdmin';

function App() {
  return (
    <Router>
      <div className="App" style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        
        {/* Navegación con tu estilo original mejorado */}
        <nav style={navStyle}>
          <div style={navContainer}>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Agregados Llagas 🚚</h1>
            <div style={menuStyle}>
              <Link to="/despacho" style={linkStyle}>Choferes</Link>
              <Link to="/admin" style={linkStyle}>Administración</Link>
            </div>
          </div>
        </nav>

        <main style={{ padding: '10px' }}>
          <Routes>
            {/* Redirigir la raíz al despacho de choferes por defecto */}
            <Route path="/" element={<Navigate to="/despacho" />} />
            
            {/* Ruta para el formulario de choferes */}
            <Route path="/despacho" element={<RegistroSalida />} />
            
            {/* Ruta para el panel de tu tía */}
            <Route path="/admin" element={<DashboardAdmin />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// --- TUS ESTILOS ACTUALIZADOS ---
const navStyle = {
  backgroundColor: '#059669',
  color: 'white',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  marginBottom: '20px'
};

const navContainer = {
  maxWidth: '800px',
  margin: 'auto',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px'
};

const menuStyle = {
  display: 'flex',
  gap: '20px'
};

const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  padding: '5px 10px',
  borderRadius: '5px',
  backgroundColor: 'rgba(255,255,255,0.1)'
};

export default App;