import { createBrowserClient } from '@supabase/ssr';

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return 'https://placeholder-project.supabase.co';
  try {
    return new URL(rawUrl.trim()).origin;
  } catch {
    return rawUrl.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  }
}

export function createClient() {
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const createBrowserSupabaseClient = createClient;
