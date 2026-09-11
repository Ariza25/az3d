import React, { useState, forwardRef } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'laser' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  onError?: (error: unknown) => void;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white text-chumbo-950 hover:bg-slate-200 border border-transparent shadow-sm',
  secondary: 'bg-chumbo-950 text-slate-200 border border-chumbo-700 hover:bg-chumbo-800',
  ghost: 'bg-transparent text-slate-400 border border-transparent hover:bg-chumbo-800 hover:text-white',
  danger: 'bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20',
  accent: 'bg-laser-400 text-chumbo-950 border border-transparent hover:bg-laser-300 font-extrabold shadow-md shadow-laser-500/10',
  laser: 'bg-laser-400 text-chumbo-950 border border-transparent hover:bg-laser-300 font-extrabold shadow-md shadow-laser-500/10',
  outline: 'bg-transparent text-slate-200 border border-chumbo-700 hover:bg-chumbo-900 hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[11px] gap-1.5',
  md: 'px-4 py-2.5 text-xs gap-2',
  lg: 'px-5 py-3 text-sm gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth,
  loading: externalLoading,
  loadingText,
  className,
  children,
  disabled,
  onClick,
  onError,
  type = 'button',
  ...props
}, ref) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = Boolean(externalLoading ?? internalLoading);
  const isDisabled = Boolean(disabled || isLoading);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled || !onClick) return;

    try {
      const result: unknown = onClick(event);
      if (result instanceof Promise || (typeof result === 'object' && result !== null && 'then' in (result as Record<string, unknown>))) {
        setInternalLoading(true);
        await result;
      }
    } catch (err) {
      if (onError) {
        onError(err);
      } else {
        console.error('Erro na execução do botão:', err);
      }
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-bold transition-all duration-150 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant] || variantClasses.secondary,
        sizeClasses[size] || sizeClasses.md,
        fullWidth && 'w-full',
        className
      )}
      disabled={isDisabled}
      onClick={handleClick}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
