import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export interface FullNameValidationResult {
  isValid: boolean;
  error?: string;
  normalized: string;
}

export interface PhoneNumberValidationResult {
  isValid: boolean;
  error?: string;
  e164?: string;
  formatted?: string;
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  normalized: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SignupValidationResult {
  isValid: boolean;
  errors: {
    fullName?: string;
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
  };
  sanitized: {
    fullName: string;
    phoneE164: string;
    email: string;
  };
}

/**
 * Validates and normalizes user full name.
 * - Trims leading/trailing whitespace and collapses repeated spaces
 * - Rejects empty values, numbers-only, symbol-only, or names containing digits
 * - Allows Unicode letters, spaces, apostrophes, hyphens, and periods
 * - Enforces sensible length boundaries (2 to 70 characters)
 */
export function validateFullName(rawName: unknown): FullNameValidationResult {
  if (typeof rawName !== 'string') {
    return { isValid: false, error: 'Please enter your full name.', normalized: '' };
  }

  const normalized = rawName.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return { isValid: false, error: 'Please enter your full name.', normalized: '' };
  }

  if (normalized.length < 2) {
    return { isValid: false, error: 'Full name must be at least 2 characters.', normalized };
  }

  if (normalized.length > 70) {
    return { isValid: false, error: 'Full name must not exceed 70 characters.', normalized };
  }

  // Reject numbers-only or numbers anywhere in the name
  if (/\d/.test(normalized)) {
    if (/^\d[\d\s]*$/.test(normalized)) {
      return { isValid: false, error: 'Full name cannot consist only of numbers.', normalized };
    }
    return { isValid: false, error: 'Full name cannot contain numbers.', normalized };
  }

  // Reject symbol-only names (e.g. !@#$%^, ---, ...)
  if (!/\p{L}/u.test(normalized)) {
    return { isValid: false, error: 'Full name must contain at least one letter.', normalized };
  }

  // Check allowed characters: Unicode letters, Unicode combining marks (matras/accents), spaces, apostrophes, hyphens, periods
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(normalized)) {
    return {
      isValid: false,
      error: 'Full name can only contain letters, spaces, hyphens, apostrophes, and periods.',
      normalized,
    };
  }

  // Disallow repeated consecutive punctuation (e.g. "John..Doe", "Mary--Jane")
  if (/([.'-])\1+/.test(normalized)) {
    return {
      isValid: false,
      error: 'Full name contains invalid consecutive punctuation.',
      normalized,
    };
  }

  // Cannot start with punctuation
  if (/^[.'-]/.test(normalized)) {
    return {
      isValid: false,
      error: 'Full name cannot start with punctuation.',
      normalized,
    };
  }

  return { isValid: true, normalized };
}

/**
 * Validates and normalizes phone numbers to E.164 using libphonenumber-js.
 * - Supports Indian numbers by default and international numbers with country codes
 * - Rejects alphabetic text, impossible lengths, invalid country codes, and malformed numbers
 * - Normalizes valid numbers to E.164 (e.g. +919876543210)
 */
export function validatePhoneNumber(
  rawPhone: unknown,
  defaultCountry: CountryCode = 'IN'
): PhoneNumberValidationResult {
  if (typeof rawPhone !== 'string') {
    return { isValid: false, error: 'Please enter your contact number.' };
  }

  const trimmed = rawPhone.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Please enter your contact number.' };
  }

  // Reject alphabetic characters explicitly
  if (/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number cannot contain alphabetic characters.' };
  }

  // Reject obvious invalid symbols
  if (/[!@#$%^&*_=~`<>?{}[\]\\|]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number contains invalid characters.' };
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(trimmed, defaultCountry);

    if (!phoneNumber) {
      return {
        isValid: false,
        error: 'Please enter a valid phone number with country code (e.g., +91 98765 43210).',
      };
    }

    if (!phoneNumber.isValid()) {
      const isPossible = phoneNumber.isPossible();
      if (!isPossible) {
        return {
          isValid: false,
          error: 'Phone number length is invalid for the specified country.',
        };
      }
      return {
        isValid: false,
        error: 'Please enter a valid phone number (e.g., +91 98765 43210 or +1 415 555 2671).',
      };
    }

    return {
      isValid: true,
      e164: phoneNumber.format('E.164'),
      formatted: phoneNumber.formatInternational(),
    };
  } catch {
    return {
      isValid: false,
      error: 'Please enter a valid phone number.',
    };
  }
}

/**
 * Validates email syntax strictly without claiming inbox ownership.
 * - Trims whitespace and normalizes to lowercase
 * - Enforces RFC 5322 structure and minimum domain length
 */
export function validateEmail(rawEmail: unknown): EmailValidationResult {
  if (typeof rawEmail !== 'string') {
    return { isValid: false, error: 'Please enter your business email.', normalized: '' };
  }

  const normalized = rawEmail.trim().toLowerCase();

  if (normalized.length === 0) {
    return { isValid: false, error: 'Please enter your business email.', normalized: '' };
  }

  if (normalized.length < 5 || normalized.length > 254) {
    return {
      isValid: false,
      error: 'Email address must be between 5 and 254 characters.',
      normalized,
    };
  }

  // Standard email regex compliant with RFC 5322 web forms
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      error: 'Please enter a valid business email address (e.g., name@company.com).',
      normalized,
    };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: 'Please enter a valid email address.',
      normalized,
    };
  }

  const domain = parts[1];
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (!tld || tld.length < 2) {
    return {
      isValid: false,
      error: 'Please enter a valid top-level domain.',
      normalized,
    };
  }

  return { isValid: true, normalized };
}

/**
 * Validates password length and constraints.
 */
export function validatePassword(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { isValid: false, error: 'Please enter a password.' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must contain at least 8 characters.' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password must not exceed 128 characters.' };
  }

  return { isValid: true };
}

/**
 * Comprehensive signup payload validator for frontend forms and server-side routes.
 */
export function validateSignupPayload(payload: {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  agreeTerms?: unknown;
}): SignupValidationResult {
  const errors: SignupValidationResult['errors'] = {};

  const nameRes = validateFullName(payload.fullName);
  if (!nameRes.isValid) {
    errors.fullName = nameRes.error;
  }

  const phoneRes = validatePhoneNumber(payload.phone);
  if (!phoneRes.isValid) {
    errors.phone = phoneRes.error;
  }

  const emailRes = validateEmail(payload.email);
  if (!emailRes.isValid) {
    errors.email = emailRes.error;
  }

  const passRes = validatePassword(payload.password);
  if (!passRes.isValid) {
    errors.password = passRes.error;
  }

  if (payload.confirmPassword !== undefined) {
    if (typeof payload.confirmPassword !== 'string' || payload.confirmPassword.length === 0) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (payload.password !== payload.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  }

  if (payload.agreeTerms !== undefined && payload.agreeTerms !== true) {
    errors.agreeTerms = 'Please accept the Terms of Service and Privacy Policy.';
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    sanitized: {
      fullName: nameRes.normalized,
      phoneE164: phoneRes.e164 || '',
      email: emailRes.normalized,
    },
  };
}
