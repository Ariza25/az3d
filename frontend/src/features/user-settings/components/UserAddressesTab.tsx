import React from 'react';
import {
  MapPin,
  Plus,
  Star,
  Edit2,
  Trash2,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { UserAddress } from '../../../types';
import { Button } from '../../../components/ui';

export interface UserAddressesTabProps {
  addresses: UserAddress[];
  isEditingAddress: boolean;
  editingAddressId: string | null;
  addressForm: Omit<UserAddress, 'id'>;
  addressSuccessMsg: string | null;
  onOpenNewAddress: () => void;
  onEditAddress: (addr: UserAddress) => void;
  onCancelEdit: () => void;
  onSaveAddress: () => void;
  onDeleteAddress: (id: string) => void;
  onSetDefaultAddress: (id: string) => void;
  onUpdateAddressForm: (field: keyof Omit<UserAddress, 'id'>, value: any) => void;
  formatCEP: (val: string) => string;
}

export const UserAddressesTab: React.FC<UserAddressesTabProps> = ({
  addresses,
  isEditingAddress,
  editingAddressId,
  addressForm,
  addressSuccessMsg,
  onOpenNewAddress,
  onEditAddress,
  onCancelEdit,
  onSaveAddress,
  onDeleteAddress,
  onSetDefaultAddress,
  onUpdateAddressForm,
  formatCEP,
}) => {
  return (
    <div className="space-y-6">
      {addressSuccessMsg && (
        <div className="p-3 bg-emerald-700 text-white border border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs shadow-sm dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300 dark:shadow-none">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white dark:text-emerald-400" />
          <span>{addressSuccessMsg}</span>
        </div>
      )}

      {!isEditingAddress ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Meus Endereços</h3>
              <p className="text-xs text-slate-400">
                Endereços salvos para cálculo de frete e entregas rápidas
              </p>
            </div>
            <button
              onClick={onOpenNewAddress}
              className="flex items-center gap-1.5 px-3 py-2 bg-laser-500 hover:bg-laser-400 text-chumbo-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Endereço</span>
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="p-8 text-center bg-chumbo-800/30 border border-dashed border-chumbo-700 rounded-2xl">
              <MapPin className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="text-sm font-bold text-slate-300">Nenhum endereço cadastrado</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Adicione um endereço de entrega para agilizar suas compras.
              </p>
              <button
                onClick={onOpenNewAddress}
                className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-white rounded-xl text-xs font-bold border border-chumbo-600"
              >
                Cadastrar primeiro endereço
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-2xl border transition-all relative ${
                    addr.is_default
                      ? 'bg-chumbo-800/60 border-laser-500/50 shadow-md ring-1 ring-laser-500/30'
                      : 'bg-chumbo-800/30 border-chumbo-700/60 hover:border-chumbo-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-white bg-chumbo-900 px-2.5 py-1 rounded-lg border border-chumbo-700">
                        {addr.label || 'Endereço'}
                      </span>
                      {addr.is_default && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-laser-400 bg-laser-500/20 px-2 py-0.5 rounded-full border border-laser-500/40">
                          <Star className="w-3 h-3 fill-laser-400" />
                          Padrão
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditAddress(addr)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-chumbo-700/50 transition-colors"
                        title="Editar endereço"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteAddress(addr.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title="Excluir endereço"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {addr.street}, {addr.number}
                    {addr.complement ? ` - ${addr.complement}` : ''}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {addr.neighborhood} - {addr.city}/{addr.state}
                  </p>
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    CEP: {addr.cep}
                  </p>
                  {addr.recipient && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Destinatário: {addr.recipient}
                    </p>
                  )}

                  {!addr.is_default && (
                    <button
                      onClick={() => onSetDefaultAddress(addr.id)}
                      className="mt-3 w-full py-1.5 bg-chumbo-900 hover:bg-chumbo-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg border border-chumbo-700 transition-colors"
                    >
                      Definir como endereço padrão
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Address Form (Add or Edit) */
        <div className="bg-chumbo-800/40 p-5 rounded-2xl border border-chumbo-700/70 space-y-4">
          <div className="flex items-center justify-between border-b border-chumbo-700/50 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-laser-400" />
              <span>{editingAddressId ? 'Editar Endereço' : 'Adicionar Novo Endereço'}</span>
            </h3>
            <button
              onClick={onCancelEdit}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Identificação (Rótulo)
              </label>
              <input
                type="text"
                value={addressForm.label}
                onChange={(e) => onUpdateAddressForm('label', e.target.value)}
                placeholder="Ex: Casa, Trabalho, Galpão"
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Destinatário
              </label>
              <input
                type="text"
                value={addressForm.recipient}
                onChange={(e) => onUpdateAddressForm('recipient', e.target.value)}
                placeholder="Nome de quem vai receber"
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                CEP
              </label>
              <input
                type="text"
                value={addressForm.cep}
                onChange={(e) => onUpdateAddressForm('cep', formatCEP(e.target.value))}
                placeholder="00000-000"
                maxLength={9}
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Logradouro / Rua
              </label>
              <input
                type="text"
                value={addressForm.street}
                onChange={(e) => onUpdateAddressForm('street', e.target.value)}
                placeholder="Avenida, Rua, Alameda..."
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Número
              </label>
              <input
                type="text"
                value={addressForm.number}
                onChange={(e) => onUpdateAddressForm('number', e.target.value)}
                placeholder="123"
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Complemento / Apto
              </label>
              <input
                type="text"
                value={addressForm.complement}
                onChange={(e) => onUpdateAddressForm('complement', e.target.value)}
                placeholder="Bloco B, Apto 402"
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={addressForm.neighborhood}
                onChange={(e) => onUpdateAddressForm('neighborhood', e.target.value)}
                placeholder="Bairro"
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={addressForm.city}
                onChange={(e) => onUpdateAddressForm('city', e.target.value)}
                placeholder="Cidade"
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                UF (Estado)
              </label>
              <input
                type="text"
                value={addressForm.state}
                onChange={(e) => onUpdateAddressForm('state', e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
                className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white uppercase font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="default_addr_check"
              checked={addressForm.is_default}
              onChange={(e) => onUpdateAddressForm('is_default', e.target.checked)}
              className="rounded border-chumbo-700 bg-chumbo-950 text-laser-500 focus:ring-laser-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="default_addr_check" className="text-xs text-slate-300 font-medium cursor-pointer">
              Definir este como meu endereço principal de entrega
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
              onClick={onSaveAddress}
              variant="laser"
              size="sm"
            >
              Salvar Endereço
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
