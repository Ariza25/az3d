import React from 'react';
import {
  Clock,
  DollarSign,
  PackageCheck,
  Percent,
  Zap,
} from 'lucide-react';
import {
  PrintingPricingResult,
  currencyBRL,
  formatPrintDuration,
} from '../../../../../utils/printingPricing';

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const Metric: React.FC<MetricProps> = ({ icon, label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70">
    <div className="mb-2 text-cyan-700 dark:text-laser-300">{icon}</div>
    <span className="block text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
      {label}
    </span>
    <strong className="mt-1 block text-sm text-slate-900 dark:text-white">{value}</strong>
  </div>
);

interface PricingResultsCardProps {
  result: PrintingPricingResult | null;
  printMinutes: number;
}

export const PricingResultsCard: React.FC<PricingResultsCardProps> = ({ result, printMinutes }) => {
  return (
    <div className="space-y-4 rounded-2xl border border-cyan-300 bg-cyan-50/70 p-4 shadow-sm dark:border-laser-500/30 dark:bg-laser-500/10">
      <div>
        <span className="text-[10px] font-mono font-bold uppercase text-cyan-800 dark:text-laser-300">
          Preço sugerido
        </span>
        <div className="mt-1 text-3xl font-extrabold text-cyan-950 dark:text-white">
          {result ? currencyBRL(result.suggestedPrice) : '--'}
        </div>
        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
          {result
            ? `Líquido após taxas: ${currencyBRL(result.netAfterFees)} | Lucro: ${currencyBRL(result.profit)}`
            : 'Execute o cálculo para ver o resultado atualizado.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric
          icon={<PackageCheck className="h-4 w-4" />}
          label="Custo PLA"
          value={result ? currencyBRL(result.materialCost) : '--'}
        />
        <Metric
          icon={<Zap className="h-4 w-4" />}
          label="Energia"
          value={result ? currencyBRL(result.energyCost) : '--'}
        />
        <Metric
          icon={<Clock className="h-4 w-4" />}
          label="Tempo"
          value={formatPrintDuration(printMinutes)}
        />
        <Metric
          icon={<Percent className="h-4 w-4" />}
          label="Taxas"
          value={result ? currencyBRL(result.totalFees) : '--'}
        />
        <Metric
          icon={<DollarSign className="h-4 w-4" />}
          label="Custo direto"
          value={result ? currencyBRL(result.directCost) : '--'}
        />
        <Metric
          icon={<Percent className="h-4 w-4" />}
          label="Margem real"
          value={result ? `${result.profitMarginPercent.toFixed(1)}%` : '--'}
        />
      </div>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70 dark:text-slate-300">
          <div className="flex justify-between">
            <span>Material total</span>
            <strong className="text-slate-900 dark:text-white">
              {result.totalMaterialGrams.toFixed(2)} g
            </strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Custo por grama</span>
            <strong className="text-slate-900 dark:text-white">
              {currencyBRL(result.materialCostPerGram)}
            </strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Energia estimada</span>
            <strong className="text-slate-900 dark:text-white">
              {result.energyKwh.toFixed(3)} kWh
            </strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Reserva de perda</span>
            <strong className="text-slate-900 dark:text-white">
              {currencyBRL(result.failureReserve)}
            </strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Custo operacional</span>
            <strong className="text-slate-900 dark:text-white">
              {currencyBRL(result.operationalCost)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};
