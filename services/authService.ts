import { API_PATHS } from '../lib/api';

export interface AuthPayload {
  email: string;
  password: string;
  targetFamilyCode?: string;
  isSignUp?: boolean;
}

export interface AuthResponse {
  success: boolean;
  familyCode?: string;
  userName?: string;
  message?: string;
}

export const login = async (payload: AuthPayload): Promise<AuthResponse> => {
  const response = await fetch(API_PATHS.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
};

export const signUp = async (payload: AuthPayload): Promise<AuthResponse> => {
  return login({ ...payload, isSignUp: true });
};
