import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Layers, MapPin, ReceiptText, ShoppingBag, Truck, Trash2, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Order, TenantSettings } from '../types';
import { money } from '../shared/storePresentation';

interface CartDrawerProps {
  onOpenLogin: () => void;
  tenantSettings?: TenantSettings | null;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmacao',
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  preparing: 'Em preparo',
  delivered: 'Concluido',
  cancelled: 'Cancelado',
};

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOpenLogin, tenantSettings }) => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalPrice,
    totalItems,
    isCartOpen,
    setIsCartOpen,
  } = useCart();

  const { isAuthenticated } = useAuth();
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'cart' | 'orders'>('cart');

  const canShip = tenantSettings?.delivery_ship_enabled ?? true;
  const canPickup = tenantSettings?.delivery_pickup_enabled ?? true;
  const deliveryOptions = useMemo(() => [
    { value: 'shipping' as const, label: 'Entrega', enabled: canShip },
    { value: 'pickup' as const, label: 'Retirada', enabled: canPickup },
  ], [canShip, canPickup]);

  useEffect(() => {
    if (deliveryMethod === 'shipping' && !canShip && canPickup) setDeliveryMethod('pickup');
    if (deliveryMethod === 'pickup' && !canPickup && canShip) setDeliveryMethod('shipping');
  }, [canPickup, canShip, deliveryMethod]);

  const loadMyOrders = async () => {
    if (!isAuthenticated) return;
    setIsLoadingOrders(true);
    setErrorMessage(null);
    try {
      const orders = await api.getMyOrders(tenantSettings?.tenant_id);
      setMyOrders(orders);
    } catch (err: any) {
      setErrorMessage(err.message || 'Nao foi possivel carregar seus pedidos.');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    const handleOpenCart = () => setDrawerMode('cart');
    const handleOpenOrders = () => {
      setDrawerMode('orders');
      loadMyOrders();
    };
    window.addEventListener('az3d:open-cart', handleOpenCart);
    window.addEventListener('az3d:open-orders', handleOpenOrders);
    return () => {
      window.removeEventListener('az3d:open-cart', handleOpenCart);
      window.removeEventListener('az3d:open-orders', handleOpenOrders);
    };
  }, [isAuthenticated, tenantSettings?.tenant_id]);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setIsCartOpen(false);
      onOpenLogin();
      return;
    }

    if (cart.length === 0) return;
    if (!canShip && !canPickup) {
      setErrorMessage('Esta loja ainda nao configurou retirada ou entrega.');
      return;
    }
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setErrorMessage('Informe nome e telefone para continuar.');
      return;
    }
    if (deliveryMethod === 'shipping' && (!shippingAddress.trim() || !zipCode.trim() || !city.trim() || !state.trim())) {
      setErrorMessage('Informe endereco, CEP, cidade e UF para entrega.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.createOrder({
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          color: item.color,
        })),
        shipping_address: deliveryMethod === 'shipping' ? shippingAddress : 'Retirada na loja',
        delivery_method: deliveryMethod,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        zip_code: zipCode,
        city,
        state,
        notes,
      });

      const checkoutUrl = result.payment?.checkout_url || result.payment?.sandbox_checkout_url;
      clearCart();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      setOrderSuccess(result.message);
      setLastOrder(result.order);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-chumbo-950 border-l border-chumbo-800 shadow-2xl flex flex-col justify-between sm:max-w-lg">
          <div className="p-6 border-b border-chumbo-850 flex items-center justify-between bg-chumbo-900/60">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-chumbo-800 border border-chumbo-700 flex items-center justify-center text-white">
                <ShoppingBag className="w-5 h-5 text-laser-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{drawerMode === 'orders' ? 'Meus pedidos' : 'Carrinho'}</h2>
                <p className="text-xs text-slate-400 font-mono">
                  {drawerMode === 'orders' ? 'Acompanhe suas compras' : `${totalItems} ${totalItems === 1 ? 'item selecionado' : 'itens selecionados'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {drawerMode === 'orders' && (
                <button onClick={() => setDrawerMode('cart')} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-chumbo-800 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-chumbo-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {drawerMode === 'orders' ? (
            <OrdersPanel
              orders={myOrders}
              isLoading={isLoadingOrders}
              errorMessage={errorMessage}
              onReload={loadMyOrders}
              onOpenLogin={() => {
                setIsCartOpen(false);
                onOpenLogin();
              }}
              isAuthenticated={isAuthenticated}
            />
          ) : orderSuccess ? (
            <div className="p-8 flex-1 overflow-y-auto text-center space-y-5">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Pedido registrado</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{orderSuccess}</p>
                {lastOrder && (
                  <p className="mt-2 text-sm font-mono text-slate-100">Pedido #{lastOrder.id} - {money(lastOrder.total_amount)}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setDrawerMode('orders');
                    loadMyOrders();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-chumbo-800"
                >
                  <ReceiptText className="h-4 w-4" />
                  Meus pedidos
                </button>
                <button
                  onClick={() => {
                    setOrderSuccess(null);
                    setLastOrder(null);
                    setMyOrders([]);
                    setIsCartOpen(false);
                  }}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-chumbo-950 hover:bg-slate-200"
                >
                  Voltar a loja
                </button>
              </div>

              {myOrders.length > 0 && <OrdersList orders={myOrders.slice(0, 3)} compact />}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-16 space-y-3">
                    <ShoppingBag className="w-12 h-12 stroke-[1.5]" />
                    <p className="text-sm font-medium">Seu carrinho esta vazio</p>
                    <p className="text-xs text-slate-600 max-w-xs">Escolha produtos no catalogo e adicione ao carrinho.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={`${item.product.id}-${item.color}`} className="glass-card p-3.5 rounded-xl border border-chumbo-800 flex items-center space-x-3.5">
                      <img
                        src={item.product.color_images?.find((image) => image.color_name === item.color)?.image_url || item.product.image_url}
                        alt={item.product.title}
                        className="w-16 h-16 object-cover rounded-xl border border-chumbo-700 shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{item.product.title}</h4>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono mt-0.5">
                          <span className="flex items-center gap-1 text-slate-300">
                            <Layers className="w-3 h-3 text-laser-400" /> {item.color}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{money(item.product.price * item.quantity)}</p>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        <button onClick={() => removeFromCart(item.product.id, item.color)} className="text-slate-500 hover:text-red-400 p-1 transition-colors" title="Remover item">
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center border border-chumbo-700 bg-chumbo-950 rounded-lg">
                          <button onClick={() => updateQuantity(item.product.id, item.color, item.quantity - 1)} className="px-2 py-0.5 text-slate-400 hover:text-white text-xs">-</button>
                          <span className="px-2 font-mono text-xs font-bold text-white">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, item.color, item.quantity + 1)} className="px-2 py-0.5 text-slate-400 hover:text-white text-xs">+</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-chumbo-850 bg-chumbo-900/80 space-y-4">
                  <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Resumo</span>
                      <span>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-300">Total</span>
                      <span className="text-2xl font-extrabold text-white">{money(totalPrice)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {deliveryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!option.enabled}
                        onClick={() => setDeliveryMethod(option.value)}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${deliveryMethod === option.value ? 'border-laser-400 bg-laser-400/10 text-laser-300' : 'border-chumbo-700 text-slate-400'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <RequiredInput value={recipientName} onChange={setRecipientName} placeholder="Nome obrigatorio" />
                    <RequiredInput value={recipientPhone} onChange={setRecipientPhone} placeholder="Telefone obrigatorio" />
                  </div>

                  {deliveryMethod === 'shipping' && (
                    <>
                      <div className="grid grid-cols-[1fr_1fr_70px] gap-2">
                        <RequiredInput value={zipCode} onChange={setZipCode} placeholder="CEP" />
                        <RequiredInput value={city} onChange={setCity} placeholder="Cidade" />
                        <RequiredInput value={state} onChange={setState} placeholder="UF" />
                      </div>
                      <RequiredInput value={shippingAddress} onChange={setShippingAddress} placeholder="Rua, numero, bairro, complemento" />
                    </>
                  )}

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Observacoes do pedido"
                    className="w-full bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white"
                  />

                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting || (!canShip && !canPickup)}
                    className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-extrabold text-sm transition-all shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Abrindo Mercado Pago...' : isAuthenticated ? 'Pagar com Mercado Pago' : 'Entrar para concluir'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const RequiredInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => (
  <input
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className="bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white"
  />
);

const OrdersPanel = ({
  orders,
  isLoading,
  errorMessage,
  onReload,
  onOpenLogin,
  isAuthenticated,
}: {
  orders: Order[];
  isLoading: boolean;
  errorMessage: string | null;
  onReload: () => void;
  onOpenLogin: () => void;
  isAuthenticated: boolean;
}) => (
  <div className="flex-1 overflow-y-auto p-6">
    {!isAuthenticated ? (
      <div className="py-16 text-center">
        <ReceiptText className="mx-auto h-12 w-12 text-slate-600" />
        <h3 className="mt-4 text-lg font-bold text-white">Entre para ver seus pedidos</h3>
        <p className="mt-2 text-sm text-slate-400">Seu historico fica vinculado a conta de comprador.</p>
        <button onClick={onOpenLogin} className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-chumbo-950 hover:bg-slate-200">
          Entrar
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">{orders.length} pedido(s) encontrado(s)</p>
          <button onClick={onReload} className="rounded-lg border border-chumbo-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-chumbo-800">
            Atualizar
          </button>
        </div>
        {errorMessage && (
          <div className="rounded-xl border border-red-800/80 bg-red-950/60 p-3 text-xs text-red-200">{errorMessage}</div>
        )}
        {isLoading ? (
          <p className="py-12 text-center text-xs text-slate-500">Carregando pedidos...</p>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">Voce ainda nao fez pedidos nesta loja.</div>
        ) : (
          <OrdersList orders={orders} />
        )}
      </div>
    )}
  </div>
);

const OrdersList = ({ orders, compact = false }: { orders: Order[]; compact?: boolean }) => (
  <div className="space-y-3 text-left">
    {orders.map((order) => {
      const latestShipment = order.shipments?.[0];
      const latestEvent = latestShipment?.events?.[0];
      return (
        <div key={order.id} className="rounded-2xl border border-chumbo-800 bg-chumbo-900/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-sm font-bold text-white">Pedido #{order.id}</span>
              <p className="mt-1 text-[11px] text-slate-500">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
            </div>
            <span className="text-sm font-extrabold text-white">{money(order.total_amount)}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <StatusPill label={ORDER_STATUS_LABELS[order.status] || order.status} tone={order.status === 'cancelled' ? 'danger' : order.status === 'delivered' || order.status === 'paid' ? 'success' : 'warning'} />
            <StatusPill label={order.payment_status || 'pagamento pendente'} tone={order.payment_status === 'approved' ? 'success' : order.payment_status === 'rejected' ? 'danger' : 'warning'} />
          </div>

          {!compact && (
            <div className="mt-3 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>{order.delivery_method === 'pickup' ? 'Retirada na loja' : order.shipping_address || 'Endereco nao informado'}</span>
              </div>
              {latestShipment ? (
                <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-mono text-slate-300">
                      <Truck className="h-3.5 w-3.5 text-laser-400" />
                      {latestShipment.tracking_code}
                    </span>
                    <span className="text-[10px] uppercase text-slate-500">{latestShipment.status}</span>
                  </div>
                  {latestEvent && (
                    <p className="mt-2 text-slate-400">
                      {latestEvent.description}
                      {latestEvent.location ? ` - ${latestEvent.location}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-xl border border-chumbo-800 bg-chumbo-950/70 p-3 text-slate-500">Rastreio ainda nao informado pela loja.</p>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const StatusPill = ({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' }) => {
  const classes = tone === 'success'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : tone === 'danger'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return <span className={`rounded-full border px-2 py-1 text-center font-bold ${classes}`}>{label}</span>;
};
