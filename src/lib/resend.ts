/**
 * Server-only Resend client factory.
 *
 * Import ONLY from Server Components, API Route Handlers, or server actions.
 * Never import into client components — the API key must not reach the browser.
 */

import { Resend } from 'resend';

/**
 * Returns a configured Resend client.
 *
 * Throws if RESEND_API_KEY is not configured so callers can surface a clear
 * "email dispatch unavailable" error rather than sending with a bad key.
 */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (
    !apiKey ||
    apiKey === 'your-resend-api-key' ||
    apiKey === 're_your_resend_api_key' ||
    apiKey.startsWith('placeholder') ||
    apiKey.includes('YOUR_')
  ) {
    throw new Error(
      'RESEND_API_KEY is not configured. Add your actual Resend API key (re_...) to .env.local to enable email dispatch.'
    );
  }

  return new Resend(apiKey);
}

/**
 * The verified sender domain/address configured in Resend.
 *
 * Must match a domain verified in your Resend account.
 * Throws if unconfigured or containing placeholder domains to prevent dispatch failure.
 */
export function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (
    !from ||
    from.includes('yourdomain.com') ||
    from.includes('your-verified-domain.com') ||
    from.includes('example.com') ||
    from.includes('placeholder')
  ) {
    throw new Error(
      'RESEND_FROM_EMAIL is not configured with a valid sender address. Replace the placeholder domain in .env.local with a verified sender.'
    );
  }
  return from;
}

/**
 * Format RFC 5322 "From" header without nested angle brackets.
 */
export function formatFromHeader(fromConfig: string, senderName?: string): string {
  const emailMatch = fromConfig.match(/<([^>]+)>/) || fromConfig.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
  const email = emailMatch ? (emailMatch[1] || emailMatch[2]).trim() : fromConfig.trim();
  const nameMatch = fromConfig.match(/^([^<]+)</);
  const name = senderName?.trim() || (nameMatch ? nameMatch[1].trim() : 'Smart Invoice Chasing');
  return `${name} <${email}>`;
}

/**
 * Webhook signing secret for verifying Resend webhook payloads.
 * Set this to the value shown in Resend dashboard > Webhooks.
 */
export function getWebhookSecret(): string | undefined {
  return process.env.RESEND_WEBHOOK_SECRET;
}
