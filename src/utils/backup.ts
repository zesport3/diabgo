import { BackupData, Settings, DiabetesRecord } from '../types';

export function exportBackup(settings: Settings, records: DiabetesRecord[]): void {
  const data: BackupData = {
    appName: 'DiabGo',
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings,
    records,
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `DiabGo_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  data?: BackupData;
  summary?: {
    recordCount: number;
    hasSettings: boolean;
    exportDate?: string;
  };
}

export function validateBackupFile(fileContent: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(fileContent);

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'O ficheiro não contém um objeto JSON válido.' };
    }

    if (parsed.appName !== 'DiabGo' && parsed.appName !== 'EZDT1') {
      return {
        isValid: false,
        error: 'O ficheiro selecionado não é uma cópia de segurança DiabGo ou EZDT1 compatível.',
      };
    }

    if (!Array.isArray(parsed.records)) {
      return { isValid: false, error: 'O campo "records" não foi encontrado ou não é uma lista válida.' };
    }

    // Validate a sample or all records structure
    for (let i = 0; i < Math.min(parsed.records.length, 50); i++) {
      const r = parsed.records[i];
      if (!r.id || !r.date || !r.time || typeof r.carbs !== 'number') {
        return {
          isValid: false,
          error: `O registo na posição ${i + 1} contém campos obrigatórios inválidos.`,
        };
      }
    }

    return {
      isValid: true,
      data: parsed as BackupData,
      summary: {
        recordCount: parsed.records.length,
        hasSettings: !!parsed.settings && typeof parsed.settings === 'object',
        exportDate: parsed.exportDate,
      },
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Erro ao analisar o ficheiro JSON: ${err.message || 'Formato inválido'}`,
    };
  }
}

export function mergeRecords(
  existing: DiabetesRecord[],
  imported: DiabetesRecord[]
): { merged: DiabetesRecord[]; addedCount: number; duplicateCount: number } {
  const existingIds = new Set(existing.map((r) => r.id));
  const merged = [...existing];
  let addedCount = 0;
  let duplicateCount = 0;

  for (const item of imported) {
    if (existingIds.has(item.id)) {
      duplicateCount++;
    } else {
      merged.push(item);
      existingIds.add(item.id);
      addedCount++;
    }
  }

  merged.sort((a, b) => b.timestamp - a.timestamp);
  return { merged, addedCount, duplicateCount };
}
