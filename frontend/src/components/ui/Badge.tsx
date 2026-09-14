import React from 'react';
import { cn } from './cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-slate-300 bg-slate-200 text-slate-800 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-slate-300',
  success: 'border-emerald-800 bg-emerald-700 text-white dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning: 'border-amber-800 bg-amber-700 text-white dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'border-rose-800 bg-rose-700 text-white dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  info: 'border-cyan-800 bg-cyan-700 text-white dark:border-laser-500/30 dark:bg-laser-500/10 dark:text-laser-300',
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, ...props }) => (
  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', toneClasses[tone], className)} {...props} />
);
