import { createContext, useContext } from 'react';
import type { SupabaseRepository } from '../data/supabaseRepository';

/** The signed-in person. Null when the app runs without Supabase. */
export interface Account {
  userId: string;
  email: string;
  repository: SupabaseRepository;
  signOut(): Promise<void>;
}

export const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account | null {
  return useContext(AccountContext);
}
