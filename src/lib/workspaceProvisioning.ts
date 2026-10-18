import { SupabaseClient, User } from '@supabase/supabase-js';
import { validateFullName, validatePhoneNumber } from './authValidation';

/**
 * Idempotently provisions a default organization workspace, profile,
 * membership, and default preferences for a verified user if not already present.
 * Validates and normalizes full_name and phone on the server before database persistence.
 */
export async function ensureUserWorkspaceProvisioned(
  supabase: SupabaseClient,
  user: User,
  customFullName?: string
): Promise<{ success: boolean; workspaceId?: string }> {
  // Validate candidate name using rigorous full-name validator
  const candidateName =
    customFullName ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    '';

  const nameValidation = validateFullName(candidateName);
  const fullName = nameValidation.isValid
    ? nameValidation.normalized
    : user.email?.split('@')[0] || 'User';

  // Validate phone number if present in metadata and normalize to E.164
  const rawPhone = user.user_metadata?.phone;
  let normalizedPhone: string | null = null;
  if (typeof rawPhone === 'string' && rawPhone.trim().length > 0) {
    const phoneValidation = validatePhoneNumber(rawPhone);
    if (phoneValidation.isValid && phoneValidation.e164) {
      normalizedPhone = phoneValidation.e164;
    }
  }

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

  // 1. Upsert profile
  try {
    await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        full_name: fullName,
        phone: normalizedPhone,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch (profileErr) {
    console.warn('Profile upsert warning:', profileErr);
  }

  // 2. Check if user already has an active workspace created
  try {
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      return { success: true, workspaceId: workspaces[0].id };
    }

    // 3. Provision new default organization workspace
    const { data: newWs, error: wsCreateErr } = await supabase
      .from('workspaces')
      .insert({
        user_id: user.id,
        business_name: `${fullName}'s Organization`,
        business_type: 'Agency',
        country: 'India',
        currency: 'INR (₹)',
        business_email: user.email || '',
        business_phone: normalizedPhone,
      })
      .select('id')
      .single();

    if (!wsCreateErr && newWs) {
      // Create primary OWNER membership
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

      // Initialize AI & Notification default preferences
      await supabase.from('ai_settings').insert({ workspace_id: newWs.id });
      await supabase.from('notification_preferences').insert({ workspace_id: newWs.id });

      return { success: true, workspaceId: newWs.id };
    }
  } catch (wsErr) {
    console.warn('Workspace provisioning exception:', wsErr);
  }

  return { success: false };
}
