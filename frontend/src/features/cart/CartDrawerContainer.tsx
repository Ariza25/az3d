import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CreateOrderResponse, Order, TenantSettings } from '../../types';
import {
  CartDrawerModalView,
  TransparentPaymentModal,
} from './components';
import {
  formatCardNumber,
  formatExpiry,
  formatCPF,
} from './utils/cartFormatting';
import {
  useCartCalculations,
  useSavedCards,
  useCartCoupon,
} from './hooks';

export interface CartDrawerProps {
  onOpenLogin: () => void;
  tenantSettings?: TenantSettings | null;
}

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
  const [installments, setInstallments] = useState(1);
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

  // Modular Hooks
  const {
    couponInput,
    setCouponInput,
    appliedCoupon,
    couponLoading,
    couponMessage,
    handleApplyCoupon,
    handleRemoveCoupon,
    resetCoupon,
  } = useCartCoupon(tenantSettings?.tenant_id);

  const {
    cartCalculations,
    cartGrandTotal,
    installmentOptions,
  } = useCartCalculations({
    cart,
    appliedCoupon,
    deliveryMethod,
    selectedFreight,
  });

  const {
    savedCards,
    selectedSavedCardId,
    cardNumber,
    setCardNumber,
    cardholderName,
    setCardholderName,
    cardExpiry,
    setCardExpiry,
    cardCVV,
    setCardCVV,
    payerCPF,
    setPayerCPF,
    shouldSaveCard,
    setShouldSaveCard,
    handleSelectSavedCard,
    handleDeleteSavedCard,
    persistCardIfRequested,
  } = useSavedCards(user);

  const canShip = tenantSettings?.delivery_ship_enabled ?? true;
  const canPickup = tenantSettings?.delivery_pickup_enabled ?? true;
  const deliveryOptions = useMemo(
    () => [
      { value: 'shipping' as const, label: 'Entrega', enabled: canShip },
      { value: 'pickup' as const, label: 'Retirada', enabled: canPickup },
    ],
    [canShip, canPickup]
  );

  // Carregar dados de endereço padrão do perfil
  useEffect(() => {
    if (user?.id) {
      if (!recipientName && user.name) setRecipientName(user.name);
      if (!recipientPhone && user.phone) setRecipientPhone(user.phone);

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
    }
  }, [user]);

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

      if (paymentMethod === 'credit_card') {
        persistCardIfRequested();
      }

      clearCart();
      resetCoupon();
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
