import React, { useEffect, useState } from 'react';
import {
  X,
  Calculator,
  Layers,
  Package,
  DollarSign,
  TrendingUp,
  Percent,
  History,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Product, ProductPricingSnapshot, PrintingPricingResult } from '../../../types';
import { api } from '../../../services/api';
import {
  DEFAULT_PRINTING_PRICING,
  currencyBRL,
  parsePrintMinutes,
  parseWeightGrams,
} from '../../../utils/printingPricing';

interface ProductPricingDetailsModalProps {
  product: Product | null;
  tenantId?: number;
  onClose: () => void;
}

export const ProductPricingDetailsModal: React.FC<ProductPricingDetailsModalProps> = ({
  product,
  tenantId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<ProductPricingSnapshot[]>([]);
  const [calculatedPricing, setCalculatedPricing] = useState<PrintingPricingResult | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  useEffect(() => {
    if (!product) return;

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        // Carregar snapshots existentes do produto
        const existingSnapshots = await api.getProductPricingSnapshots(product.id, tenantId).catch(() => []);
        if (isMounted) setSnapshots(existingSnapshots || []);

        // Calcular precificação estimada com base nos dados do produto
        const weightGrams = parseWeightGrams(product.weight) || DEFAULT_PRINTING_PRICING.productWeightGrams;
        const minutes = parsePrintMinutes(product.print_time) || DEFAULT_PRINTING_PRICING.printMinutes;

        const calcRes = await api.calculatePricing(
          {
            ...DEFAULT_PRINTING_PRICING,
            productWeightGrams: weightGrams,
            printMinutes: minutes,
          },
          tenantId
        ).catch(() => null);

        if (isMounted && calcRes?.result) {
          setCalculatedPricing(calcRes.result);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de precificação:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [product?.id, tenantId]);

  if (!product) return null;

  const currentPrice = product.price || 0;
  const latestSnapshot = snapshots[0];
  const cost = latestSnapshot?.operational_cost ?? calculatedPricing?.operationalCost ?? (currentPrice * 0.4);
  const fees = latestSnapshot?.total_fees ?? calculatedPricing?.totalFees ?? (currentPrice * 0.17);
  const estimatedProfit = Math.max(0, currentPrice - cost - fees);
  const profitMarginPercent = currentPrice > 0 ? (estimatedProfit / currentPrice) * 100 : 0;
  const suggestedPrice = latestSnapshot?.suggested_price ?? calculatedPricing?.suggestedPrice ?? currentPrice;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl transition-all duration-200 dark:border-chumbo-800 dark:bg-chumbo-950 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-chumbo-800">
          <div className="flex items-center gap-3">
            <img
              src={product.image_url}
              alt={product.title}
              className="h-14 w-14 rounded-2xl border border-slate-200 object-cover shadow-sm dark:border-chumbo-700"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700 border border-cyan-200 dark:bg-laser-500/10 dark:text-laser-400 dark:border-laser-500/30">
                  <Calculator className="h-3 w-3" />
                  Precificação & Engenharia 3D
                </span>
                {loading && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-600 dark:text-laser-400">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Calculando...
                  </span>
                )}
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">ID #{product.id}</span>
              </div>
              <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white sm:text-lg line-clamp-1">
                {product.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-chumbo-700 dark:bg-chumbo-900 dark:text-slate-400 dark:hover:bg-chumbo-800 dark:hover:text-white"
            aria-label="Fechar detalhes de precificação"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo de Destaques da Precificação */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-chumbo-800 dark:bg-chumbo-900/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <DollarSign className="h-3.5 w-3.5 text-cyan-600 dark:text-laser-400" />
              Preço de Venda
            </div>
            <div className="mt-1.5 text-lg font-black text-slate-900 dark:text-white">
              {currencyBRL(currentPrice)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">Praticado na loja</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-chumbo-800 dark:bg-chumbo-900/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Package className="h-3.5 w-3.5 text-amber-500" />
              Custo Estimado
            </div>
            <div className="mt-1.5 text-lg font-black text-slate-900 dark:text-white">
              {currencyBRL(cost)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">Matéria-prima + Energia</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-chumbo-800 dark:bg-chumbo-900/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Percent className="h-3.5 w-3.5 text-purple-500" />
              Taxas & Gateway
            </div>
            <div className="mt-1.5 text-lg font-black text-slate-900 dark:text-white">
              {currencyBRL(fees)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">Marketplace / Cartão</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-chumbo-800 dark:bg-chumbo-900/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Lucro Estimado
            </div>
            <div className="mt-1.5 text-lg font-black text-emerald-600 dark:text-emerald-400">
              {currencyBRL(estimatedProfit)}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              {profitMarginPercent.toFixed(1)}% de margem
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="mt-6 flex border-b border-slate-200 dark:border-chumbo-800">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'details'
                ? 'border-cyan-600 text-cyan-600 dark:border-laser-400 dark:text-laser-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Calculator className="h-4 w-4" />
            Detalhamento da Precificação & Parâmetros
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'border-cyan-600 text-cyan-600 dark:border-laser-400 dark:text-laser-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            Histórico de Snapshots ({snapshots.length})
          </button>
        </div>

        {/* Conteúdo da Aba 1: Tabela de Detalhes da Precificação */}
        {activeTab === 'details' && (
          <div className="mt-5 space-y-6">
            {/* 1. Parâmetros de Impressão 3D (Substitutos das colunas antigas) */}
            <div>
              <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Layers className="h-4 w-4 text-cyan-600 dark:text-laser-400" />
                Especificações Técnicas de Impressão
              </h3>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-chumbo-800 dark:bg-chumbo-900/40">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-200 dark:divide-chumbo-800 text-slate-700 dark:text-slate-300">
                    <tr className="hover:bg-slate-100/50 dark:hover:bg-chumbo-850/40">
                      <td className="w-1/3 p-3 font-semibold text-slate-500 dark:text-slate-400">Material 3D Principal</td>
                      <td className="p-3">
                        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono font-bold text-slate-800 shadow-2xs dark:border-chumbo-700 dark:bg-chumbo-800 dark:text-slate-200">
                          {product.material || 'Padrão da loja'}
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/50 dark:hover:bg-chumbo-850/40">
                      <td className="p-3 font-semibold text-slate-500 dark:text-slate-400">Resolução / Altura de Camada</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {product.layer_height || '0.16mm (Alta Definição)'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/50 dark:hover:bg-chumbo-850/40">
                      <td className="p-3 font-semibold text-slate-500 dark:text-slate-400">Tempo de Impressão Estimado</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {product.print_time || 'A confirmar'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/50 dark:hover:bg-chumbo-850/40">
                      <td className="p-3 font-semibold text-slate-500 dark:text-slate-400">Peso Estimado da Peça</td>
                      <td className="p-3 font-mono text-slate-900 dark:text-white">
                        {product.weight || 'Sob consulta'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/50 dark:hover:bg-chumbo-850/40">
                      <td className="p-3 font-semibold text-slate-500 dark:text-slate-400">Dimensões (L x P x A)</td>
                      <td className="p-3 font-mono text-slate-900 dark:text-white">
                        {product.dimensions || 'Sob consulta'}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-100/50 dark:hover:bg-chumbo-850/40">
                      <td className="p-3 font-semibold text-slate-500 dark:text-slate-400">Materiais Compatíveis</td>
                      <td className="p-3 text-slate-900 dark:text-white">
                        {product.supported_materials && product.supported_materials.length > 0
                          ? product.supported_materials.join(', ')
                          : product.material || 'PLA, PETG'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Tabela de Composição de Custos e Precificação */}
            <div>
              <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Calculator className="h-4 w-4 text-cyan-600 dark:text-laser-400" />
                Composição Completa de Custos & Precificação
              </h3>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-mono uppercase text-slate-600 dark:border-chumbo-800 dark:bg-chumbo-900/80 dark:text-slate-400">
                    <tr>
                      <th className="p-3">Componente / Item de Custo</th>
                      <th className="p-3">Base / Referência</th>
                      <th className="p-3 text-right">Valor Estimado</th>
                      <th className="p-3 text-right">% do Preço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-chumbo-850 dark:text-slate-300">
                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">Matéria-Prima (Filamento)</span>
                        <span className="text-[10px] text-slate-500">Polímero impresso + suportes de impressão</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {product.weight || '85g'} • R$ 120/kg
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currencyBRL(latestSnapshot?.material_cost ?? calculatedPricing?.materialCost ?? (cost * 0.7))}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {currentPrice > 0
                          ? `${(((latestSnapshot?.material_cost ?? calculatedPricing?.materialCost ?? (cost * 0.7)) / currentPrice) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">Energia Elétrica 3D</span>
                        <span className="text-[10px] text-slate-500">Consumo da extrusora, mesa aquecida e cooler</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {product.print_time || '6 horas'} • ~0.07 kW
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currencyBRL(latestSnapshot?.energy_cost ?? calculatedPricing?.energyCost ?? (cost * 0.15))}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {currentPrice > 0
                          ? `${(((latestSnapshot?.energy_cost ?? calculatedPricing?.energyCost ?? (cost * 0.15)) / currentPrice) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">Embalagem & Insumos</span>
                        <span className="text-[10px] text-slate-500">Caixa reforçada, plástico-bolha, selo térmico</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        Padrão e-commerce
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currencyBRL(latestSnapshot?.packaging_cost ?? 1.50)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {currentPrice > 0 ? `${(((latestSnapshot?.packaging_cost ?? 1.50) / currentPrice) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">Reserva de Falhas de Impressão</span>
                        <span className="text-[10px] text-slate-500">Provisão contra delaminação, entupimento ou warping</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        8.0% sobre custos diretos
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currencyBRL(latestSnapshot?.failure_reserve ?? calculatedPricing?.failureReserve ?? (cost * 0.08))}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {currentPrice > 0
                          ? `${(((latestSnapshot?.failure_reserve ?? calculatedPricing?.failureReserve ?? (cost * 0.08)) / currentPrice) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>

                    {/* Linha de Subtotal Custo Operacional */}
                    <tr className="bg-slate-100/70 font-bold dark:bg-chumbo-900">
                      <td className="p-3 text-slate-900 dark:text-white" colSpan={2}>
                        TOTAL DE CUSTOS DE PRODUÇÃO (CUSTO BASE)
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900 dark:text-white">
                        {currencyBRL(cost)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                        {currentPrice > 0 ? `${((cost / currentPrice) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">Taxas de Canais & Meio de Pagamento</span>
                        <span className="text-[10px] text-slate-500">Comissão de plataforma + processamento Pix/Cartão</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        ~16.99% variável
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                        {currencyBRL(fees)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {currentPrice > 0 ? `${((fees / currentPrice) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block">Lucro Líquido Real</span>
                        <span className="text-[10px] text-slate-500">Retorno após deduções de insumos e taxas</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        Margem líquida de {profitMarginPercent.toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        {currencyBRL(estimatedProfit)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {profitMarginPercent.toFixed(1)}%
                      </td>
                    </tr>

                    {/* Preço Sugerido */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                      <td className="p-3" colSpan={2}>
                        <span className="font-bold text-slate-900 dark:text-white block">Preço Sugerido (Algoritmo AZ3D)</span>
                        <span className="text-[10px] text-slate-500">Cálculo ideal para cobertura de custos + margem alvo</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-cyan-600 dark:text-laser-400">
                        {currencyBRL(suggestedPrice)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        —
                      </td>
                    </tr>

                    {/* Preço de Venda Praticado */}
                    <tr className="bg-cyan-500/10 font-black text-cyan-900 dark:bg-laser-500/15 dark:text-laser-300">
                      <td className="p-3.5" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-cyan-600 dark:text-laser-400" />
                          <span>PREÇO DE VENDA CADASTRADO NO SISTEMA</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono text-base">
                        {currencyBRL(currentPrice)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs">
                        100,0%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 2: Histórico de Snapshots Salvos */}
        {activeTab === 'history' && (
          <div className="mt-5 space-y-4">
            {snapshots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-chumbo-700">
                <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
                <h4 className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum snapshot salvo</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Os valores exibidos na aba de detalhamento são calculados em tempo real com base nos parâmetros técnicos do produto.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-chumbo-800 dark:bg-chumbo-950/70">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-mono uppercase text-slate-600 dark:border-chumbo-800 dark:bg-chumbo-900/80 dark:text-slate-400">
                    <tr>
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Preço Sugerido</th>
                      <th className="p-3">Custo Operacional</th>
                      <th className="p-3">Taxas Totais</th>
                      <th className="p-3">Margem de Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-chumbo-850 dark:text-slate-300">
                    {snapshots.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-chumbo-850/50">
                        <td className="p-3 font-mono text-slate-500">
                          {new Date(s.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 font-mono font-bold text-cyan-700 dark:text-laser-300">
                          {currencyBRL(s.suggested_price)}
                        </td>
                        <td className="p-3 font-mono text-slate-900 dark:text-white">
                          {currencyBRL(s.operational_cost)}
                        </td>
                        <td className="p-3 font-mono text-purple-600 dark:text-purple-400">
                          {currencyBRL(s.total_fees)}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {s.profit_margin_percent?.toFixed(1) || '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 dark:border-chumbo-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-chumbo-950 dark:hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
