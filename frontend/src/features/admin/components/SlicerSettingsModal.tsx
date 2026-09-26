import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Zap,
  Sparkles,
  TreePine,
  SlidersHorizontal,
  Layers,
  Info,
} from 'lucide-react';
import { SlicerConfigDetails } from '../../../types';

export interface SlicerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: SlicerConfigDetails | null;
  rawJson?: string | null;
  title?: string;
  slicerName?: string;
}

type TabType = 'strength' | 'speed' | 'quality' | 'support' | 'others';

export const SlicerSettingsModal: React.FC<SlicerSettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  rawJson,
  title = 'Configurações de Fatiamento (.3MF)',
  slicerName = 'Bambu Studio / OrcaSlicer',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('strength');

  // Try parsing rawJson if initialSettings is not passed
  let settings = initialSettings;
  if (!settings && rawJson) {
    try {
      settings = JSON.parse(rawJson) as SlicerConfigDetails;
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'strength', label: 'Força', icon: <Shield className="h-4 w-4" /> },
    { id: 'speed', label: 'Velocidade', icon: <Zap className="h-4 w-4" /> },
    { id: 'quality', label: 'Qualidade', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'support', label: 'Suporte', icon: <TreePine className="h-4 w-4" /> },
    { id: 'others', label: 'Outros', icon: <SlidersHorizontal className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-chumbo-800 dark:bg-chumbo-950 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-chumbo-850">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-cyan-700 dark:text-laser-400" />
                <span>{title}</span>
              </h3>
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-800 dark:bg-laser-500/20 dark:text-laser-300">
                {slicerName}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parâmetros e configurações físicas extraídos do projeto fatiado
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-chumbo-850 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 px-5 dark:border-chumbo-850 dark:bg-chumbo-900/40 gap-2 overflow-x-auto py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-cyan-700 text-white shadow-sm dark:bg-laser-400 dark:text-chumbo-950 font-bold'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-chumbo-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'strength' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingCard
                title="Paredes (Wall Loops)"
                value={settings?.strength?.wall_loops || 'Padrão (2-3)'}
                desc="Número de perímetros externos que definem a rigidez lateral da peça."
              />
              <SettingCard
                title="Densidade de Infill"
                value={settings?.strength?.infill_density || '15%'}
                desc="Porcentagem de preenchimento interno da estrutura."
              />
              <SettingCard
                title="Padrão de Infill"
                value={settings?.strength?.infill_pattern || 'Gyroid'}
                desc="Geometria da malha interna (Gyroid, Grid, Honeycomb)."
              />
              <SettingCard
                title="Camadas Superiores (Top Shell)"
                value={settings?.strength?.top_shell_layers || 'Padrão (4)'}
                desc="Quantidade de camadas sólidas no topo para acabamento perfeito."
              />
              <SettingCard
                title="Camadas Inferiores (Bottom Shell)"
                value={settings?.strength?.bottom_shell_layers || 'Padrão (3)'}
                desc="Quantidade de camadas sólidas de base em contato com a mesa."
              />
            </div>
          )}

          {activeTab === 'speed' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingCard
                title="Parede Externa (Outer Wall)"
                value={settings?.speed?.outer_wall_speed || '100-150 mm/s'}
                desc="Velocidade da camada visível para garantir acabamento estético."
              />
              <SettingCard
                title="Parede Interna (Inner Wall)"
                value={settings?.speed?.inner_wall_speed || '200-250 mm/s'}
                desc="Velocidade das paredes intermediárias estruturais."
              />
              <SettingCard
                title="Preenchimento (Infill Speed)"
                value={settings?.speed?.infill_speed || '250-270 mm/s'}
                desc="Velocidade de deposição da malha interna."
              />
              <SettingCard
                title="Deslocamento (Travel Speed)"
                value={settings?.speed?.travel_speed || '400-500 mm/s'}
                desc="Velocidade de movimentação do cabeçote sem extrusão."
              />
              <SettingCard
                title="Primeira Camada (Initial Layer)"
                value={settings?.speed?.initial_layer_speed || '50 mm/s'}
                desc="Velocidade reduzida para garantir aderência inicial perfeita na mesa."
              />
            </div>
          )}

          {activeTab === 'quality' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingCard
                title="Altura de Camada (Layer Height)"
                value={settings?.quality?.layer_height || '0.16mm'}
                desc="Resolução vertical das linhas de impressão."
              />
              <SettingCard
                title="Primeira Camada (First Layer)"
                value={settings?.quality?.initial_layer_height || '0.20mm'}
                desc="Espessura da camada inicial de adesão à mesa."
              />
              <SettingCard
                title="Largura de Linha (Line Width)"
                value={settings?.quality?.line_width || '0.42mm'}
                desc="Largura do cordão de plástico extrudado pelo bico."
              />
              <SettingCard
                title="Posição da Costura (Seam)"
                value={settings?.quality?.seam_position || 'Alinhada / Traseira'}
                desc="Ponto onde cada camada inicia e finaliza."
              />
            </div>
          )}

          {activeTab === 'support' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingCard
                title="Status do Suporte"
                value={settings?.support?.enabled ? 'Ativado ✅' : 'Desativado ❌'}
                desc="Indica se o fatiador gerou colunas de suporte para balanços (overhangs)."
              />
              {settings?.support?.enabled && (
                <>
                  <SettingCard
                    title="Tipo de Suporte"
                    value={settings?.support?.support_type || 'Árvore (Tree)'}
                    desc="Árvore (orgânico, fácil de remover) ou Normal (grid tradicional)."
                  />
                  <SettingCard
                    title="Estilo"
                    value={settings?.support?.support_style || 'Tree Slim / Hybrid'}
                    desc="Variação anatômica do tronco e galhos de suporte."
                  />
                  <SettingCard
                    title="Ângulo Limite (Threshold Angle)"
                    value={settings?.support?.threshold_angle || '30°'}
                    desc="Inclinações abaixo deste ângulo recebem suporte automaticamente."
                  />
                </>
              )}
            </div>
          )}

          {activeTab === 'others' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingCard
                title="Impressora Detectada"
                value={settings?.others?.printer_model || 'Bambu Lab / Orca Profile'}
                desc="Perfil de hardware e cinemática da impressora utilizada."
              />
              <SettingCard
                title="Diâmetro do Bico (Nozzle)"
                value={settings?.others?.nozzle_diameter || '0.40mm'}
                desc="Abertura do bico extrusor instalado."
              />
              <SettingCard
                title="Temperatura do Bico"
                value={settings?.others?.nozzle_temperature || '220 °C'}
                desc="Temperatura de fusão do filamento no hotend."
              />
              <SettingCard
                title="Temperatura da Mesa (Bed)"
                value={settings?.others?.bed_temperature || '60 °C'}
                desc="Temperatura da base de impressão para evitar warping/descolamento."
              />
              <SettingCard
                title="Aba de Fixação (Brim / Raft)"
                value={settings?.others?.brim_type || 'Automático / Nenhum'}
                desc="Borda auxiliar de aderência ao redor do modelo."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 dark:border-chumbo-850 bg-slate-50/50 dark:bg-chumbo-950/60 rounded-b-2xl">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info className="h-4 w-4 text-cyan-700 dark:text-laser-400" />
            <span>Configurações salvas permanentemente com o item.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-laser-400 dark:text-chumbo-950 dark:hover:bg-laser-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingCard = ({
  title,
  value,
  desc,
}: {
  title: string;
  value: string;
  desc: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-chumbo-800 dark:bg-chumbo-900/60">
    <span className="block text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
      {title}
    </span>
    <strong className="mt-1 block text-sm font-bold text-slate-900 dark:text-white">
      {value}
    </strong>
    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
      {desc}
    </p>
  </div>
);
