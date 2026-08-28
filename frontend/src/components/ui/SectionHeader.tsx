import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, action }) => (
  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
    <div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
    {action}
  </div>
);
