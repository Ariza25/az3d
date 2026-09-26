import React from 'react';
import { Scale } from 'lucide-react';

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

interface FilamentAddSpoolFormProps {
  newSpoolName: string;
  setNewSpoolName: (v: string) => void;
  newVendor: string;
  setNewVendor: (v: string) => void;
  newMaterialType: string;
  setNewMaterialType: (v: string) => void;
  newColorName: string;
  setNewColorName: (v: string) => void;
  newColorHex: string;
  setNewColorHex: (v: string) => void;
  newPricePerKg: number;
  setNewPricePerKg: (v: number) => void;
  newWeightG: number;
  setNewWeightG: (v: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const FilamentAddSpoolForm: React.FC<FilamentAddSpoolFormProps> = ({
  newSpoolName,
  setNewSpoolName,
  newVendor,
  setNewVendor,
  newMaterialType,
  setNewMaterialType,
  newColorName,
  setNewColorName,
  newColorHex,
  setNewColorHex,
  newPricePerKg,
  setNewPricePerKg,
  newWeightG,
  setNewWeightG,
  onSubmit,
  onCancel,
}) => {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm space-y-4 dark:border-laser-500/30 dark:bg-chumbo-900">
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
          onClick={onCancel}
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
  );
};
