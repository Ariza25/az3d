import React from 'react';
import { useTheme } from '../context/ThemeContext';

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

  return (
    <div className={`flex items-center gap-2.5 select-none shrink-0`}>
      <svg
        viewBox="0 0 120 120"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="AZ3D Logo"
      >
        <defs>
          <linearGradient id={isDark ? "azDarkBg" : "azLightBg"} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            {isDark ? (
              <>
                <stop offset="0%" stopColor="#1e232f" />
                <stop offset="100%" stopColor="#0d1017" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </>
            )}
          </linearGradient>

          <linearGradient id={isDark ? "azSymbolDark" : "azSymbolLight"} x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            {isDark ? (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#090d16" />
                <stop offset="100%" stopColor="#161c28" />
              </>
            )}
          </linearGradient>

          <filter id="azShadow" x="-10%" y="-10%" width="130%" height="130%" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={isDark ? "#000000" : "#64748b"} floodOpacity={isDark ? "0.4" : "0.15"} />
          </filter>
        </defs>

        {/* Squircle Rounded Container */}
        <rect
          x="3"
          y="3"
          width="114"
          height="114"
          rx="28"
          fill={`url(#${isDark ? 'azDarkBg' : 'azLightBg'})`}
          stroke={isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)'}
          strokeWidth="3"
        />

        {/* 3D Geometric AZ Monogram Symbol */}
        <g filter="url(#azShadow)">
          {/* Top Apex of Letter A */}
          <path
            d="M 64 24 L 79 46 L 68 46 L 58 31 L 43 53 L 34 53 Z"
            fill={`url(#${isDark ? 'azSymbolDark' : 'azSymbolLight'})`}
          />

          {/* Letter Z - Top Horizontal Bar and Diagonal */}
          <path
            d="M 52 45 L 97 45 L 97 53 L 57 80 L 97 80 L 97 89 L 45 89 L 45 81 L 82 54 L 52 54 Z"
            fill={`url(#${isDark ? 'azSymbolDark' : 'azSymbolLight'})`}
          />

          {/* Stepped 3D Printing Strata Layers on Lower-Left of A */}
          {/* Layer 1 (Top) */}
          <path
            d="M 33 59 L 43 59 L 55 77 L 46 77 Z"
            fill={`url(#${isDark ? 'azSymbolDark' : 'azSymbolLight'})`}
          />

          {/* Layer 2 (Middle Stepped Strata) */}
          <path
            d="M 28 67 L 36 67 L 48 85 L 40 85 Z"
            fill={`url(#${isDark ? 'azSymbolDark' : 'azSymbolLight'})`}
          />

          {/* Layer 3 (Bottom Stepped Strata) */}
          <path
            d="M 23 75 L 30 75 L 41 91 L 33 91 Z"
            fill={`url(#${isDark ? 'azSymbolDark' : 'azSymbolLight'})`}
          />
        </g>
      </svg>

      {showText && (
        <span className={`text-xl font-extrabold tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
          AZ<span className="font-mono text-cyan-500">3D</span>
        </span>
      )}
    </div>
  );
};
