import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import TopMenu from '../components/TopMenu';
import { useNavigate } from 'react-router-dom';

export default function Configuracoes() {
  const navigate = useNavigate();
  const [subTelaConfig, setSubTelaConfig] = useState('eventos');
  const [listaEventos, setListaEventos] = useState([]);
  const [listaUsuarios, setListaUsuarios] = useState([]);

  // Evt
  const [idEdicaoEvento, setIdEdicaoEvento] = useState(null);
  const [novoEvento, setNovoEvento] = useState({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' });
  
  // Usu
  const [novoUsu, setNovoUsu] = useState({ nome: '', usuario: '', senha: '', perfil: 'voluntario' });

  useEffect(() => {
    const perfil = localStorage.getItem('perfilUsuario');
    if (perfil !== 'admin') {
      toast.error('Acesso restrito');
      navigate('/cadastro');
      return;
    }
    carregarTudo();
  }, [navigate]);

  const carregarTudo = async () => {
    try {
      const resE = await api.get('/eventos'); 
      setListaEventos(resE.data);
      const resU = await api.get('/usuarios'); 
      setListaUsuarios(resU.data);
    } catch {
      toast.error('Garante que possui perfil Admin');
    }
  };

  const lidarComEvento = async (e) => {
    e.preventDefault();
    try {
      if (idEdicaoEvento) {
        await api.put(`/eventos/${idEdicaoEvento}`, novoEvento);
        toast.success('Evento atualizado!');
      } else {
        await api.post('/eventos', novoEvento);
        toast.success('Evento criado!');
      }
      setIdEdicaoEvento(null);
      setNovoEvento({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' });
      carregarTudo();
    } catch (err) { 
      toast.error('Erro ao guardar evento'); 
    }
  };

  const prepararEdicaoEvento = (ev) => {
    setIdEdicaoEvento(ev.id);
    setNovoEvento({
      nome: ev.nome,
      data_dia1: ev.data_dia1 ? ev.data_dia1.split('T')[0] : '',
      vagas_dia1: ev.vagas_dia1,
      data_dia2: ev.data_dia2 ? ev.data_dia2.split('T')[0] : '',
      vagas_dia2: ev.vagas_dia2,
      local_atendimento: ev.local_atendimento,
      instrucoes_pdf: ev.instrucoes_pdf,
      insta: ev.insta,
      whats: ev.whats,
      email: ev.email,
      site: ev.site
    });
    window.scrollTo(0,0);
  };

  const deletarEvento = async (id) => {
    if (confirm('Apagar Evento e Puxar Pacientes Associados? Cuidado, ação irreversível!')) {
      try {
        await api.delete(`/eventos/${id}`);
        toast.success('Evento removido');
        carregarTudo();
      } catch { toast.error('Falha ao remover evento'); }
    }
  };

  // Usuários
  const lidarComUsuario = async (e) => {
    e.preventDefault(); 
    try { 
      await api.post('/usuarios', novoUsu); 
      toast.success('Utilizador criado com sucesso!'); 
      carregarTudo(); 
      setNovoUsu({ nome: '', usuario: '', senha: '', perfil: 'voluntario' });
    } catch(err) { 
      toast.error(err.response?.data?.erro || 'Erro ao criar utilizador'); 
    } 
  };

  const deletarUsuario = async (u) => {
    if (confirm(`Remover acesso de ${u.nome}?`)) {
      try {
        await api.delete(`/usuarios/${u.id}`);
        toast.success('Utilizador apagado');
        carregarTudo();
      } catch { toast.error('Falha ao remover'); }
    }
  };

  return (
    <div className="app-wrapper">
      <div className="main-container config-view">
        <TopMenu />
        
        <div className="card">
          <div className="subtabs">
            <button onClick={() => setSubTelaConfig('eventos')} className={`subtab-btn ${subTelaConfig === 'eventos' ? 'active' : ''}`}>📅 Eventos</button>
            <button onClick={() => setSubTelaConfig('usuarios')} className={`subtab-btn ${subTelaConfig === 'usuarios' ? 'active' : ''}`}>👥 Utilizadores</button>
          </div>
          
          {subTelaConfig === 'eventos' && (
            <div>
              <div className="section-block">
                <h3 className="section-title">{idEdicaoEvento ? '✏️ Editar Evento' : '✨ Criar Novo Evento'}</h3>
                <form onSubmit={lidarComEvento}>
                  <div className="form-group">
                    <label>Nome do Evento</label>
                    <input type="text" placeholder="Ex: Caminho da Cura - Março/2026" value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} required />
                  </div>
                  
                  <div className="form-row">
                      <div className="form-col">
                        <label>Data Dia 1</label>
                        <input type="date" value={novoEvento.data_dia1} onChange={e => setNovoEvento({...novoEvento, data_dia1: e.target.value})} required />
                      </div>
                      <div className="form-col-small">
                        <label>Vagas D1</label>
                        <input type="number" placeholder="Qtd" value={novoEvento.vagas_dia1} onChange={e => setNovoEvento({...novoEvento, vagas_dia1: e.target.value})} required />
                      </div>
                  </div>
                  
                  <div className="form-row">
                      <div className="form-col">
                        <label>Data Dia 2</label>
                        <input type="date" value={novoEvento.data_dia2} onChange={e => setNovoEvento({...novoEvento, data_dia2: e.target.value})} required />
                      </div>
                      <div className="form-col-small">
                        <label>Vagas D2</label>
                        <input type="number" placeholder="Qtd" value={novoEvento.vagas_dia2} onChange={e => setNovoEvento({...novoEvento, vagas_dia2: e.target.value})} required />
                      </div>
                  </div>
                  
                  <div className="form-row">
                      <div className="form-col">
                        <label>Instagram</label>
                        <input type="text" placeholder="@seu.insta" value={novoEvento.insta} onChange={e => setNovoEvento({...novoEvento, insta: e.target.value})} />
                      </div>
                      <div className="form-col">
                        <label>WhatsApp</label>
                        <input type="text" placeholder="(DD) 99999-9999" value={novoEvento.whats} onChange={e => setNovoEvento({...novoEvento, whats: e.target.value})} />
                      </div>
                  </div>
                  
                  <div className="form-row">
                      <div className="form-col">
                        <label>E-mail Contato</label>
                        <input type="text" placeholder="email@dominio.com" value={novoEvento.email} onChange={e => setNovoEvento({...novoEvento, email: e.target.value})} />
                      </div>
                      <div className="form-col">
                        <label>Site / Link</label>
                        <input type="text" placeholder="www.site.com" value={novoEvento.site} onChange={e => setNovoEvento({...novoEvento, site: e.target.value})} />
                      </div>
                  </div>

                  <div className="form-group">
                    <label>Localização (Para o PDF)</label>
                    <input type="text" placeholder="Logradouro completo..." value={novoEvento.local_atendimento} onChange={e => setNovoEvento({...novoEvento, local_atendimento: e.target.value})} required />
                  </div>
                  
                  <div className="form-group">
                    <label>Instruções Importantes (Para o PDF)</label>
                    <textarea placeholder="Ex: Traga RG, não atrase..." value={novoEvento.instrucoes_pdf} onChange={e => setNovoEvento({...novoEvento, instrucoes_pdf: e.target.value})} rows="4" required />
                  </div>
                  
                  <div className="form-row" style={{ marginTop: '20px' }}>
                      <div className="form-col">
                        <button type="submit" className={idEdicaoEvento ? 'btn-secondary btn-primary' : 'btn-primary'}>
                          {idEdicaoEvento ? 'ATUALIZAR EVENTO' : 'ATIVAR NOVO EVENTO'}
                        </button>
                      </div>
                      {idEdicaoEvento && (
                        <div className="form-col">
                          <button type="button" className="btn-outline" onClick={() => { setIdEdicaoEvento(null); setNovoEvento({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' }); }}>CANCELAR EDIÇÃO</button>
                        </div>
                      )}
                  </div>
                </form>
              </div>
              
              <h3 className="section-title">Eventos Ativos</h3>
              <div className="list-container">
                {listaEventos.map(ev => (
                  <div key={ev.id} className="list-item">
                    <div className="list-item-content">
                      <span className="list-item-title">{ev.nome}</span>
                      <span className="list-item-subtitle">Ocupação Dia 1: {ev.ocupadas_dia1}/{ev.vagas_dia1} | Dia 2: {ev.ocupadas_dia2}/{ev.vagas_dia2}</span>
                    </div>
                    <div className="action-buttons">
                      <button className="btn-action btn-edit" title="Editar Evento" onClick={() => prepararEdicaoEvento(ev)}>✏️</button>
                      <button className="btn-action btn-delete" title="Apagar Definitivamente" onClick={() => deletarEvento(ev.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTelaConfig === 'usuarios' && (
            <div>
              <div className="section-block">
                <h3 className="section-title">👤 Adicionar Novo Utilizador</h3>
                <form onSubmit={lidarComUsuario}>
                  <div className="form-row">
                    <div className="form-col">
                      <label>Nome Completo</label>
                      <input type="text" placeholder="Ex: João Silva" value={novoUsu.nome} onChange={e => setNovoUsu({...novoUsu, nome: e.target.value})} required />
                    </div>
                    <div className="form-col">
                      <label>Login (Utilizador)</label>
                      <input type="text" placeholder="joaosilva" value={novoUsu.usuario} onChange={e => setNovoUsu({...novoUsu, usuario: e.target.value})} required />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-col">
                      <label>Senha</label>
                      <input type="password" placeholder="***" value={novoUsu.senha} onChange={e => setNovoUsu({...novoUsu, senha: e.target.value})} required />
                    </div>
                    <div className="form-col">
                      <label>Perfil de Acesso</label>
                      <select value={novoUsu.perfil} onChange={e => setNovoUsu({...novoUsu, perfil: e.target.value})}>
                        <option value="voluntario">Voluntário (Cadastro, Triagem)</option>
                        <option value="admin">Administrador (Total)</option>
                      </select>
                    </div>
                  </div>
                  
                  <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>CRIAR ACESSO</button>
                </form>
              </div>

              <h3 className="section-title">Contas Cadastradas</h3>
              <div className="list-container">
                {listaUsuarios.map(u => (
                  <div key={u.id} className="list-item">
                    <div className="list-item-content">
                      <span className="list-item-title">{u.nome} <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)'}}>({u.usuario})</span></span>
                      <span className="list-item-subtitle">Nível: <strong>{u.perfil}</strong></span>
                    </div>
                    <button className="btn-action btn-delete" title="Remover Utilizador" onClick={() => deletarUsuario(u)}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
