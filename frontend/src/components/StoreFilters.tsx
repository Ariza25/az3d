import React, { useState } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';

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
  onClear: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
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
  onClear,
  searchQuery,
  onSearchChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeFilterCount = Number(sortBy !== 'featured') + Number(materialFilter !== 'todos') + Number(availabilityFilter !== 'all') + Number(maxPrice < priceCeiling);

  return (
    <section className="bg-chumbo-950 pt-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setIsOpen((value) => !value)}
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-slate-200 hover:bg-chumbo-800 lg:pointer-events-none"
              aria-expanded={isOpen}
            >
              <SlidersHorizontal className="h-4 w-4 text-laser-400" />
              Filtros
              {activeFilterCount > 0 && <span className="rounded-full bg-laser-400 px-2 py-0.5 text-[10px] text-chumbo-950">{activeFilterCount}</span>}
              <ChevronDown className={`h-4 w-4 text-slate-500 transition lg:hidden ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex w-full items-center gap-2 sm:ml-auto sm:max-w-xl">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar produtos..."
                  className="h-11 w-full rounded-xl border border-chumbo-700 bg-chumbo-950 py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-laser-400 focus:outline-none focus:ring-1 focus:ring-laser-400/30"
                  aria-label="Buscar produtos"
                />
                {searchQuery && (
                  <button type="button" onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-chumbo-800 hover:text-white" aria-label="Limpar busca">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {activeFilterCount > 0 && (
                <button type="button" onClick={onClear} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-400 hover:bg-chumbo-800 hover:text-white">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className={`${isOpen ? 'grid' : 'hidden'} mt-3 gap-3 border-t border-chumbo-800 pt-4 sm:grid-cols-2 lg:grid lg:grid-cols-[1fr_1fr_1fr_1.35fr]`}>
            <Field label="Ordenar por">
              <select value={sortBy} onChange={(event) => onSortChange(event.target.value as StoreSort)} className="filter-input">
                <option value="featured">Relevância</option>
                <option value="recent">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
              </select>
            </Field>

            <Field label="Material">
              <select value={materialFilter} onChange={(event) => onMaterialChange(event.target.value)} className="filter-input">
                <option value="todos">Todos os materiais</option>
                {materialOptions.map((material) => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </Field>

            <Field label="Disponibilidade">
              <select value={availabilityFilter} onChange={(event) => onAvailabilityChange(event.target.value as AvailabilityFilter)} className="filter-input">
                <option value="all">Todos os itens</option>
                <option value="available">Disponíveis</option>
                <option value="low_stock">Últimas unidades</option>
                <option value="out">Esgotados</option>
              </select>
            </Field>

            <Field label={`Preço máximo · ${moneyLabel(maxPrice)}`}>
              <div className="flex h-[42px] items-center rounded-xl border border-chumbo-700 bg-chumbo-950 px-3">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, priceCeiling)}
                  value={maxPrice}
                  onChange={(event) => onMaxPriceChange(Number(event.target.value))}
                  className="w-full accent-cyan-400"
                  aria-label="Preço máximo"
                />
              </div>
            </Field>
          </div>
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

const moneyLabel = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(value);
