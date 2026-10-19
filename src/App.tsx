import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { GlucoseChart } from './components/GlucoseChart';
import { RecordHistory } from './components/RecordHistory';
import { RecordModal } from './components/RecordModal';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ConfirmModal } from './components/ConfirmModal';
import { PWAInstallModal } from './components/PWAInstallBanner';
import { storage, DEFAULT_SETTINGS } from './services/storage';
import { DiabetesRecord, Settings } from './types';
import { useTheme } from './hooks/useTheme';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [records, setRecords] = useState<DiabetesRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Selected date on the daily glucose chart (defaults to today YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<DiabetesRecord | null>(null);

  // Confirm modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {},
  });

  // PWA install guide modal
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Theme & PWA
  const { themeMode, resolvedTheme, changeTheme } = useTheme(settings.theme || 'auto');
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Online / Offline status
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial load from storage
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [loadedSettings, loadedRecords] = await Promise.all([
          storage.getSettings(),
          storage.getRecords(),
        ]);
        if (isMounted) {
          setSettings(loadedSettings);
          setRecords(loadedRecords);
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Error initializing DiabGo data:', err);
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // History scroll container ref & scroll tracking
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrolling = useRef<boolean>(false);
  const programmaticTimer = useRef<any>(null);
  const scrollRafId = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollRafId.current) cancelAnimationFrame(scrollRafId.current);
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    };
  }, []);

  // Handler when date is changed from the chart navigation (arrows/calendar/today) or clicking day card
  const handleSelectDateFromChart = (newDate: string) => {
    setSelectedDate(newDate);

    // Smooth scroll the history container to the selected day's card
    const container = historyScrollRef.current;
    if (!container) return;

    const targetEl = container.querySelector<HTMLElement>(`[data-history-date="${newDate}"]`);
    if (targetEl) {
      isProgrammaticScrolling.current = true;
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);

      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      programmaticTimer.current = setTimeout(() => {
        isProgrammaticScrolling.current = false;
      }, 700);
    }
  };

  // Scroll listener on history: as user scrolls through previous days, the fixed chart follows the visible day
  const handleHistoryScroll = () => {
    if (isProgrammaticScrolling.current) return;
    if (scrollRafId.current) cancelAnimationFrame(scrollRafId.current);

    scrollRafId.current = requestAnimationFrame(() => {
      const container = historyScrollRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const dayElements = container.querySelectorAll<HTMLElement>('[data-history-date]');
      if (dayElements.length === 0) return;

      // Scrolled to top: select the very first day
      if (container.scrollTop < 25) {
        const firstDate = dayElements[0].getAttribute('data-history-date');
        if (firstDate && firstDate !== selectedDate) {
          setSelectedDate(firstDate);
        }
        return;
      }

      // Scrolled near bottom: select the last day
      if (container.scrollHeight - container.scrollTop - container.clientHeight < 40) {
        const lastDate = dayElements[dayElements.length - 1].getAttribute('data-history-date');
        if (lastDate && lastDate !== selectedDate) {
          setSelectedDate(lastDate);
        }
        return;
      }

      // Middle: find the section intersecting near the top of the history list
      const thresholdY = containerRect.top + 75;
      let matchingDate: string | null = null;

      for (let i = 0; i < dayElements.length; i++) {
        const el = dayElements[i];
        const rect = el.getBoundingClientRect();
        if (rect.top <= thresholdY && rect.bottom > thresholdY - 40) {
          matchingDate = el.getAttribute('data-history-date');
          break;
        }
      }

      if (matchingDate && matchingDate !== selectedDate) {
        setSelectedDate(matchingDate);
      }
    });
  };

  // Handler to save/edit a record
  const handleSaveRecord = async (savedRecord: DiabetesRecord) => {
    await storage.saveRecord(savedRecord);
    const updated = await storage.getRecords();
    setRecords(updated);
    setIsRecordModalOpen(false);
    setEditingRecord(null);
    // Align chart date to saved record's date
    setSelectedDate(savedRecord.date);
  };

  // Handler to delete a record
  const handleDeleteRecord = (id: string) => {
    const target = records.find((r) => r.id === id);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Registo',
      message: `Tens a certeza de que queres eliminar o registo de ${target.date} às ${target.time} (${target.carbs}g HC)? Esta ação não pode ser desfeita.`,
      isDestructive: true,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await storage.deleteRecord(id);
        const updated = await storage.getRecords();
        setRecords(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Handler to clear all data
  const handleClearAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Apagar Todos os Dados?',
      message:
        'ATENÇÃO: Todos os teus registos glicémicos e doses guardados no dispositivo serão permanentemente apagados.\n\nRecomendamos exportar uma cópia de segurança antes de continuar.',
      isDestructive: true,
      confirmLabel: 'Sim, Apagar Tudo',
      onConfirm: async () => {
        await storage.clearAllRecords();
        setRecords([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await storage.saveSettings(newSettings);
  };

  // Toggle theme between light and dark (or auto cycle)
  const handleToggleTheme = () => {
    const nextMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    changeTheme(nextMode);
    handleUpdateSettings({ ...settings, theme: nextMode });
  };

  const handleSelectThemeMode = (mode: 'light' | 'dark' | 'auto') => {
    changeTheme(mode);
    handleUpdateSettings({ ...settings, theme: mode });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#070C16] text-slate-800 dark:text-slate-200">
        <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 animate-pulse">
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </div>
        <p className="mt-3 text-xs font-bold tracking-wider uppercase text-cyan-600 dark:text-cyan-400">
          A carregar a DiabGo...
        </p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-slate-50 dark:bg-[#070C16] text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors selection:bg-cyan-500 selection:text-white">
      {/* 1. Fixed Header (DiabGo) */}
      <Header
        themeMode={themeMode}
        resolvedTheme={resolvedTheme}
        onToggleTheme={handleToggleTheme}
        isOnline={isOnline}
        onOpenInstallGuide={() => setIsInstallModalOpen(true)}
        canInstall={!isInstalled && (isInstallable || isIOS)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto flex flex-col min-h-0 overflow-hidden">
        {/* Tab 1: Início (Home) */}
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* 2. Gráfico diário de glicemia AFIXADO (Pinned at the top) */}
            <div className="shrink-0 px-4 pt-2 pb-1.5">
              <GlucoseChart
                records={records}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDateFromChart}
                onOpenNewRecord={() => {
                  setEditingRecord(null);
                  setIsRecordModalOpen(true);
                }}
              />
            </div>

            {/* 4. Histórico organizado por dias (SÓ MEXE O HISTÓRICO - scrollable area) */}
            <div
              ref={historyScrollRef}
              onScroll={handleHistoryScroll}
              className="flex-1 min-h-0 overflow-y-auto px-4 pb-20 pt-1 space-y-3"
            >
              <RecordHistory
                records={records}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDateFromChart}
                onEditRecord={(rec) => {
                  setEditingRecord(rec);
                  setIsRecordModalOpen(true);
                }}
                onDeleteRecord={handleDeleteRecord}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Relatórios */}
        {activeTab === 'reports' && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-24">
            <ReportsView records={records} />
          </div>
        )}

        {/* Tab 3: Configurações */}
        {activeTab === 'settings' && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-24">
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              themeMode={themeMode}
              onChangeTheme={handleSelectThemeMode}
              records={records}
              onReloadRecords={setRecords}
              onClearAllData={handleClearAllData}
              onOpenInstallGuide={() => setIsInstallModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* 5. Fixed Bottom Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* New / Edit Record Modal */}
      {isRecordModalOpen && (
        <RecordModal
          isOpen={isRecordModalOpen}
          initialRecord={editingRecord}
          defaultDate={selectedDate}
          settings={settings}
          records={records}
          onSave={handleSaveRecord}
          onClose={() => {
            setIsRecordModalOpen(false);
            setEditingRecord(null);
          }}
          onNavigateToSettings={() => {
            setIsRecordModalOpen(false);
            setActiveTab('settings');
          }}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* PWA / iPhone Install Modal */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isInstallable={isInstallable}
        onInstall={install}
        isIOS={isIOS}
      />
    </div>
  );
}
