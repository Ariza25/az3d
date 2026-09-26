import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { MLListingAudit, Product } from '../../../../../types';
import { MarketplaceProvider } from './MarketplaceHeader';

export interface AuditParams {
  title: string;
  price: number;
  images: number;
  free_shipping: boolean;
  full_shipping: boolean;
  material: string;
}

interface MarketplaceAuditTabProps {
  provider: MarketplaceProvider;
  products: Product[];
  selectedProductId: number | '';
  onSelectProduct: (productId: number) => void;
  auditParams: AuditParams;
  onChangeAuditParams: (params: AuditParams) => void;
  auditResult: MLListingAudit | null;
  loadingAudit: boolean;
  onRunAudit: () => void;
}

export const MarketplaceAuditTab: React.FC<MarketplaceAuditTabProps> = ({
  provider,
  products,
  selectedProductId,
  onSelectProduct,
  auditParams,
  onChangeAuditParams,
  auditResult,
  loadingAudit,
  onRunAudit,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Controls & Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-chumbo-800 dark:bg-chumbo-900">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 dark:text-white">
          <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Configurar Auditoria de Anúncio
        </h3>

        {products.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">
              Selecionar Produto do seu Catálogo
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => onSelectProduct(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
            >
              <option value="">-- Escolha um produto da loja --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (R$ {p.price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">
            Título do Anúncio ({provider === 'amazon' ? 'ideal 120-200 chars no padrão FBA' : provider === 'shopee' ? 'ideal 80-120 chars com #hashtags' : 'ideal 50-60 chars'})
          </label>
          <input
            type="text"
            value={auditParams.title}
            onChange={(e) => onChangeAuditParams({ ...auditParams, title: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
          />
          <span className={`text-[10px] mt-1 block font-mono ${
            provider === 'amazon'
              ? (auditParams.title.length >= 120 && auditParams.title.length <= 200 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')
              : provider === 'shopee'
              ? (auditParams.title.length >= 80 && auditParams.title.length <= 120 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')
              : (auditParams.title.length >= 45 && auditParams.title.length <= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')
          }`}>
            Tamanho atual: {auditParams.title.length} caracteres
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">Preço de Venda (R$)</label>
            <input
              type="number"
              step="0.1"
              value={auditParams.price}
              onChange={(e) => onChangeAuditParams({ ...auditParams, price: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">Qtd. de Fotos</label>
            <input
              type="number"
              value={auditParams.images}
              onChange={(e) => onChangeAuditParams({ ...auditParams, images: parseInt(e.target.value) || 1 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer dark:text-slate-300">
            <input
              type="checkbox"
              checked={auditParams.free_shipping}
              onChange={(e) => onChangeAuditParams({ ...auditParams, free_shipping: e.target.checked })}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-chumbo-700 dark:text-amber-500"
            />
            <span>Oferece Frete Grátis</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer dark:text-slate-300">
            <input
              type="checkbox"
              checked={auditParams.full_shipping}
              onChange={(e) => onChangeAuditParams({ ...auditParams, full_shipping: e.target.checked })}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-chumbo-700 dark:text-amber-500"
            />
            <span>Envios FULL</span>
          </label>
        </div>

        <button
          onClick={onRunAudit}
          disabled={loadingAudit}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-50 dark:bg-amber-500 dark:text-chumbo-950 dark:hover:bg-amber-400"
        >
          {loadingAudit ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          <span>Rodar Auditoria Metrify</span>
        </button>
      </div>

      {/* Audit Results */}
      <div className="lg:col-span-2 space-y-6">
        {auditResult && (
          <>
            {/* Health Score Gauge */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 dark:border-chumbo-800 dark:bg-chumbo-900">
              <div className="flex items-center gap-6">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 border-4 border-amber-500 shadow-sm dark:bg-chumbo-950 dark:shadow-lg dark:shadow-amber-500/20">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {auditResult.health_score}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 absolute bottom-3">/100</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    Qualidade do Anúncio (Health Score)
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 dark:text-slate-400">
                    {auditResult.health_score >= 80
                      ? 'Excelente! Seu anúncio está otimizado para o algoritmo de busca e alta conversão.'
                      : auditResult.health_score >= 60
                      ? 'Bom! Existem alguns pontos de melhoria para alcançar o topo das buscas.'
                      : 'Atenção! Seu anúncio precisa de correções para aumentar visualizações e vendas.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Score Breakdown Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-chumbo-800 dark:bg-chumbo-900">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Título SEO</span>
                <div className="text-xl font-bold text-amber-700 mt-1 dark:text-amber-400">
                  {auditResult.title_score}/25
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-chumbo-800 dark:bg-chumbo-900">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fotos & HD</span>
                <div className="text-xl font-bold text-amber-700 mt-1 dark:text-amber-400">
                  {auditResult.image_score}/25
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-chumbo-800 dark:bg-chumbo-900">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Preço & Margem</span>
                <div className="text-xl font-bold text-amber-700 mt-1 dark:text-amber-400">
                  {auditResult.price_score}/25
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-chumbo-800 dark:bg-chumbo-900">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Envio & Frete</span>
                <div className="text-xl font-bold text-amber-700 mt-1 dark:text-amber-400">
                  {auditResult.shipping_score}/25
                </div>
              </div>
            </div>

            {/* Actionable Recommendations */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-chumbo-800 dark:bg-chumbo-900">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Recomendações Práticas de Otimização
              </h4>

              {auditResult.recommendations.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {auditResult.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5 dark:text-amber-400" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Seu anúncio atende a todos os requisitos de otimização do marketplace!</span>
                </div>
              )}

              {auditResult.missing_keywords && auditResult.missing_keywords.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-700 block mb-2 dark:text-slate-300">
                    Palavras-chave sugeridas para incluir no título ou descrição:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {auditResult.missing_keywords.map((kw) => (
                      <span key={kw} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono text-amber-800 border border-slate-200 dark:bg-chumbo-800 dark:text-amber-400 dark:border-chumbo-700">
                        +{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
