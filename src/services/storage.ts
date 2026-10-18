import { DiabetesRecord, Settings, MealType } from '../types';

const DB_NAME = 'diabgo_db';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_SETTINGS = 'settings';
const SETTINGS_KEY = 'app_settings';

export const DEFAULT_SETTINGS: Settings = {
  carbRatio: {
    mode: 'dia_inteiro',
    allDayValue: 10, // 10g per 1 unit
    timeSlots: [
      { id: '1', start: '06:00', end: '12:00', value: 8, label: 'Manhã' },
      { id: '2', start: '12:00', end: '19:00', value: 10, label: 'Tarde' },
      { id: '3', start: '19:00', end: '23:59', value: 10, label: 'Noite' },
      { id: '4', start: '00:00', end: '06:00', value: 12, label: 'Madrugada' },
    ],
    mealValues: {
      pequeno_almoco: 8,
      almoco: 10,
      lanche: 10,
      jantar: 10,
      ceia: 12,
      outra: 10,
    },
  },
  isf: {
    mode: 'dia_inteiro',
    allDayValue: 40, // 1U drops 40 mg/dL
    timeSlots: [
      { id: '1', start: '06:00', end: '12:00', value: 35, label: 'Manhã' },
      { id: '2', start: '12:00', end: '19:00', value: 40, label: 'Tarde' },
      { id: '3', start: '19:00', end: '23:59', value: 40, label: 'Noite' },
      { id: '4', start: '00:00', end: '06:00', value: 50, label: 'Madrugada' },
    ],
    mealValues: {
      pequeno_almoco: 35,
      almoco: 40,
      lanche: 40,
      jantar: 40,
      ceia: 50,
      outra: 40,
    },
  },
  targetGlucose: {
    mode: 'dia_inteiro',
    allDayValue: 100, // 100 mg/dL
    timeSlots: [
      { id: '1', start: '06:00', end: '23:00', value: 100, label: 'Dia' },
      { id: '2', start: '23:00', end: '06:00', value: 110, label: 'Noite' },
    ],
    mealValues: {
      pequeno_almoco: 100,
      almoco: 100,
      lanche: 100,
      jantar: 100,
      ceia: 110,
      outra: 100,
    },
  },
  insulinDurationHours: 3,
  doseRounding: 0.1,
  theme: 'auto',
  glucoseUnit: 'mg/dL',
  carbsUnit: 'g',
};

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isIndexedDBAvailable: boolean = typeof indexedDB !== 'undefined';

  constructor() {
    if (this.isIndexedDBAvailable) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_RECORDS)) {
              const recordStore = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
              recordStore.createIndex('timestamp', 'timestamp', { unique: false });
              recordStore.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
              db.createObjectStore(STORE_SETTINGS);
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            console.warn('IndexedDB failed to open, using LocalStorage fallback.', request.error);
            this.isIndexedDBAvailable = false;
            reject(request.error);
          };
        } catch (err) {
          console.warn('IndexedDB exception, using LocalStorage fallback.', err);
          this.isIndexedDBAvailable = false;
          reject(err);
        }
      });
    }
    return this.dbPromise;
  }

  // Fallback storage helpers
  private getFallbackRecords(): DiabetesRecord[] {
    try {
      const data = localStorage.getItem('diabgo_records');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveFallbackRecords(records: DiabetesRecord[]) {
    try {
      localStorage.setItem('diabgo_records', JSON.stringify(records));
    } catch (e) {
      console.error('LocalStorage error saving records:', e);
    }
  }

  // --- Records Operations ---

  async getRecords(): Promise<DiabetesRecord[]> {
    if (!this.isIndexedDBAvailable) {
      return this.getFallbackRecords().sort((a, b) => b.timestamp - a.timestamp);
    }

    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RECORDS, 'readonly');
        const store = tx.objectStore(STORE_RECORDS);
        const request = store.getAll();

        request.onsuccess = () => {
          const records: DiabetesRecord[] = request.result || [];
          records.sort((a, b) => b.timestamp - a.timestamp);
          // Keep fallback in sync
          this.saveFallbackRecords(records);
          resolve(records);
        };

        request.onerror = () => {
          console.warn('Error reading from IndexedDB, using fallback:', request.error);
          resolve(this.getFallbackRecords().sort((a, b) => b.timestamp - a.timestamp));
        };
      });
    } catch {
      return this.getFallbackRecords().sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  async saveRecord(record: DiabetesRecord): Promise<void> {
    const existing = await this.getRecords();
    const index = existing.findIndex((r) => r.id === record.id);
    let updated: DiabetesRecord[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = record;
    } else {
      updated = [record, ...existing];
    }
    this.saveFallbackRecords(updated);

    if (this.isIndexedDBAvailable) {
      try {
        const db = await this.initDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_RECORDS, 'readwrite');
          const store = tx.objectStore(STORE_RECORDS);
          const req = store.put(record);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn('Failed to write to IndexedDB, stored in fallback only:', err);
      }
    }
  }

  async deleteRecord(id: string): Promise<void> {
    const existing = await this.getRecords();
    const updated = existing.filter((r) => r.id !== id);
    this.saveFallbackRecords(updated);

    if (this.isIndexedDBAvailable) {
      try {
        const db = await this.initDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_RECORDS, 'readwrite');
          const store = tx.objectStore(STORE_RECORDS);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn('Failed to delete from IndexedDB:', err);
      }
    }
  }

  async clearAllRecords(): Promise<void> {
    this.saveFallbackRecords([]);

    if (this.isIndexedDBAvailable) {
      try {
        const db = await this.initDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_RECORDS, 'readwrite');
          const store = tx.objectStore(STORE_RECORDS);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn('Failed to clear IndexedDB:', err);
      }
    }
  }

  // --- Settings Operations ---

  async getSettings(): Promise<Settings> {
    // Try localStorage first for instant boot
    let cached: Settings | null = null;
    try {
      const raw = localStorage.getItem('diabgo_settings');
      if (raw) {
        cached = JSON.parse(raw);
      }
    } catch {
      // ignore
    }

    if (!this.isIndexedDBAvailable) {
      return cached ? { ...DEFAULT_SETTINGS, ...cached } : DEFAULT_SETTINGS;
    }

    try {
      const db = await this.initDB();
      const dbSettings = await new Promise<Settings | null>((resolve) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.get(SETTINGS_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (dbSettings) {
        const merged = { ...DEFAULT_SETTINGS, ...dbSettings };
        try {
          localStorage.setItem('diabgo_settings', JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      }
    } catch {
      // fallback
    }

    return cached ? { ...DEFAULT_SETTINGS, ...cached } : DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      localStorage.setItem('diabgo_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Error saving settings to LocalStorage:', e);
    }

    if (this.isIndexedDBAvailable) {
      try {
        const db = await this.initDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_SETTINGS, 'readwrite');
          const store = tx.objectStore(STORE_SETTINGS);
          const req = store.put(settings, SETTINGS_KEY);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn('Failed to save settings to IndexedDB:', err);
      }
    }
  }

  async getStorageInfo(): Promise<{ count: number; indexedDBOk: boolean; estimatedSizeKb: number }> {
    const records = await this.getRecords();
    const str = JSON.stringify(records) + (localStorage.getItem('diabgo_settings') || '');
    const bytes = new Blob([str]).size;
    return {
      count: records.length,
      indexedDBOk: this.isIndexedDBAvailable,
      estimatedSizeKb: Math.round((bytes / 1024) * 10) / 10,
    };
  }
}

export const storage = new StorageService();
