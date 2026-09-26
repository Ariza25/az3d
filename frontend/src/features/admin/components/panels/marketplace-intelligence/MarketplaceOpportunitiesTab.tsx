import React from 'react';
import { ArrowUpRight, ExternalLink, Sparkles } from 'lucide-react';
import { MLProductOpportunity } from '../../../../../types';
import { MarketplaceProvider } from './MarketplaceHeader';

interface MarketplaceOpportunitiesTabProps {
  opportunities: MLProductOpportunity[];
  provider: MarketplaceProvider;
  onSimulateAd: (opp: MLProductOpportunity) => void;
}

export const MarketplaceOpportunitiesTab: React.FC<MarketplaceOpportunitiesTabProps> = ({
  opportunities,
  provider,
  onSimulateAd,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-6 shadow-sm dark:border-amber-500/30 dark:bg-gradient-to-r dark:from-amber-500/10 dark:via-chumbo-900 dark:to-chumbo-950">
        <div className="flex items-start gap-4">
          <Sparkles className="h-6 w-6 text-amber-700 shrink-0 mt-1 dark:text-amber-400" />
          <div>
            <h3 className="text-base font-extrabold text-amber-950 dark:text-white">
              Oportunidades de Venda em Impressão 3D
            </h3>
            <p className="text-xs text-amber-900/80 mt-1 dark:text-slate-300">
              Nossa inteligência cruza o volume de buscas no marketplace com o custo de filamento e tempo de máquina para indicar os itens com maior margem e demanda garantida.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-amber-400 hover:shadow-md dark:border-chumbo-800 dark:bg-chumbo-900 dark:hover:border-amber-500/40"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 dark:border-chumbo-700 dark:bg-chumbo-800 dark:text-amber-400">
                  {opp.category}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-amber-800 bg-amber-700 px-3 py-1 text-[11px] font-extrabold text-white shadow-sm dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400">
                  Score: {opp.opportunity_score}/100
                </span>
              </div>

              <h4 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">
                {opp.title}
              </h4>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-chumbo-800 dark:bg-chumbo-950">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Preço Sugerido</span>
                  <span className="text-sm font-black text-amber-700 dark:text-amber-400">R$ {opp.suggested_price.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Peso / Tempo</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{opp.estimated_print_grams}g · {opp.estimated_print_hours}h</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Margem Bruta</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{opp.profit_margin_percent}%</span>
                </div>
              </div>

              <div className="mt-4 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Demanda de busca:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{opp.demand_level}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Nível de concorrência:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{opp.competition_level}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Lucro por peça:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">R$ {opp.estimated_profit.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  Palavras-chave Alvo:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {opp.target_keywords.map((kw) => (
                    <span key={kw} className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-700 dark:border-transparent dark:bg-chumbo-800 dark:text-slate-300">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-chumbo-800 flex items-center justify-between gap-3">
              <a
                href={
                  provider === 'shopee'
                    ? `https://shopee.com.br/search?keyword=${encodeURIComponent(opp.title)}`
                    : provider === 'amazon'
                      ? `https://www.amazon.com.br/s?k=${encodeURIComponent(opp.title)}`
                      : `https://lista.mercadolivre.com.br/${encodeURIComponent(opp.title)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 hover:underline shrink-0"
              >
                <span>Ver no {provider === 'mercadolivre' ? 'Mercado Livre' : provider === 'shopee' ? 'Shopee' : 'Amazon'}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <button
                onClick={() => onSimulateAd(opp)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-800 bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-800 dark:border-transparent dark:bg-amber-500 dark:text-chumbo-950 dark:hover:bg-amber-400"
              >
                <span>Simular Anúncio</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
