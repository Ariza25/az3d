import React from 'react';
import { X, User as UserIcon, CreditCard, MapPin } from 'lucide-react';
import { User, UserAddress, SavedCreditCard } from '../../../types';
import { UserProfileTab } from './UserProfileTab';
import { UserAddressesTab } from './UserAddressesTab';
import { UserSavedCardsTab } from './UserSavedCardsTab';

export interface UserSettingsModalViewProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'profile' | 'addresses' | 'cards';
  onSelectTab: (tab: 'profile' | 'addresses' | 'cards') => void;

  // Profile
  user: User | null;
  name: string;
  email: string;
  phone: string;
  theme: string;
  profileSuccessMsg: string | null;
  profileErrorMsg: string | null;
  onNameChange: (val: string) => void;
  onEmailChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onThemeChange: (val: 'light' | 'dark') => void;
  onSaveProfile: () => void;

  // Addresses
  addresses: UserAddress[];
  isEditingAddress: boolean;
  editingAddressId: string | null;
  addressForm: Omit<UserAddress, 'id'>;
  addressSuccessMsg: string | null;
  onOpenNewAddress: () => void;
  onEditAddress: (addr: UserAddress) => void;
  onCancelEditAddress: () => void;
  onSaveAddress: () => void;
  onDeleteAddress: (id: string) => void;
  onSetDefaultAddress: (id: string) => void;
  onUpdateAddressForm: (field: keyof Omit<UserAddress, 'id'>, value: any) => void;
  formatCEP: (val: string) => string;

  // Cards
  savedCards: SavedCreditCard[];
  isEditingCard: boolean;
  editingCardId: string | null;
  cardForm: {
    cardNumber: string;
    holder_name: string;
    expiry_month: string;
    expiry_year: string;
    cpf: string;
    is_default: boolean;
  };
  cardSuccessMsg: string | null;
  onOpenNewCard: () => void;
  onEditCard: (card: SavedCreditCard) => void;
  onCancelEditCard: () => void;
  onSaveCard: () => void;
  onDeleteCard: (id: string) => void;
  onSetDefaultCard: (id: string) => void;
  onUpdateCardForm: (field: string, value: any) => void;
  formatCardNumber: (val: string) => string;
  formatCPF: (val: string) => string;
}

export const UserSettingsModalView: React.FC<UserSettingsModalViewProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  // Profile
  user,
  name,
  email,
  phone,
  theme,
  profileSuccessMsg,
  profileErrorMsg,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onThemeChange,
  onSaveProfile,
  // Addresses
  addresses,
  isEditingAddress,
  editingAddressId,
  addressForm,
  addressSuccessMsg,
  onOpenNewAddress,
  onEditAddress,
  onCancelEditAddress,
  onSaveAddress,
  onDeleteAddress,
  onSetDefaultAddress,
  onUpdateAddressForm,
  formatCEP,
  // Cards
  savedCards,
  isEditingCard,
  editingCardId,
  cardForm,
  cardSuccessMsg,
  onOpenNewCard,
  onEditCard,
  onCancelEditCard,
  onSaveCard,
  onDeleteCard,
  onSetDefaultCard,
  onUpdateCardForm,
  formatCardNumber,
  formatCPF,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-chumbo-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl rounded-3xl glass-panel border border-chumbo-700/70 bg-chumbo-900/95 shadow-2xl overflow-hidden z-10 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-chumbo-800/80 bg-chumbo-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-laser-500 to-cyan-400 flex items-center justify-center text-chumbo-950 font-black shadow-laser-glow">
              <UserIcon className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                Meu Perfil
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie seus cartões de preferência, endereços de entrega e contatos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-chumbo-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-chumbo-800 bg-chumbo-950/30 px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'profile'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Perfil & Contato</span>
          </button>

          <button
            onClick={() => onSelectTab('addresses')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'addresses'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Endereços ({addresses.length})</span>
          </button>

          <button
            onClick={() => onSelectTab('cards')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'cards'
                ? 'border-laser-400 text-laser-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cartões de Pagamento ({savedCards.length})</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'profile' && (
            <UserProfileTab
              user={user}
              name={name}
              email={email}
              phone={phone}
              theme={theme}
              profileSuccessMsg={profileSuccessMsg}
              profileErrorMsg={profileErrorMsg}
              onNameChange={onNameChange}
              onEmailChange={onEmailChange}
              onPhoneChange={onPhoneChange}
              onThemeChange={onThemeChange}
              onSaveProfile={onSaveProfile}
            />
          )}

          {activeTab === 'addresses' && (
            <UserAddressesTab
              addresses={addresses}
              isEditingAddress={isEditingAddress}
              editingAddressId={editingAddressId}
              addressForm={addressForm}
              addressSuccessMsg={addressSuccessMsg}
              onOpenNewAddress={onOpenNewAddress}
              onEditAddress={onEditAddress}
              onCancelEdit={onCancelEditAddress}
              onSaveAddress={onSaveAddress}
              onDeleteAddress={onDeleteAddress}
              onSetDefaultAddress={onSetDefaultAddress}
              onUpdateAddressForm={onUpdateAddressForm}
              formatCEP={formatCEP}
            />
          )}

          {activeTab === 'cards' && (
            <UserSavedCardsTab
              savedCards={savedCards}
              isEditingCard={isEditingCard}
              editingCardId={editingCardId}
              cardForm={cardForm}
              cardSuccessMsg={cardSuccessMsg}
              onOpenNewCard={onOpenNewCard}
              onEditCard={onEditCard}
              onCancelEdit={onCancelEditCard}
              onSaveCard={onSaveCard}
              onDeleteCard={onDeleteCard}
              onSetDefaultCard={onSetDefaultCard}
              onUpdateCardForm={onUpdateCardForm}
              formatCardNumber={formatCardNumber}
              formatCPF={formatCPF}
            />
          )}
        </div>
      </div>
    </div>
  );
};
