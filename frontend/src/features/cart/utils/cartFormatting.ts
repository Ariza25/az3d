export const detectCardBrand = (num: string): string => {
  const clean = num.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'Visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'Mastercard';
  if (/^3[47]/.test(clean)) return 'Amex';
  if (/^(4011|4389|4514|4576|5041|5066|5090|6277|6362|6363)/.test(clean)) return 'Elo';
  if (/^606282/.test(clean)) return 'Hipercard';
  return 'Cartão';
};

export const formatCardNumber = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

export const formatExpiry = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
};

export const formatCPF = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length > 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  return digits;
};
