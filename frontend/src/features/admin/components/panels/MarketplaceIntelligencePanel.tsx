import React, { useState, useEffect } from 'react';
import {
  MLTrendKeyword,
  MLSearchInsight,
  MLListingAudit,
  MLProductOpportunity,
  Product,
} from '../../../../types';
import { api } from '../../../../services/api';
import {
  MarketplaceHeader,
  MarketplaceProvider,
  MarketplaceTab,
  MarketplaceTrendsTab,
  MarketplaceAuditTab,
  MarketplaceInsightsTab,
  MarketplaceOpportunitiesTab,
  AuditParams,
} from './marketplace-intelligence';

interface MarketplaceIntelligencePanelProps {
  tenantId?: number;
  products?: Product[];
}

export const MarketplaceIntelligencePanel: React.FC<MarketplaceIntelligencePanelProps> = ({
  tenantId,
  products = [],
}) => {
  const [provider, setProvider] = useState<MarketplaceProvider>('mercadolivre');
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('trends');

  // Trends state
  const [trends, setTrends] = useState<MLTrendKeyword[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Search Insights state
  const [searchQuery, setSearchQuery] = useState('suporte headset');
  const [searchInsight, setSearchInsight] = useState<MLSearchInsight | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Audit state
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [auditParams, setAuditParams] = useState<AuditParams>({
    title: 'Suporte de Headset Gamer 3D Universal PLA #shopee #achadinhos',
    price: 69.90,
    images: 5,
    free_shipping: true,
    full_shipping: false,
    material: 'PLA',
  });
  const [auditResult, setAuditResult] = useState<MLListingAudit | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Opportunities state
  const [opportunities, setOpportunities] = useState<MLProductOpportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(false);

  // Load initial data
  useEffect(() => {
    void reloadAllData(provider);
  }, [tenantId, provider]);

  const reloadAllData = async (targetProvider = provider) => {
    await Promise.all([
      loadTrends(selectedCategory, targetProvider),
      loadSearchInsights(searchQuery, targetProvider),
      loadOpportunities(selectedCategory, targetProvider),
      runAudit(targetProvider),
    ]);
  };

  const handleSwitchProvider = (newProvider: MarketplaceProvider) => {
    setProvider(newProvider);
    if (newProvider === 'shopee' && !auditParams.title.includes('#')) {
      setAuditParams((prev) => ({ ...prev, title: `${prev.title} #shopee #achadinhos #impressao3d` }));
    }
  };

  const loadTrends = async (category = selectedCategory, targetProvider = provider) => {
    setLoadingTrends(true);
    try {
      const res = await api.getMLTrends(category === 'all' ? undefined : category, targetProvider, tenantId);
      setTrends(res.trends || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadSearchInsights = async (query: string, targetProvider = provider) => {
    if (!query.trim()) return;
    setLoadingInsights(true);
    try {
      const res = await api.getMLSearchInsights(query, targetProvider, tenantId);
      setSearchInsight(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const runAudit = async (targetProvider = provider) => {
    setLoadingAudit(true);
    try {
      const res = await api.auditMLListing({ ...auditParams, provider: targetProvider }, tenantId);
      setAuditResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const loadOpportunities = async (category = selectedCategory, targetProvider = provider) => {
    setLoadingOpps(true);
    try {
      const res = await api.getMLProductOpportunities(category === 'all' ? undefined : category, targetProvider, tenantId);
      setOpportunities(res.opportunities || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOpps(false);
    }
  };

  const handleSelectProductForAudit = (prodId: number) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      const baseTitle = prod.title;
      setAuditParams({
        title: provider === 'shopee' && !baseTitle.includes('#') ? `${baseTitle} #shopee #impressao3d` : baseTitle,
        price: prod.price,
        images: (prod as any).images?.length || (prod.image_url ? 4 : 1),
        free_shipping: prod.price >= 79,
        full_shipping: false,
        material: prod.material || 'PLA',
      });
    }
  };

  return (
    <div className="space-y-6">
      <MarketplaceHeader
        provider={provider}
        onSwitchProvider={handleSwitchProvider}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onReloadAll={() => void reloadAllData()}
        isLoading={loadingTrends || loadingOpps || loadingInsights || loadingAudit}
      />

      {activeTab === 'trends' && (
        <MarketplaceTrendsTab
          trends={trends}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            void loadTrends(cat);
          }}
          onAnalyzeKeyword={(keyword) => {
            setSearchQuery(keyword);
            setActiveTab('insights');
            void loadSearchInsights(keyword);
          }}
        />
      )}

      {activeTab === 'audit' && (
        <MarketplaceAuditTab
          provider={provider}
          products={products}
          selectedProductId={selectedProductId}
          onSelectProduct={handleSelectProductForAudit}
          auditParams={auditParams}
          onChangeAuditParams={setAuditParams}
          auditResult={auditResult}
          loadingAudit={loadingAudit}
          onRunAudit={() => void runAudit()}
        />
      )}

      {activeTab === 'insights' && (
        <MarketplaceInsightsTab
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          onSearch={(q) => void loadSearchInsights(q)}
          searchInsight={searchInsight}
          loadingInsights={loadingInsights}
        />
      )}

      {activeTab === 'opportunities' && (
        <MarketplaceOpportunitiesTab
          opportunities={opportunities}
          provider={provider}
          onSimulateAd={(opp) => {
            setAuditParams({
              title: opp.title,
              price: opp.suggested_price,
              images: 5,
              free_shipping: opp.suggested_price >= 79,
              full_shipping: false,
              material: 'PLA',
            });
            setActiveTab('audit');
            void runAudit();
          }}
        />
      )}
    </div>
  );
};
