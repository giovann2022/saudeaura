import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { imprimirFichaUnica, imprimirFichasLote } from '../services/pdfService';
import TopMenu from '../components/TopMenu';

export default function Triagem() {
  const [eventos, setEventos] = useState([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  const [diaFiltro, setDiaFiltro] = useState('todos');
  const [listaPacientes, setListaPacientes] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

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
      return p.nome.toLowerCase().includes(busca) || p.senha_atendimento.toString() === termoBusca;
    }
    return true;
  });

  const eventoAtual = eventos.find(e => e.id == eventoSelecionadoId);

  return (
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
                      <td><strong>{p.senha_atendimento}</strong></td>
                      <td>{p.dia_atendimento}</td>
                      <td>{p.tipo_tratamento}</td>
                      <td>{p.nome}</td>
                      <td className="action-buttons">
                        <button className="btn-action btn-print" onClick={() => imprimirFichaUnica(p)} title="Imprimir Prontuário">📄</button>
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
  );
}
