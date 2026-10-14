/**
 * Server-side Environment Configuration Validator
 *
 * Validates configuration without performing network calls or exposing secret values.
 * Safe to call from server-side scripts, health checks, or route handlers.
 */

export interface EnvValidationResult {
  ok: boolean;
  supabase: {
    urlConfigured: boolean;
    anonKeyConfigured: boolean;
    serviceRoleKeyConfigured: boolean;
    urlValid: boolean;
    errors: string[];
  };
  resend: {
    apiKeyConfigured: boolean;
    fromEmailConfigured: boolean;
    webhookSecretConfigured: boolean;
    fromEmailValid: boolean;
    errors: string[];
  };
  warnings: string[];
  isDispatchReady: boolean;
  isWebhookReady: boolean;
}

const PLACEHOLDER_STRINGS = [
  'placeholder',
  'your-supabase-project',
  'YOUR_PROJECT',
  'YOUR_SUPABASE',
  'your-supabase-anon-key',
  'your-supabase-service-role-key',
  're_your_resend_api_key',
  'your-resend-api-key',
  'whsec_your_webhook',
  'verified-sender@yourdomain.com',
  'noreply@your-verified-domain.com',
  'yourdomain.com',
];

function isPlaceholderOrEmpty(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (trimmed === '') return true;
  return PLACEHOLDER_STRINGS.some((ph) => trimmed.toLowerCase().includes(ph.toLowerCase()));
}

function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates the local environment configuration.
 * Never prints, returns, or leaks secret values.
 */
export function validateEnvironment(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const supabaseErrors: string[] = [];
  const resendErrors: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const resendApiKey = env.RESEND_API_KEY;
  const resendFromEmail = env.RESEND_FROM_EMAIL;
  const resendWebhookSecret = env.RESEND_WEBHOOK_SECRET;

  // 1. Supabase URL validation
  const urlConfigured = !isPlaceholderOrEmpty(supabaseUrl);
  let urlValid = false;
  if (!urlConfigured) {
    supabaseErrors.push('NEXT_PUBLIC_SUPABASE_URL is missing or using a default placeholder.');
  } else if (supabaseUrl) {
    urlValid = isValidHttpUrl(supabaseUrl.trim());
    if (!urlValid) {
      supabaseErrors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid HTTPS URL (expected format: https://<project>.supabase.co).');
    } else if (!supabaseUrl.startsWith('https://')) {
      warnings.push('NEXT_PUBLIC_SUPABASE_URL should use HTTPS in production.');
    }
  }

  // 2. Supabase Anon Key validation
  const anonKeyConfigured = !isPlaceholderOrEmpty(anonKey);
  if (!anonKeyConfigured) {
    supabaseErrors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or using a default placeholder.');
  }

  // 3. Supabase Service Role Key (server-only)
  const serviceRoleKeyConfigured = !isPlaceholderOrEmpty(serviceRoleKey);
  if (!serviceRoleKeyConfigured) {
    supabaseErrors.push('SUPABASE_SERVICE_ROLE_KEY is required for server-side dispatch and privileged operations.');
  }

  // 4. Resend API Key validation (for email dispatch)
  const resendKeyConfigured = !isPlaceholderOrEmpty(resendApiKey);
  if (!resendKeyConfigured) {
    resendErrors.push('RESEND_API_KEY is not configured or using a placeholder (expected format: re_...).');
  } else if (resendApiKey && !resendApiKey.startsWith('re_')) {
    warnings.push('RESEND_API_KEY typically begins with the prefix "re_". Please verify the key format.');
  }

  // 5. Resend From Email validation
  const fromEmailConfigured = !isPlaceholderOrEmpty(resendFromEmail);
  let fromEmailValid = false;
  if (!fromEmailConfigured) {
    resendErrors.push('RESEND_FROM_EMAIL must be set to a verified sender domain in Resend.');
  } else if (resendFromEmail) {
    // Check if it contains an email address
    const emailMatch = resendFromEmail.match(/<([^>]+)>|([^\s@]+@[^\s@]+\.[^\s@]+)/);
    fromEmailValid = Boolean(emailMatch);
    if (!fromEmailValid) {
      resendErrors.push('RESEND_FROM_EMAIL does not appear to contain a valid email address.');
    }
  }

  // 6. Resend Webhook Secret validation (required only for webhook processing)
  const webhookSecretConfigured = !isPlaceholderOrEmpty(resendWebhookSecret);
  if (!webhookSecretConfigured) {
    warnings.push('RESEND_WEBHOOK_SECRET is not configured. Webhook signature verification will be bypassed until set.');
  } else if (resendWebhookSecret && !resendWebhookSecret.startsWith('whsec_')) {
    warnings.push('RESEND_WEBHOOK_SECRET typically begins with the prefix "whsec_". Please verify the secret format.');
  }

  // 7. Security check: Ensure server secrets are not prefixed with NEXT_PUBLIC_
  if (env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    supabaseErrors.push('CRITICAL SECURITY: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is exposed! Remove NEXT_PUBLIC_ prefix immediately.');
  }
  if (env.NEXT_PUBLIC_RESEND_API_KEY) {
    resendErrors.push('CRITICAL SECURITY: NEXT_PUBLIC_RESEND_API_KEY is exposed! Remove NEXT_PUBLIC_ prefix immediately.');
  }
  if (env.NEXT_PUBLIC_RESEND_WEBHOOK_SECRET) {
    resendErrors.push('CRITICAL SECURITY: NEXT_PUBLIC_RESEND_WEBHOOK_SECRET is exposed! Remove NEXT_PUBLIC_ prefix immediately.');
  }

  const isDispatchReady = urlConfigured && urlValid && anonKeyConfigured && serviceRoleKeyConfigured && resendKeyConfigured && fromEmailConfigured && fromEmailValid;
  const isWebhookReady = serviceRoleKeyConfigured && webhookSecretConfigured;
  const ok = supabaseErrors.length === 0 && resendErrors.length === 0;

  return {
    ok,
    supabase: {
      urlConfigured,
      anonKeyConfigured,
      serviceRoleKeyConfigured,
      urlValid,
      errors: supabaseErrors,
    },
    resend: {
      apiKeyConfigured: resendKeyConfigured,
      fromEmailConfigured,
      webhookSecretConfigured,
      fromEmailValid,
      errors: resendErrors,
    },
    warnings,
    isDispatchReady,
    isWebhookReady,
  };
}
