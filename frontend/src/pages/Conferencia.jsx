import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import TopMenu from '../components/TopMenu';

export default function Conferencia() {
  const [eventos, setEventos] = useState([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  const [diaFiltro, setDiaFiltro] = useState('Dia 1');
  const [listaPacientes, setListaPacientes] = useState([]);
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

  const toggleEntregue = async (p) => {
    const novoValor = !p.entregue;
    setListaPacientes(prev => prev.map(x => x.id === p.id ? { ...x, entregue: novoValor } : x));
    try {
      await api.put(`/pacientes/${p.id}/entregue`, { entregue: novoValor });
    } catch {
      setListaPacientes(prev => prev.map(x => x.id === p.id ? { ...x, entregue: !novoValor } : x));
      toast.error('Erro ao atualizar entrega');
    }
  };

  const togglePreferencial = async (p) => {
    const novoValor = !p.preferencial;
    setListaPacientes(prev => prev.map(x => x.id === p.id ? { ...x, preferencial: novoValor } : x));
    try {
      await api.put(`/pacientes/${p.id}/preferencial`, { preferencial: novoValor });
    } catch {
      setListaPacientes(prev => prev.map(x => x.id === p.id ? { ...x, preferencial: !novoValor } : x));
      toast.error('Erro ao atualizar preferencial');
    }
  };

  const senhas = listaPacientes
    .filter(p => p.evento_id == eventoSelecionadoId
      && p.dia_atendimento === diaFiltro
      && p.tipo_tratamento === 'Cura Espiritual'
      && p.senha_atendimento != null)
    .sort((a, b) => a.senha_atendimento - b.senha_atendimento);

  const primeira = senhas.length ? senhas[0].senha_atendimento : null;
  const ultima = senhas.length ? senhas[senhas.length - 1].senha_atendimento : null;
  const entregues = senhas.filter(p => p.entregue).length;
  const preferenciais = senhas.filter(p => p.preferencial).length;

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
                onChange={e => setEventoSelecionadoId(e.target.value)}
              >
                {eventos.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.nome}</option>
                ))}
              </select>
            )}

            {/* Filtro por dia */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['Dia 1', 'Dia 2'].map(d => (
                <button
                  key={d}
                  className={diaFiltro === d ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={() => setDiaFiltro(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Resumo da conferência */}
          <div style={{ padding: '10px 4px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>🔢 <strong>{senhas.length}</strong> senha(s)</span>
            {primeira != null && <span>Faixa: <strong>{primeira}</strong> a <strong>{ultima}</strong></span>}
            <span>✔️ Entregues: <strong>{entregues}</strong> / {senhas.length}</span>
            <span>⭐ Preferenciais: <strong>{preferenciais}</strong></span>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Senha</th>
                  <th>Paciente</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Entregue</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Preferencial</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <em>Carregando...</em>
                    </td>
                  </tr>
                ) : senhas.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma senha emitida para {diaFiltro}.
                    </td>
                  </tr>
                ) : (
                  senhas.map((p) => (
                    <tr key={p.id} style={p.preferencial ? { background: '#fff7e6' } : (p.entregue ? { background: '#f0fdf4' } : {})}>
                      <td><strong>{p.senha_atendimento}</strong></td>
                      <td>{p.preferencial && '⭐ '}{p.nome}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!p.entregue}
                          onChange={() => toggleEntregue(p)}
                          style={{ width: '20px', height: '20px', margin: 0, padding: 0, cursor: 'pointer', accentColor: 'var(--accent)' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!p.preferencial}
                          onChange={() => togglePreferencial(p)}
                          style={{ width: '20px', height: '20px', margin: 0, padding: 0, cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
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
