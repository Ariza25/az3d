import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CreateOrderResponse, Order, TenantSettings, ValidateCouponResponse } from '../../types';
import { getWholesaleDiscount } from '../../shared/storePresentation';
import {
  CartDrawerModalView,
  CartItemWithPricing,
  SavedCard,
  TransparentPaymentModal,
} from './components';

export interface CartDrawerProps {
  onOpenLogin: () => void;
  tenantSettings?: TenantSettings | null;
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

export const CartDrawerContainer: React.FC<CartDrawerProps> = ({ onOpenLogin, tenantSettings }) => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
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
  const [selectedFreight, setSelectedFreight] = useState<{
    code: string;
    name: string;
    price: number;
    deliveryDays: number;
  } | null>(null);

  // Cupom de Desconto
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<ValidateCouponResponse | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = couponInput.trim();
    if (!clean) return;
    setCouponLoading(true);
    setCouponMessage(null);
    try {
      const res = await api.validateCoupon(clean, 0, 0, tenantSettings?.tenant_id);
      if (res.valid && res.code) {
        setAppliedCoupon(res);
        setCouponMessage({ type: 'success', text: `Cupom ${res.code} aplicado (-${res.discount_percent || 0}%)!` });
      } else {
        setAppliedCoupon(null);
        setCouponMessage({ type: 'error', text: res.message || 'Cupom inválido ou expirado' });
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponMessage({ type: 'error', text: err.message || 'Erro ao validar cupom' });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMessage(null);
  };

  const cartCalculations = useMemo(() => {
    let rawSubtotal = 0;
    let totalWholesaleDiscount = 0;

    const itemsWithPricing: CartItemWithPricing[] = cart.map((item) => {
      const wholesale = getWholesaleDiscount(item.quantity);
      const discountedUnit =
        wholesale.percent > 0 ? wholesale.calculateUnitPrice(item.product.price) : item.product.price;
      const itemRaw = item.product.price * item.quantity;
      const itemFinal = discountedUnit * item.quantity;
      const itemDiscount = Math.round((itemRaw - itemFinal) * 100) / 100;

      rawSubtotal += itemRaw;
      totalWholesaleDiscount += itemDiscount;

      return {
        ...item,
        wholesale,
        discountedUnit,
        itemDiscount,
        itemFinal,
      };
    });

    const subtotalAfterWholesale = Math.round((rawSubtotal - totalWholesaleDiscount) * 100) / 100;
    const couponPercent = appliedCoupon?.discount_percent || 0;
    const couponProductDiscount = appliedCoupon
      ? Math.round(subtotalAfterWholesale * (couponPercent / 100) * 100) / 100
      : 0;

    const freightAmount = deliveryMethod === 'shipping' && selectedFreight ? selectedFreight.price : 0;
    const couponShippingDiscount =
      appliedCoupon?.applies_to_shipping && freightAmount > 0
        ? Math.round(freightAmount * (couponPercent / 100) * 100) / 100
        : 0;

    const finalFreight = Math.max(0, freightAmount - couponShippingDiscount);
    const cartGrandTotal =
      Math.round((Math.max(0, subtotalAfterWholesale - couponProductDiscount) + finalFreight) * 100) / 100;
    const totalDiscountAll =
      Math.round((totalWholesaleDiscount + couponProductDiscount + couponShippingDiscount) * 100) / 100;

    return {
      itemsWithPricing,
      rawSubtotal,
      totalWholesaleDiscount,
      subtotalAfterWholesale,
      couponProductDiscount,
      freightAmount,
      couponShippingDiscount,
      finalFreight,
      cartGrandTotal,
      totalDiscountAll,
    };
  }, [cart, appliedCoupon, deliveryMethod, selectedFreight]);

  const cartGrandTotal = cartCalculations.cartGrandTotal;

  const installmentOptions = useMemo(() => {
    const total = cartGrandTotal;
    const maxInstallments = Math.min(12, Math.max(1, Math.floor(total / 10)));
    const list = [];
    for (let i = 1; i <= Math.max(1, maxInstallments); i++) {
      const val = total / i;
      list.push({
        times: i,
        label: `${i}x de R$ ${val.toFixed(2).replace('.', ',')} ${i === 1 ? 'à vista' : 'sem juros'}`,
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
  const deliveryOptions = useMemo(
    () => [
      { value: 'shipping' as const, label: 'Entrega', enabled: canShip },
      { value: 'pickup' as const, label: 'Retirada', enabled: canPickup },
    ],
    [canShip, canPickup]
  );

  useEffect(() => {
    if (user?.id) {
      if (!recipientName && user.name) setRecipientName(user.name);
      if (!recipientPhone && user.phone) setRecipientPhone(user.phone);

      // Carregar endereço padrão
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
            setShippingAddress(
              `${defaultAddr.street}, ${defaultAddr.number}${
                defaultAddr.complement ? ` - ${defaultAddr.complement}` : ''
              }, ${defaultAddr.neighborhood}`
            );
          }
        }
      } catch {
        // ignore
      }

      // Carregar cartões salvos
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
      setErrorMessage(err.message || 'Não foi possível carregar seus pedidos.');
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

  const handleCheckout = async () => {
    if (!isAuthenticated || !token) {
      setIsCartOpen(false);
      onOpenLogin();
      return;
    }

    if (cart.length === 0) return;
    if (!canShip && !canPickup) {
      setErrorMessage('Esta loja ainda não configurou retirada ou entrega.');
      return;
    }
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setErrorMessage('Informe nome e telefone para continuar.');
      return;
    }
    if (
      deliveryMethod === 'shipping' &&
      (!shippingAddress.trim() || !zipCode.trim() || !city.trim() || !state.trim())
    ) {
      setErrorMessage('Informe endereço, CEP, cidade e UF para entrega.');
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

      const result = await api.createOrder(
        {
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
          coupon_code: appliedCoupon?.code,
          shipping_cost: cartCalculations.freightAmount,
          payment_method: paymentMethod,
          payer_cpf: payerCPF.replace(/\D/g, ''),
          card_number: paymentMethod === 'credit_card' ? cardNumber.replace(/\D/g, '') : undefined,
          cardholder_name: paymentMethod === 'credit_card' ? cardholderName.trim().toUpperCase() : undefined,
          card_exp_month: paymentMethod === 'credit_card' ? expMonth : undefined,
          card_exp_year: paymentMethod === 'credit_card' ? expYear : undefined,
          card_cvv: paymentMethod === 'credit_card' ? cardCVV.trim() : undefined,
          installments: paymentMethod === 'credit_card' ? installments : 1,
        },
        tenantSettings?.tenant_id,
        token
      );

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
      setAppliedCoupon(null);
      setCouponInput('');
      setCouponMessage(null);
      setLastOrder(result.order);
      setActivePaymentResponse(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar pagamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    drawerMode === 'orders'
      ? 'Meus pedidos'
      : checkoutStep === 'delivery'
      ? 'Entrega e contato'
      : 'Seu carrinho';

  const subtitle =
    drawerMode === 'orders'
      ? 'Acompanhe suas compras'
      : checkoutStep === 'delivery'
      ? 'Etapa 2 de 2'
      : `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;

  return (
    <>
      <CartDrawerModalView
        isCartOpen={isCartOpen}
        title={title}
        subtitle={subtitle}
        isSubPage={drawerMode === 'orders' || checkoutStep === 'delivery'}
        drawerMode={drawerMode}
        checkoutStep={checkoutStep}
        errorMessage={errorMessage}
        orderSuccess={orderSuccess}
        lastOrder={lastOrder}
        cartItems={cartCalculations.itemsWithPricing}
        tenantId={tenantSettings?.tenant_id}
        selectedFreightCode={selectedFreight?.code}
        selectedFreight={selectedFreight}
        deliveryMethod={deliveryMethod}
        deliveryOptions={deliveryOptions}
        zipCode={zipCode}
        city={city}
        state={state}
        shippingAddress={shippingAddress}
        recipientName={recipientName}
        recipientPhone={recipientPhone}
        notes={notes}
        paymentMethod={paymentMethod}
        payerCPF={payerCPF}
        isAuthenticated={isAuthenticated}
        savedCards={savedCards}
        selectedSavedCardId={selectedSavedCardId}
        cardNumber={cardNumber}
        cardholderName={cardholderName}
        cardExpiry={cardExpiry}
        cardCVV={cardCVV}
        shouldSaveCard={shouldSaveCard}
        installments={installments}
        installmentOptions={installmentOptions}
        couponInput={couponInput}
        appliedCoupon={appliedCoupon}
        couponLoading={couponLoading}
        couponMessage={couponMessage}
        rawSubtotal={cartCalculations.rawSubtotal}
        totalWholesaleDiscount={cartCalculations.totalWholesaleDiscount}
        couponProductDiscount={cartCalculations.couponProductDiscount}
        couponShippingDiscount={cartCalculations.couponShippingDiscount}
        freightAmount={cartCalculations.freightAmount}
        finalFreight={cartCalculations.finalFreight}
        cartGrandTotal={cartGrandTotal}
        totalDiscountAll={cartCalculations.totalDiscountAll}
        totalItems={totalItems}
        canSubmit={canShip || canPickup}
        isSubmitting={isSubmitting}
        myOrders={myOrders}
        isLoadingOrders={isLoadingOrders}
        onClose={closeDrawer}
        onBack={() => {
          if (drawerMode === 'orders') setDrawerMode('cart');
          else setCheckoutStep('items');
        }}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onSelectFreight={setSelectedFreight}
        onSelectDeliveryMethod={setDeliveryMethod}
        onZipCodeChange={setZipCode}
        onCityChange={setCity}
        onStateChange={setState}
        onShippingAddressChange={setShippingAddress}
        onRecipientNameChange={setRecipientName}
        onRecipientPhoneChange={setRecipientPhone}
        onNotesChange={setNotes}
        onSelectPaymentMethod={(method) => {
          setPaymentMethod(method);
          setErrorMessage(null);
        }}
        onPayerCPFChange={(val) => setPayerCPF(formatCPF(val))}
        onSelectSavedCard={handleSelectSavedCard}
        onDeleteSavedCard={handleDeleteSavedCard}
        onCardNumberChange={(val) => setCardNumber(formatCardNumber(val))}
        onCardholderNameChange={setCardholderName}
        onCardExpiryChange={(val) => setCardExpiry(formatExpiry(val))}
        onCardCVVChange={setCardCVV}
        onShouldSaveCardChange={setShouldSaveCard}
        onInstallmentsChange={setInstallments}
        onCouponInputChange={setCouponInput}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        onContinueToDelivery={continueToDelivery}
        onCheckout={handleCheckout}
        onContinueShopping={closeDrawer}
        onReloadOrders={loadMyOrders}
        onOpenLogin={() => {
          closeDrawer();
          onOpenLogin();
        }}
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
        onViewOrders={() => {
          setDrawerMode('orders');
          loadMyOrders();
        }}
        onResetOrderSuccess={() => {
          setOrderSuccess(null);
          setLastOrder(null);
          setMyOrders([]);
          closeDrawer();
        }}
      />

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
    </>
  );
};
