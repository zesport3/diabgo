import {
  Settings,
  ClinicalParameterConfig,
  MealType,
  DiabetesRecord,
  CalculationResult,
} from '../types';

/**
 * Checks whether a given HH:mm time falls within a [start, end] window.
 * Supports overnight ranges (e.g. 23:00 to 06:00).
 */
export function isTimeInSlot(time: string, start: string, end: string): boolean {
  if (!time || !start || !end) return false;
  if (start <= end) {
    return time >= start && time <= end;
  } else {
    // Overnight slot: e.g. 23:00 to 06:00 -> (time >= 23:00 OR time <= 06:00)
    return time >= start || time <= end;
  }
}

/**
 * Resolves the clinical parameter value based on its configuration mode.
 * Returns null if not configured, allowing safe checks without fake numbers.
 */
export function resolveParameter(
  config: ClinicalParameterConfig,
  time: string,
  meal: MealType
): { value: number | null; source: string } {
  if (!config) return { value: null, source: 'Não configurado' };

  if (config.mode === 'dia_inteiro') {
    if (config.allDayValue && config.allDayValue > 0) {
      return { value: config.allDayValue, source: 'Dia inteiro' };
    }
    return { value: null, source: 'Dia inteiro (valor inválido ou 0)' };
  }

  if (config.mode === 'por_refeicao') {
    const val = config.mealValues?.[meal];
    if (val && val > 0) {
      return { value: val, source: `Refeição (${meal})` };
    }
    return { value: null, source: `Refeição (${meal}) não configurada` };
  }

  if (config.mode === 'por_horario') {
    if (config.timeSlots && config.timeSlots.length > 0) {
      const match = config.timeSlots.find((slot) => isTimeInSlot(time, slot.start, slot.end));
      if (match && match.value > 0) {
        return { value: match.value, source: `Horário ${match.start}-${match.end}` };
      }
    }
    return { value: null, source: `Nenhum horário correspondente para ${time}` };
  }

  return { value: null, source: 'Configuração inválida' };
}

/**
 * Safely parses record timestamp from date & time or fallback timestamp
 */
export function getRecordTimestamp(r: { timestamp: number; date?: string; time?: string }): number {
  if (r.date && r.time) {
    const dateParts = r.date.split('-').map(Number);
    const timeParts = r.time.split(':').map(Number);
    if (dateParts.length === 3 && timeParts.length >= 2) {
      const [year, month, day] = dateParts;
      const [hour, minute] = timeParts;
      return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0).getTime();
    }
  }
  return r.timestamp;
}

/**
 * Calculates eligible active insulin from previous records based on DiabGo's specific rule:
 * Active insulin is calculated strictly from previous correction insulin doses and decays
 * proportionally over the active insulin duration (default 3 hours).
 *
 * Example (with 3-hour window and 9 U correction):
 * - After 0 hours: active insulin = 9 U (100%)
 * - After 1 hour:  active insulin = 6 U (66.7%)
 * - After 2 hours: active insulin = 3 U (33.3%)
 * - After 3 hours: active insulin = 0 U (0%)
 */
export function calculateEligibleActiveInsulin(
  targetTimestamp: number,
  records: DiabetesRecord[],
  durationHours: number = 3,
  currentRecordId?: string
): { totalActive: number; details: Array<{ recordId: string; time: string; originalCorrection: number; activeRemaining: number; elapsedHours: number }> } {
  const effectiveDuration = durationHours && durationHours > 0 ? durationHours : 3;
  const totalDurationMinutes = effectiveDuration * 60;
  let totalActive = 0;
  const details: Array<{ recordId: string; time: string; originalCorrection: number; activeRemaining: number; elapsedHours: number }> = [];

  // Find all valid prior records (chronologically up to targetTimestamp + 1 min tolerance)
  const priorRecords = records
    .filter((r) => {
      if (currentRecordId && r.id === currentRecordId) return false;
      if (r.status === 'nao_administrada') return false;
      const t = getRecordTimestamp(r);
      // Within tolerance of 1 minute into the future (in case of same-minute entries)
      return (targetTimestamp - t) >= -60000;
    })
    .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));

  // Iterate over prior records to calculate proportional active correction insulin
  for (const r of priorRecords) {
    const isCorrectionOnly =
      r.isCorrectionOnly ||
      (r.carbs === 0 && ((r.correctionInsulin ?? 0) > 0 || (r.administeredDose ?? r.calculatedDose ?? 0) > 0));

    let administeredCorrection = 0;
    if (isCorrectionOnly) {
      administeredCorrection =
        r.correctionInsulin ||
        r.administeredDose ||
        r.calculatedDose ||
        0;
    } else if (r.correctionInsulin && r.correctionInsulin > 0) {
      if (r.administeredDose !== undefined && r.administeredDose > 0) {
        administeredCorrection = Math.min(r.correctionInsulin, r.administeredDose);
      } else {
        administeredCorrection = r.correctionInsulin;
      }
    }

    if (administeredCorrection <= 0) continue;

    const rTime = getRecordTimestamp(r);
    const elapsedMs = targetTimestamp - rTime;
    const elapsedMinutes = Math.max(0, elapsedMs / 60000);
    const elapsedHours = Math.round((elapsedMinutes / 60) * 10) / 10;

    // Proportional decay across the duration window (default 3 hours)
    if (elapsedMinutes < totalDurationMinutes) {
      const decayFactor = Math.max(0, 1 - elapsedMinutes / totalDurationMinutes);
      const remaining = administeredCorrection * decayFactor;

      if (remaining > 0.001) {
        const roundedRemaining = Math.round(remaining * 100) / 100;
        totalActive += roundedRemaining;
        details.push({
          recordId: r.id,
          time: r.time,
          originalCorrection: administeredCorrection,
          activeRemaining: roundedRemaining,
          elapsedHours,
        });
      }
    }
  }

  return {
    totalActive: Math.round(totalActive * 100) / 100,
    details,
  };
}

/**
 * Rounds insulin dose to the specified precision (0.1, 0.5, or 1.0 U).
 */
export function roundDose(value: number, precision: 0.1 | 0.5 | 1.0 = 0.1): number {
  if (value <= 0) return 0;
  const factor = 1 / precision;
  return Math.round(value * factor) / factor;
}

/**
 * Main calculation engine for DiabGo.
 */
export function calculateDose(params: {
  glucose?: number;
  carbs: number;
  time: string;
  meal: MealType;
  timestamp: number;
  settings: Settings;
  records: DiabetesRecord[];
  currentRecordId?: string;
}): { result: CalculationResult | null; missingParams: string[] } {
  const { glucose, carbs, time, meal, timestamp, settings, records, currentRecordId } = params;
  const missingParams: string[] = [];

  // 1. Resolve Carb Ratio (only required if carbs > 0)
  let appliedCarbRatio = 10;
  if (carbs > 0) {
    const carbRatioResolution = resolveParameter(settings.carbRatio, time, meal);
    if (!carbRatioResolution.value || carbRatioResolution.value <= 0) {
      missingParams.push(`Rácio de Hidratos de Carbono (${carbRatioResolution.source})`);
    } else {
      appliedCarbRatio = carbRatioResolution.value;
    }
  } else {
    // If carbs is 0, use existing configured value if available or default for display
    const carbRatioResolution = resolveParameter(settings.carbRatio, time, meal);
    if (carbRatioResolution.value && carbRatioResolution.value > 0) {
      appliedCarbRatio = carbRatioResolution.value;
    }
  }

  // 2. Resolve ISF (Fator de Sensibilidade à Insulina)
  const isfResolution = resolveParameter(settings.isf, time, meal);
  if (!isfResolution.value || isfResolution.value <= 0) {
    missingParams.push(`Fator de Sensibilidade à Insulina (FSE) (${isfResolution.source})`);
  }

  // 3. Resolve Target Glucose
  const targetResolution = resolveParameter(settings.targetGlucose, time, meal);
  if (!targetResolution.value || targetResolution.value <= 0) {
    missingParams.push(`Glicemia-Alvo (${targetResolution.source})`);
  }

  if (missingParams.length > 0) {
    return { result: null, missingParams };
  }

  const appliedIsf = isfResolution.value!;
  const appliedTargetGlucose = targetResolution.value!;

  const isHypo = glucose !== undefined && glucose < 70;
  const isHyper = glucose !== undefined && glucose > 250;

  // A. Insulina para hidratos
  // Se estiver em hipoglicemia (< 70 mg/dL), 12g são estritamente para recuperação da hipo (não levam insulina).
  const safeCarbs = Math.max(0, carbs || 0);
  let billableCarbs = safeCarbs;
  if (isHypo) {
    billableCarbs = Math.max(0, safeCarbs - 12);
  }
  const carbInsulin = billableCarbs > 0 ? billableCarbs / appliedCarbRatio : 0;

  // B. Insulina de correção (0 se glicemia <= alvo ou em hipoglicemia)
  let correctionInsulin = 0;
  if (!isHypo && glucose !== undefined && glucose > appliedTargetGlucose) {
    correctionInsulin = (glucose - appliedTargetGlucose) / appliedIsf;
  }

  // C & D. Insulina ativa elegível (Regra DiabGo: apenas correções anteriores dentro das 3h)
  const { totalActive: eligibleActiveInsulin } = calculateEligibleActiveInsulin(
    timestamp,
    records,
    settings.insulinDurationHours || 3,
    currentRecordId
  );

  // E. Dose calculada = insulina para hidratos + insulina de correção - insulina ativa elegível
  const rawDose = carbInsulin + correctionInsulin - eligibleActiveInsulin;
  const netDose = Math.max(0, rawDose);
  const roundedDose = roundDose(netDose, settings.doseRounding || 0.1);

  // Safety warnings
  const warnings: string[] = [];
  if (isHypo) {
    warnings.push(
      '⚠️ Glicemia baixa (< 70 mg/dL): NÃO administrar insulina de correção! Trata imediatamente com 15g de hidratos de carbono rápidos (ex.: sumo, açúcar) e reavalia a glicemia após 15 minutos.'
    );
  } else if (glucose !== undefined && glucose < appliedTargetGlucose) {
    warnings.push(
      `ℹ️ Glicemia (${glucose} mg/dL) está abaixo do alvo (${appliedTargetGlucose} mg/dL). Nenhuma correção positiva foi adicionada.`
    );
  }

  if (isHyper) {
    warnings.push(
      '⚠️ Glicemia muito elevada (> 250 mg/dL): Segue o protocolo de correção e pesquisa de cetonas estabelecido pela tua equipa clínica.'
    );
  }

  if (rawDose < 0) {
    warnings.push(
      `ℹ️ O desconto de insulina ativa (${eligibleActiveInsulin.toFixed(1)} U) superou a soma da dose calculada. O resultado matemático é 0 U. Não há necessidade de insulina de correção.`
    );
  }

  // Clear explanation steps
  const explanation: string[] = [
    `Hidratos: ${safeCarbs}g ÷ ${appliedCarbRatio} g/U = ${carbInsulin.toFixed(2)} U`,
  ];

  if (glucose !== undefined) {
    if (glucose > appliedTargetGlucose) {
      explanation.push(
        `Correção: (${glucose} - ${appliedTargetGlucose} mg/dL) ÷ ${appliedIsf} mg/dL/U = ${correctionInsulin.toFixed(2)} U`
      );
    } else {
      explanation.push(`Correção: 0 U (glicemia ${glucose} ≤ alvo ${appliedTargetGlucose} mg/dL)`);
    }
  } else {
    explanation.push('Correção: 0 U (glicemia não informada neste registo)');
  }

  explanation.push(
    `Insulina ativa elegível (apenas correções das últimas ${settings.insulinDurationHours}h): -${eligibleActiveInsulin.toFixed(2)} U`
  );
  explanation.push(
    `Dose final recomendada: ${roundedDose} U (arredondamento a ${settings.doseRounding} U)`
  );

  return {
    result: {
      carbInsulin: Math.round(carbInsulin * 100) / 100,
      correctionInsulin: Math.round(correctionInsulin * 100) / 100,
      eligibleActiveInsulin: Math.round(eligibleActiveInsulin * 100) / 100,
      netDose: Math.round(netDose * 100) / 100,
      roundedDose,
      appliedCarbRatio,
      appliedIsf,
      appliedTargetGlucose,
      isHypo,
      isHyper,
      warnings,
      explanation,
    },
    missingParams: [],
  };
}
