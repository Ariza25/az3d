import { useState } from 'react';
import { api } from '../../../services/api';
import { ValidateCouponResponse } from '../../../types';

export function useCartCoupon(tenantId?: number) {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<ValidateCouponResponse | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = couponInput.trim();
    if (!clean) return;
    setCouponLoading(true);
    setCouponMessage(null);
    try {
      const res = await api.validateCoupon(clean, 0, 0, tenantId);
      if (res.valid && res.code) {
        setAppliedCoupon(res);
        setCouponMessage({ type: 'success', text: `Cupom ${res.code} aplicado (-${res.discount_percent || 0}%)!` });
      } else {
        setAppliedCoupon(null);
        setCouponMessage({ type: 'error', text: res.message || 'Cupom inválido ou expirado' });
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponMessage({ type: 'error', text: err.message || 'Erro ao validar cupom' });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMessage(null);
  };

  const resetCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMessage(null);
  };

  return {
    couponInput,
    setCouponInput,
    appliedCoupon,
    setAppliedCoupon,
    couponLoading,
    couponMessage,
    handleApplyCoupon,
    handleRemoveCoupon,
    resetCoupon,
  };
}
