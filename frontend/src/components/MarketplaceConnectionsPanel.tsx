import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, KeyRound, Link2, PackagePlus, RefreshCw, Save, Store } from 'lucide-react';
import {
  ExternalMarketplaceOrder,
  MarketplaceCatalogItemInput,
  MarketplaceAccount,
  MarketplaceProductMapping,
  MarketplaceProductMappingInput,
  Product,
  TenantMarketplaceSettings,
} from '../types';
import { api } from '../services/api';

const PROVIDERS = [
  { id: 'shopee', label: 'Shopee', accent: 'text-orange-300', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  { id: 'mercadolivre', label: 'Mercado Livre', accent: 'text-yellow-300', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  { id: 'amazon', label: 'Amazon Seller', accent: 'text-cyan-300', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
];

const currencyBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const defaultAccount = (provider: string): Partial<MarketplaceAccount> => ({
  provider,
  account_name: PROVIDERS.find((item) => item.id === provider)?.label || provider,
  marketplace: provider === 'mercadolivre' ? 'MLB' : 'BR',
  is_active: provider !== 'amazon',
  is_connected: false,
  sync_orders: true,
  sync_stock: provider !== 'amazon',
  sync_status: 'pending_credentials',
});

const defaultMarketplaceSettings: TenantMarketplaceSettings = {
  id: 0,
  tenant_id: 0,
  marketplace_controls_price: true,
  marketplace_controls_stock: true,
  content_sync_policy: 'imported_only',
  new_imported_product_status: 'draft',
  auto_create_internal_orders: true,
  auto_create_financial_entries: true,
};

const providerFromOAuthState = (state: string) => {
  const match = state.match(/^tenant_\d+_([a-z_]+)_\d+$/);
  return match?.[1]?.replace('mercado_livre', 'mercadolivre') || '';
};

interface MarketplaceConnectionsPanelProps {
  tenantId?: number;
  products: Product[];
  mappings: MarketplaceProductMapping[];
  onMappingsChanged: (mappings: MarketplaceProductMapping[]) => void;
  onProductsImported?: () => void;
  onMessage: (message: { type: 'success' | 'error'; text: string }) => void;
}

export const MarketplaceConnectionsPanel: React.FC<MarketplaceConnectionsPanelProps> = ({
  tenantId,
  products,
  mappings,
  onMappingsChanged,
  onProductsImported,
  onMessage,
}) => {
  const [externalOrders, setExternalOrders] = useState<ExternalMarketplaceOrder[]>([]);
  const [marketplaceSettings, setMarketplaceSettings] = useState<TenantMarketplaceSettings>(defaultMarketplaceSettings);
  const [accountDrafts, setAccountDrafts] = useState<Record<string, Partial<MarketplaceAccount>>>({});
  const [oauthCodes, setOauthCodes] = useState<Record<string, { code: string; shop_id: string; seller_id: string }>>({});
  const [authUrls, setAuthUrls] = useState<Record<string, string>>({});
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [syncingCatalogProvider, setSyncingCatalogProvider] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState<MarketplaceCatalogItemInput>({
    external_item_id: '',
    external_sku: '',
    external_url: '',
    title: '',
    description: '',
    price: 0,
    image_url: '',
    material: '',
    layer_height: '0.16mm',
    print_time: '',
    dimensions: '',
    weight: '',
    stock_qty: 0,
    status: 'active',
  });
  const [importProvider, setImportProvider] = useState('shopee');
  const [overwriteLocal, setOverwriteLocal] = useState(true);
  const [mappingDraft, setMappingDraft] = useState<MarketplaceProductMappingInput>({
    product_id: products[0]?.id || 0,
    provider: 'shopee',
    internal_sku: products[0]?.sku || '',
    external_sku: '',
    external_title: '',
    external_item_id: '',
    external_url: '',
  });

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const loadData = async () => {
    if (!tenantId) return;
    const [nextAccounts, nextOrders, nextMappings] = await Promise.all([
      api.getMarketplaceAccounts(tenantId),
      api.getExternalMarketplaceOrders(tenantId).catch(() => []),
      api.getProductMappings(tenantId).catch(() => mappings),
    ]);
    const nextSettings = await api.getMarketplaceSettings(tenantId).catch(() => defaultMarketplaceSettings);
    onMappingsChanged(nextMappings);
    setExternalOrders(nextOrders);
    setMarketplaceSettings(nextSettings);
    setAccountDrafts(
      Object.fromEntries(
        PROVIDERS.map((provider) => {
          const account = nextAccounts.find((item) => item.provider === provider.id) || defaultAccount(provider.id);
          return [provider.id, account];
        })
      )
    );
  };

  useEffect(() => {
    loadData().catch((error) => onMessage({ type: 'error', text: error.message || 'Erro ao carregar marketplaces' }));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !window.location.pathname.startsWith('/admin/marketplaces/callback')) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || '';
    const state = params.get('state') || '';
    const provider = params.get('provider') || providerFromOAuthState(state);
    if (!code || !provider) return;

    setLoadingProvider(provider);
    api
      .completeMarketplaceOAuth(
        {
          provider,
          code,
          state,
          shop_id: params.get('shop_id') || params.get('shop_id_list') || '',
          seller_id: params.get('seller_id') || '',
          redirect_uri: `${window.location.origin}/admin/marketplaces/callback`,
        },
        tenantId
      )
      .then(async () => {
        await loadData();
        onMessage({ type: 'success', text: 'Conexao OAuth concluida.' });
        window.history.replaceState({}, '', '/admin');
      })
      .catch((error) => onMessage({ type: 'error', text: error.message || 'Erro ao concluir OAuth' }))
      .finally(() => setLoadingProvider(null));
  }, [tenantId]);

  useEffect(() => {
    if (!mappingDraft.product_id && products[0]) {
      setMappingDraft((prev) => ({ ...prev, product_id: products[0].id, internal_sku: products[0].sku || '' }));
    }
  }, [products, mappingDraft.product_id]);

  const updateAccount = (provider: string, field: keyof MarketplaceAccount, value: string | boolean) => {
    setAccountDrafts((prev) => ({
      ...prev,
      [provider]: {
        ...defaultAccount(provider),
        ...prev[provider],
        provider,
        [field]: value,
      },
    }));
  };

  const updateMarketplaceSetting = (field: keyof TenantMarketplaceSettings, value: string | boolean) => {
    setMarketplaceSettings((prev) => ({ ...prev, [field]: value }));
  };

  const saveMarketplaceSettings = async () => {
    if (!tenantId) return;
    try {
      const saved = await api.updateMarketplaceSettings(
        {
          marketplace_controls_price: marketplaceSettings.marketplace_controls_price,
          marketplace_controls_stock: marketplaceSettings.marketplace_controls_stock,
          content_sync_policy: marketplaceSettings.content_sync_policy,
          new_imported_product_status: marketplaceSettings.new_imported_product_status,
          auto_create_internal_orders: marketplaceSettings.auto_create_internal_orders,
          auto_create_financial_entries: marketplaceSettings.auto_create_financial_entries,
        },
        tenantId
      );
      setMarketplaceSettings(saved);
      onMessage({ type: 'success', text: 'Regras de marketplace salvas.' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao salvar regras de marketplace' });
    }
  };

  const saveAccount = async (provider: string) => {
    if (!tenantId) return;
    setLoadingProvider(provider);
    try {
      const draft = { ...defaultAccount(provider), ...accountDrafts[provider], provider };
      const saved = await api.saveMarketplaceAccount(
        {
          provider,
          account_name: draft.account_name || '',
          seller_id: draft.seller_id || '',
          shop_id: draft.shop_id || '',
          marketplace: draft.marketplace || '',
          is_active: Boolean(draft.is_active),
          sync_orders: Boolean(draft.sync_orders),
          sync_stock: Boolean(draft.sync_stock),
        },
        tenantId
      );
      setAccountDrafts((prev) => ({ ...prev, [provider]: saved }));
      onMessage({ type: 'success', text: `${PROVIDERS.find((item) => item.id === provider)?.label} salvo.` });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao salvar marketplace' });
    } finally {
      setLoadingProvider(null);
    }
  };

  const startOAuth = async (provider: string) => {
    if (!tenantId) return;
    setLoadingProvider(provider);
    try {
      const redirectUri = `${window.location.origin}/admin/marketplaces/callback`;
      const response = await api.startMarketplaceOAuth(provider, redirectUri, tenantId);
      if (response.missing_config.length) {
        onMessage({ type: 'error', text: `Configure: ${response.missing_config.join(', ')}` });
      } else {
        setAuthUrls((prev) => ({ ...prev, [provider]: response.auth_url }));
        onMessage({ type: 'success', text: 'URL OAuth gerada. Abra o link para autorizar o marketplace.' });
      }
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao iniciar OAuth' });
    } finally {
      setLoadingProvider(null);
    }
  };

  const completeOAuth = async (provider: string) => {
    if (!tenantId) return;
    const draft = oauthCodes[provider] || { code: '', shop_id: '', seller_id: '' };
    if (!draft.code.trim()) {
      onMessage({ type: 'error', text: 'Informe o codigo OAuth recebido no callback.' });
      return;
    }
    setLoadingProvider(provider);
    try {
      const redirectUri = `${window.location.origin}/admin/marketplaces/callback`;
      await api.completeMarketplaceOAuth({ provider, ...draft, redirect_uri: redirectUri }, tenantId);
      await loadData();
      onMessage({ type: 'success', text: 'OAuth processado.' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao salvar OAuth' });
    } finally {
      setLoadingProvider(null);
    }
  };

  const refreshToken = async (provider: string) => {
    if (!tenantId) return;
    setLoadingProvider(provider);
    try {
      const result = await api.refreshMarketplaceTokens(provider, tenantId);
      await loadData();
      const status = result.results[0]?.message || 'Token renovado.';
      onMessage({ type: 'success', text: status });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao renovar token' });
    } finally {
      setLoadingProvider(null);
    }
  };

  const testConnection = async (provider: string) => {
    if (!tenantId) return;
    setLoadingProvider(provider);
    try {
      const result = await api.testMarketplaceConnection(provider, tenantId);
      await loadData();
      onMessage({ type: 'success', text: result.message || 'Conexao testada.' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao testar conexao' });
    } finally {
      setLoadingProvider(null);
    }
  };

  const syncOrders = async (provider: string) => {
    if (!tenantId) return;
    setSyncingProvider(provider);
    try {
      const result = await api.syncMarketplaceOrders(provider, 7, tenantId);
      await loadData();
      const status = result.results[0]?.message || 'Sincronizacao executada.';
      onMessage({ type: 'success', text: status });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao sincronizar pedidos' });
    } finally {
      setSyncingProvider(null);
    }
  };

  const syncCatalog = async (provider: string) => {
    if (!tenantId) return;
    setSyncingCatalogProvider(provider);
    try {
      const result = await api.syncMarketplaceProducts(provider, tenantId);
      await loadData();
      const status = result.results[0]?.message || 'Sincronizacao de catalogo executada.';
      onMessage({ type: 'success', text: status });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao sincronizar catalogo' });
    } finally {
      setSyncingCatalogProvider(null);
    }
  };

  const importProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    try {
      const response = await api.importMarketplaceProducts(
        {
          provider: importProvider,
          overwrite_local: overwriteLocal,
          products: [
            {
              ...importDraft,
              price: Number(importDraft.price) || 0,
              stock_qty: Number(importDraft.stock_qty) || 0,
              color_images: importDraft.image_url
                ? [{ color_name: 'Padrao', image_url: importDraft.image_url, sort_order: 0 }]
                : undefined,
              color_stocks: [{ color_name: 'Padrao', stock_qty: Number(importDraft.stock_qty) || 0 }],
            },
          ],
        },
        tenantId
      );
      await loadData();
      onProductsImported?.();
      setImportDraft((prev) => ({
        ...prev,
        external_item_id: '',
        external_sku: '',
        external_url: '',
        title: '',
        description: '',
        price: 0,
        image_url: '',
        print_time: '',
        dimensions: '',
        weight: '',
        stock_qty: 0,
      }));
      onMessage({ type: 'success', text: `Catalogo importado: ${response.created} criado(s), ${response.updated} atualizado(s).` });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao importar produto do marketplace' });
    }
  };

  const saveMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    const product = productsById.get(Number(mappingDraft.product_id));
    try {
      const saved = await api.saveMarketplaceMapping(
        {
          ...mappingDraft,
          product_id: Number(mappingDraft.product_id),
          internal_sku: mappingDraft.internal_sku || product?.sku || '',
        },
        tenantId
      );
      onMappingsChanged([saved, ...mappings.filter((item) => item.id !== saved.id)]);
      setMappingDraft((prev) => ({ ...prev, external_sku: '', external_title: '', external_item_id: '', external_url: '' }));
      onMessage({ type: 'success', text: 'Mapeamento de SKU salvo.' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao salvar mapeamento' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-sm font-bold text-white">Regras de propriedade do tenant</h4>
            <p className="text-[10px] text-slate-400">Catalogo, estoque, fila e financeiro</p>
          </div>
          <button
            type="button"
            onClick={saveMarketplaceSettings}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-4 py-2 text-[10px] font-bold text-chumbo-950 hover:bg-slate-200"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar regras
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/70 px-3 py-2 text-xs text-slate-300">
            Preco pelo marketplace
            <input
              type="checkbox"
              checked={marketplaceSettings.marketplace_controls_price}
              onChange={(event) => updateMarketplaceSetting('marketplace_controls_price', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/70 px-3 py-2 text-xs text-slate-300">
            Estoque pelo marketplace
            <input
              type="checkbox"
              checked={marketplaceSettings.marketplace_controls_stock}
              onChange={(event) => updateMarketplaceSetting('marketplace_controls_stock', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/70 px-3 py-2 text-xs text-slate-300">
            Criar fila interna
            <input
              type="checkbox"
              checked={marketplaceSettings.auto_create_internal_orders}
              onChange={(event) => updateMarketplaceSetting('auto_create_internal_orders', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-chumbo-800 bg-chumbo-900/70 px-3 py-2 text-xs text-slate-300">
            Lancar taxas/frete
            <input
              type="checkbox"
              checked={marketplaceSettings.auto_create_financial_entries}
              onChange={(event) => updateMarketplaceSetting('auto_create_financial_entries', event.target.checked)}
            />
          </label>
          <select
            value={marketplaceSettings.content_sync_policy}
            onChange={(event) => updateMarketplaceSetting('content_sync_policy', event.target.value)}
            className="rounded-xl border border-chumbo-800 bg-chumbo-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          >
            <option value="imported_only">Conteudo so importados</option>
            <option value="always">Conteudo sempre</option>
            <option value="never">Conteudo nunca</option>
          </select>
          <select
            value={marketplaceSettings.new_imported_product_status}
            onChange={(event) => updateMarketplaceSetting('new_imported_product_status', event.target.value)}
            className="rounded-xl border border-chumbo-800 bg-chumbo-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          >
            <option value="draft">Novos como rascunho</option>
            <option value="active">Novos ativos na store</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const account = accountDrafts[provider.id] || defaultAccount(provider.id);
          const status = account.is_connected ? 'Conectado' : account.sync_status || 'Pendente';
          const isBusy = loadingProvider === provider.id || syncingProvider === provider.id || syncingCatalogProvider === provider.id;
          const tokenStatus = account.token_expires_at
            ? `Token ate ${new Date(account.token_expires_at).toLocaleString('pt-BR')}`
            : 'Token nao validado';

          return (
            <div key={provider.id} className={`rounded-2xl border ${provider.border} ${provider.bg} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Store className={`h-5 w-5 ${provider.accent}`} />
                  <div>
                    <h4 className="text-sm font-bold text-white">{provider.label}</h4>
                    <p className="text-[10px] font-mono uppercase text-slate-400">{status}</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(account.is_active)}
                    onChange={(event) => updateAccount(provider.id, 'is_active', event.target.checked)}
                  />
                  Ativo
                </label>
              </div>

              <div className="mt-4 space-y-2">
                <input
                  value={account.account_name || ''}
                  onChange={(event) => updateAccount(provider.id, 'account_name', event.target.value)}
                  placeholder="Nome da conta"
                  className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={account.seller_id || ''}
                    onChange={(event) => updateAccount(provider.id, 'seller_id', event.target.value)}
                    placeholder="Seller ID"
                    className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
                  />
                  <input
                    value={account.shop_id || ''}
                    onChange={(event) => updateAccount(provider.id, 'shop_id', event.target.value)}
                    placeholder="Shop ID"
                    className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(account.sync_orders)}
                      onChange={(event) => updateAccount(provider.id, 'sync_orders', event.target.checked)}
                    />
                    Pedidos
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(account.sync_stock)}
                      onChange={(event) => updateAccount(provider.id, 'sync_stock', event.target.checked)}
                    />
                    Estoque
                  </label>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => saveAccount(provider.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1 rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => startOAuth(provider.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1 rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-60"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  OAuth
                </button>
                <button
                  type="button"
                  onClick={() => syncCatalog(provider.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1 rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-60"
                >
                  <PackagePlus className={`h-3.5 w-3.5 ${syncingCatalogProvider === provider.id ? 'animate-pulse' : ''}`} />
                  Catalogo
                </button>
                <button
                  type="button"
                  onClick={() => syncOrders(provider.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-chumbo-950 hover:bg-slate-200 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingProvider === provider.id ? 'animate-spin' : ''}`} />
                  Sync
                </button>
                <button
                  type="button"
                  onClick={() => testConnection(provider.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1 rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-60"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Testar
                </button>
                <button
                  type="button"
                  onClick={() => refreshToken(provider.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1 rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Token
                </button>
              </div>

              {authUrls[provider.id] && (
                <a
                  href={authUrls[provider.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 rounded-xl border border-chumbo-700 bg-chumbo-950 px-3 py-2 text-[10px] font-mono text-laser-300 hover:bg-chumbo-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir autorizacao
                </a>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2">
                <input
                  value={oauthCodes[provider.id]?.code || ''}
                  onChange={(event) =>
                    setOauthCodes((prev) => ({ ...prev, [provider.id]: { code: event.target.value, shop_id: prev[provider.id]?.shop_id || '', seller_id: prev[provider.id]?.seller_id || '' } }))
                  }
                  placeholder="Codigo OAuth do callback"
                  className="w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
                />
                <button
                  type="button"
                  onClick={() => completeOAuth(provider.id)}
                  disabled={isBusy}
                  className="rounded-xl border border-chumbo-700 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-chumbo-800 disabled:opacity-60"
                >
                  Registrar callback
                </button>
              </div>

              <div className="mt-3 space-y-1 text-[10px] leading-relaxed text-slate-400">
                <p>{tokenStatus}</p>
                {account.last_sync_at && <p>Ultimo sync: {new Date(account.last_sync_at).toLocaleString('pt-BR')}</p>}
                {account.last_error && <p>{account.last_error}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={importProduct} className="rounded-2xl border border-laser-500/20 bg-laser-500/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-laser-300" />
            <div>
              <h4 className="text-sm font-bold text-white">Importar produto do marketplace para a store</h4>
              <p className="text-[10px] text-slate-400">Esse fluxo cria/atualiza o Product local usado pela vitrine.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={overwriteLocal} onChange={(event) => setOverwriteLocal(event.target.checked)} />
            Marketplace atualiza dados locais
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={importProvider}
            onChange={(event) => setImportProvider(event.target.value)}
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          >
            {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
          <input
            required
            value={importDraft.external_item_id}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, external_item_id: event.target.value }))}
            placeholder="ID do anuncio"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={importDraft.external_sku || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, external_sku: event.target.value }))}
            placeholder="SKU do marketplace"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            required
            value={importDraft.title}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, title: event.target.value, external_title: event.target.value }))}
            placeholder="Titulo"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            type="number"
            step="0.01"
            required
            value={importDraft.price}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, price: Number(event.target.value) || 0 }))}
            placeholder="Preco"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            type="number"
            value={importDraft.stock_qty}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, stock_qty: Number(event.target.value) || 0 }))}
            placeholder="Estoque"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={importDraft.image_url || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, image_url: event.target.value }))}
            placeholder="URL da imagem"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400 md:col-span-2"
          />
          <input
            value={importDraft.external_url || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, external_url: event.target.value }))}
            placeholder="URL do anuncio"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={importDraft.material || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, material: event.target.value }))}
            placeholder="Material"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={importDraft.print_time || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, print_time: event.target.value }))}
            placeholder="Tempo de impressao"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={importDraft.dimensions || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, dimensions: event.target.value }))}
            placeholder="Dimensoes"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <textarea
            value={importDraft.description || ''}
            onChange={(event) => setImportDraft((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Descricao"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400 md:col-span-4"
          />
        </div>
        <button type="submit" className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
          Importar para store
        </button>
      </form>

      <form onSubmit={saveMapping} className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-laser-300" />
          <h4 className="text-sm font-bold text-white">Mapeamento por SKU</h4>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={mappingDraft.product_id}
            onChange={(event) => {
              const product = productsById.get(Number(event.target.value));
              setMappingDraft((prev) => ({ ...prev, product_id: Number(event.target.value), internal_sku: product?.sku || '' }));
            }}
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
          <select
            value={mappingDraft.provider}
            onChange={(event) => setMappingDraft((prev) => ({ ...prev, provider: event.target.value }))}
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          >
            {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <input
            value={mappingDraft.internal_sku || ''}
            onChange={(event) => setMappingDraft((prev) => ({ ...prev, internal_sku: event.target.value }))}
            placeholder="SKU interno"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={mappingDraft.external_sku || ''}
            onChange={(event) => setMappingDraft((prev) => ({ ...prev, external_sku: event.target.value }))}
            placeholder="SKU externo"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            required
            value={mappingDraft.external_item_id}
            onChange={(event) => setMappingDraft((prev) => ({ ...prev, external_item_id: event.target.value }))}
            placeholder="ID do anuncio/pedido externo"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
          <input
            value={mappingDraft.external_url || ''}
            onChange={(event) => setMappingDraft((prev) => ({ ...prev, external_url: event.target.value }))}
            placeholder="URL do anuncio"
            className="rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400"
          />
        </div>
        <button type="submit" className="mt-3 rounded-xl bg-laser-400 px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-laser-300">
          Salvar mapeamento
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <h4 className="text-sm font-bold text-white">Mapeamentos salvos</h4>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="py-2">Produto</th>
                  <th className="py-2">Canal</th>
                  <th className="py-2">SKU</th>
                  <th className="py-2">Anuncio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chumbo-800 text-slate-300">
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="py-2 pr-3">{mapping.product?.title || productsById.get(mapping.product_id)?.title || 'Produto'}</td>
                    <td className="py-2 pr-3">{PROVIDERS.find((item) => item.id === mapping.provider)?.label || mapping.provider}</td>
                    <td className="py-2 pr-3 font-mono">{mapping.internal_sku || '-'}</td>
                    <td className="py-2 pr-3 font-mono">{mapping.external_item_id}</td>
                  </tr>
                ))}
                {mappings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Nenhum SKU mapeado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4">
          <h4 className="text-sm font-bold text-white">Pedidos externos</h4>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="py-2">Pedido</th>
                  <th className="py-2">Canal</th>
                  <th className="py-2">Bruto</th>
                  <th className="py-2">Taxas</th>
                  <th className="py-2">Liquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chumbo-800 text-slate-300">
                {externalOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-3 font-mono">{order.external_order_id}</td>
                    <td className="py-2 pr-3">{PROVIDERS.find((item) => item.id === order.provider)?.label || order.provider}</td>
                    <td className="py-2 pr-3">{currencyBRL(order.gross_amount)}</td>
                    <td className="py-2 pr-3">{currencyBRL(order.marketplace_fees)}</td>
                    <td className="py-2 pr-3">{currencyBRL(order.net_amount)}</td>
                  </tr>
                ))}
                {externalOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Nenhum pedido externo importado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
