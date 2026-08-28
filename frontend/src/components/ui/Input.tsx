import React from 'react';
import { cn } from './cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, hint, error, leftIcon, className, id, ...props }) => {
  const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label className="block text-xs text-slate-300" htmlFor={inputId}>
      {label && <span className="mb-1 block font-bold text-slate-300">{label}</span>}
      <span className="relative block">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{leftIcon}</span>}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-laser-400',
            Boolean(leftIcon) && 'pl-9',
            error && 'border-rose-500/60',
            className
          )}
          {...props}
        />
      </span>
      {hint && !error && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-[10px] text-rose-300">{error}</span>}
    </label>
  );
};
