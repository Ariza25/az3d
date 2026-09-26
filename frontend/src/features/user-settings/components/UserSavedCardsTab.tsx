import React from 'react';
import {
  CreditCard,
  Plus,
  Star,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { SavedCreditCard } from '../../../types';
import { Button } from '../../../components/ui';

export interface UserSavedCardsTabProps {
  savedCards: SavedCreditCard[];
  isEditingCard: boolean;
  editingCardId: string | null;
  cardForm: {
    cardNumber: string;
    holder_name: string;
    expiry_month: string;
    expiry_year: string;
    cpf: string;
    is_default: boolean;
  };
  cardSuccessMsg: string | null;
  onOpenNewCard: () => void;
  onEditCard: (card: SavedCreditCard) => void;
  onCancelEdit: () => void;
  onSaveCard: () => void;
  onDeleteCard: (id: string) => void;
  onSetDefaultCard: (id: string) => void;
  onUpdateCardForm: (field: string, value: any) => void;
  formatCardNumber: (val: string) => string;
  formatCPF: (val: string) => string;
}

export const UserSavedCardsTab: React.FC<UserSavedCardsTabProps> = ({
  savedCards,
  isEditingCard,
  editingCardId,
  cardForm,
  cardSuccessMsg,
  onOpenNewCard,
  onEditCard,
  onCancelEdit,
  onSaveCard,
  onDeleteCard,
  onSetDefaultCard,
  onUpdateCardForm,
  formatCardNumber,
  formatCPF,
}) => {
  return (
    <div className="space-y-6">
      {cardSuccessMsg && (
        <div className="p-3 bg-emerald-700 text-white border border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs shadow-sm dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300 dark:shadow-none">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white dark:text-emerald-400" />
          <span>{cardSuccessMsg}</span>
        </div>
      )}

      {!isEditingCard ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Cartões Salvos</h3>
              <p className="text-xs text-slate-400">
                Cartões de preferência para compras com 1 clique de forma 100% segura
              </p>
            </div>
            <button
              onClick={onOpenNewCard}
              className="flex items-center gap-1.5 px-3 py-2 bg-laser-500 hover:bg-laser-400 text-chumbo-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Cartão</span>
            </button>
          </div>

          {savedCards.length === 0 ? (
            <div className="p-8 text-center bg-chumbo-800/30 border border-dashed border-chumbo-700 rounded-2xl">
              <CreditCard className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="text-sm font-bold text-slate-300">Nenhum cartão salvo</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Cadastre seu cartão preferencial para compras mais ágeis no checkout.
              </p>
              <button
                onClick={onOpenNewCard}
                className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-white rounded-xl text-xs font-bold border border-chumbo-600"
              >
                Cadastrar primeiro cartão
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedCards.map((card) => (
                <div
                  key={card.id}
                  className={`p-5 rounded-2xl border transition-all relative ${
                    card.is_default
                      ? 'bg-gradient-to-br from-chumbo-800 to-chumbo-900 border-laser-500/60 shadow-lg ring-1 ring-laser-500/30'
                      : 'bg-chumbo-800/40 border-chumbo-700/60 hover:border-chumbo-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-chumbo-950 text-white border border-chumbo-700">
                        {card.brand.toUpperCase()}
                      </span>
                      {card.is_default && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-laser-400 bg-laser-500/20 px-2 py-0.5 rounded-full border border-laser-500/40">
                          <Star className="w-3 h-3 fill-laser-400" />
                          Preferencial
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditCard(card)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-chumbo-700/50 transition-colors"
                        title="Editar cartão"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteCard(card.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title="Excluir cartão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-base font-mono font-bold tracking-widest text-white">
                      •••• •••• •••• {card.last_four}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="truncate max-w-[150px] font-medium text-slate-200 uppercase">
                        {card.holder_name}
                      </span>
                      <span className="font-mono">
                        Exp: {card.expiry_month}/{card.expiry_year}
                      </span>
                    </div>
                  </div>

                  {!card.is_default && (
                    <button
                      onClick={() => onSetDefaultCard(card.id)}
                      className="mt-4 w-full py-1.5 bg-chumbo-950 hover:bg-chumbo-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg border border-chumbo-700 transition-colors"
                    >
                      Definir como cartão preferencial
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-laser-500/5 border border-laser-500/20 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-laser-400 shrink-0" />
            <p className="text-xs text-slate-300">
              <strong className="text-white">Segurança Garantida:</strong> Seus dados de cartão são criptografados de ponta a ponta. O código CVV nunca é armazenado e é solicitado apenas para confirmação transacional.
            </p>
          </div>
        </div>
      ) : (
        /* Card Form (Add or Edit) */
        <div className="bg-chumbo-800/40 p-5 rounded-2xl border border-chumbo-700/70 space-y-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between border-b border-chumbo-700/50 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-laser-400" />
              <span>{editingCardId ? 'Editar Cartão' : 'Adicionar Cartão de Crédito'}</span>
            </h3>
            <button
              onClick={onCancelEdit}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>

          {!editingCardId && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Número do Cartão
              </label>
              <input
                type="text"
                value={cardForm.cardNumber}
                onChange={(e) => onUpdateCardForm('cardNumber', formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-sm text-white font-mono tracking-wider"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Nome Impresso no Cartão
            </label>
            <input
              type="text"
              value={cardForm.holder_name}
              onChange={(e) => onUpdateCardForm('holder_name', e.target.value.toUpperCase())}
              placeholder="COMO NO CARTÃO"
              className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Mês de Vencimento
              </label>
              <input
                type="text"
                value={cardForm.expiry_month}
                onChange={(e) =>
                  onUpdateCardForm(
                    'expiry_month',
                    e.target.value.replace(/\D/g, '').slice(0, 2)
                  )
                }
                placeholder="MM (ex: 08)"
                maxLength={2}
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Ano de Vencimento
              </label>
              <input
                type="text"
                value={cardForm.expiry_year}
                onChange={(e) =>
                  onUpdateCardForm(
                    'expiry_year',
                    e.target.value.replace(/\D/g, '').slice(0, 2)
                  )
                }
                placeholder="AA (ex: 29)"
                maxLength={2}
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white font-mono text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              CPF do Titular (Opcional)
            </label>
            <input
              type="text"
              value={cardForm.cpf}
              onChange={(e) => onUpdateCardForm('cpf', formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="default_card_check"
              checked={cardForm.is_default}
              onChange={(e) => onUpdateCardForm('is_default', e.target.checked)}
              className="rounded border-chumbo-700 bg-chumbo-950 text-laser-500 focus:ring-laser-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="default_card_check" className="text-xs text-slate-300 font-medium cursor-pointer">
              Definir como meu cartão preferencial para pagamentos
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-chumbo-700/50">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-slate-300 text-xs font-bold rounded-xl"
            >
              Cancelar
            </button>
            <Button
              onClick={onSaveCard}
              variant="laser"
              size="sm"
            >
              Salvar Cartão
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
