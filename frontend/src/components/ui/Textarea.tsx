import React from 'react';
import { cn } from './cn';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, hint, className, id, ...props }) => {
  const textareaId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label className="block text-xs text-slate-300" htmlFor={textareaId}>
      {label && <span className="mb-1 block font-bold text-slate-300">{label}</span>}
      <textarea
        id={textareaId}
        className={cn(
          'w-full rounded-xl border border-chumbo-800 bg-chumbo-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-laser-400',
          className
        )}
        {...props}
      />
      {hint && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
};
