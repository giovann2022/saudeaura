import { useState, useEffect } from 'react'
import axios from 'axios'
import { jsPDF } from 'jspdf'
import './App.css'

function App() {
  const [estaLogado, setEstaLogado] = useState(false); const [perfilUsuario, setPerfilUsuario] = useState(''); const [nomeLogado, setNomeLogado] = useState('');
  const [usuario, setUsuario] = useState(''); const [senha, setSenha] = useState(''); const [erroLogin, setErroLogin] = useState('');
  const [telaAtual, setTelaAtual] = useState('cadastro'); const [subTelaConfig, setSubTelaConfig] = useState('eventos');

  const [listaEventos, setListaEventos] = useState([]); const [listaPacientes, setListaPacientes] = useState([]); const [listaUsuarios, setListaUsuarios] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('');
  
  // FORMULÁRIO DE CADASTRO / EDIÇÃO PACIENTE
  const [idPacienteEdicao, setIdPacienteEdicao] = useState(null);
  const [dia, setDia] = useState('Dia 1'); const [tipoTratamento, setTipoTratamento] = useState('Socorro Espiritual');
  const [nome, setNome] = useState(''); const [telefone, setTelefone] = useState(''); const [nascimento, setNascimento] = useState(''); const [idade, setIdade] = useState('');
  const [rua, setRua] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState('Brotas'); const [estado, setEstado] = useState('SP');
  const [queixa1, setQueixa1] = useState(''); const [queixa2, setQueixa2] = useState(''); const [queixa3, setQueixa3] = useState('');
  const [mensagem, setMensagem] = useState('');

  // FORMULÁRIO DE ADMIN (CONFIGURAÇÕES DE EVENTO E USUÁRIO)
  const [idEdicaoEvento, setIdEdicaoEvento] = useState(null);
  const [novoEvento, setNovoEvento] = useState({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' });
  const [novoUsu, setNovoUsu] = useState({ nome: '', usuario: '', senha: '', perfil: 'voluntario' });
  const [msgAdmin, setMsgAdmin] = useState('');

  const formatarDataBR = (d) => { if(!d) return ''; const p = d.split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
  const carregarImagens = (srcs) => Promise.all(srcs.map(src => new Promise((resolve) => { const img = new Image(); img.src = src; img.onload = () => resolve(img); img.onerror = () => resolve(null); })));

  const buscarTudo = async () => {
    try {
      const resE = await axios.get('https://api.saudeaura.site/eventos'); setListaEventos(resE.data);
      if (resE.data.length > 0 && !eventoSelecionadoId) setEventoSelecionadoId(resE.data[0].id);
      const resP = await axios.get('https://api.saudeaura.site/pacientes'); setListaPacientes(resP.data);
      const resU = await axios.get('https://api.saudeaura.site/usuarios'); setListaUsuarios(resU.data);
    } catch (e) {}
  }

  useEffect(() => { if (estaLogado) buscarTudo(); }, [estaLogado, telaAtual]);

// === PDF 1: COMPROVANTE DO PACIENTE ===
  const gerarPDFRecibo = async (senhaS, nomeP, diaE, tipoT) => {
    const ev = listaEventos.find(e => e.id == eventoSelecionadoId);
    if (!ev) return;
    const doc = new jsPDF();
    const dataR = diaE === 'Dia 1' ? formatarDataBR(ev.data_dia1) : formatarDataBR(ev.data_dia2);
    
    // 👇 ADICIONE ESTA LINHA ABAIXO (O que faltava!) 👇
    const dataArquivo = dataR.replace(/\//g, '-'); 
    
    const [imgLogo] = await carregarImagens(['/logo.png']);
    
    if (imgLogo) doc.addImage(imgLogo, 'PNG', 165, 10, 30, 30);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text(ev.nome.toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(14); doc.setTextColor(100);
    doc.text(tipoT.toUpperCase(), 105, 30, { align: 'center' });
    
    doc.setFontSize(50); doc.setTextColor(39, 174, 96);
    doc.text(`SENHA: ${senhaS}`, 105, 55, { align: 'center' });
    
    doc.setFontSize(12); doc.setTextColor(0); doc.setFont(undefined, 'normal');
    doc.text(`Paciente: ${nomeP}`, 20, 80); 
    doc.text(`Data do Atendimento: ${dataR}`, 20, 88);
    doc.text(`Local: ${ev.local_atendimento}`, 20, 105);
    
    doc.setFont(undefined, 'bold'); doc.text("Instruções Importantes:", 20, 120);
    doc.setFont(undefined, 'normal');
    doc.text(doc.splitTextToSize(ev.instrucoes_pdf, 170), 20, 128);

    doc.setDrawColor(200); doc.line(20, 260, 190, 260);
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Instagram: ${ev.insta || '-'}  |  WhatsApp: ${ev.whats || '-'}`, 105, 270, { align: 'center' });
    doc.text(`E-mail: ${ev.email || '-'}  |  Site: ${ev.site || '-'}`, 105, 276, { align: 'center' });
    
    // Agora o dataArquivo vai funcionar!
    doc.save(`Comprovantes_${dataArquivo}_Senha_${senhaS}.pdf`);
  }

  // === PDF 2: FICHA DO PRONTUÁRIO (Sem a Senha/Data da Impressão) ===
  const desenharFichaNoDoc = (doc, p, imgLogo) => {
    const dataAtendimento = p.dia_atendimento === 'Dia 1' ? formatarDataBR(p.data_dia1) : formatarDataBR(p.data_dia2);
    
    if (imgLogo) { doc.addImage(imgLogo, 'PNG', 170, 8, 25, 25); }
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`SENHA: ${p.senha_atendimento}`, 20, 33);
    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text(p.nome_evento.toUpperCase(), 105, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.text(`${p.tipo_tratamento.toUpperCase()} - PRONTUÁRIO (${dataAtendimento})`, 105, 25, { align: 'center' });
    
    doc.setLineWidth(0.5); doc.line(20, 35, 190, 35);
    
    // 👇 Dados do paciente reposicionados para cobrir o espaço vago 👇
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(`NOME: ${p.nome.toUpperCase()}`, 20, 42);
    doc.text(`Nascimento: ${formatarDataBR(p.nascimento)} | Idade: ${p.idade} anos | Tel: ${p.telefone}`, 20, 50);
    doc.text(`Endereço: ${p.endereco}, ${p.numero} ${p.complemento || ''}`, 20, 58);
    doc.text(`Bairro: ${p.bairro} | Cidade: ${p.cidade} - ${p.estado}`, 20, 66);
    
    doc.line(20, 70, 190, 70);
    doc.setFont(undefined, 'bold'); doc.text("QUEIXAS:", 20, 78); doc.setFont(undefined, 'normal');
    
    doc.text(`1. ${p.queixa1 || ''}`, 20, 86);
    
    // Se for Cura Espiritual, mostra as 3 queixas e o Termo de Responsabilidade
    if(p.tipo_tratamento === 'Cura Espiritual') {
        doc.text(`2. ${p.queixa2 || ''}`, 20, 94); 
        doc.text(`3. ${p.queixa3 || ''}`, 20, 102);
        
        doc.line(20, 108, 190, 108);
        doc.setFont(undefined, 'bold'); 
        doc.text("Termo de Responsabilidade:", 20, 118); 
        doc.setFont(undefined, 'normal');
        
        const termo = "Declaro conhecer as normas sobre o tratamento espiritual que inicio hoje de livre e espontânea vontade. Declaro ainda que não abandonarei os serviços médicos e a medicação receitada considerando este tratamento como uma alternativa complementar.";
        doc.text(doc.splitTextToSize(termo, 170), 20, 126);
        
        doc.text("____________________, _____ de _______________ de _______", 20, 152);
        doc.text("Assinatura: ___________________________________________________________", 20, 172);
    }
  }

  const cadastrarPaciente = async (e) => {
    e.preventDefault(); setMensagem('Processando...');
    const dados = { evento_id: eventoSelecionadoId, dia_atendimento: dia, tipo_tratamento: tipoTratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3 };
    try {
      if (idPacienteEdicao) {
        await axios.put(`https://api.saudeaura.site/pacientes/${idPacienteEdicao}`, dados);
        setMensagem('✅ Registro atualizado!');
      } else {
        const res = await axios.post('https://api.saudeaura.site/pacientes', dados);
        setMensagem(`✅ Sucesso! Senha ${res.data.senha}`); 
        gerarPDFRecibo(res.data.senha, nome, dia, tipoTratamento);
      }
      setIdPacienteEdicao(null); buscarTudo(); setNome(''); setRua(''); setNumero(''); setComplemento(''); setBairro(''); setQueixa1(''); setQueixa2(''); setQueixa3('');
    } catch (err) { setMensagem(err.response?.data?.erro || 'Erro'); }
  }

  const prepararEdicaoPaciente = (p) => {
    setIdPacienteEdicao(p.id); setEventoSelecionadoId(p.evento_id); setDia(p.dia_atendimento); setTipoTratamento(p.tipo_tratamento); setNome(p.nome); setTelefone(p.telefone);
    setNascimento(p.nascimento ? p.nascimento.split('T')[0] : ''); setIdade(p.idade); setRua(p.endereco); setNumero(p.numero); setComplemento(p.complemento); setBairro(p.bairro); setCidade(p.cidade); setEstado(p.estado);
    setQueixa1(p.queixa1); setQueixa2(p.queixa2); setQueixa3(p.queixa3); setTelaAtual('cadastro'); window.scrollTo(0,0);
  }

  const lidarComEvento = async (e) => {
    e.preventDefault();
    try {
      if (idEdicaoEvento) {
        const res = await axios.put(`https://api.saudeaura.site/eventos/${idEdicaoEvento}`, novoEvento);
        setMsgAdmin(res.data.mensagem);
      } else {
        const res = await axios.post('https://api.saudeaura.site/eventos', novoEvento);
        setMsgAdmin(res.data.mensagem);
      }
      setIdEdicaoEvento(null);
      setNovoEvento({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' });
      buscarTudo();
    } catch (err) { setMsgAdmin(err.response?.data?.erro || 'Erro'); }
  }

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
  }

  const pacientesFiltrados = listaPacientes.filter(p => p.nome.toLowerCase().includes(termoBusca.toLowerCase()) || p.senha_atendimento.toString() === termoBusca);
  const eventoAtual = listaEventos.find(e => e.id == eventoSelecionadoId);

if (!estaLogado) return (
  <div className="app-wrapper auth-container">
    <div className="card" style={{ maxWidth: '400px' }}>
      <h2 className="card-header">
        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>🩺</span>
        Cadastro de Atendimento
      </h2>
      <form onSubmit={async (e) => { 
        e.preventDefault(); 
        setErroLogin(''); 
        try { 
          const r = await axios.post('https://api.saudeaura.site/login', { usuario, senha }); 
          setEstaLogado(true); 
          setPerfilUsuario(r.data.perfil); 
          setNomeLogado(r.data.nome); 
        } catch(err) { 
          setErroLogin('Usuário ou senha incorretos'); 
        } 
      }}>
        <div className="form-group">
          <label>Utilizador</label>
          <input type="text" placeholder="Digite seu usuário..." onChange={e => setUsuario(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input type="password" placeholder="Digite sua senha..." onChange={e => setSenha(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>ENTRAR</button>
        
        {erroLogin && <div className="feedback-msg msg-error">⚠️ {erroLogin}</div>}
      </form>
    </div>
  </div>
);

return (
  <div className="app-wrapper">
    <div className={`main-container ${telaAtual === 'admin' || telaAtual === 'config' ? 'config-view' : ''}`}>
      <div className="top-menu">
        <button onClick={() => { setTelaAtual('cadastro'); setIdPacienteEdicao(null); }} className={`menu-btn ${telaAtual==='cadastro'?'active':''}`}>📝 Cadastro</button>
        <button onClick={() => setTelaAtual('admin')} className={`menu-btn ${telaAtual==='admin'?'active':''}`}>📋 Triagem</button>
        {perfilUsuario === 'admin' && <button onClick={() => setTelaAtual('config')} className={`menu-btn ${telaAtual==='config'?'active':''}`}>⚙️ Configurações</button>}
        <button onClick={() => setEstaLogado(false)} className="menu-btn btn-logout">🚪 Sair</button>
      </div>

      {telaAtual === 'cadastro' && (
        <div className="card">
          <h2 className="card-header">{idPacienteEdicao ? '✏️ Editar Registro' : 'Novo Registro'}</h2>
          
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
                  <label>Data de Nascimento</label>
                  <input type="date" value={nascimento} onChange={e => { setNascimento(e.target.value); setIdade(new Date().getFullYear() - new Date(e.target.value).getFullYear()); }} required />
                </div>
                <div className="form-col">
                  <label>Telefone</label>
                  <input type="text" placeholder="(DD) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} required />
                </div>
              </div>
            </div>

            <div className="section-block">
              <h3 className="section-title">Endereço</h3>
              <div className="form-group">
                <label>Rua / Avenida</label>
                <input type="text" placeholder="Endereço completo" value={rua} onChange={e => setRua(e.target.value)} required />
              </div>
              
              <div className="form-row">
                <div className="form-col-small">
                  <label>Número</label>
                  <input type="text" placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} required />
                </div>
                <div className="form-col">
                  <label>Complemento</label>
                  <input type="text" placeholder="Casa, Apto, Bloco..." value={complemento} onChange={e => setComplemento(e.target.value)} />
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
            
            <button type="submit" className={idPacienteEdicao ? 'btn-secondary btn-primary' : 'btn-primary'} style={{ padding: '15px' }}>
              {idPacienteEdicao ? 'ATUALIZAR REGISTRO' : 'SALVAR E IMPRIMIR SENHA'}
            </button>
            
            {mensagem && (
              <div className={`feedback-msg ${mensagem.includes('🚫') || mensagem.includes('Erro') ? 'msg-error' : (mensagem.includes('Processando') ? 'msg-processing' : 'msg-success')}`}>
                {mensagem}
              </div>
            )}
          </form>
        </div>
      )}

      {telaAtual === 'admin' && (
        <div className="table-container">
          <div className="table-header-controls">
            <input 
              type="text" 
              className="search-input" 
              placeholder="🔍 Buscar por Nome ou Senha..." 
              value={termoBusca} 
              onChange={e => setTermoBusca(e.target.value)} 
            />
            <button className="btn-secondary" onClick={async () => { 
                const doc = new jsPDF(); const [imgLogo] = await carregarImagens(['/logo.png']);
                pacientesFiltrados.forEach((p, i) => { if(i>0) doc.addPage(); desenharFichaNoDoc(doc, p, imgLogo); });
                doc.save('Fichas_Lote.pdf');
            }}>🖨️ IMPRIMIR TODOS (LOTE)</button>
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
                {pacientesFiltrados.length === 0 ? (
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
                            <button className="btn-action btn-edit" onClick={() => prepararEdicaoPaciente(p)} title="Editar Ficha">✏️</button>
                            
                            <button className="btn-action btn-print" onClick={async () => {
                                const doc = new jsPDF(); 
                                const [imgLogo] = await carregarImagens(['/logo.png']);
                                desenharFichaNoDoc(doc, p, imgLogo);
                                
                                const dAtend = p.dia_atendimento === 'Dia 1' ? formatarDataBR(p.data_dia1) : formatarDataBR(p.data_dia2);
                                const dataArquivo = dAtend.replace(/\//g, '-');
                                const tipoResumido = p.tipo_tratamento.includes('Cura') ? 'Cura' : 'Socorro';
                                
                                doc.save(`${dataArquivo}_Senha_${p.senha_atendimento}_${tipoResumido}.pdf`);
                            }} title="Imprimir Prontuário">📄</button>
                            
                            <button className="btn-action btn-delete" onClick={async () => { if(confirm('Remover paciente definitivamente?')) { await axios.delete(`https://api.saudeaura.site/pacientes/${p.id}`); buscarTudo(); } }} title="Excluir Registro">🗑️</button>
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {telaAtual === 'config' && (
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
                  
                  <div className="form-row">
                      <div className="form-col">
                        <button type="submit" className={idEdicaoEvento ? 'btn-secondary btn-primary' : 'btn-primary'}>{idEdicaoEvento ? 'ATUALIZAR EVENTO' : 'ATIVAR NOVO EVENTO'}</button>
                      </div>
                      {idEdicaoEvento && (
                        <div className="form-col">
                          <button type="button" className="btn-outline" onClick={() => { setIdEdicaoEvento(null); setNovoEvento({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' }); }}>CANCELAR EDIÇÃO</button>
                        </div>
                      )}
                  </div>
                </form>
                
                {msgAdmin && (
                  <div className={`feedback-msg ${msgAdmin.includes('✅') ? 'msg-success' : 'msg-error'}`}>
                    {msgAdmin}
                  </div>
                )}
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
                      <button className="btn-action btn-delete" title="Apagar Definitivamente" onClick={async () => { if(confirm('Apagar Evento e Pacientes? Cuidado, ação irreversível!')) { await axios.delete(`https://api.saudeaura.site/eventos/${ev.id}`); buscarTudo(); } }}>🗑️</button>
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
                <form onSubmit={async (e) => { e.preventDefault(); try { const r = await axios.post('https://api.saudeaura.site/usuarios', novoUsu); setMsgAdmin(r.data.mensagem); buscarTudo(); } catch(e){ setMsgAdmin('Erro'); } }}>
                  <div className="form-row">
                    <div className="form-col">
                      <label>Nome Completo</label>
                      <input type="text" placeholder="Ex: João Silva" onChange={e => setNovoUsu({...novoUsu, nome: e.target.value})} required />
                    </div>
                    <div className="form-col">
                      <label>Login (Utilizador)</label>
                      <input type="text" placeholder="joaosilva" onChange={e => setNovoUsu({...novoUsu, usuario: e.target.value})} required />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-col">
                      <label>Senha</label>
                      <input type="password" placeholder="***" onChange={e => setNovoUsu({...novoUsu, senha: e.target.value})} required />
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

                {msgAdmin && (
                  <div className={`feedback-msg ${msgAdmin.includes('Criado') || msgAdmin.includes('Sucesso') || msgAdmin.includes('✅') ? 'msg-success' : 'msg-error'}`}>
                    {msgAdmin}
                  </div>
                )}
              </div>

              <h3 className="section-title">Contas Cadastradas</h3>
              <div className="list-container">
                {listaUsuarios.map(u => (
                  <div key={u.id} className="list-item">
                    <div className="list-item-content">
                      <span className="list-item-title">{u.nome} <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)'}}>({u.usuario})</span></span>
                      <span className="list-item-subtitle">Nível: <strong>{u.perfil}</strong></span>
                    </div>
                    <button className="btn-action btn-delete" title="Remover Utilizador" onClick={async () => { if(confirm(`Remover acesso de ${u.nome}?`)) { await axios.delete(`https://api.saudeaura.site/usuarios/${u.id}`); buscarTudo(); } }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
}

export default App