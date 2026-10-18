import React from 'react';
import { Home, BarChart2, Settings as SettingsIcon } from 'lucide-react';

export type TabType = 'home' | 'reports' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Início', icon: Home },
    { id: 'reports' as TabType, label: 'Relatórios', icon: BarChart2 },
    { id: 'settings' as TabType, label: 'Configurações', icon: SettingsIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 pb-[env(safe-area-inset-bottom,0px)] shadow-lg shadow-black/5 transition-colors">
      <div className="max-w-md mx-auto grid grid-cols-3 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`relative flex items-center justify-center p-1 rounded-full transition-transform ${
                  isActive ? 'scale-110' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-500" />
                )}
              </div>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
