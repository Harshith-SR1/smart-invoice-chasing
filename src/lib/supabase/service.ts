/**
 * Server-only Supabase client using the service-role key.
 *
 * Use ONLY in API Route Handlers for privileged operations that must bypass RLS
 * after the calling user has already been independently authenticated.
 *
 * Never import this into client components.
 * Never expose the service-role key to the browser.
 */

import { createClient } from '@supabase/supabase-js';

export function createServiceRoleClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !rawUrl ||
    !serviceKey ||
    serviceKey.startsWith('placeholder') ||
    serviceKey.includes('your-supabase-service-role-key') ||
    serviceKey.includes('YOUR_')
  ) {
    throw new Error(
      'Supabase service-role credentials are not configured. ' +
      'Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.'
    );
  }

  let url = rawUrl.trim();
  try {
    url = new URL(url).origin;
  } catch {
    url = url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
