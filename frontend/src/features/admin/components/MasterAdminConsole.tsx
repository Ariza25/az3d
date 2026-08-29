import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Boxes, Inbox, Layers, LogOut, RefreshCw, ServerCog, ShieldCheck } from 'lucide-react';
import { api } from '../../../services/api';
import { ObservabilityHealth, PlatformEnvironment, PlatformOverview, WebhookLogItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { AdminEnvironment } from './AdminEnvironment';
import { AdminMasterOverview } from './AdminMasterOverview';
import { AdminObservability } from './AdminObservability';
import { AdminOutbox } from './AdminOutbox';

type MasterTab = 'overview' | 'outbox' | 'environment' | 'observability';

interface MasterAdminConsoleProps {
  onClose: () => void;
}

const tabs: Array<{ id: MasterTab; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Plataforma', description: 'Tenants e volume', icon: Boxes },
  { id: 'outbox', label: 'Outbox', description: 'Eventos e falhas', icon: Inbox },
  { id: 'environment', label: 'Ambiente', description: 'Variáveis e OAuth', icon: ServerCog },
  { id: 'observability', label: 'Observabilidade', description: 'Health e dependências', icon: Activity },
];

export const MasterAdminConsole: React.FC<MasterAdminConsoleProps> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTab>('overview');
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [environment, setEnvironment] = useState<PlatformEnvironment | null>(null);
  const [health, setHealth] = useState<ObservabilityHealth | null>(null);
  const [outbox, setOutbox] = useState<WebhookLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [platformOverview, platformEnvironment, observability, events] = await Promise.all([
        api.getPlatformOverview(),
        api.getPlatformEnvironment(),
        api.getObservabilityHealth(),
        api.getWebhookLogs(150),
      ]);
      setOverview(platformOverview);
      setEnvironment(platformEnvironment);
      setHealth(observability);
      setOutbox(events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o plano de controle.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentTab = useMemo(() => tabs.find((tab) => tab.id === activeTab) || tabs[0], [activeTab]);

  const renderNavigation = (compact = false) => (
    <nav className={compact ? 'flex gap-2 overflow-x-auto px-4 py-3' : 'space-y-1.5 px-3'}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={compact
              ? `flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${active ? 'border-laser-500/40 bg-laser-500/10 text-laser-300' : 'border-chumbo-800 bg-chumbo-900 text-slate-400'}`
              : `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${active ? 'bg-laser-500/10 text-white' : 'text-slate-400 hover:bg-chumbo-900 hover:text-white'}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${active ? 'border-laser-500/30 bg-laser-500/10 text-laser-400' : 'border-chumbo-800 bg-chumbo-950 text-slate-500'}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <strong className="block text-xs">{tab.label}</strong>
              {!compact && <span className="mt-0.5 block text-[10px] font-normal text-slate-600">{tab.description}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-chumbo-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1800px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-chumbo-800 bg-chumbo-950 lg:flex">
          <div className="flex h-24 items-center gap-3 border-b border-chumbo-800 px-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-laser-500/30 bg-laser-500/10 text-laser-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <strong className="block text-lg font-extrabold text-white">AZ3D Control</strong>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-laser-400">Master console</span>
            </div>
          </div>

          <div className="px-6 pb-3 pt-6 text-[10px] font-mono uppercase tracking-[0.16em] text-slate-600">Plano de controle</div>
          {renderNavigation()}

          <div className="mt-auto border-t border-chumbo-800 p-4">
            <div className="mb-3 rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-laser-400" />
                <strong className="truncate text-xs text-white">{user?.name}</strong>
              </div>
              <p className="mt-1 truncate text-[10px] text-slate-500">{user?.email}</p>
              <span className="mt-2 inline-block rounded bg-laser-500/10 px-2 py-1 text-[9px] font-bold uppercase text-laser-300">master_admin</span>
            </div>
            <button type="button" onClick={onClose} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-chumbo-900 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Voltar para a loja
            </button>
            <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
              <LogOut className="h-4 w-4" /> Encerrar sessão
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-24 items-center justify-between gap-4 border-b border-chumbo-800 bg-chumbo-950/90 px-5 py-4 backdrop-blur-xl sm:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-laser-500/30 bg-laser-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-laser-300">Control plane</span>
                <span className="text-[10px] font-mono text-slate-600">somente plataforma</span>
              </div>
              <h1 className="mt-2 truncate text-xl font-extrabold text-white sm:text-2xl">{currentTab.label}</h1>
            </div>
            <button type="button" onClick={() => void load()} disabled={isLoading} className="flex h-10 items-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-900 px-3.5 text-xs font-bold text-slate-300 hover:bg-chumbo-800 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </header>

          <div className="border-b border-chumbo-800 bg-chumbo-950 lg:hidden">{renderNavigation(true)}</div>

          <main className="p-5 sm:p-8">
            {error && (
              <div role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
            )}
            {isLoading && !overview ? (
              <div className="flex min-h-[420px] items-center justify-center text-xs font-mono uppercase tracking-widest text-slate-500">Carregando plano de controle...</div>
            ) : (
              <>
                {activeTab === 'overview' && <AdminMasterOverview platformOverview={overview} />}
                {activeTab === 'outbox' && <AdminOutbox events={outbox} onRefresh={() => void load()} />}
                {activeTab === 'environment' && <AdminEnvironment environment={environment} onRefresh={() => void load()} />}
                {activeTab === 'observability' && <AdminObservability health={health} onRefresh={() => void load()} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
