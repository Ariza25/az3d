import React from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white text-chumbo-950 hover:bg-slate-200 border border-transparent',
  secondary: 'bg-chumbo-950 text-slate-200 border border-chumbo-700 hover:bg-chumbo-800',
  ghost: 'bg-transparent text-slate-400 border border-transparent hover:bg-chumbo-800 hover:text-white',
  danger: 'bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20',
  accent: 'bg-laser-400 text-chumbo-950 border border-transparent hover:bg-laser-300',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-5 py-3 text-sm',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  fullWidth,
  loading,
  className,
  children,
  disabled,
  ...props
}) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && 'w-full',
      className
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
    {children}
  </button>
);
