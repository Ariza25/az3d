import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
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
  const storeName = (settings?.store_name || tenant?.name || 'AZ3D Studio').replace(/AZ3D Store/gi, 'AZ3D Studio');
  const featuredImage =
    featuredProduct?.color_images?.[0]?.image_url ||
    featuredProduct?.image_url ||
    'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1400&auto=format&fit=crop';
  const featuredTitle = featuredProduct?.title || 'Produtos prontos para comprar';
  const featuredPrice = featuredProduct ? money(featuredProduct.price) : 'Catálogo da loja';
  const stockStatus = featuredProduct ? getStockStatus(featuredProduct) : null;
  const scrollToCatalog = () => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative overflow-hidden border-b border-chumbo-800 bg-chumbo-950">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_62%)] pointer-events-none" />

      <div className={`relative z-10 mx-auto grid max-w-7xl items-center gap-5 sm:gap-10 px-4 py-4 sm:py-8 lg:px-8 lg:py-14 ${featuredProduct ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        <div className="max-w-2xl space-y-3 sm:space-y-6">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-400">Loja oficial</p>
              <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">{storeName}</h1>
            </div>
          </div>

          <p className="max-w-xl text-xs sm:text-base leading-relaxed text-slate-400">
            Peças selecionadas, produção cuidadosa e compra direta. Explore o catálogo e encontre o item ideal para o seu projeto.
          </p>

          <button
            type="button"
            onClick={scrollToCatalog}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-extrabold shadow-lg transition hover:brightness-105 active:scale-95"
          >
            Explorar catálogo
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </div>

        {featuredProduct && (
          <article className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-chumbo-800 bg-chumbo-900/90 shadow-2xl backdrop-blur">
            <button
              type="button"
              onClick={() => onOpenProduct?.(featuredProduct)}
              className="relative block aspect-[16/9] sm:aspect-[16/10] w-full overflow-hidden text-left"
              aria-label={`Ver ${featuredTitle}`}
            >
              <img src={featuredImage} alt={featuredTitle} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-chumbo-950/80 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 sm:left-4 sm:top-4 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-chumbo-700 bg-chumbo-950/80 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-laser-400" />
                Escolha da loja
              </span>
            </button>
            <div className="flex items-center justify-between gap-3 sm:gap-5 p-3.5 sm:p-6 bg-chumbo-900/70 border-t border-chumbo-800">
              <div className="min-w-0">
                <p className={`mb-1 text-[11px] sm:text-xs font-bold ${stockStatus?.canBuy ? 'text-emerald-400' : 'text-slate-400'}`}>{stockStatus?.label}</p>
                <h2 className="line-clamp-1 sm:line-clamp-2 text-sm sm:text-xl font-extrabold leading-snug text-white">{featuredTitle}</h2>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-400">{featuredPrice}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenProduct?.(featuredProduct)}
                className="inline-flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-extrabold transition shadow-md active:scale-95"
              >
                Ver produto
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  );
};
