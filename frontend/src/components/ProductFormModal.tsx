import React from 'react';
import { ProductFormContainer, ProductFormModalProps } from '../features/admin/ProductFormContainer';

export type { ProductFormModalProps };
export const ProductFormModal: React.FC<ProductFormModalProps> = (props) => {
  return <ProductFormContainer {...props} />;
};
