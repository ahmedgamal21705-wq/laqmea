export interface PhoneNormalizationResult {
  ok: boolean;
  e164: string;
  local: string;
  errorAr?: string;
  errorEn?: string;
}

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_DIGITS_MAP[ch] ?? ch);
}

/**
 * Normalizes and validates Egyptian mobile numbers to E.164 (+201XXXXXXXXX).
 * Supports +2010..., 2010..., 010..., 10... (Vodafone 010, Etisalat 011, Orange 012, WE 015).
 */
export function normalizeEgyptPhone(raw: string): PhoneNormalizationResult {
  const ascii = toAsciiDigits(raw).trim();
  const cleaned = ascii.replace(/[\s\-().]/g, '');

  if (!cleaned) {
    return {
      ok: false,
      e164: '',
      local: '',
      errorAr: 'يرجى إدخال رقم الهاتف المصري',
      errorEn: 'Please enter an Egyptian phone number',
    };
  }

  let national = '';
  if (cleaned.startsWith('+20')) {
    national = cleaned.slice(3);
  } else if (cleaned.startsWith('0020')) {
    national = cleaned.slice(4);
  } else if (cleaned.startsWith('20') && cleaned.length === 12) {
    national = cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    national = cleaned.slice(1);
  } else {
    national = cleaned;
  }

  if (!/^1[0125][0-9]{8}$/.test(national)) {
    return {
      ok: false,
      e164: '',
      local: '',
      errorAr: 'رقم الهاتف المصري غير صالح. يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقمًا (مثال: 01012345678 أو +201012345678).',
      errorEn: 'Invalid Egyptian mobile number. Must start with +2010, +2011, +2012, or +2015 followed by 8 digits.',
    };
  }

  return {
    ok: true,
    e164: `+20${national}`,
    local: `0${national}`,
  };
}

export function validateEmailAddress(raw: string): {
  ok: boolean;
  normalized: string;
  errorAr?: string;
  errorEn?: string;
} {
  const email = raw.trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      normalized: '',
      errorAr: 'يرجى إدخال البريد الإلكتروني',
      errorEn: 'Please enter your email address',
    };
  }
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return {
      ok: false,
      normalized: email,
      errorAr: 'صيغة البريد الإلكتروني غير صحيحة',
      errorEn: 'Please enter a valid email address',
    };
  }
  if (email.endsWith('@phone.lokma.app') || email.endsWith('@lokma.local')) {
    return {
      ok: false,
      normalized: email,
      errorAr: 'هذا النطاق محجوز للنظام ولا يمكن استخدامه كبريد شخصي',
      errorEn: 'This email domain is reserved for system accounts',
    };
  }
  return { ok: true, normalized: email };
}

export interface PasswordStrengthResult {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  errorAr?: string;
  errorEn?: string;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(password);
  const hasNumber = /[0-9٠-٩]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9\u0600-\u06FF\s]/.test(password);

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (password.length >= 6) score = 1;
  if (hasMinLength && (hasLetter || hasNumber)) score = 2;
  if (hasMinLength && hasLetter && hasNumber) score = 3;
  if (hasMinLength && hasLetter && hasNumber && (hasSymbol || password.length >= 12)) score = 4;

  if (password.length < 8) {
    return {
      ok: false,
      score,
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSymbol,
      errorAr: 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل',
      errorEn: 'Password must be at least 8 characters long',
    };
  }

  if (!hasLetter || !hasNumber) {
    return {
      ok: false,
      score,
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSymbol,
      errorAr: 'كلمة المرور يجب أن تحتوي على أحرف وأرقام معًا لزيادة الأمان',
      errorEn: 'Password must contain both letters and numbers',
    };
  }

  if (password.length > 128) {
    return {
      ok: false,
      score,
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSymbol,
      errorAr: 'كلمة المرور طويلة جدًا (الحد الأقصى 128 حرفًا)',
      errorEn: 'Password cannot exceed 128 characters',
    };
  }

  return {
    ok: true,
    score,
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSymbol,
  };
}

/**
 * Computes a deterministic SHA-256 hex digest of an E.164 phone number (+201XXXXXXXXX).
 * Used as a non-PII document ID in Firestore /phone_accounts/{phoneHash} to prevent duplicates.
 */
export async function hashPhoneE164(e164Phone: string): Promise<string> {
  const data = new TextEncoder().encode(e164Phone.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds a deterministic, non-PII Firebase Auth credential email alias for phone-registered accounts
 * so Firebase Auth securely hashes and verifies the user's password server-side.
 */
export function buildPhoneAuthAlias(phoneHash: string): string {
  return `p_${phoneHash.slice(0, 24)}@phone.lokma.app`;
}
