import React, { useState } from 'react';
import {
  Clock,
  Syringe,
  Edit2,
  Trash2,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { DiabetesRecord, MEAL_LABELS } from '../types';
import { getGlucoseRangeBadge } from '../utils/reports';
import { calculateEligibleActiveInsulin } from '../utils/calculator';

interface RecordHistoryProps {
  records: DiabetesRecord[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  onEditRecord: (record: DiabetesRecord) => void;
  onDeleteRecord: (id: string) => void;
}

export const RecordHistory: React.FC<RecordHistoryProps> = ({
  records,
  selectedDate,
  onSelectDate,
  onEditRecord,
  onDeleteRecord,
}) => {
  // State tracking which records are expanded to show details and actions
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});

  const toggleRecord = (id: string) => {
    setExpandedRecordIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Group records by date (YYYY-MM-DD)
  const grouped: Record<string, DiabetesRecord[]> = {};
  for (const r of records) {
    if (!grouped[r.date]) {
      grouped[r.date] = [];
    }
    grouped[r.date].push(r);
  }

  // Sort dates descending
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const getDayHeader = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = d.toLocaleDateString('pt-PT', { weekday: 'long' });
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    const formattedDate = d.toLocaleDateString('pt-PT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (dateStr === todayStr) {
      return { main: 'Hoje', sub: `${capitalizedDay}, ${formattedDate}` };
    }
    if (dateStr === yesterdayStr) {
      return { main: 'Ontem', sub: `${capitalizedDay}, ${formattedDate}` };
    }
    return { main: capitalizedDay, sub: formattedDate };
  };

  if (records.length === 0) {
    return (
      <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 flex items-center justify-center text-cyan-500">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Ainda sem registos
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          Toca no botão «+» acima para calcular a tua primeira dose e adicionar uma medição.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-cyan-500" />
          Histórico de Registos
        </h3>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {records.length} {records.length === 1 ? 'registo' : 'registos'}
        </span>
      </div>

      {sortedDates.map((dateStr) => {
        const dayRecords = grouped[dateStr].sort((a, b) => b.time.localeCompare(a.time));
        const header = getDayHeader(dateStr);

        // Day summary totals
        const dayCarbs = dayRecords.reduce((acc, r) => acc + (r.carbs || 0), 0);
        const dayAdminInsulin = dayRecords.reduce(
          (acc, r) =>
            r.status !== 'nao_administrada'
              ? acc + (r.administeredDose !== undefined ? r.administeredDose : r.calculatedDose)
              : acc,
          0
        );

        const isSelectedDay = dateStr === selectedDate;

        return (
          <div
            key={dateStr}
            id={`history-day-${dateStr}`}
            data-history-date={dateStr}
            className={`rounded-2xl bg-white dark:bg-[#0F1B30] border overflow-hidden shadow-xs transition-all duration-200 ${
              isSelectedDay
                ? 'border-cyan-500/80 ring-2 ring-cyan-500/25 shadow-md shadow-cyan-500/5'
                : 'border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {/* Day Header Banner (Clicking selects day on chart) */}
            <div
              onClick={() => onSelectDate?.(dateStr)}
              className={`w-full px-4 py-2.5 border-b flex items-center justify-between cursor-pointer transition select-none ${
                isSelectedDay
                  ? 'bg-cyan-50/90 dark:bg-cyan-950/40 border-cyan-500/30'
                  : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isSelectedDay
                        ? 'text-cyan-700 dark:text-cyan-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {header.main}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {header.sub}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>{dayRecords.length} medições</span>
                  <span>•</span>
                  <span>{Math.round(dayCarbs * 10) / 10}g HC</span>
                  <span>•</span>
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    {Math.round(dayAdminInsulin * 10) / 10} U ins.
                  </span>
                </div>
              </div>
            </div>

            {/* List of records */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {dayRecords.map((record) => {
                const badge = getGlucoseRangeBadge(record.glucose);
                const isNotAdmin = record.status === 'nao_administrada';
                const adminDose = record.administeredDose ?? record.calculatedDose;
                const isDoseDifferent =
                  !isNotAdmin &&
                  record.administeredDose !== undefined &&
                  record.administeredDose !== record.calculatedDose;

                let activeDiscount = record.activeInsulinDeducted || record.eligibleActiveInsulin || 0;
                if (!activeDiscount && !record.isCorrectionOnly) {
                  const eligible = calculateEligibleActiveInsulin(
                    record.timestamp,
                    records.filter((r) => r.id !== record.id),
                    3,
                    record.id
                  );
                  activeDiscount = eligible.totalActive;
                }
                const isExpanded = !!expandedRecordIds[record.id];

                return (
                  <div
                    key={record.id}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    {/* Linha Principal (Compacta): Hora, Refeição, Hidratos e Insulina Total */}
                    <button
                      type="button"
                      onClick={() => toggleRecord(record.id)}
                      className="w-full p-3.5 flex items-center justify-between gap-2 text-left cursor-pointer transition select-none"
                    >
                      {/* Esquerda: Hora e Refeição */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0">
                          {record.time}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {MEAL_LABELS[record.meal] || record.meal}
                        </span>
                      </div>

                      {/* Direita: Quantidade de Hidratos de Carbono e Insulina Total */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Hidratos de Carbono */}
                        {record.isCorrectionOnly || (record.carbs === 0 && record.correctionInsulin > 0) ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                            Correção (0g)
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {record.carbs}g <span className="text-[10px] text-slate-400 font-normal">HC</span>
                          </span>
                        )}

                        {/* Insulina Total */}
                        <div className="flex items-center gap-2 min-w-[65px] justify-end">
                          {isNotAdmin ? (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 line-through">
                              0 U
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm font-bold text-cyan-600 dark:text-cyan-400">
                              <Syringe className="w-3.5 h-3.5" />
                              {adminDose} U
                            </span>
                          )}

                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                              isExpanded ? 'rotate-180 text-cyan-500' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Detalhe Expandido: Abre ao carregar no registo */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-slate-800/60 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150 bg-slate-50/40 dark:bg-slate-900/40">
                        {/* Glicemia e estado detalhado */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Glicemia:</span>
                            {record.glucose !== undefined && record.glucose > 0 ? (
                              <span className={`inline-flex items-center font-bold px-2 py-0.5 rounded-lg border ${badge.badgeClass}`}>
                                {record.glucose} mg/dL ({badge.label})
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Não registada</span>
                            )}
                          </div>

                          {isDoseDifferent && (
                            <span className="text-[10px] text-slate-400">
                              Dose calculada: {record.calculatedDose} U
                            </span>
                          )}
                        </div>

                        {/* As 3 Insulinas: para os hidratos, de correcao e ativa */}
                        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-center shadow-2xs">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              Ins. Hidratos
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {record.carbInsulin ?? 0} U
                            </span>
                          </div>

                          <div className="flex flex-col border-x border-slate-200/60 dark:border-slate-700/60">
                            <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              Ins. Correção
                            </span>
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                              {record.correctionInsulin ?? 0} U
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              Ins. Ativa
                            </span>
                            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                              {activeDiscount > 0 ? `-${activeDiscount} U` : '0 U'}
                            </span>
                          </div>
                        </div>

                        {/* Notas se existirem */}
                        {record.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic px-0.5">
                            Notas: {record.notes}
                          </p>
                        )}

                        {/* Botões de Editar e Apagar (Aparecem exclusivamente no detalhe aberto) */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRecord(record);
                            }}
                            className="px-3 py-1.5 rounded-xl text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                            title="Editar registo"
                            aria-label="Editar registo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRecord(record.id);
                            }}
                            className="px-3 py-1.5 rounded-xl text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                            title="Apagar registo"
                            aria-label="Apagar registo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Apagar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
