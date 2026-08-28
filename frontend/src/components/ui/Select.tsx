import React from 'react';
import { cn } from './cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}

export const Select: React.FC<SelectProps> = ({ label, hint, className, id, children, ...props }) => {
  const selectId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label className="block text-xs text-slate-300" htmlFor={selectId}>
      {label && <span className="mb-1 block font-bold text-slate-300">{label}</span>}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-laser-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {hint && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
};
