import React from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { MLSearchInsight } from '../../../../../types';

interface MarketplaceInsightsTabProps {
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  onSearch: (query: string) => void;
  searchInsight: MLSearchInsight | null;
  loadingInsights: boolean;
}

export const MarketplaceInsightsTab: React.FC<MarketplaceInsightsTabProps> = ({
  searchQuery,
  onChangeSearchQuery,
  onSearch,
  searchInsight,
  loadingInsights,
}) => {
  return (
    <div className="space-y-6">
      {/* Search Query Bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch(searchQuery)}
          placeholder="Digite um produto ou termo (ex: suporte headset, vaso 3d)..."
          className="w-full bg-transparent text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 dark:text-white dark:placeholder-slate-500"
        />
        <button
          onClick={() => onSearch(searchQuery)}
          disabled={loadingInsights}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm dark:bg-amber-500 dark:text-chumbo-950 dark:hover:bg-amber-400"
        >
          {loadingInsights ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>Buscar ML</span>}
        </button>
      </div>

      {searchInsight && (
        <>
          {/* Benchmark Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preço Médio do Mercado</span>
              <div className="text-2xl font-black text-slate-900 mt-1 dark:text-white">
                R$ {searchInsight.avg_price.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">
                Mín: R$ {searchInsight.min_price.toFixed(2)} | Máx: R$ {searchInsight.max_price.toFixed(2)}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preço Sugerido (Sua Loja)</span>
              <div className="text-2xl font-black text-amber-700 mt-1 dark:text-amber-400">
                R$ {searchInsight.recommended_price.toFixed(2)}
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block dark:text-emerald-400">
                Competitivo vs concorrentes
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Custo Estimado de Impressão</span>
              <div className="text-2xl font-black text-slate-700 mt-1 dark:text-slate-300">
                R$ {searchInsight.estimated_print_cost.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block dark:text-slate-400">
                Filamento + Energia + Embalagem
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Margem de Lucro Bruta</span>
              <div className="text-2xl font-black text-emerald-700 mt-1 dark:text-emerald-400">
                {searchInsight.profit_margin_percent}%
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block dark:text-emerald-300">
                Lucro de ~R$ {searchInsight.estimated_profit.toFixed(2)} por unidade
              </span>
            </div>
          </div>

          {/* Ratios & Market Specs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
            <h4 className="text-sm font-bold text-slate-900 mb-4 dark:text-white">Métricas de Concorrência & Logística</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-chumbo-950 dark:border-chumbo-800">
                <span className="text-xs text-slate-600 dark:text-slate-300">Anúncios com Frete Grátis</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {Math.round(searchInsight.free_shipping_ratio * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-chumbo-950 dark:border-chumbo-800">
                <span className="text-xs text-slate-600 dark:text-slate-300">Vendedores MercadoLíder</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {Math.round(searchInsight.mercado_lider_ratio * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-chumbo-950 dark:border-chumbo-800">
                <span className="text-xs text-slate-600 dark:text-slate-300">Entregas FULL</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {Math.round(searchInsight.full_ratio * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Top Seller Listings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900">
            <h4 className="text-sm font-bold text-slate-900 mb-4 dark:text-white">Top Vendedores & Anúncios no Mercado Livre</h4>
            <div className="divide-y divide-slate-100 dark:divide-chumbo-800">
              {searchInsight.top_sellers.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt={item.title} className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-chumbo-700" />
                    )}
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">R$ {item.price.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">· {item.sold_quantity} vendidos</span>
                        {item.free_shipping && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-transparent">
                            Frete Grátis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={
                      item.permalink && !['https://mercadolivre.com.br', 'https://www.mercadolivre.com.br', 'https://www.mercadolivre.com.br/'].includes(item.permalink.trim())
                        ? item.permalink
                        : `https://lista.mercadolivre.com.br/${encodeURIComponent(item.title || searchQuery || 'impressao 3d')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 shrink-0"
                  >
                    <span>Ver no ML</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
