import React from 'react';
import { CartItemCard, CartItemWithPricing } from './CartItemCard';
import { FreightCalculatorWidget } from './FreightCalculatorWidget';

interface CartItemListProps {
  items: CartItemWithPricing[];
  tenantId?: number;
  selectedFreightCode?: string;
  onUpdateQuantity: (productId: number, color: string, qty: number) => void;
  onRemoveItem: (productId: number, color: string) => void;
  onSelectFreight: (option: any) => void;
}

export const CartItemList: React.FC<CartItemListProps> = ({
  items,
  tenantId,
  selectedFreightCode,
  onUpdateQuantity,
  onRemoveItem,
  onSelectFreight,
}) => {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <CartItemCard
          key={`${item.product.id}-${item.color}`}
          item={item}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
        />
      ))}
      <div className="mt-4 pt-2">
        <FreightCalculatorWidget
          compact
          tenantId={tenantId}
          selectedOptionCode={selectedFreightCode}
          onSelectOption={onSelectFreight}
        />
      </div>
    </div>
  );
};
