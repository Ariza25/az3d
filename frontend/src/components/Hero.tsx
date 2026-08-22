import React from 'react';
import { ArrowRight, Grid2X2, ShoppingBag, Star } from 'lucide-react';
import { Category, Product, Tenant, TenantSettings } from '../types';
import { money } from '../shared/storePresentation';

interface HeroProps {
  tenant: Tenant | null;
  settings: TenantSettings | null;
  featuredProduct?: Product;
  categories: Category[];
  onSelectCategory: (slug: string) => void;
}

export const Hero: React.FC<HeroProps> = ({
  tenant,
  settings,
  featuredProduct,
  categories,
  onSelectCategory,
}) => {
  const storeName = settings?.store_name || tenant?.name || 'AZ3D Store';
  const logoUrl = settings?.logo_url || tenant?.logo_url;
  const primaryColor = settings?.primary_color || '#22d3ee';
  const featuredImage =
    featuredProduct?.color_images?.[0]?.image_url ||
    featuredProduct?.image_url ||
    'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1400&auto=format&fit=crop';
  const featuredTitle = featuredProduct?.title || 'Produtos prontos para comprar';
  const featuredPrice = featuredProduct ? money(featuredProduct.price) : 'Catalogo da loja';
  const visibleCategories = categories.slice(0, 4);
  const scrollToCatalog = () => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative min-h-[520px] overflow-hidden border-b border-chumbo-850 bg-chumbo-950">
      <img src={featuredImage} alt={featuredTitle} className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,11,13,0.96)_0%,rgba(10,11,13,0.82)_48%,rgba(10,11,13,0.38)_100%)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <div className="max-w-3xl space-y-7">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-12 w-12 rounded-xl object-cover border border-white/15 bg-chumbo-900" />
            ) : (
              <div className="h-12 w-12 rounded-xl border border-white/15 bg-chumbo-900 flex items-center justify-center" style={{ color: primaryColor }}>
                <ShoppingBag className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Loja oficial</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white">{storeName}</h1>
            </div>
          </div>

          <p className="max-w-2xl text-base sm:text-lg leading-relaxed text-slate-200">
            Produtos selecionados, estoque atualizado e compra direta na loja. Encontre pecas prontas por categoria, cor, material e disponibilidade.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={scrollToCatalog}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-chumbo-950 shadow-lg transition hover:brightness-110"
              style={{ backgroundColor: primaryColor }}
            >
              Comprar agora
              <ArrowRight className="h-4 w-4" />
            </button>
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onSelectCategory(category.slug);
                  scrollToCatalog();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-chumbo-950/70 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-chumbo-900"
              >
                <Grid2X2 className="h-4 w-4" />
                {category.name}
              </button>
            ))}
          </div>

          {featuredProduct && (
            <div className="inline-flex max-w-full items-center gap-3 rounded-xl border border-white/15 bg-chumbo-950/80 px-4 py-3">
              <Star className="h-4 w-4 shrink-0 fill-amber-300 text-amber-300" />
              <div className="min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Produto em destaque</p>
                <p className="truncate text-sm font-bold text-white">{featuredTitle}</p>
              </div>
              <span className="shrink-0 text-sm font-extrabold text-white">{featuredPrice}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
