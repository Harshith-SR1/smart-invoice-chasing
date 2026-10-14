/**
 * Email validation and content sanitisation utilities.
 *
 * Used by the send endpoint to guard against injected headers,
 * malformed addresses, or oversized payloads before calling Resend.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Maximum sizes to avoid sending unexpectedly large payloads */
const MAX_SUBJECT_LEN = 300;
const MAX_BODY_LEN = 50_000;

export interface SanitisedMessage {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
}

export type SanitiseResult =
  | { ok: true; message: SanitisedMessage }
  | { ok: false; error: string };

/**
 * Validate and sanitise the outbound message fields.
 *
 * Does NOT trust any field from the client request body for recipient address —
 * the caller must supply `toEmail` from a canonical database record.
 */
export function sanitiseMessage(
  toEmail: string,
  toName: string,
  subject: string,
  body: string
): SanitiseResult {
  // Validate recipient address from the DB record
  if (!toEmail || !EMAIL_RE.test(toEmail.trim())) {
    return { ok: false, error: 'Recipient email address is invalid or missing.' };
  }

  // Strip null bytes and CRLF that could inject SMTP headers, collapsing to single space
  const cleanSubject = subject
    .replace(/[\r\n\x00]+/g, ' ')
    .trim()
    .slice(0, MAX_SUBJECT_LEN);

  if (!cleanSubject) {
    return { ok: false, error: 'Email subject cannot be empty.' };
  }

  const cleanBody = body.replace(/\x00/g, '').trim().slice(0, MAX_BODY_LEN);

  if (!cleanBody) {
    return { ok: false, error: 'Email body cannot be empty.' };
  }

  return {
    ok: true,
    message: {
      toEmail: toEmail.trim(),
      toName: toName.trim() || toEmail.trim(),
      subject: cleanSubject,
      body: cleanBody,
    },
  };
}

/**
 * Convert plain-text body to minimal HTML.
 * Preserves line breaks and escapes HTML entities.
 * Does not interpret Markdown or allow arbitrary HTML from user input.
 */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const paragraphs = escaped
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.6; }
  p { margin: 0 0 12px; }
</style></head>
<body>${paragraphs}</body></html>`;
}
