import { useNavigate, useLocation } from 'react-router-dom';

export default function TopMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const perfil = localStorage.getItem('perfilUsuario');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="top-menu">
      <button onClick={() => navigate('/dashboard')} className={`menu-btn ${isActive('/dashboard')}`}>📊 Dashboard</button>
      <button onClick={() => navigate('/cadastro')} className={`menu-btn ${isActive('/cadastro')}`}>📝 Cadastro</button>
      <button onClick={() => navigate('/triagem')} className={`menu-btn ${isActive('/triagem')}`}>📋 Triagem</button>
      {perfil === 'admin' && (
        <button onClick={() => navigate('/configuracoes')} className={`menu-btn ${isActive('/configuracoes')}`}>⚙️ Admin</button>
      )}
      <button onClick={handleLogout} className="menu-btn btn-logout">🚪 Sair</button>
    </div>
  );
}
