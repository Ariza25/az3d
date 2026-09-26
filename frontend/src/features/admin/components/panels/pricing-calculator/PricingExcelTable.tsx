import React from 'react';
import {
  EXCEL_BASE_PRODUCTS,
  PrintingPricingResult,
  currencyBRL,
  formatPrintDuration,
} from '../../../../../utils/printingPricing';

export interface ExcelCalculatedRow {
  name: string;
  weight: number;
  minutes: number;
  result: PrintingPricingResult;
}

interface PricingExcelTableProps {
  excelRows: ExcelCalculatedRow[];
  onApplyBaseProduct: (name: string) => void;
}

export const PricingExcelTable: React.FC<PricingExcelTableProps> = ({
  excelRows,
  onApplyBaseProduct,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-chumbo-800">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Base inicial do Excel</h4>
        <span className="text-[10px] font-mono text-slate-500">calculada pela API</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:bg-chumbo-950 dark:text-slate-400">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">Peso</th>
              <th className="p-3">Tempo</th>
              <th className="p-3">Custo direto</th>
              <th className="p-3">Preço sugerido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-chumbo-850 dark:text-slate-300">
            {EXCEL_BASE_PRODUCTS.map((item) => {
              const calculated = excelRows.find((row) => row.name === item.name);
              return (
                <tr
                  key={item.name}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-chumbo-850/60"
                  onClick={() => onApplyBaseProduct(item.name)}
                >
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                  <td className="p-3 font-mono">{item.weight.toFixed(2)} g</td>
                  <td className="p-3 font-mono">{formatPrintDuration(item.minutes)}</td>
                  <td className="p-3 font-mono">{calculated ? currencyBRL(calculated.result.directCost) : '--'}</td>
                  <td className="p-3 font-bold text-cyan-700 dark:text-laser-300">
                    {calculated ? currencyBRL(calculated.result.suggestedPrice) : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
