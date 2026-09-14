import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full';
  variant?: 'modal' | 'page';
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = '4xl',
  variant = 'modal',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (variant === 'modal') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, variant]);

  if (!isOpen) return null;

  if (variant === 'page') {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-chumbo-950 dark:text-white flex flex-col">
        {(title || icon) && (
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-chumbo-800 dark:bg-chumbo-950/90">
            <div className="mx-auto flex max-w-[1720px] items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
              <div className="flex items-center gap-3">
                {icon && <div className="text-cyan-600 dark:text-laser-400">{icon}</div>}
                <div>
                  {typeof title === 'string' ? (
                    <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{title}</h1>
                  ) : (
                    title
                  )}
                  {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-chumbo-800 dark:hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto w-full max-w-[1720px] flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</main>
        {footer && (
          <footer className="border-t border-slate-200 bg-white dark:border-chumbo-800 dark:bg-chumbo-900/50">
            <div className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-8 py-4">{footer}</div>
          </footer>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl transition-all dark:border-chumbo-800 dark:bg-chumbo-950 ${MAX_WIDTH_CLASSES[maxWidth]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || icon) && (
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-chumbo-850 dark:bg-chumbo-900/60">
            <div className="flex items-center gap-3">
              {icon && <div className="text-cyan-600 dark:text-laser-400">{icon}</div>}
              <div>
                {typeof title === 'string' ? (
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
                ) : (
                  title
                )}
                {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-chumbo-800 dark:hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && <footer className="border-t border-slate-200 bg-white p-4 dark:border-chumbo-850 dark:bg-chumbo-900/40">{footer}</footer>}
      </div>
    </div>
  );
};
