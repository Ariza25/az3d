import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  CreditCard,
  MapPin,
  Mail,
  Phone,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Star,
  ShieldCheck,
  AlertCircle,
  Building,
  Save,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserAddress, SavedCreditCard } from '../types';
import { Button } from './ui';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'addresses' | 'cards';
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
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
                Minha Conta & Configurações
                <span className="bg-laser-500/20 text-laser-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-laser-500/30">
                  {user?.role === 'customer' ? 'Cliente' : 'Administrador'}
                </span>
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
            onClick={() => {
              setActiveTab('profile');
              setIsEditingAddress(false);
              setIsEditingCard(false);
            }}
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
            onClick={() => {
              setActiveTab('addresses');
              setIsEditingAddress(false);
              setIsEditingCard(false);
            }}
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
            onClick={() => {
              setActiveTab('cards');
              setIsEditingAddress(false);
              setIsEditingCard(false);
            }}
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
          
          {/* TAB 1: PERFIL & CONTATO */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="bg-chumbo-800/40 p-4 rounded-2xl border border-chumbo-700/50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-chumbo-700 flex items-center justify-center font-black text-xl text-white border-2 border-laser-500/50 shrink-0">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (user?.name || 'A').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{user?.name}</h3>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">ID da Conta: #{user?.id}</p>
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>E-mail Principal</span>
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Usado para confirmações de compras, rastreamento e faturamento.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Telefone / WhatsApp</span>
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-laser-400 transition-colors font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Para avisos importantes e agilização da entrega dos pedidos.
                  </p>
                </div>

                {/* Tema do Sistema */}
                <div className="pt-3 border-t border-chumbo-800">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Aparência do Sistema
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        theme === 'dark'
                          ? 'border-laser-400 bg-laser-500/10 text-white shadow-laser-glow'
                          : 'border-chumbo-700 bg-chumbo-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-cyan-400" />
                      <span>Tema Escuro (Chumbo)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        theme === 'light'
                          ? 'border-laser-400 bg-white text-chumbo-950 shadow-md'
                          : 'border-chumbo-700 bg-chumbo-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Tema Claro (Branco Gelo)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSaveProfile}
                    variant="laser"
                    className="w-full py-3 text-sm font-bold shadow-laser-glow flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações do Perfil</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ENDEREÇOS DE ENTREGA */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              {addressSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{addressSuccessMsg}</span>
                </div>
              )}

              {!isEditingAddress ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Meus Endereços</h3>
                      <p className="text-xs text-slate-400">
                        Endereços salvos para cálculo de frete e entregas rápidas
                      </p>
                    </div>
                    <button
                      onClick={handleOpenNewAddress}
                      className="flex items-center gap-1.5 px-3 py-2 bg-laser-500 hover:bg-laser-400 text-chumbo-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Novo Endereço</span>
                    </button>
                  </div>

                  {addresses.length === 0 ? (
                    <div className="p-8 text-center bg-chumbo-800/30 border border-dashed border-chumbo-700 rounded-2xl">
                      <MapPin className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                      <p className="text-sm font-bold text-slate-300">Nenhum endereço cadastrado</p>
                      <p className="text-xs text-slate-500 mt-1 mb-4">
                        Adicione um endereço de entrega para agilizar suas compras.
                      </p>
                      <button
                        onClick={handleOpenNewAddress}
                        className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-white rounded-xl text-xs font-bold border border-chumbo-600"
                      >
                        Cadastrar primeiro endereço
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={`p-4 rounded-2xl border transition-all relative ${
                            addr.is_default
                              ? 'bg-chumbo-800/60 border-laser-500/50 shadow-md ring-1 ring-laser-500/30'
                              : 'bg-chumbo-800/30 border-chumbo-700/60 hover:border-chumbo-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold uppercase tracking-wide text-white bg-chumbo-900 px-2.5 py-1 rounded-lg border border-chumbo-700">
                                {addr.label || 'Endereço'}
                              </span>
                              {addr.is_default && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-laser-400 bg-laser-500/20 px-2 py-0.5 rounded-full border border-laser-500/40">
                                  <Star className="w-3 h-3 fill-laser-400" />
                                  Padrão
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditAddress(addr)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-chumbo-700/50 transition-colors"
                                title="Editar endereço"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAddress(addr.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                title="Excluir endereço"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm font-semibold text-white">
                            {addr.street}, {addr.number}
                            {addr.complement ? ` - ${addr.complement}` : ''}
                          </p>
                          <p className="text-xs text-slate-300 mt-0.5">
                            {addr.neighborhood} - {addr.city}/{addr.state}
                          </p>
                          <p className="text-xs font-mono text-slate-400 mt-1">
                            CEP: {addr.cep}
                          </p>
                          {addr.recipient && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Destinatário: {addr.recipient}
                            </p>
                          )}

                          {!addr.is_default && (
                            <button
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="mt-3 w-full py-1.5 bg-chumbo-900 hover:bg-chumbo-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg border border-chumbo-700 transition-colors"
                            >
                              Definir como endereço padrão
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Address Form (Add or Edit) */
                <div className="bg-chumbo-800/40 p-5 rounded-2xl border border-chumbo-700/70 space-y-4">
                  <div className="flex items-center justify-between border-b border-chumbo-700/50 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Building className="w-4 h-4 text-laser-400" />
                      <span>{editingAddressId ? 'Editar Endereço' : 'Adicionar Novo Endereço'}</span>
                    </h3>
                    <button
                      onClick={() => setIsEditingAddress(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Identificação (Rótulo)
                      </label>
                      <input
                        type="text"
                        value={addressForm.label}
                        onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                        placeholder="Ex: Casa, Trabalho, Galpão"
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Destinatário
                      </label>
                      <input
                        type="text"
                        value={addressForm.recipient}
                        onChange={(e) => setAddressForm({ ...addressForm, recipient: e.target.value })}
                        placeholder="Nome de quem vai receber"
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        CEP
                      </label>
                      <input
                        type="text"
                        value={addressForm.cep}
                        onChange={(e) => setAddressForm({ ...addressForm, cep: formatCEP(e.target.value) })}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Logradouro / Rua
                      </label>
                      <input
                        type="text"
                        value={addressForm.street}
                        onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                        placeholder="Avenida, Rua, Alameda..."
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Número
                      </label>
                      <input
                        type="text"
                        value={addressForm.number}
                        onChange={(e) => setAddressForm({ ...addressForm, number: e.target.value })}
                        placeholder="123"
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Complemento / Apto
                      </label>
                      <input
                        type="text"
                        value={addressForm.complement}
                        onChange={(e) => setAddressForm({ ...addressForm, complement: e.target.value })}
                        placeholder="Bloco B, Apto 402"
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={addressForm.neighborhood}
                        onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                        placeholder="Bairro"
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                        placeholder="Cidade"
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        UF (Estado)
                      </label>
                      <input
                        type="text"
                        value={addressForm.state}
                        onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value.toUpperCase() })}
                        placeholder="SP"
                        maxLength={2}
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2 px-3 text-xs text-white uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="default_addr_check"
                      checked={addressForm.is_default}
                      onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                      className="rounded border-chumbo-700 bg-chumbo-950 text-laser-500 focus:ring-laser-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="default_addr_check" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Definir este como meu endereço principal de entrega
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-chumbo-700/50">
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(false)}
                      className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Cancelar
                    </button>
                    <Button
                      onClick={handleSaveAddress}
                      variant="laser"
                      size="sm"
                    >
                      Salvar Endereço
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CARTÕES DE PAGAMENTO */}
          {activeTab === 'cards' && (
            <div className="space-y-6">
              {cardSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{cardSuccessMsg}</span>
                </div>
              )}

              {!isEditingCard ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Cartões Salvos</h3>
                      <p className="text-xs text-slate-400">
                        Cartões de preferência para compras com 1 clique de forma 100% segura
                      </p>
                    </div>
                    <button
                      onClick={handleOpenNewCard}
                      className="flex items-center gap-1.5 px-3 py-2 bg-laser-500 hover:bg-laser-400 text-chumbo-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Cartão</span>
                    </button>
                  </div>

                  {savedCards.length === 0 ? (
                    <div className="p-8 text-center bg-chumbo-800/30 border border-dashed border-chumbo-700 rounded-2xl">
                      <CreditCard className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                      <p className="text-sm font-bold text-slate-300">Nenhum cartão salvo</p>
                      <p className="text-xs text-slate-500 mt-1 mb-4">
                        Cadastre seu cartão preferencial para compras mais ágeis no checkout.
                      </p>
                      <button
                        onClick={handleOpenNewCard}
                        className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-white rounded-xl text-xs font-bold border border-chumbo-600"
                      >
                        Cadastrar primeiro cartão
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedCards.map((card) => (
                        <div
                          key={card.id}
                          className={`p-5 rounded-2xl border transition-all relative ${
                            card.is_default
                              ? 'bg-gradient-to-br from-chumbo-800 to-chumbo-900 border-laser-500/60 shadow-lg ring-1 ring-laser-500/30'
                              : 'bg-chumbo-800/40 border-chumbo-700/60 hover:border-chumbo-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-chumbo-950 text-white border border-chumbo-700">
                                {card.brand.toUpperCase()}
                              </span>
                              {card.is_default && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-laser-400 bg-laser-500/20 px-2 py-0.5 rounded-full border border-laser-500/40">
                                  <Star className="w-3 h-3 fill-laser-400" />
                                  Preferencial
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditCard(card)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-chumbo-700/50 transition-colors"
                                title="Editar cartão"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCard(card.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                title="Excluir cartão"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-base font-mono font-bold tracking-widest text-white">
                              •••• •••• •••• {card.last_four}
                            </p>
                            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                              <span className="truncate max-w-[150px] font-medium text-slate-200 uppercase">
                                {card.holder_name}
                              </span>
                              <span className="font-mono">
                                Exp: {card.expiry_month}/{card.expiry_year}
                              </span>
                            </div>
                          </div>

                          {!card.is_default && (
                            <button
                              onClick={() => handleSetDefaultCard(card.id)}
                              className="mt-4 w-full py-1.5 bg-chumbo-950 hover:bg-chumbo-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg border border-chumbo-700 transition-colors"
                            >
                              Definir como cartão preferencial
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 p-4 rounded-xl bg-laser-500/5 border border-laser-500/20 flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-laser-400 shrink-0" />
                    <p className="text-xs text-slate-300">
                      <strong className="text-white">Segurança Garantida:</strong> Seus dados de cartão são criptografados de ponta a ponta. O código CVV nunca é armazenado e é solicitado apenas para confirmação transacional.
                    </p>
                  </div>
                </div>
              ) : (
                /* Card Form (Add or Edit) */
                <div className="bg-chumbo-800/40 p-5 rounded-2xl border border-chumbo-700/70 space-y-4 max-w-lg mx-auto">
                  <div className="flex items-center justify-between border-b border-chumbo-700/50 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-laser-400" />
                      <span>{editingCardId ? 'Editar Cartão' : 'Adicionar Cartão de Crédito'}</span>
                    </h3>
                    <button
                      onClick={() => setIsEditingCard(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  {!editingCardId && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Número do Cartão
                      </label>
                      <input
                        type="text"
                        value={cardForm.cardNumber}
                        onChange={(e) => setCardForm({ ...cardForm, cardNumber: formatCardNumber(e.target.value) })}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-sm text-white font-mono tracking-wider"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Nome Impresso no Cartão
                    </label>
                    <input
                      type="text"
                      value={cardForm.holder_name}
                      onChange={(e) => setCardForm({ ...cardForm, holder_name: e.target.value.toUpperCase() })}
                      placeholder="COMO NO CARTÃO"
                      className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Mês de Vencimento
                      </label>
                      <input
                        type="text"
                        value={cardForm.expiry_month}
                        onChange={(e) => setCardForm({ ...cardForm, expiry_month: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                        placeholder="MM (ex: 08)"
                        maxLength={2}
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white font-mono text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Ano de Vencimento
                      </label>
                      <input
                        type="text"
                        value={cardForm.expiry_year}
                        onChange={(e) => setCardForm({ ...cardForm, expiry_year: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                        placeholder="AA (ex: 29)"
                        maxLength={2}
                        className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white font-mono text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      CPF do Titular (Opcional)
                    </label>
                    <input
                      type="text"
                      value={cardForm.cpf}
                      onChange={(e) => setCardForm({ ...cardForm, cpf: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full bg-chumbo-950 border border-chumbo-700 rounded-xl py-2.5 px-3 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="default_card_check"
                      checked={cardForm.is_default}
                      onChange={(e) => setCardForm({ ...cardForm, is_default: e.target.checked })}
                      className="rounded border-chumbo-700 bg-chumbo-950 text-laser-500 focus:ring-laser-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="default_card_check" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Definir como meu cartão preferencial para pagamentos
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-chumbo-700/50">
                    <button
                      type="button"
                      onClick={() => setIsEditingCard(false)}
                      className="px-4 py-2 bg-chumbo-800 hover:bg-chumbo-700 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Cancelar
                    </button>
                    <Button
                      onClick={handleSaveCard}
                      variant="laser"
                      size="sm"
                    >
                      Salvar Cartão
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
