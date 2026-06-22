import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import TopMenu from '../components/TopMenu';
import { useNavigate } from 'react-router-dom';

const EVENTO_VAZIO = {
  nome: '', qtd_dias: 2,
  data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200,
  data_dia3: '', vagas_dia3: 200, data_dia4: '', vagas_dia4: 200, data_dia5: '', vagas_dia5: 200,
  local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '',
};

const USU_VAZIO = { nome: '', usuario: '', senha: '', perfil: 'voluntario', evento_id: '' };

export default function Configuracoes() {
  const navigate = useNavigate();
  const [subTelaConfig, setSubTelaConfig] = useState('eventos');
  const [listaEventos, setListaEventos] = useState([]);
  const [listaUsuarios, setListaUsuarios] = useState([]);

  // Evt
  const [idEdicaoEvento, setIdEdicaoEvento] = useState(null);
  const [novoEvento, setNovoEvento] = useState(EVENTO_VAZIO);

  // Usu
  const [novoUsu, setNovoUsu] = useState(USU_VAZIO);

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
      setNovoEvento(EVENTO_VAZIO);
      carregarTudo();
    } catch (err) {
      toast.error('Erro ao guardar evento');
    }
  };

  const prepararEdicaoEvento = (ev) => {
    setIdEdicaoEvento(ev.id);
    const soData = (d) => (d ? d.split('T')[0] : '');
    setNovoEvento({
      nome: ev.nome,
      qtd_dias: ev.qtd_dias || 2,
      data_dia1: soData(ev.data_dia1), vagas_dia1: ev.vagas_dia1 ?? '',
      data_dia2: soData(ev.data_dia2), vagas_dia2: ev.vagas_dia2 ?? '',
      data_dia3: soData(ev.data_dia3), vagas_dia3: ev.vagas_dia3 ?? '',
      data_dia4: soData(ev.data_dia4), vagas_dia4: ev.vagas_dia4 ?? '',
      data_dia5: soData(ev.data_dia5), vagas_dia5: ev.vagas_dia5 ?? '',
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
      setNovoUsu(USU_VAZIO);
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

  const baixarArquivo = async (url, nomeArquivo, tipo) => {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: tipo });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nomeArquivo;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const exportarVcf = async (eventoId, nomeEvento) => {
    const url = eventoId ? `/pacientes/exportar-vcf?evento_id=${eventoId}` : '/pacientes/exportar-vcf';
    const nome = `contatos_${nomeEvento ? nomeEvento.replace(/\s+/g, '_') : 'todos'}.vcf`;
    await baixarArquivo(url, nome, 'text/vcard');
  };

  const exportarBackup = async (eventoId, nomeEvento) => {
    const url = eventoId ? `/backup?evento_id=${eventoId}` : '/backup';
    const hoje = new Date().toISOString().slice(0, 10);
    const nome = eventoId
      ? `backup_${nomeEvento.replace(/\s+/g, '_')}_${hoje}.json`
      : `backup_completo_${hoje}.json`;
    await baixarArquivo(url, nome, 'application/json');
  };



  return (
    <div className="app-wrapper">
      <div className="main-container config-view">
        <TopMenu />
        
        <div className="card">
          <div className="subtabs">
            <button onClick={() => setSubTelaConfig('eventos')} className={`subtab-btn ${subTelaConfig === 'eventos' ? 'active' : ''}`}>📅 Eventos</button>
            <button onClick={() => setSubTelaConfig('usuarios')} className={`subtab-btn ${subTelaConfig === 'usuarios' ? 'active' : ''}`}>👥 Utilizadores</button>
            <button onClick={() => setSubTelaConfig('exportar')} className={`subtab-btn ${subTelaConfig === 'exportar' ? 'active' : ''}`}>📱 Exportar</button>
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
                  
                  <div className="form-group">
                    <label>Quantidade de Dias</label>
                    <select value={novoEvento.qtd_dias} onChange={e => setNovoEvento({...novoEvento, qtd_dias: parseInt(e.target.value, 10)})}>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'dia' : 'dias'}</option>)}
                    </select>
                  </div>

                  {Array.from({ length: novoEvento.qtd_dias }, (_, i) => i + 1).map(n => (
                    <div className="form-row" key={n}>
                      <div className="form-col">
                        <label>Data Dia {n}</label>
                        <input type="date" value={novoEvento[`data_dia${n}`] || ''} onChange={e => setNovoEvento({...novoEvento, [`data_dia${n}`]: e.target.value})} required />
                      </div>
                      <div className="form-col-small">
                        <label>Vagas D{n}</label>
                        <input type="number" placeholder="Qtd" value={novoEvento[`vagas_dia${n}`] ?? ''} onChange={e => setNovoEvento({...novoEvento, [`vagas_dia${n}`]: e.target.value})} required />
                      </div>
                    </div>
                  ))}

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
                          <button type="button" className="btn-outline" onClick={() => { setIdEdicaoEvento(null); setNovoEvento(EVENTO_VAZIO); }}>CANCELAR EDIÇÃO</button>
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
                      <span className="list-item-subtitle">{(ev.dias || []).map(d => `${d.label}: ${d.ocupadas}/${d.vagas ?? '-'}`).join(' | ')}</span>
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

          {subTelaConfig === 'exportar' && (
            <div>
              <div className="section-block">
                <h3 className="section-title">💾 Backup do Banco de Dados</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  Baixe um arquivo <strong>.json</strong> com todos os dados do evento (pacientes, datas, queixas). Guarde no Google Drive ou pendrive — se perder o servidor, este arquivo contém tudo para restaurar.
                </p>
                <div className="list-container">
                  <div className="list-item">
                    <div className="list-item-content">
                      <span className="list-item-title">Backup Completo</span>
                      <span className="list-item-subtitle">Todos os eventos e pacientes em um único arquivo</span>
                    </div>
                    <button className="btn-action btn-edit" title="Baixar backup completo" onClick={() => exportarBackup(null, 'completo')}>💾</button>
                  </div>
                  {listaEventos.map(ev => (
                    <div key={ev.id} className="list-item">
                      <div className="list-item-content">
                        <span className="list-item-title">{ev.nome}</span>
                        <span className="list-item-subtitle">{(ev.dias || []).map(d => `${d.label}: ${d.ocupadas} pacientes`).join(' | ')}</span>
                      </div>
                      <button className="btn-action btn-edit" title="Baixar backup deste evento" onClick={() => exportarBackup(ev.id, ev.nome)}>💾</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-block">
                <h3 className="section-title">📱 Lista Telefônica para Android</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  Baixe um arquivo <strong>.vcf</strong> com nome e telefone dos pacientes. No Android, abra o arquivo para importar todos os contatos de uma vez.
                </p>
                <div className="list-container">
                  <div className="list-item">
                    <div className="list-item-content">
                      <span className="list-item-title">Todos os eventos</span>
                      <span className="list-item-subtitle">Contatos de todos os cadastros (duplicatas por telefone removidas)</span>
                    </div>
                    <button className="btn-action btn-edit" title="Baixar VCF" onClick={() => exportarVcf(null, 'todos')}>⬇️</button>
                  </div>
                  {listaEventos.map(ev => (
                    <div key={ev.id} className="list-item">
                      <div className="list-item-content">
                        <span className="list-item-title">{ev.nome}</span>
                        <span className="list-item-subtitle">{(ev.dias || []).map(d => `${d.label}: ${d.ocupadas} pacientes`).join(' | ')}</span>
                      </div>
                      <button className="btn-action btn-edit" title="Baixar VCF" onClick={() => exportarVcf(ev.id, ev.nome)}>⬇️</button>
                    </div>
                  ))}
                </div>
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

                  {novoUsu.perfil !== 'admin' && (
                    <div className="form-group">
                      <label>Evento atribuído</label>
                      <select value={novoUsu.evento_id} onChange={e => setNovoUsu({...novoUsu, evento_id: e.target.value})} required>
                        <option value="">Selecione um evento...</option>
                        {listaEventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                      </select>
                      <small style={{ color: 'var(--text-muted)' }}>O voluntário só verá o Cadastro e a Triagem deste evento.</small>
                    </div>
                  )}

                  <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>CRIAR ACESSO</button>
                </form>
              </div>

              <h3 className="section-title">Contas Cadastradas</h3>
              <div className="list-container">
                {listaUsuarios.map(u => (
                  <div key={u.id} className="list-item">
                    <div className="list-item-content">
                      <span className="list-item-title">{u.nome} <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)'}}>({u.usuario})</span></span>
                      <span className="list-item-subtitle">Nível: <strong>{u.perfil}</strong>{u.perfil !== 'admin' && ` · Evento: ${u.nome_evento || '— todos —'}`}</span>
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
