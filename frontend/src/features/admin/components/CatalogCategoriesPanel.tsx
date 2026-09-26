import React, { useState } from 'react';
import { Plus, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { Category } from '../../../types';
import { api } from '../../../services/api';

export interface CatalogCategoriesPanelProps {
  tenantId?: number;
  categories: Category[];
  onCreated: () => void;
  onMessage: (message: { type: 'success' | 'error'; text: string }) => void;
}

export const CatalogCategoriesPanel: React.FC<CatalogCategoriesPanelProps> = ({
  tenantId,
  categories,
  onCreated,
  onMessage,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!tenantId) {
      setFormError('Tenant não identificado.');
      return;
    }
    if (!trimmedName) {
      setFormError('Informe o nome da categoria.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await api.createCategory({ name: trimmedName, description: description.trim(), icon: 'box' }, tenantId);
      onMessage({ type: 'success', text: `Categoria "${trimmedName}" criada com sucesso.` });
      setName('');
      setDescription('');
      setFormError(null);
      onCreated();
      window.dispatchEvent(new CustomEvent('az3d:categories-changed', { detail: { tenantId } }));
    } catch (error: any) {
      const errorText = error.message || 'Não foi possível criar a categoria.';
      setFormError(errorText);
      onMessage({ type: 'error', text: errorText });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-6 border-t border-chumbo-800 pt-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Categorias do catálogo</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Organização e regras de agrupamento dos produtos da loja.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950">
          <h4 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Plus className="h-4 w-4 text-cyan-700 dark:text-laser-400" /> Nova categoria
          </h4>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span className="leading-tight">{formError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">Nome da categoria *</label>
            <input
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Ex: Colecionáveis, Geek, Utilidades..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-cyan-700 focus:outline-none dark:border-chumbo-800 dark:bg-chumbo-900 dark:text-white dark:placeholder-slate-500 dark:focus:border-laser-400"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">Descrição (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição da categoria"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-cyan-700 focus:outline-none dark:border-chumbo-800 dark:bg-chumbo-900 dark:text-white dark:placeholder-slate-500 dark:focus:border-laser-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-800 disabled:opacity-50 dark:bg-white dark:text-chumbo-950 dark:hover:bg-slate-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Salvando categoria...</span>
              </>
            ) : (
              <span>Salvar categoria</span>
            )}
          </button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
          {categories.length === 0 ? (
            <div className="col-span-2 flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 dark:border-chumbo-800 dark:text-slate-400">
              Nenhuma categoria cadastrada para esta loja. Use o formulário ao lado para criar a primeira.
            </div>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/80">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-cyan-700 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-laser-400">
                  <Tag className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">{category.name}</h4>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{category.description || 'Sem descrição'}</p>
                  <span className="mt-1 block text-[10px] font-mono text-slate-500 dark:text-slate-500">{category.slug}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
