import React, { useEffect, useState } from 'react';
import { FilamentSpool, FilamentUsageLog } from '../../../types';
import {
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  Scale,
  Loader2,
  History,
  Search,
  X,
  Sparkles,
  MinusCircle,
  Package,
} from 'lucide-react';
import { money } from '../../../shared/storePresentation';
import { api } from '../../../services/api';

interface TenantFilamentInventoryPanelProps {
  tenantId?: number;
}

const COMMON_VENDORS = [
  'Voolt3D',
  'eSun',
  'Polymaker',
  '3D Fila',
  'Creality',
  'Bambu Lab',
  'Sunlu',
  'PrintaLot',
];

export const TenantFilamentInventoryPanel: React.FC<TenantFilamentInventoryPanelProps> = ({ tenantId }) => {
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState('ALL');

  // New Spool Form State
  const [newSpoolName, setNewSpoolName] = useState('');
  const [newVendor, setNewVendor] = useState('Voolt3D');
  const [newMaterialType, setNewMaterialType] = useState('PLA');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#3b82f6');
  const [newPricePerKg, setNewPricePerKg] = useState(115);
  const [newWeightG, setNewWeightG] = useState(1000);

  // History Logs Modal State
  const [selectedSpoolForLogs, setSelectedSpoolForLogs] = useState<FilamentSpool | null>(null);
  const [spoolLogs, setSpoolLogs] = useState<FilamentUsageLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Manual Deduct Modal State
  const [spoolToDeduct, setSpoolToDeduct] = useState<FilamentSpool | null>(null);
  const [deductGrams, setDeductGrams] = useState<number>(50);
  const [deductReason, setDeductReason] = useState('Impressão de teste / calibração');
  const [isDeducting, setIsDeducting] = useState(false);

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
          vendor: newVendor,
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
    if (!confirm('Deseja realmente excluir este carretel?')) return;
    try {
      await api.deleteFilamentSpool(id, tenantId);
      setSpools(spools.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Erro ao excluir insumo:', err);
    }
  };

  const handleOpenLogs = async (spool: FilamentSpool) => {
    setSelectedSpoolForLogs(spool);
    setIsLoadingLogs(true);
    try {
      const logs = await api.getFilamentLogs(spool.id, tenantId);
      setSpoolLogs(logs || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setSpoolLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleManualDeduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spoolToDeduct || deductGrams <= 0) return;

    setIsDeducting(true);
    try {
      await api.deductFilament(
        {
          spool_id: spoolToDeduct.id,
          grams: deductGrams,
          description: deductReason,
        },
        tenantId
      );
      setSpoolToDeduct(null);
      await loadSpools();
    } catch (err: any) {
      alert(err.message || 'Erro ao abater filamento');
    } finally {
      setIsDeducting(false);
    }
  };

  const filteredSpools = spools.filter((spool) => {
    const matchesSearch =
      searchQuery === '' ||
      spool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spool.color_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (spool.vendor && spool.vendor.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMaterial = materialFilter === 'ALL' || spool.material_type === materialFilter;

    return matchesSearch && matchesMaterial;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-laser-500/20 dark:text-laser-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Controle Inteligente de Carretéis & Filamentos
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Rastreie gramas restantes, autonomia e consumo automático por pedido impresso
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(!isAddOpen)}
          className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-cyan-800 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Novo Carretel</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por marca, cor ou nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {['ALL', 'PLA', 'PETG', 'ABS', 'TPU', 'Resin'].map((mat) => (
            <button
              key={mat}
              type="button"
              onClick={() => setMaterialFilter(mat)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                materialFilter === mat
                  ? 'bg-cyan-700 text-white dark:bg-laser-400 dark:text-chumbo-950'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-chumbo-800 dark:bg-chumbo-950 dark:text-slate-400'
              }`}
            >
              {mat === 'ALL' ? 'Todos os Polímeros' : mat}
            </button>
          ))}
        </div>
      </div>

      {/* Form Add Spool */}
      {isAddOpen && (
        <form onSubmit={handleAddSpool} className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm space-y-4 dark:border-laser-500/30 dark:bg-chumbo-900">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="h-4 w-4 text-cyan-700 dark:text-laser-400" />
            <span>Novo Carretel de Filamento na Oficina</span>
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome / Identificador</label>
              <input
                type="text"
                placeholder="Ex: PLA Silk Ouro Bancada 1"
                value={newSpoolName}
                onChange={(e) => setNewSpoolName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fabricante / Marca</label>
              <div className="relative">
                <input
                  type="text"
                  list="vendor-suggestions"
                  placeholder="Ex: Voolt3D, eSun, Polymaker..."
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
                />
                <datalist id="vendor-suggestions">
                  {COMMON_VENDORS.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tipo de Polímero</label>
              <select
                value={newMaterialType}
                onChange={(e) => setNewMaterialType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
              >
                <option value="PLA">PLA (Standard)</option>
                <option value="PETG">PETG (Resistente)</option>
                <option value="ABS">ABS (Térmico)</option>
                <option value="TPU">TPU (Flexível)</option>
                <option value="Resin">Resina UV (Fotopolímero)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome da Cor</label>
              <input
                type="text"
                placeholder="Ex: Dourado Seda / Silk Gold"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Preço Pago por KG (R$)</label>
              <input
                type="number"
                value={newPricePerKg}
                onChange={(e) => setNewPricePerKg(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Peso Total (Gramas)</label>
              <input
                type="number"
                value={newWeightG}
                onChange={(e) => setNewWeightG(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cor Visual (Hex)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="h-9 w-12 rounded border border-slate-200 bg-white p-1 dark:border-chumbo-700 dark:bg-chumbo-950"
                />
                <input
                  type="text"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono text-slate-900 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-chumbo-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-chumbo-700 dark:text-slate-400 dark:hover:bg-chumbo-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-cyan-700 px-5 py-2 text-xs font-extrabold text-white hover:bg-cyan-800 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300"
            >
              Salvar Carretel
            </button>
          </div>
        </form>
      )}

      {/* Spools Inventory Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700 dark:text-laser-400 mr-2" />
          <span className="text-xs font-mono">Carregando carretéis do PostgreSQL...</span>
        </div>
      ) : filteredSpools.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/40 dark:text-slate-400">
          <Layers className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <p className="font-semibold text-slate-900 dark:text-white">Nenhum carretel encontrado</p>
          <p className="mt-1 text-xs">Ajuste os filtros ou cadastre um novo carretel de filamento.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSpools.map((spool) => {
            const percentLeft = Math.round((spool.remaining_weight_g / spool.spool_weight_g) * 100);
            const isCritical = spool.remaining_weight_g < 100;
            const isLow = spool.remaining_weight_g < 250;
            const estPieces150g = Math.floor(spool.remaining_weight_g / 150);

            return (
              <div
                key={spool.id}
                className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-chumbo-800 dark:bg-chumbo-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-black/20 shadow-sm"
                        style={{ backgroundColor: spool.color_hex }}
                      />
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-slate-900 dark:text-white" title={spool.name}>
                          {spool.name}
                        </strong>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-bold">{spool.material_type}</span>
                          <span>•</span>
                          <span>{spool.color_name}</span>
                          {spool.vendor && (
                            <>
                              <span>•</span>
                              <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-700 dark:bg-chumbo-800 dark:text-slate-300">
                                {spool.vendor}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSpool(spool.id)}
                      className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 p-1 shrink-0"
                      title="Excluir carretel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Progress Bar & Weight */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Restante:</span>
                      <span
                        className={`font-mono font-bold ${
                          isCritical
                            ? 'text-rose-600 dark:text-rose-400'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {Math.round(spool.remaining_weight_g)}g / {spool.spool_weight_g}g ({percentLeft}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-chumbo-950">
                      <div
                        className={`h-full transition-all ${
                          isCritical
                            ? 'bg-rose-500'
                            : isLow
                            ? 'bg-amber-500'
                            : 'bg-cyan-600 dark:bg-laser-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percentLeft))}%` }}
                      />
                    </div>
                  </div>

                  {/* Autonomy Badge */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                      <Sparkles className="h-3 w-3 text-cyan-600 dark:text-laser-400" />
                      <span>Autonomia estimada:</span>
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      ~{estPieces150g} peças (médias 150g)
                    </span>
                  </div>

                  {/* Alert banner if low */}
                  {isLow && (
                    <div
                      className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold p-2 rounded-lg border ${
                        isCritical
                          ? 'text-rose-700 bg-rose-50 border-rose-300 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                          : 'text-amber-800 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800'
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {isCritical
                          ? 'Atenção: nível crítico (< 100g)!'
                          : 'Estoque de filamento baixo (< 250g)!'}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-xs dark:border-chumbo-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Custo/kg:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {money(spool.price_per_kg)}
                    </span>
                  </div>
                </div>

                {/* Actions: Abate Manual & Histórico */}
                <div className="mt-3 flex gap-1.5 pt-1 border-t border-slate-100 dark:border-chumbo-800/50">
                  <button
                    type="button"
                    onClick={() => {
                      setSpoolToDeduct(spool);
                      setDeductGrams(50);
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-slate-300 dark:hover:bg-chumbo-800"
                  >
                    <MinusCircle className="h-3.5 w-3.5 text-cyan-600 dark:text-laser-400" />
                    <span>Abater</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenLogs(spool)}
                    className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800"
                    title="Ver histórico de consumo"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Histórico</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Histórico de Consumo */}
      {selectedSpoolForLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-chumbo-700 dark:bg-chumbo-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-chumbo-800">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border shadow-sm"
                  style={{ backgroundColor: selectedSpoolForLogs.color_hex }}
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Histórico de Consumo: {selectedSpoolForLogs.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Restante: {selectedSpoolForLogs.remaining_weight_g}g de {selectedSpoolForLogs.spool_weight_g}g
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpoolForLogs(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-cyan-600 dark:text-laser-400" />
                  <span>Carregando histórico...</span>
                </div>
              ) : spoolLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Package className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <span>Nenhum registro de consumo para este carretel ainda.</span>
                </div>
              ) : (
                spoolLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-chumbo-800 dark:bg-chumbo-950"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {log.description}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{log.grams_used}g
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 dark:border-chumbo-800">
              <button
                type="button"
                onClick={() => setSelectedSpoolForLogs(null)}
                className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-chumbo-800 dark:text-slate-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abate Manual */}
      {spoolToDeduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleManualDeduct}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 dark:border-chumbo-700 dark:bg-chumbo-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-chumbo-800">
              <div className="flex items-center gap-2">
                <MinusCircle className="h-5 w-5 text-cyan-600 dark:text-laser-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Abater Filamento: {spoolToDeduct.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSpoolToDeduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Quantidade a Abater (Gramas)
                </label>
                <input
                  type="number"
                  min="1"
                  max={spoolToDeduct.remaining_weight_g}
                  value={deductGrams}
                  onChange={(e) => setDeductGrams(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-mono font-bold text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Saldo atual: {spoolToDeduct.remaining_weight_g}g ➔ Ficará com:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.max(0, spoolToDeduct.remaining_weight_g - deductGrams)}g
                  </strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Motivo / Descrição
                </label>
                <input
                  type="text"
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  placeholder="Ex: Peça de teste, falha de impressão, etc."
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-chumbo-700 dark:bg-chumbo-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-chumbo-800">
              <button
                type="button"
                onClick={() => setSpoolToDeduct(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-chumbo-700 dark:text-slate-400 dark:hover:bg-chumbo-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isDeducting || deductGrams <= 0}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-cyan-800 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300 disabled:opacity-50"
              >
                {isDeducting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
                <span>Confirmar Abate</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
