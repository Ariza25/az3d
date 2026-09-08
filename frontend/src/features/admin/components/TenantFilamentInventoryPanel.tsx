import React, { useEffect, useState } from 'react';
import { FilamentSpool } from '../../../types';
import { Layers, Plus, Trash2, AlertTriangle, Scale, Loader2 } from 'lucide-react';
import { money } from '../../../shared/storePresentation';
import { api } from '../../../services/api';

interface TenantFilamentInventoryPanelProps {
  tenantId?: number;
}

export const TenantFilamentInventoryPanel: React.FC<TenantFilamentInventoryPanelProps> = ({ tenantId }) => {
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSpoolName, setNewSpoolName] = useState('');
  const [newMaterialType, setNewMaterialType] = useState('PLA');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#3b82f6');
  const [newPricePerKg, setNewPricePerKg] = useState(115);
  const [newWeightG, setNewWeightG] = useState(1000);

  const loadSpools = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFilamentSpools(tenantId);
      setSpools(data || []);
    } catch (err) {
      console.error('Falha ao carregar insumos de filamento:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSpools();
  }, [tenantId]);

  const handleAddSpool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpoolName || !newColorName) return;

    try {
      await api.createFilamentSpool(
        {
          name: newSpoolName,
          material_type: newMaterialType,
          color_name: newColorName,
          color_hex: newColorHex,
          spool_weight_g: newWeightG,
          remaining_weight_g: newWeightG,
          price_per_kg: newPricePerKg,
          is_active: true,
        },
        tenantId
      );
      setIsAddOpen(false);
      setNewSpoolName('');
      setNewColorName('');
      await loadSpools();
    } catch (err) {
      console.error('Erro ao cadastrar insumo:', err);
    }
  };

  const handleDeleteSpool = async (id: number) => {
    try {
      await api.deleteFilamentSpool(id, tenantId);
      setSpools(spools.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Erro ao excluir insumo:', err);
    }
  };

  const handleUpdateRemainingWeight = async (id: number, remainingG: number) => {
    const updatedG = Math.max(0, remainingG);
    setSpools(spools.map((s) => (s.id === id ? { ...s, remaining_weight_g: updatedG } : s)));
    try {
      await api.updateFilamentSpool(id, { remaining_weight_g: updatedG }, tenantId);
    } catch (err) {
      console.error('Erro ao atualizar peso de insumo:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-chumbo-800 bg-chumbo-900/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-laser-500/20 text-laser-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Estoque de Insumos & Filamentos 3D</h3>
            <p className="text-xs text-slate-400">Gerencie carretéis de PLA, ABS, PETG, TPU e galões de Resina</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(!isAddOpen)}
          className="flex items-center gap-1.5 rounded-xl bg-laser-400 px-4 py-2 text-xs font-extrabold text-chumbo-950 transition-all hover:bg-laser-300"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Carretel / Insumo</span>
        </button>
      </div>

      {/* Form Add Spool */}
      {isAddOpen && (
        <form onSubmit={handleAddSpool} className="rounded-2xl border border-laser-500/30 bg-chumbo-900 p-5 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Scale className="h-4 w-4 text-laser-400" />
            <span>Novo Insumo / Carretel de Filamento</span>
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome do Insumo</label>
              <input
                type="text"
                placeholder="Ex: PLA Silk Gold ESUN"
                value={newSpoolName}
                onChange={(e) => setNewSpoolName(e.target.value)}
                required
                className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 p-2 text-xs text-white focus:border-laser-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Polímero</label>
              <select
                value={newMaterialType}
                onChange={(e) => setNewMaterialType(e.target.value)}
                className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 p-2 text-xs text-white focus:border-laser-500 focus:outline-none"
              >
                <option value="PLA">PLA (Standard)</option>
                <option value="ABS">ABS (Resistente Térmico)</option>
                <option value="PETG">PETG (Resistente Químico)</option>
                <option value="TPU">TPU (Flexível)</option>
                <option value="Resin">Resina UV (Fotopolímero)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome da Cor</label>
              <input
                type="text"
                placeholder="Ex: Dourado Seda"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                required
                className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 p-2 text-xs text-white focus:border-laser-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Preço Pago por KG (R$)</label>
              <input
                type="number"
                value={newPricePerKg}
                onChange={(e) => setNewPricePerKg(parseFloat(e.target.value))}
                className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 p-2 text-xs font-mono text-white focus:border-laser-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Peso Total (Gramas)</label>
              <input
                type="number"
                value={newWeightG}
                onChange={(e) => setNewWeightG(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-chumbo-700 bg-chumbo-950 p-2 text-xs font-mono text-white focus:border-laser-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Cor Visual (Hex)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="h-9 w-12 rounded border border-chumbo-700 bg-chumbo-950 p-1"
                />
                <input
                  type="text"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="flex-1 rounded-lg border border-chumbo-700 bg-chumbo-950 p-2 text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-chumbo-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl border border-chumbo-700 px-4 py-2 text-xs font-bold text-slate-400 hover:bg-chumbo-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-laser-400 px-5 py-2 text-xs font-extrabold text-chumbo-950 hover:bg-laser-300"
            >
              Salvar Insumo
            </button>
          </div>
        </form>
      )}

      {/* Spools Inventory Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-laser-400 mr-2" />
          <span className="text-xs font-mono">Carregando insumos do PostgreSQL...</span>
        </div>
      ) : spools.length === 0 ? (
        <div className="rounded-2xl border border-chumbo-800 bg-chumbo-900/40 p-12 text-center text-slate-400">
          <Layers className="mx-auto h-10 w-10 text-slate-600 mb-2" />
          <p className="font-semibold text-white">Nenhum insumo cadastrado no banco</p>
          <p className="mt-1 text-xs">Clique no botão acima para adicionar um novo carretel de filamento.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {spools.map((spool) => {
          const percentLeft = Math.round((spool.remaining_weight_g / spool.spool_weight_g) * 100);
          const isLow = spool.remaining_weight_g < 200;

          return (
            <div key={spool.id} className="relative rounded-2xl border border-chumbo-800 bg-chumbo-900 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border shadow-sm" style={{ backgroundColor: spool.color_hex }} />
                  <div>
                    <strong className="block text-sm text-white">{spool.name}</strong>
                    <span className="text-[11px] font-semibold text-slate-400">{spool.material_type} · {spool.color_name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSpool(spool.id)}
                  className="text-slate-500 hover:text-rose-400 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Restante:</span>
                  <span className={`font-mono font-bold ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {spool.remaining_weight_g}g / {spool.spool_weight_g}g ({percentLeft}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-chumbo-950">
                  <div
                    className={`h-full transition-all ${isLow ? 'bg-rose-500' : 'bg-laser-400'}`}
                    style={{ width: `${Math.min(100, Math.max(0, percentLeft))}%` }}
                  />
                </div>
              </div>

              {isLow && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Estoque de filamento baixo!</span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-chumbo-800/80 pt-2 text-xs">
                <span className="text-slate-400">Preço Custo/kg:</span>
                <span className="font-mono font-bold text-white">{money(spool.price_per_kg)}</span>
              </div>

              {/* Botões rápidos de ajuste de peso */}
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleUpdateRemainingWeight(spool.id, spool.remaining_weight_g - 50)}
                  className="flex-1 rounded-lg border border-chumbo-700 bg-chumbo-950 py-1 text-[11px] font-semibold text-slate-300 hover:bg-chumbo-800 hover:text-white"
                >
                  -50g (Uso)
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateRemainingWeight(spool.id, spool.remaining_weight_g + 100)}
                  className="flex-1 rounded-lg border border-chumbo-700 bg-chumbo-950 py-1 text-[11px] font-semibold text-slate-300 hover:bg-chumbo-800 hover:text-white"
                >
                  +100g (Ajuste)
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
