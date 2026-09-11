import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  ExternalLink,
  Layers,
  Lock,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Trash2,
  X,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CreateOrderResponse, Order, TenantSettings } from '../types';
import { money } from '../shared/storePresentation';
import { FreightCalculatorWidget } from './FreightCalculatorWidget';
import { TransparentPaymentModal } from './TransparentPaymentModal';

interface CartDrawerProps {
  onOpenLogin: () => void;
  tenantSettings?: TenantSettings | null;
}

interface SavedCard {
  id: string;
  cardNumber: string;
  cardNumberMasked: string;
  cardholderName: string;
  expiry: string;
  cpf: string;
  brand: string;
}

const detectCardBrand = (num: string): string => {
  const clean = num.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'Visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'Mastercard';
  if (/^3[47]/.test(clean)) return 'Amex';
  if (/^(4011|4389|4514|4576|5041|5066|5090|6277|6362|6363)/.test(clean)) return 'Elo';
  if (/^606282/.test(clean)) return 'Hipercard';
  return 'Cartão';
};

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

  const { isAuthenticated, token, user } = useAuth();
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [payerCPF, setPayerCPF] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [installments, setInstallments] = useState(1);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>('new');
  const [shouldSaveCard, setShouldSaveCard] = useState<boolean>(true);
  const [activePaymentResponse, setActivePaymentResponse] = useState<CreateOrderResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'cart' | 'orders'>('cart');
  const [checkoutStep, setCheckoutStep] = useState<'items' | 'delivery'>('items');
  const [selectedFreight, setSelectedFreight] = useState<{ code: string; name: string; price: number; deliveryDays: number } | null>(null);

  const freightAmount = (deliveryMethod === 'shipping' && selectedFreight) ? selectedFreight.price : 0;
  const cartGrandTotal = totalPrice + freightAmount;

  const installmentOptions = useMemo(() => {
    const total = cartGrandTotal;
    const maxInstallments = Math.min(12, Math.max(1, Math.floor(total / 10)));
    const list = [];
    for (let i = 1; i <= Math.max(1, maxInstallments); i++) {
      const val = total / i;
      list.push({
        times: i,
        label: `${i}x de ${money(val)} ${i === 1 ? 'à vista' : 'sem juros'}`,
      });
    }
    return list;
  }, [cartGrandTotal]);

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length > 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    if (digits.length > 6) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }
    if (digits.length > 3) {
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    return digits;
  };

  const canShip = tenantSettings?.delivery_ship_enabled ?? true;
  const canPickup = tenantSettings?.delivery_pickup_enabled ?? true;
  const deliveryOptions = useMemo(() => [
    { value: 'shipping' as const, label: 'Entrega', enabled: canShip },
    { value: 'pickup' as const, label: 'Retirada', enabled: canPickup },
  ], [canShip, canPickup]);

  useEffect(() => {
    if (user?.id) {
      if (!recipientName && user.name) setRecipientName(user.name);
      if (!recipientPhone && user.phone) setRecipientPhone(user.phone);

      // Load default address if available
      try {
        let addrs: any[] = [];
        if (user.addresses) {
          addrs = typeof user.addresses === 'string' ? JSON.parse(user.addresses) : user.addresses;
        }
        if (addrs.length === 0) {
          const storedAddr = localStorage.getItem(`az3d_saved_addresses_${user.id}`);
          if (storedAddr) addrs = JSON.parse(storedAddr);
        }
        if (addrs.length > 0) {
          const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
          if (!zipCode && defaultAddr.cep) setZipCode(defaultAddr.cep);
          if (!city && defaultAddr.city) setCity(defaultAddr.city);
          if (!state && defaultAddr.state) setState(defaultAddr.state);
          if (!shippingAddress && defaultAddr.street) {
            setShippingAddress(`${defaultAddr.street}, ${defaultAddr.number}${defaultAddr.complement ? ` - ${defaultAddr.complement}` : ''}, ${defaultAddr.neighborhood}`);
          }
        }
      } catch {
        // ignore
      }

      // Load saved cards
      try {
        let parsed: any[] = [];
        if (user.saved_cards) {
          parsed = typeof user.saved_cards === 'string' ? JSON.parse(user.saved_cards) : user.saved_cards;
        }
        if (parsed.length === 0) {
          const stored = localStorage.getItem(`az3d_saved_cards_${user.id}`);
          if (stored) parsed = JSON.parse(stored);
        }

        if (parsed && parsed.length > 0) {
          const normalized: SavedCard[] = parsed.map((c: any) => ({
            id: c.id || String(Date.now()),
            cardNumber: c.cardNumber || `•••• •••• •••• ${c.last_four || c.lastFour || '4242'}`,
            cardNumberMasked: c.cardNumberMasked || `•••• •••• •••• ${c.last_four || c.lastFour || '4242'}`,
            cardholderName: c.cardholderName || c.holder_name || '',
            expiry: c.expiry || (c.expiry_month && c.expiry_year ? `${c.expiry_month}/${c.expiry_year}` : ''),
            cpf: c.cpf || '',
            brand: c.brand || detectCardBrand(c.cardNumber || ''),
          }));

          setSavedCards(normalized);
          const first = normalized[0];
          setSelectedSavedCardId(first.id);
          setCardNumber(first.cardNumber);
          setCardholderName(first.cardholderName);
          setCardExpiry(first.expiry);
          if (first.cpf) setPayerCPF(first.cpf);
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

  const handleSelectSavedCard = (cardId: string) => {
    setSelectedSavedCardId(cardId);
    if (cardId === 'new') {
      setCardNumber('');
      setCardholderName('');
      setCardExpiry('');
      setCardCVV('');
    } else {
      const found = savedCards.find((c) => c.id === cardId);
      if (found) {
        setCardNumber(found.cardNumber);
        setCardholderName(found.cardholderName);
        setCardExpiry(found.expiry);
        if (found.cpf) setPayerCPF(found.cpf);
        setCardCVV('');
      }
    }
  };

  const handleDeleteSavedCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    const updated = savedCards.filter((c) => c.id !== cardId);
    setSavedCards(updated);
    localStorage.setItem(`az3d_saved_cards_${user.id}`, JSON.stringify(updated));
    if (selectedSavedCardId === cardId) {
      handleSelectSavedCard(updated.length > 0 ? updated[0].id : 'new');
    }
  };

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

    if (paymentMethod === 'pix') {
      if (!payerCPF.replace(/\D/g, '')) {
        setErrorMessage('Informe o CPF para gerar o PIX.');
        return;
      }
    } else if (paymentMethod === 'credit_card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 13) {
        setErrorMessage('Informe um número de cartão de crédito válido.');
        return;
      }
      if (!cardholderName.trim()) {
        setErrorMessage('Informe o nome do titular impresso no cartão.');
        return;
      }
      const [mStr, yStr] = cardExpiry.split('/');
      const m = parseInt(mStr, 10);
      const y = parseInt(yStr, 10);
      if (!m || !y || m < 1 || m > 12) {
        setErrorMessage('Informe a validade correta do cartão (MM/AA).');
        return;
      }
      if (cardCVV.trim().length < 3) {
        setErrorMessage('Informe o código de segurança (CVV) do cartão.');
        return;
      }
      if (!payerCPF.replace(/\D/g, '')) {
        setErrorMessage('Informe o CPF do titular do cartão.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const [mStr, yStr] = cardExpiry.split('/');
      const expMonth = mStr ? parseInt(mStr, 10) : undefined;
      let expYear = yStr ? parseInt(yStr, 10) : undefined;
      if (expYear && expYear < 100) expYear += 2000;

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
        payment_method: paymentMethod,
        payer_cpf: payerCPF.replace(/\D/g, ''),
        card_number: paymentMethod === 'credit_card' ? cardNumber.replace(/\D/g, '') : undefined,
        cardholder_name: paymentMethod === 'credit_card' ? cardholderName.trim().toUpperCase() : undefined,
        card_exp_month: paymentMethod === 'credit_card' ? expMonth : undefined,
        card_exp_year: paymentMethod === 'credit_card' ? expYear : undefined,
        card_cvv: paymentMethod === 'credit_card' ? cardCVV.trim() : undefined,
        installments: paymentMethod === 'credit_card' ? installments : 1,
      }, tenantSettings?.tenant_id, token);

      if (paymentMethod === 'credit_card' && shouldSaveCard && user?.id) {
        const cleanCard = cardNumber.replace(/\D/g, '');
        const last4 = cleanCard.slice(-4);
        const cardBrand = detectCardBrand(cleanCard);
        const newCardEntry: SavedCard = {
          id: `card_${Date.now()}`,
          cardNumber: cardNumber,
          cardNumberMasked: `•••• ${last4}`,
          cardholderName: cardholderName.trim().toUpperCase(),
          expiry: cardExpiry,
          cpf: payerCPF,
          brand: cardBrand,
        };
        const existing = savedCards.filter((c) => c.cardNumber.replace(/\D/g, '') !== cleanCard);
        const updatedCards = [newCardEntry, ...existing].slice(0, 5);
        setSavedCards(updatedCards);
        localStorage.setItem(`az3d_saved_cards_${user.id}`, JSON.stringify(updatedCards));
      }

      clearCart();
      setLastOrder(result.order);
      setActivePaymentResponse(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar pagamento');
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
              onOpenPaymentModal={(ord) => {
                setActivePaymentResponse({
                  message: 'Concluir Pagamento',
                  order: ord,
                  payment: {
                    provider: 'mercadopago',
                    payment_method: ord.payment_method,
                    pix_qr_code: ord.pix_qr_code,
                    pix_qr_code_base64: ord.pix_qr_code_base64,
                    pix_expiration: ord.pix_expiration,
                    status: ord.payment_status || 'pending',
                  },
                });
              }}
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

              {myOrders.length > 0 && (
                <OrdersList
                  orders={myOrders.slice(0, 3)}
                  compact
                  onOpenPaymentModal={(ord) => {
                    setActivePaymentResponse({
                      message: 'Concluir Pagamento',
                      order: ord,
                      payment: {
                        provider: 'mercadopago',
                        payment_method: ord.payment_method,
                        pix_qr_code: ord.pix_qr_code,
                        pix_qr_code_base64: ord.pix_qr_code_base64,
                        pix_expiration: ord.pix_expiration,
                        status: ord.payment_status || 'pending',
                      },
                    });
                  }}
                />
              )}
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
                    <div className="mt-4 pt-2">
                      <FreightCalculatorWidget
                        compact
                        tenantId={tenantSettings?.tenant_id}
                        selectedOptionCode={selectedFreight?.code}
                        onSelectOption={(opt) => setSelectedFreight(opt)}
                      />
                    </div>
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

                    {deliveryMethod === 'shipping' && (
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-white mb-2">Cálculo & Escolha do Frete</h3>
                          <FreightCalculatorWidget
                            compact
                            tenantId={tenantSettings?.tenant_id}
                            selectedOptionCode={selectedFreight?.code}
                            onSelectOption={(opt) => setSelectedFreight(opt)}
                          />
                        </div>

                        <div>
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
                        </div>
                      </section>
                    )}

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

                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">Forma de Pagamento</h3>
                        <p className="mt-0.5 text-xs text-slate-500">Checkout 100% transparente direto no nosso site.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('pix');
                            setErrorMessage(null);
                          }}
                          className={`flex min-h-20 flex-col justify-center rounded-2xl border p-3.5 text-left transition ${
                            paymentMethod === 'pix'
                              ? 'border-teal-400 bg-teal-950/30 text-white ring-1 ring-teal-400/50'
                              : 'border-chumbo-700 bg-chumbo-900/60 text-slate-300 hover:border-chumbo-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-sm text-teal-300">
                              <QrCode className="h-4 w-4" /> PIX
                            </span>
                            <span className="rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-bold text-teal-300">
                              Instantâneo
                            </span>
                          </div>
                          <span className="mt-1 text-[11px] text-slate-400">QR Code na tela</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('credit_card');
                            setErrorMessage(null);
                          }}
                          className={`flex min-h-20 flex-col justify-center rounded-2xl border p-3.5 text-left transition ${
                            paymentMethod === 'credit_card'
                              ? 'border-laser-400 bg-laser-950/30 text-white ring-1 ring-laser-400/50'
                              : 'border-chumbo-700 bg-chumbo-900/60 text-slate-300 hover:border-chumbo-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-sm text-laser-300">
                              <CreditCard className="h-4 w-4" /> Cartão
                            </span>
                            <span className="rounded-full bg-laser-500/20 px-1.5 py-0.5 text-[9px] font-bold text-laser-300">
                              Até 12x
                            </span>
                          </div>
                          <span className="mt-1 text-[11px] text-slate-400">Direto no site</span>
                        </button>
                      </div>

                      {paymentMethod === 'pix' && (
                        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/40 p-3.5 space-y-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-300">
                              CPF do Pagador <span className="text-[10px] text-slate-500">(exigido pelo Banco Central para o PIX)</span>
                            </span>
                            <input
                              type="text"
                              maxLength={14}
                              value={payerCPF}
                              onChange={(e) => setPayerCPF(formatCPF(e.target.value))}
                              placeholder="000.000.000-00"
                              className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-teal-400"
                            />
                          </label>
                          <div className="flex items-center gap-2 text-[11px] text-teal-300/90 bg-teal-950/40 border border-teal-500/20 rounded-xl p-2.5">
                            <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
                            <span>O QR Code PIX será gerado instantaneamente na sua tela com confirmação automática.</span>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'credit_card' && (
                        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/40 p-4 space-y-3.5">
                          {/* Saved Cards Selector for Logged In Customer */}
                          {isAuthenticated && savedCards.length > 0 && (
                            <div className="space-y-2 pb-2 border-b border-chumbo-800">
                              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Seus Cartões Salvos
                              </span>
                              <div className="grid grid-cols-1 gap-2">
                                {savedCards.map((card) => {
                                  const isSelected = selectedSavedCardId === card.id;
                                  return (
                                    <div
                                      key={card.id}
                                      onClick={() => handleSelectSavedCard(card.id)}
                                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                                        isSelected
                                          ? 'border-laser-400 bg-laser-950/40 text-white ring-1 ring-laser-400/60'
                                          : 'border-chumbo-750 bg-chumbo-950 text-slate-300 hover:border-chumbo-600'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <CreditCard className={`h-4 w-4 shrink-0 ${isSelected ? 'text-laser-400' : 'text-slate-500'}`} />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <strong className="text-xs font-mono font-bold text-white">{card.cardNumberMasked}</strong>
                                            <span className="rounded bg-chumbo-800 px-1.5 py-0.5 text-[9px] font-bold text-laser-300">
                                              {card.brand}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-slate-400 truncate block">
                                            {card.cardholderName} · Exp {card.expiry}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteSavedCard(card.id, e)}
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                                        title="Remover cartão salvo"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => handleSelectSavedCard('new')}
                                  className={`flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-bold transition ${
                                    selectedSavedCardId === 'new'
                                      ? 'border-laser-400 bg-laser-950/20 text-laser-300'
                                      : 'border-chumbo-750 text-slate-400 hover:border-chumbo-600 hover:text-white'
                                  }`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Usar outro cartão de crédito</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Full Form if entering new card */}
                          {selectedSavedCardId === 'new' ? (
                            <>
                              <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-300">
                                  Número do Cartão
                                </label>
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    maxLength={19}
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                    placeholder="0000 0000 0000 0000"
                                    className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 pr-10 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-laser-400"
                                  />
                                  <CreditCard className="absolute right-3 h-4 w-4 text-slate-500 pointer-events-none" />
                                </div>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-300">
                                  Nome Impresso no Cartão
                                </label>
                                <input
                                  type="text"
                                  value={cardholderName}
                                  onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                                  placeholder="NOME COMO NO CARTÃO"
                                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-bold uppercase text-white placeholder-slate-600 outline-none focus:border-laser-400"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                                    Validade (MM/AA)
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={5}
                                    value={cardExpiry}
                                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                                    placeholder="MM/AA"
                                    className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-mono text-center text-white placeholder-slate-600 outline-none focus:border-laser-400"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                                    CVV (Segurança)
                                  </label>
                                  <input
                                    type="password"
                                    maxLength={4}
                                    value={cardCVV}
                                    onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123"
                                    className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-mono text-center text-white placeholder-slate-600 outline-none focus:border-laser-400"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-300">
                                  CPF do Titular do Cartão
                                </label>
                                <input
                                  type="text"
                                  maxLength={14}
                                  value={payerCPF}
                                  onChange={(e) => setPayerCPF(formatCPF(e.target.value))}
                                  placeholder="000.000.000-00"
                                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-laser-400"
                                />
                              </div>

                              {isAuthenticated && (
                                <label className="flex items-center gap-2 cursor-pointer pt-1">
                                  <input
                                    type="checkbox"
                                    checked={shouldSaveCard}
                                    onChange={(e) => setShouldSaveCard(e.target.checked)}
                                    className="h-4 w-4 rounded border-chumbo-700 bg-chumbo-950 text-laser-400 focus:ring-laser-400"
                                  />
                                  <span className="text-xs text-slate-300 flex items-center gap-1">
                                    <BookmarkCheck className="h-3.5 w-3.5 text-laser-400" />
                                    Salvar este cartão para próximas compras
                                  </span>
                                </label>
                              )}
                            </>
                          ) : (
                            /* Simplified CVV input when using saved card */
                            <div className="space-y-3 pt-1">
                              <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-300">
                                  Confirmar Código de Segurança (CVV)
                                </label>
                                <div className="relative flex items-center max-w-[140px]">
                                  <input
                                    type="password"
                                    maxLength={4}
                                    autoFocus
                                    value={cardCVV}
                                    onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123"
                                    className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-mono text-center text-white placeholder-slate-600 outline-none focus:border-laser-400"
                                  />
                                  <Lock className="absolute right-3 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                  Digite os 3 dígitos do verso do seu cartão salvo.
                                </span>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-300">
                              Opções de Parcelamento
                            </label>
                            <select
                              value={installments}
                              onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
                              className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-laser-400"
                            >
                              {installmentOptions.map((opt) => (
                                <option key={opt.times} value={opt.times}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-chumbo-950 border border-chumbo-800/80 rounded-xl p-2.5">
                            <Lock className="h-3.5 w-3.5 text-laser-400 shrink-0" />
                            <span>Criptografia 256-bit ponta a ponta. Pagamento processado de forma 100% segura diretamente no nosso site.</span>
                          </div>
                        </div>
                      )}
                    </section>

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
                <footer className="border-t border-chumbo-850 bg-chumbo-900/90 px-5 py-5 sm:px-7 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Subtotal produtos</span>
                    <span className="font-mono font-semibold text-white">{money(totalPrice)}</span>
                  </div>
                  {deliveryMethod === 'shipping' && (
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Frete ({selectedFreight?.name || 'A definir'})</span>
                      <span className="font-mono font-bold text-laser-400">
                        {selectedFreight ? money(selectedFreight.price) : 'Grátis / A calcular'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-chumbo-800">
                    <span className="text-sm font-bold text-slate-200">Total do pedido</span>
                    <span className="text-2xl font-extrabold text-white">{money(cartGrandTotal)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isSubmitting || (!canShip && !canPickup)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-laser-400 to-emerald-400 py-3.5 text-sm font-extrabold text-chumbo-950 shadow-xl shadow-laser-500/10 transition-all hover:from-laser-300 hover:to-emerald-300 disabled:opacity-50"
                  >
                    <span>
                      {isSubmitting
                        ? 'Processando pagamento...'
                        : paymentMethod === 'pix'
                          ? `Gerar PIX e Pagar (${money(cartGrandTotal)})`
                          : `Pagar com Cartão (${money(cartGrandTotal)})`}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">
                    Processado com segurança via Checkout Transparente.
                  </p>
                </footer>
              )}
            </>
          )}
        </section>
      </div>

      {/* Modal de Pagamento Transparente */}
      {activePaymentResponse && (
        <TransparentPaymentModal
          orderResponse={activePaymentResponse}
          tenantId={tenantSettings?.tenant_id || activePaymentResponse.order?.tenant_id}
          token={token || undefined}
          onClose={() => {
            setActivePaymentResponse(null);
            setIsCartOpen(false);
          }}
          onPaymentSuccess={(updatedOrder) => {
            setLastOrder(updatedOrder);
            setOrderSuccess('Pagamento aprovado com sucesso!');
          }}
        />
      )}
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
  onOpenPaymentModal,
}: {
  orders: Order[];
  isLoading: boolean;
  errorMessage: string | null;
  onReload: () => void;
  onOpenLogin: () => void;
  isAuthenticated: boolean;
  onOpenPaymentModal?: (order: Order) => void;
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
          <OrdersList
            orders={orders}
            onOpenPaymentModal={onOpenPaymentModal}
          />
        )}
      </div>
    )}
  </div>
);

const OrdersList = ({
  orders,
  compact = false,
  onOpenPaymentModal,
}: {
  orders: Order[];
  compact?: boolean;
  onOpenPaymentModal?: (order: Order) => void;
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(compact ? null : orders[0]?.id ?? null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  const copyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTrackingId(code);
    setTimeout(() => setCopiedTrackingId(null), 2500);
  };

  const getTrackingUrl = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(clean)) {
      return `https://rastreamento.correios.com.br/app/index.php?codigo=${clean}`;
    }
    return `https://www.google.com/search?q=rastreio+${encodeURIComponent(clean)}`;
  };

  const formatPaymentMethodLabel = (method?: string) => {
    const m = (method || '').toLowerCase();
    if (m === 'pix') return 'PIX Instantâneo';
    if (m === 'credit_card' || m === 'card' || m === 'cartao') return 'Cartão de Crédito';
    return method || 'Mercado Pago';
  };

  const formatPaymentStatusLabel = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'paid') return 'Pago / Aprovado';
    if (s === 'pending') return 'Aguardando Pagamento';
    if (s === 'rejected') return 'Recusado';
    if (s === 'cancelled') return 'Cancelado';
    if (s === 'refunded') return 'Reembolsado';
    return status || 'Pendente';
  };

  return (
    <div className="space-y-3 text-left">
      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.id;
        const latestShipment = order.shipments?.[0];
        const latestEvent = latestShipment?.events?.[0];
        const isPixPending = (order.payment_method === 'pix' || !!order.pix_qr_code) &&
          order.payment_status !== 'approved' &&
          order.payment_status !== 'paid' &&
          order.status !== 'confirmed' &&
          order.status !== 'paid';

        return (
          <div
            key={order.id}
            className="rounded-2xl border border-chumbo-800 bg-chumbo-900/80 p-4 transition-all hover:border-chumbo-750"
          >
            {/* Header do Pedido */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Pedido #{order.id}</span>
                  {order.delivery_method === 'pickup' ? (
                    <span className="rounded-full bg-chumbo-800 border border-chumbo-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      Retirada
                    </span>
                  ) : (
                    <span className="rounded-full bg-laser-500/10 border border-laser-500/30 px-2 py-0.5 text-[10px] font-semibold text-laser-300">
                      Entrega
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {new Date(order.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <span className="text-sm font-extrabold text-white">{money(order.total_amount)}</span>
            </div>

            {/* Status Pills */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <StatusPill
                label={ORDER_STATUS_LABELS[order.status] || order.status}
                tone={
                  order.status === 'cancelled'
                    ? 'danger'
                    : order.status === 'delivered' || order.status === 'paid' || order.status === 'confirmed'
                      ? 'success'
                      : 'warning'
                }
              />
              <StatusPill
                label={formatPaymentStatusLabel(order.payment_status)}
                tone={
                  order.payment_status === 'approved' || order.payment_status === 'paid'
                    ? 'success'
                    : order.payment_status === 'rejected' || order.payment_status === 'cancelled'
                      ? 'danger'
                      : 'warning'
                }
              />
            </div>

            {/* Ação rápida para pagar PIX pendente */}
            {isPixPending && onOpenPaymentModal && (
              <button
                type="button"
                onClick={() => onOpenPaymentModal(order)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500/20 border border-teal-500/40 py-2 text-xs font-bold text-teal-300 hover:bg-teal-500/30 transition"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Pagar PIX / Abrir QR Code</span>
              </button>
            )}

            {/* Botão de Averiguar / Expandir Resumo da Compra */}
            {!compact && (
              <div className="mt-3 pt-2 border-t border-chumbo-800/80">
                <button
                  type="button"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="flex w-full items-center justify-between py-1 text-xs font-semibold text-laser-400 hover:text-laser-300 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {isExpanded ? 'Ocultar detalhes da compra' : 'Averiguar resumo e rastreio da compra'}
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {/* Conteúdo Expandido com Resumo Completo e Rastreio */}
                {isExpanded && (
                  <div className="mt-3 space-y-3.5 pt-2 text-xs animate-fade-in">
                    {/* Itens do Pedido */}
                    {order.items && order.items.length > 0 && (
                      <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3 space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Itens do Pedido ({order.items.length})
                        </span>
                        <div className="divide-y divide-chumbo-850">
                          {order.items.map((item) => {
                            const colorImg = item.product?.color_images?.find(
                              (img) => img.color_name === item.color
                            )?.image_url;
                            const imgSrc = colorImg || item.product?.image_url;

                            return (
                              <div key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                                {imgSrc && (
                                  <img
                                    src={imgSrc}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-lg object-cover border border-chumbo-800"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <h5 className="truncate font-semibold text-white text-xs">
                                    {item.product?.title || `Produto #${item.product_id}`}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1 text-slate-300">
                                      <Layers className="h-3 w-3 text-laser-400" />
                                      {item.color}
                                    </span>
                                    <span>·</span>
                                    <span>Qtd: {item.quantity}</span>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-xs text-slate-200">
                                  {money(item.unit_price * item.quantity)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Informações de Entrega & Rastreio */}
                    <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3 space-y-2.5">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Entrega & Rastreamento
                      </span>

                      <div className="space-y-1.5 text-slate-300 text-xs">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-laser-400 shrink-0 mt-0.5" />
                          <div>
                            <strong>
                              {order.delivery_method === 'pickup' ? 'Retirada no Balcão' : 'Entrega no Endereço'}
                            </strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                              {order.recipient_name && <span>{order.recipient_name} · </span>}
                              {order.recipient_phone && <span>{order.recipient_phone}</span>}
                            </p>
                            {order.delivery_method !== 'pickup' && order.shipping_address && (
                              <p className="text-slate-400 text-[11px] mt-0.5">
                                {order.shipping_address}
                                {order.city ? `, ${order.city} - ${order.state || ''}` : ''}
                                {order.zip_code ? ` (CEP: ${order.zip_code})` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Caixa de Rastreio com Código e Link */}
                      {latestShipment ? (
                        <div className="rounded-xl border border-laser-500/20 bg-laser-950/10 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-laser-400" />
                              <span className="font-mono font-bold text-xs text-white">
                                {latestShipment.tracking_code}
                              </span>
                            </div>
                            <span className="rounded bg-laser-500/20 px-2 py-0.5 text-[10px] font-bold text-laser-300 uppercase">
                              {latestShipment.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => copyTracking(latestShipment.tracking_code)}
                              className="inline-flex items-center gap-1 rounded-lg border border-chumbo-700 bg-chumbo-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-chumbo-800 transition"
                            >
                              {copiedTrackingId === latestShipment.tracking_code ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar código</span>
                                </>
                              )}
                            </button>

                            <a
                              href={getTrackingUrl(latestShipment.tracking_code)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-laser-500/20 border border-laser-500/40 px-2.5 py-1 text-[11px] font-bold text-laser-300 hover:bg-laser-500/30 transition"
                            >
                              <span>Rastrear no site</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          {latestEvent && (
                            <div className="mt-2 pt-2 border-t border-laser-500/10 text-[11px] text-slate-400">
                              <p className="font-semibold text-slate-200">{latestEvent.description}</p>
                              {latestEvent.location && <p className="text-slate-500">{latestEvent.location}</p>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl border border-chumbo-800 bg-chumbo-900/40 p-2.5 text-xs text-slate-500">
                          <Truck className="h-3.5 w-3.5 text-slate-600" />
                          <span>
                            {order.delivery_method === 'pickup'
                              ? 'Pronto para retirada assim que a impressão for finalizada.'
                              : 'O código de rastreamento será informado aqui assim que o pacote for postado.'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Resumo Financeiro e Forma de Pagamento */}
                    <div className="rounded-xl border border-chumbo-800 bg-chumbo-950/60 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Forma de Pagamento:</span>
                        <span className="font-semibold text-white">
                          {formatPaymentMethodLabel(order.payment_method)}
                        </span>
                      </div>
                      {order.paid_at && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pago em:</span>
                          <span className="text-slate-300">
                            {new Date(order.paid_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                      {order.payment_id && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">ID da Transação:</span>
                          <span className="font-mono text-slate-400 text-[11px]">#{order.payment_id}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-chumbo-800 font-bold">
                        <span className="text-slate-300">Total Pago:</span>
                        <span className="text-laser-400 font-mono">{money(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const StatusPill = ({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' }) => {
  const classes = tone === 'success'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : tone === 'danger'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return <span className={`rounded-full border px-2 py-1 text-center font-bold ${classes}`}>{label}</span>;
};
