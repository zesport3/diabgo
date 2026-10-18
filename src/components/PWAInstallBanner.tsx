import React from 'react';
import { Smartphone, Share, PlusSquare, X } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  onInstall: () => void;
  isIOS: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  onInstall,
  isIOS,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0F1B30] p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-center text-slate-900 dark:text-white">
          Instalar a DiabGo
        </h3>
        <p className="mt-1 text-xs text-center text-slate-500 dark:text-slate-400">
          Acede à aplicação diretamente do ecrã inicial, sem barra de navegação e 100% offline.
        </p>

        {isInstallable ? (
          <div className="mt-5">
            <button
              onClick={() => {
                onInstall();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-cyan-600/20 transition cursor-pointer"
            >
              Instalar Aplicação
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 shrink-0">
                <Share className="w-4 h-4" />
              </div>
              <p>
                <strong>1.</strong> Toca no botão <strong>Partilhar</strong> na barra de ferramentas do Safari (no fundo do iPhone).
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 shrink-0">
                <PlusSquare className="w-4 h-4" />
              </div>
              <p>
                <strong>2.</strong> Desliza para baixo no menu e toca em <strong>«Ecrã Principal»</strong>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <p>
                <strong>3.</strong> Toca em <strong>«Adicionar»</strong> no canto superior direito.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
