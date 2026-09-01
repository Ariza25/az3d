import React, { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { Category } from '../types';
import { api } from '../services/api';

interface Props { tenantId?: number; categories: Category[]; onCreated: () => void; onMessage: (message: { type: 'success' | 'error'; text: string }) => void; }

export const CatalogCategoriesPanel: React.FC<Props> = ({ tenantId, categories, onCreated, onMessage }) => {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [icon, setIcon] = useState('box');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!tenantId || !name.trim()) return;
    try { await api.createCategory({ name, description, icon }, tenantId); onMessage({ type: 'success', text: `Categoria "${name}" criada.` }); setName(''); setDescription(''); onCreated(); }
    catch (error: any) { onMessage({ type: 'error', text: error.message || 'Erro ao criar categoria' }); }
  };
  return <section className="mt-6 border-t border-chumbo-800 pt-6">
    <div className="mb-4"><h3 className="text-sm font-bold text-white">Categorias do catálogo</h3><p className="text-xs text-slate-400">Organização e regras de agrupamento dos produtos da loja.</p></div>
    <div className="grid gap-6 md:grid-cols-3">
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-chumbo-800 bg-chumbo-950 p-5 text-xs"><h4 className="flex items-center gap-2 font-bold text-white"><Plus className="h-4 w-4 text-laser-400" /> Nova categoria</h4><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="w-full rounded-xl border border-chumbo-800 bg-chumbo-900 px-3 py-2 text-white" /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="w-full rounded-xl border border-chumbo-800 bg-chumbo-900 px-3 py-2 text-white" /><input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Ícone" className="w-full rounded-xl border border-chumbo-800 bg-chumbo-900 px-3 py-2 text-white" /><button className="w-full rounded-xl bg-white py-2.5 font-bold text-chumbo-950">Salvar categoria</button></form>
      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">{categories.map((category) => <div key={category.id} className="flex items-start gap-3 rounded-xl border border-chumbo-800 bg-chumbo-950/80 p-4"><div className="rounded-lg border border-chumbo-700 bg-chumbo-900 p-2.5 text-laser-400"><Tag className="h-4 w-4" /></div><div><h4 className="text-sm font-bold text-white">{category.name}</h4><p className="mt-0.5 text-xs text-slate-400">{category.description || 'Sem descrição'}</p><span className="mt-1 block text-[10px] text-slate-500">{category.slug}</span></div></div>)}</div>
    </div>
  </section>;
};
