import { useEffect, useState } from 'react';
import { User } from '../../../types';
import { SavedCard } from '../components';
import { detectCardBrand } from '../utils/cartFormatting';

export function useSavedCards(user: User | null) {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>('new');
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [payerCPF, setPayerCPF] = useState('');
  const [shouldSaveCard, setShouldSaveCard] = useState<boolean>(true);

  useEffect(() => {
    if (!user?.id) return;
    try {
      let parsed: any[] = [];
      if (user.saved_cards) {
        parsed = typeof user.saved_cards === 'string' ? JSON.parse(user.saved_cards) : user.saved_cards;
      }
      if (parsed.length === 0) {
        const stored = localStorage.getItem(`az3d_saved_cards_${user.id}`);
        if (stored) parsed = JSON.parse(stored);
      }

      if (parsed && parsed.length > 0) {
        const normalized: SavedCard[] = parsed.map((c: any) => ({
          id: c.id || String(Date.now()),
          cardNumber: c.cardNumber || `•••• •••• •••• ${c.last_four || c.lastFour || '4242'}`,
          cardNumberMasked: c.cardNumberMasked || `•••• •••• •••• ${c.last_four || c.lastFour || '4242'}`,
          cardholderName: c.cardholderName || c.holder_name || '',
          expiry: c.expiry || (c.expiry_month && c.expiry_year ? `${c.expiry_month}/${c.expiry_year}` : ''),
          cpf: c.cpf || '',
          brand: c.brand || detectCardBrand(c.cardNumber || ''),
        }));

        setSavedCards(normalized);
        const first = normalized[0];
        setSelectedSavedCardId(first.id);
        setCardNumber(first.cardNumber);
        setCardholderName(first.cardholderName);
        setCardExpiry(first.expiry);
        if (first.cpf) setPayerCPF(first.cpf);
      }
    } catch {
      // ignore
    }
  }, [user]);

  const handleSelectSavedCard = (cardId: string) => {
    setSelectedSavedCardId(cardId);
    if (cardId === 'new') {
      setCardNumber('');
      setCardholderName('');
      setCardExpiry('');
      setCardCVV('');
    } else {
      const found = savedCards.find((c) => c.id === cardId);
      if (found) {
        setCardNumber(found.cardNumber);
        setCardholderName(found.cardholderName);
        setCardExpiry(found.expiry);
        if (found.cpf) setPayerCPF(found.cpf);
        setCardCVV('');
      }
    }
  };

  const handleDeleteSavedCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    const updated = savedCards.filter((c) => c.id !== cardId);
    setSavedCards(updated);
    localStorage.setItem(`az3d_saved_cards_${user.id}`, JSON.stringify(updated));
    if (selectedSavedCardId === cardId) {
      handleSelectSavedCard(updated.length > 0 ? updated[0].id : 'new');
    }
  };

  const persistCardIfRequested = () => {
    if (shouldSaveCard && user?.id) {
      const cleanCard = cardNumber.replace(/\D/g, '');
      const last4 = cleanCard.slice(-4);
      const cardBrand = detectCardBrand(cleanCard);
      const newCardEntry: SavedCard = {
        id: `card_${Date.now()}`,
        cardNumber: cardNumber,
        cardNumberMasked: `•••• ${last4}`,
        cardholderName: cardholderName.trim().toUpperCase(),
        expiry: cardExpiry,
        cpf: payerCPF,
        brand: cardBrand,
      };
      const existing = savedCards.filter((c) => c.cardNumber.replace(/\D/g, '') !== cleanCard);
      const updatedCards = [newCardEntry, ...existing].slice(0, 5);
      setSavedCards(updatedCards);
      localStorage.setItem(`az3d_saved_cards_${user.id}`, JSON.stringify(updatedCards));
    }
  };

  return {
    savedCards,
    selectedSavedCardId,
    cardNumber,
    setCardNumber,
    cardholderName,
    setCardholderName,
    cardExpiry,
    setCardExpiry,
    cardCVV,
    setCardCVV,
    payerCPF,
    setPayerCPF,
    shouldSaveCard,
    setShouldSaveCard,
    handleSelectSavedCard,
    handleDeleteSavedCard,
    persistCardIfRequested,
  };
}
