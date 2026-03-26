import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { imprimirFichaUnica, imprimirFichasLote } from '../services/pdfService';
import TopMenu from '../components/TopMenu';

export default function Triagem() {
  const [listaPacientes, setListaPacientes] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarPacientes();
  }, []);

  const carregarPacientes = async () => {
    setCarregando(true);
    try {
      const res = await api.get('/pacientes');
      setListaPacientes(res.data);
    } catch (error) {
      toast.error('Erro ao listar pacientes');
    } finally {
      setCarregando(false);
    }
  };

  const deletarPaciente = async (id) => {
    if (confirm('Remover paciente definitivamente?')) {
      try {
        await api.delete(`/pacientes/${id}`);
        toast.success('Paciente removido com sucesso');
        carregarPacientes();
      } catch (err) {
        toast.error('Erro ao remover paciente');
      }
    }
  };

  const pacientesFiltrados = listaPacientes.filter(p => 
    p.nome.toLowerCase().includes(termoBusca.toLowerCase()) || 
    p.senha_atendimento.toString() === termoBusca
  );

  return (
    <div className="app-wrapper">
      <div className="main-container config-view">
        <TopMenu />
        
        <div className="table-container">
          <div className="table-header-controls">
            <input 
              type="text" 
              className="search-input" 
              placeholder="🔍 Buscar por Nome ou Senha..." 
              value={termoBusca} 
              onChange={e => setTermoBusca(e.target.value)} 
            />
            <button 
              className="btn-secondary" 
              onClick={() => imprimirFichasLote(pacientesFiltrados)}
              disabled={pacientesFiltrados.length === 0}
            >
              🖨️ IMPRIMIR TODOS (LOTE)
            </button>
          </div>
          
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Senha</th>
                  <th>Tipo</th>
                  <th>Paciente</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <em>Carregando dados estruturados...</em>
                    </td>
                  </tr>
                ) : pacientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum paciente encontrado.</td>
                  </tr>
                ) : (
                  pacientesFiltrados.map(p => (
                    <tr key={p.id}>
                        <td><strong>{p.senha_atendimento}</strong></td>
                        <td>{p.tipo_tratamento}</td>
                        <td>{p.nome}</td>
                        <td className="action-buttons">
                            {/* <button className="btn-action btn-edit" title="Editar Ficha">✏️</button> - Edit route could be added later */}
                            
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
