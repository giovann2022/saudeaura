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

  const senhas = listaPacientes
    .filter(p => p.evento_id == eventoSelecionadoId
      && p.dia_atendimento === diaFiltro
      && p.tipo_tratamento === 'Cura Espiritual'
      && p.senha_atendimento != null)
    .sort((a, b) => a.senha_atendimento - b.senha_atendimento);

  // Monta as linhas em ordem crescente, inserindo marcadores nas senhas que faltam
  const linhas = [];
  const faltantes = [];
  if (senhas.length > 0) {
    let esperado = senhas[0].senha_atendimento;
    for (const p of senhas) {
      while (esperado < p.senha_atendimento) {
        linhas.push({ tipo: 'gap', senha: esperado });
        faltantes.push(esperado);
        esperado++;
      }
      linhas.push({ tipo: 'paciente', p });
      esperado = p.senha_atendimento + 1;
    }
  }

  const primeira = senhas.length ? senhas[0].senha_atendimento : null;
  const ultima = senhas.length ? senhas[senhas.length - 1].senha_atendimento : null;

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
            <span style={{ color: faltantes.length ? 'var(--danger)' : 'var(--accent)' }}>
              {faltantes.length
                ? `⚠️ ${faltantes.length} faltando: ${faltantes.join(', ')}`
                : '✅ Sequência completa'}
            </span>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Senha</th>
                  <th>Paciente</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <em>Carregando...</em>
                    </td>
                  </tr>
                ) : linhas.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma senha emitida para {diaFiltro}.
                    </td>
                  </tr>
                ) : (
                  linhas.map((l) => (
                    l.tipo === 'gap' ? (
                      <tr key={`gap-${l.senha}`} style={{ background: '#fef2f2' }}>
                        <td><strong style={{ color: 'var(--danger)' }}>{l.senha}</strong></td>
                        <td style={{ color: 'var(--danger)', fontStyle: 'italic' }}>
                          ⚠️ Senha não encontrada
                        </td>
                      </tr>
                    ) : (
                      <tr key={l.p.id}>
                        <td><strong>{l.p.senha_atendimento}</strong></td>
                        <td>{l.p.nome}</td>
                      </tr>
                    )
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
