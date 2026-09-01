import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Save, ShieldCheck, Store } from 'lucide-react';
import { ExternalMarketplaceOrder, MarketplaceAccount, MarketplaceProductMapping, Product, TenantMarketplaceSettings } from '../types';
import { api } from '../services/api';
import { getAppPathname, withBasePath } from '../shared/basePath';

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
  const runSync = async (kind: 'catalog' | 'orders') => {
    if (!tenantId) return; setBusy(kind);
    try { const result = kind === 'catalog' ? await api.syncMarketplaceProducts(PROVIDER, tenantId) : await api.syncMarketplaceOrders(PROVIDER, 7, tenantId); await loadData(); if (kind === 'catalog') onProductsImported?.(); onMessage({ type: 'success', text: result.results[0]?.message || 'Sincronização concluída.' }); }
    catch (error: any) { onMessage({ type: 'error', text: error.message || 'Erro ao sincronizar' }); } finally { setBusy(null); }
  };
  const updateAccount = (field: keyof MarketplaceAccount, value: boolean | string) => setAccount((prev) => ({ ...prev, [field]: value }));
  const updateSetting = (field: keyof TenantMarketplaceSettings, value: boolean) => setSettings((prev) => ({ ...prev, [field]: value }));

  return <div className="space-y-5">
    <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex gap-3"><Store className="mt-0.5 h-6 w-6 text-yellow-300" /><div><h4 className="font-bold text-white">Mercado Livre</h4><p className="text-xs text-slate-300">Produtos e pedidos entram automaticamente no tenant conectado.</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono"><span className={account.is_connected ? 'rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-300' : 'rounded-full bg-amber-500/20 px-2 py-1 text-amber-300'}>{account.is_connected ? 'CONECTADO' : 'CONEXÃO PENDENTE'}</span>{account.seller_id && <span className="rounded-full bg-chumbo-900 px-2 py-1 text-slate-300">SELLER {account.seller_id}</span>}<span className="rounded-full bg-chumbo-900 px-2 py-1 text-slate-300">{account.sync_status || 'pendente'}</span></div></div></div><button onClick={connect} disabled={busy !== null} className="rounded-xl bg-yellow-300 px-4 py-2 text-xs font-bold text-chumbo-950 disabled:opacity-50">{account.is_connected ? 'Reconectar conta' : 'Conectar conta'}</button></div>
      {account.last_sync_at && <p className="mt-3 text-[10px] text-slate-400">Última sincronização: {new Date(account.last_sync_at).toLocaleString('pt-BR')}</p>}{account.last_error && <p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300">{account.last_error}</p>}
    </section>
    <section className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-5">
      <div className="flex items-center justify-between gap-3"><div><h4 className="font-bold text-white">Automação</h4><p className="text-xs text-slate-400">Cada fluxo pode ser ligado de forma independente.</p></div><ShieldCheck className="h-5 w-5 text-emerald-400" /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[['sync_catalog', 'Importar catálogo', 'Cria e atualiza produtos automaticamente.'], ['sync_stock', 'Sincronizar estoque', 'Mantém quantidades alinhadas ao anúncio.'], ['sync_orders', 'Importar pedidos', 'Cria pedidos internos automaticamente.']].map(([field, label, hint]) => <label key={field} className="flex items-start gap-3 rounded-xl border border-chumbo-800 bg-chumbo-900/70 p-3 text-xs"><input className="mt-0.5" type="checkbox" checked={Boolean(account[field as keyof MarketplaceAccount])} onChange={(event) => updateAccount(field as keyof MarketplaceAccount, event.target.checked)} /><span><strong className="block text-white">{label}</strong><span className="text-slate-500">{hint}</span></span></label>)}
        <label className="flex items-start gap-3 rounded-xl border border-chumbo-800 bg-chumbo-900/70 p-3 text-xs"><input className="mt-0.5" type="checkbox" checked={settings.marketplace_controls_price} onChange={(event) => updateSetting('marketplace_controls_price', event.target.checked)} /><span><strong className="block text-white">Preço pelo marketplace</strong><span className="text-slate-500">Atualiza preços dos produtos importados.</span></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-chumbo-800 bg-chumbo-900/70 p-3 text-xs"><input className="mt-0.5" type="checkbox" checked={settings.auto_create_internal_orders} onChange={(event) => updateSetting('auto_create_internal_orders', event.target.checked)} /><span><strong className="block text-white">Criar pedido interno</strong><span className="text-slate-500">Disponibiliza a venda na operação do tenant.</span></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-chumbo-800 bg-chumbo-900/70 p-3 text-xs"><input className="mt-0.5" type="checkbox" checked={settings.auto_create_financial_entries} onChange={(event) => updateSetting('auto_create_financial_entries', event.target.checked)} /><span><strong className="block text-white">Registrar custos</strong><span className="text-slate-500">Importa taxas e descontos para o financeiro.</span></span></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={save} disabled={busy !== null} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 disabled:opacity-50"><Save className="h-4 w-4" /> Salvar</button><button onClick={() => runSync('catalog')} disabled={busy !== null || !account.is_connected} className="flex items-center gap-2 rounded-xl border border-chumbo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'catalog' ? 'animate-spin' : ''}`} /> Reconciliar catálogo</button><button onClick={() => runSync('orders')} disabled={busy !== null || !account.is_connected} className="flex items-center gap-2 rounded-xl border border-chumbo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === 'orders' ? 'animate-spin' : ''}`} /> Reconciliar pedidos</button></div>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4"><h4 className="font-bold text-white">Catálogo importado <span className="ml-2 text-xs text-slate-500">{importedProducts.length}</span></h4><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{importedProducts.map((product) => { const mapping = mappedItems.find((item) => item.product_id === product.id); return <div key={product.id} className="flex items-center gap-3 rounded-xl bg-chumbo-900/70 p-3 text-xs"><img src={product.image_url} className="h-10 w-10 rounded-lg object-cover" alt="" /><div className="min-w-0 flex-1"><strong className="block truncate text-white">{product.title}</strong><span className="text-slate-500">{product.variants?.length || 0} variação(ões) · {currencyBRL(product.price)}</span></div>{mapping?.external_url && <a href={mapping.external_url} target="_blank" rel="noreferrer" title="Abrir anúncio"><ExternalLink className="h-4 w-4 text-yellow-300" /></a>}</div>})}{!importedProducts.length && <p className="py-8 text-center text-xs text-slate-500">Nenhum produto importado.</p>}</div></section>
      <section className="rounded-2xl border border-chumbo-800 bg-chumbo-950/60 p-4"><h4 className="font-bold text-white">Pedidos externos <span className="ml-2 text-xs text-slate-500">{orders.length}</span></h4><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{orders.slice(0, 30).map((order) => <div key={order.id} className="rounded-xl bg-chumbo-900/70 p-3 text-xs"><div className="flex justify-between gap-3"><strong className="text-white">#{order.external_order_id}</strong><span className="font-bold text-emerald-300">{currencyBRL(order.gross_amount)}</span></div><p className="mt-1 text-slate-500">{order.external_status} · {order.items?.length || 0} item(ns)</p></div>)}{!orders.length && <p className="py-8 text-center text-xs text-slate-500">Nenhum pedido importado.</p>}</div></section>
    </div>
  </div>;
};
