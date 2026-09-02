import React from 'react';
import { getStoreCategoryName } from '../shared/storePresentation';
import { Category } from '../types';
import { Shield, Cpu, Sparkles, Wrench, Sword, Grid } from 'lucide-react';

interface CategoryFilterProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (slug: string) => void;
}

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'shield':
      return <Shield className="h-4 w-4" />;
    case 'cpu':
      return <Cpu className="h-4 w-4" />;
    case 'sparkles':
      return <Sparkles className="h-4 w-4" />;
    case 'wrench':
      return <Wrench className="h-4 w-4" />;
    case 'sword':
      return <Sword className="h-4 w-4" />;
    default:
      return <Grid className="h-4 w-4" />;
  }
};

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <section id="catalog" className="scroll-mt-24 bg-chumbo-950 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-laser-400">Catálogo</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">Encontre seu próximo item</h2>
          </div>
          <p className="hidden max-w-sm text-right text-sm text-slate-500 md:block">Navegue por categoria ou refine os resultados com os filtros abaixo.</p>
        </div>

        <nav aria-label="Categorias de produtos" className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            type="button"
            onClick={() => onSelectCategory('todas')}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === 'todas'
                ? 'bg-white font-bold text-chumbo-950'
                : 'border border-chumbo-800 bg-chumbo-900/70 text-slate-400 hover:border-chumbo-700 hover:text-white'
            }`}
          >
            <Grid className="h-4 w-4" />
            <span>Todos</span>
          </button>

          {categories.map((category) => {
            const isActive = activeCategory === category.slug;
            return (
              <button
                type="button"
                key={category.id}
                onClick={() => onSelectCategory(category.slug)}
                className={`flex items-center space-x-2.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white font-bold text-chumbo-950'
                    : 'border border-chumbo-800 bg-chumbo-900/70 text-slate-400 hover:border-chumbo-700 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-chumbo-950' : 'text-laser-400'}>
                  {getCategoryIcon(category.icon)}
                </span>
                <span>{getStoreCategoryName(category)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
};
