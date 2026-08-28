import React from 'react';
import { cn } from './cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-chumbo-700 bg-chumbo-900 text-slate-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  info: 'border-laser-500/30 bg-laser-500/10 text-laser-300',
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, ...props }) => (
  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', toneClasses[tone], className)} {...props} />
);
