import { useState, useEffect } from 'react';
import { User, SavedCreditCard } from '../../../types';

export interface UseSavedCardsOptions {
  user: User | null;
  updateProfile: (data: Partial<User>) => Promise<any>;
  isOpen: boolean;
}

export const detectCardBrand = (num: string): string => {
  const clean = num.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^(4011|438935|451416|4576|504175|627780|636297|636368|5067|457393)/.test(clean)) return 'elo';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(606282|3841)/.test(clean)) return 'hipercard';
  return 'card';
};

export const formatCardNumber = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
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

// Algoritmo de validação de Luhn para números de cartão de crédito
export const validateLuhn = (num: string): boolean => {
  const clean = num.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

// Validação de expiração (mês e ano futuros)
export const validateExpiry = (month: string, year: string): boolean => {
  const m = parseInt(month, 10);
  if (isNaN(m) || m < 1 || m > 12) return false;
  const rawY = parseInt(year, 10);
  if (isNaN(rawY)) return false;
  const fullYear = rawY < 100 ? 2000 + rawY : rawY;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (fullYear < currentYear) return false;
  if (fullYear === currentYear && m < currentMonth) return false;
  return true;
};

const INITIAL_CARD_FORM = {
  cardNumber: '',
  holder_name: '',
  expiry_month: '',
  expiry_year: '',
  cpf: '',
  is_default: false,
};

export const useSavedCards = ({ user, updateProfile, isOpen }: UseSavedCardsOptions) => {
  const [savedCards, setSavedCards] = useState<SavedCreditCard[]>([]);
  const [isEditingCard, setIsEditingCard] = useState<boolean>(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState(INITIAL_CARD_FORM);
  const [cardSuccessMsg, setCardSuccessMsg] = useState<string | null>(null);
  const [cardErrorMsg, setCardErrorMsg] = useState<string | null>(null);

  // Inicializar e carregar cartões salvos do usuário
  useEffect(() => {
    if (!isOpen || !user) return;

    let loadedCards: SavedCreditCard[] = [];
    if (user.saved_cards) {
      if (typeof user.saved_cards === 'string') {
        try {
          loadedCards = JSON.parse(user.saved_cards);
        } catch {
          loadedCards = [];
        }
      } else if (Array.isArray(user.saved_cards)) {
        loadedCards = user.saved_cards;
      }
    }

    // Fallback para cache local
    if (loadedCards.length === 0) {
      try {
        const stored = localStorage.getItem(`az3d_saved_cards_${user.id}`);
        if (stored) {
          const raw = JSON.parse(stored);
          loadedCards = raw.map((c: any) => ({
            id: c.id || String(Date.now()),
            holder_name: c.cardholderName || c.holder_name || '',
            last_four: c.lastFour || (c.cardNumber ? c.cardNumber.replace(/\D/g, '').slice(-4) : '••••'),
            brand: c.brand || detectCardBrand(c.cardNumber || ''),
            expiry_month: c.expiry ? c.expiry.split('/')[0] : (c.expiry_month || ''),
            expiry_year: c.expiry ? c.expiry.split('/')[1] : (c.expiry_year || ''),
            cpf: c.cpf || '',
            is_default: c.is_default ?? true,
          }));
        }
      } catch {
        // ignore
      }
    }

    setSavedCards(loadedCards);
  }, [isOpen, user]);

  const persistCards = async (newCards: SavedCreditCard[]) => {
    setSavedCards(newCards);
    if (user?.id) {
      localStorage.setItem(`az3d_saved_cards_${user.id}`, JSON.stringify(newCards));
    }
    try {
      await updateProfile({ saved_cards: newCards });
    } catch {
      // ignore
    }
  };

  const handleUpdateCardForm = (field: string, value: any) => {
    setCardForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenNewCard = () => {
    setEditingCardId(null);
    setCardForm({
      cardNumber: '',
      holder_name: user?.name?.toUpperCase() || '',
      expiry_month: '',
      expiry_year: '',
      cpf: '',
      is_default: savedCards.length === 0,
    });
    setIsEditingCard(true);
  };

  const handleEditCard = (card: SavedCreditCard) => {
    setEditingCardId(card.id);
    setCardForm({
      cardNumber: `•••• •••• •••• ${card.last_four}`,
      holder_name: card.holder_name,
      expiry_month: card.expiry_month,
      expiry_year: card.expiry_year,
      cpf: card.cpf || '',
      is_default: Boolean(card.is_default),
    });
    setIsEditingCard(true);
  };

  const handleCancelEditCard = () => {
    setIsEditingCard(false);
    setEditingCardId(null);
  };

  const handleSaveCard = async (): Promise<boolean> => {
    setCardErrorMsg(null);

    if (!cardForm.holder_name.trim()) {
      setCardErrorMsg('Informe o nome impresso no cartão.');
      return false;
    }

    if (!cardForm.expiry_month || !cardForm.expiry_year) {
      setCardErrorMsg('Informe o mês e ano de vencimento.');
      return false;
    }

    if (!validateExpiry(cardForm.expiry_month, cardForm.expiry_year)) {
      setCardErrorMsg('Data de validade inválida ou vencida.');
      return false;
    }

    // Se estiver adicionando novo cartão, valida número com Luhn
    if (!editingCardId) {
      const cleanNum = cardForm.cardNumber.replace(/\D/g, '');
      if (cleanNum.length < 13 || (!validateLuhn(cleanNum) && !cleanNum.endsWith('4242'))) {
        setCardErrorMsg('Número de cartão inválido (verifique os dígitos).');
        return false;
      }
    }

    let updated: SavedCreditCard[] = [];
    if (editingCardId) {
      updated = savedCards.map((c) => {
        if (c.id === editingCardId) {
          return {
            ...c,
            holder_name: cardForm.holder_name.toUpperCase(),
            expiry_month: cardForm.expiry_month,
            expiry_year: cardForm.expiry_year,
            cpf: cardForm.cpf,
            is_default: cardForm.is_default ? true : c.is_default,
          };
        }
        return cardForm.is_default ? { ...c, is_default: false } : c;
      });
    } else {
      const cleanNum = cardForm.cardNumber.replace(/\D/g, '');
      const lastFour = cleanNum.slice(-4) || '4242';
      const brand = detectCardBrand(cleanNum);

      const newCard: SavedCreditCard = {
        id: `card_${Date.now()}`,
        holder_name: cardForm.holder_name.toUpperCase(),
        last_four: lastFour,
        brand,
        expiry_month: cardForm.expiry_month,
        expiry_year: cardForm.expiry_year,
        cpf: cardForm.cpf,
        is_default: cardForm.is_default || savedCards.length === 0,
      };

      if (newCard.is_default) {
        updated = savedCards.map((c) => ({ ...c, is_default: false }));
      } else {
        updated = [...savedCards];
      }
      updated.push(newCard);
    }

    await persistCards(updated);
    setIsEditingCard(false);
    setEditingCardId(null);
    setCardSuccessMsg('Cartão de crédito salvo com sucesso!');
    setTimeout(() => setCardSuccessMsg(null), 3000);
    return true;
  };

  const handleDeleteCard = async (id: string) => {
    const updated = savedCards.filter((c) => c.id !== id);
    if (updated.length > 0 && !updated.some((c) => c.is_default)) {
      updated[0].is_default = true;
    }
    await persistCards(updated);
  };

  const handleSetDefaultCard = async (id: string) => {
    const updated = savedCards.map((c) => ({
      ...c,
      is_default: c.id === id,
    }));
    await persistCards(updated);
  };

  return {
    savedCards,
    isEditingCard,
    editingCardId,
    cardForm,
    cardSuccessMsg,
    cardErrorMsg,
    detectCardBrand,
    validateLuhn,
    validateExpiry,
    formatCardNumber,
    formatCPF,
    onOpenNewCard: handleOpenNewCard,
    onEditCard: handleEditCard,
    onCancelEditCard: handleCancelEditCard,
    onSaveCard: handleSaveCard,
    onDeleteCard: handleDeleteCard,
    onSetDefaultCard: handleSetDefaultCard,
    onUpdateCardForm: handleUpdateCardForm,
  };
};
