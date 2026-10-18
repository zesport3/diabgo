import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PeriodReport } from './reports';
import { MEAL_LABELS } from '../types';

export function exportReportToPDF(report: PeriodReport): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors: DiabGo Navy #0B192C and Turquoise #06B6D4
  const primaryNavy: [number, number, number] = [11, 25, 44];
  const turquoise: [number, number, number] = [6, 182, 212];
  const darkGray: [number, number, number] = [51, 65, 85];
  const lightGrayBg: [number, number, number] = [248, 250, 252];

  // Header banner
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Title DiabGo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('DiabGo', 14, 18);

  // Slogan
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(6, 182, 212);
  doc.text('A tua diabetes. Mais simples. | Relatório Clínico Pessoal', 56, 17);

  // Period text
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Período: ${report.startDate} a ${report.endDate} (${report.totalDays} dias)`,
    pageWidth - 14,
    18,
    { align: 'right' }
  );

  let currentY = 38;

  // 1. Summary Cards Section
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo de Glicemia e Parâmetros', 14, currentY);
  currentY += 6;

  // 4 metric cards
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 20;

  const metrics = [
    {
      title: 'Média de Glicemia',
      value: report.meanGlucose !== null ? `${report.meanGlucose} mg/dL` : 'S/ dados',
      sub: report.stdDev !== null ? `DP: ±${report.stdDev}` : '',
    },
    {
      title: 'No Alvo (70-180)',
      value: `${report.ranges.inTarget.percentage}%`,
      sub: `${report.ranges.inTarget.count} de ${report.glucoseRecordsCount} registos`,
    },
    {
      title: 'HbA1c Estimada',
      value: report.estimatedHbA1c.value !== null ? `${report.estimatedHbA1c.value}%` : 'S/ dados',
      sub: report.estimatedHbA1c.isReliable ? 'Estimativa ADAG' : 'Dados insuficientes',
    },
    {
      title: 'Insulina Total / Média',
      value: `${report.insulin.totalAdministered} U`,
      sub: `Média: ${report.insulin.dailyAvg} U/dia`,
    },
  ];

  metrics.forEach((m, idx) => {
    const cardX = 14 + idx * (cardWidth + 3);
    doc.setFillColor(...lightGrayBg);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    doc.text(m.title, cardX + 3, currentY + 5.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text(m.value, cardX + 3, currentY + 12);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(m.sub, cardX + 3, currentY + 17);
  });

  currentY += cardHeight + 8;

  // 2. Glycemic Ranges Table
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribuição por Intervalos Glicémicos', 14, currentY);
  currentY += 4;

  const rangeRows = [
    ['Muito Baixo', '< 54 mg/dL', `${report.ranges.veryLow.count} de ${report.glucoseRecordsCount}`, `${report.ranges.veryLow.percentage}%`],
    ['Baixo', '54 – 69 mg/dL', `${report.ranges.low.count} de ${report.glucoseRecordsCount}`, `${report.ranges.low.percentage}%`],
    ['No Alvo', '70 – 180 mg/dL', `${report.ranges.inTarget.count} de ${report.glucoseRecordsCount}`, `${report.ranges.inTarget.percentage}%`],
    ['Alto', '181 – 250 mg/dL', `${report.ranges.high.count} de ${report.glucoseRecordsCount}`, `${report.ranges.high.percentage}%`],
    ['Muito Alto', '> 250 mg/dL', `${report.ranges.veryHigh.count} de ${report.glucoseRecordsCount}`, `${report.ranges.veryHigh.percentage}%`],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Intervalo', 'Definição (mg/dL)', 'Nº de Registos', 'Percentagem']],
    body: rangeRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryNavy,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkGray,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 40 },
      2: { cellWidth: 45 },
      3: { cellWidth: 35, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // 3. Insulins and Carbs Breakdown Table
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Nutrição e Insulina Administrada', 14, currentY);
  currentY += 4;

  const nutritionRows = [
    ['Hidratos de Carbono Totais', `${report.carbs.total} g`],
    ['Média Diária de Hidratos', `${report.carbs.dailyAvg} g / dia`],
    ['Insulina Administrada Total', `${report.insulin.totalAdministered} U`],
    ['Média Diária de Insulina', `${report.insulin.dailyAvg} U / dia`],
    ['Componente p/ Hidratos (soma)', `${report.insulin.totalCarbInsulin} U`],
    ['Componente de Correção (soma)', `${report.insulin.totalCorrectionInsulin} U`],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Parâmetro', 'Valor do Período']],
    body: nutritionRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkGray,
    },
    columnStyles: {
      0: { cellWidth: 90, fontStyle: 'bold' },
      1: { cellWidth: 65 },
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // Check if we need a new page for detailed records table
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 20;
  }

  // 4. Daily Detail Table
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Registo Detalhado por Medição', 14, currentY);
  currentY += 4;

  const detailRows: string[][] = [];
  report.dailySummaries.forEach((day) => {
    day.records.forEach((r) => {
      const mealName = MEAL_LABELS[r.meal] || r.meal;
      const glucoseStr = r.glucose ? `${r.glucose} mg/dL` : '—';
      const carbsStr =
        r.isCorrectionOnly || (r.carbs === 0 && r.correctionInsulin > 0)
          ? 'Correção (0g)'
          : r.carbs > 0
          ? `${r.carbs} g`
          : '0 g';
      const adminDoseStr =
        r.status === 'nao_administrada'
          ? '0 U (não adm.)'
          : `${r.administeredDose ?? r.calculatedDose} U`;
      const calcDoseStr = `${r.calculatedDose} U`;

      detailRows.push([
        r.date,
        r.time,
        mealName,
        glucoseStr,
        carbsStr,
        adminDoseStr,
        calcDoseStr,
      ]);
    });
  });

  if (detailRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['Data', 'Hora', 'Refeição', 'Glicemia', 'Hidratos', 'Dose Administrada', 'Dose Calculada']],
      body: detailRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryNavy,
        textColor: 255,
        fontSize: 7.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: darkGray,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum registo no período selecionado.', 14, currentY + 6);
  }

  // Footer Disclaimers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    const disclaimer =
      'Aviso Clínico: A DiabGo é uma ferramenta pessoal de cálculo e registo. Os dados baseiam-se em medições manuais pontuais (não em leitura contínua CGM). A estimativa de HbA1c não substitui análises laboratoriais. Valida sempre os teus parâmetros com a tua equipa médica.';
    doc.text(disclaimer, 14, pageHeight - 8, { maxWidth: pageWidth - 28 });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 4, { align: 'right' });
  }

  // Save PDF locally
  const filename = `DiabGo_Relatorio_${report.startDate}_a_${report.endDate}.pdf`;
  doc.save(filename);
}
