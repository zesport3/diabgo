import React from 'react';
import { WifiOff, Moon, Sun, Smartphone } from 'lucide-react';
import { ThemeMode } from '../hooks/useTheme';

interface HeaderProps {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  isOnline: boolean;
  onOpenInstallGuide?: () => void;
  canInstall?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  resolvedTheme,
  onToggleTheme,
  isOnline,
  onOpenInstallGuide,
  canInstall,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-[#0B192C]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 pt-[env(safe-area-inset-top,0px)] transition-colors">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 shadow-md shadow-cyan-500/20 text-white">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              <path d="M9 13h2l1-2 2 4 1-2h2" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Diab<span className="text-cyan-500">Go</span>
              </span>
              {!isOnline && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                  <WifiOff className="w-2.5 h-2.5" />
                  Offline
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none">
              A tua diabetes. Mais simples.
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {canInstall && onOpenInstallGuide && (
            <button
              onClick={onOpenInstallGuide}
              title="Instalar no iPhone / Ecrã Principal"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              aria-label="Instalar DiabGo"
            >
              <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </button>
          )}

          <button
            onClick={onToggleTheme}
            title={resolvedTheme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
            aria-label="Alternar tema"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
