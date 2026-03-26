import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Pages
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Triagem from './pages/Triagem';
import Configuracoes from './pages/Configuracoes';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  if (!token || token === 'undefined') return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{ 
            duration: 3500,
            style: { background: '#fff', color: '#333', fontWeight: '500' },
            success: { iconTheme: { primary: '#15803d', secondary: '#fff' } },
            error: { iconTheme: { primary: '#b91c1c', secondary: '#fff' } }
        }} 
      />
      
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/cadastro" element={
            <RequireAuth><Cadastro /></RequireAuth>
          } />
          
          <Route path="/triagem" element={
            <RequireAuth><Triagem /></RequireAuth>
          } />
          
          <Route path="/configuracoes" element={
            <RequireAuth><Configuracoes /></RequireAuth>
          } />
          
          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/cadastro" replace />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;