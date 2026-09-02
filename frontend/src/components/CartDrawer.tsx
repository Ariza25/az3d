import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Layers, MapPin, Minus, Plus, ReceiptText, ShoppingBag, Truck, Trash2, X } from 'lucide-react';
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

  const { isAuthenticated, token } = useAuth();
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
  const [checkoutStep, setCheckoutStep] = useState<'items' | 'delivery'>('items');

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
    if (!isAuthenticated || !token) return;
    setIsLoadingOrders(true);
    setErrorMessage(null);
    try {
      const orders = await api.getMyOrders(tenantSettings?.tenant_id, token);
      setMyOrders(orders);
    } catch (err: any) {
      setErrorMessage(err.message || 'Nao foi possivel carregar seus pedidos.');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    const handleOpenCart = () => {
      setDrawerMode('cart');
      setCheckoutStep('items');
      setErrorMessage(null);
    };
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
  }, [isAuthenticated, tenantSettings?.tenant_id, token]);

  useEffect(() => {
    if (cart.length === 0) setCheckoutStep('items');
  }, [cart.length]);

  useEffect(() => {
    if (!isCartOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCartOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen, setIsCartOpen]);

  const closeDrawer = () => {
    setIsCartOpen(false);
    setCheckoutStep('items');
    setErrorMessage(null);
  };

  const continueToDelivery = () => {
    setErrorMessage(null);
    if (!isAuthenticated || !token) {
      closeDrawer();
      onOpenLogin();
      return;
    }
    setCheckoutStep('delivery');
  };

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (!isAuthenticated || !token) {
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
      }, tenantSettings?.tenant_id, token);

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

  const title = drawerMode === 'orders'
    ? 'Meus pedidos'
    : checkoutStep === 'delivery'
      ? 'Entrega e contato'
      : 'Seu carrinho';

  const subtitle = drawerMode === 'orders'
    ? 'Acompanhe suas compras'
    : checkoutStep === 'delivery'
      ? 'Etapa 2 de 2'
      : `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={closeDrawer} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 flex max-w-full sm:pl-10">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
          className="flex w-screen max-w-[36rem] flex-col border-l border-chumbo-800 bg-chumbo-950 shadow-2xl"
        >
          <header className="flex min-h-24 items-center justify-between border-b border-chumbo-850 bg-chumbo-900/70 px-5 py-5 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              {(drawerMode === 'orders' || checkoutStep === 'delivery') ? (
                <button
                  type="button"
                  onClick={() => drawerMode === 'orders' ? setDrawerMode('cart') : setCheckoutStep('items')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-chumbo-700 text-slate-300 transition-colors hover:bg-chumbo-800 hover:text-white"
                  aria-label="Voltar ao carrinho"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-chumbo-700 bg-chumbo-800 text-laser-400">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <h2 id="cart-drawer-title" className="truncate text-lg font-extrabold text-white">{title}</h2>
                <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeDrawer}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-chumbo-800 hover:text-white"
              aria-label="Fechar carrinho"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {drawerMode === 'orders' ? (
            <OrdersPanel
              orders={myOrders}
              isLoading={isLoadingOrders}
              errorMessage={errorMessage}
              onReload={loadMyOrders}
              onOpenLogin={() => {
                closeDrawer();
                onOpenLogin();
              }}
              isAuthenticated={isAuthenticated}
            />
          ) : orderSuccess ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Pedido registrado</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{orderSuccess}</p>
                {lastOrder && (
                  <p className="mt-2 text-sm font-mono text-slate-100">Pedido #{lastOrder.id} · {money(lastOrder.total_amount)}</p>
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
                    closeDrawer();
                  }}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-chumbo-950 hover:bg-slate-200"
                >
                  Voltar à loja
                </button>
              </div>

              {myOrders.length > 0 && <OrdersList orders={myOrders.slice(0, 3)} compact />}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                {errorMessage && (
                  <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-800/80 bg-red-950/60 p-3.5 text-xs text-red-200" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-4 py-16 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-chumbo-700 bg-chumbo-900 text-laser-400 shadow-xl shadow-black/20">
                      <ShoppingBag className="h-9 w-9 stroke-[1.7]" />
                    </div>
                    <h3 className="mt-6 text-xl font-extrabold text-white">Seu carrinho está vazio</h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">Encontre uma peça, escolha a cor e ela aparece aqui para você revisar.</p>
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-chumbo-950 transition-colors hover:bg-slate-200"
                    >
                      Explorar catálogo
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : checkoutStep === 'items' ? (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <article key={`${item.product.id}-${item.color}`} className="rounded-2xl border border-chumbo-800 bg-chumbo-900/65 p-3 sm:p-4">
                        <div className="flex gap-3.5 sm:gap-4">
                          <img
                            src={item.product.color_images?.find((image) => image.color_name === item.color)?.image_url || item.product.image_url}
                            alt={item.product.title}
                            className="h-24 w-24 shrink-0 rounded-xl border border-chumbo-700 object-cover sm:h-28 sm:w-28"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="line-clamp-2 text-sm font-bold leading-5 text-white sm:text-base">{item.product.title}</h4>
                                <span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                                  <Layers className="h-3.5 w-3.5 text-laser-400" />
                                  {item.color}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.product.id, item.color)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                aria-label={`Remover ${item.product.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 flex items-end justify-between gap-3">
                              <div className="flex h-10 items-center rounded-xl border border-chumbo-700 bg-chumbo-950" aria-label={`Quantidade de ${item.product.title}`}>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, item.color, item.quantity - 1)}
                                  className="flex h-full w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
                                  aria-label={`Diminuir quantidade de ${item.product.title}`}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="min-w-7 text-center font-mono text-sm font-bold text-white">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, item.color, item.quantity + 1)}
                                  className="flex h-full w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
                                  aria-label={`Aumentar quantidade de ${item.product.title}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="text-right">
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500">Subtotal</span>
                                <strong className="mt-0.5 block text-base font-extrabold text-white">{money(item.product.price * item.quantity)}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-7">
                    <section>
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-white">Como você quer receber?</h3>
                        <p className="mt-1 text-xs text-slate-500">Escolha a opção mais conveniente.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {deliveryOptions.map((option) => {
                          const Icon = option.value === 'shipping' ? Truck : ShoppingBag;
                          const isSelected = deliveryMethod === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={!option.enabled}
                              onClick={() => {
                                setDeliveryMethod(option.value);
                                setErrorMessage(null);
                              }}
                              className={`flex min-h-20 items-center gap-3 rounded-2xl border px-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isSelected ? 'border-laser-400 bg-laser-400/10 text-white' : 'border-chumbo-700 bg-chumbo-900/60 text-slate-300 hover:border-chumbo-600'}`}
                              aria-pressed={isSelected}
                            >
                              <Icon className={`h-5 w-5 shrink-0 ${isSelected ? 'text-laser-400' : 'text-slate-500'}`} />
                              <span>
                                <strong className="block text-sm">{option.label}</strong>
                                <span className="mt-0.5 block text-[11px] text-slate-500">{option.value === 'shipping' ? 'No seu endereço' : 'Na loja'}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section>
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-white">Dados para contato</h3>
                        <p className="mt-1 text-xs text-slate-500">Usaremos esses dados somente neste pedido.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <RequiredInput label="Nome de quem recebe" value={recipientName} onChange={setRecipientName} placeholder="Seu nome" autoComplete="name" />
                        <RequiredInput label="Telefone" value={recipientPhone} onChange={setRecipientPhone} placeholder="(00) 00000-0000" autoComplete="tel" />
                      </div>
                    </section>

                    {deliveryMethod === 'shipping' && (
                      <section>
                        <div className="mb-3">
                          <h3 className="text-sm font-bold text-white">Endereço de entrega</h3>
                          <p className="mt-1 text-xs text-slate-500">Preencha onde o pedido deve chegar.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_88px]">
                          <RequiredInput label="CEP" value={zipCode} onChange={setZipCode} placeholder="00000-000" autoComplete="postal-code" />
                          <RequiredInput label="Cidade" value={city} onChange={setCity} placeholder="Sua cidade" autoComplete="address-level2" />
                          <RequiredInput label="UF" value={state} onChange={setState} placeholder="SP" autoComplete="address-level1" />
                        </div>
                        <div className="mt-3">
                          <RequiredInput label="Endereço completo" value={shippingAddress} onChange={setShippingAddress} placeholder="Rua, número, bairro e complemento" autoComplete="street-address" />
                        </div>
                      </section>
                    )}

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-300">Observações <span className="font-normal text-slate-500">(opcional)</span></span>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        placeholder="Alguma orientação para a loja?"
                        className="w-full resize-none rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
                      />
                    </label>
                  </div>
                )}
              </div>

              {cart.length > 0 && checkoutStep === 'items' && (
                <footer className="space-y-4 border-t border-chumbo-850 bg-chumbo-900/85 px-5 py-5 sm:px-7">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Subtotal · {totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                      <span className="text-xl font-extrabold text-white">{money(totalPrice)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Entrega ou retirada é definida no próximo passo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={continueToDelivery}
                    disabled={!canShip && !canPickup}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold text-chumbo-950 shadow-xl transition-colors hover:bg-slate-200 disabled:opacity-50"
                  >
                    <span>{isAuthenticated ? 'Continuar para entrega' : 'Entrar para continuar'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={closeDrawer} className="w-full text-xs font-semibold text-slate-400 transition-colors hover:text-white">
                    Continuar comprando
                  </button>
                </footer>
              )}

              {cart.length > 0 && checkoutStep === 'delivery' && (
                <footer className="border-t border-chumbo-850 bg-chumbo-900/90 px-5 py-5 sm:px-7">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Total do pedido</span>
                    <span className="text-2xl font-extrabold text-white">{money(totalPrice)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isSubmitting || (!canShip && !canPickup)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold text-chumbo-950 shadow-xl transition-colors hover:bg-slate-200 disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Abrindo Mercado Pago...' : 'Ir para o pagamento'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">Você revisará o pagamento com segurança no Mercado Pago.</p>
                </footer>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

const RequiredInput = ({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
    />
  </label>
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
