import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calculator,
  AlertTriangle,
  Info,
  Check,
  Clock,
  Calendar,
  Utensils,
  Activity,
  Wheat,
  Syringe,
} from 'lucide-react';
import {
  DiabetesRecord,
  MealType,
  MEAL_LABELS,
  Settings,
  CalculationResult,
} from '../types';
import { calculateDose, calculateEligibleActiveInsulin } from '../utils/calculator';

interface RecordModalProps {
  isOpen: boolean;
  initialRecord?: DiabetesRecord | null;
  defaultDate?: string;
  settings: Settings;
  records: DiabetesRecord[];
  onSave: (record: DiabetesRecord) => void;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  initialRecord,
  defaultDate,
  settings,
  records,
  onSave,
  onClose,
  onNavigateToSettings,
}) => {
  // Form states
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayStr = now.toISOString().split('T')[0];

  const [date, setDate] = useState<string>(
    initialRecord ? initialRecord.date : (defaultDate || todayStr)
  );
  const [time, setTime] = useState<string>(
    initialRecord ? initialRecord.time : defaultTime
  );
  const [meal, setMeal] = useState<MealType>(
    initialRecord ? initialRecord.meal : 'almoco'
  );
  const [glucose, setGlucose] = useState<string>(
    initialRecord?.glucose !== undefined ? String(initialRecord.glucose) : ''
  );
  const [carbs, setCarbs] = useState<string>(
    initialRecord ? String(initialRecord.carbs) : '0'
  );
  const [isCorrectionOnly, setIsCorrectionOnly] = useState<boolean>(
    initialRecord
      ? !!(initialRecord.isCorrectionOnly || (initialRecord.carbs === 0 && initialRecord.correctionInsulin > 0))
      : false
  );
  const [notes, setNotes] = useState<string>(
    initialRecord?.notes || ''
  );

  // Calculation output state
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [missingParams, setMissingParams] = useState<string[]>([]);
  const [calcPerformed, setCalcPerformed] = useState<boolean>(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGlucoseBlurred, setIsGlucoseBlurred] = useState<boolean>(
    initialRecord?.glucose !== undefined
  );
  const [autoSetHypoCarbs, setAutoSetHypoCarbs] = useState<boolean>(false);

  // Dynamic calculation of active insulin from previous records (including correction-only records)
  const activeInsulinInfo = useMemo(() => {
    const [h, m] = time.split(':').map(Number);
    const dateObj = new Date(date + 'T12:00:00');
    dateObj.setHours(h || 0, m || 0, 0, 0);
    const targetTimestamp = dateObj.getTime();

    return calculateEligibleActiveInsulin(
      targetTimestamp,
      initialRecord ? records.filter((r) => r.id !== initialRecord.id) : records,
      settings.insulinDurationHours || 3,
      initialRecord ? initialRecord.id : undefined
    );
  }, [date, time, records, settings.insulinDurationHours, initialRecord]);

  // If editing an existing record that already has calculated values
  useEffect(() => {
    if (initialRecord) {
      setCalcResult({
        carbInsulin: initialRecord.carbInsulin,
        correctionInsulin: initialRecord.correctionInsulin,
        eligibleActiveInsulin: initialRecord.eligibleActiveInsulin,
        netDose: initialRecord.calculatedDose,
        roundedDose: initialRecord.calculatedDose,
        appliedCarbRatio: 10,
        appliedIsf: 40,
        appliedTargetGlucose: 100,
        isHypo: initialRecord.glucose !== undefined && initialRecord.glucose < 70,
        isHyper: initialRecord.glucose !== undefined && initialRecord.glucose > 250,
        warnings: [],
        explanation: [],
      });
      setCalcPerformed(true);
    }
  }, [initialRecord]);

  const mealsList: MealType[] = [
    'pequeno_almoco',
    'almoco',
    'lanche',
    'jantar',
    'ceia',
    'outra',
  ];

  const handleGlucoseChange = (val: string) => {
    setGlucose(val);
    setCalcResult(null);
    setCalcPerformed(false);
    setValidationError(null);

    const num = parseFloat(val);
    // Se o utilizador alterar para >= 70 ou limpar e os hidratos foram definidos automaticamente por hipo:
    if (autoSetHypoCarbs && (isNaN(num) || num >= 70)) {
      setCarbs('0');
      setAutoSetHypoCarbs(false);
      setIsGlucoseBlurred(false);
    }
  };

  const handleGlucoseBlur = () => {
    setIsGlucoseBlurred(true);
    const num = parseFloat(glucose);
    if (!isNaN(num) && num > 0 && num < 70) {
      // Só coloca os 12g de hidratos depois de colocar o valor da glicemia e seja inferior a 70
      setCarbs('12');
      setAutoSetHypoCarbs(true);
      setIsCorrectionOnly(false);
    }
  };

  const handleCarbsChange = (val: string) => {
    setCarbs(val);
    setCalcResult(null);
    setCalcPerformed(false);
    setValidationError(null);

    const numG = parseFloat(glucose);
    const numC = parseFloat(val);
    if (isGlucoseBlurred && !isNaN(numG) && numG < 70 && !isNaN(numC) && numC < 12) {
      setValidationError(
        'Glicemia abaixo de 70 mg/dL (hipoglicemia): é obrigatório introduzir e ingerir no mínimo 12g de hidratos de carbono rápidos para comer.'
      );
    }
  };

  const handleCalculate = () => {
    setValidationError(null);
    setMissingParams([]);

    let numCarbs = isCorrectionOnly ? 0 : parseFloat(carbs);
    if (!isCorrectionOnly && (isNaN(numCarbs) || numCarbs < 0)) {
      setValidationError('Por favor introduz uma quantidade válida de hidratos de carbono (≥ 0 g).');
      return;
    }
    if (numCarbs > 700) {
      setValidationError('A quantidade máxima permitida de hidratos de carbono é 700g.');
      return;
    }

    let numGlucose: number | undefined = undefined;
    if (glucose.trim() !== '') {
      numGlucose = parseFloat(glucose);
      if (isNaN(numGlucose) || numGlucose <= 0) {
        setValidationError('Por favor introduz um valor de glicemia válido.');
        return;
      }
      if (numGlucose > 400) {
        setValidationError('O valor máximo permitido de glicemia é 400 mg/dL.');
        return;
      }
      if (numGlucose < 70) {
        setIsGlucoseBlurred(true);
        if (isCorrectionOnly) {
          setValidationError('Glicemia abaixo de 70 mg/dL: não é permitido administrar dose de correção em hipoglicemia.');
          return;
        }
        if (numCarbs < 12) {
          setCarbs('12');
          setAutoSetHypoCarbs(true);
          numCarbs = 12;
        }
      }
    } else if (isCorrectionOnly) {
      setValidationError('Por favor introduz o valor da glicemia para calcular a dose de correção.');
      return;
    }

    // Construct timestamp from date and time
    const [h, m] = time.split(':').map(Number);
    const dateObj = new Date(date + 'T12:00:00');
    dateObj.setHours(h || 0, m || 0, 0, 0);
    const targetTimestamp = dateObj.getTime();

    // Run calculation engine
    const { result, missingParams: missing } = calculateDose({
      glucose: numGlucose,
      carbs: numCarbs,
      time,
      meal,
      timestamp: targetTimestamp,
      settings,
      records: initialRecord ? records.filter((r) => r.id !== initialRecord.id) : records,
      currentRecordId: initialRecord ? initialRecord.id : undefined,
    });

    if (missing.length > 0) {
      setMissingParams(missing);
      setCalcResult(null);
      setCalcPerformed(true);
      return;
    }

    if (result) {
      setCalcResult(result);
      setCalcPerformed(true);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    let numCarbs = isCorrectionOnly ? 0 : parseFloat(carbs);
    if (!isCorrectionOnly && (isNaN(numCarbs) || numCarbs < 0)) {
      setValidationError('Verifica os hidratos de carbono (não pode ser negativo).');
      return;
    }
    if (numCarbs > 700) {
      setValidationError('A quantidade máxima permitida de hidratos de carbono é 700g.');
      return;
    }

    let numGlucose: number | undefined = undefined;
    if (glucose.trim() !== '') {
      numGlucose = parseFloat(glucose);
      if (isNaN(numGlucose) || numGlucose <= 0) {
        setValidationError('Glicemia inválida.');
        return;
      }
      if (numGlucose > 400) {
        setValidationError('O valor máximo permitido de glicemia é 400 mg/dL.');
        return;
      }
      if (numGlucose < 70) {
        setIsGlucoseBlurred(true);
        if (isCorrectionOnly) {
          setValidationError('Glicemia abaixo de 70 mg/dL: não é permitido administrar dose de correção em hipoglicemia.');
          return;
        }
        if (numCarbs < 12) {
          setCarbs('12');
          setAutoSetHypoCarbs(true);
          numCarbs = 12;
        }
      }
    }

    const [h, m] = time.split(':').map(Number);
    const dateObj = new Date(date + 'T12:00:00');
    dateObj.setHours(h || 0, m || 0, 0, 0);
    const timestamp = dateObj.getTime();

    // Always compute fresh calculation on save to guarantee active insulin is included
    const res = calculateDose({
      glucose: numGlucose,
      carbs: numCarbs,
      time,
      meal,
      timestamp,
      settings,
      records: initialRecord ? records.filter((r) => r.id !== initialRecord.id) : records,
      currentRecordId: initialRecord ? initialRecord.id : undefined,
    });

    if (res.missingParams.length > 0) {
      setMissingParams(res.missingParams);
      setValidationError('Não é possível guardar sem configurar os parâmetros necessários.');
      return;
    }

    const finalCalc = res.result;
    if (!finalCalc) return;

    const finalAdminDose = finalCalc.roundedDose;
    const finalCorrection = isCorrectionOnly
      ? (finalCalc.correctionInsulin > 0 ? finalCalc.correctionInsulin : finalAdminDose)
      : finalCalc.correctionInsulin;

    const recordToSave: DiabetesRecord = {
      id: initialRecord ? initialRecord.id : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      date,
      time,
      meal,
      glucose: numGlucose,
      carbs: numCarbs,
      calculatedDose: finalCalc.roundedDose,
      administeredDose: finalAdminDose,
      carbInsulin: finalCalc.carbInsulin,
      correctionInsulin: finalCorrection,
      activeInsulinDeducted: finalCalc.eligibleActiveInsulin,
      eligibleActiveInsulin: finalCalc.eligibleActiveInsulin,
      isCorrectionOnly: isCorrectionOnly || (numCarbs === 0 && finalCorrection > 0),
      status: 'administrada',
      notes: notes.trim() || undefined,
      createdAt: initialRecord ? initialRecord.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSave(recordToSave);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0B192C] shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col gap-4 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {initialRecord ? 'Editar Registo' : 'Novo Registo'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Calculadora de dose e registo diário
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Validation Banner */}
          {validationError && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Missing parameters warning */}
          {missingParams.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                Configuração Incompleta
              </div>
              <p>
                Não foi possível calcular a dose porque faltam os seguintes parâmetros clínicos:
              </p>
              <ul className="list-disc list-inside font-semibold">
                {missingParams.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
              {onNavigateToSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToSettings();
                  }}
                  className="mt-1 self-start font-bold text-cyan-700 dark:text-cyan-400 underline"
                >
                  Ir para Configurações →
                </button>
              )}
            </div>
          )}

          {/* Meal Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Refeição
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {mealsList.map((m) => {
                const isSelected = meal === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMeal(m);
                      setCalcPerformed(false);
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition active:scale-95 ${
                      isSelected
                        ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {MEAL_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opção: Apenas Correção */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 transition">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl transition ${
                  isCorrectionOnly
                    ? 'bg-purple-500 text-white shadow-xs'
                    : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300'
                }`}
              >
                <Syringe className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Apenas Correção
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Dose corretiva sem ingestão de hidratos (0g HC)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !isCorrectionOnly;
                setIsCorrectionOnly(next);
                if (next) {
                  setCarbs('0');
                }
                setCalcPerformed(false);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                isCorrectionOnly ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              aria-label="Ativar apenas correção"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  isCorrectionOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Glucose and Carbs Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Glicemia <span className="text-[10px] text-slate-400">(mg/dL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 120"
                  min="1"
                  max="400"
                  value={glucose}
                  onChange={(e) => handleGlucoseChange(e.target.value)}
                  onBlur={handleGlucoseBlur}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Máx: 400 mg/dL
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hidratos <span className="text-[10px] text-slate-400">(gramas)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  min="0"
                  max="700"
                  disabled={isCorrectionOnly}
                  value={isCorrectionOnly ? '0' : carbs}
                  onChange={(e) => handleCarbsChange(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border font-mono text-base transition ${
                    isCorrectionOnly
                      ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 cursor-not-allowed select-none'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500'
                  }`}
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {isCorrectionOnly ? 'Fixado em 0g (correção)' : 'Máx: 700g'}
              </span>
            </div>
          </div>

          {/* Hypoglycemia Mandatory 12g Carbs Alert Banner (< 70 mg/dL) */}
          {isGlucoseBlurred && glucose.trim() !== '' && !isNaN(parseFloat(glucose)) && parseFloat(glucose) < 70 && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Glicemia abaixo de 70 mg/dL (Hipoglicemia)</span>
                <span>
                  É <strong>obrigatório ingerir 12g de hidratos de carbono rápidos</strong> (ex.: açúcar ou sumo). A dose de hidratos foi definida para 12g e não é administrada insulina de correção.
                </span>
              </div>
            </div>
          )}

          {/* Active Insulin Detected from Prior Correction Banner */}
          {activeInsulinInfo.totalActive > 0 && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/70 text-cyan-900 dark:text-cyan-200 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                  <Syringe className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold block">
                    Insulina Ativa: {activeInsulinInfo.totalActive} U
                  </span>
                  <span className="text-[10px] text-cyan-700/90 dark:text-cyan-300/80">
                    Incluída a partir do registo de correção anterior (será deduzida na dose calculada).
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/60 px-2 py-0.5 rounded-full shrink-0">
                Ativa
              </span>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setCalcResult(null);
                  setCalcPerformed(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hora
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setCalcResult(null);
                  setCalcPerformed(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
            </div>
          </div>

          {/* Calculate Button */}
          <button
            type="button"
            onClick={handleCalculate}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm shadow-cyan-600/20 transition cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            Calcular Insulina
          </button>

          {/* Calculation Breakdown Section */}
          {calcResult && (
            <div className="p-3.5 rounded-2xl bg-cyan-50/70 dark:bg-[#07172E] border border-cyan-200 dark:border-cyan-900/50 flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-cyan-200/80 dark:border-cyan-900/60 pb-2">
                <span className="text-xs font-bold text-cyan-900 dark:text-cyan-300 flex items-center gap-1.5">
                  <Syringe className="w-3.5 h-3.5 text-cyan-500" />
                  Dose Calculada
                </span>
                <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
                  {calcResult.roundedDose} <span className="text-xs font-normal">U</span>
                </span>
              </div>

              {/* Breakdown items */}
              <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Insulina p/ Hidratos:</span>
                  <span className="font-semibold">{calcResult.carbInsulin} U</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Insulina de Correção:</span>
                  <span className="font-semibold">{calcResult.correctionInsulin} U</span>
                </div>
                <div className="flex justify-between text-cyan-700 dark:text-cyan-400">
                  <span>Insulina Ativa Descontada (correções 3h):</span>
                  <span className="font-semibold">-{calcResult.eligibleActiveInsulin} U</span>
                </div>
              </div>


            </div>
          )}



          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Exercício prévio, pizza, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-cyan-600/20 transition cursor-pointer"
            >
              Guardar Registo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
