export * from './client';
export * from './auth';
export * from './tenants';
export * from './products';
export * from './pricing';
export * from './orders';
export * from './shipping';
export * from './marketplace';
export * from './filaments';
export * from './chat';

import { authApi } from './auth';
import { tenantsApi } from './tenants';
import { productsApi } from './products';
import { pricingApi } from './pricing';
import { ordersApi } from './orders';
import { shippingApi } from './shipping';
import { marketplaceApi } from './marketplace';
import { filamentsApi } from './filaments';
import { chatApi } from './chat';

export const api = {
  ...authApi,
  ...tenantsApi,
  ...productsApi,
  ...pricingApi,
  ...ordersApi,
  ...shippingApi,
  ...marketplaceApi,
  ...filamentsApi,
  ...chatApi,
};

export default api;
