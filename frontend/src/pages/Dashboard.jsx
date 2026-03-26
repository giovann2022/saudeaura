import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import TopMenu from '../components/TopMenu';

export default function Dashboard() {
  const [listaEventos, setListaEventos] = useState([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      setCarregando(true);
      const res = await api.get('/eventos');
      setListaEventos(res.data);
      if (res.data.length > 0) setEventoSelecionadoId(res.data[0].id);
    } catch (error) {
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setCarregando(false);
    }
  };

  const eventoAtual = listaEventos.find(e => e.id == eventoSelecionadoId);

  const formatarDataBR = (d) => {
    if(!d) return 'Sem Data';
    const p = d.split('T')[0].split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  };

  const renderProgressBar = (ocupadas, totais) => {
    const p = totais > 0 ? (ocupadas / totais) * 100 : 0;
    const percent = p > 100 ? 100 : p;
    return (
      <div className="day-container">
        <div className="progress-info">
          <span>Ocupadas: <strong>{ocupadas}</strong> / {totais}</span>
          <span style={{ color: percent > 90 ? 'var(--danger)' : 'inherit' }}>
            {Math.round(percent)}% Cheio
          </span>
        </div>
        <div className="progress-bg">
          <div className="progress-fill" style={{ width: `${percent}%`, background: percent > 90 ? 'var(--danger)' : '' }}></div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Vagas Livres: <strong style={{color: 'var(--accent)'}}>{totais - ocupadas}</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="app-wrapper">
      <div className="main-container">
        <TopMenu />
        
        <div className="card">
          <div className="table-header-controls" style={{ marginBottom: '15px' }}>
            <h2 className="card-header" style={{ marginBottom: 0 }}>📊 Dashboard</h2>
            {listaEventos.length > 0 && (
              <select 
                className="search-input" 
                style={{ maxWidth: '300px', padding: '10px 20px', cursor: 'pointer' }}
                value={eventoSelecionadoId} 
                onChange={e => setEventoSelecionadoId(e.target.value)}
              >
                {listaEventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
              </select>
            )}
          </div>
          
          {carregando ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>A Carregar Dados...</div>
          ) : !eventoAtual ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Nenhum evento ativo disponível.</div>
          ) : (
            <>
              {/* KPIs focused on Single Event */}
              <div className="dashboard-grid">
                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <span className="stat-header">Atendimentos Deste Evento</span>
                  <span className="stat-value">{eventoAtual.ocupadas_dia1 + eventoAtual.ocupadas_dia2}</span>
                </div>
                
                <div className="stat-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <span className="stat-header">Vagas Totais Livres (D1+D2)</span>
                  <span className="stat-value" style={{ color: 'var(--accent)' }}>
                     {(eventoAtual.vagas_dia1 + eventoAtual.vagas_dia2) - (eventoAtual.ocupadas_dia1 + eventoAtual.ocupadas_dia2)}
                  </span>
                </div>
                
                <div className="stat-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
                  <span className="stat-header">Capacidade Base</span>
                  <span className="stat-value" style={{ color: 'var(--secondary)' }}>{eventoAtual.vagas_dia1 + eventoAtual.vagas_dia2}</span>
                </div>
              </div>

              {/* Event Progress Breakdown */}
              <h3 className="section-title">Ocupação Separada por Dia</h3>
              
              <div className="event-box" style={{ border: '2px solid var(--border-focus)', boxShadow: 'var(--shadow-md)' }}>
                <div className="event-box-title">📍 {eventoAtual.nome} <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '10px'}}>(Visualização Focada)</span></div>
                
                <div className="day-grid">
                  <div>
                    <div className="day-header">
                      <span className="day-label">🗓️ Dia 1</span>
                      <span className="day-date">{formatarDataBR(eventoAtual.data_dia1)}</span>
                    </div>
                    {renderProgressBar(eventoAtual.ocupadas_dia1, eventoAtual.vagas_dia1)}
                  </div>
                  
                  <div>
                    <div className="day-header">
                      <span className="day-label">🗓️ Dia 2</span>
                      <span className="day-date">{formatarDataBR(eventoAtual.data_dia2)}</span>
                    </div>
                    {renderProgressBar(eventoAtual.ocupadas_dia2, eventoAtual.vagas_dia2)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
