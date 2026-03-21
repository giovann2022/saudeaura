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

  // === PDF 1: COMPROVANTE DO PACIENTE (Mantido com Senha e Redes Sociais) ===
  const gerarPDFRecibo = async (senhaS, nomeP, diaE, tipoT) => {
    const ev = listaEventos.find(e => e.id == eventoSelecionadoId);
    if (!ev) return;
    const doc = new jsPDF();
    const dataR = diaE === 'Dia 1' ? formatarDataBR(ev.data_dia1) : formatarDataBR(ev.data_dia2);
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
    doc.text(`${p.tipo_tratamento.toUpperCase()} - PRONTUÁRIO (${dataAtendimento})`, 20, 25);
    
    doc.setLineWidth(0.5); doc.line(20, 35, 190, 35);
    
    // 👇 Dados do paciente reposicionados para cobrir o espaço vago 👇
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(`NOME: ${p.nome.toUpperCase()}`, 20, 42);
    doc.text(`Nascimento: ${formatarDataBR(p.nascimento)} | Idade: ${p.idade} anos | Tel: ${p.telefone}`, 20, 50);
    doc.text(`Morada: ${p.endereco}, ${p.numero} ${p.complemento || ''}`, 20, 58);
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
    <div className="container" style={{ maxWidth: '400px', marginTop: '100px', textAlign: 'center' }}>
      <h2>🔒 Cadastro de Atendimento</h2>
      <form onSubmit={async (e) => { 
        e.preventDefault(); 
        setErroLogin(''); 
        try { 
          const r = await axios.post('https://api.saudeaura.site/login', { usuario, senha }); 
          setEstaLogado(true); 
          setPerfilUsuario(r.data.perfil); 
          setNomeLogado(r.data.nome); 
        } catch(err) { 
          // Mantemos apenas a mensagem amigável na tela
          setErroLogin('Usuário ou senha incorretos'); 
          // O alert foi removido daqui!
        } 
      }}>
        <input type="text" placeholder="Utilizador" onChange={e => setUsuario(e.target.value)} required />
        <input type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} required />
        <button type="submit">ENTRAR</button>
        
        {erroLogin && <p style={{ color: 'red', marginTop: '10px', fontWeight: 'bold' }}>{erroLogin}</p>}
      </form>
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: telaAtual === 'admin' ? '1100px' : '650px' }}>
      <div className="menu-topo" style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'20px'}}>
        <button onClick={() => { setTelaAtual('cadastro'); setIdPacienteEdicao(null); }} className={telaAtual==='cadastro'?'ativo':''}>📝 Cadastro</button>
        <button onClick={() => setTelaAtual('admin')} className={telaAtual==='admin'?'ativo':''}>📋 Triagem</button>
        {perfilUsuario === 'admin' && <button onClick={() => setTelaAtual('config')} className={telaAtual==='config'?'ativo':''}>⚙️ Config</button>}
        <button onClick={() => setEstaLogado(false)} style={{background:'#e74c3c', color:'white'}}>Sair</button>
      </div>

      {/* ABA DE CADASTRO */}
      {telaAtual === 'cadastro' && (
        <form onSubmit={cadastrarPaciente}>
          <h2 style={{textAlign:'center'}}>{idPacienteEdicao ? '✏️ Editar Registro' : 'Novo Registro'}</h2>
          <div className="bloco">
            <select value={eventoSelecionadoId} onChange={e => setEventoSelecionadoId(e.target.value)} required>
                {listaEventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
            </select>
          </div>

          {eventoAtual && (
             <div className="bloco" style={{background:'#f0f8ff', textAlign:'center', border:'1px solid #bde0fe', padding:'10px'}}>
                Vagas Disponíveis: <strong>{dia === 'Dia 1' ? (eventoAtual.vagas_dia1 - eventoAtual.ocupadas_dia1) : (eventoAtual.vagas_dia2 - eventoAtual.ocupadas_dia2)}</strong>
             </div>
          )}

          <div className="linha">
            <select value={tipoTratamento} onChange={e => setTipoTratamento(e.target.value)} style={{flex:1}}>
                <option value="Socorro Espiritual">Socorro Espiritual</option>
                <option value="Cura Espiritual">Cura Espiritual</option>
            </select>
            <select value={dia} onChange={e => setDia(e.target.value)} style={{flex:1}}>
                <option value="Dia 1">Dia 1 - {eventoAtual ? formatarDataBR(eventoAtual.data_dia1) : ''}</option>
                <option value="Dia 2">Dia 2 - {eventoAtual ? formatarDataBR(eventoAtual.data_dia2) : ''}</option>
            </select>
          </div>

          <div className="bloco">
            <input type="text" placeholder="Nome Completo" value={nome} onChange={e => setNome(e.target.value)} required />
            <div className="linha" style={{marginTop:'10px'}}>
                <input type="date" value={nascimento} onChange={e => { setNascimento(e.target.value); setIdade(new Date().getFullYear() - new Date(e.target.value).getFullYear()); }} required />
                <input type="text" placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} required />
            </div>
          </div>

          <div className="bloco">
            <h4>Morada</h4>
            <input type="text" placeholder="Rua / Avenida" value={rua} onChange={e => setRua(e.target.value)} required style={{marginBottom:'10px'}}/>
            <div className="linha" style={{marginBottom:'10px'}}>
                <input type="text" placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} required style={{width:'80px'}} />
                <input type="text" placeholder="Compl." value={complemento} onChange={e => setComplemento(e.target.value)} style={{flex:1}} />
                <input type="text" placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} required style={{flex:1}} />
            </div>
            <div className="linha">
                <input type="text" placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} required style={{flex:1}} />
                <input type="text" placeholder="UF" value={estado} onChange={e => setEstado(e.target.value)} maxLength="2" required style={{width:'50px'}} />
            </div>
          </div>

          <div className="bloco">
            <input type="text" placeholder="Queixa 1" value={queixa1} onChange={e => setQueixa1(e.target.value)} required />
            {tipoTratamento === 'Cura Espiritual' && <><input type="text" placeholder="Queixa 2" value={queixa2} onChange={e => setQueixa2(e.target.value)} style={{marginTop:'10px' }}/><input type="text" placeholder="Queixa 3" value={queixa3} onChange={e => setQueixa3(e.target.value)} style={{marginTop:'10px' }}/></>}
          </div>
          <button type="submit" style={{background: idPacienteEdicao ? '#2980b9' : '#27ae60', color:'white', padding:'15px', fontWeight:'bold'}}>
              {idPacienteEdicao ? 'ATUALIZAR REGISTRO' : 'SALVAR E IMPRIMIR'}
          </button>
          {mensagem && <p style={{textAlign:'center', fontWeight:'bold', marginTop:'10px', color: mensagem.includes('🚫')?'red':'green'}}>{mensagem}</p>}
        </form>
      )}

{/* ABA DE TRIAGEM */}
{telaAtual === 'admin' && (
  <div className="tabela-container">
    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
      <input type="text" placeholder="🔍 Buscar Nome ou Senha..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{padding:'10px', width:'300px'}} />
      <button onClick={async () => { 
          const doc = new jsPDF(); const [imgLogo] = await carregarImagens(['/logo.png']);
          pacientesFiltrados.forEach((p, i) => { if(i>0) doc.addPage(); desenharFichaNoDoc(doc, p, imgLogo); });
          doc.save('Fichas_Lote.pdf');
      }} style={{background:'#2980b9', color:'white', padding:'10px 20px', border:'none', borderRadius:'5px', fontWeight:'bold'}}>🖨️ IMPRIMIR TODOS (LOTE)</button>
    </div>
    <table>
      <thead><tr><th>Senha</th><th>Tipo</th><th>Paciente</th><th>Ações</th></tr></thead>
      <tbody>
        {pacientesFiltrados.map(p => (
          <tr key={p.id}>
              <td><strong>{p.senha_atendimento}</strong></td>
              <td>{p.tipo_tratamento}</td>
              <td>{p.nome}</td>
              <td>
                  <button onClick={() => prepararEdicaoPaciente(p)} style={{background:'#f1c40f', border:'none', padding:'5px 10px', borderRadius:'4px', marginRight:'5px'}} title="Editar">✏️</button>
                  
                  {/* 👇 ESTE É O BOTÃO QUE FOI ALTERADO 👇 */}
                  <button onClick={async () => {
                      const doc = new jsPDF(); 
                      const [imgLogo] = await carregarImagens(['/logo.png']);
                      desenharFichaNoDoc(doc, p, imgLogo);
                      
                      // Lógica para pegar a data e o tipo (Cura ou Socorro)
                      const dAtend = p.dia_atendimento === 'Dia 1' ? formatarDataBR(p.data_dia1) : formatarDataBR(p.data_dia2);
                      const dataArquivo = dAtend.replace(/\//g, '-');
                      const tipoResumido = p.tipo_tratamento.includes('Cura') ? 'Cura' : 'Socorro';
                      
                      // Nome: 21-03-2026_Senha_05_Cura.pdf
                      doc.save(`${dataArquivo}_Senha_${p.senha_atendimento}_${tipoResumido}.pdf`);
                  }} style={{background:'#34495e', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px', marginRight:'5px'}} title="Imprimir Ficha">📄</button>
                  
                  <button onClick={async () => { if(confirm('Remover?')) { await axios.delete(`https://api.saudeaura.site/pacientes/${p.id}`); buscarTudo(); } }} style={{background:'red', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px'}} title="Excluir">🗑️</button>
              </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

      {/* ABA DE CONFIGURAÇÕES COMPLETAS */}
      {telaAtual === 'config' && (
        <>
          <div style={{display:'flex', justifyContent:'center', gap:'10px', marginBottom:'20px'}}>
            <button onClick={() => setSubTelaConfig('eventos')} className={subTelaConfig === 'eventos' ? 'ativo' : ''}>📅 Eventos</button>
            <button onClick={() => setSubTelaConfig('usuarios')} className={subTelaConfig === 'usuarios' ? 'ativo' : ''}>👥 Utilizadores</button>
          </div>
          
          {/* SubAba: Eventos */}
          {subTelaConfig === 'eventos' && (
            <div className="bloco">
              <h3>{idEdicaoEvento ? '✏️ Editar Evento' : '⚙️ Criar Novo Evento'}</h3>
              <form onSubmit={lidarComEvento}>
                <input type="text" placeholder="Nome do Evento" value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} required style={{marginBottom:'10px'}}/>
                <div className="linha">
                    <input type="date" value={novoEvento.data_dia1} onChange={e => setNovoEvento({...novoEvento, data_dia1: e.target.value})} required />
                    <input type="number" placeholder="Vagas D1" value={novoEvento.vagas_dia1} onChange={e => setNovoEvento({...novoEvento, vagas_dia1: e.target.value})} required />
                </div>
                <div className="linha" style={{marginTop:'10px'}}>
                    <input type="date" value={novoEvento.data_dia2} onChange={e => setNovoEvento({...novoEvento, data_dia2: e.target.value})} required />
                    <input type="number" placeholder="Vagas D2" value={novoEvento.vagas_dia2} onChange={e => setNovoEvento({...novoEvento, vagas_dia2: e.target.value})} required />
                </div>
                <div className="linha" style={{marginTop:'15px'}}>
                    <input type="text" placeholder="Instagram" value={novoEvento.insta} onChange={e => setNovoEvento({...novoEvento, insta: e.target.value})} />
                    <input type="text" placeholder="WhatsApp" value={novoEvento.whats} onChange={e => setNovoEvento({...novoEvento, whats: e.target.value})} />
                </div>
                <div className="linha" style={{marginTop:'10px'}}>
                    <input type="text" placeholder="E-mail" value={novoEvento.email} onChange={e => setNovoEvento({...novoEvento, email: e.target.value})} />
                    <input type="text" placeholder="Site" value={novoEvento.site} onChange={e => setNovoEvento({...novoEvento, site: e.target.value})} />
                </div>
                <input type="text" placeholder="Local de Atendimento" value={novoEvento.local_atendimento} onChange={e => setNovoEvento({...novoEvento, local_atendimento: e.target.value})} required style={{marginTop:'10px'}}/>
                <textarea placeholder="Instruções para o PDF" value={novoEvento.instrucoes_pdf} onChange={e => setNovoEvento({...novoEvento, instrucoes_pdf: e.target.value})} rows="4" required style={{width:'100%', marginTop:'10px'}} />
                
                <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                    <button type="submit" style={{flex:1, background: idEdicaoEvento ? '#2980b9' : '#d35400', color:'white'}}>{idEdicaoEvento ? 'ATUALIZAR EVENTO' : 'ATIVAR NOVO EVENTO'}</button>
                    {idEdicaoEvento && <button type="button" onClick={() => { setIdEdicaoEvento(null); setNovoEvento({ nome: '', data_dia1: '', vagas_dia1: 200, data_dia2: '', vagas_dia2: 200, local_atendimento: '', instrucoes_pdf: '', insta: '', whats: '', email: '', site: '' }); }} style={{background:'#eee', color:'black'}}>CANCELAR</button>}
                </div>
              </form>
              {msgAdmin && <p style={{textAlign:'center', fontWeight:'bold', marginTop:'15px', color: msgAdmin.includes('✅')?'green':'red'}}>{msgAdmin}</p>}
              
              <h4 style={{marginTop:'20px'}}>Eventos Atuais:</h4>
              {listaEventos.map(ev => (
                <div key={ev.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #ddd', alignItems:'center'}}>
                  <span>{ev.nome} (D1: {ev.ocupadas_dia1}/{ev.vagas_dia1})</span>
                  <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => prepararEdicaoEvento(ev)} style={{background:'#f1c40f', color:'black', border:'none', padding:'5px 10px', borderRadius:'4px'}}>✏️</button>
                    <button onClick={async () => { if(confirm('Apagar Evento e Pacientes?')) { await axios.delete(`https://api.saudeaura.site/eventos/${ev.id}`); buscarTudo(); } }} style={{background:'red', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px'}}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SubAba: Utilizadores */}
          {subTelaConfig === 'usuarios' && (
            <div className="bloco">
              <h3>👥 Gestão de Utilizadores</h3>
              <form onSubmit={async (e) => { e.preventDefault(); try { const r = await axios.post('https://api.saudeaura.site/usuarios', novoUsu); setMsgAdmin(r.data.mensagem); buscarTudo(); } catch(e){ setMsgAdmin('Erro'); } }}>
                <input type="text" placeholder="Nome Completo" onChange={e => setNovoUsu({...novoUsu, nome: e.target.value})} required style={{marginBottom:'10px'}}/>
                <input type="text" placeholder="Utilizador" onChange={e => setNovoUsu({...novoUsu, usuario: e.target.value})} required style={{marginBottom:'10px'}}/>
                <input type="password" placeholder="Senha" onChange={e => setNovoUsu({...novoUsu, senha: e.target.value})} required style={{marginBottom:'10px'}}/>
                <select value={novoUsu.perfil} onChange={e => setNovoUsu({...novoUsu, perfil: e.target.value})} style={{width:'100%', padding:'10px'}}><option value="voluntario">Voluntário</option><option value="admin">Administrador</option></select>
                <button type="submit" style={{background:'#2c3e50', color:'white', marginTop:'10px'}}>CRIAR ACESSO</button>
              </form>
              <h4 style={{marginTop:'20px'}}>Utilizadores Cadastrados:</h4>
              {listaUsuarios.map(u => (
                <div key={u.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #ddd'}}>{u.nome} ({u.perfil}) <button onClick={async () => { if(confirm('Remover?')) { await axios.delete(`https://api.saudeaura.site/usuarios/${u.id}`); buscarTudo(); } }}>🗑️</button></div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App