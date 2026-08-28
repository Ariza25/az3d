import React from 'react';
import { cn } from './cn';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({ label, icon, className, ...props }) => (
  <button
    aria-label={label}
    title={label}
    className={cn(
      'inline-flex h-10 w-10 items-center justify-center rounded-full border border-chumbo-700 bg-chumbo-900 text-slate-400 transition-colors hover:text-white',
      className
    )}
    {...props}
  >
    {icon}
  </button>
);
