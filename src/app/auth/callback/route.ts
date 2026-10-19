import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { getRequestOrigin, getSafeRedirectDestination } from '../../../lib/authRedirect';
import { ensureUserWorkspaceProvisioned } from '../../../lib/workspaceProvisioning';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next');

  // Handle OAuth provider error / user cancel
  if (error) {
    console.error('OAuth Callback Error:', error, errorDescription);
    const redirectUrl = new URL(`${origin}/login`);
    redirectUrl.searchParams.set('error', errorDescription || error);
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.user) {
      // Idempotently provision user profile and default workspace
      await ensureUserWorkspaceProvisioned(supabase, data.user);

      // 3. Return to destination (dashboard or requested safe path)
      const destination = getSafeRedirectDestination(next) || '/dashboard';
      return NextResponse.redirect(`${origin}${destination}`);
    } else if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
    }
  }

  // Return to login with error state if code exchange fails or code is missing
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
