import React from 'react';
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
      return <Shield className="w-4 h-4" />;
    case 'cpu':
      return <Cpu className="w-4 h-4" />;
    case 'sparkles':
      return <Sparkles className="w-4 h-4" />;
    case 'wrench':
      return <Wrench className="w-4 h-4" />;
    case 'sword':
      return <Sword className="w-4 h-4" />;
    default:
      return <Grid className="w-4 h-4" />;
  }
};

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="w-full py-6 border-b border-chumbo-850 bg-chumbo-950/60 sticky top-20 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
          
          {/* Opção 'Todas' */}
          <button
            onClick={() => onSelectCategory('todas')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeCategory === 'todas'
                ? 'bg-white text-chumbo-950 font-bold shadow-lg shadow-white/10'
                : 'bg-chumbo-900 text-slate-400 hover:text-white hover:bg-chumbo-800 border border-chumbo-800'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Todos os Modelos</span>
          </button>

          {/* Categorias Dinâmicas do Backend */}
          {categories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.slug)}
                className={`flex items-center space-x-2.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-chumbo-950 font-bold shadow-lg shadow-white/10'
                    : 'bg-chumbo-900 text-slate-400 hover:text-white hover:bg-chumbo-800 border border-chumbo-800'
                }`}
              >
                <span className={isActive ? 'text-chumbo-950' : 'text-laser-400'}>
                  {getCategoryIcon(cat.icon)}
                </span>
                <span>{cat.name}</span>
              </button>
            );
          })}

        </div>

      </div>
    </div>
  );
};
