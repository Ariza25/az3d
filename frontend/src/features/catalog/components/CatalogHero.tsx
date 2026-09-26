import React from 'react';
import { Sparkles } from 'lucide-react';

export const CatalogHero: React.FC = () => {
  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-chumbo-950 to-cyan-950 p-5 sm:p-8 lg:p-10 shadow-2xl text-white">
      <div className="absolute -right-16 -top-16 w-60 sm:w-80 h-60 sm:h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-60 sm:w-72 h-60 sm:h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-cyan-400/20 border border-cyan-400/40 !text-white text-[11px] sm:text-xs font-bold">
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 !text-white" />
          <span className="!text-white font-bold">Vitrine Visual • Impressão 3D</span>
        </div>
        <h2 className="text-xl min-[400px]:text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
          Veja com calma tudo o que podemos produzir para você.
        </h2>
        <p className="text-xs sm:text-sm lg:text-base text-slate-200 leading-relaxed font-normal">
          Explore o catálogo completo de impressão 3D, descubra cores e modelos, e veja as especificações de cada peça.
          Quando decidir, finalize na loja ou fale direto conosco no WhatsApp!
        </p>
      </div>
    </section>
  );
};
