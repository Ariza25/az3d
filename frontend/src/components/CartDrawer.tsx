import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface CartDrawerProps {
  onOpenLogin: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOpenLogin }) => {
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setIsCartOpen(false);
      onOpenLogin();
      return;
    }

    if (cart.length === 0) return;
    if (deliveryMethod === 'shipping' && !shippingAddress.trim()) {
      setErrorMessage('Por favor, informe o endereço completo para entrega.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          color: item.color,
        })),
        shipping_address: shippingAddress,
        delivery_method: deliveryMethod,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        zip_code: zipCode,
        city,
        state,
        notes,
      };

      const result = await api.createOrder(payload);
      setOrderSuccess(result.message);
      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar pedido de impressão 3D');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-chumbo-950 border-l border-chumbo-800 shadow-2xl flex flex-col justify-between">
          
          {/* Cabeçalho do Drawer */}
          <div className="p-6 border-b border-chumbo-850 flex items-center justify-between bg-chumbo-900/60">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-chumbo-800 border border-chumbo-700 flex items-center justify-center text-white">
                <ShoppingBag className="w-5 h-5 text-laser-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Carrinho</h2>
                <p className="text-xs text-slate-400 font-mono">{totalItems} {totalItems === 1 ? 'item selecionado' : 'itens selecionados'}</p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-chumbo-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mensagem de Sucesso no Checkout */}
          {orderSuccess ? (
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white">Pedido registrado</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                {orderSuccess}
              </p>
              <button
                onClick={() => {
                  setOrderSuccess(null);
                  setIsCartOpen(false);
                }}
                className="mt-4 px-6 py-2.5 rounded-xl bg-white text-chumbo-950 font-bold text-sm"
              >
                Voltar à Loja
              </button>
            </div>
          ) : (
            <>
              {/* Lista de Itens */}
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
                    <p className="text-sm font-medium">Seu carrinho está vazio</p>
                    <p className="text-xs text-slate-600 max-w-xs">
                      Escolha produtos no catalogo e adicione ao carrinho.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={`${item.product.id}-${item.color}`}
                      className="glass-card p-3.5 rounded-2xl border border-chumbo-800 flex items-center space-x-3.5"
                    >
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
                        <p className="text-xs font-extrabold text-white mt-1">
                          R$ {(item.product.price * item.quantity).toFixed(2).replace('.', ',')}
                        </p>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex flex-col items-end space-y-2">
                        <button
                          onClick={() => removeFromCart(item.product.id, item.color)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center border border-chumbo-700 bg-chumbo-950 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.color, item.quantity - 1)}
                            className="px-2 py-0.5 text-slate-400 hover:text-white text-xs"
                          >
                            -
                          </button>
                          <span className="px-2 font-mono text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.color, item.quantity + 1)}
                            className="px-2 py-0.5 text-slate-400 hover:text-white text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>

              {/* Rodapé / Resumo Financeiro & Checkout */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-chumbo-850 bg-chumbo-900/80 space-y-4">
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setDeliveryMethod('shipping')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${deliveryMethod === 'shipping' ? 'border-laser-400 bg-laser-400/10 text-laser-300' : 'border-chumbo-700 text-slate-400'}`}>
                      Entrega
                    </button>
                    <button type="button" onClick={() => setDeliveryMethod('pickup')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${deliveryMethod === 'pickup' ? 'border-laser-400 bg-laser-400/10 text-laser-300' : 'border-chumbo-700 text-slate-400'}`}>
                      Retirada
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nome para entrega" className="bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white" />
                    <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="Telefone" className="bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white" />
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_70px] gap-2">
                    <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="CEP" className="bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white" />
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white" />
                    <input value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" className="bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white" />
                  </div>

                  {deliveryMethod === 'shipping' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-slate-400 block">
                        Endereco de Entrega
                      </label>
                      <input
                        type="text"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Rua, numero, bairro, complemento"
                        className="w-full bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white"
                      />
                    </div>
                  )}

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Observacoes para producao ou entrega"
                    className="w-full bg-chumbo-950 border border-chumbo-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white"
                  />

                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-slate-400">Total do Carrinho:</span>
                    <span className="text-xl font-extrabold text-white">
                      R$ {totalPrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-200 text-chumbo-950 font-extrabold text-sm transition-all shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Registrando pedido...' : isAuthenticated ? 'Finalizar pedido' : 'Entrar para concluir pedido'}</span>
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
