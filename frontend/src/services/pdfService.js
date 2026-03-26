import { jsPDF } from 'jspdf';

// Carrega as imagens e transforma-as em promessas (como o logo)
const carregarImagens = (srcs) => Promise.all(
  srcs.map(src => new Promise((resolve) => { 
    const img = new Image(); 
    img.src = src; 
    img.onload = () => resolve(img); 
    img.onerror = () => resolve(null); 
  }))
);

const formatarDataBR = (d) => { 
  if(!d) return ''; 
  const p = d.split('T')[0].split('-'); 
  return `${p[2]}/${p[1]}/${p[0]}`; 
};

export const gerarPDFRecibo = async (senhaS, nomeP, diaE, tipoT, eventoAtual) => {
  if (!eventoAtual) return;
  
  const doc = new jsPDF();
  const dataR = diaE === 'Dia 1' ? formatarDataBR(eventoAtual.data_dia1) : formatarDataBR(eventoAtual.data_dia2);
  const dataArquivo = dataR.replace(/\//g, '-'); 
  
  const [imgLogo] = await carregarImagens(['/logo.png']);
  
  if (imgLogo) doc.addImage(imgLogo, 'PNG', 165, 10, 30, 30);
  
  doc.setFontSize(18); doc.setFont(undefined, 'bold');
  doc.text(eventoAtual.nome.toUpperCase(), 105, 20, { align: 'center' });
  doc.setFontSize(14); doc.setTextColor(100);
  doc.text(tipoT.toUpperCase(), 105, 30, { align: 'center' });
  
  doc.setFontSize(50); doc.setTextColor(39, 174, 96);
  doc.text(`SENHA: ${senhaS}`, 105, 55, { align: 'center' });
  
  doc.setFontSize(12); doc.setTextColor(0); doc.setFont(undefined, 'normal');
  doc.text(`Paciente: ${nomeP}`, 20, 80); 
  doc.text(`Data do Atendimento: ${dataR}`, 20, 88);
  doc.text(`Local: ${eventoAtual.local_atendimento}`, 20, 105);
  
  doc.setFont(undefined, 'bold'); doc.text("Instruções Importantes:", 20, 120);
  doc.setFont(undefined, 'normal');
  doc.text(doc.splitTextToSize(eventoAtual.instrucoes_pdf, 170), 20, 128);

  doc.setDrawColor(200); doc.line(20, 260, 190, 260);
  doc.setFontSize(9); doc.setTextColor(100);
  doc.text(`Instagram: ${eventoAtual.insta || '-'}  |  WhatsApp: ${eventoAtual.whats || '-'}`, 105, 270, { align: 'center' });
  doc.text(`E-mail: ${eventoAtual.email || '-'}  |  Site: ${eventoAtual.site || '-'}`, 105, 276, { align: 'center' });
  
  doc.save(`Comprovantes_${dataArquivo}_Senha_${senhaS}.pdf`);
};

export const desenharFichaNoDoc = (doc, p, imgLogo) => {
  const dataAtendimento = p.dia_atendimento === 'Dia 1' ? formatarDataBR(p.data_dia1) : formatarDataBR(p.data_dia2);
  
  if (imgLogo) { doc.addImage(imgLogo, 'PNG', 170, 8, 25, 25); }
  
  doc.setFontSize(18); doc.setFont(undefined, 'bold');
  doc.text(`SENHA: ${p.senha_atendimento}`, 20, 33);
  doc.setFontSize(14); doc.setFont(undefined, 'bold');
  doc.text((p.nome_evento || '').toUpperCase(), 105, 15, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(`${p.tipo_tratamento.toUpperCase()} - PRONTUÁRIO (${dataAtendimento})`, 105, 25, { align: 'center' });
  
  doc.setLineWidth(0.5); doc.line(20, 35, 190, 35);
  
  doc.setFontSize(10); doc.setFont(undefined, 'normal');
  doc.text(`NOME: ${p.nome.toUpperCase()}`, 20, 42);
  doc.text(`Nascimento: ${formatarDataBR(p.nascimento)} | Idade: ${p.idade} anos | Tel: ${p.telefone}`, 20, 50);
  doc.text(`Endereço: ${p.endereco}, ${p.numero} ${p.complemento || ''}`, 20, 58);
  doc.text(`Bairro: ${p.bairro} | Cidade: ${p.cidade} - ${p.estado}`, 20, 66);
  
  doc.line(20, 70, 190, 70);
  doc.setFont(undefined, 'bold'); doc.text("QUEIXAS:", 20, 78); doc.setFont(undefined, 'normal');
  
  doc.text(`1. ${p.queixa1 || ''}`, 20, 86);
  
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
};

export const imprimirFichasLote = async (pacientes) => {
  const doc = new jsPDF(); 
  const [imgLogo] = await carregarImagens(['/logo.png']);
  pacientes.forEach((p, i) => { 
    if(i > 0) doc.addPage(); 
    desenharFichaNoDoc(doc, p, imgLogo); 
  });
  doc.save('Fichas_Lote.pdf');
};

export const imprimirFichaUnica = async (p) => {
  const doc = new jsPDF(); 
  const [imgLogo] = await carregarImagens(['/logo.png']);
  desenharFichaNoDoc(doc, p, imgLogo);
  
  const dAtend = p.dia_atendimento === 'Dia 1' ? formatarDataBR(p.data_dia1) : formatarDataBR(p.data_dia2);
  const dataArquivo = dAtend.replace(/\//g, '-');
  const tipoResumido = p.tipo_tratamento.includes('Cura') ? 'Cura' : 'Socorro';
  
  doc.save(`${dataArquivo}_Senha_${p.senha_atendimento}_${tipoResumido}.pdf`);
};
