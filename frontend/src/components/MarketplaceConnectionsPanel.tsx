import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Save, ShieldCheck, Store, Unplug } from 'lucide-react';
import { ExternalMarketplaceOrder, MarketplaceAccount, MarketplaceProductMapping, Product, TenantMarketplaceSettings } from '../types';
import { api } from '../services/api';
import { getAppPathname, withBasePath } from '../shared/basePath';
import { getMarketplaceVariantColor, getMarketplaceFamilyTitle } from '../shared/storePresentation';

const PROVIDER = 'mercadolivre';
const defaultAccount: Partial<MarketplaceAccount> = { provider: PROVIDER, account_name: 'Mercado Livre', marketplace: 'MLB', is_active: true, is_connected: false, sync_catalog: true, sync_orders: true, sync_stock: true, sync_status: 'pending_credentials' };
const defaultSettings: TenantMarketplaceSettings = { id: 0, tenant_id: 0, marketplace_controls_price: true, marketplace_controls_stock: true, content_sync_policy: 'imported_only', new_imported_product_status: 'draft', auto_create_internal_orders: true, auto_create_financial_entries: true };
const currencyBRL = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const redirectUri = () => new URL(withBasePath('/admin/marketplaces/callback'), window.location.origin).toString();

interface Props { tenantId?: number; products: Product[]; mappings: MarketplaceProductMapping[]; onMappingsChanged: (mappings: MarketplaceProductMapping[]) => void; onProductsImported?: () => void; onMessage: (message: { type: 'success' | 'error'; text: string }) => void; }

export const MarketplaceConnectionsPanel: React.FC<Props> = ({ tenantId, products, mappings, onMappingsChanged, onProductsImported, onMessage }) => {
  const [account, setAccount] = useState<Partial<MarketplaceAccount>>(defaultAccount);
  const [settings, setSettings] = useState<TenantMarketplaceSettings>(defaultSettings);
  const [orders, setOrders] = useState<ExternalMarketplaceOrder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const importedProducts = useMemo(() => products.filter((item) => item.source_provider === PROVIDER), [products]);
  const mappedItems = useMemo(() => mappings.filter((item) => item.provider === PROVIDER), [mappings]);

  const loadData = async () => {
    if (!tenantId) return;
    const [accounts, nextSettings, nextOrders, nextMappings] = await Promise.all([
      api.getMarketplaceAccounts(tenantId), api.getMarketplaceSettings(tenantId).catch(() => defaultSettings),
      api.getExternalMarketplaceOrders(tenantId, PROVIDER).catch(() => []), api.getProductMappings(tenantId).catch(() => mappings),
    ]);
    setAccount({ ...defaultAccount, ...(accounts.find((item) => item.provider === PROVIDER) || {}) });
    setSettings(nextSettings); setOrders(nextOrders); onMappingsChanged(nextMappings);
  };

  useEffect(() => { void loadData().catch((error) => onMessage({ type: 'error', text: error.message || 'Erro ao carregar Mercado Livre' })); }, [tenantId]);
  useEffect(() => {
    if (!tenantId || !getAppPathname().startsWith('/admin/marketplaces/callback')) return;
    const params = new URLSearchParams(window.location.search); const code = params.get('code') || ''; const state = params.get('state') || '';
    if (!code) return;
    setBusy('oauth');
    api.completeMarketplaceOAuth({ provider: PROVIDER, code, state, redirect_uri: redirectUri() }, tenantId).then(loadData)
      .then(() => onMessage({ type: 'success', text: 'Mercado Livre conectado com sucesso.' }))
      .then(() => window.history.replaceState({}, '', withBasePath('/admin?section=marketplaces')))
      .catch((error) => onMessage({ type: 'error', text: error.message || 'Erro ao concluir conexão' })).finally(() => setBusy(null));
  }, [tenantId]);

  const save = async () => {
    if (!tenantId) return; setBusy('save');
    try {
      const saved = await api.saveMarketplaceAccount({ provider: PROVIDER, account_name: account.account_name || 'Mercado Livre', marketplace: account.marketplace || 'MLB', is_active: Boolean(account.is_active), sync_catalog: Boolean(account.sync_catalog), sync_orders: Boolean(account.sync_orders), sync_stock: Boolean(account.sync_stock) }, tenantId);
      const savedSettings = await api.updateMarketplaceSettings({ marketplace_controls_price: settings.marketplace_controls_price, marketplace_controls_stock: settings.marketplace_controls_stock, content_sync_policy: settings.content_sync_policy, new_imported_product_status: settings.new_imported_product_status, auto_create_internal_orders: settings.auto_create_internal_orders, auto_create_financial_entries: settings.auto_create_financial_entries }, tenantId);
      setAccount(saved); setSettings(savedSettings); onMessage({ type: 'success', text: 'Automação do Mercado Livre salva.' });
    } catch (error: any) { onMessage({ type: 'error', text: error.message || 'Erro ao salvar automação' }); } finally { setBusy(null); }
  };
  const connect = async () => {
    if (!tenantId) return; setBusy('oauth');
    try { const response = await api.startMarketplaceOAuth(PROVIDER, redirectUri(), tenantId); if (response.missing_config.length) throw new Error(`Configure: ${response.missing_config.join(', ')}`); window.location.assign(response.auth_url); }
    catch (error: any) { onMessage({ type: 'error', text: error.message || 'Erro ao iniciar conexão' }); setBusy(null); }
  };
  const disconnect = async () => {
    if (!tenantId) return;
    if (!window.confirm('Tem certeza que deseja desconectar a conta do Mercado Livre? Seus anúncios importados no sistema permanecerão, mas a sincronização será pausada até você conectar novamente.')) {
      return;
    }
    setBusy('disconnect');
    try {
      const response = await api.disconnectMarketplaceAccount(PROVIDER, tenantId);
      setAccount({ ...defaultAccount, ...(response.account || {}) });
      onMessage({
        type: 'success',
        text: 'Conta do Mercado Livre desconectada. Ao conectar novamente, garanta que esteja logado no Mercado Livre com sua conta de vendedor.',
      });
      await loadData();
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao desconectar conta' });
    } finally {
      setBusy(null);
    }
  };
  const runSync = async (kind: 'catalog' | 'orders') => {
    if (!tenantId) return; setBusy(kind);
    try {
      const result = kind === 'catalog' ? await api.syncMarketplaceProducts(PROVIDER, tenantId) : await api.syncMarketplaceOrders(PROVIDER, 7, tenantId);
      await loadData();
      if (kind === 'catalog') onProductsImported?.();
      const firstRes = result.results[0];
      const isExpired = firstRes?.status === 'token_expired' || (firstRes as any)?.requires_reconnect;
      if (isExpired) {
        onMessage({ type: 'error', text: `${firstRes?.message || 'Token expirado'}. Redirecionando para reconectar ao Mercado Livre...` });
        setTimeout(() => { void connect(); }, 1200);
        return;
      }
      onMessage({ type: firstRes?.status?.includes('error') ? 'error' : 'success', text: firstRes?.message || 'Sincronização concluída.' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.message || 'Erro ao sincronizar' });
    } finally {
      setBusy(null);
    }
  };
  const updateAccount = (field: keyof MarketplaceAccount, value: boolean | string) => setAccount((prev) => ({ ...prev, [field]: value }));
  const updateSetting = <K extends keyof TenantMarketplaceSettings>(field: K, value: TenantMarketplaceSettings[K]) => setSettings((prev) => ({ ...prev, [field]: value }));

  const isTokenExpiredOrMissing = !account.is_connected || account.sync_status === 'token_expired' || account.sync_status === 'pending_credentials';

  return <div className="space-y-5">
    <section className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-5 dark:border-yellow-500/30 dark:bg-yellow-500/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <Store className="mt-0.5 h-6 w-6 text-amber-700 dark:text-yellow-300" />
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">{account.account_name || 'Mercado Livre'}</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">Produtos e pedidos entram automaticamente na loja conectada.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
              <span className={account.is_connected && account.sync_status !== 'token_expired' ? 'rounded-full bg-emerald-700 px-2.5 py-1 font-bold text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300 dark:shadow-none' : 'rounded-full bg-rose-700 px-2.5 py-1 font-bold text-white shadow-sm dark:bg-rose-500/20 dark:text-rose-300 dark:shadow-none'}>
                {account.sync_status === 'token_expired' ? 'TOKEN EXPIRADO' : account.is_connected ? 'CONECTADO' : 'CONEXÃO PENDENTE'}
              </span>
              {account.seller_id && <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-slate-700 dark:border-transparent dark:bg-chumbo-900 dark:text-slate-300">SELLER {account.seller_id}</span>}
              <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-slate-700 dark:border-transparent dark:bg-chumbo-900 dark:text-slate-300">{account.sync_status || 'pendente'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {account.is_connected && (
            <button
              onClick={disconnect}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 shadow-sm transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
              title="Desconecta a conta e limpa as credenciais salvas"
            >
              <Unplug className="h-3.5 w-3.5" />
              Desconectar conta
            </button>
          )}
          <button
            onClick={connect}
            disabled={busy !== null}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow disabled:opacity-50 ${isTokenExpiredOrMissing ? 'animate-pulse bg-rose-700 text-white hover:bg-rose-800 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-500' : 'bg-amber-700 text-white hover:bg-amber-800 dark:bg-yellow-300 dark:text-chumbo-950 dark:hover:bg-yellow-400'}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy === 'oauth' ? 'animate-spin' : ''}`} />
            {account.is_connected && account.sync_status !== 'token_expired' ? 'Reconectar conta' : 'Conectar conta agora'}
          </button>
        </div>
      </div>
      {account.seller_id && (
        <div className="mt-3 rounded-xl border border-amber-200/60 bg-white/60 p-2.5 text-[11px] text-slate-700 dark:border-yellow-500/20 dark:bg-chumbo-900/50 dark:text-slate-300">
          <strong>Atenção ao Seller ID:</strong> A conta vinculada no Mercado Livre possui o ID de usuário <code className="font-mono font-bold text-amber-900 dark:text-yellow-300">{account.seller_id}</code>. Se você possui uma conta de compras pessoal e uma conta de vendedor (PJ/loja), garanta que autorizou a conta correta. Se os produtos forem de outra conta, clique em <strong>Desconectar conta</strong> acima, faça login no Mercado Livre com a conta vendedora e conecte novamente.
        </div>
      )}
      {account.last_sync_at && <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400">Última sincronização: {new Date(account.last_sync_at).toLocaleString('pt-BR')}</p>}
      {account.last_error && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-rose-300 bg-rose-700 p-3.5 text-xs text-white dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex-1 leading-relaxed">{account.last_error}</p>
          {(isTokenExpiredOrMissing || account.last_error.toLowerCase().includes('reconect') || account.last_error.toLowerCase().includes('expirou') || account.last_error.toLowerCase().includes('credenciais') || account.last_error.toLowerCase().includes('oauth')) && (
            <button
              onClick={connect}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-bold text-rose-800 shadow transition-all hover:bg-rose-50 disabled:opacity-50 dark:bg-yellow-300 dark:text-chumbo-950 dark:hover:bg-yellow-400"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reconectar conta agora
            </button>
          )}
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
      <div className="flex items-center justify-between gap-3"><div><h4 className="font-bold text-slate-900 dark:text-white">Automação</h4><p className="text-xs text-slate-500 dark:text-slate-400">Cada fluxo pode ser ligado de forma independente.</p></div><ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[['sync_catalog', 'Importar catálogo', 'Cria e atualiza produtos automaticamente.'], ['sync_stock', 'Sincronizar estoque', 'Mantém quantidades alinhadas ao anúncio.'], ['sync_orders', 'Importar pedidos', 'Cria pedidos internos automaticamente.']].map(([field, label, hint]) => <label key={field} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-chumbo-800 dark:bg-chumbo-900/70"><input className="mt-0.5" type="checkbox" checked={Boolean(account[field as keyof MarketplaceAccount])} onChange={(event) => updateAccount(field as keyof MarketplaceAccount, event.target.checked)} /><span><strong className="block text-slate-900 dark:text-white">{label}</strong><span className="text-slate-500 dark:text-slate-400">{hint}</span></span></label>)}
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-chumbo-800 dark:bg-chumbo-900/70">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={settings.marketplace_controls_price}
            onChange={(event) => updateSetting('marketplace_controls_price', event.target.checked)}
          />
          <span>
            <strong className="block text-slate-900 dark:text-white">Preço pelo marketplace</strong>
            <span className="text-slate-500 dark:text-slate-400">
              {settings.marketplace_controls_price
                ? 'Preços são sincronizados com o Mercado Livre.'
                : 'Desativado: mantém seus preços editados no catálogo.'}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-chumbo-800 dark:bg-chumbo-900/70">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={settings.content_sync_policy === 'never'}
            onChange={(event) => updateSetting('content_sync_policy', event.target.checked ? 'never' : 'imported_only')}
          />
          <span>
            <strong className="block text-slate-900 dark:text-white">Preservar edições locais</strong>
            <span className="text-slate-500 dark:text-slate-400">
              {settings.content_sync_policy === 'never'
                ? 'Reconciliação traz apenas novos anúncios sem alterar itens existentes.'
                : 'Sobrescreve textos e imagens com dados do marketplace.'}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-chumbo-800 dark:bg-chumbo-900/70"><input className="mt-0.5" type="checkbox" checked={settings.auto_create_internal_orders} onChange={(event) => updateSetting('auto_create_internal_orders', event.target.checked)} /><span><strong className="block text-slate-900 dark:text-white">Criar pedido interno</strong><span className="text-slate-500 dark:text-slate-400">Disponibiliza a venda na operação da loja.</span></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-chumbo-800 dark:bg-chumbo-900/70"><input className="mt-0.5" type="checkbox" checked={settings.auto_create_financial_entries} onChange={(event) => updateSetting('auto_create_financial_entries', event.target.checked)} /><span><strong className="block text-slate-900 dark:text-white">Registrar custos</strong><span className="text-slate-500 dark:text-slate-400">Importa taxas e descontos para o financeiro.</span></span></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} disabled={busy !== null} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-chumbo-950 dark:hover:bg-slate-100"><Save className="h-4 w-4" /> Salvar</button>
        <button onClick={() => runSync('catalog')} disabled={busy !== null || !account.is_connected} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-chumbo-700 dark:bg-transparent dark:text-white"><RefreshCw className={`h-4 w-4 ${busy === 'catalog' ? 'animate-spin' : ''}`} /> Reconciliar catálogo</button>
        <button onClick={() => runSync('orders')} disabled={busy !== null || !account.is_connected} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-chumbo-700 dark:bg-transparent dark:text-white"><RefreshCw className={`h-4 w-4 ${busy === 'orders' ? 'animate-spin' : ''}`} /> Reconciliar pedidos</button>
      </div>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-900 dark:text-white">Catálogo importado <span className="ml-2 text-xs text-slate-500">{importedProducts.length}</span></h4>
          <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400/90">Agrupados por cor na vitrine</span>
        </div>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {importedProducts.map((product) => {
            const mapping = mappedItems.find((item) => item.product_id === product.id);
            const color = getMarketplaceVariantColor(product);
            const familyTitle = getMarketplaceFamilyTitle(product);
            const siblingsCount = importedProducts.filter((p) => getMarketplaceFamilyTitle(p) === familyTitle).length;
            const subtitle = product.variants && product.variants.length > 0
              ? `${product.variants.length} variação(ões)`
              : siblingsCount > 1
                ? `${color ? `Cor: ${color} · ` : ''}${siblingsCount} cores agrupadas na vitrine`
                : '0 variação(ões)';

            return (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-transparent dark:bg-chumbo-900/70">
                <img src={product.image_url} className="h-10 w-10 rounded-lg object-cover" alt="" />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-slate-900 dark:text-white">{product.title}</strong>
                  <span className="text-slate-500 dark:text-slate-400">{subtitle} · {currencyBRL(product.price)}</span>
                </div>
                {mapping?.external_url && (
                  <a href={mapping.external_url} target="_blank" rel="noreferrer" title="Abrir anúncio no Mercado Livre">
                    <ExternalLink className="h-4 w-4 text-amber-600 transition-colors hover:text-amber-500 dark:text-yellow-300 dark:hover:text-yellow-200" />
                  </a>
                )}
              </div>
            );
          })}
          {!importedProducts.length && <p className="py-8 text-center text-xs text-slate-500">Nenhum produto importado.</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
        <h4 className="font-bold text-slate-900 dark:text-white">Pedidos externos <span className="ml-2 text-xs text-slate-500">{orders.length}</span></h4>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {orders.slice(0, 30).map((order) => (
            <div key={order.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-transparent dark:bg-chumbo-900/70">
              <div className="flex justify-between gap-3">
                <strong className="text-slate-900 dark:text-white">#{order.external_order_id}</strong>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{currencyBRL(order.gross_amount)}</span>
              </div>
              <p className="mt-1 text-slate-500 dark:text-slate-400">{order.external_status} · {order.items?.length || 0} item(ns)</p>
            </div>
          ))}
          {!orders.length && <p className="py-8 text-center text-xs text-slate-500">Nenhum pedido importado.</p>}
        </div>
      </section>
    </div>
  </div>;
};
