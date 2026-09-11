import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

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
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in"
        >
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-chumbo-800/90 bg-chumbo-950/95 p-7 shadow-2xl shadow-black/90 backdrop-blur-xl min-w-[220px]">
            {/* Spinning Indicator */}
            <div className="relative flex items-center justify-center">
              <div className="h-14 w-14 rounded-full border-[3px] border-chumbo-800 border-t-laser-400 border-r-laser-400/50 animate-spin" />
              <div className="absolute h-10 w-10 rounded-full border-2 border-laser-500/20 border-b-laser-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              <Loader2 className="absolute h-5 w-5 text-laser-400 animate-spin" />
            </div>

            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold tracking-wide text-white">
                <span>{loadingMessage}</span>
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-laser-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1 w-1 rounded-full bg-laser-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1 w-1 rounded-full bg-laser-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
              <span className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                AZ3D PLATFORM
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
