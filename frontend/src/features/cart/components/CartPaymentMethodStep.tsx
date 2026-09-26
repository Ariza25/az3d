import React from 'react';
import { BookmarkCheck, CreditCard, Lock, Plus, QrCode, ShieldCheck, Trash2 } from 'lucide-react';

export interface SavedCard {
  id: string;
  cardNumber: string;
  cardNumberMasked: string;
  cardholderName: string;
  expiry: string;
  cpf: string;
  brand: string;
}

interface CartPaymentMethodStepProps {
  paymentMethod: 'pix' | 'credit_card';
  onSelectPaymentMethod: (method: 'pix' | 'credit_card') => void;
  payerCPF: string;
  onPayerCPFChange: (val: string) => void;
  isAuthenticated: boolean;
  savedCards: SavedCard[];
  selectedSavedCardId: string;
  onSelectSavedCard: (id: string) => void;
  onDeleteSavedCard: (id: string, e: React.MouseEvent) => void;
  cardNumber: string;
  onCardNumberChange: (val: string) => void;
  cardholderName: string;
  onCardholderNameChange: (val: string) => void;
  cardExpiry: string;
  onCardExpiryChange: (val: string) => void;
  cardCVV: string;
  onCardCVVChange: (val: string) => void;
  shouldSaveCard: boolean;
  onShouldSaveCardChange: (val: boolean) => void;
  installments: number;
  installmentOptions: { times: number; label: string }[];
  onInstallmentsChange: (val: number) => void;
}

export const CartPaymentMethodStep: React.FC<CartPaymentMethodStepProps> = ({
  paymentMethod,
  onSelectPaymentMethod,
  payerCPF,
  onPayerCPFChange,
  isAuthenticated,
  savedCards,
  selectedSavedCardId,
  onSelectSavedCard,
  onDeleteSavedCard,
  cardNumber,
  onCardNumberChange,
  cardholderName,
  onCardholderNameChange,
  cardExpiry,
  onCardExpiryChange,
  cardCVV,
  onCardCVVChange,
  shouldSaveCard,
  onShouldSaveCardChange,
  installments,
  installmentOptions,
  onInstallmentsChange,
}) => {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-white">Forma de Pagamento</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Checkout 100% transparente direto no nosso site.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onSelectPaymentMethod('pix')}
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
          onClick={() => onSelectPaymentMethod('credit_card')}
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
              CPF do Pagador{' '}
              <span className="text-[10px] text-slate-500">(exigido pelo Banco Central para o PIX)</span>
            </span>
            <input
              type="text"
              maxLength={14}
              value={payerCPF}
              onChange={(e) => onPayerCPFChange(e.target.value)}
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
          {/* Cartões Salvos */}
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
                      onClick={() => onSelectSavedCard(card.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                        isSelected
                          ? 'border-laser-400 bg-laser-950/40 text-white ring-1 ring-laser-400/60'
                          : 'border-chumbo-750 bg-chumbo-950 text-slate-300 hover:border-chumbo-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CreditCard
                          className={`h-4 w-4 shrink-0 ${
                            isSelected ? 'text-laser-400' : 'text-slate-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-xs font-mono font-bold text-white">
                              {card.cardNumberMasked}
                            </strong>
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
                        onClick={(e) => onDeleteSavedCard(card.id, e)}
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
                  onClick={() => onSelectSavedCard('new')}
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

          {/* Formulário completo para novo cartão */}
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
                    onChange={(e) => onCardNumberChange(e.target.value)}
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
                  onChange={(e) => onCardholderNameChange(e.target.value.toUpperCase())}
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
                    onChange={(e) => onCardExpiryChange(e.target.value)}
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
                    onChange={(e) => onCardCVVChange(e.target.value)}
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
                  onChange={(e) => onPayerCPFChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border border-chumbo-700 bg-chumbo-950 px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-laser-400"
                />
              </div>

              {isAuthenticated && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={shouldSaveCard}
                    onChange={(e) => onShouldSaveCardChange(e.target.checked)}
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
            /* CVV simplificado para cartão salvo */
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
                    onChange={(e) => onCardCVVChange(e.target.value)}
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
              onChange={(e) => onInstallmentsChange(parseInt(e.target.value, 10))}
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
            <span>
              Criptografia 256-bit ponta a ponta. Pagamento processado de forma 100% segura diretamente no nosso site.
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
