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
    className={cn('rounded-2xl border border-chumbo-800 bg-chumbo-950/60', padded && 'p-4', className)}
    {...props}
  />
  );
};
