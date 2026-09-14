import React from 'react';
import { cn } from './cn';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  padded?: boolean;
  asForm?: boolean;
}

export const Card: React.FC<CardProps> = ({ padded = true, asForm, className, ...props }) => {
  const Element = asForm ? 'form' : 'div';
  return (
  <Element
    className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/60 dark:shadow-none', padded && 'p-4', className)}
    {...props}
  />
  );
};
