import React, { useState } from 'react';
import { Product, Category, Tenant } from '../../../types';
import { Button, SearchInput } from '../../../components/ui';
import { Edit2, Plus, Trash2, Calculator } from 'lucide-react';
import { CatalogCategoriesPanel } from './CatalogCategoriesPanel';
import { ProductPricingDetailsModal } from './ProductPricingDetailsModal';

export interface AdminProductsTabProps {
  products: Product[];
  categories: Category[];
  activeTenant: Tenant | null;
  onEditProduct: (product: Product) => void;
  onCreateProduct: () => void;
  onDeleteProduct: (productId: number) => void;
  onRefreshProducts: () => void;
  onRefreshCategories?: () => void;
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export const AdminProductsTab: React.FC<AdminProductsTabProps> = ({
  products,
  categories,
  activeTenant,
  onEditProduct,
  onCreateProduct,
  onDeleteProduct,
  onRefreshProducts,
  onRefreshCategories,
  onMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pricingProduct, setPricingProduct] = useState<Product | null>(null);

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, SKU ou material..."
            />
          </div>

          <Button
            type="button"
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={onCreateProduct}
          >
            Novo Produto 3D
          </Button>
        </div>

        {/* Tabela de Produtos */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono uppercase text-[10px] dark:border-chumbo-800 dark:bg-chumbo-950 dark:text-slate-400">
              <tr>
                <th className="p-3">Produto</th>
                <th className="p-3">Preço Unitário</th>
                <th className="p-3">Estoque</th>
                <th className="p-3">Precificação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-chumbo-850 dark:text-slate-300">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-chumbo-700"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{p.title}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">ID #{p.id} • Slug: {p.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    R$ {p.price.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                        p.in_stock ? 'bg-emerald-700 text-white dark:bg-emerald-500/20 dark:text-emerald-400 dark:shadow-none' : 'bg-rose-700 text-white dark:bg-rose-500/20 dark:text-rose-400 dark:shadow-none'
                      }`}
                    >
                      {p.in_stock ? `${p.stock_qty} un` : 'Esgotado'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setPricingProduct(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-laser-500/20 dark:hover:bg-laser-500/30 dark:text-laser-400 dark:border dark:border-laser-500/30 text-xs font-bold transition-all shadow-xs active:scale-95"
                      title="Ver detalhes de custos, margem e engenharia de precificação"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Ver detalhes</span>
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onEditProduct(p)}
                        className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-chumbo-800 dark:hover:bg-chumbo-700 dark:text-slate-300 dark:hover:text-white transition-colors"
                        title="Editar Produto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(p.id)}
                        className="p-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white dark:bg-rose-500/20 dark:hover:bg-rose-500/40 dark:text-rose-300 transition-colors"
                        title="Excluir Produto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-mono text-xs">
                    Nenhum produto cadastrado neste tenant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pricingProduct && (
        <ProductPricingDetailsModal
          product={pricingProduct}
          tenantId={activeTenant?.id}
          onClose={() => setPricingProduct(null)}
        />
      )}

      <CatalogCategoriesPanel
        tenantId={activeTenant?.id}
        categories={categories}
        onCreated={() => {
          onRefreshCategories?.();
          onRefreshProducts();
        }}
        onMessage={onMessage}
      />
    </div>
  );
};
