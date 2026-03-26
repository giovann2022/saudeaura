import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import api from '../services/api';
import { gerarPDFRecibo } from '../services/pdfService';
import TopMenu from '../components/TopMenu';

export default function Cadastro() {
  const [listaEventos, setListaEventos] = useState([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  
  const [dia, setDia] = useState('Dia 1'); 
  const [tipoTratamento, setTipoTratamento] = useState('Socorro Espiritual');
  
  // Fields
  const [nome, setNome] = useState(''); 
  const [telefone, setTelefone] = useState(''); 
  const [nascimento, setNascimento] = useState(''); 
  const [idade, setIdade] = useState('');
  
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState(''); 
  const [numero, setNumero] = useState(''); 
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState(''); 
  const [cidade, setCidade] = useState(''); 
  const [estado, setEstado] = useState('');
  
  const [queixa1, setQueixa1] = useState(''); 
  const [queixa2, setQueixa2] = useState(''); 
  const [queixa3, setQueixa3] = useState('');
  
  const [carregando, setCarregando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    carregarEventos();
  }, []);

  const carregarEventos = async () => {
    try {
      const res = await api.get('/eventos');
      setListaEventos(res.data);
      if (res.data.length > 0) setEventoSelecionadoId(res.data[0].id);
    } catch (error) {
      toast.error('Erro ao carregar eventos ativos');
    }
  };

  const eventoAtual = listaEventos.find(e => e.id == eventoSelecionadoId);

  const formatarDataBR = (d) => { if(!d) return ''; const p = d.split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

  const handleNascimento = (val) => {
    // Formata DD/MM/AAAA
    let v = val.replace(/\D/g, '');
    if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
    if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
    setNascimento(v);
    
    if(v.length === 10) {
      const parts = v.split('/');
      if (parts.length === 3) {
        const ano = parseInt(parts[2], 10);
        const atual = new Date().getFullYear();
        if (ano > 1900 && ano <= atual) setIdade(atual - ano);
      }
    }
  };

  const handleTelefone = (val) => {
    // Formata (99) 99999-9999
    let v = val.replace(/\D/g, '');
    if (v.length > 0) v = '(' + v;
    if (v.length > 3) v = v.substring(0, 3) + ') ' + v.substring(3);
    if (v.length > 10) v = v.substring(0, 10) + '-' + v.substring(10, 14);
    setTelefone(v);
  };

  const handleCep = (val) => {
    let v = val.replace(/\D/g, '');
    if (v.length > 5) v = v.substring(0, 5) + '-' + v.substring(5, 8);
    setCep(v);
  };

  // Para fins de banco, precisa-se converter DD/MM/AAAA para AAAA-MM-DD
  const formatarDataIso = (dBR) => {
      if(!dBR || dBR.length < 10) return null;
      const [dia, mes, ano] = dBR.split('/');
      return `${ano}-${mes}-${dia}`;
  }

  const buscarCepAPI = async (valor) => {
    const cepLimpo = valor.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    
    setBuscandoCep(true);
    try {
      const { data } = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (data.erro) {
        toast.error('CEP não encontrado');
      } else {
        setRua(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setEstado(data.uf || '');
        toast.success('Endereço autocompletado!');
      }
    } catch (e) {
      toast.error('Falha ao procurar CEP');
    } finally {
      setBuscandoCep(false);
    }
  };

  const limparFormulario = () => {
    setNome(''); setTelefone(''); setNascimento(''); setIdade('');
    setCep(''); setRua(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setEstado('');
    setQueixa1(''); setQueixa2(''); setQueixa3('');
  };

  const cadastrarPaciente = async (e) => {
    e.preventDefault(); 
    setCarregando(true);
    toast.loading('Processando...', { id: 'submit-paciente' });
    
    const dados = { 
      evento_id: eventoSelecionadoId, 
      dia_atendimento: dia, 
      tipo_tratamento: tipoTratamento, 
      nome, 
      telefone, 
      nascimento: formatarDataIso(nascimento), 
      idade, 
      rua, numero, complemento, bairro, cidade, estado, 
      queixa1, queixa2, queixa3 
    };
    
    try {
      const res = await api.post('/pacientes', dados);
      toast.success(`Sucesso! Senha gerada: ${res.data.senha}`, { id: 'submit-paciente' });
      await gerarPDFRecibo(res.data.senha, nome, dia, tipoTratamento, eventoAtual);
      limparFormulario();
      carregarEventos(); // Refresh vagas
    } catch (err) { 
      toast.error(err.response?.data?.erro || 'Erro ao registrar paciente', { id: 'submit-paciente' }); 
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="main-container">
        <TopMenu />
        
        <div className="card">
          <h2 className="card-header">📝 Novo Registro</h2>
          
          <form onSubmit={cadastrarPaciente}>
            <div className="section-block">
              <div className="form-group">
                <label>Selecione o Evento</label>
                <select value={eventoSelecionadoId} onChange={e => setEventoSelecionadoId(e.target.value)} required>
                  {listaEventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                </select>
              </div>

              {eventoAtual && (
                <div className="info-block">
                  Vagas Disponíveis: <strong>{dia === 'Dia 1' ? (eventoAtual.vagas_dia1 - eventoAtual.ocupadas_dia1) : (eventoAtual.vagas_dia2 - eventoAtual.ocupadas_dia2)}</strong>
                </div>
              )}

              <div className="form-row">
                <div className="form-col">
                  <label>Tipo de Tratamento</label>
                  <select value={tipoTratamento} onChange={e => setTipoTratamento(e.target.value)}>
                    <option value="Socorro Espiritual">Socorro Espiritual</option>
                    <option value="Cura Espiritual">Cura Espiritual</option>
                  </select>
                </div>
                <div className="form-col">
                  <label>Dia do Atendimento</label>
                  <select value={dia} onChange={e => setDia(e.target.value)}>
                    <option value="Dia 1">Dia 1 - {eventoAtual ? formatarDataBR(eventoAtual.data_dia1) : ''}</option>
                    <option value="Dia 2">Dia 2 - {eventoAtual ? formatarDataBR(eventoAtual.data_dia2) : ''}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Dados Pessoais</h3>
              <div className="form-group">
                <label>Nome Completo</label>
                <input type="text" placeholder="Nome completo do paciente" value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              
              <div className="form-row">
                <div className="form-col">
                  <label>Data de Nascimento (DD/MM/AAAA)</label>
                  <input type="text" placeholder="00/00/0000" value={nascimento} onChange={e => handleNascimento(e.target.value)} required />
                </div>
                <div className="form-col">
                  <label>Telefone</label>
                  <input type="text" placeholder="(00) 00000-0000" value={telefone} onChange={e => handleTelefone(e.target.value)} required />
                </div>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Endereço</h3>
              
              <div className="form-row">
                <div className="form-col-small" style={{width: '200px'}}>
                  <label>CEP {buscandoCep && <small>(Buscando...)</small>}</label>
                  <input type="text" placeholder="00000-000" value={cep} onChange={e => handleCep(e.target.value)} onBlur={e => buscarCepAPI(e.target.value)} />
                </div>
                <div className="form-col">
                  <label>Rua / Avenida</label>
                  <input type="text" placeholder="Logradouro..." value={rua} onChange={e => setRua(e.target.value)} required />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-col-small">
                  <label>Número</label>
                  <input type="text" placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} required />
                </div>
                <div className="form-col">
                  <label>Complemento</label>
                  <input type="text" placeholder="Apto, Bloco..." value={complemento} onChange={e => setComplemento(e.target.value)} />
                </div>
                <div className="form-col">
                  <label>Bairro</label>
                  <input type="text" placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} required />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-col">
                  <label>Cidade</label>
                  <input type="text" placeholder="Nome da cidade" value={cidade} onChange={e => setCidade(e.target.value)} required />
                </div>
                <div className="form-col-small">
                  <label>UF</label>
                  <input type="text" placeholder="UF" value={estado} onChange={e => setEstado(e.target.value)} maxLength="2" required />
                </div>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Atendimento</h3>
              <div className="form-group">
                <label>Queixa Principal</label>
                <input type="text" placeholder="Relate a queixa principal" value={queixa1} onChange={e => setQueixa1(e.target.value)} required />
              </div>
              
              {tipoTratamento === 'Cura Espiritual' && (
                <>
                  <div className="form-group">
                    <label>Queixa 2 (Opcional)</label>
                    <input type="text" placeholder="Segunda queixa..." value={queixa2} onChange={e => setQueixa2(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Queixa 3 (Opcional)</label>
                    <input type="text" placeholder="Terceira queixa..." value={queixa3} onChange={e => setQueixa3(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            
            <button type="submit" className="btn-primary" style={{ padding: '15px' }} disabled={carregando}>
              {carregando ? 'A PROCESSAR...' : 'SALVAR E IMPRIMIR SENHA'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
