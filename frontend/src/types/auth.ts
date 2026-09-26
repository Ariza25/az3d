export interface UserAddress {
  id: string;
  label?: string; // 'Casa', 'Trabalho', etc.
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  is_default?: boolean;
}

export interface SavedCreditCard {
  id: string;
  holder_name: string;
  last_four: string;
  brand: string; // 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'other'
  expiry_month: string;
  expiry_year: string;
  cpf?: string;
  is_default?: boolean;
}

export interface User {
  id: number;
  tenant_id?: number;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  addresses?: string | UserAddress[];
  saved_cards?: string | SavedCreditCard[];
  role: string;
  google_id?: string;
  avatar_url?: string;
  auth_provider?: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email?: string;
  error?: string;
}

export interface ResetPasswordResponse {
  message: string;
}
