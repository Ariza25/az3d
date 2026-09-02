import React from 'react';
import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import { Category, Product, Tenant, TenantSettings } from '../types';
import { getStockStatus, money } from '../shared/storePresentation';

interface HeroProps {
  tenant: Tenant | null;
  settings: TenantSettings | null;
  featuredProduct?: Product;
  categories: Category[];
  onSelectCategory: (slug: string) => void;
  onOpenProduct?: (product: Product) => void;
}

export const Hero: React.FC<HeroProps> = ({
  tenant,
  settings,
  featuredProduct,
  onOpenProduct,
}) => {
  const storeName = settings?.store_name || tenant?.name || 'AZ3D Store';
  const logoUrl = settings?.logo_url || tenant?.logo_url;
  const primaryColor = settings?.primary_color || '#22d3ee';
  const featuredImage =
    featuredProduct?.color_images?.[0]?.image_url ||
    featuredProduct?.image_url ||
    'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1400&auto=format&fit=crop';
  const featuredTitle = featuredProduct?.title || 'Produtos prontos para comprar';
  const featuredPrice = featuredProduct ? money(featuredProduct.price) : 'Catálogo da loja';
  const stockStatus = featuredProduct ? getStockStatus(featuredProduct) : null;
  const scrollToCatalog = () => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative overflow-hidden border-b border-chumbo-850 bg-chumbo-950">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_62%)]" />

      <div className={`relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16 ${featuredProduct ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        <div className="max-w-2xl space-y-7">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-12 w-12 rounded-xl border border-white/15 bg-chumbo-900 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-chumbo-900" style={{ color: primaryColor }}>
                <ShoppingBag className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Loja oficial</p>
              <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">{storeName}</h1>
            </div>
          </div>

          <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Peças selecionadas, produção cuidadosa e compra direta. Explore o catálogo e encontre o item ideal para o seu projeto.
          </p>

          <button
            type="button"
            onClick={scrollToCatalog}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-chumbo-950 shadow-lg transition hover:brightness-110"
            style={{ backgroundColor: primaryColor }}
          >
            Explorar catálogo
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {featuredProduct && (
          <article className="group overflow-hidden rounded-3xl border border-white/10 bg-chumbo-900/80 shadow-2xl shadow-black/30 backdrop-blur">
            <button
              type="button"
              onClick={() => onOpenProduct?.(featuredProduct)}
              className="relative block aspect-[16/10] w-full overflow-hidden text-left"
              aria-label={`Ver ${featuredTitle}`}
            >
              <img src={featuredImage} alt={featuredTitle} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-chumbo-950/85 via-transparent to-transparent" />
              <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-chumbo-950/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-laser-400" />
                Escolha da loja
              </span>
            </button>
            <div className="flex items-center justify-between gap-5 p-5 sm:p-6">
              <div className="min-w-0">
                <p className={`mb-2 text-xs font-bold ${stockStatus?.canBuy ? 'text-emerald-300' : 'text-slate-500'}`}>{stockStatus?.label}</p>
                <h2 className="line-clamp-2 text-xl font-extrabold leading-snug text-white">{featuredTitle}</h2>
                <p className="mt-1 text-sm font-bold text-slate-300">{featuredPrice}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenProduct?.(featuredProduct)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-chumbo-950 transition hover:bg-slate-200"
              >
                Ver produto
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  );
};
