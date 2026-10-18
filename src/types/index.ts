export type MealType =
  | 'pequeno_almoco'
  | 'almoco'
  | 'lanche'
  | 'jantar'
  | 'ceia'
  | 'outra';

export const MEAL_LABELS: Record<MealType, string> = {
  pequeno_almoco: 'Pequeno-almoço',
  almoco: 'Almoço',
  lanche: 'Lanche',
  jantar: 'Jantar',
  ceia: 'Ceia',
  outra: 'Outra',
};

export type ParameterMode = 'dia_inteiro' | 'por_horario' | 'por_refeicao';

export interface TimeSlot {
  id: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  value: number;
  label?: string;
}

export interface ClinicalParameterConfig {
  mode: ParameterMode;
  allDayValue: number;
  timeSlots: TimeSlot[];
  mealValues: Record<MealType, number>;
}

export type DoseStatus = 'administrada' | 'calculada' | 'nao_administrada';

export interface DiabetesRecord {
  id: string;
  timestamp: number; // ms since epoch
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm
  meal: MealType;
  glucose?: number;  // mg/dL
  carbs: number;     // grams
  calculatedDose: number; // units
  administeredDose?: number; // units actually administered
  carbInsulin: number; // units
  correctionInsulin: number; // units
  activeInsulinDeducted: number; // units deducted
  eligibleActiveInsulin: number; // eligible units from previous corrections
  isCorrectionOnly?: boolean; // Record for correction only (no carbs)
  status: DoseStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  carbRatio: ClinicalParameterConfig; // grams of carbs per 1 unit of insulin
  isf: ClinicalParameterConfig;       // Fator de Sensibilidade à Insulina (FSE): mg/dL dropped per 1 unit
  targetGlucose: ClinicalParameterConfig; // Target glucose in mg/dL
  insulinDurationHours: number;       // Duration of rapid insulin action, default 3 hours
  doseRounding: 0.1 | 0.5 | 1.0;     // Precision rounding for insulin dose
  theme: 'light' | 'dark' | 'auto';
  glucoseUnit: 'mg/dL';
  carbsUnit: 'g';
}

export interface CalculationResult {
  carbInsulin: number;
  correctionInsulin: number;
  eligibleActiveInsulin: number;
  netDose: number;
  roundedDose: number;
  appliedCarbRatio: number;
  appliedIsf: number;
  appliedTargetGlucose: number;
  isHypo: boolean;
  isHyper: boolean;
  warnings: string[];
  explanation: string[];
}

export interface BackupData {
  appName: 'DiabGo';
  version: '1.0';
  exportDate: string;
  settings: Settings;
  records: DiabetesRecord[];
}
