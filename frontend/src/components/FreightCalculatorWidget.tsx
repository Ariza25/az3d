import React, { useState } from 'react';
import { Truck, Check, AlertCircle, Loader2 } from 'lucide-react';
import { money } from '../shared/storePresentation';
import { api } from '../services/api';

interface FreightOption {
  code: string;
  name: string;
  price: number;
  deliveryDays: number;
}

interface FreightCalculatorWidgetProps {
  tenantId?: number;
  onSelectOption?: (option: FreightOption) => void;
  selectedOptionCode?: string;
  compact?: boolean;
}

export const FreightCalculatorWidget: React.FC<FreightCalculatorWidgetProps> = ({
  tenantId,
  onSelectOption,
  selectedOptionCode,
  compact = false,
}) => {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<FreightOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalSelectedCode, setInternalSelectedCode] = useState<string | null>(selectedOptionCode || null);

  const activeSelectedCode = selectedOptionCode || internalSelectedCode;

  const handleSelectOption = (opt: FreightOption) => {
    setInternalSelectedCode(opt.code);
    if (onSelectOption) {
      onSelectOption(opt);
    }
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setError('Informe um CEP válido com 8 dígitos.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.calculateFreightQuote(cleanCep, tenantId);
      const mappedOptions: FreightOption[] = (res.options || []).map((opt) => ({
        code: opt.code,
        name: opt.name,
        price: opt.price,
        deliveryDays: opt.delivery_days,
      }));

      setOptions(mappedOptions);
      if (mappedOptions.length > 0) {
        handleSelectOption(mappedOptions[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao calcular frete no servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border border-chumbo-800 bg-chumbo-900/60 p-4 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-200">
        <Truck className="h-4 w-4 text-laser-400" />
        <span>Calcular frete e prazo de entrega</span>
      </div>

      <form onSubmit={handleCalculate} className="flex gap-2">
        <input
          type="text"
          maxLength={9}
          placeholder="00000-000"
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          className="flex-1 rounded-lg border border-chumbo-700 bg-chumbo-950 px-3 py-2 font-mono text-white placeholder-slate-500 focus:border-laser-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-chumbo-800 px-4 py-2 font-bold text-white transition-colors hover:bg-chumbo-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-laser-400" />
          ) : (
            <span>Calcular</span>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {options && (
        <div className="mt-3 space-y-2 border-t border-chumbo-800 pt-3">
          {options.map((opt) => {
            const isSelected = activeSelectedCode === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => handleSelectOption(opt)}
                className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-laser-500 bg-laser-500/10 text-white shadow-md'
                    : 'border-chumbo-800 bg-chumbo-950/40 text-slate-300 hover:border-chumbo-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      isSelected ? 'border-laser-400 bg-laser-400 text-chumbo-950' : 'border-chumbo-700'
                    }`}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{opt.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Chega em até {opt.deliveryDays} dias úteis
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-laser-400">
                  {money(opt.price)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
