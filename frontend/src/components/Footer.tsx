import React from 'react';
import { Category } from '../types';
import { getStoreCategoryName } from '../shared/storePresentation';
import { AZ3DLogo } from './AZ3DLogo';

interface FooterProps {
  categories?: Category[];
  onSelectCategory?: (slug: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ categories = [], onSelectCategory }) => {
  const handleCategoryClick = (slug: string) => {
    if (onSelectCategory) {
      onSelectCategory(slug);
      const catalogEl = document.getElementById('catalog');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="bg-chumbo-950 border-t border-chumbo-850 pt-16 pb-12 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-chumbo-900">
          
          {/* Coluna 1 - Brand */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <AZ3DLogo className="w-9 h-9 shrink-0" themeOverride="dark" />
              <span className="text-xl font-extrabold text-white tracking-wider">
                AZ<span className="text-laser-400 font-mono">3D</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-normal max-w-md">
              Soluções avançadas em manufatura aditiva, prototipagem rápida e colecionáveis em alta resolução com filamento e resina premium.
            </p>
          </div>

          {/* Coluna 2 - Categorias */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-200 mb-4">
              Categorias Populares
            </h4>
            {categories.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {categories.map((category) => (
                  <li
                    key={category.id}
                    onClick={() => handleCategoryClick(category.slug)}
                    className="hover:text-white hover:text-laser-400 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-chumbo-700 group-hover:bg-laser-400" />
                    <span>{getStoreCategoryName(category)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma categoria cadastrada no momento.</p>
            )}
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-4 sm:space-y-0">
          <p>© 2026 AZ3D Studio. Todos os direitos reservados.</p>
        </div>

      </div>
    </footer>
  );
};
