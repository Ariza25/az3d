import React from 'react';
import { Card } from './Card';
import { cn } from './cn';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const valueTone = {
  default: 'text-slate-900 dark:text-white',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-rose-700 dark:text-rose-300',
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, tone = 'default' }) => (
  <Card className="bg-white border-slate-200 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70 dark:shadow-none">
    <span className="block text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">{label}</span>
    <strong className={cn('mt-1 block text-xl font-extrabold', valueTone[tone])}>{value}</strong>
  </Card>
);
