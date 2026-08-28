import React from 'react';
import { Card } from './Card';
import { cn } from './cn';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const valueTone = {
  default: 'text-white',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, tone = 'default' }) => (
  <Card className="bg-chumbo-950/70">
    <span className="block text-[10px] font-mono uppercase text-slate-500">{label}</span>
    <strong className={cn('mt-1 block text-xl', valueTone[tone])}>{value}</strong>
  </Card>
);
