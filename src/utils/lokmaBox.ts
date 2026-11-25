import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Language,
  LokmaBoxBudgetTier,
  LokmaBoxFoodProblem,
  LokmaBoxLead,
  LokmaBoxMealType,
  LokmaBoxPrepDifficulty,
  LokmaBoxPrepTime,
  LokmaBoxPurchaseFrequency,
  LokmaBoxSurvey,
  LokmaBoxTimingPreference,
  LokmaBoxTryInterest,
  LokmaBoxWillingnessToBuy,
} from '../types/database';
import { hashPhoneE164, normalizeEgyptPhone, validateEmailAddress } from './authValidation';

export interface OptionMeta<T extends string> {
  value: T;
  ar: string;
  en: string;
}

export const WANTS_TO_TRY_OPTIONS: OptionMeta<LokmaBoxTryInterest>[] = [
  { value: 'yes', ar: 'نعم، متحمس جداً للتجربة فور الإطلاق', en: 'Yes, eager to try at launch' },
  { value: 'maybe', ar: 'ربما، حسب المكونات والسعر وقت الإطلاق', en: 'Maybe, depending on details' },
  { value: 'no', ar: 'أتابع الفكرة حالياً فقط', en: 'Just following the idea for now' },
];

export const PREP_DIFFICULTY_OPTIONS: OptionMeta<LokmaBoxPrepDifficulty>[] = [
  { value: 'always', ar: 'نعم، بشكل يومي تقريباً', en: 'Yes, almost daily' },
  { value: 'sometimes', ar: 'أحياناً حسب ضغط الدراسة', en: 'Sometimes during busy weeks' },
  { value: 'rarely', ar: 'نادراً ما أواجه صعوبة', en: 'Rarely' },
  { value: 'no', ar: 'لا، أجهز وجباتي بسهولة', en: 'No, I manage easily' },
];

export const FOOD_PROBLEM_OPTIONS: OptionMeta<LokmaBoxFoodProblem>[] = [
  { value: 'time', ar: 'ضيق الوقت بين المحاضرات والمذاكرة', en: 'Lack of time between classes' },
  { value: 'cost', ar: 'ارتفاع أسعار الأكل الجاهز والمطاعم', en: 'High cost of takeout & restaurants' },
  { value: 'cooking_skills', ar: 'صعوبة الطبخ أو عدم معرفة الوصفات', en: 'Cooking difficulty / lack of recipes' },
  { value: 'ingredients_waste', ar: 'تلف المكونات عند الشراء بكميات كبيرة', en: 'Ingredient waste when buying bulk' },
  { value: 'quality_hygiene', ar: 'ضعف نظافة وجودة المطاعم الاقتصادية', en: 'Quality & hygiene concerns' },
  { value: 'variety', ar: 'الملل من تكرار نفس الأكلات اليومية', en: 'Lack of daily meal variety' },
];

export const MEAL_TYPE_OPTIONS: OptionMeta<LokmaBoxMealType>[] = [
  { value: 'quick_pasta_rice', ar: 'وجبات مكرونة وأرز سريعة', en: 'Quick Pasta & Rice Bowls' },
  { value: 'chicken_protein', ar: 'وجبات دجاج وبروتين متبّلة وجاهزة للطهي', en: 'Marinated Chicken & Protein Kits' },
  { value: 'egyptian_home', ar: 'أكلات بيتي مصرية سريعة', en: 'Quick Egyptian Homemade Dishes' },
  { value: 'breakfast_snacks', ar: 'بوكس إفطار وسناكس للجامعة', en: 'Campus Breakfast & Snacks' },
  { value: 'healthy_light', ar: 'وجبات صحية وخفيفة عالية البروتين', en: 'Healthy High-Protein Meals' },
  { value: 'sandwiches_wraps', ar: 'ساندوتشات وراب سريع التحضير', en: 'Quick Wraps & Sandwiches' },
];

export const PREP_TIME_OPTIONS: OptionMeta<LokmaBoxPrepTime>[] = [
  { value: 'ready_heat', ar: 'أقل من 5 دقائق (تسخين سريع)', en: 'Under 5 min (Ready to heat)' },
  { value: 'under_10_min', ar: '5 إلى 10 دقائق', en: '5 – 10 minutes' },
  { value: '10_to_20_min', ar: '10 إلى 20 دقيقة', en: '10 – 20 minutes' },
  { value: '20_to_30_min', ar: '20 إلى 30 دقيقة', en: '20 – 30 minutes' },
];

export const BUDGET_TIER_OPTIONS: OptionMeta<LokmaBoxBudgetTier>[] = [
  { value: 'under_50', ar: 'أقل من 50 جنيه', en: 'Under 50 EGP' },
  { value: '50_to_75', ar: '50–75 جنيه', en: '50–75 EGP' },
  { value: '75_to_100', ar: '75–100 جنيه', en: '75–100 EGP' },
  { value: 'over_100', ar: 'أكثر من 100 جنيه', en: 'Over 100 EGP' },
];

export const PURCHASE_FREQUENCY_OPTIONS: OptionMeta<LokmaBoxPurchaseFrequency>[] = [
  { value: 'daily', ar: 'يومياً', en: 'Daily' },
  { value: '2_to_3_weekly', ar: '2–3 مرات أسبوعياً', en: '2–3 times/week' },
  { value: 'weekly', ar: 'مرة أسبوعياً', en: 'Once a week' },
  { value: 'biweekly', ar: 'كل أسبوعين', en: 'Every two weeks' },
  { value: 'monthly', ar: 'مرة شهرياً أو عند الحاجة', en: 'Monthly / Occasionally' },
];

export const BOX_TIMING_OPTIONS: OptionMeta<LokmaBoxTimingPreference>[] = [
  { value: 'breakfast', ar: 'Box للإفطار', en: 'Breakfast Box' },
  { value: 'lunch', ar: 'Box للغداء', en: 'Lunch Box' },
  { value: 'dinner', ar: 'Box للعشاء', en: 'Dinner Box' },
  { value: 'mixed', ar: 'Box متنوع (أكثر من وجبة)', en: 'Mixed Variety Box' },
];

export const WILLINGNESS_OPTIONS: OptionMeta<LokmaBoxWillingnessToBuy>[] = [
  { value: 'yes', ar: 'نعم، سأشتريه فعلياً', en: 'Yes, definitely' },
  { value: 'maybe', ar: 'ربما، حسب التجربة والسعر النهائي', en: 'Maybe, depends on final price' },
  { value: 'no', ar: 'لا أتوقع شراءه حالياً', en: 'Probably not' },
];

export function getOptionLabel<T extends string>(
  options: OptionMeta<T>[],
  value: string | null | undefined,
  lang: Language
): string {
  if (!value) return '—';
  const match = options.find((o) => o.value === value);
  if (!match) return value;
  return lang === 'ar' ? match.ar : match.en;
}

const LEAD_PHONES_STORAGE_KEY = 'lokma_box_submitted_phones_v1';
const SURVEY_RESPONDENT_STORAGE_KEY = 'lokma_box_respondent_id_v1';
const SURVEY_SUBMITTED_STORAGE_KEY = 'lokma_box_survey_submitted_v1';

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildLokmaBoxLeadDocId(e164Phone: string): Promise<string> {
  const hash = await hashPhoneE164(e164Phone);
  return `lead_${hash.slice(0, 24)}`;
}

export async function buildLokmaBoxSurveyDocId(respondentKey: string): Promise<string> {
  const hash = await sha256Hex(`lokma_box_survey:${respondentKey.trim()}`);
  return `survey_${hash.slice(0, 24)}`;
}

export function getOrCreateLokmaBoxRespondentId(uid?: string | null): string {
  if (uid && uid.trim()) return `uid:${uid.trim()}`;
  if (typeof window === 'undefined') return `srv:${Date.now()}`;
  try {
    const existing = window.localStorage.getItem(SURVEY_RESPONDENT_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,100}$/.test(existing)) {
      return `dev:${existing}`;
    }
    const generated =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(SURVEY_RESPONDENT_STORAGE_KEY, generated);
    return `dev:${generated}`;
  } catch {
    return `mem:${Date.now().toString(36)}`;
  }
}

export function hasSubmittedLeadLocally(e164Phone: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(LEAD_PHONES_STORAGE_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(e164Phone);
  } catch {
    return false;
  }
}

export function markLeadSubmittedLocally(e164Phone: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(LEAD_PHONES_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) {
      window.localStorage.setItem(LEAD_PHONES_STORAGE_KEY, JSON.stringify([e164Phone]));
      return;
    }
    if (!list.includes(e164Phone)) {
      window.localStorage.setItem(
        LEAD_PHONES_STORAGE_KEY,
        JSON.stringify([...list.slice(-10), e164Phone])
      );
    }
  } catch {
    // Ignore storage error
  }
}

export function hasSubmittedSurveyLocally(respondentKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(SURVEY_SUBMITTED_STORAGE_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(respondentKey);
  } catch {
    return false;
  }
}

export function markSurveySubmittedLocally(respondentKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SURVEY_SUBMITTED_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) {
      window.localStorage.setItem(SURVEY_SUBMITTED_STORAGE_KEY, JSON.stringify([respondentKey]));
      return;
    }
    if (!list.includes(respondentKey)) {
      window.localStorage.setItem(
        SURVEY_SUBMITTED_STORAGE_KEY,
        JSON.stringify([...list.slice(-10), respondentKey])
      );
    }
  } catch {
    // Ignore storage error
  }
}

export interface LokmaBoxLeadInput {
  fullName: string;
  phone: string;
  email: string;
  universityId: string | null;
  universityName: string;
  housingArea: string;
  wantsToTry: LokmaBoxTryInterest;
  consentAccepted: boolean;
}

export interface ValidationOutcome<T> {
  ok: boolean;
  data?: T;
  errorAr?: string;
  errorEn?: string;
}

export function validateLokmaBoxLeadInput(
  input: LokmaBoxLeadInput
): ValidationOutcome<{
  full_name: string;
  phone: string;
  email: string | null;
  university_id: string | null;
  university_name: string;
  housing_area: string;
  wants_to_try: LokmaBoxTryInterest;
  consent_accepted: true;
}> {
  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return {
      ok: false,
      errorAr: 'يرجى كتابة الاسم بالكامل (من حرفين على الأقل).',
      errorEn: 'Please enter your full name (at least 2 characters).',
    };
  }

  const phoneCheck = normalizeEgyptPhone(input.phone);
  if (!phoneCheck.ok) {
    return {
      ok: false,
      errorAr: phoneCheck.errorAr,
      errorEn: phoneCheck.errorEn,
    };
  }

  let normalizedEmail: string | null = null;
  if (input.email.trim()) {
    const emailCheck = validateEmailAddress(input.email);
    if (!emailCheck.ok) {
      return {
        ok: false,
        errorAr: emailCheck.errorAr,
        errorEn: emailCheck.errorEn,
      };
    }
    normalizedEmail = emailCheck.normalized;
  }

  const universityName = input.universityName.trim();
  if (universityName.length < 2 || universityName.length > 150) {
    return {
      ok: false,
      errorAr: 'يرجى اختيار جامعتك أو كتابة اسم الجامعة.',
      errorEn: 'Please select or enter your university name.',
    };
  }

  const housingArea = input.housingArea.trim();
  if (housingArea.length < 2 || housingArea.length > 200) {
    return {
      ok: false,
      errorAr: 'يرجى تحديد المنطقة أو مكان السكن.',
      errorEn: 'Please enter your area or housing location.',
    };
  }

  if (!['yes', 'maybe', 'no'].includes(input.wantsToTry)) {
    return {
      ok: false,
      errorAr: 'يرجى تحديد رغبتك في تجربة LOKMA BOX عند إطلاقه.',
      errorEn: 'Please select whether you want to try LOKMA BOX at launch.',
    };
  }

  if (!input.consentAccepted) {
    return {
      ok: false,
      errorAr: 'يجب الموافقة على استخدام بياناتك للتواصل معك بشأن إطلاق LOKMA BOX قبل الإرسال.',
      errorEn: 'Please confirm your consent to be contacted regarding LOKMA BOX before submitting.',
    };
  }

  return {
    ok: true,
    data: {
      full_name: fullName,
      phone: phoneCheck.e164,
      email: normalizedEmail,
      university_id: input.universityId && input.universityId !== 'other' ? input.universityId : null,
      university_name: universityName,
      housing_area: housingArea,
      wants_to_try: input.wantsToTry,
      consent_accepted: true,
    },
  };
}

export interface LokmaBoxSurveyInput {
  dailyPrepDifficulty: LokmaBoxPrepDifficulty | '';
  biggestFoodProblem: LokmaBoxFoodProblem | '';
  preferredMealTypes: LokmaBoxMealType[];
  preferredPrepTime: LokmaBoxPrepTime | '';
  preferredBudgetTier: LokmaBoxBudgetTier | '';
  purchaseFrequency: LokmaBoxPurchaseFrequency | '';
  preferredBoxTiming: LokmaBoxTimingPreference | '';
  willingToBuy: LokmaBoxWillingnessToBuy | '';
  suggestions: string;
  universityName?: string;
  consentAccepted: boolean;
}

export function validateLokmaBoxSurveyInput(
  input: LokmaBoxSurveyInput
): ValidationOutcome<{
  daily_prep_difficulty: LokmaBoxPrepDifficulty;
  biggest_food_problem: LokmaBoxFoodProblem;
  preferred_meal_types: LokmaBoxMealType[];
  preferred_prep_time: LokmaBoxPrepTime;
  preferred_budget_tier: LokmaBoxBudgetTier;
  purchase_frequency: LokmaBoxPurchaseFrequency;
  preferred_box_timing: LokmaBoxTimingPreference;
  willing_to_buy: LokmaBoxWillingnessToBuy;
  suggestions: string;
  university_name: string | null;
  consent_accepted: true;
}> {
  if (!input.dailyPrepDifficulty) {
    return {
      ok: false,
      errorAr: 'يرجى الإجابة على السؤال 1: هل تواجه صعوبة في تجهيز وجباتك اليومية؟',
      errorEn: 'Please answer Question 1 about daily meal preparation.',
    };
  }
  if (!input.biggestFoodProblem) {
    return {
      ok: false,
      errorAr: 'يرجى الإجابة على السؤال 2: ما أكبر مشكلة تواجهك في توفير الطعام؟',
      errorEn: 'Please answer Question 2 about your biggest food challenge.',
    };
  }
  if (!Array.isArray(input.preferredMealTypes) || input.preferredMealTypes.length === 0) {
    return {
      ok: false,
      errorAr: 'يرجى اختيار نوع وجبة واحد على الأقل في السؤال 3.',
      errorEn: 'Please select at least one meal type in Question 3.',
    };
  }
  if (!input.preferredPrepTime) {
    return {
      ok: false,
      errorAr: 'يرجى الإجابة على السؤال 4: ما الوقت المناسب لتحضير الوجبة؟',
      errorEn: 'Please answer Question 4 about preferred prep time.',
    };
  }
  if (!input.preferredBudgetTier) {
    return {
      ok: false,
      errorAr: 'يرجى اختيار الميزانية المناسبة في السؤال 5.',
      errorEn: 'Please select your budget tier in Question 5.',
    };
  }
  if (!input.purchaseFrequency) {
    return {
      ok: false,
      errorAr: 'يرجى الإجابة على السؤال 6: كم مرة تتوقع شراء الصندوق؟',
      errorEn: 'Please answer Question 6 about purchase frequency.',
    };
  }
  if (!input.preferredBoxTiming) {
    return {
      ok: false,
      errorAr: 'يرجى اختيار تفضيلك لتوقيت الصندوق في السؤال 7.',
      errorEn: 'Please select your preferred box timing in Question 7.',
    };
  }
  if (!input.willingToBuy) {
    return {
      ok: false,
      errorAr: 'يرجى الإجابة على السؤال 8: هل ستشتري المنتج فعلياً بالسعر المناسب؟',
      errorEn: 'Please answer Question 8 about willingness to buy.',
    };
  }

  const trimmedSuggestions = input.suggestions.trim().slice(0, 1000);
  if (!input.consentAccepted) {
    return {
      ok: false,
      errorAr: 'يرجى تأكيد الموافقة على استخدام رأيك لأغراض تطوير LOKMA BOX.',
      errorEn: 'Please confirm consent to use your survey feedback for LOKMA BOX research.',
    };
  }

  const cleanUni = input.universityName?.trim();

  return {
    ok: true,
    data: {
      daily_prep_difficulty: input.dailyPrepDifficulty,
      biggest_food_problem: input.biggestFoodProblem,
      preferred_meal_types: input.preferredMealTypes.slice(0, 6),
      preferred_prep_time: input.preferredPrepTime,
      preferred_budget_tier: input.preferredBudgetTier,
      purchase_frequency: input.purchaseFrequency,
      preferred_box_timing: input.preferredBoxTiming,
      willing_to_buy: input.willingToBuy,
      suggestions: trimmedSuggestions,
      university_name: cleanUni ? cleanUni.slice(0, 150) : null,
      consent_accepted: true,
    },
  };
}

export interface SubmitResult {
  ok: boolean;
  duplicate?: boolean;
  errorAr?: string;
  errorEn?: string;
}

export async function submitLokmaBoxLead(
  input: LokmaBoxLeadInput,
  uid?: string | null
): Promise<SubmitResult> {
  const validated = validateLokmaBoxLeadInput(input);
  if (!validated.ok || !validated.data) {
    return {
      ok: false,
      errorAr: validated.errorAr,
      errorEn: validated.errorEn,
    };
  }

  if (hasSubmittedLeadLocally(validated.data.phone)) {
    return {
      ok: false,
      duplicate: true,
      errorAr: 'تم تسجيل اهتمامك بهذا الرقم مسبقاً — شكراً لحماسك! سنتواصل معك عند إطلاق LOKMA BOX.',
      errorEn: 'This phone number is already registered on our early-access list. Thank you!',
    };
  }

  try {
    const leadId = await buildLokmaBoxLeadDocId(validated.data.phone);
    await setDoc(doc(db, 'lokma_box_leads', leadId), {
      ...validated.data,
      user_id: uid || null,
      source: 'landing_lokma_box',
      consent_accepted_at: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    markLeadSubmittedLocally(validated.data.phone);
    return { ok: true };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    const msg = err instanceof Error ? err.message : String(err);

    if (code === 'already-exists' || msg.includes('already exists')) {
      markLeadSubmittedLocally(validated.data.phone);
      return {
        ok: false,
        duplicate: true,
        errorAr: 'رقم الهاتف مسجّل مسبقاً في قائمة المهتمين بـ LOKMA BOX.',
        errorEn: 'This phone number is already registered on the LOKMA BOX waitlist.',
      };
    }

    if (code === 'permission-denied') {
      // Note: On create-once deterministic IDs, Firestore returns permission-denied when updating an existing document
      // or if rules were not yet deployed to the remote project. Provide a clear, helpful message.
      return {
        ok: false,
        errorAr:
          'تعذر إتمام التسجيل: قد يكون هذا الرقم مسجلاً مسبقاً، أو أن قواعد قاعدة البيانات تحتاج إلى النشر.',
        errorEn:
          'Could not submit: this phone number may already be registered, or database rules need deployment.',
      };
    }

    return {
      ok: false,
      errorAr: 'حدث خطأ أثناء حفظ بياناتك. يرجى المحاولة مرة أخرى بعد لحظات.',
      errorEn: 'Failed saving your registration. Please try again in a moment.',
    };
  }
}

export async function submitLokmaBoxSurvey(
  input: LokmaBoxSurveyInput,
  uid?: string | null
): Promise<SubmitResult> {
  const validated = validateLokmaBoxSurveyInput(input);
  if (!validated.ok || !validated.data) {
    return {
      ok: false,
      errorAr: validated.errorAr,
      errorEn: validated.errorEn,
    };
  }

  const respondentKey = getOrCreateLokmaBoxRespondentId(uid);
  if (hasSubmittedSurveyLocally(respondentKey)) {
    return {
      ok: false,
      duplicate: true,
      errorAr: 'تم استلام مشاركتك في الاستبيان مسبقاً من هذا الحساب/الجهاز — شكراً جزيلاً لوقتك!',
      errorEn: 'Your survey response has already been recorded. Thank you for helping shape LOKMA BOX!',
    };
  }

  try {
    const surveyId = await buildLokmaBoxSurveyDocId(respondentKey);
    await setDoc(doc(db, 'lokma_box_surveys', surveyId), {
      ...validated.data,
      user_id: uid || null,
      createdAt: serverTimestamp(),
    });
    markSurveySubmittedLocally(respondentKey);
    return { ok: true };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';

    if (code === 'already-exists') {
      markSurveySubmittedLocally(respondentKey);
      return {
        ok: false,
        duplicate: true,
        errorAr: 'تم استلام مشاركتك في الاستبيان مسبقاً — شكراً لمساهمتك!',
        errorEn: 'Your survey response was already submitted. Thank you!',
      };
    }

    if (code === 'permission-denied') {
      return {
        ok: false,
        errorAr:
          'تعذر حفظ الاستبيان: ربما أرسلت إجابتك مسبقاً، أو أن قواعد قاعدة البيانات تحتاج إلى التحديث والنشر.',
        errorEn:
          'Could not submit survey: you may have already submitted, or Firestore rules need deployment.',
      };
    }

    return {
      ok: false,
      errorAr: 'تعذر إرسال الاستبيان حالياً. يرجى المحاولة مرة أخرى.',
      errorEn: 'Failed submitting your survey right now. Please try again.',
    };
  }
}

export interface ChartDatum {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface LokmaBoxAnalytics {
  totalLeads: number;
  wantsToTryYesCount: number;
  wantsToTryMaybeCount: number;
  totalSurveys: number;
  willingToBuyYesCount: number;
  willingToBuyMaybeCount: number;
  willingToBuyNoCount: number;
  willingToBuyYesPct: number;
  topUniversity: string;
  topFoodProblem: string;
  topMealType: string;
  topBudgetTier: string;
  universityDistribution: ChartDatum[];
  foodProblemsDistribution: ChartDatum[];
  mealTypesDistribution: ChartDatum[];
  budgetDistribution: ChartDatum[];
  willingnessDistribution: ChartDatum[];
  timingDistribution: ChartDatum[];
  prepTimeDistribution: ChartDatum[];
  frequencyDistribution: ChartDatum[];
  prepDifficultyDistribution: ChartDatum[];
}

function buildDistribution(
  counts: Map<string, number>,
  totalDenominator: number,
  labelResolver: (key: string) => string,
  orderedKeys?: string[]
): ChartDatum[] {
  const denom = Math.max(1, totalDenominator);
  const keys = orderedKeys
    ? orderedKeys.filter((k) => counts.has(k) || counts.size > 0)
    : Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

  return keys.map((key) => {
    const count = counts.get(key) ?? 0;
    return {
      key,
      label: labelResolver(key),
      count,
      pct: Math.round((count / denom) * 100),
    };
  });
}

export function computeLokmaBoxAnalytics(
  leads: LokmaBoxLead[],
  surveys: LokmaBoxSurvey[],
  lang: Language
): LokmaBoxAnalytics {
  const uniMap = new Map<string, number>();
  leads.forEach((lead) => {
    const name = lead.university_name.trim();
    if (name) uniMap.set(name, (uniMap.get(name) ?? 0) + 1);
  });

  const problemMap = new Map<string, number>();
  const mealTypeMap = new Map<string, number>();
  const budgetMap = new Map<string, number>();
  const willingnessMap = new Map<string, number>();
  const timingMap = new Map<string, number>();
  const prepTimeMap = new Map<string, number>();
  const frequencyMap = new Map<string, number>();
  const difficultyMap = new Map<string, number>();

  surveys.forEach((s) => {
    problemMap.set(s.biggest_food_problem, (problemMap.get(s.biggest_food_problem) ?? 0) + 1);
    s.preferred_meal_types.forEach((mt) => {
      mealTypeMap.set(mt, (mealTypeMap.get(mt) ?? 0) + 1);
    });
    budgetMap.set(s.preferred_budget_tier, (budgetMap.get(s.preferred_budget_tier) ?? 0) + 1);
    willingnessMap.set(s.willing_to_buy, (willingnessMap.get(s.willing_to_buy) ?? 0) + 1);
    timingMap.set(s.preferred_box_timing, (timingMap.get(s.preferred_box_timing) ?? 0) + 1);
    prepTimeMap.set(s.preferred_prep_time, (prepTimeMap.get(s.preferred_prep_time) ?? 0) + 1);
    frequencyMap.set(s.purchase_frequency, (frequencyMap.get(s.purchase_frequency) ?? 0) + 1);
    difficultyMap.set(s.daily_prep_difficulty, (difficultyMap.get(s.daily_prep_difficulty) ?? 0) + 1);
  });

  const universityDistribution = buildDistribution(uniMap, leads.length, (k) => k);
  const foodProblemsDistribution = buildDistribution(
    problemMap,
    surveys.length,
    (k) => getOptionLabel(FOOD_PROBLEM_OPTIONS, k, lang)
  ).sort((a, b) => b.count - a.count);

  const totalMealVotes = Array.from(mealTypeMap.values()).reduce((sum, n) => sum + n, 0);
  const mealTypesDistribution = buildDistribution(
    mealTypeMap,
    Math.max(surveys.length, totalMealVotes ? surveys.length : 1),
    (k) => getOptionLabel(MEAL_TYPE_OPTIONS, k, lang)
  ).sort((a, b) => b.count - a.count);

  const budgetDistribution = buildDistribution(
    budgetMap,
    surveys.length,
    (k) => getOptionLabel(BUDGET_TIER_OPTIONS, k, lang),
    BUDGET_TIER_OPTIONS.map((o) => o.value)
  );

  const willingnessDistribution = buildDistribution(
    willingnessMap,
    surveys.length,
    (k) => getOptionLabel(WILLINGNESS_OPTIONS, k, lang),
    WILLINGNESS_OPTIONS.map((o) => o.value)
  );

  const timingDistribution = buildDistribution(
    timingMap,
    surveys.length,
    (k) => getOptionLabel(BOX_TIMING_OPTIONS, k, lang),
    BOX_TIMING_OPTIONS.map((o) => o.value)
  );

  const prepTimeDistribution = buildDistribution(
    prepTimeMap,
    surveys.length,
    (k) => getOptionLabel(PREP_TIME_OPTIONS, k, lang),
    PREP_TIME_OPTIONS.map((o) => o.value)
  );

  const frequencyDistribution = buildDistribution(
    frequencyMap,
    surveys.length,
    (k) => getOptionLabel(PURCHASE_FREQUENCY_OPTIONS, k, lang),
    PURCHASE_FREQUENCY_OPTIONS.map((o) => o.value)
  );

  const prepDifficultyDistribution = buildDistribution(
    difficultyMap,
    surveys.length,
    (k) => getOptionLabel(PREP_DIFFICULTY_OPTIONS, k, lang),
    PREP_DIFFICULTY_OPTIONS.map((o) => o.value)
  );

  const wantsToTryYesCount = leads.filter((l) => l.wants_to_try === 'yes').length;
  const wantsToTryMaybeCount = leads.filter((l) => l.wants_to_try === 'maybe').length;
  const willingToBuyYesCount = surveys.filter((s) => s.willing_to_buy === 'yes').length;
  const willingToBuyMaybeCount = surveys.filter((s) => s.willing_to_buy === 'maybe').length;
  const willingToBuyNoCount = surveys.filter((s) => s.willing_to_buy === 'no').length;
  const willingToBuyYesPct =
    surveys.length > 0 ? Math.round((willingToBuyYesCount / surveys.length) * 100) : 0;

  const topBudgetItem = [...budgetDistribution].sort((a, b) => b.count - a.count)[0];

  return {
    totalLeads: leads.length,
    wantsToTryYesCount,
    wantsToTryMaybeCount,
    totalSurveys: surveys.length,
    willingToBuyYesCount,
    willingToBuyMaybeCount,
    willingToBuyNoCount,
    willingToBuyYesPct,
    topUniversity: universityDistribution[0]?.count ? universityDistribution[0].label : '—',
    topFoodProblem: foodProblemsDistribution[0]?.count ? foodProblemsDistribution[0].label : '—',
    topMealType: mealTypesDistribution[0]?.count ? mealTypesDistribution[0].label : '—',
    topBudgetTier: topBudgetItem?.count ? topBudgetItem.label : '—',
    universityDistribution,
    foodProblemsDistribution,
    mealTypesDistribution,
    budgetDistribution,
    willingnessDistribution,
    timingDistribution,
    prepTimeDistribution,
    frequencyDistribution,
    prepDifficultyDistribution,
  };
}

/**
 * Prevents spreadsheet CSV formula injection (DDE / Excel formulas starting with =, +, -, @, tab, CR).
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return safe;
}

export function escapeCsvCell(value: unknown): string {
  const safe = sanitizeSpreadsheetCell(value);
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildCsvString(headers: string[], rows: Array<Array<unknown>>): string {
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  // UTF-8 BOM guarantees clean Arabic rendering when opened directly in Microsoft Excel
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

function escapeXml(value: unknown): string {
  return sanitizeSpreadsheetCell(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSpreadsheetRowsXml(headers: string[], rows: Array<Array<unknown>>): string {
  const headerXml = `<Row>${headers
    .map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('')}</Row>`;
  const bodyXml = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            if (typeof cell === 'number' && Number.isFinite(cell)) {
              return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
            }
            return `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
          })
          .join('')}</Row>`
    )
    .join('');
  return `${headerXml}${bodyXml}`;
}

export function buildExcelWorkbookXml(
  leads: LokmaBoxLead[],
  surveys: LokmaBoxSurvey[],
  lang: Language
): string {
  const analytics = computeLokmaBoxAnalytics(leads, surveys, lang);

  const summaryHeaders =
    lang === 'ar' ? ['المؤشر', 'القيمة'] : ['Metric', 'Value'];
  const summaryRows: Array<Array<unknown>> = [
    [lang === 'ar' ? 'إجمالي الطلاب المهتمين' : 'Total Interested Students', analytics.totalLeads],
    [lang === 'ar' ? 'يرغبون بالتجربة فوراً' : 'Eager to Try at Launch', analytics.wantsToTryYesCount],
    [lang === 'ar' ? 'إجمالي الاستبيانات المكتملة' : 'Completed Surveys', analytics.totalSurveys],
    [lang === 'ar' ? 'مستعدون للشراء الفعلي' : 'Willing to Buy (Yes)', analytics.willingToBuyYesCount],
    [lang === 'ar' ? 'نسبة الاستعداد للشراء (%)' : 'Willingness to Buy (%)', analytics.willingToBuyYesPct],
    [lang === 'ar' ? 'الجامعة الأكثر تسجيلاً' : 'Top University', analytics.topUniversity],
    [lang === 'ar' ? 'أكثر مشكلة غذائية شيوعاً' : 'Top Food Challenge', analytics.topFoodProblem],
    [lang === 'ar' ? 'نوع الوجبات الأكثر طلباً' : 'Top Meal Type', analytics.topMealType],
    [lang === 'ar' ? 'الميزانية السعرية المفضلة' : 'Preferred Budget Tier', analytics.topBudgetTier],
  ];

  const leadsHeaders =
    lang === 'ar'
      ? [
          'الاسم بالكامل',
          'رقم الهاتف',
          'البريد الإلكتروني',
          'الجامعة',
          'المنطقة / السكن',
          'الرغبة في التجربة',
          'موافقة التواصل',
          'تاريخ التسجيل',
        ]
      : [
          'Full Name',
          'Phone',
          'Email',
          'University',
          'Housing Area',
          'Wants To Try',
          'Consent Accepted',
          'Submitted At',
        ];

  const leadsRows = leads.map((l) => [
    l.full_name,
    l.phone,
    l.email || '—',
    l.university_name,
    l.housing_area,
    getOptionLabel(WANTS_TO_TRY_OPTIONS, l.wants_to_try, lang),
    l.consent_accepted ? (lang === 'ar' ? 'نعم' : 'Yes') : 'No',
    l.created_at,
  ]);

  const surveyHeaders =
    lang === 'ar'
      ? [
          '1. صعوبة التحضير اليومي',
          '2. أكبر مشكلة في الطعام',
          '3. أنواع الوجبات المفضلة',
          '4. وقت التحضير المناسب',
          '5. الميزانية المناسبة',
          '6. تكرار الشراء المتوقع',
          '7. تفضيل توقيت الصندوق',
          '8. الاستعداد للشراء الفعلي',
          '9. المقترحات',
          'الجامعة (إن وُجدت)',
          'تاريخ المشاركة',
        ]
      : [
          '1. Daily Prep Difficulty',
          '2. Biggest Food Challenge',
          '3. Preferred Meal Types',
          '4. Preferred Prep Time',
          '5. Preferred Budget Tier',
          '6. Purchase Frequency',
          '7. Preferred Box Timing',
          '8. Willing to Buy',
          '9. Suggestions',
          'University',
          'Submitted At',
        ];

  const surveyRows = surveys.map((s) => [
    getOptionLabel(PREP_DIFFICULTY_OPTIONS, s.daily_prep_difficulty, lang),
    getOptionLabel(FOOD_PROBLEM_OPTIONS, s.biggest_food_problem, lang),
    s.preferred_meal_types.map((mt) => getOptionLabel(MEAL_TYPE_OPTIONS, mt, lang)).join(' | '),
    getOptionLabel(PREP_TIME_OPTIONS, s.preferred_prep_time, lang),
    getOptionLabel(BUDGET_TIER_OPTIONS, s.preferred_budget_tier, lang),
    getOptionLabel(PURCHASE_FREQUENCY_OPTIONS, s.purchase_frequency, lang),
    getOptionLabel(BOX_TIMING_OPTIONS, s.preferred_box_timing, lang),
    getOptionLabel(WILLINGNESS_OPTIONS, s.willing_to_buy, lang),
    s.suggestions || '—',
    s.university_name || '—',
    s.created_at,
  ]);

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B3D2E" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Summary">
    <Table>${buildSpreadsheetRowsXml(summaryHeaders, summaryRows)}</Table>
  </Worksheet>
  <Worksheet ss:Name="Interested Students">
    <Table>${buildSpreadsheetRowsXml(leadsHeaders, leadsRows)}</Table>
  </Worksheet>
  <Worksheet ss:Name="Survey Responses">
    <Table>${buildSpreadsheetRowsXml(surveyHeaders, surveyRows)}</Table>
  </Worksheet>
</Workbook>`;
}

function triggerFileDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportLokmaBoxLeadsCsv(leads: LokmaBoxLead[], lang: Language): void {
  const headers =
    lang === 'ar'
      ? [
          'الاسم بالكامل',
          'رقم الهاتف',
          'البريد الإلكتروني',
          'الجامعة',
          'المنطقة / مكان السكن',
          'الرغبة في التجربة',
          'الموافقة على التواصل',
          'تاريخ التسجيل',
        ]
      : [
          'Full Name',
          'Phone',
          'Email',
          'University',
          'Housing Area',
          'Wants To Try',
          'Consent',
          'Submitted At',
        ];
  const rows = leads.map((l) => [
    l.full_name,
    l.phone,
    l.email || '',
    l.university_name,
    l.housing_area,
    getOptionLabel(WANTS_TO_TRY_OPTIONS, l.wants_to_try, lang),
    l.consent_accepted ? (lang === 'ar' ? 'نعم' : 'Yes') : 'No',
    l.created_at,
  ]);
  const csv = buildCsvString(headers, rows);
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerFileDownload(
    csv,
    'text/csv;charset=utf-8;',
    `lokma-box-leads-${dateStamp}.csv`
  );
}

export function exportLokmaBoxSurveysCsv(surveys: LokmaBoxSurvey[], lang: Language): void {
  const headers =
    lang === 'ar'
      ? [
          'صعوبة التحضير اليومي',
          'أكبر مشكلة في الطعام',
          'الوجبات المفضلة',
          'وقت التحضير',
          'الميزانية المناسبة',
          'تكرار الشراء',
          'توقيت الصندوق',
          'الاستعداد للشراء',
          'المقترحات',
          'الجامعة',
          'تاريخ الإرسال',
        ]
      : [
          'Daily Prep Difficulty',
          'Biggest Food Challenge',
          'Preferred Meals',
          'Prep Time',
          'Budget Tier',
          'Purchase Frequency',
          'Box Timing',
          'Willing To Buy',
          'Suggestions',
          'University',
          'Submitted At',
        ];
  const rows = surveys.map((s) => [
    getOptionLabel(PREP_DIFFICULTY_OPTIONS, s.daily_prep_difficulty, lang),
    getOptionLabel(FOOD_PROBLEM_OPTIONS, s.biggest_food_problem, lang),
    s.preferred_meal_types.map((m) => getOptionLabel(MEAL_TYPE_OPTIONS, m, lang)).join(' | '),
    getOptionLabel(PREP_TIME_OPTIONS, s.preferred_prep_time, lang),
    getOptionLabel(BUDGET_TIER_OPTIONS, s.preferred_budget_tier, lang),
    getOptionLabel(PURCHASE_FREQUENCY_OPTIONS, s.purchase_frequency, lang),
    getOptionLabel(BOX_TIMING_OPTIONS, s.preferred_box_timing, lang),
    getOptionLabel(WILLINGNESS_OPTIONS, s.willing_to_buy, lang),
    s.suggestions || '',
    s.university_name || '',
    s.created_at,
  ]);
  const csv = buildCsvString(headers, rows);
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerFileDownload(
    csv,
    'text/csv;charset=utf-8;',
    `lokma-box-surveys-${dateStamp}.csv`
  );
}

export function exportLokmaBoxResearchExcel(
  leads: LokmaBoxLead[],
  surveys: LokmaBoxSurvey[],
  lang: Language
): void {
  const xml = buildExcelWorkbookXml(leads, surveys, lang);
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerFileDownload(
    xml,
    'application/vnd.ms-excel;charset=utf-8;',
    `lokma-box-market-research-${dateStamp}.xls`
  );
}
