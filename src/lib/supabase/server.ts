import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return 'https://placeholder-project.supabase.co';
  try {
    return new URL(rawUrl.trim()).origin;
  } catch {
    return rawUrl.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  }
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
