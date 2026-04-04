const PDFDocument = require('pdfkit');

const formatarDataBR = (d) => {
    if (!d) return '';
    const str = typeof d === 'string' ? d : d.toISOString();
    const p = str.split('T')[0].split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
};

/**
 * Gera o PDF de comprovante (recibo) do paciente e retorna como Buffer.
 * Replica o layout do frontend (pdfService.js > gerarPDFRecibo).
 */
function gerarPDFReciboBuffer(senha, nomePaciente, diaAtendimento, tipoTratamento, evento) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const dataAtendimento = diaAtendimento === 'Dia 1'
            ? formatarDataBR(evento.data_dia1)
            : formatarDataBR(evento.data_dia2);

        // Cabeçalho - Nome do Evento
        doc.fontSize(20).font('Helvetica-Bold')
            .text(evento.nome.toUpperCase(), { align: 'center' });

        // Tipo de tratamento
        doc.fontSize(14).fillColor('#666666')
            .text(tipoTratamento.toUpperCase(), { align: 'center' });

        doc.moveDown(1);

        // Senha grande e verde
        doc.fontSize(48).fillColor('#27AE60').font('Helvetica-Bold')
            .text(`SENHA: ${senha}`, { align: 'center' });

        doc.moveDown(1);

        // Dados do paciente
        doc.fontSize(12).fillColor('#000000').font('Helvetica');
        doc.text(`Paciente: ${nomePaciente}`);
        doc.moveDown(0.3);
        doc.text(`Data do Atendimento: ${dataAtendimento}`);
        doc.moveDown(0.3);
        doc.text(`Tipo: ${tipoTratamento}`);
        doc.moveDown(0.5);
        doc.text(`Local: ${evento.local_atendimento || '-'}`);

        doc.moveDown(1.5);

        // Instruções
        if (evento.instrucoes_pdf) {
            doc.font('Helvetica-Bold').text('Instruções Importantes:');
            doc.font('Helvetica').text(evento.instrucoes_pdf, { width: 490 });
        }

        // Rodapé
        doc.moveDown(3);
        doc.moveTo(50, doc.page.height - 80).lineTo(545, doc.page.height - 80)
            .strokeColor('#CCCCCC').stroke();

        doc.fontSize(9).fillColor('#666666');
        const rodape1 = `Instagram: ${evento.insta || '-'}  |  WhatsApp: ${evento.whats || '-'}`;
        const rodape2 = `E-mail: ${evento.email || '-'}  |  Site: ${evento.site || '-'}`;
        doc.text(rodape1, 50, doc.page.height - 65, { align: 'center', width: 495 });
        doc.text(rodape2, 50, doc.page.height - 52, { align: 'center', width: 495 });

        doc.end();
    });
}

module.exports = { gerarPDFReciboBuffer, formatarDataBR };
