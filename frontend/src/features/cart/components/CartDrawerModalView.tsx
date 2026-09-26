import React from 'react';
import { AlertCircle, CheckCircle2, ReceiptText } from 'lucide-react';
import { Order, ValidateCouponResponse } from '../../../types';
import { money } from '../../../shared/storePresentation';
import { CartDrawerHeader } from './CartDrawerHeader';
import { CartEmptyState } from './CartEmptyState';
import { CartItemWithPricing } from './CartItemCard';
import { CartItemList } from './CartItemList';
import { CartDeliveryStep } from './CartDeliveryStep';
import { CartPaymentMethodStep, SavedCard } from './CartPaymentMethodStep';
import { CartPriceSummary } from './CartPriceSummary';
import { CartOrdersPanel, OrdersList } from './CartOrdersPanel';

export interface CartDrawerModalViewProps {
  isCartOpen: boolean;
  title: string;
  subtitle: string;
  isSubPage: boolean;
  drawerMode: 'cart' | 'orders';
  checkoutStep: 'items' | 'delivery';
  errorMessage: string | null;
  orderSuccess: string | null;
  lastOrder: Order | null;
  cartItems: CartItemWithPricing[];
  tenantId?: number;
  selectedFreightCode?: string;
  selectedFreight: { name: string; price: number } | null;
  deliveryMethod: 'shipping' | 'pickup';
  deliveryOptions: { value: 'shipping' | 'pickup'; label: string; enabled: boolean }[];
  zipCode: string;
  city: string;
  state: string;
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  notes: string;
  paymentMethod: 'pix' | 'credit_card';
  payerCPF: string;
  isAuthenticated: boolean;
  savedCards: SavedCard[];
  selectedSavedCardId: string;
  cardNumber: string;
  cardholderName: string;
  cardExpiry: string;
  cardCVV: string;
  shouldSaveCard: boolean;
  installments: number;
  installmentOptions: { times: number; label: string }[];
  couponInput: string;
  appliedCoupon: ValidateCouponResponse | null;
  couponLoading: boolean;
  couponMessage: { type: 'success' | 'error'; text: string } | null;
  rawSubtotal: number;
  totalWholesaleDiscount: number;
  couponProductDiscount: number;
  couponShippingDiscount: number;
  freightAmount: number;
  finalFreight: number;
  cartGrandTotal: number;
  totalDiscountAll: number;
  totalItems: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  myOrders: Order[];
  isLoadingOrders: boolean;
  onClose: () => void;
  onBack: () => void;
  onUpdateQuantity: (productId: number, color: string, qty: number) => void;
  onRemoveItem: (productId: number, color: string) => void;
  onSelectFreight: (option: any) => void;
  onSelectDeliveryMethod: (method: 'shipping' | 'pickup') => void;
  onZipCodeChange: (val: string) => void;
  onCityChange: (val: string) => void;
  onStateChange: (val: string) => void;
  onShippingAddressChange: (val: string) => void;
  onRecipientNameChange: (val: string) => void;
  onRecipientPhoneChange: (val: string) => void;
  onNotesChange: (val: string) => void;
  onSelectPaymentMethod: (method: 'pix' | 'credit_card') => void;
  onPayerCPFChange: (val: string) => void;
  onSelectSavedCard: (id: string) => void;
  onDeleteSavedCard: (id: string, e: React.MouseEvent) => void;
  onCardNumberChange: (val: string) => void;
  onCardholderNameChange: (val: string) => void;
  onCardExpiryChange: (val: string) => void;
  onCardCVVChange: (val: string) => void;
  onShouldSaveCardChange: (val: boolean) => void;
  onInstallmentsChange: (val: number) => void;
  onCouponInputChange: (val: string) => void;
  onApplyCoupon: (e?: React.FormEvent) => void;
  onRemoveCoupon: () => void;
  onContinueToDelivery: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
  onReloadOrders: () => void;
  onOpenLogin: () => void;
  onOpenPaymentModal?: (order: Order) => void;
  onViewOrders: () => void;
  onResetOrderSuccess: () => void;
}

export const CartDrawerModalView: React.FC<CartDrawerModalViewProps> = ({
  isCartOpen,
  title,
  subtitle,
  isSubPage,
  drawerMode,
  checkoutStep,
  errorMessage,
  orderSuccess,
  lastOrder,
  cartItems,
  tenantId,
  selectedFreightCode,
  selectedFreight,
  deliveryMethod,
  deliveryOptions,
  zipCode,
  city,
  state,
  shippingAddress,
  recipientName,
  recipientPhone,
  notes,
  paymentMethod,
  payerCPF,
  isAuthenticated,
  savedCards,
  selectedSavedCardId,
  cardNumber,
  cardholderName,
  cardExpiry,
  cardCVV,
  shouldSaveCard,
  installments,
  installmentOptions,
  couponInput,
  appliedCoupon,
  couponLoading,
  couponMessage,
  rawSubtotal,
  totalWholesaleDiscount,
  couponProductDiscount,
  couponShippingDiscount,
  freightAmount,
  finalFreight,
  cartGrandTotal,
  totalDiscountAll,
  totalItems,
  canSubmit,
  isSubmitting,
  myOrders,
  isLoadingOrders,
  onClose,
  onBack,
  onUpdateQuantity,
  onRemoveItem,
  onSelectFreight,
  onSelectDeliveryMethod,
  onZipCodeChange,
  onCityChange,
  onStateChange,
  onShippingAddressChange,
  onRecipientNameChange,
  onRecipientPhoneChange,
  onNotesChange,
  onSelectPaymentMethod,
  onPayerCPFChange,
  onSelectSavedCard,
  onDeleteSavedCard,
  onCardNumberChange,
  onCardholderNameChange,
  onCardExpiryChange,
  onCardCVVChange,
  onShouldSaveCardChange,
  onInstallmentsChange,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  onContinueToDelivery,
  onCheckout,
  onContinueShopping,
  onReloadOrders,
  onOpenLogin,
  onOpenPaymentModal,
  onViewOrders,
  onResetOrderSuccess,
}) => {
  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="relative flex w-full max-w-2xl max-h-[92vh] flex-col rounded-3xl border border-chumbo-700/70 bg-chumbo-950 shadow-2xl overflow-hidden z-10 my-auto"
      >
        <CartDrawerHeader
          title={title}
          subtitle={subtitle}
          isSubPage={isSubPage}
          onBack={onBack}
          onClose={onClose}
        />

        {drawerMode === 'orders' ? (
          <CartOrdersPanel
            orders={myOrders}
            isLoading={isLoadingOrders}
            errorMessage={errorMessage}
            onReload={onReloadOrders}
            onOpenLogin={onOpenLogin}
            isAuthenticated={isAuthenticated}
            onOpenPaymentModal={onOpenPaymentModal}
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
                <p className="mt-2 text-sm font-mono text-slate-100">
                  Pedido #{lastOrder.id} · {money(lastOrder.total_amount)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onViewOrders}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-chumbo-700 bg-chumbo-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-chumbo-800"
              >
                <ReceiptText className="h-4 w-4" />
                Meus pedidos
              </button>
              <button
                type="button"
                onClick={onResetOrderSuccess}
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-chumbo-950 hover:bg-slate-200"
              >
                Voltar à loja
              </button>
            </div>

            {myOrders.length > 0 && (
              <OrdersList
                orders={myOrders.slice(0, 3)}
                compact
                onOpenPaymentModal={onOpenPaymentModal}
              />
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3.5 py-4 sm:px-7 sm:py-6">
              {errorMessage && (
                <div
                  className="mb-5 flex items-center gap-2 rounded-xl border border-red-800/80 bg-red-950/60 p-3.5 text-xs text-red-200"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {cartItems.length === 0 ? (
                <CartEmptyState onClose={onClose} />
              ) : checkoutStep === 'items' ? (
                <CartItemList
                  items={cartItems}
                  tenantId={tenantId}
                  selectedFreightCode={selectedFreightCode}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemoveItem={onRemoveItem}
                  onSelectFreight={onSelectFreight}
                />
              ) : (
                <div className="space-y-7">
                  <CartDeliveryStep
                    deliveryMethod={deliveryMethod}
                    deliveryOptions={deliveryOptions}
                    onSelectDeliveryMethod={onSelectDeliveryMethod}
                    tenantId={tenantId}
                    selectedFreightCode={selectedFreightCode}
                    onSelectFreight={onSelectFreight}
                    zipCode={zipCode}
                    city={city}
                    state={state}
                    shippingAddress={shippingAddress}
                    recipientName={recipientName}
                    recipientPhone={recipientPhone}
                    notes={notes}
                    onZipCodeChange={onZipCodeChange}
                    onCityChange={onCityChange}
                    onStateChange={onStateChange}
                    onShippingAddressChange={onShippingAddressChange}
                    onRecipientNameChange={onRecipientNameChange}
                    onRecipientPhoneChange={onRecipientPhoneChange}
                    onNotesChange={onNotesChange}
                  />

                  <CartPaymentMethodStep
                    paymentMethod={paymentMethod}
                    onSelectPaymentMethod={onSelectPaymentMethod}
                    payerCPF={payerCPF}
                    onPayerCPFChange={onPayerCPFChange}
                    isAuthenticated={isAuthenticated}
                    savedCards={savedCards}
                    selectedSavedCardId={selectedSavedCardId}
                    onSelectSavedCard={onSelectSavedCard}
                    onDeleteSavedCard={onDeleteSavedCard}
                    cardNumber={cardNumber}
                    onCardNumberChange={onCardNumberChange}
                    cardholderName={cardholderName}
                    onCardholderNameChange={onCardholderNameChange}
                    cardExpiry={cardExpiry}
                    onCardExpiryChange={onCardExpiryChange}
                    cardCVV={cardCVV}
                    onCardCVVChange={onCardCVVChange}
                    shouldSaveCard={shouldSaveCard}
                    onShouldSaveCardChange={onShouldSaveCardChange}
                    installments={installments}
                    installmentOptions={installmentOptions}
                    onInstallmentsChange={onInstallmentsChange}
                  />
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <CartPriceSummary
                checkoutStep={checkoutStep}
                totalItems={totalItems}
                rawSubtotal={rawSubtotal}
                totalWholesaleDiscount={totalWholesaleDiscount}
                couponProductDiscount={couponProductDiscount}
                couponShippingDiscount={couponShippingDiscount}
                freightAmount={freightAmount}
                finalFreight={finalFreight}
                cartGrandTotal={cartGrandTotal}
                totalDiscountAll={totalDiscountAll}
                selectedFreight={selectedFreight}
                deliveryMethod={deliveryMethod}
                canSubmit={canSubmit}
                isSubmitting={isSubmitting}
                paymentMethod={paymentMethod}
                appliedCoupon={appliedCoupon}
                couponInput={couponInput}
                couponLoading={couponLoading}
                couponMessage={couponMessage}
                onCouponInputChange={onCouponInputChange}
                onApplyCoupon={onApplyCoupon}
                onRemoveCoupon={onRemoveCoupon}
                onContinueToDelivery={onContinueToDelivery}
                onCheckout={onCheckout}
                onContinueShopping={onContinueShopping}
                isAuthenticated={isAuthenticated}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
};
