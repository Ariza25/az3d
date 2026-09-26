import React from 'react';
import { ShoppingBag, Truck } from 'lucide-react';
import { FreightCalculatorWidget } from './FreightCalculatorWidget';

interface DeliveryOption {
  value: 'shipping' | 'pickup';
  label: string;
  enabled: boolean;
}

interface CartDeliveryStepProps {
  deliveryMethod: 'shipping' | 'pickup';
  deliveryOptions: DeliveryOption[];
  onSelectDeliveryMethod: (method: 'shipping' | 'pickup') => void;
  tenantId?: number;
  selectedFreightCode?: string;
  onSelectFreight: (option: any) => void;
  zipCode: string;
  city: string;
  state: string;
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  notes: string;
  onZipCodeChange: (val: string) => void;
  onCityChange: (val: string) => void;
  onStateChange: (val: string) => void;
  onShippingAddressChange: (val: string) => void;
  onRecipientNameChange: (val: string) => void;
  onRecipientPhoneChange: (val: string) => void;
  onNotesChange: (val: string) => void;
}

export const CartDeliveryStep: React.FC<CartDeliveryStepProps> = ({
  deliveryMethod,
  deliveryOptions,
  onSelectDeliveryMethod,
  tenantId,
  selectedFreightCode,
  onSelectFreight,
  zipCode,
  city,
  state,
  shippingAddress,
  recipientName,
  recipientPhone,
  notes,
  onZipCodeChange,
  onCityChange,
  onStateChange,
  onShippingAddressChange,
  onRecipientNameChange,
  onRecipientPhoneChange,
  onNotesChange,
}) => {
  return (
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
                onClick={() => onSelectDeliveryMethod(option.value)}
                className={`flex min-h-20 items-center gap-3 rounded-2xl border px-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? 'border-laser-400 bg-laser-400/10 text-white'
                    : 'border-chumbo-700 bg-chumbo-900/60 text-slate-300 hover:border-chumbo-600'
                }`}
                aria-pressed={isSelected}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${isSelected ? 'text-laser-400' : 'text-slate-500'}`}
                />
                <span>
                  <strong className="block text-sm">{option.label}</strong>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {option.value === 'shipping' ? 'No seu endereço' : 'Na loja'}
                  </span>
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
              tenantId={tenantId}
              selectedOptionCode={selectedFreightCode}
              onSelectOption={onSelectFreight}
            />
          </div>

          <div>
            <div className="mb-3">
              <h3 className="text-sm font-bold text-white">Endereço de entrega</h3>
              <p className="mt-1 text-xs text-slate-500">Preencha onde o pedido deve chegar.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_88px]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">CEP</span>
                <input
                  value={zipCode}
                  onChange={(e) => onZipCodeChange(e.target.value)}
                  placeholder="00000-000"
                  autoComplete="postal-code"
                  className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Cidade</span>
                <input
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  placeholder="Sua cidade"
                  autoComplete="address-level2"
                  className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">UF</span>
                <input
                  value={state}
                  onChange={(e) => onStateChange(e.target.value)}
                  placeholder="SP"
                  autoComplete="address-level1"
                  className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
                />
              </label>
            </div>
            <div className="mt-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Endereço completo
                </span>
                <input
                  value={shippingAddress}
                  onChange={(e) => onShippingAddressChange(e.target.value)}
                  placeholder="Rua, número, bairro e complemento"
                  autoComplete="street-address"
                  className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
                />
              </label>
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
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-300">Nome de quem recebe</span>
            <input
              value={recipientName}
              onChange={(e) => onRecipientNameChange(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-300">Telefone</span>
            <input
              value={recipientPhone}
              onChange={(e) => onRecipientPhoneChange(e.target.value)}
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              className="w-full rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
            />
          </label>
        </div>
      </section>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-300">
          Observações <span className="font-normal text-slate-500">(opcional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Alguma orientação para a loja?"
          className="w-full resize-none rounded-xl border border-chumbo-700/80 bg-chumbo-900 px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-laser-400"
        />
      </label>
    </div>
  );
};
