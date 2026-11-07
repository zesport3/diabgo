import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Settings, ClinicalParameterConfig, MEAL_LABELS, MealType } from '../types';

export interface DoctorSettingsReportOptions {
  userEmail?: string;
  patientName?: string;
  diabetesType?: string;
  rapidInsulinName?: string;
  comments?: string;
}

/**
 * Helper to format a clinical parameter's configuration (Target Glucose, ISF, Carb Ratio)
 * into human-readable rows matching doctor therapy sheets.
 */
function formatParameterRows(
  paramName: string,
  config: ClinicalParameterConfig,
  unit: string,
  extraNotes?: string
): Array<[string, string, string]> {
  const rows: Array<[string, string, string]> = [];

  if (config.mode === 'dia_inteiro') {
    rows.push([
      paramName,
      `Todo o dia: ${config.allDayValue} ${unit}`,
      extraNotes || 'Configuração única para 24h',
    ]);
  } else if (config.mode === 'por_refeicao') {
    const mealOrder: MealType[] = [
      'pequeno_almoco',
      'almoco',
      'lanche',
      'jantar',
      'ceia',
      'outra',
    ];
    mealOrder.forEach((mealKey, idx) => {
      const val = config.mealValues?.[mealKey];
      if (val !== undefined && val > 0) {
        rows.push([
          idx === 0 ? paramName : '',
          `${MEAL_LABELS[mealKey] || mealKey}: ${val} ${unit}`,
          idx === 0 ? (extraNotes || 'Por refeição') : '',
        ]);
      }
    });
  } else if (config.mode === 'por_horario') {
    const sortedSlots = [...(config.timeSlots || [])].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
    sortedSlots.forEach((slot, idx) => {
      const label = slot.label ? ` (${slot.label})` : '';
      rows.push([
        idx === 0 ? paramName : '',
        `${slot.start} – ${slot.end}${label}: ${slot.value} ${unit}`,
        idx === 0 ? (extraNotes || 'Por blocos horários') : '',
      ]);
    });
  }

  if (rows.length === 0) {
    rows.push([paramName, `Não configurado`, extraNotes || '—']);
  }

  return rows;
}

/**
 * Generates and downloads a clean, professional clinical PDF report of the calculator settings
 * formatted specifically for medical consultations and endocrinologists, inspired by clinical bolus calculator reports.
 */
export function exportSettingsReportToPDF(
  settings: Settings,
  options: DoctorSettingsReportOptions = {}
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color Palette: Clinical DiabGo Navy & Turquoise
  const primaryNavy: [number, number, number] = [11, 25, 44];
  const turquoise: [number, number, number] = [6, 182, 212];
  const darkGray: [number, number, number] = [51, 65, 85];
  const tableHeaderBg: [number, number, number] = [14, 116, 144]; // Deep cyan #0E7490

  const today = new Date();
  const dateFormatted = today.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = today.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const userEmail = options.userEmail?.trim() || 'zenave@icloud.com';
  const patientName = options.patientName?.trim() || 'José Miguel Fernandes Nave';
  const diabetesType = options.diabetesType?.trim() || 'Tipo 1';
  const insulinName = options.rapidInsulinName?.trim() || 'Fiasp® / Análogo de Ação Rápida';

  // --- Top Header ---
  // Top metadata line
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(userEmail, 14, 12);

  // DiabGo Brandmark on the right
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryNavy);
  doc.text('DiabGo', pageWidth - 14, 12, { align: 'right' });

  // Main Report Title
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryNavy);
  doc.text('Configuração da calculadora de bolus DiabGo', 14, 22);

  // Subtitle / Section title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkGray);
  doc.text('Utilização prevista para a calculadora de bolus', 14, 30);

  // Descriptive text for the doctor
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const introText =
    'A Calculadora de bolus DiabGo destina-se a apoiar o tratamento da diabetes insulinodependente, ' +
    'permitindo calcular uma dose recomendada de bolus de insulina com base nos dados e parâmetros clínicos da terapia. ' +
    'O algoritmo utiliza os valores de glicemia atuais, a ingestão de hidratos de carbono (HC) e o valor atual de ' +
    'insulina ativa em circulação, que é calculada com base na proporção de horas decorridas desde as administrações de correção anteriores. ' +
    'Antes de qualquer alteração, é necessário validar estes parâmetros com o profissional de saúde que o assiste.';

  const splitIntro = doc.splitTextToSize(introText, pageWidth - 28);
  doc.text(splitIntro, 14, 35);

  let currentY = 35 + splitIntro.length * 3.8 + 4;

  // --- Compile Table Rows ---
  const tableRows: Array<[string, string, string]> = [];

  // 1. Informação pessoal
  tableRows.push(['Informação pessoal', `Tipo de diabetes: ${diabetesType}`, `Utente: ${patientName}`]);

  // 2. Definições gerais
  tableRows.push(['Definições gerais', 'Unidade de glicemia', settings.glucoseUnit || 'mg/dL']);
  tableRows.push(['', 'Unidade de hidratos de carbono', 'Gramas (g)']);
  tableRows.push(['', 'Incrementos de insulina (arredondamento)', `${settings.doseRounding} U`]);

  // 3. Glicemia-Alvo (Target Glucose)
  const targetRows = formatParameterRows(
    'Intervalo-alvo / Alvo',
    settings.targetGlucose,
    settings.glucoseUnit || 'mg/dL',
    'Objetivo glicémico pré-prandial'
  );
  targetRows.forEach((r) => tableRows.push(r));

  // 4. Sobre a insulina
  const durationH = settings.insulinDurationHours || 3;
  tableRows.push(['Sobre sua insulina', 'Tipo de insulina (ação rápida)', insulinName]);
  tableRows.push([
    '',
    `Tempo de ação da insulina`,
    `${Math.floor(durationH)} h e ${Math.round((durationH % 1) * 60)} min (${durationH}h)`,
  ]);
  tableRows.push([
    '',
    'Cálculo de insulina ativa (DiabGo)',
    'Decaimento proporcional por horas (apenas insulina de correção)',
  ]);

  // 5. Fator de Sensibilidade à Insulina (ISF / FSE)
  const isfRows = formatParameterRows(
    'Fator de correção (FSE / ISF)',
    settings.isf,
    'mg/dL por 1 U',
    'Sensibilidade à insulina'
  );
  isfRows.forEach((r) => tableRows.push(r));

  // 6. Rácio de hidratos de carbono (Carb Ratio)
  const carbRatioRows = formatParameterRows(
    'Rácio de carboidratos/insulina',
    settings.carbRatio,
    'g de HC por 1 U',
    'Rácio de hidratos de carbono'
  );
  carbRatioRows.forEach((r) => tableRows.push(r));

  // Optional doctor comments
  if (options.comments?.trim()) {
    tableRows.push(['Observações clínicas', options.comments.trim(), 'Anotação do médico/utente']);
  }

  // --- Render AutoTable ---
  autoTable(doc, {
    startY: currentY,
    head: [['Definições da terapia', 'Valores configurados', 'Comentários / Modo']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: tableHeaderBg,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkGray,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', textColor: [14, 116, 144] },
      1: { cellWidth: 70, fontStyle: 'bold', textColor: primaryNavy },
      2: { cellWidth: 57, fontStyle: 'normal', textColor: [100, 116, 139] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (_data) => {
      // Running bottom footer
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      const footerLeft = `Relatório gerado em ${dateFormatted} às ${timeFormatted} para ${userEmail}`;
      doc.text(footerLeft, 14, pageHeight - 8);

      const footerRight = 'DiabGo | Gestão e Cálculo de Diabetes';
      doc.text(footerRight, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
  });

  // Save the generated document
  const fileName = `DiabGo_Configuracao_Calculadora_Bolus_${dateFormatted.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}
