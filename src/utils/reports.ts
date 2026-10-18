import { DiabetesRecord } from '../types';

export interface GlycemicRangeStats {
  count: number;
  percentage: number;
  label: string;
  rangeDesc: string;
  color: string;
  bgClass: string;
  textClass: string;
}

export interface PeriodReport {
  startDate: string;
  endDate: string;
  totalDays: number;
  totalRecords: number;
  glucoseRecordsCount: number;
  meanGlucose: number | null;
  stdDev: number | null;
  ranges: {
    veryLow: GlycemicRangeStats;  // < 54
    low: GlycemicRangeStats;      // 54 - 69
    inTarget: GlycemicRangeStats; // 70 - 180
    high: GlycemicRangeStats;     // 181 - 250
    veryHigh: GlycemicRangeStats; // > 250
  };
  estimatedHbA1c: {
    value: number | null;
    isReliable: boolean;
    reason?: string;
  };
  carbs: {
    total: number;
    dailyAvg: number;
  };
  insulin: {
    totalAdministered: number;
    dailyAvg: number;
    totalCarbInsulin: number;
    totalCorrectionInsulin: number;
  };
  dailySummaries: Array<{
    date: string;
    dayOfWeek: string;
    count: number;
    meanGlucose: number | null;
    totalCarbs: number;
    totalInsulin: number;
    records: DiabetesRecord[];
  }>;
}

export function calculatePeriodReport(
  records: DiabetesRecord[],
  startDate: string,
  endDate: string
): PeriodReport {
  // Filter records within the date range (YYYY-MM-DD inclusive)
  const filtered = records.filter((r) => r.date >= startDate && r.date <= endDate);

  // Compute number of days between start and end
  const startMs = new Date(startDate + 'T00:00:00').getTime();
  const endMs = new Date(endDate + 'T23:59:59').getTime();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  // Glucose stats
  const glucoseValues = filtered
    .map((r) => r.glucose)
    .filter((g): g is number => typeof g === 'number' && !isNaN(g) && g > 0);

  const glucoseCount = glucoseValues.length;

  let meanGlucose: number | null = null;
  let stdDev: number | null = null;

  if (glucoseCount > 0) {
    const sum = glucoseValues.reduce((acc, v) => acc + v, 0);
    meanGlucose = Math.round((sum / glucoseCount) * 10) / 10;

    const squareDiffs = glucoseValues.map((v) => Math.pow(v - meanGlucose!, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, v) => acc + v, 0) / glucoseCount;
    stdDev = Math.round(Math.sqrt(avgSquareDiff) * 10) / 10;
  }

  // Ranges count
  let cVeryLow = 0;
  let cLow = 0;
  let cInTarget = 0;
  let cHigh = 0;
  let cVeryHigh = 0;

  for (const g of glucoseValues) {
    if (g < 54) {
      cVeryLow++;
    } else if (g <= 69) {
      cLow++;
    } else if (g <= 180) {
      cInTarget++;
    } else if (g <= 250) {
      cHigh++;
    } else {
      cVeryHigh++;
    }
  }

  const calcRange = (
    count: number,
    label: string,
    rangeDesc: string,
    color: string,
    bgClass: string,
    textClass: string
  ): GlycemicRangeStats => ({
    count,
    percentage: glucoseCount > 0 ? Math.round((count / glucoseCount) * 1000) / 10 : 0,
    label,
    rangeDesc,
    color,
    bgClass,
    textClass,
  });

  const ranges = {
    veryLow: calcRange(cVeryLow, 'Muito Baixo', '< 54 mg/dL', '#DC2626', 'bg-red-500', 'text-red-600 dark:text-red-400'),
    low: calcRange(cLow, 'Baixo', '54 – 69 mg/dL', '#F97316', 'bg-orange-500', 'text-orange-600 dark:text-orange-400'),
    inTarget: calcRange(cInTarget, 'No Alvo', '70 – 180 mg/dL', '#10B981', 'bg-emerald-500', 'text-emerald-600 dark:text-emerald-400'),
    high: calcRange(cHigh, 'Alto', '181 – 250 mg/dL', '#F59E0B', 'bg-amber-500', 'text-amber-600 dark:text-amber-400'),
    veryHigh: calcRange(cVeryHigh, 'Muito Alto', '> 250 mg/dL', '#8B5CF6', 'bg-purple-600', 'text-purple-600 dark:text-purple-400'),
  };

  // Estimated HbA1c
  // Minimum requirement: 20 records and at least 14 days
  let estimatedHbA1c: { value: number | null; isReliable: boolean; reason?: string } = {
    value: null,
    isReliable: false,
    reason: 'Sem medições suficientes',
  };

  if (meanGlucose !== null) {
    if (glucoseCount >= 20 && totalDays >= 14) {
      // ADAG formula: HbA1c (%) = (meanGlucose + 46.7) / 28.7
      const val = (meanGlucose + 46.7) / 28.7;
      estimatedHbA1c = {
        value: Math.round(val * 10) / 10,
        isReliable: true,
      };
    } else {
      const neededDays = Math.max(0, 14 - totalDays);
      const neededRecords = Math.max(0, 20 - glucoseCount);
      estimatedHbA1c = {
        value: null,
        isReliable: false,
        reason: `Dados insuficientes para estimativa de HbA1c. Necessário pelo menos 20 registos glicémicos distribuídos por 14 dias (faltam ${neededRecords} registos e ${neededDays} dias).`,
      };
    }
  }

  // Carbs stats
  const totalCarbs = filtered.reduce((acc, r) => acc + (r.carbs || 0), 0);
  const dailyAvgCarbs = Math.round((totalCarbs / totalDays) * 10) / 10;

  // Insulin stats
  let totalAdministered = 0;
  let totalCarbInsulin = 0;
  let totalCorrectionInsulin = 0;

  for (const r of filtered) {
    if (r.status !== 'nao_administrada') {
      const dose = r.administeredDose !== undefined ? r.administeredDose : r.calculatedDose;
      totalAdministered += dose;
      totalCarbInsulin += r.carbInsulin || 0;
      totalCorrectionInsulin += r.correctionInsulin || 0;
    }
  }

  const dailyAvgInsulin = Math.round((totalAdministered / totalDays) * 10) / 10;

  // Daily summaries
  const dayGroups: Record<string, DiabetesRecord[]> = {};
  for (const r of filtered) {
    if (!dayGroups[r.date]) {
      dayGroups[r.date] = [];
    }
    dayGroups[r.date].push(r);
  }

  const sortedDates = Object.keys(dayGroups).sort((a, b) => b.localeCompare(a));
  const dailySummaries = sortedDates.map((date) => {
    const dayRecords = dayGroups[date].sort((a, b) => a.time.localeCompare(b.time));
    const dayGlucose = dayRecords
      .map((r) => r.glucose)
      .filter((g): g is number => typeof g === 'number' && g > 0);
    const dayMeanGlucose =
      dayGlucose.length > 0
        ? Math.round((dayGlucose.reduce((a, b) => a + b, 0) / dayGlucose.length) * 10) / 10
        : null;
    const dayCarbs = dayRecords.reduce((acc, r) => acc + (r.carbs || 0), 0);
    const dayInsulin = dayRecords.reduce(
      (acc, r) =>
        r.status !== 'nao_administrada'
          ? acc + (r.administeredDose !== undefined ? r.administeredDose : r.calculatedDose)
          : acc,
      0
    );

    const d = new Date(date + 'T12:00:00');
    const dayOfWeek = d.toLocaleDateString('pt-PT', { weekday: 'long' });

    return {
      date,
      dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
      count: dayRecords.length,
      meanGlucose: dayMeanGlucose,
      totalCarbs: Math.round(dayCarbs * 10) / 10,
      totalInsulin: Math.round(dayInsulin * 10) / 10,
      records: dayRecords,
    };
  });

  return {
    startDate,
    endDate,
    totalDays,
    totalRecords: filtered.length,
    glucoseRecordsCount: glucoseCount,
    meanGlucose,
    stdDev,
    ranges,
    estimatedHbA1c,
    carbs: {
      total: Math.round(totalCarbs * 10) / 10,
      dailyAvg: dailyAvgCarbs,
    },
    insulin: {
      totalAdministered: Math.round(totalAdministered * 10) / 10,
      dailyAvg: dailyAvgInsulin,
      totalCarbInsulin: Math.round(totalCarbInsulin * 10) / 10,
      totalCorrectionInsulin: Math.round(totalCorrectionInsulin * 10) / 10,
    },
    dailySummaries,
  };
}

export function getGlucoseRangeBadge(glucose?: number): {
  label: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
} {
  if (glucose === undefined || glucose === null || isNaN(glucose) || glucose <= 0) {
    return {
      label: 'Sem medição',
      bgClass: 'bg-slate-200 dark:bg-slate-700',
      textClass: 'text-slate-600 dark:text-slate-300',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
  }

  if (glucose < 54) {
    return {
      label: 'Muito Baixo',
      bgClass: 'bg-red-500',
      textClass: 'text-red-700 dark:text-red-400',
      badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
    };
  }
  if (glucose < 70) {
    return {
      label: 'Baixo',
      bgClass: 'bg-orange-500',
      textClass: 'text-orange-700 dark:text-orange-400',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
    };
  }
  if (glucose <= 180) {
    return {
      label: 'No Alvo',
      bgClass: 'bg-emerald-500',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
    };
  }
  if (glucose <= 250) {
    return {
      label: 'Alto',
      bgClass: 'bg-amber-500',
      textClass: 'text-amber-700 dark:text-amber-400',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    };
  }
  return {
    label: 'Muito Alto',
    bgClass: 'bg-purple-600',
    textClass: 'text-purple-700 dark:text-purple-400',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900',
  };
}
