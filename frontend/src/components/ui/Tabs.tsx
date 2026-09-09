import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'pills' | 'underline';
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-chumbo-800 space-x-4 overflow-x-auto ${className}`}>
        {items.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'border-laser-400 text-laser-400'
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                    isActive ? 'bg-laser-400/20 text-laser-400' : 'bg-chumbo-800 text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav className={`flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-1.5 backdrop-blur-md ${className}`}>
      {items.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-laser-400 text-chumbo-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:bg-chumbo-800/80 hover:text-white'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                  isActive ? 'bg-chumbo-950/20 text-chumbo-950' : 'bg-chumbo-800 text-slate-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
