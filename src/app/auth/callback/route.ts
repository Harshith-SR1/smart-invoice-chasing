import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/dashboard';

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
      const user = data.user;

      // 1. Idempotently upsert user profile into database
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User';
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email,
            full_name: fullName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (profileErr) {
        console.warn('Profile upsert warning:', profileErr);
      }

      // 2. Check if user already has an active workspace created
      let hasWorkspace = false;
      try {
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (workspaces && workspaces.length > 0) {
          hasWorkspace = true;
        } else {
          // If no workspace found, initialize a default workspace for this user
          const { data: newWs, error: wsCreateErr } = await supabase
            .from('workspaces')
            .insert({
              user_id: user.id,
              business_name: `${fullName}'s Organization`,
              business_type: 'Agency',
              country: 'India',
              currency: 'INR (₹)',
              business_email: user.email || '',
            })
            .select('id')
            .single();

          if (!wsCreateErr && newWs) {
            hasWorkspace = true;
            // Insert workspace membership
            await supabase.from('workspace_members').insert({
              workspace_id: newWs.id,
              user_id: user.id,
              name: fullName,
              email: user.email || '',
              role: 'OWNER',
              status: 'active',
            });

            // Initialize default FREE subscription
            await supabase.from('subscriptions').insert({
              workspace_id: newWs.id,
              plan_id: 'FREE',
              billing_email: user.email || '',
            });

            // Initialize AI & Notification settings
            await supabase.from('ai_settings').insert({ workspace_id: newWs.id });
            await supabase.from('notification_preferences').insert({ workspace_id: newWs.id });
          }
        }
      } catch (wsErr) {
        console.warn('Workspace initialization check:', wsErr);
      }

      // 3. Return to destination (dashboard or requested path)
      const destination = next.startsWith('/') ? next : '/dashboard';
      return NextResponse.redirect(`${origin}${destination}`);
    } else if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
    }
  }

  // Return to login with error state if code exchange fails
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
