import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

export type StoreSort = 'featured' | 'recent' | 'price_asc' | 'price_desc';
export type AvailabilityFilter = 'all' | 'available' | 'low_stock' | 'out';

interface StoreFiltersProps {
  sortBy: StoreSort;
  onSortChange: (value: StoreSort) => void;
  materialOptions: string[];
  materialFilter: string;
  onMaterialChange: (value: string) => void;
  availabilityFilter: AvailabilityFilter;
  onAvailabilityChange: (value: AvailabilityFilter) => void;
  maxPrice: number;
  priceCeiling: number;
  onMaxPriceChange: (value: number) => void;
}

export const StoreFilters: React.FC<StoreFiltersProps> = ({
  sortBy,
  onSortChange,
  materialOptions,
  materialFilter,
  onMaterialChange,
  availabilityFilter,
  onAvailabilityChange,
  maxPrice,
  priceCeiling,
  onMaxPriceChange,
}) => {
  return (
    <section className="border-b border-chumbo-850 bg-chumbo-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_1fr_1fr_1.4fr] lg:items-end">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <SlidersHorizontal className="h-4 w-4 text-laser-400" />
            Filtros
          </div>

          <Field label="Ordenar">
            <select value={sortBy} onChange={(e) => onSortChange(e.target.value as StoreSort)} className="filter-input">
              <option value="featured">Destaques</option>
              <option value="recent">Mais recentes</option>
              <option value="price_asc">Menor preco</option>
              <option value="price_desc">Maior preco</option>
            </select>
          </Field>

          <Field label="Material">
            <select value={materialFilter} onChange={(e) => onMaterialChange(e.target.value)} className="filter-input">
              <option value="todos">Todos</option>
              {materialOptions.map((material) => (
                <option key={material} value={material}>{material}</option>
              ))}
            </select>
          </Field>

          <Field label="Disponibilidade">
            <select value={availabilityFilter} onChange={(e) => onAvailabilityChange(e.target.value as AvailabilityFilter)} className="filter-input">
              <option value="all">Todos</option>
              <option value="available">Disponiveis</option>
              <option value="low_stock">Baixo estoque</option>
              <option value="out">Esgotados</option>
            </select>
          </Field>

          <Field label={`Ate R$ ${maxPrice.toFixed(0)}`}>
            <input
              type="range"
              min={0}
              max={Math.max(1, priceCeiling)}
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </Field>
        </div>
      </div>
    </section>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1.5">
    <span className="block text-[11px] font-mono uppercase text-slate-500">{label}</span>
    {children}
  </label>
);
