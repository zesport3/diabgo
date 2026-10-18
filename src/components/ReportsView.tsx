import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Activity,
  Wheat,
  Syringe,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DiabetesRecord, MEAL_LABELS } from '../types';
import { calculatePeriodReport, getGlucoseRangeBadge } from '../utils/reports';
import { exportReportToPDF } from '../utils/pdfExport';

interface ReportsViewProps {
  records: DiabetesRecord[];
}

type PeriodPreset = '7' | '14' | '30' | '90' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({ records }) => {
  const [preset, setPreset] = useState<PeriodPreset>('14');

  const todayStr = new Date().toISOString().split('T')[0];

  const getStartDateForDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return d.toISOString().split('T')[0];
  };

  const [customStart, setCustomStart] = useState<string>(getStartDateForDays(14));
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  const startDate = useMemo(() => {
    if (preset === 'custom') return customStart;
    return getStartDateForDays(parseInt(preset, 10));
  }, [preset, customStart]);

  const endDate = useMemo(() => {
    if (preset === 'custom') return customEnd;
    return todayStr;
  }, [preset, customEnd]);

  const report = useMemo(() => {
    return calculatePeriodReport(records, startDate, endDate);
  }, [records, startDate, endDate]);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const toggleDayExpand = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date);
  };

  const handleExportPDF = () => {
    exportReportToPDF(report);
  };

  const weeksCovered = Math.round((report.totalDays / 7) * 10) / 10;

  return (
    <div className="space-y-4 pb-12">
      {/* Title & PDF Export Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-500" />
            Relatórios Clínicos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Estatísticas glicémicas, nutrição e doses
          </p>
        </div>

        <button
          onClick={handleExportPDF}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-semibold text-xs shadow-md shadow-cyan-600/20 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar PDF
        </button>
      </div>

      {/* Period Selection */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Intervalo de Análise
          </span>
          <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
            {report.totalDays} dias ({weeksCovered} {weeksCovered === 1 ? 'semana' : 'semanas'})
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 mb-2.5">
          {(
            [
              { id: '7', label: '7d' },
              { id: '14', label: '14d' },
              { id: '30', label: '30d' },
              { id: '90', label: '90d' },
              { id: 'custom', label: 'Pers.' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`py-1.5 text-xs font-semibold rounded-xl border text-center transition ${
                preset === p.id
                  ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                Data Inicial
              </label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                Data Final
              </label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayStr}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Glycemic Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
            Média de Glicemia
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {report.meanGlucose !== null ? report.meanGlucose : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">mg/dL</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            {report.stdDev !== null ? `Desvio Padrão: ±${report.stdDev} mg/dL` : 'Sem dados'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
            HbA1c Estimada
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {report.estimatedHbA1c.value !== null ? `${report.estimatedHbA1c.value}%` : '—'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            {report.estimatedHbA1c.isReliable ? 'Fórmula ADAG' : 'Dados insuficientes'}
          </span>
        </div>
      </div>

      {/* HbA1c Caveat Banner */}
      {!report.estimatedHbA1c.isReliable && report.estimatedHbA1c.reason && (
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <span>{report.estimatedHbA1c.reason}</span>
        </div>
      )}

      {/* Target Distribution Breakdown */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Distribuição por Intervalos Glicémicos
          </h3>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {report.glucoseRecordsCount} medições
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        {report.glucoseRecordsCount > 0 ? (
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 mb-3 shadow-inner">
            {report.ranges.veryLow.percentage > 0 && (
              <div
                style={{ width: `${report.ranges.veryLow.percentage}%` }}
                className="bg-red-500 transition-all"
                title={`Muito baixo: ${report.ranges.veryLow.percentage}%`}
              />
            )}
            {report.ranges.low.percentage > 0 && (
              <div
                style={{ width: `${report.ranges.low.percentage}%` }}
                className="bg-orange-500 transition-all"
                title={`Baixo: ${report.ranges.low.percentage}%`}
              />
            )}
            {report.ranges.inTarget.percentage > 0 && (
              <div
                style={{ width: `${report.ranges.inTarget.percentage}%` }}
                className="bg-emerald-500 transition-all"
                title={`No alvo: ${report.ranges.inTarget.percentage}%`}
              />
            )}
            {report.ranges.high.percentage > 0 && (
              <div
                style={{ width: `${report.ranges.high.percentage}%` }}
                className="bg-amber-500 transition-all"
                title={`Alto: ${report.ranges.high.percentage}%`}
              />
            )}
            {report.ranges.veryHigh.percentage > 0 && (
              <div
                style={{ width: `${report.ranges.veryHigh.percentage}%` }}
                className="bg-purple-600 transition-all"
                title={`Muito alto: ${report.ranges.veryHigh.percentage}%`}
              />
            )}
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-slate-400">
            Sem medições de glicemia no período selecionado.
          </div>
        )}

        {/* 5 Ranges Detailed Rows */}
        <div className="space-y-2">
          {[
            report.ranges.veryLow,
            report.ranges.low,
            report.ranges.inTarget,
            report.ranges.high,
            report.ranges.veryHigh,
          ].map((rng) => (
            <div
              key={rng.label}
              className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${rng.bgClass} shrink-0`} />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {rng.label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">
                    ({rng.rangeDesc})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-900 dark:text-white">
                  {rng.count} de {report.glucoseRecordsCount}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-2">
                  ({rng.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500 italic">
          * Nota: Estas percentagens refletem as medições manuais pontuais e não representam tempo contínuo no intervalo (TIR), uma vez que não existe integração CGM contínua.
        </p>
      </div>

      {/* Insulin & Nutrition Statistics */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
          <Wheat className="w-4 h-4 text-amber-500" />
          Nutrição e Insulina Administrada
        </h3>

        <div className="grid grid-cols-2 gap-3 text-center mb-3">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              Hidratos Totais
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {report.carbs.total} <span className="text-xs font-normal">g</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Média: {report.carbs.dailyAvg} g/dia
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              Insulina Administrada
            </span>
            <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
              {report.insulin.totalAdministered} <span className="text-xs font-normal">U</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Média: {report.insulin.dailyAvg} U/dia
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex justify-between">
            <span>Componente p/ Hidratos (soma calculada):</span>
            <span className="font-semibold">{report.insulin.totalCarbInsulin} U</span>
          </div>
          <div className="flex justify-between">
            <span>Componente de Correção (soma calculada):</span>
            <span className="font-semibold">{report.insulin.totalCorrectionInsulin} U</span>
          </div>
        </div>
      </div>

      {/* Daily Summaries Drilldown */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-cyan-500" />
          Detalhamento Diário ({report.dailySummaries.length} dias com registos)
        </h3>

        {report.dailySummaries.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            Sem registos no período selecionado.
          </p>
        ) : (
          <div className="space-y-2">
            {report.dailySummaries.map((day) => {
              const isExpanded = expandedDay === day.date;
              return (
                <div
                  key={day.date}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleDayExpand(day.date)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        {day.date} — {day.dayOfWeek}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {day.meanGlucose ? `Média: ${day.meanGlucose} mg/dL` : 'S/ glicemia'} • {day.totalCarbs}g HC • {day.totalInsulin}U
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-2.5 divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-[#0B192C]">
                      {day.records.map((r) => {
                        const badge = getGlucoseRangeBadge(r.glucose);
                        return (
                          <div
                            key={r.id}
                            className="py-1.5 flex items-center justify-between text-xs"
                          >
                            <span className="font-mono text-slate-600 dark:text-slate-400">
                              {r.time} ({MEAL_LABELS[r.meal] || r.meal})
                            </span>
                            <div className="flex items-center gap-2">
                              {r.glucose ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.badgeClass}`}>
                                  {r.glucose} mg/dL
                                </span>
                              ) : null}
                              {r.isCorrectionOnly || (r.carbs === 0 && r.correctionInsulin > 0) ? (
                                <span className="font-semibold text-purple-600 dark:text-purple-400">
                                  Correção
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {r.carbs}g HC
                                </span>
                              )}
                              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                                {r.status === 'nao_administrada' ? '0 U' : `${r.administeredDose ?? r.calculatedDose} U`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
