import React from 'react';
import { Cpu, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-16 lg:py-24 border-b border-chumbo-850 bg-gradient-to-b from-chumbo-950 via-chumbo-900 to-chumbo-950">
      
      {/* Elementos visuais de fundo futuristas */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-laser-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-0 right-10 w-72 h-72 bg-slate-400/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Lado Esquerdo - Copywriting */}
          <div className="lg:col-span-7 space-y-6 text-left">
            
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-chumbo-850 border border-chumbo-700/80 text-xs font-mono text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-laser-400" />
              <span>Engenharia de Adição 8K & PLA Silk Ultra Fine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
              Precisão Micronizada em <br />
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Impressão 3D Premium
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-xl font-normal leading-relaxed">
              Descubra estátuas geek de alta definição, setups minimalistas para desenvolvedores, vasilhames Voronoi e armaduras para cosplay produzidos sob medida.
            </p>

            {/* Badges de atributos técnicos */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-chumbo-800/80 max-w-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-chumbo-800 border border-chumbo-700 flex items-center justify-center text-slate-200">
                  <Zap className="w-4 h-4 text-laser-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">0.05mm</p>
                  <p className="text-[11px] text-slate-400">Resolução Camada</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-chumbo-800 border border-chumbo-700 flex items-center justify-center text-slate-200">
                  <Cpu className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">PETG & Resina</p>
                  <p className="text-[11px] text-slate-400">Filamento Pro</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-chumbo-800 border border-chumbo-700 flex items-center justify-center text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Garantia AZ3D</p>
                  <p className="text-[11px] text-slate-400">Inspecionado 100%</p>
                </div>
              </div>
            </div>

          </div>

          {/* Lado Direito - Showcase de Impressão 3D */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="glass-card rounded-2xl overflow-hidden border border-chumbo-700 shadow-2xl p-2 relative group">
                <img
                  src="https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1000&auto=format&fit=crop"
                  alt="Impressão 3D Dragão Articulado"
                  className="w-full h-80 lg:h-96 object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Overlay Badge de Especificações em Tempo Real */}
                <div className="absolute bottom-4 left-4 right-4 bg-chumbo-950/90 backdrop-blur-md border border-chumbo-700/80 p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-laser-400 font-bold block">
                      DESTAQUE DA SEMANA
                    </span>
                    <p className="text-sm font-bold text-white">Dragão Articulado Ember 3D</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-200 bg-chumbo-800 px-2.5 py-1 rounded-md border border-chumbo-700">
                    R$ 149,90
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
