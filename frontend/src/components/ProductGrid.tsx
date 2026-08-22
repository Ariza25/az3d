import React from 'react';
import { Category, Product } from '../types';
import { ProductCard } from './ProductCard';
import { Box, RefreshCw } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  onOpenModal: (product: Product) => void;
  categories?: Category[];
  onSelectCategory?: (slug: string) => void;
  onClearFilters?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, isLoading, onOpenModal, categories = [], onSelectCategory, onClearFilters }) => {
  if (isLoading) {
    return (
      <div id="catalog" className="py-20 text-center flex flex-col items-center justify-center space-y-4 scroll-mt-36">
        <RefreshCw className="w-8 h-8 text-laser-400 animate-spin" />
        <p className="text-sm font-mono text-slate-400">Carregando catalogo da loja...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div id="catalog" className="py-20 text-center flex flex-col items-center justify-center space-y-4 scroll-mt-36">
        <div className="w-16 h-16 rounded-2xl bg-chumbo-900 border border-chumbo-800 flex items-center justify-center text-slate-500">
          <Box className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">Nenhum produto encontrado</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Nao encontramos itens para os filtros atuais. Ajuste a busca, categoria, material ou faixa de preco.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onClearFilters && (
            <button onClick={onClearFilters} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-chumbo-950 hover:bg-slate-200">
              Limpar filtros
            </button>
          )}
          {categories.slice(0, 4).map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory?.(category.slug)}
              className="rounded-xl border border-chumbo-700 bg-chumbo-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-chumbo-800"
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section id="catalog" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-36">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onOpenModal={onOpenModal} />
        ))}
      </div>
    </section>
  );
};
