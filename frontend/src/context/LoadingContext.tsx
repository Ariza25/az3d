import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Layers } from 'lucide-react';

interface LoadingContextType {
  isLoading: boolean;
  activeCount: number;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCount, setActiveCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processando...');
  const [showOverlay, setShowOverlay] = useState(false);
  const timerRef = useRef<number | null>(null);

  const startLoading = useCallback((message?: string) => {
    if (message) setLoadingMessage(message);
    setActiveCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setActiveCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Intercept global fetch calls targeting API endpoints
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [resource, config] = args;
      const urlString = typeof resource === 'string' ? resource : resource instanceof URL ? resource.toString() : resource.url;

      // Ignore silent polling or non-API requests
      const isSilent = (config?.headers as Record<string, string> | undefined)?.['x-silent'] === 'true' ||
        urlString.includes('/payment-status') ||
        urlString.includes('/observability/health');

      const isApiRequest = urlString.includes('/api') || urlString.includes('localhost:8080') || urlString.startsWith('/api');

      if (isApiRequest && !isSilent) {
        startLoading();
        try {
          return await originalFetch(...args);
        } finally {
          stopLoading();
        }
      }

      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [startLoading, stopLoading]);

  // Smooth debounce to prevent micro-flicker on ultra-fast responses
  useEffect(() => {
    if (activeCount > 0) {
      if (timerRef.current === null) {
        timerRef.current = window.setTimeout(() => {
          setShowOverlay(true);
        }, 60);
      }
    } else {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShowOverlay(false);
      setLoadingMessage('Processando...');
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [activeCount]);

  return (
    <LoadingContext.Provider value={{ isLoading: showOverlay, activeCount, startLoading, stopLoading }}>
      {children}
      {showOverlay && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Carregando"
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/65 backdrop-blur-[3px] transition-all duration-200 animate-in fade-in"
        >
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-chumbo-800 bg-chumbo-950/95 p-6 shadow-2xl shadow-black/80 backdrop-blur-md min-w-[200px]">
            <div className="relative flex items-center justify-center">
              <div className="h-12 w-12 rounded-full border-3 border-laser-500/20 border-t-laser-400 animate-spin" />
              <Layers className="absolute h-5 w-5 text-laser-400 animate-pulse" />
            </div>
            <div className="text-center">
              <span className="block text-xs font-bold tracking-wide text-white">
                {loadingMessage}
              </span>
              <span className="mt-0.5 block text-[10px] font-mono uppercase tracking-widest text-slate-500">
                AZ3D
              </span>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading deve ser usado dentro de um LoadingProvider');
  }
  return context;
};
