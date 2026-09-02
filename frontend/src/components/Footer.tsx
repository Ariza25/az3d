import React from 'react';
import { Layers } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-chumbo-950 border-t border-chumbo-850 pt-16 pb-12 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-chumbo-900">
          
          {/* Coluna 1 - Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-chumbo-950 font-bold">
                <Layers className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-wider">
                AZ<span className="text-laser-400 font-mono">3D</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Soluções avançadas em manufatura aditiva, prototipagem rápida e colecionáveis em alta resolução com filamento e resina premium.
            </p>
          </div>

          {/* Coluna 3 - Categorias */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-200 mb-4">
              Categorias Populares
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="hover:text-white transition-colors cursor-pointer">Colecionáveis & Geek</li>
              <li className="hover:text-white transition-colors cursor-pointer">Setup Tech & Organização</li>
              <li className="hover:text-white transition-colors cursor-pointer">Decoração Minimalista</li>
              <li className="hover:text-white transition-colors cursor-pointer">Cosplay & Réplicas 1:1</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-4 sm:space-y-0">
          <p>© 2026 AZ3D Studio. Todos os direitos reservados.</p>
        </div>

      </div>
    </footer>
  );
};
