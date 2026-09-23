import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { withBasePath } from '../shared/basePath';

interface AZ3DLogoProps {
  className?: string;
  themeOverride?: 'light' | 'dark';
  size?: number | string;
  showText?: boolean;
}

export const AZ3DLogo: React.FC<AZ3DLogoProps> = ({
  className = 'w-9 h-9 sm:w-10 sm:h-10',
  themeOverride,
  showText = false,
}) => {
  const { theme } = useTheme();
  const currentTheme = themeOverride || theme;
  const isDark = currentTheme === 'dark';

  // Regra de contraste da marca:
  // Tema claro: 03-simbolo-az-fundo-escuro.png (escuro no tema claro)
  // Tema escuro: 04-simbolo-az-fundo-branco.png (claro no tema escuro)
  const logoSrc = withBasePath(
    isDark ? '/04-simbolo-az-fundo-branco.png' : '/03-simbolo-az-fundo-escuro.png'
  );

  return (
    <div className="flex items-center gap-2.5 select-none shrink-0">
      <img
        src={logoSrc}
        alt="AZ3D Studio Logo"
        className={`${className} object-contain rounded-xl shadow-sm`}
        loading="eager"
      />

      {showText && (
        <div className="min-w-0">
          <span className={`text-xl sm:text-2xl font-extrabold tracking-wider flex items-center gap-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            AZ<span className="font-mono text-blue-600 dark:text-laser-400">3D</span>
          </span>
          <span className={`text-[10px] tracking-widest uppercase -mt-1 block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Studio
          </span>
        </div>
      )}
    </div>
  );
};

