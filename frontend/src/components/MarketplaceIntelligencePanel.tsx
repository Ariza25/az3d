import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  ExternalLink,
  Flame,
  BarChart2,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import {
  MLTrendKeyword,
  MLSearchInsight,
  MLListingAudit,
  MLProductOpportunity,
  Product,
} from '../types';
import { api } from '../services/api';

interface MarketplaceIntelligencePanelProps {
  tenantId?: number;
  products?: Product[];
}

export const MarketplaceIntelligencePanel: React.FC<MarketplaceIntelligencePanelProps> = ({
  tenantId,
  products = [],
}) => {
  const [provider, setProvider] = useState<'mercadolivre' | 'shopee' | 'amazon'>('mercadolivre');
  const [activeTab, setActiveTab] = useState<'trends' | 'audit' | 'insights' | 'opportunities'>('trends');

  // Trends state
  const [trends, setTrends] = useState<MLTrendKeyword[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Search Insights state
  const [searchQuery, setSearchQuery] = useState('suporte headset');
  const [searchInsight, setSearchInsight] = useState<MLSearchInsight | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Audit state
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [auditParams, setAuditParams] = useState({
    title: 'Suporte de Headset Gamer 3D Universal PLA #shopee #achadinhos',
    price: 69.90,
    images: 5,
    free_shipping: true,
    full_shipping: false,
    material: 'PLA',
  });
  const [auditResult, setAuditResult] = useState<MLListingAudit | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Opportunities state
  const [opportunities, setOpportunities] = useState<MLProductOpportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(false);

  // Load initial data
  useEffect(() => {
    void reloadAllData(provider);
  }, [tenantId, provider]);

  const reloadAllData = async (targetProvider = provider) => {
    await Promise.all([
      loadTrends(selectedCategory, targetProvider),
      loadSearchInsights(searchQuery, targetProvider),
      loadOpportunities(selectedCategory, targetProvider),
      runAudit(targetProvider),
    ]);
  };

  const handleSwitchProvider = (newProvider: 'mercadolivre' | 'shopee' | 'amazon') => {
    setProvider(newProvider);
    if (newProvider === 'shopee' && !auditParams.title.includes('#')) {
      setAuditParams((prev) => ({ ...prev, title: `${prev.title} #shopee #achadinhos #impressao3d` }));
    }
  };

  const loadTrends = async (category = selectedCategory, targetProvider = provider) => {
    setLoadingTrends(true);
    try {
      const res = await api.getMLTrends(category === 'all' ? undefined : category, targetProvider, tenantId);
      setTrends(res.trends || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadSearchInsights = async (query: string, targetProvider = provider) => {
    if (!query.trim()) return;
    setLoadingInsights(true);
    try {
      const res = await api.getMLSearchInsights(query, targetProvider, tenantId);
      setSearchInsight(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const runAudit = async (targetProvider = provider) => {
    setLoadingAudit(true);
    try {
      const res = await api.auditMLListing({ ...auditParams, provider: targetProvider }, tenantId);
      setAuditResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const loadOpportunities = async (category = selectedCategory, targetProvider = provider) => {
    setLoadingOpps(true);
    try {
      const res = await api.getMLProductOpportunities(category === 'all' ? undefined : category, targetProvider, tenantId);
      setOpportunities(res.opportunities || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOpps(false);
    }
  };

  const handleSelectProductForAudit = (prodId: number) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      const baseTitle = prod.title;
      setAuditParams({
        title: provider === 'shopee' && !baseTitle.includes('#') ? `${baseTitle} #shopee #impressao3d` : baseTitle,
        price: prod.price,
        images: (prod as any).images?.length || (prod.image_url ? 4 : 1),
        free_shipping: prod.price >= 79,
        full_shipping: false,
        material: prod.material || 'PLA',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-chumbo-800 bg-gradient-to-r from-chumbo-900 via-chumbo-950 to-chumbo-900 p-6 shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-laser-500/10 blur-3xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 text-chumbo-950 shadow-lg shadow-amber-500/20">
              <TrendingUp className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-wide text-white">
                  Inteligência de Mercado {provider === 'amazon' ? 'Amazon 📦' : provider === 'shopee' ? 'Shopee 🧡' : 'Mercado Livre 💛'}
                </h2>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                  {provider === 'amazon' ? 'Amazon SP-API Engine' : provider === 'shopee' ? 'Shopee Intelligence Engine' : 'Estilo Metrify + Google Trends'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {provider === 'amazon'
                  ? 'Analise BSR da Amazon, audite anúncios estilo FBA (até 200 chars) e simule margens de lucro.'
                  : provider === 'shopee'
                  ? 'Analise tendências da Shopee, audite títulos com hashtags e descubra os produtos 3D mais lucrativos.'
                  : 'Analise tendências do Mercado Livre, audite seus anúncios e descubra os produtos 3D mais lucrativos para vender.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Channel Selector Pills */}
            <div className="flex items-center gap-1 rounded-xl bg-chumbo-950 p-1 border border-chumbo-800">
              <button
                type="button"
                onClick={() => handleSwitchProvider('mercadolivre')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  provider === 'mercadolivre'
                    ? 'bg-amber-400 text-chumbo-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Mercado Livre 💛</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchProvider('shopee')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  provider === 'shopee'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Shopee 🧡</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchProvider('amazon')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  provider === 'amazon'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Amazon 📦</span>
              </button>
            </div>

            <button
              onClick={() => void reloadAllData()}
              className="flex items-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-chumbo-700 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingTrends || loadingOpps ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-chumbo-800/80 pt-4">
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'trends'
                ? 'bg-amber-500 text-chumbo-950 shadow-md shadow-amber-500/20'
                : 'bg-chumbo-900 text-slate-400 hover:bg-chumbo-800 hover:text-slate-200'
            }`}
          >
            <Flame className="h-4 w-4" />
            <span>Tendências ML (Google Trends)</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-chumbo-950 shadow-md shadow-amber-500/20'
                : 'bg-chumbo-900 text-slate-400 hover:bg-chumbo-800 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Otimizador de Anúncio (Metrify)</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'insights'
                ? 'bg-amber-500 text-chumbo-950 shadow-md shadow-amber-500/20'
                : 'bg-chumbo-900 text-slate-400 hover:bg-chumbo-800 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Análise de Concorrência</span>
          </button>

          <button
            onClick={() => setActiveTab('opportunities')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'opportunities'
                ? 'bg-amber-500 text-chumbo-950 shadow-md shadow-amber-500/20'
                : 'bg-chumbo-900 text-slate-400 hover:bg-chumbo-800 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Oportunidades 3D Lucrativas</span>
          </button>
        </div>
      </div>

      {/* TAB 1: TRENDS (Google Trends style) */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">Categoria:</span>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  void loadTrends(e.target.value);
                }}
                className="rounded-xl border border-chumbo-700 bg-chumbo-900 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="all">Todas as categorias</option>
                <option value="Organização">Organização / Setup</option>
                <option value="Decoração">Decoração / Casa</option>
                <option value="Geek/Games">Geek / Games</option>
                <option value="Utilitários">Utilitários & Ferramentas</option>
                <option value="Colecionáveis">Colecionáveis / RPG</option>
              </select>
            </div>
            <div className="text-xs text-slate-400">
              Exibindo <span className="font-bold text-amber-400">{trends.length}</span> buscas em alta no Mercado Livre Brasil
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trends.map((item) => (
              <div
                key={item.keyword}
                className="group relative flex flex-col justify-between rounded-2xl border border-chumbo-800 bg-chumbo-900/90 p-5 transition-all hover:border-amber-500/40 hover:bg-chumbo-900 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-chumbo-800 text-xs font-extrabold text-amber-400 border border-chumbo-700">
                      #{item.rank}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'hot'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : item.status === 'rising'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {item.status === 'hot' && <Flame className="h-3 w-3" />}
                      {item.status === 'rising' && <TrendingUp className="h-3 w-3" />}
                      {item.status === 'hot' ? 'Em Chamas' : item.status === 'rising' ? 'Em Alta' : 'Estável'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                    {item.keyword}
                  </h3>

                  {item.category && (
                    <span className="mt-1 inline-block text-[11px] font-medium text-slate-400">
                      {item.category}
                    </span>
                  )}

                  {/* Volume Trend Sparkline visualization */}
                  <div className="mt-4 flex items-end gap-1.5 h-10 border-b border-chumbo-800/80 pb-1">
                    {item.volume_trend?.map((vol, i) => (
                      <div
                        key={i}
                        style={{ height: `${Math.max(15, vol)}%` }}
                        className={`w-full rounded-t transition-all ${
                          i === item.volume_trend.length - 1
                            ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                            : 'bg-chumbo-700 group-hover:bg-chumbo-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs pt-2 border-t border-chumbo-800/50">
                  <div className="text-slate-400">
                    Volume est.: <span className="font-bold text-white">{item.search_vol.toLocaleString('pt-BR')} /mês</span>
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery(item.keyword);
                      setActiveTab('insights');
                      void loadSearchInsights(item.keyword);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
                  >
                    <span>Analisar</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT (Metrify Health Score style) */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Controls & Form */}
          <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Configurar Auditoria de Anúncio
            </h3>

            {products.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Selecionar Produto do seu Catálogo
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProductForAudit(Number(e.target.value))}
                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
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
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título do Anúncio ({provider === 'amazon' ? 'ideal 120-200 chars no padrão FBA' : provider === 'shopee' ? 'ideal 80-120 chars com #hashtags' : 'ideal 50-60 chars'})
              </label>
              <input
                type="text"
                value={auditParams.title}
                onChange={(e) => setAuditParams({ ...auditParams, title: e.target.value })}
                className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
              <span className={`text-[10px] mt-1 block font-mono ${
                provider === 'amazon'
                  ? (auditParams.title.length >= 120 && auditParams.title.length <= 200 ? 'text-emerald-400' : 'text-amber-400')
                  : provider === 'shopee'
                  ? (auditParams.title.length >= 80 && auditParams.title.length <= 120 ? 'text-emerald-400' : 'text-amber-400')
                  : (auditParams.title.length >= 45 && auditParams.title.length <= 60 ? 'text-emerald-400' : 'text-amber-400')
              }`}>
                Tamanho atual: {auditParams.title.length} caracteres
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Preço de Venda (R$)</label>
                <input
                  type="number"
                  step="0.1"
                  value={auditParams.price}
                  onChange={(e) => setAuditParams({ ...auditParams, price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Qtd. de Fotos</label>
                <input
                  type="number"
                  value={auditParams.images}
                  onChange={(e) => setAuditParams({ ...auditParams, images: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={auditParams.free_shipping}
                  onChange={(e) => setAuditParams({ ...auditParams, free_shipping: e.target.checked })}
                  className="rounded border-chumbo-700 text-amber-500 focus:ring-amber-500"
                />
                <span>Oferece Frete Grátis</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={auditParams.full_shipping}
                  onChange={(e) => setAuditParams({ ...auditParams, full_shipping: e.target.checked })}
                  className="rounded border-chumbo-700 text-amber-500 focus:ring-amber-500"
                />
                <span>Mercado Envios FULL</span>
              </label>
            </div>

            <button
              onClick={() => void runAudit()}
              disabled={loadingAudit}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-chumbo-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
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
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-chumbo-950 border-4 border-amber-500 shadow-lg shadow-amber-500/20">
                      <span className="text-3xl font-extrabold text-white">
                        {auditResult.health_score}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 absolute bottom-3">/100</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">
                        Qualidade do Anúncio (Health Score)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
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
                  <div className="rounded-xl border border-chumbo-800 bg-chumbo-900 p-4 text-center">
                    <span className="text-xs font-medium text-slate-400">Título SEO</span>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {auditResult.title_score}/25
                    </div>
                  </div>

                  <div className="rounded-xl border border-chumbo-800 bg-chumbo-900 p-4 text-center">
                    <span className="text-xs font-medium text-slate-400">Fotos & HD</span>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {auditResult.image_score}/25
                    </div>
                  </div>

                  <div className="rounded-xl border border-chumbo-800 bg-chumbo-900 p-4 text-center">
                    <span className="text-xs font-medium text-slate-400">Preço & Margem</span>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {auditResult.price_score}/25
                    </div>
                  </div>

                  <div className="rounded-xl border border-chumbo-800 bg-chumbo-900 p-4 text-center">
                    <span className="text-xs font-medium text-slate-400">Envio & Frete</span>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {auditResult.shipping_score}/25
                    </div>
                  </div>
                </div>

                {/* Actionable Recommendations */}
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6 space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Recomendações Práticas de Otimização
                  </h4>

                  {auditResult.recommendations.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {auditResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Seu anúncio atende a todos os requisitos de otimização do Mercado Livre!</span>
                    </div>
                  )}

                  {auditResult.missing_keywords && auditResult.missing_keywords.length > 0 && (
                    <div className="pt-2">
                      <span className="text-xs font-semibold text-slate-300 block mb-2">
                        Palavras-chave sugeridas para incluir no título ou descrição:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {auditResult.missing_keywords.map((kw) => (
                          <span key={kw} className="rounded-lg bg-chumbo-800 px-2.5 py-1 text-xs font-mono text-amber-400 border border-chumbo-700">
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
      )}

      {/* TAB 3: SEARCH INSIGHTS & COMPETITOR ANALYSIS */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Search Query Bar */}
          <div className="flex items-center gap-3 rounded-2xl border border-chumbo-800 bg-chumbo-900 p-4">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadSearchInsights(searchQuery)}
              placeholder="Digite um produto ou termo (ex: suporte headset, vaso 3d)..."
              className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500"
            />
            <button
              onClick={() => void loadSearchInsights(searchQuery)}
              disabled={loadingInsights}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-chumbo-950 hover:bg-amber-400 transition-colors"
            >
              {loadingInsights ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>Buscar ML</span>}
            </button>
          </div>

          {searchInsight && (
            <>
              {/* Benchmark Summary Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-5">
                  <span className="text-xs font-medium text-slate-400">Preço Médio do Mercado</span>
                  <div className="text-2xl font-black text-white mt-1">
                    R$ {searchInsight.avg_price.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Mín: R$ {searchInsight.min_price.toFixed(2)} | Máx: R$ {searchInsight.max_price.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-5">
                  <span className="text-xs font-medium text-slate-400">Preço Sugerido (Sua Loja)</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    R$ {searchInsight.recommended_price.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
                    Competitivo vs concorrentes
                  </span>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-5">
                  <span className="text-xs font-medium text-slate-400">Custo Estimado de Impressão</span>
                  <div className="text-2xl font-black text-slate-300 mt-1">
                    R$ {searchInsight.estimated_print_cost.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Filamento + Energia + Embalagem
                  </span>
                </div>

                <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-5">
                  <span className="text-xs font-medium text-slate-400">Margem de Lucro Bruta</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {searchInsight.profit_margin_percent}%
                  </div>
                  <span className="text-[11px] text-emerald-300 font-semibold mt-1 block">
                    Lucro de ~R$ {searchInsight.estimated_profit.toFixed(2)} por unidade
                  </span>
                </div>
              </div>

              {/* Ratios & Market Specs */}
              <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6">
                <h4 className="text-sm font-bold text-white mb-4">Métricas de Concorrência & Logística</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-xl bg-chumbo-950 p-4 border border-chumbo-800">
                    <span className="text-xs text-slate-300">Anúncios com Frete Grátis</span>
                    <span className="text-sm font-bold text-amber-400">
                      {Math.round(searchInsight.free_shipping_ratio * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-chumbo-950 p-4 border border-chumbo-800">
                    <span className="text-xs text-slate-300">Vendedores MercadoLíder</span>
                    <span className="text-sm font-bold text-amber-400">
                      {Math.round(searchInsight.mercado_lider_ratio * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-chumbo-950 p-4 border border-chumbo-800">
                    <span className="text-xs text-slate-300">Entregas FULL</span>
                    <span className="text-sm font-bold text-amber-400">
                      {Math.round(searchInsight.full_ratio * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Seller Listings */}
              <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6">
                <h4 className="text-sm font-bold text-white mb-4">Top Vendedores & Anúncios no Mercado Livre</h4>
                <div className="divide-y divide-chumbo-800">
                  {searchInsight.top_sellers.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3">
                        {item.thumbnail && (
                          <img src={item.thumbnail} alt={item.title} className="h-12 w-12 rounded-lg object-cover border border-chumbo-700" />
                        )}
                        <div>
                          <h5 className="text-xs font-bold text-white">{item.title}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-amber-400">R$ {item.price.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400">· {item.sold_quantity} vendidos</span>
                            {item.free_shipping && (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                Frete Grátis
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 shrink-0"
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
      )}

      {/* TAB 4: PRODUCT OPPORTUNITIES */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-chumbo-900 to-chumbo-950 p-6">
            <div className="flex items-start gap-4">
              <Sparkles className="h-6 w-6 text-amber-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Oportunidades de Venda em Impressão 3D
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Nossa inteligência cruza o volume de buscas no Mercado Livre com o custo de filamento e tempo de máquina para indicar os itens com maior margem e demanda garantida.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="flex flex-col justify-between rounded-2xl border border-chumbo-800 bg-chumbo-900 p-6 transition-all hover:border-amber-500/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-chumbo-800 px-3 py-1 text-[11px] font-bold text-amber-400 border border-chumbo-700">
                      {opp.category}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-extrabold text-amber-400 border border-amber-500/30">
                      Score: {opp.opportunity_score}/100
                    </span>
                  </div>

                  <h4 className="mt-3 text-base font-extrabold text-white">
                    {opp.title}
                  </h4>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-chumbo-950 p-3 text-center border border-chumbo-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Preço Sugerido</span>
                      <span className="text-sm font-black text-amber-400">R$ {opp.suggested_price.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Peso / Tempo</span>
                      <span className="text-xs font-bold text-slate-200">{opp.estimated_print_grams}g · {opp.estimated_print_hours}h</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Margem Bruta</span>
                      <span className="text-sm font-black text-emerald-400">{opp.profit_margin_percent}%</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Demanda de busca:</span>
                      <span className="font-bold text-emerald-400">{opp.demand_level}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Nível de concorrência:</span>
                      <span className="font-bold text-amber-400">{opp.competition_level}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Lucro por peça:</span>
                      <span className="font-bold text-emerald-400">R$ {opp.estimated_profit.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      Palavras-chave Alvo:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {opp.target_keywords.map((kw) => (
                        <span key={kw} className="rounded bg-chumbo-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-chumbo-800 flex items-center justify-end">
                  <button
                    onClick={() => {
                      setAuditParams({
                        title: opp.title,
                        price: opp.suggested_price,
                        images: 5,
                        free_shipping: opp.suggested_price >= 79,
                        full_shipping: false,
                        material: 'PLA',
                      });
                      setActiveTab('audit');
                      void runAudit();
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-amber-400 transition-colors"
                  >
                    <span>Simular Anúncio</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
