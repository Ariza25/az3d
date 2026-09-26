import React from 'react';
import { ProductModalContainer, ProductModalProps } from '../features/store/ProductModalContainer';

export type { ProductModalProps };
export const ProductModal: React.FC<ProductModalProps> = (props) => {
  return <ProductModalContainer {...props} />;
};
