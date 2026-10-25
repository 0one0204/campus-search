

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_ONEDAY_APP_ID?: string;
    readonly VITE_SUPABASE_AUTH_STORAGE_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

function requirePublicEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`[Meoo Cloud] Missing environment variable: ${name}`);
  }
  return value;
}

export const projectUrlId = requirePublicEnv(
  import.meta.env.VITE_ONEDAY_APP_ID,
  'VITE_ONEDAY_APP_ID',
);
export const supabaseUrl = requirePublicEnv(
  import.meta.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_URL',
);
export const supabaseAnonKey = requirePublicEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  'VITE_SUPABASE_ANON_KEY',
);
const supabaseAuthStorageKey =
  import.meta.env.VITE_SUPABASE_AUTH_STORAGE_KEY;

export function getSupabaseUrl(): string {
  return supabaseUrl;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    ...(supabaseAuthStorageKey
      ? { storageKey: supabaseAuthStorageKey }
      : {}),
  },
  global: {
    headers: { 'OneDay-App-Id': projectUrlId },
  },
});
