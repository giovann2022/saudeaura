import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { imprimirFichaUnica, imprimirFichasLote } from '../services/pdfService';
import TopMenu from '../components/TopMenu';

const CAMPOS_VAZIOS = {
  nome: '', telefone: '', nascimento: '', idade: '',
  rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  queixa1: '', queixa2: '', queixa3: '',
  dia_atendimento: 'Dia 1', tipo_tratamento: 'Cura Espiritual', evento_id: '',
};

export default function Triagem() {
  const [eventos, setEventos] = useState([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  const [diaFiltro, setDiaFiltro] = useState('todos');
  const [listaPacientes, setListaPacientes] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(CAMPOS_VAZIOS);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarEventos();
  }, []);

  useEffect(() => {
    if (eventoSelecionadoId) carregarPacientes();
  }, [eventoSelecionadoId]);

  const carregarEventos = async () => {
    try {
      const res = await api.get('/eventos');
      setEventos(res.data);
      if (res.data.length > 0) setEventoSelecionadoId(res.data[0].id);
    } catch {
      toast.error('Erro ao carregar eventos');
    }
  };

  const carregarPacientes = async () => {
    setCarregando(true);
    try {
      const res = await api.get('/pacientes');
      setListaPacientes(res.data);
    } catch {
      toast.error('Erro ao listar pacientes');
    } finally {
      setCarregando(false);
    }
  };

  const abrirEdicao = (p) => {
    setForm({
      nome: p.nome || '', telefone: p.telefone || '',
      nascimento: p.nascimento ? p.nascimento.slice(0, 10) : '', idade: p.idade || '',
      rua: p.endereco || '', numero: p.numero || '', complemento: p.complemento || '',
      bairro: p.bairro || '', cidade: p.cidade || '', estado: p.estado || '',
      queixa1: p.queixa1 || '', queixa2: p.queixa2 || '', queixa3: p.queixa3 || '',
      dia_atendimento: p.dia_atendimento, tipo_tratamento: p.tipo_tratamento, evento_id: p.evento_id,
    });
    setEditando(p);
  };

  const salvarEdicao = async () => {
    if (!form.nome.trim() || !form.queixa1.trim()) {
      toast.error('Nome e queixa principal são obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      const res = await api.put(`/pacientes/${editando.id}`, form);
      if (res.data.nova_senha) {
        toast.success(`Paciente atualizado — nova senha: ${res.data.nova_senha}`);
      } else {
        toast.success('Paciente atualizado');
      }
      setEditando(null);
      carregarPacientes();
    } catch {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const trocarDia = async (p) => {
    const novoDia = p.dia_atendimento === 'Dia 1' ? 'Dia 2' : 'Dia 1';
    if (!confirm(`Mover ${p.nome} para ${novoDia}? Uma nova senha será gerada.`)) return;
    try {
      const res = await api.put(`/pacientes/${p.id}`, {
        ...p, rua: p.endereco, dia_atendimento: novoDia,
      });
      const pacienteAtualizado = { ...p, dia_atendimento: novoDia, senha_atendimento: res.data.nova_senha };
      toast.success(res.data.nova_senha ? `Movido para ${novoDia} — nova senha: ${res.data.nova_senha}` : `Movido para ${novoDia}`);
      imprimirFichaUnica(pacienteAtualizado);
      carregarPacientes();
    } catch {
      toast.error('Erro ao trocar dia');
    }
  };

  const deletarPaciente = async (id) => {
    if (confirm('Remover paciente definitivamente?')) {
      try {
        await api.delete(`/pacientes/${id}`);
        toast.success('Paciente removido');
        carregarPacientes();
      } catch {
        toast.error('Erro ao remover paciente');
      }
    }
  };

  const pacientesFiltrados = listaPacientes.filter(p => {
    if (p.evento_id != eventoSelecionadoId) return false;
    if (diaFiltro !== 'todos' && p.dia_atendimento !== diaFiltro) return false;
    if (termoBusca) {
      const busca = termoBusca.toLowerCase();
      const senhaStr = p.senha_atendimento != null ? p.senha_atendimento.toString() : 'se';
      return p.nome.toLowerCase().includes(busca) || senhaStr.toLowerCase().includes(busca);
    }
    return true;
  });

  const eventoAtual = eventos.find(e => e.id == eventoSelecionadoId);

  return (
    <>
    <div className="app-wrapper">
      <div className="main-container config-view">
        <TopMenu />

        <div className="table-container">
          <div className="table-header-controls" style={{ flexWrap: 'wrap', gap: '10px' }}>

            {/* Seletor de evento */}
            {eventos.length > 0 && (
              <select
                className="search-input"
                style={{ maxWidth: '280px', cursor: 'pointer' }}
                value={eventoSelecionadoId}
                onChange={e => { setEventoSelecionadoId(e.target.value); setDiaFiltro('todos'); }}
              >
                {eventos.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.nome}</option>
                ))}
              </select>
            )}

            {/* Filtro por dia */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['todos', 'Dia 1', 'Dia 2'].map(d => (
                <button
                  key={d}
                  className={diaFiltro === d ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={() => setDiaFiltro(d)}
                >
                  {d === 'todos' ? 'Todos' : d}
                </button>
              ))}
            </div>

            {/* Busca */}
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Buscar por Nome ou Senha..."
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
            />

            {/* Imprimir lote */}
            <button
              className="btn-secondary"
              onClick={() => imprimirFichasLote(pacientesFiltrados)}
              disabled={pacientesFiltrados.length === 0}
            >
              🖨️ IMPRIMIR LOTE
            </button>
          </div>

          {/* Resumo do evento */}
          {eventoAtual && (
            <div style={{ padding: '10px 4px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '20px' }}>
              <span>📋 <strong>{pacientesFiltrados.length}</strong> paciente(s) exibido(s)</span>
              {diaFiltro === 'todos' && (
                <>
                  <span>Dia 1: <strong>{listaPacientes.filter(p => p.evento_id == eventoSelecionadoId && p.dia_atendimento === 'Dia 1').length}</strong></span>
                  <span>Dia 2: <strong>{listaPacientes.filter(p => p.evento_id == eventoSelecionadoId && p.dia_atendimento === 'Dia 2').length}</strong></span>
                </>
              )}
            </div>
          )}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Senha</th>
                  <th>Dia</th>
                  <th>Tipo</th>
                  <th>Paciente</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <em>Carregando...</em>
                    </td>
                  </tr>
                ) : pacientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum paciente encontrado.
                    </td>
                  </tr>
                ) : (
                  pacientesFiltrados.map(p => (
                    <tr key={p.id}>
                      <td><strong style={p.senha_atendimento == null ? { color: '#7c3aed' } : {}}>{p.senha_atendimento ?? 'SE'}</strong></td>
                      <td>{p.dia_atendimento}</td>
                      <td>{p.tipo_tratamento}</td>
                      <td>{p.nome}</td>
                      <td className="action-buttons">
                        <button className="btn-action btn-print" onClick={() => imprimirFichaUnica(p)} title="Imprimir Prontuário">📄</button>
                        <button className="btn-action btn-edit" onClick={() => abrirEdicao(p)} title="Editar Registro">✏️</button>
                        <button className="btn-action" onClick={() => trocarDia(p)} title={`Mover para ${p.dia_atendimento === 'Dia 1' ? 'Dia 2' : 'Dia 1'}`} style={{ color: '#7c3aed' }}>
                          {p.dia_atendimento === 'Dia 1' ? '2️⃣' : '1️⃣'}
                        </button>
                        <button className="btn-action btn-delete" onClick={() => deletarPaciente(p.id)} title="Excluir Registro">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de edição */}
    {editando && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: '12px', padding: '24px',
          width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>✏️ Editar — Senha {editando.senha_atendimento}</h3>
            <button className="btn-action" onClick={() => setEditando(null)} style={{ fontSize: '1.2rem' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dia</label>
                <select className="search-input" value={form.dia_atendimento} onChange={e => setForm(f => ({ ...f, dia_atendimento: e.target.value }))}>
                  <option>Dia 1</option>
                  <option>Dia 2</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tipo de Tratamento</label>
                <select className="search-input" value={form.tipo_tratamento} onChange={e => setForm(f => ({ ...f, tipo_tratamento: e.target.value }))}>
                  <option>Cura Espiritual</option>
                  <option>Socorro Espiritual</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nome *</label>
              <input className="search-input" style={{ width: '100%' }} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telefone</label>
                <input className="search-input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nascimento</label>
                <input type="date" className="search-input" value={form.nascimento} onChange={e => setForm(f => ({ ...f, nascimento: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Idade</label>
                <input className="search-input" type="number" value={form.idade} onChange={e => setForm(f => ({ ...f, idade: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rua</label>
                <input className="search-input" value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Número</label>
                <input className="search-input" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Complemento</label>
                <input className="search-input" value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bairro</label>
                <input className="search-input" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cidade</label>
                <input className="search-input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado (UF)</label>
              <input className="search-input" style={{ maxWidth: '80px' }} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} maxLength={2} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Queixa 1 *</label>
              <input className="search-input" style={{ width: '100%' }} value={form.queixa1} onChange={e => setForm(f => ({ ...f, queixa1: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Queixa 2</label>
              <input className="search-input" style={{ width: '100%' }} value={form.queixa2} onChange={e => setForm(f => ({ ...f, queixa2: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Queixa 3</label>
              <input className="search-input" style={{ width: '100%' }} value={form.queixa3} onChange={e => setForm(f => ({ ...f, queixa3: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</button>
              <button className="btn-secondary" onClick={() => imprimirFichaUnica(editando)} disabled={salvando} title="Imprimir ficha atual">📄 Imprimir</button>
              <button className="btn-primary" onClick={salvarEdicao} disabled={salvando}>
                {salvando ? 'Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
