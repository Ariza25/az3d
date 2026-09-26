import { useState, useEffect, useCallback } from 'react';
import { User, UserAddress } from '../../../types';

export interface UseUserAddressesOptions {
  user: User | null;
  updateProfile: (data: Partial<User>) => Promise<any>;
  isOpen: boolean;
}

export const formatCEP = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
};

const INITIAL_ADDRESS_FORM: Omit<UserAddress, 'id'> = {
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
};

export const useUserAddresses = ({ user, updateProfile, isOpen }: UseUserAddressesOptions) => {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [isEditingAddress, setIsEditingAddress] = useState<boolean>(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<Omit<UserAddress, 'id'>>(INITIAL_ADDRESS_FORM);
  const [addressSuccessMsg, setAddressSuccessMsg] = useState<string | null>(null);
  const [addressErrorMsg, setAddressErrorMsg] = useState<string | null>(null);
  const [isSearchingCep, setIsSearchingCep] = useState<boolean>(false);

  // Carregar e sincronizar endereços do usuário
  useEffect(() => {
    if (!isOpen || !user) return;

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

    // Fallback para cache local se ainda não sincronizado com o backend
    if (loadedAddresses.length === 0) {
      try {
        const stored = localStorage.getItem(`az3d_saved_addresses_${user.id}`);
        if (stored) loadedAddresses = JSON.parse(stored);
      } catch {
        // ignore
      }
    }

    setAddresses(loadedAddresses);
  }, [isOpen, user]);

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

  // Preenchimento automático de endereço via ViaCEP
  const lookupViaCep = useCallback(async (rawCep: string) => {
    const cleanCep = rawCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      setIsSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.erro) {
        setAddressForm((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf ? data.uf.toUpperCase() : prev.state,
        }));
      }
    } catch {
      // Falha silenciosa de rede
    } finally {
      setIsSearchingCep(false);
    }
  }, []);

  const handleUpdateAddressForm = (field: keyof Omit<UserAddress, 'id'>, value: any) => {
    setAddressForm((prev) => ({ ...prev, [field]: value }));

    if (field === 'cep') {
      const clean = String(value).replace(/\D/g, '');
      if (clean.length === 8) {
        lookupViaCep(clean);
      }
    }
  };

  const handleOpenNewAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      ...INITIAL_ADDRESS_FORM,
      recipient: user?.name || '',
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

  const handleCancelEditAddress = () => {
    setIsEditingAddress(false);
    setEditingAddressId(null);
  };

  const handleSaveAddress = async (): Promise<boolean> => {
    if (!addressForm.street || !addressForm.number || !addressForm.cep || !addressForm.city || !addressForm.state) {
      setAddressErrorMsg('Preencha os campos obrigatórios do endereço.');
      return false;
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
    return true;
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

  return {
    addresses,
    isEditingAddress,
    editingAddressId,
    addressForm,
    addressSuccessMsg,
    addressErrorMsg,
    isSearchingCep,
    formatCEP,
    onOpenNewAddress: handleOpenNewAddress,
    onEditAddress: handleEditAddress,
    onCancelEditAddress: handleCancelEditAddress,
    onSaveAddress: handleSaveAddress,
    onDeleteAddress: handleDeleteAddress,
    onSetDefaultAddress: handleSetDefaultAddress,
    onUpdateAddressForm: handleUpdateAddressForm,
    lookupViaCep,
  };
};
