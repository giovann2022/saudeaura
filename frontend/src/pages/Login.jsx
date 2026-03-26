import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setCarregando(true);
    try {
      const r = await api.post('/login', { usuario, senha });
      localStorage.setItem('token', r.data.token);
      localStorage.setItem('perfilUsuario', r.data.perfil);
      localStorage.setItem('nomeLogado', r.data.nome);
      
      toast.success(`Bem-vindo, ${r.data.nome}!`);
      navigate('/cadastro');
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Usuário ou senha incorretos');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-wrapper auth-container">
      <div className="card" style={{ maxWidth: '400px' }}>
        <h2 className="card-header">
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>🩺</span>
          Saúde Aura
        </h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Utilizador</label>
            <input 
              type="text" 
              placeholder="Digite seu usuário..." 
              value={usuario}
              onChange={e => setUsuario(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="Digite sua senha..." 
              value={senha}
              onChange={e => setSenha(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={carregando}>
            {carregando ? 'A ENTRAR...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
