import React, { useState } from 'react';
import { Product, Category, Tenant } from '../../../types';
import { Button, SearchInput } from '../../../components/ui';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { CatalogCategoriesPanel } from '../../../components/CatalogCategoriesPanel';

export interface AdminProductsTabProps {
  products: Product[];
  categories: Category[];
  activeTenant: Tenant | null;
  onEditProduct: (product: Product) => void;
  onCreateProduct: () => void;
  onDeleteProduct: (productId: number) => void;
  onRefreshProducts: () => void;
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
  onMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

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
        <div className="rounded-2xl border border-chumbo-800 overflow-hidden bg-chumbo-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-chumbo-950 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Produto</th>
                <th className="p-3">Material 3D</th>
                <th className="p-3">Resolução / Tempo</th>
                <th className="p-3">Preço Unitário</th>
                <th className="p-3">Estoque</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chumbo-850 text-slate-300">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-chumbo-850/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="w-10 h-10 object-cover rounded-lg border border-chumbo-700"
                      />
                      <div>
                        <span className="font-bold text-white block">{p.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID #{p.id} • Slug: {p.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="bg-chumbo-800 text-slate-200 px-2 py-0.5 rounded-md font-mono text-[11px]">
                      {p.material}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    <div>{p.layer_height}</div>
                    <div className="text-[10px] text-slate-500">{p.print_time}</div>
                  </td>
                  <td className="p-3 font-bold text-white">
                    R$ {p.price.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.in_stock ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {p.in_stock ? `${p.stock_qty} un` : 'Esgotado'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onEditProduct(p)}
                        className="p-1.5 rounded-lg bg-chumbo-800 hover:bg-chumbo-700 text-slate-300 hover:text-white transition-colors"
                        title="Editar Produto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(p.id)}
                        className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors"
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
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-xs">
                    Nenhum produto cadastrado neste tenant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CatalogCategoriesPanel
        tenantId={activeTenant?.id}
        categories={categories}
        onCreated={onRefreshProducts}
        onMessage={onMessage}
      />
    </div>
  );
};
