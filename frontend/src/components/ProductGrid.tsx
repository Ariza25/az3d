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
        <p className="text-sm font-mono text-slate-400">Carregando catalogo da loja...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-chumbo-900 border border-chumbo-800 flex items-center justify-center text-slate-500">
          <Box className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">Nenhum produto encontrado</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Nao encontramos itens para os filtros atuais. Ajuste a busca, categoria, material ou faixa de preco.
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-slate-400"><span className="font-bold text-white">{products.length}</span> {products.length === 1 ? 'produto' : 'produtos'}</p>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onOpenModal={onOpenModal} />
        ))}
      </div>
    </section>
  );
};
