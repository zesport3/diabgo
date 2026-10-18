import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Utensils, Syringe } from 'lucide-react';
import { DiabetesRecord, MEAL_LABELS } from '../types';
import { getGlucoseRangeBadge } from '../utils/reports';

interface GlucoseChartProps {
  records: DiabetesRecord[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onOpenNewRecord: () => void;
}

export const GlucoseChart: React.FC<GlucoseChartProps> = ({
  records,
  selectedDate,
  onSelectDate,
  onOpenNewRecord,
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Filter records for the selected date
  const dayRecords = records
    .filter((r) => r.date === selectedDate && r.glucose !== undefined && r.glucose > 0)
    .sort((a, b) => a.time.localeCompare(b.time));

  const allDayRecords = records.filter((r) => r.date === selectedDate);

  // Selected record detail popup
  const activePoint = dayRecords.find((r) => r.id === selectedRecordId) || null;

  // Day navigation helpers
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    onSelectDate(d.toISOString().split('T')[0]);
    setSelectedRecordId(null);
  };

  const formatDayTitle = (dateStr: string) => {
    const today = new Date();
    const target = new Date(dateStr + 'T12:00:00');
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Ontem';

    return target.toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // SVG Chart Dimensions
  const chartWidth = 360;
  const chartHeight = 190;
  const padLeft = 36;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 26;

  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;

  // Y-axis range: at least 40 to 300, or scaled if higher glucose exists
  const maxRecorded = dayRecords.reduce((max, r) => Math.max(max, r.glucose || 0), 0);
  const minY = 40;
  const maxY = Math.max(300, Math.ceil((maxRecorded + 20) / 50) * 50);

  const getYPos = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return padTop + innerHeight - ((clamped - minY) / (maxY - minY)) * innerHeight;
  };

  const getXPos = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = (h || 0) * 60 + (m || 0);
    return padLeft + (totalMinutes / 1440) * innerWidth;
  };

  // Target range corridor (70 to 180 mg/dL)
  const yTargetTop = getYPos(180);
  const yTargetBottom = getYPos(70);
  const corridorHeight = Math.max(0, yTargetBottom - yTargetTop);

  // SVG Path for connecting line
  let linePath = '';
  if (dayRecords.length > 1) {
    linePath = dayRecords.reduce((acc, r, idx) => {
      const x = getXPos(r.time);
      const y = getYPos(r.glucose!);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }

  // Get point color based on glucose range
  const getPointColor = (val: number) => {
    if (val < 54) return '#DC2626'; // Very low (Red)
    if (val < 70) return '#F97316'; // Low (Orange)
    if (val <= 180) return '#06B6D4'; // In target (Cyan)
    if (val <= 250) return '#F59E0B'; // High (Amber)
    return '#A855F7'; // Very high (Purple)
  };

  return (
    <section className="bg-white dark:bg-[#0F1B30] rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
      {/* Chart Top Header & Day Navigation */}
      <div className="flex items-center justify-between mb-3">
        {/* Date Selector Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigateDay(-1)}
            aria-label="Dia anterior"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center min-w-[120px]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-500" />
              {formatDayTitle(selectedDate)}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>

          <button
            onClick={() => navigateDay(1)}
            aria-label="Dia seguinte"
            disabled={isToday}
            className={`p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 ${
              isToday ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {!isToday && (
            <button
              onClick={() => onSelectDate(todayStr)}
              className="ml-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition"
            >
              Hoje
            </button>
          )}
        </div>

        {/* Circular '+' Button (Requirement 3 & 4: Top Right of Chart) */}
        <button
          onClick={onOpenNewRecord}
          title="Novo Registo"
          aria-label="Adicionar novo registo"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white shadow-md shadow-cyan-500/30 transition-transform cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.8]" />
        </button>
      </div>

      {/* Target range legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-2 px-1">
        <span>Glicemia (mg/dL)</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
            Alvo 70–180
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            &lt;70
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            &gt;180
          </span>
        </div>
      </div>

      {/* Chart SVG */}
      <div className="relative w-full aspect-[360/190] select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full overflow-visible"
        >
          {/* Target range corridor background (70 - 180 mg/dL) */}
          <rect
            x={padLeft}
            y={yTargetTop}
            width={innerWidth}
            height={corridorHeight}
            className="fill-cyan-500/10 dark:fill-cyan-400/10"
            rx={4}
          />

          {/* Reference line 180 mg/dL */}
          <line
            x1={padLeft}
            y1={yTargetTop}
            x2={padLeft + innerWidth}
            y2={yTargetTop}
            stroke="#06B6D4"
            strokeDasharray="3 3"
            strokeWidth="0.8"
            strokeOpacity="0.5"
          />

          {/* Reference line 70 mg/dL */}
          <line
            x1={padLeft}
            y1={yTargetBottom}
            x2={padLeft + innerWidth}
            y2={yTargetBottom}
            stroke="#06B6D4"
            strokeDasharray="3 3"
            strokeWidth="0.8"
            strokeOpacity="0.5"
          />

          {/* Y Axis Grid lines & labels */}
          {[minY, 70, 100, 180, 250, maxY].map((val) => {
            const y = getYPos(val);
            return (
              <g key={`y-${val}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + innerWidth}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="0.5"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* X Axis Time Marks (00h, 04h, 08h, 12h, 16h, 20h, 24h) */}
          {[0, 4, 8, 12, 16, 20, 24].map((h) => {
            const timeStr = `${h.toString().padStart(2, '0')}:00`;
            const x = getXPos(h === 24 ? '23:59' : timeStr);
            return (
              <g key={`x-${h}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + innerHeight}
                  className="stroke-slate-100 dark:stroke-slate-800/40"
                  strokeWidth="0.5"
                />
                <text
                  x={x}
                  y={padTop + innerHeight + 14}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono"
                >
                  {h.toString().padStart(2, '0')}h
                </text>
              </g>
            );
          })}

          {/* Connecting line between records */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#06B6D4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs"
            />
          )}

          {/* Interactive Record Glucose Values (displays glucose number instead of plain dots) */}
          {dayRecords.map((r) => {
            const x = getXPos(r.time);
            const y = getYPos(r.glucose!);
            const isSelected = selectedRecordId === r.id;
            const color = getPointColor(r.glucose!);
            const glucoseStr = String(r.glucose);

            const pillWidth = glucoseStr.length > 2 ? 28 : 23;
            const pillHeight = 15;

            // Keep pill inside chart area
            const pillX = Math.max(
              padLeft - 4,
              Math.min(padLeft + innerWidth - pillWidth + 4, x - pillWidth / 2)
            );
            const pillY = Math.max(
              padTop - 4,
              Math.min(padTop + innerHeight - pillHeight + 4, y - pillHeight / 2)
            );
            const textX = pillX + pillWidth / 2;
            const textY = pillY + pillHeight / 2 + 0.5;

            return (
              <g
                key={r.id}
                onClick={() => setSelectedRecordId(isSelected ? null : r.id)}
                className="cursor-pointer transition-transform"
              >
                {/* Outer touch target for easy tapping on iPhone */}
                <rect
                  x={x - 18}
                  y={y - 14}
                  width={36}
                  height={28}
                  fill="transparent"
                />

                {/* Selection halo */}
                {isSelected && (
                  <rect
                    x={pillX - 3}
                    y={pillY - 3}
                    width={pillWidth + 6}
                    height={pillHeight + 6}
                    rx={9}
                    fill={color}
                    fillOpacity={0.3}
                    className="animate-pulse"
                  />
                )}

                {/* Glucose Value Pill */}
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillWidth}
                  height={pillHeight}
                  rx={7.5}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 1.8 : 1.2}
                  className="drop-shadow-xs transition-all hover:scale-110"
                />

                {/* Glucose Value Number */}
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  className="text-[9px] font-bold font-mono tracking-tight select-none pointer-events-none"
                >
                  {glucoseStr}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Empty state overlay when no glucose records exist for this day */}
        {dayRecords.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-[1px]">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nenhuma medição de glicemia registada para {formatDayTitle(selectedDate).toLowerCase()}.
            </p>
            <button
              onClick={onOpenNewRecord}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Registo
            </button>
          </div>
        )}
      </div>

      {/* Selected Point Tooltip / Inspection Card */}
      {activePoint && (
        <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                <Clock className="w-3.5 h-3.5 text-cyan-500" />
                {activePoint.time}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                • {MEAL_LABELS[activePoint.meal] || activePoint.meal}
              </span>
            </div>
            {(() => {
              const badge = getGlucoseRangeBadge(activePoint.glucose);
              return (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.badgeClass}`}>
                  {badge.label}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Glicemia</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {activePoint.glucose} <span className="text-[10px] font-normal">mg/dL</span>
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Hidratos</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {activePoint.isCorrectionOnly || (activePoint.carbs === 0 && activePoint.correctionInsulin > 0) ? (
                  <span className="text-purple-600 dark:text-purple-400 font-bold text-xs">Correção</span>
                ) : (
                  <>
                    {activePoint.carbs} <span className="text-[10px] font-normal">g</span>
                  </>
                )}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Dose Adm.</span>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                {activePoint.status === 'nao_administrada'
                  ? '0 U'
                  : `${activePoint.administeredDose ?? activePoint.calculatedDose} U`}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
