import React from 'react';
import { CatalogContainer } from '../../features/catalog/CatalogContainer';

export const CatalogApp: React.FC = () => {
  return <CatalogContainer />;
};

export default CatalogApp;

// Backwards compatibility re-exports
export {
  CatalogProductCard,
  getProductImages,
} from '../../features/catalog/components';

export {
  extractProductDimensions,
  formatDimensionsToCm,
} from '../../shared/storePresentation';

export const getCatalogPrice = (price: number): number => {
  if (!price || price <= 0) return 0;
  return price;
};
