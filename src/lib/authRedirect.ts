/**
 * Canonical Auth Redirect URL Resolver
 * 
 * Ensures Google OAuth, email verification, and password resets redirect
 * to the exact allowed callback URL across local development, Vercel staging,
 * and canonical production environments.
 */

export const PRODUCTION_SITE_URL = 'https://smart-invoice-chasing.vercel.app';

/**
 * Returns the canonical base origin for the current execution context.
 * 
 * Rules:
 * 1. In browser:
 *    - If running on localhost or 127.0.0.1, preserve localhost so local dev works seamlessly.
 *    - If running on a deployed host (e.g. smart-invoice-chasing.vercel.app), use window.location.origin.
 * 2. In server / SSR:
 *    - If NEXT_PUBLIC_SITE_URL is defined and valid, clean and return it.
 *    - If in production or undefined, return PRODUCTION_SITE_URL (never localhost in production!).
 */
export function getBaseUrl(): string {
  // 1. Browser context
  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    // Local development preservation
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return origin;
    }
    // Deployed / production origin
    if (origin && origin !== 'null' && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }

  // 2. Environment variable (NEXT_PUBLIC_SITE_URL)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && envUrl !== 'undefined' && envUrl !== 'null' && !envUrl.includes('placeholder')) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    // If running in production mode, never allow localhost fallback
    if (process.env.NODE_ENV === 'production' && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      return PRODUCTION_SITE_URL;
    }
    return trimmed;
  }

  // 3. Fallback to production site URL
  return PRODUCTION_SITE_URL;
}

/**
 * Resolves a full, absolute redirect URL for auth callbacks.
 * Guarantees a leading slash on path, proper URL construction,
 * and no trailing slashes on base.
 */
export function getAuthRedirectUrl(path: string = '/auth/callback'): string {
  const baseUrl = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Resolves the server-side callback origin from an incoming HTTP request.
 * Respects standard reverse-proxy headers (x-forwarded-host, x-forwarded-proto)
 * commonly sent by Vercel, and falls back to canonical production URL if localhost
 * is detected in a production environment.
 */
export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    // If forwarded host is localhost, preserve http
    const proto = forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1') ? 'http' : forwardedProto;
    if (forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1')) {
      if (process.env.NODE_ENV === 'production') {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (siteUrl && siteUrl !== 'undefined' && siteUrl !== 'null' && !siteUrl.includes('localhost')) {
          return siteUrl.replace(/\/+$/, '');
        }
        return PRODUCTION_SITE_URL;
      }
    }
    return `${proto}://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host) {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      if (process.env.NODE_ENV === 'production') {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (siteUrl && siteUrl !== 'undefined' && siteUrl !== 'null' && !siteUrl.includes('localhost')) {
          return siteUrl.replace(/\/+$/, '');
        }
        return PRODUCTION_SITE_URL;
      }
      return `http://${host}`;
    }
    return `https://${host}`;
  }

  // Try URL from request
  try {
    const url = new URL(request.url);
    if (!url.origin.includes('localhost') && !url.origin.includes('127.0.0.1')) {
      return url.origin;
    }
    if (process.env.NODE_ENV !== 'production') {
      return url.origin;
    }
  } catch {}

  // Production fallback
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && siteUrl !== 'undefined' && siteUrl !== 'null' && !siteUrl.includes('localhost') && !siteUrl.includes('placeholder')) {
    return siteUrl.replace(/\/+$/, '');
  }

  return PRODUCTION_SITE_URL;
}

/**
 * Validates and sanitizes an internal redirect destination path.
 * - Must be a string starting with a single '/'
 * - Strictly rejects protocol-relative URLs ('//...'), backslashes ('/\...'), URL schemes, whitespace, control chars
 * - Rejects auth routes (/login, /signup, /auth/callback, /forgot-password, /reset-password) to avoid redirect loops
 * - Returns clean relative path (with query & hash preserved), or null if unsafe/invalid
 */
export function getSafeRedirectDestination(destination: unknown): string | null {
  if (typeof destination !== 'string') return null;
  const trimmed = destination.trim();
  if (!trimmed) return null;

  // Must begin with a single forward slash and not '//' or '/\' or backslash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return null;
  }

  // Reject CR/LF/null characters
  if (/[\r\n\0\t]/.test(trimmed)) {
    return null;
  }

  // Reject URL scheme indicators (like javascript:, data:, vbscript:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }

  try {
    const dummyOrigin = 'https://smart-invoice-chasing.local';
    const parsed = new URL(trimmed, dummyOrigin);
    // Origin must remain exactly the dummy origin
    if (parsed.origin !== dummyOrigin) {
      return null;
    }
    const lowerPath = parsed.pathname.toLowerCase();
    // Prevent redirect loops back to auth pages
    if (
      lowerPath === '/login' ||
      lowerPath === '/signup' ||
      lowerPath === '/auth/callback' ||
      lowerPath === '/forgot-password' ||
      lowerPath === '/reset-password'
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
