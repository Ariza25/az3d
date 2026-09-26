import React, { useEffect, useState } from 'react';
import { FilamentSpool, FilamentUsageLog } from '../../../types';
import {
  Layers,
  Loader2,
} from 'lucide-react';
import { api } from '../../../services/api';
import {
  FilamentAddSpoolForm,
  FilamentFilterBar,
  FilamentInventoryHeader,
  FilamentLogsModal,
  FilamentManualDeductModal,
  FilamentSpoolCard,
} from './filament-inventory';

interface TenantFilamentInventoryPanelProps {
  tenantId?: number;
}

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
      <FilamentInventoryHeader
        isAddOpen={isAddOpen}
        onToggleAdd={() => setIsAddOpen(!isAddOpen)}
      />

      <FilamentFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        materialFilter={materialFilter}
        onMaterialFilterChange={setMaterialFilter}
      />

      {isAddOpen && (
        <FilamentAddSpoolForm
          newSpoolName={newSpoolName}
          setNewSpoolName={setNewSpoolName}
          newVendor={newVendor}
          setNewVendor={setNewVendor}
          newMaterialType={newMaterialType}
          setNewMaterialType={setNewMaterialType}
          newColorName={newColorName}
          setNewColorName={setNewColorName}
          newColorHex={newColorHex}
          setNewColorHex={setNewColorHex}
          newPricePerKg={newPricePerKg}
          setNewPricePerKg={setNewPricePerKg}
          newWeightG={newWeightG}
          setNewWeightG={setNewWeightG}
          onSubmit={handleAddSpool}
          onCancel={() => setIsAddOpen(false)}
        />
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
          {filteredSpools.map((spool) => (
            <FilamentSpoolCard
              key={spool.id}
              spool={spool}
              onDelete={handleDeleteSpool}
              onOpenDeduct={(s) => {
                setSpoolToDeduct(s);
                setDeductGrams(50);
              }}
              onOpenLogs={handleOpenLogs}
            />
          ))}
        </div>
      )}

      {selectedSpoolForLogs && (
        <FilamentLogsModal
          spool={selectedSpoolForLogs}
          logs={spoolLogs}
          isLoading={isLoadingLogs}
          onClose={() => setSelectedSpoolForLogs(null)}
        />
      )}

      {spoolToDeduct && (
        <FilamentManualDeductModal
          spool={spoolToDeduct}
          deductGrams={deductGrams}
          setDeductGrams={setDeductGrams}
          deductReason={deductReason}
          setDeductReason={setDeductReason}
          isDeducting={isDeducting}
          onSubmit={handleManualDeduct}
          onClose={() => setSpoolToDeduct(null)}
        />
      )}
    </div>
  );
};
