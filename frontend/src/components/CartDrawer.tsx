import React from 'react';
import { CartDrawerContainer, CartDrawerProps } from '../features/cart/CartDrawerContainer';

export type { CartDrawerProps };
export const CartDrawer: React.FC<CartDrawerProps> = (props) => {
  return <CartDrawerContainer {...props} />;
};
