import React from 'react';

interface EmptyStateProps {
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <p className="py-6 text-center text-xs text-slate-500">{message}</p>
);
