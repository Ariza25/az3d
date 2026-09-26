import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { UserAddress, SavedCreditCard } from '../../types';
import { UserSettingsModalView } from './components/UserSettingsModalView';

export interface UserSettingsContainerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'addresses' | 'cards';
}

export const UserSettingsContainer: React.FC<UserSettingsContainerProps> = ({
  isOpen,
  onClose,
  defaultTab = 'profile',
}) => {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'cards'>(defaultTab);

  // Profile Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Addresses State
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [isEditingAddress, setIsEditingAddress] = useState<boolean>(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<Omit<UserAddress, 'id'>>({
    label: 'Casa',
    recipient: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_default: false,
  });
  const [addressSuccessMsg, setAddressSuccessMsg] = useState<string | null>(null);

  // Cards State
  const [savedCards, setSavedCards] = useState<SavedCreditCard[]>([]);
  const [isEditingCard, setIsEditingCard] = useState<boolean>(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<{
    cardNumber: string;
    holder_name: string;
    expiry_month: string;
    expiry_year: string;
    cpf: string;
    is_default: boolean;
  }>({
    cardNumber: '',
    holder_name: '',
    expiry_month: '',
    expiry_year: '',
    cpf: '',
    is_default: false,
  });
  const [cardSuccessMsg, setCardSuccessMsg] = useState<string | null>(null);

  const detectCardBrand = (num: string): string => {
    const clean = num.replace(/\D/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
    if (/^(4011|438935|451416|4576|504175|627780|636297|636368|5067|457393)/.test(clean)) return 'elo';
    if (/^3[47]/.test(clean)) return 'amex';
    if (/^(606282|3841)/.test(clean)) return 'hipercard';
    return 'card';
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length > 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length > 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length > 2) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return digits;
  };

  const formatCEP = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatCPF = (val: string) => {
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

  // Initialize and load user data
  useEffect(() => {
    if (!isOpen || !user) return;

    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');

    // Parse addresses
    let loadedAddresses: UserAddress[] = [];
    if (user.addresses) {
      if (typeof user.addresses === 'string') {
        try {
          loadedAddresses = JSON.parse(user.addresses);
        } catch {
          loadedAddresses = [];
        }
      } else if (Array.isArray(user.addresses)) {
        loadedAddresses = user.addresses;
      }
    }

    // Fallback to localStorage for addresses
    if (loadedAddresses.length === 0) {
      try {
        const stored = localStorage.getItem(`az3d_saved_addresses_${user.id}`);
        if (stored) loadedAddresses = JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    setAddresses(loadedAddresses);

    // Parse saved cards
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

    // Fallback to CartDrawer localStorage cards format if available
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

  // Sync state and persist
  const persistAddresses = async (newAddresses: UserAddress[]) => {
    setAddresses(newAddresses);
    if (user?.id) {
      localStorage.setItem(`az3d_saved_addresses_${user.id}`, JSON.stringify(newAddresses));
    }
    try {
      await updateProfile({ addresses: newAddresses });
    } catch {
      // ignore
    }
  };

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

  // 1. Save Profile (Name, Email, Phone)
  const handleSaveProfile = async () => {
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    if (!name.trim()) {
      setProfileErrorMsg('Nome não pode ficar vazio.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setProfileErrorMsg('Informe um e-mail válido.');
      return;
    }

    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setProfileSuccessMsg('Dados da sua conta atualizados com sucesso!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Erro ao atualizar dados do perfil.');
    }
  };

  // 2. Address Handlers
  const handleOpenNewAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Casa',
      recipient: user?.name || '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      is_default: addresses.length === 0,
    });
    setIsEditingAddress(true);
  };

  const handleEditAddress = (addr: UserAddress) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label || 'Casa',
      recipient: addr.recipient,
      cep: addr.cep,
      street: addr.street,
      number: addr.number,
      complement: addr.complement || '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      is_default: Boolean(addr.is_default),
    });
    setIsEditingAddress(true);
  };

  const handleSaveAddress = async () => {
    if (!addressForm.street || !addressForm.number || !addressForm.cep || !addressForm.city || !addressForm.state) {
      return;
    }

    let updated: UserAddress[] = [];
    if (editingAddressId) {
      updated = addresses.map((addr) => {
        if (addr.id === editingAddressId) {
          return {
            ...addr,
            ...addressForm,
            is_default: addressForm.is_default ? true : addr.is_default,
          };
        }
        return addressForm.is_default ? { ...addr, is_default: false } : addr;
      });
    } else {
      const newAddr: UserAddress = {
        id: `addr_${Date.now()}`,
        ...addressForm,
      };
      if (addressForm.is_default || addresses.length === 0) {
        newAddr.is_default = true;
        updated = addresses.map((a) => ({ ...a, is_default: false }));
      } else {
        updated = [...addresses];
      }
      updated.push(newAddr);
    }

    await persistAddresses(updated);
    setIsEditingAddress(false);
    setEditingAddressId(null);
    setAddressSuccessMsg('Endereço salvo com sucesso!');
    setTimeout(() => setAddressSuccessMsg(null), 3000);
  };

  const handleDeleteAddress = async (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    if (updated.length > 0 && !updated.some((a) => a.is_default)) {
      updated[0].is_default = true;
    }
    await persistAddresses(updated);
  };

  const handleSetDefaultAddress = async (id: string) => {
    const updated = addresses.map((a) => ({
      ...a,
      is_default: a.id === id,
    }));
    await persistAddresses(updated);
  };

  // 3. Card Handlers
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

  const handleSaveCard = async () => {
    if (!cardForm.holder_name || !cardForm.expiry_month || !cardForm.expiry_year) {
      return;
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

  const handleSelectTab = (tab: 'profile' | 'addresses' | 'cards') => {
    setActiveTab(tab);
    setIsEditingAddress(false);
    setIsEditingCard(false);
  };

  return (
    <UserSettingsModalView
      isOpen={isOpen}
      onClose={onClose}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      // Profile
      user={user}
      name={name}
      email={email}
      phone={phone}
      theme={theme}
      profileSuccessMsg={profileSuccessMsg}
      profileErrorMsg={profileErrorMsg}
      onNameChange={setName}
      onEmailChange={setEmail}
      onPhoneChange={(val) => setPhone(formatPhone(val))}
      onThemeChange={setTheme}
      onSaveProfile={handleSaveProfile}
      // Addresses
      addresses={addresses}
      isEditingAddress={isEditingAddress}
      editingAddressId={editingAddressId}
      addressForm={addressForm}
      addressSuccessMsg={addressSuccessMsg}
      onOpenNewAddress={handleOpenNewAddress}
      onEditAddress={handleEditAddress}
      onCancelEditAddress={() => setIsEditingAddress(false)}
      onSaveAddress={handleSaveAddress}
      onDeleteAddress={handleDeleteAddress}
      onSetDefaultAddress={handleSetDefaultAddress}
      onUpdateAddressForm={(field, value) => setAddressForm((prev) => ({ ...prev, [field]: value }))}
      formatCEP={formatCEP}
      // Cards
      savedCards={savedCards}
      isEditingCard={isEditingCard}
      editingCardId={editingCardId}
      cardForm={cardForm}
      cardSuccessMsg={cardSuccessMsg}
      onOpenNewCard={handleOpenNewCard}
      onEditCard={handleEditCard}
      onCancelEditCard={() => setIsEditingCard(false)}
      onSaveCard={handleSaveCard}
      onDeleteCard={handleDeleteCard}
      onSetDefaultCard={handleSetDefaultCard}
      onUpdateCardForm={(field, value) => setCardForm((prev) => ({ ...prev, [field]: value }))}
      formatCardNumber={formatCardNumber}
      formatCPF={formatCPF}
    />
  );
};
