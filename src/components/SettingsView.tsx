import React, { useState, useRef } from 'react';
import {
  Sliders,
  Sun,
  Moon,
  Smartphone,
  Shield,
  Download,
  Upload,
  Trash2,
  Plus,
  X,
  Check,
  AlertTriangle,
  Info,
  Clock,
  HelpCircle,
  Database,
  User,
} from 'lucide-react';
import {
  Settings,
  ClinicalParameterConfig,
  ParameterMode,
  MealType,
  MEAL_LABELS,
  TimeSlot,
  DiabetesRecord,
} from '../types';
import { ThemeMode } from '../hooks/useTheme';
import { exportBackup, validateBackupFile, mergeRecords, BackupValidationResult } from '../utils/backup';
import { storage } from '../services/storage';

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  records: DiabetesRecord[];
  onReloadRecords: (records: DiabetesRecord[]) => void;
  onClearAllData: () => void;
  onOpenInstallGuide: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  themeMode,
  onChangeTheme,
  records,
  onReloadRecords,
  onClearAllData,
  onOpenInstallGuide,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calc' | 'appearance' | 'data' | 'privacy'>('calc');
  const [activeParamTab, setActiveParamTab] = useState<'carbRatio' | 'isf' | 'targetGlucose'>('carbRatio');

  // Backup import states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<BackupValidationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{ count: number; indexedDBOk: boolean; estimatedSizeKb: number } | null>(null);

  React.useEffect(() => {
    storage.getStorageInfo().then(setStorageInfo);
  }, [records, settings]);

  const showSuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Parameter update helpers
  const updateParamConfig = (
    key: 'carbRatio' | 'isf' | 'targetGlucose',
    updater: (prev: ClinicalParameterConfig) => ClinicalParameterConfig
  ) => {
    const updated = {
      ...settings,
      [key]: updater(settings[key]),
    };
    onUpdateSettings(updated);
    showSuccess('Parâmetro atualizado com sucesso.');
  };

  const handleModeChange = (
    key: 'carbRatio' | 'isf' | 'targetGlucose',
    mode: ParameterMode
  ) => {
    updateParamConfig(key, (prev) => ({ ...prev, mode }));
  };

  const handleAllDayValueChange = (
    key: 'carbRatio' | 'isf' | 'targetGlucose',
    val: number
  ) => {
    updateParamConfig(key, (prev) => ({ ...prev, allDayValue: val }));
  };

  const handleMealValueChange = (
    key: 'carbRatio' | 'isf' | 'targetGlucose',
    meal: MealType,
    val: number
  ) => {
    updateParamConfig(key, (prev) => ({
      ...prev,
      mealValues: { ...prev.mealValues, [meal]: val },
    }));
  };

  const handleAddTimeSlot = (key: 'carbRatio' | 'isf' | 'targetGlucose') => {
    const newSlot: TimeSlot = {
      id: `slot_${Date.now()}`,
      start: '12:00',
      end: '18:00',
      value: key === 'targetGlucose' ? 100 : key === 'isf' ? 40 : 10,
      label: 'Novo Horário',
    };
    updateParamConfig(key, (prev) => ({
      ...prev,
      timeSlots: [...prev.timeSlots, newSlot],
    }));
  };

  const handleUpdateTimeSlot = (
    key: 'carbRatio' | 'isf' | 'targetGlucose',
    slotId: string,
    field: keyof TimeSlot,
    value: any
  ) => {
    updateParamConfig(key, (prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)),
    }));
  };

  const handleRemoveTimeSlot = (
    key: 'carbRatio' | 'isf' | 'targetGlucose',
    slotId: string
  ) => {
    updateParamConfig(key, (prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((s) => s.id !== slotId),
    }));
  };

  // Backup Export
  const handleExport = () => {
    exportBackup(settings, records);
    showSuccess('Cópia de segurança descarregada com sucesso.');
  };

  // Backup Import File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSummary(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const validation = validateBackupFile(content);
      if (!validation.isValid) {
        setImportError(validation.error || 'Ficheiro de cópia de segurança inválido.');
      } else {
        setImportSummary(validation);
      }
    };
    reader.onerror = () => {
      setImportError('Erro ao ler o ficheiro.');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async (mode: 'replace' | 'merge') => {
    if (!importSummary?.data) return;

    const importedSettings = importSummary.data.settings;
    const importedRecords = importSummary.data.records || [];

    if (mode === 'replace') {
      await storage.clearAllRecords();
      for (const r of importedRecords) {
        await storage.saveRecord(r);
      }
      if (importedSettings) {
        await storage.saveSettings(importedSettings);
        onUpdateSettings(importedSettings);
      }
      onReloadRecords(importedRecords);
      showSuccess(`Restauração concluída! ${importedRecords.length} registos restaurados.`);
    } else {
      // Merge mode
      const { merged, addedCount, duplicateCount } = mergeRecords(records, importedRecords);
      for (const r of merged) {
        await storage.saveRecord(r);
      }
      onReloadRecords(merged);
      showSuccess(`Combinação concluída: ${addedCount} novos registos adicionados (${duplicateCount} duplicados ignorados).`);
    }

    setImportSummary(null);
  };

  const currentConfig = settings[activeParamTab];

  return (
    <div className="space-y-4 pb-12">
      {/* Settings Sub-Tabs Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-500" />
            Configurações
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parâmetros clínicos, aparência e dados
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
        {[
          { id: 'calc', label: 'Cálculos' },
          { id: 'appearance', label: 'Aparência' },
          { id: 'data', label: 'Dados' },
          { id: 'privacy', label: 'Privacidade' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`py-2 text-xs font-bold rounded-xl transition ${
              activeSubTab === tab.id
                ? 'bg-white dark:bg-[#0B192C] text-cyan-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Clinical Calculation Parameters Tab */}
      {activeSubTab === 'calc' && (
        <div className="space-y-4">
          {/* Active Parameter Selection */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveParamTab('carbRatio')}
              className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition ${
                activeParamTab === 'carbRatio'
                  ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              Rácio HC
            </button>
            <button
              type="button"
              onClick={() => setActiveParamTab('isf')}
              className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition ${
                activeParamTab === 'isf'
                  ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              Fator FSE
            </button>
            <button
              type="button"
              onClick={() => setActiveParamTab('targetGlucose')}
              className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition ${
                activeParamTab === 'targetGlucose'
                  ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              Glicemia-Alvo
            </button>
          </div>

          {/* Selected Parameter Editor Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeParamTab === 'carbRatio' && 'Rácio de Hidratos de Carbono'}
                  {activeParamTab === 'isf' && 'Fator de Sensibilidade à Insulina (FSE)'}
                  {activeParamTab === 'targetGlucose' && 'Glicemia-Alvo'}
                </h3>
                <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                  {activeParamTab === 'carbRatio' && 'g / 1 U'}
                  {activeParamTab === 'isf' && 'mg/dL / 1 U'}
                  {activeParamTab === 'targetGlucose' && 'mg/dL'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeParamTab === 'carbRatio' &&
                  'Define quantos gramas de hidratos de carbono são cobertos por 1 unidade de insulina rápida.'}
                {activeParamTab === 'isf' &&
                  'Define quantos mg/dL de glicemia são reduzidos por 1 unidade de insulina de correção.'}
                {activeParamTab === 'targetGlucose' &&
                  'Glicemia pretendida em jejum e antes das refeições para efeito dos cálculos de correção.'}
              </p>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Modalidade de Configuração
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'dia_inteiro', label: 'Dia Inteiro' },
                  { id: 'por_horario', label: 'Por Horário' },
                  { id: 'por_refeicao', label: 'Por Refeição' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeChange(activeParamTab, m.id as ParameterMode)}
                    className={`py-2 text-xs font-semibold rounded-xl border text-center transition ${
                      currentConfig.mode === m.id
                        ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Editor based on selected mode */}
            {currentConfig.mode === 'dia_inteiro' && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valor Único para Todo o Dia
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="1"
                    autoComplete="off"
                    placeholder="—"
                    value={currentConfig.allDayValue === 0 ? '' : currentConfig.allDayValue}
                    onChange={(e) =>
                      handleAllDayValueChange(
                        activeParamTab,
                        e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-32 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {activeParamTab === 'carbRatio' && 'gramas por unidade'}
                    {activeParamTab === 'isf' && 'mg/dL por unidade'}
                    {activeParamTab === 'targetGlucose' && 'mg/dL'}
                  </span>
                </div>
              </div>
            )}

            {currentConfig.mode === 'por_refeicao' && (
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Valores Específicos por Refeição
                </span>
                {(
                  [
                    'pequeno_almoco',
                    'almoco',
                    'lanche',
                    'jantar',
                    'ceia',
                    'outra',
                  ] as MealType[]
                ).map((meal) => (
                  <div key={meal} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {MEAL_LABELS[meal]}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="1"
                      autoComplete="off"
                      placeholder="—"
                      value={currentConfig.mealValues[meal] === 0 ? '' : (currentConfig.mealValues[meal] ?? '')}
                      onChange={(e) =>
                        handleMealValueChange(
                          activeParamTab,
                          meal,
                          e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-center"
                    />
                  </div>
                ))}
              </div>
            )}

            {currentConfig.mode === 'por_horario' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Intervalos de Horário
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddTimeSlot(activeParamTab)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Horário
                  </button>
                </div>

                {currentConfig.timeSlots.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum intervalo configurado. Toca em «Adicionar Horário».
                  </p>
                ) : (
                  currentConfig.timeSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) =>
                            handleUpdateTimeSlot(activeParamTab, slot.id, 'start', e.target.value)
                          }
                          className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                        />
                        <span className="text-slate-400">às</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) =>
                            handleUpdateTimeSlot(activeParamTab, slot.id, 'end', e.target.value)
                          }
                          className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="1"
                          autoComplete="off"
                          placeholder="—"
                          value={slot.value === 0 ? '' : slot.value}
                          onChange={(e) =>
                            handleUpdateTimeSlot(
                              activeParamTab,
                              slot.id,
                              'value',
                              e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-center text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeSlot(activeParamTab, slot.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Global Clinical Rules: Duration & Rounding */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Duração da Insulina & Arredondamento
            </h3>

            {/* Insulin Duration */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Duração de Ação da Insulina Rápida (horas)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="2"
                  max="6"
                  step="0.5"
                  autoComplete="off"
                  value={settings.insulinDurationHours}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 3;
                    onUpdateSettings({ ...settings, insulinDurationHours: val });
                  }}
                  className="w-24 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm font-bold text-center"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  horas (padrão clínico: 3 horas)
                </span>
              </div>
            </div>

            {/* Dose Rounding */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Precisão de Arredondamento da Dose
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 0.1, label: '0.1 U (Caneta 0.5/meias ou bomba)' },
                  { val: 0.5, label: '0.5 U (Caneta de meias unidades)' },
                  { val: 1.0, label: '1.0 U (Caneta padrão de 1 unidade)' },
                ].map((r) => (
                  <button
                    key={r.val}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, doseRounding: r.val as any })}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border text-center transition ${
                      settings.doseRounding === r.val
                        ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {r.val} U
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Rule Explanation Banner */}
            <div className="p-3.5 rounded-xl bg-cyan-50/60 dark:bg-[#07172E] border border-cyan-200 dark:border-cyan-900/60 text-xs text-cyan-950 dark:text-cyan-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-cyan-800 dark:text-cyan-300">
                <Info className="w-4 h-4 text-cyan-500 shrink-0" />
                Regra Específica de Insulina Ativa (DiabGo)
              </div>
              <p className="leading-relaxed">
                Na DiabGo, <strong>apenas a componente de correção</strong> dos registos anteriores dentro das {settings.insulinDurationHours} horas contribui para o desconto de insulina ativa no novo cálculo. A componente de hidratos de carbono não entra no desconto.
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1">
                Nota de segurança clínica: Esta regra personalizada deve ser validada com a tua equipa médica antes de ser utilizada para orientar administrações reais.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Appearance Tab */}
      {activeSubTab === 'appearance' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tema e Aparência
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Escolhe como a aplicação é apresentada no teu ecrã
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Claro', icon: Sun },
              { id: 'dark', label: 'Escuro', icon: Moon },
              { id: 'auto', label: 'Automático', icon: Smartphone },
            ].map((theme) => {
              const Icon = theme.icon;
              const isSelected = themeMode === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onChangeTheme(theme.id as ThemeMode)}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{theme.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <p>
              • <strong>Claro:</strong> Fundo claro com texto azul-escuro e destaques turquesa.
            </p>
            <p>
              • <strong>Escuro:</strong> Fundo azul muito escuro com texto claro e alto contraste.
            </p>
            <p>
              • <strong>Automático:</strong> Segue a definição de aparência do teu iPhone / sistema operativo.
            </p>
          </div>
        </div>
      )}

      {/* 3. Data Management Tab */}
      {activeSubTab === 'data' && (
        <div className="space-y-4">
          {/* Storage Info Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-500" />
              Armazenamento Local
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Total de Registos</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {storageInfo?.count ?? records.length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[10px] text-slate-400 block">Tamanho Estimado</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {storageInfo?.estimatedSizeKb ?? 0} KB
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Os teus dados residem 100% no teu dispositivo (IndexedDB e armazenamento seguro do navegador).
            </p>
          </div>

          {/* Backup Export / Import */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Cópias de Segurança
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exporta os teus dados regularmente para guardares em segurança no teu iPhone ou ficheiros iCloud.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExport}
                className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-cyan-600/20 transition"
              >
                <Download className="w-4 h-4" />
                Exportar Cópia
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl border border-cyan-500/80 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 active:scale-95 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Upload className="w-4 h-4" />
                Importar Cópia
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Import error */}
            {importError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {/* Import confirmation panel */}
            {importSummary && (
              <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-[#07172E] border border-cyan-200 dark:border-cyan-900 text-xs space-y-3 animate-in fade-in duration-150">
                <div className="font-bold text-cyan-900 dark:text-cyan-200">
                  Cópia de Segurança Validada:
                </div>
                <div className="text-slate-700 dark:text-slate-300 space-y-1">
                  <p>• {importSummary.summary?.recordCount} registos encontrados</p>
                  <p>• Parâmetros clínicos incluídos: {importSummary.summary?.hasSettings ? 'Sim' : 'Não'}</p>
                  {importSummary.summary?.exportDate && (
                    <p>• Criada em: {new Date(importSummary.summary.exportDate).toLocaleString('pt-PT')}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-cyan-200 dark:border-cyan-900/60">
                  <button
                    type="button"
                    onClick={() => executeImport('merge')}
                    className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition"
                  >
                    Combinar com Registos Atuais (Sem Duplicados)
                  </button>
                  <button
                    type="button"
                    onClick={() => executeImport('replace')}
                    className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition"
                  >
                    Substituir Tudo pelos Dados Deste Ficheiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportSummary(null)}
                    className="w-full py-1 text-slate-500 dark:text-slate-400 hover:underline text-center"
                  >
                    Cancelar Importação
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Destructive Action: Clear All Data */}
          <div className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              Zona de Perigo
            </h3>
            <p className="text-xs text-red-600 dark:text-red-300">
              Apaga permanentemente todos os registos do teu dispositivo. Esta ação não pode ser desfeita sem uma cópia de segurança.
            </p>
            <button
              type="button"
              onClick={onClearAllData}
              className="mt-2 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs transition"
            >
              Apagar Todos os Dados
            </button>
          </div>
        </div>
      )}

      {/* 4. Privacy & Info Tab */}
      {activeSubTab === 'privacy' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Privacidade dos Teus Dados
            </h3>

            {/* Exact required notice from user prompt */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
              «Os teus dados são guardados localmente neste navegador. A aplicação não necessita de uma conta nem de uma base de dados externa. Se apagares os dados do site ou mudares de dispositivo ou navegador, poderás perder os registos. Exporta cópias de segurança regularmente.»
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2">
              <p>
                ✓ <strong>100% Gratuito e sem contas:</strong> Não existe login, registo, palavras-passe ou anúncios.
              </p>
              <p>
                ✓ <strong>Sem servidores ou nuvens:</strong> Nenhuma informação de saúde ou dose é enviada para a Internet.
              </p>
              <p>
                ✓ <strong>Offline total:</strong> Podes consultar e registar dados mesmo sem rede ou dados móveis.
              </p>
            </div>
          </div>

          {/* Install as App on iPhone */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-500" />
              Instalar no iPhone (Ecrã Principal)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Para utilizares a DiabGo como uma aplicação nativa no teu iPhone:
            </p>
            <ol className="text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside space-y-1 font-medium">
              <li>Abre esta página no <strong>Safari</strong> do teu iPhone.</li>
              <li>Toca no botão <strong>Partilhar</strong> (ícone de quadrado com seta para cima).</li>
              <li>Desliza para baixo e seleciona <strong>«Ecrã Principal» (Add to Home Screen)</strong>.</li>
            </ol>
            <button
              type="button"
              onClick={onOpenInstallGuide}
              className="mt-2 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-xs transition"
            >
              Ver Guia de Instalação Passo a Passo
            </button>
          </div>

          {/* Autoria / Sobre */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1B30] border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center shrink-0 text-cyan-600 dark:text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Sobre a Aplicação
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                Esta app foi criada por <strong className="font-semibold text-slate-900 dark:text-white">José Miguel Fernandes Nave</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Indication: Always visible at bottom of Settings */}
      <div className="pt-3 pb-1 text-center border-t border-slate-200/60 dark:border-slate-800/60">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          App criada por <strong className="font-semibold text-slate-700 dark:text-slate-200">José Miguel Fernandes Nave</strong>
        </p>
      </div>
    </div>
  );
};
