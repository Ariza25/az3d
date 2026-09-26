import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { UserSettingsModalView } from './components/UserSettingsModalView';
import { useUserAddresses, useSavedCards } from './hooks';

export interface UserSettingsContainerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'addresses' | 'cards';
}

const formatPhone = (val: string): string => {
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

  // Custom Hooks for Address and Card CRUD
  const addressHook = useUserAddresses({ user, updateProfile, isOpen });
  const cardHook = useSavedCards({ user, updateProfile, isOpen });

  useEffect(() => {
    if (!isOpen || !user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
  }, [isOpen, user]);

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

  const handleSelectTab = (tab: 'profile' | 'addresses' | 'cards') => {
    setActiveTab(tab);
    addressHook.onCancelEditAddress();
    cardHook.onCancelEditCard();
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
      // Addresses Hook
      addresses={addressHook.addresses}
      isEditingAddress={addressHook.isEditingAddress}
      editingAddressId={addressHook.editingAddressId}
      addressForm={addressHook.addressForm}
      addressSuccessMsg={addressHook.addressSuccessMsg}
      onOpenNewAddress={addressHook.onOpenNewAddress}
      onEditAddress={addressHook.onEditAddress}
      onCancelEditAddress={addressHook.onCancelEditAddress}
      onSaveAddress={addressHook.onSaveAddress}
      onDeleteAddress={addressHook.onDeleteAddress}
      onSetDefaultAddress={addressHook.onSetDefaultAddress}
      onUpdateAddressForm={addressHook.onUpdateAddressForm}
      formatCEP={addressHook.formatCEP}
      // Cards Hook
      savedCards={cardHook.savedCards}
      isEditingCard={cardHook.isEditingCard}
      editingCardId={cardHook.editingCardId}
      cardForm={cardHook.cardForm}
      cardSuccessMsg={cardHook.cardSuccessMsg}
      onOpenNewCard={cardHook.onOpenNewCard}
      onEditCard={cardHook.onEditCard}
      onCancelEditCard={cardHook.onCancelEditCard}
      onSaveCard={cardHook.onSaveCard}
      onDeleteCard={cardHook.onDeleteCard}
      onSetDefaultCard={cardHook.onSetDefaultCard}
      onUpdateCardForm={cardHook.onUpdateCardForm}
      formatCardNumber={cardHook.formatCardNumber}
      formatCPF={cardHook.formatCPF}
    />
  );
};
