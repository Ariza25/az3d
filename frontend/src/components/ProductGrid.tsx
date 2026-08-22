import React from 'react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { Box, RefreshCw } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  onOpenModal: (product: Product) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, isLoading, onOpenModal }) => {
  if (isLoading) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-laser-400 animate-spin" />
        <p className="text-sm font-mono text-slate-400">Carregando catálogo de fatiamento 3D...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-chumbo-900 border border-chumbo-800 flex items-center justify-center text-slate-500">
          <Box className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">Nenhum modelo encontrado</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Não encontramos nenhum item correspondente ao seu filtro de busca. Tente buscar por outros termos como "dragão", "resina" ou "capacete".
        </p>
      </div>
    );
  }

  return (
    <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onOpenModal={onOpenModal} />
        ))}
      </div>
    </section>
  );
};
