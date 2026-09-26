import React from 'react';
import { Check } from 'lucide-react';

export interface AvailableColorOption {
  name: string;
  imageUrl: string;
  hex: string;
  border: string;
}

interface ProductColorSelectorProps {
  availableColors: AvailableColorOption[];
  selectedColor: string;
  onSelectColor: (colorName: string) => void;
}

export const ProductColorSelector: React.FC<ProductColorSelectorProps> = ({
  availableColors,
  selectedColor,
  onSelectColor,
}) => {
  if (availableColors.length <= 1) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cor</span>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
          <span
            className="h-4 w-4 rounded-full border"
            style={{
              backgroundColor: availableColors[0]?.hex || '#ffffff',
              borderColor: availableColors[0]?.border || '#cccccc',
            }}
          />
          {selectedColor}
        </span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-300">
        Cor: <strong className="font-bold text-white">{selectedColor}</strong>
      </p>
      <div
        className="mt-2.5 flex flex-wrap items-center gap-2 sm:gap-2.5"
        role="group"
        aria-label="Escolha a cor"
      >
        {availableColors.map((color) => (
          <button
            type="button"
            key={color.name}
            onClick={() => onSelectColor(color.name)}
            onMouseEnter={() => onSelectColor(color.name)}
            className={`relative h-13 w-13 sm:h-16 sm:w-16 overflow-hidden rounded-xl border-2 bg-chumbo-950 p-0.5 transition ${
              selectedColor === color.name
                ? 'border-laser-400 shadow-[0_0_0_2px_rgba(34,211,238,0.16)] scale-105'
                : 'border-chumbo-700 hover:border-chumbo-500'
            }`}
            title={color.name}
            aria-label={`Selecionar cor ${color.name}`}
            aria-pressed={selectedColor === color.name}
          >
            <img
              src={color.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full rounded-lg object-cover"
            />
            <span
              className="absolute bottom-1.5 left-1.5 h-3 w-3 rounded-full border shadow-sm"
              style={{ backgroundColor: color.hex, borderColor: color.border }}
              aria-hidden="true"
            />
            {selectedColor === color.name && (
              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-laser-400 text-chumbo-950 shadow-md">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
