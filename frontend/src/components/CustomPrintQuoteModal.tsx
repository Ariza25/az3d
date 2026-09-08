import React, { useState } from 'react';
import { X, UploadCloud, FileCheck, Layers, Cpu, Check, Loader2 } from 'lucide-react';
import { money } from '../shared/storePresentation';
import { api } from '../services/api';

interface CustomPrintQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomPrintQuoteModal: React.FC<CustomPrintQuoteModalProps> = ({ isOpen, onClose }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeMb, setFileSizeMb] = useState<number>(0);
  const [material, setMaterial] = useState<'PLA' | 'ABS' | 'PETG' | 'TPU' | 'Resin'>('PLA');
  const [infill, setInfill] = useState<number>(20);
  const [estimatedWeightG, setEstimatedWeightG] = useState<number>(45);
  const [estimatedHours, setEstimatedHours] = useState<number>(3.5);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(68.0);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const mb = parseFloat((file.size / (1024 * 1024)).toFixed(2));
    setFileSizeMb(mb);

    const mockVolumeG = Math.round(Math.max(15, mb * 12 + 10));
    const mockHours = parseFloat((mockVolumeG / 15).toFixed(1));
    setEstimatedWeightG(mockVolumeG);
    setEstimatedHours(mockHours);

    const matMultiplier = material === 'Resin' ? 1.8 : material === 'PETG' ? 1.3 : material === 'TPU' ? 1.5 : 1.0;
    const calculatedPrice = (mockVolumeG * 0.45 + mockHours * 12) * matMultiplier;
    setEstimatedPrice(Math.round(calculatedPrice));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName) return;

    setIsSubmitting(true);
    try {
      await api.createCustom3DQuote({
        file_name: fileName,
        file_size_mb: fileSizeMb,
        material_type: material,
        infill_percent: infill,
        estimated_weight_g: estimatedWeightG,
        estimated_hours: estimatedHours,
        estimated_price: estimatedPrice,
        customer_email: customerEmail,
      });
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        onClose();
      }, 2500);
    } catch (err) {
      console.error('Erro ao enviar solicitação de orçamento:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-chumbo-800 bg-chumbo-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-chumbo-800 px-6 py-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-white">
            <Layers className="h-5 w-5 text-laser-400" />
            <span>Orçamento de Impressão 3D Customizada</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-chumbo-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>
            <h3 className="text-xl font-bold text-white">Solicitação de Orçamento Enviada!</h3>
            <p className="mt-2 text-sm text-slate-400">
              Nossa equipe analisará a malha 3D e entrará em contato para aprovação.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* File Dropzone */}
            <div className="relative rounded-xl border-2 border-dashed border-chumbo-700 bg-chumbo-900/50 p-6 text-center transition-colors hover:border-laser-500/60">
              <input
                type="file"
                accept=".stl,.3mf,.obj"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {fileName ? (
                <div className="flex items-center justify-center gap-3 text-laser-400 font-medium">
                  <FileCheck className="h-6 w-6" />
                  <span className="truncate max-w-xs">{fileName}</span>
                  <span className="text-xs text-slate-400 font-mono">({fileSizeMb} MB)</span>
                </div>
              ) : (
                <div>
                  <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-white">Clique ou arraste seu arquivo .STL, .3MF ou .OBJ</p>
                  <p className="mt-1 text-xs text-slate-400">Tamanho máximo: 50MB per file</p>
                </div>
              )}
            </div>

            {/* Print Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Material
                </label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value as any)}
                  className="w-full rounded-lg border border-chumbo-700 bg-chumbo-900 px-3 py-2 text-sm font-semibold text-white focus:border-laser-500 focus:outline-none"
                >
                  <option value="PLA">PLA (Resistente & Ecológico)</option>
                  <option value="ABS">ABS (Alta Resistência Térmica)</option>
                  <option value="PETG">PETG (Durável e Flexível)</option>
                  <option value="TPU">TPU (Flexível / Emborrachado)</option>
                  <option value="Resin">Resina UV (Ultra Alta Precisão)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Preenchimento (Infill)
                </label>
                <select
                  value={infill}
                  onChange={(e) => setInfill(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-chumbo-700 bg-chumbo-900 px-3 py-2 text-sm font-semibold text-white focus:border-laser-500 focus:outline-none"
                >
                  <option value={15}>15% (Padrão Decorativo)</option>
                  <option value={50}>50% (Reforçado / Mecânico)</option>
                  <option value={100}>100% (Sólido Extremo)</option>
                </select>
              </div>
            </div>

            {/* Fatiamento Simulado */}
            {fileName && (
              <div className="rounded-xl border border-chumbo-800 bg-chumbo-900/80 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-laser-400" />
                  <span>Análise de Fatiamento Estimado</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-chumbo-950 p-2">
                    <span className="block text-slate-400">Peso Est.</span>
                    <strong className="text-white font-mono">{estimatedWeightG}g</strong>
                  </div>
                  <div className="rounded-lg bg-chumbo-950 p-2">
                    <span className="block text-slate-400">Tempo Est.</span>
                    <strong className="text-white font-mono">{estimatedHours}h</strong>
                  </div>
                  <div className="rounded-lg bg-chumbo-950 p-2">
                    <span className="block text-slate-400">Orçamento Est.</span>
                    <strong className="text-laser-400 font-mono font-bold">{money(estimatedPrice)}</strong>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                E-mail para Contato (Opcional)
              </label>
              <input
                type="email"
                placeholder="seu.email@exemplo.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border border-chumbo-700 bg-chumbo-900 px-3 py-2 text-sm text-white focus:border-laser-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-chumbo-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-chumbo-700 bg-chumbo-900 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-chumbo-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!fileName || isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-laser-500 px-5 py-2 text-xs font-extrabold text-chumbo-950 hover:bg-laser-400 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Enviando ao PostgreSQL...</span>
                  </>
                ) : (
                  <span>Solicitar Orçamento</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
