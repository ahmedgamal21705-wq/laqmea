import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  ConfirmationResult,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import { AuthMethod, User } from '../types/database';
import {
  buildPhoneAuthAlias,
  evaluatePasswordStrength,
  hashPhoneE164,
  normalizeEgyptPhone,
  validateEmailAddress,
} from '../utils/authValidation';

export const PRIMARY_ADMIN_EMAIL = 'ahmedgamal21705@gmail.com';

export type SignupRole = 'student' | 'provider' | 'delivery_partner';

export interface LoginReturnTarget {
  view: 'landing' | 'onboarding' | 'student' | 'provider' | 'delivery' | 'events' | 'admin';
  eventId?: string | null;
}

interface SyncedUser {
  id: string;
  name: string;
  email: string;
}

export type ServerUserRole = 'admin' | 'user';

export interface EmailRegisterInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: SignupRole;
  acceptedTerms: boolean;
}

export interface PhoneRegisterInput {
  fullName: string;
  phone: string;
  password: string;
  role: SignupRole;
  acceptedTerms: boolean;
}

interface PendingPhoneRegistration {
  mode: 'register' | 'reset';
  fullName?: string;
  e164Phone: string;
  phoneHash: string;
  password?: string;
  role?: SignupRole;
  termsAcceptedAt?: number;
}

interface FirebaseAuthContextValue {
  firebaseUser: FirebaseUser | null;
  syncedUser: SyncedUser | null;
  userDoc: User | null;
  isAdmin: boolean;
  isVerified: boolean;
  needsEmailVerification: boolean;
  authLoading: boolean;
  signingIn: boolean;
  pendingPhoneOtp: boolean;
  pendingOtpPhoneDisplay: string | null;
  authError: string | null;
  unauthorizedDomainHost: string | null;
  authNotice: string | null;
  firestoreConfigError: string | null;
  clearAuthError: () => void;
  clearAuthNotice: () => void;
  returnTarget: LoginReturnTarget;
  setReturnTarget: (target: LoginReturnTarget) => void;
  signInWithGoogle: (preferredRole?: SignupRole, rememberMe?: boolean) => Promise<boolean>;
  registerWithEmail: (input: EmailRegisterInput) => Promise<boolean>;
  signInWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  signInWithPhone: (phone: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  sendPhoneRegistrationOtp: (
    input: PhoneRegisterInput,
    recaptchaContainerId: string
  ) => Promise<boolean>;
  verifyPhoneOtpAndRegister: (otpCode: string) => Promise<boolean>;
  sendPhonePasswordResetOtp: (
    phone: string,
    recaptchaContainerId: string
  ) => Promise<boolean>;
  completePhonePasswordReset: (otpCode: string, newPassword: string) => Promise<boolean>;
  cancelPhoneOtp: () => void;
  resetPassword: (email: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshEmailVerification: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | undefined>(undefined);

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function isFirebaseAccountVerified(user: FirebaseUser | null): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified || (user.phoneNumber && user.phoneNumber.length >= 10));
}

function mapFirebaseAuthErrorAr(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول بحساب جوجل قبل إتمام العملية. يمكنك المحاولة مرة أخرى.';
    case 'auth/cancelled-popup-request':
      return 'تم إلغاء طلب تسجيل الدخول السابق. يرجى المحاولة مرة أخرى.';
    case 'auth/popup-blocked':
      return 'حظر المتصفح نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالشبكة أثناء تسجيل الدخول. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب حالياً. يرجى التواصل مع إدارة المنصة.';
    case 'auth/account-exists-with-different-credential':
    case 'auth/credential-already-in-use':
      return 'يوجد حساب مسجل مسبقاً بنفس البريد الإلكتروني أو رقم الهاتف بطريقة دخول مختلفة.';
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return host
        ? `نطاق الموقع الحالي (${host}) غير مصرح به في إعدادات Firebase Authentication (Authorized domains).`
        : 'نطاق الموقع الحالي غير مصرح به في إعدادات Firebase Authentication.';
    }
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول أو استعادة كلمة المرور.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً. يجب أن لا تقل عن 8 أحرف وتجمع بين الأحرف والأرقام.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني أو رقم الهاتف وكلمة المرور.';
    case 'auth/invalid-phone-number':
      return 'صيغة رقم الهاتف غير صحيحة. يجب إدخال رقم هاتف مصري صالح بصيغة +20.';
    case 'auth/missing-phone-number':
      return 'يرجى إدخال رقم الهاتف أولاً.';
    case 'auth/invalid-verification-code':
      return 'رمز التحقق (OTP) غير صحيح. يرجى التأكد من الأرقام الستة والمحاولة مرة أخرى.';
    case 'auth/code-expired':
      return 'انتهت صلاحية رمز التحقق (OTP). يرجى طلب رمز جديد.';
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'تعذر إتمام التحقق الأمني لرسائل SMS (reCAPTCHA / App Credential). تأكد من تفعيل Phone Auth والنطاق في Firebase Console.';
    case 'auth/quota-exceeded':
    case 'auth/billing-not-enabled':
      return 'خدمة إرسال رسائل SMS (OTP) عبر Firebase غير مفعلة أو تجاوزت الحصة المجانية في Firebase Console (تتطلب تفعيل Phone Auth / Blaze أو أرقام اختبار).';
    case 'auth/too-many-requests':
      return 'تم إجراء محاولات متكررة كثيرة. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    case 'auth/operation-not-allowed':
      return 'طريقة المصادقة المطلوبة (Email/Password أو Phone SMS) غير مفعّلة بعد في لوحة تحكم Firebase (Authentication -> Sign-in method).';
    case 'auth/requires-recent-login':
      return 'لأسباب أمنية، يرجى إعادة تسجيل الدخول لإتمام هذا الإجراء.';
    default:
      return code
        ? `حدث خطأ أثناء المصادقة (${code}). يرجى المحاولة مرة أخرى.`
        : 'حدث خطأ أثناء المصادقة. يرجى المحاولة مرة أخرى.';
  }
}

const PENDING_SIGNUP_KEY = 'lokma_pending_signup';

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [syncedUser, setSyncedUser] = useState<SyncedUser | null>(null);
  const [serverRole, setServerRole] = useState<ServerUserRole>('user');
  const [userDoc, setUserDoc] = useState<User | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState<boolean>(false);
  const [hasUserRoleAdmin, setHasUserRoleAdmin] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [pendingPhoneOtp, setPendingPhoneOtp] = useState<boolean>(false);
  const [pendingOtpPhoneDisplay, setPendingOtpPhoneDisplay] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [firestoreConfigError, setFirestoreConfigError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<LoginReturnTarget>({
    view: 'landing',
    eventId: null,
  });

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const pendingPhoneRef = useRef<PendingPhoneRegistration | null>(null);

  useEffect(() => {
    void testConnection().then((res) => {
      if (!res.ok && res.message) {
        setFirestoreConfigError(res.message);
      }
    });
  }, []);

  const clearRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore clear errors if DOM element was unmounted
      }
      recaptchaVerifierRef.current = null;
    }
  }, []);

  const cancelPhoneOtp = useCallback(() => {
    confirmationResultRef.current = null;
    pendingPhoneRef.current = null;
    setPendingPhoneOtp(false);
    setPendingOtpPhoneDisplay(null);
    clearRecaptcha();
  }, [clearRecaptcha]);

  const syncUserWithBackend = useCallback(async (user: FirebaseUser): Promise<SyncedUser | null> => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        setServerRole('user');
        return null;
      }
      const data = await res.json();
      setServerRole(data?.role === 'admin' ? 'admin' : 'user');
      if (data?.user) {
        setSyncedUser(data.user);
        return data.user as SyncedUser;
      }
      return null;
    } catch {
      setServerRole('user');
      return null;
    }
  }, []);

  const ensuringUsersRef = useRef<Map<string, Promise<void>>>(new Map());

  const ensureFirestoreUserDoc = useCallback(
    async (
      user: FirebaseUser,
      options?: {
        preferredRole?: SignupRole;
        phoneOverride?: string;
        authMethod?: AuthMethod;
        termsAccepted?: boolean;
        recordLogin?: boolean;
      }
    ) => {
      if (!isFirebaseAccountVerified(user)) return;

      const existingPromise = ensuringUsersRef.current.get(user.uid);
      if (existingPromise) {
        await existingPromise;
        return;
      }

      const task = (async () => {
        const userPath = `users/${user.uid}`;
        const userRef = doc(db, 'users', user.uid);
        const isPrimaryAdmin =
          user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL && user.emailVerified;

        let pendingPhone = options?.phoneOverride || user.phoneNumber || '';
        let pendingRole: SignupRole = options?.preferredRole || 'student';
        let pendingAuthMethod: AuthMethod =
          options?.authMethod ||
          (user.phoneNumber && (!user.email || user.email.endsWith('@phone.lokma.app'))
            ? 'phone'
            : user.providerData.some((p) => p.providerId === 'google.com')
            ? 'google'
            : 'email');
        let pendingTerms = Boolean(options?.termsAccepted);

        try {
          const rawPending = sessionStorage.getItem(PENDING_SIGNUP_KEY);
          if (rawPending) {
            const parsed = JSON.parse(rawPending) as {
              email?: string;
              phone?: string;
              role?: SignupRole;
              acceptedTerms?: boolean;
            };
            if (parsed.email && parsed.email.toLowerCase() === (user.email || '').toLowerCase()) {
              pendingPhone = pendingPhone || parsed.phone || '';
              if (
                parsed.role === 'student' ||
                parsed.role === 'provider' ||
                parsed.role === 'delivery_partner'
              ) {
                pendingRole = parsed.role;
              }
              if (parsed.acceptedTerms) {
                pendingTerms = true;
              }
            }
            sessionStorage.removeItem(PENDING_SIGNUP_KEY);
          }
        } catch {
          // ignore sessionStorage failures
        }

        if (isPrimaryAdmin) {
          const adminPath = `admins/${user.uid}`;
          try {
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            if (!adminSnap.exists()) {
              await setDoc(doc(db, 'admins', user.uid), {
                email: (user.email || PRIMARY_ADMIN_EMAIL).slice(0, 150),
                createdAt: serverTimestamp(),
              });
            }
            setHasAdminDoc(true);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, adminPath);
          }
        }

        const rolePath = `user_roles/${user.uid}`;
        try {
          const roleRef = doc(db, 'user_roles', user.uid);
          const roleSnap = await getDoc(roleRef);
          if (!roleSnap.exists()) {
            await setDoc(roleRef, {
              user_id: user.uid,
              email: (user.email || `${user.uid}@phone.lokma.app`).slice(0, 150),
              role: isPrimaryAdmin ? 'admin' : 'user',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, rolePath);
        }

        try {
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            const safeName = (
              user.displayName ||
              (user.email && !user.email.endsWith('@phone.lokma.app')
                ? user.email.split('@')[0]
                : '') ||
              (pendingPhone ? pendingPhone : 'LOKMA User')
            )
              .trim()
              .slice(0, 120);
            const safeEmail = (user.email || `${user.uid}@phone.lokma.app`).slice(0, 150);
            const normalizedPhone = pendingPhone ? normalizeEgyptPhone(pendingPhone) : null;
            const safePhone = normalizedPhone?.ok
              ? normalizedPhone.e164
              : pendingPhone.trim().slice(0, 30);
            const targetRole = isPrimaryAdmin ? 'admin' : pendingRole;

            await setDoc(userRef, {
              id: user.uid,
              full_name: safeName || 'LOKMA User',
              email: safeEmail,
              phone: safePhone,
              role: targetRole,
              status: 'active',
              auth_method: pendingAuthMethod,
              email_verified: Boolean(user.emailVerified),
              phone_verified: Boolean(user.phoneNumber),
              terms_accepted_at: pendingTerms ? serverTimestamp() : null,
              last_login_at: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            if (safePhone && normalizedPhone?.ok) {
              const pHash = await hashPhoneE164(normalizedPhone.e164);
              const phoneRegRef = doc(db, 'phone_accounts', pHash);
              try {
                const phoneRegSnap = await getDoc(phoneRegRef);
                if (!phoneRegSnap.exists()) {
                  await setDoc(phoneRegRef, {
                    user_id: user.uid,
                    auth_method: pendingAuthMethod,
                    phone_verified: Boolean(user.phoneNumber),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }
              } catch (phoneErr) {
                console.warn('Phone registry registration skipped:', phoneErr);
              }
            }

            if (targetRole === 'student') {
              const stuPath = `student_profiles/${user.uid}`;
              try {
                const stuRef = doc(db, 'student_profiles', user.uid);
                const stuSnap = await getDoc(stuRef);
                if (!stuSnap.exists()) {
                  await setDoc(stuRef, {
                    user_id: user.uid,
                    university_id: '',
                    university_name: '',
                    faculty: '',
                    daily_budget: 0,
                    weekly_budget: 0,
                    delivery_location: '',
                    allergen_ids: [],
                    dietary_pref_ids: [],
                    category_prefs: {},
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }
              } catch (stuErr) {
                handleFirestoreError(stuErr, OperationType.WRITE, stuPath);
              }
            }
          } else {
            // Preserve existing role, status, createdAt, and profile data; only update verification & login timestamp
            const existingData = existingSnap.data();
            const updatePayload: Record<string, unknown> = {
              email_verified: Boolean(user.emailVerified),
              phone_verified: Boolean(user.phoneNumber || existingData.phone_verified),
              updatedAt: serverTimestamp(),
            };
            if (options?.recordLogin) {
              updatePayload.last_login_at = serverTimestamp();
            }
            if (!existingData.phone && user.phoneNumber) {
              updatePayload.phone = user.phoneNumber.slice(0, 30);
            }
            await updateDoc(userRef, updatePayload);

            // Ensure phone_accounts index exists for legacy/existing users with a phone number
            const activePhone = String(existingData.phone || user.phoneNumber || '').trim();
            if (activePhone) {
              const norm = normalizeEgyptPhone(activePhone);
              if (norm.ok) {
                const pHash = await hashPhoneE164(norm.e164);
                const phoneRegRef = doc(db, 'phone_accounts', pHash);
                try {
                  const phoneRegSnap = await getDoc(phoneRegRef);
                  if (!phoneRegSnap.exists()) {
                    await setDoc(phoneRegRef, {
                      user_id: user.uid,
                      auth_method:
                        existingData.auth_method === 'phone' ||
                        existingData.auth_method === 'google'
                          ? existingData.auth_method
                          : 'email',
                      phone_verified: Boolean(user.phoneNumber || existingData.phone_verified),
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    });
                  }
                } catch {
                  // Ignore if already claimed by another account
                }
              }
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }
      })();

      ensuringUsersRef.current.set(user.uid, task);
      try {
        await task;
      } finally {
        ensuringUsersRef.current.delete(user.uid);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        void syncUserWithBackend(user);
        if (isFirebaseAccountVerified(user)) {
          try {
            await ensureFirestoreUserDoc(user);
          } catch (err) {
            console.error('Failed ensuring Firestore user doc:', err);
          }
        }
      } else {
        setSyncedUser(null);
        setServerRole('user');
        setUserDoc(null);
        setHasAdminDoc(false);
        setHasUserRoleAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [ensureFirestoreUserDoc, syncUserWithBackend]);

  // Listen to own Firestore /users/{uid}, /admins/{uid}, and /user_roles/{uid} when verified
  useEffect(() => {
    if (!firebaseUser || !isFirebaseAccountVerified(firebaseUser)) {
      setUserDoc(null);
      setHasAdminDoc(false);
      setHasUserRoleAdmin(false);
      return;
    }

    const userPath = `users/${firebaseUser.uid}`;
    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (!snap.exists()) {
          setUserDoc(null);
          return;
        }
        const d = snap.data();
        setUserDoc({
          id: String(d.id || snap.id),
          full_name: String(d.full_name || ''),
          email: String(d.email || ''),
          phone: String(d.phone || ''),
          role: d.role || 'student',
          status: d.status || 'active',
          auth_method: d.auth_method,
          email_verified: typeof d.email_verified === 'boolean' ? d.email_verified : undefined,
          phone_verified: typeof d.phone_verified === 'boolean' ? d.phone_verified : undefined,
          terms_accepted_at: d.terms_accepted_at ? tsToIso(d.terms_accepted_at) : undefined,
          last_login_at: d.last_login_at ? tsToIso(d.last_login_at) : undefined,
          created_at: tsToIso(d.createdAt),
          updated_at: tsToIso(d.updatedAt),
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    );

    const adminPath = `admins/${firebaseUser.uid}`;
    const unsubAdmin = onSnapshot(
      doc(db, 'admins', firebaseUser.uid),
      (snap) => {
        setHasAdminDoc(snap.exists());
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, adminPath);
      }
    );

    const rolePath = `user_roles/${firebaseUser.uid}`;
    const unsubRole = onSnapshot(
      doc(db, 'user_roles', firebaseUser.uid),
      (snap) => {
        setHasUserRoleAdmin(snap.exists() && snap.data()?.role === 'admin');
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, rolePath);
      }
    );

    return () => {
      unsubUser();
      unsubAdmin();
      unsubRole();
    };
  }, [firebaseUser]);

  const applyPersistence = async (rememberMe: boolean) => {
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
    } catch {
      // Fallback safely if persistence API is restricted by browser privacy mode
    }
  };

  const signInWithGoogle = async (
    preferredRole: SignupRole = 'student',
    rememberMe = true
  ): Promise<boolean> => {
    setAuthError(null);
    setUnauthorizedDomainHost(null);
    setAuthNotice(null);
    setSigningIn(true);
    try {
      await applyPersistence(rememberMe);
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await ensureFirestoreUserDoc(cred.user, {
        preferredRole,
        authMethod: 'google',
        termsAccepted: true,
        recordLogin: true,
      });
      await syncUserWithBackend(cred.user);
      return true;
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthNotice(mapFirebaseAuthErrorAr(error));
        return false;
      }
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomainHost(host || 'current domain');
        console.warn('Google Sign-In blocked by Firebase Authorized Domains for host:', host);
      } else {
        console.error('Google Sign-In failed:', error);
      }
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const registerWithEmail = async (input: EmailRegisterInput): Promise<boolean> => {
    setAuthError(null);
    setAuthNotice(null);

    if (!input.acceptedTerms) {
      setAuthError('يجب الموافقة على الشروط والأحكام أولاً لإتمام إنشاء الحساب.');
      return false;
    }

    const trimmedName = input.fullName.trim();
    if (trimmedName.length < 2) {
      setAuthError('يرجى كتابة الاسم بالكامل (حرفين على الأقل).');
      return false;
    }

    const emailCheck = validateEmailAddress(input.email);
    if (!emailCheck.ok) {
      setAuthError(emailCheck.errorAr || 'البريد الإلكتروني غير صالح.');
      return false;
    }

    let normalizedE164Phone = '';
    if (input.phone.trim()) {
      const phoneCheck = normalizeEgyptPhone(input.phone);
      if (!phoneCheck.ok) {
        setAuthError(phoneCheck.errorAr || 'رقم الهاتف المصري غير صالح.');
        return false;
      }
      normalizedE164Phone = phoneCheck.e164;
    }

    const pwCheck = evaluatePasswordStrength(input.password);
    if (!pwCheck.ok) {
      setAuthError(pwCheck.errorAr || 'كلمة المرور لا تستوفي شروط الأمان.');
      return false;
    }

    setSigningIn(true);
    try {
      if (normalizedE164Phone) {
        const pHash = await hashPhoneE164(normalizedE164Phone);
        const existingPhoneSnap = await getDoc(doc(db, 'phone_accounts', pHash));
        if (existingPhoneSnap.exists()) {
          setAuthError('رقم الهاتف مسجل بالفعل لحساب آخر. يرجى تسجيل الدخول أو استخدام رقم آخر.');
          return false;
        }
      }

      try {
        sessionStorage.setItem(
          PENDING_SIGNUP_KEY,
          JSON.stringify({
            email: emailCheck.normalized,
            phone: normalizedE164Phone,
            role: input.role,
            acceptedTerms: input.acceptedTerms,
          })
        );
      } catch {
        // ignore storage restrictions
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        emailCheck.normalized,
        input.password
      );
      await updateProfile(cred.user, {
        displayName: trimmedName.slice(0, 120),
      });
      await sendEmailVerification(cred.user);
      setAuthNotice(
        'تم إنشاء الحساب وإرسال رابط التفعيل إلى بريدك الإلكتروني. لن يُفعّل الحساب قبل تأكيد البريد الإلكتروني والضغط على "تحققت من بريدي — متابعة".'
      );
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string,
    rememberMe = true
  ): Promise<boolean> => {
    setAuthError(null);
    setAuthNotice(null);

    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.ok) {
      setAuthError(emailCheck.errorAr || 'صيغة البريد الإلكتروني غير صحيحة.');
      return false;
    }

    setSigningIn(true);
    try {
      await applyPersistence(rememberMe);
      const cred = await signInWithEmailAndPassword(auth, emailCheck.normalized, password);
      if (!cred.user.emailVerified) {
        setAuthNotice(
          'حسابك غير موثق بعد. يرجى فتح رابط التفعيل المرسل إلى بريدك الإلكتروني قبل متابعة الاستخدام.'
        );
        return false;
      }
      await ensureFirestoreUserDoc(cred.user, {
        authMethod: 'email',
        recordLogin: true,
      });
      await syncUserWithBackend(cred.user);
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithPhone = async (
    phone: string,
    password: string,
    rememberMe = true
  ): Promise<boolean> => {
    setAuthError(null);
    setAuthNotice(null);

    const phoneCheck = normalizeEgyptPhone(phone);
    if (!phoneCheck.ok) {
      setAuthError(phoneCheck.errorAr || 'رقم الهاتف غير صالح.');
      return false;
    }
    if (!password) {
      setAuthError('يرجى إدخال كلمة المرور.');
      return false;
    }

    setSigningIn(true);
    try {
      const pHash = await hashPhoneE164(phoneCheck.e164);
      const phoneSnap = await getDoc(doc(db, 'phone_accounts', pHash));
      if (!phoneSnap.exists()) {
        setAuthError('لا يوجد حساب مسجل برقم الهاتف هذا. يمكنك إنشاء حساب جديد الآن.');
        return false;
      }

      const phoneData = phoneSnap.data();
      if (phoneData.auth_method !== 'phone') {
        setAuthError(
          phoneData.auth_method === 'google'
            ? 'هذا الرقم مرتبط بحساب مسجل عبر جوجل. يرجى تسجيل الدخول باستخدام زر جوجل.'
            : 'هذا الرقم مرتبط بحساب مسجل بالبريد الإلكتروني. يرجى تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور.'
        );
        return false;
      }

      await applyPersistence(rememberMe);
      const aliasEmail = buildPhoneAuthAlias(pHash);
      const cred = await signInWithEmailAndPassword(auth, aliasEmail, password);
      await ensureFirestoreUserDoc(cred.user, {
        phoneOverride: phoneCheck.e164,
        authMethod: 'phone',
        recordLogin: true,
      });
      await syncUserWithBackend(cred.user);
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const initRecaptchaVerifier = (containerId: string): RecaptchaVerifier => {
    clearRecaptcha();
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const sendPhoneRegistrationOtp = async (
    input: PhoneRegisterInput,
    recaptchaContainerId: string
  ): Promise<boolean> => {
    setAuthError(null);
    setAuthNotice(null);

    if (!input.acceptedTerms) {
      setAuthError('يجب الموافقة على الشروط والأحكام أولاً لإتمام إنشاء الحساب.');
      return false;
    }
    const trimmedName = input.fullName.trim();
    if (trimmedName.length < 2) {
      setAuthError('يرجى كتابة الاسم بالكامل (حرفين على الأقل).');
      return false;
    }
    const phoneCheck = normalizeEgyptPhone(input.phone);
    if (!phoneCheck.ok) {
      setAuthError(phoneCheck.errorAr || 'رقم الهاتف غير صالح.');
      return false;
    }
    const pwCheck = evaluatePasswordStrength(input.password);
    if (!pwCheck.ok) {
      setAuthError(pwCheck.errorAr || 'كلمة المرور لا تستوفي شروط الأمان.');
      return false;
    }

    setSigningIn(true);
    try {
      const pHash = await hashPhoneE164(phoneCheck.e164);
      const existingSnap = await getDoc(doc(db, 'phone_accounts', pHash));
      if (existingSnap.exists()) {
        setAuthError('رقم الهاتف مسجل بالفعل لحساب آخر. لا يمكن تسجيل نفس الرقم لأكثر من حساب.');
        return false;
      }

      const verifier = initRecaptchaVerifier(recaptchaContainerId);
      const confirmation = await signInWithPhoneNumber(auth, phoneCheck.e164, verifier);
      confirmationResultRef.current = confirmation;
      pendingPhoneRef.current = {
        mode: 'register',
        fullName: trimmedName.slice(0, 120),
        e164Phone: phoneCheck.e164,
        phoneHash: pHash,
        password: input.password,
        role: input.role,
        termsAcceptedAt: Date.now(),
      };
      setPendingPhoneOtp(true);
      setPendingOtpPhoneDisplay(phoneCheck.e164);
      setAuthNotice(`تم إرسال رمز التحقق (OTP) عبر SMS إلى ${phoneCheck.e164}.`);
      return true;
    } catch (error: unknown) {
      clearRecaptcha();
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomainHost(host || 'current domain');
      }
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const verifyPhoneOtpAndRegister = async (otpCode: string): Promise<boolean> => {
    setAuthError(null);
    const confirmation = confirmationResultRef.current;
    const pending = pendingPhoneRef.current;
    if (!confirmation || !pending || pending.mode !== 'register') {
      setAuthError('انتهت جلسة التحقق. يرجى طلب رمز OTP جديد.');
      cancelPhoneOtp();
      return false;
    }

    const cleanCode = otpCode.trim();
    if (!/^[0-9]{6}$/.test(cleanCode)) {
      setAuthError('أدخل رمز التحقق المكون من 6 أرقام.');
      return false;
    }

    setSigningIn(true);
    try {
      const cred = await confirmation.confirm(cleanCode);
      const aliasEmail = buildPhoneAuthAlias(pending.phoneHash);
      const hasEmailProvider = cred.user.providerData.some((p) => p.providerId === 'password');

      if (!hasEmailProvider && pending.password) {
        try {
          await linkWithCredential(
            cred.user,
            EmailAuthProvider.credential(aliasEmail, pending.password)
          );
        } catch (linkErr: unknown) {
          const code =
            typeof linkErr === 'object' && linkErr !== null && 'code' in linkErr
              ? String((linkErr as { code?: unknown }).code)
              : '';
          if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
            await signOut(auth);
            cancelPhoneOtp();
            setAuthError('رقم الهاتف مسجل بالفعل لحساب آخر.');
            return false;
          }
          if (code !== 'auth/provider-already-linked') {
            throw linkErr;
          }
        }
      }

      if (pending.fullName) {
        await updateProfile(cred.user, {
          displayName: pending.fullName,
        });
      }

      await ensureFirestoreUserDoc(cred.user, {
        preferredRole: pending.role || 'student',
        phoneOverride: pending.e164Phone,
        authMethod: 'phone',
        termsAccepted: true,
        recordLogin: true,
      });
      await syncUserWithBackend(cred.user);
      cancelPhoneOtp();
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const sendPhonePasswordResetOtp = async (
    phone: string,
    recaptchaContainerId: string
  ): Promise<boolean> => {
    setAuthError(null);
    setAuthNotice(null);

    const phoneCheck = normalizeEgyptPhone(phone);
    if (!phoneCheck.ok) {
      setAuthError(phoneCheck.errorAr || 'رقم الهاتف غير صالح.');
      return false;
    }

    setSigningIn(true);
    try {
      const pHash = await hashPhoneE164(phoneCheck.e164);
      const phoneSnap = await getDoc(doc(db, 'phone_accounts', pHash));
      if (!phoneSnap.exists()) {
        setAuthError('لا يوجد حساب مسجل برقم الهاتف هذا.');
        return false;
      }
      if (phoneSnap.data().auth_method !== 'phone') {
        setAuthError('هذا الحساب مسجل بالبريد الإلكتروني. استخدم خيار استعادة كلمة المرور عبر البريد.');
        return false;
      }

      const verifier = initRecaptchaVerifier(recaptchaContainerId);
      const confirmation = await signInWithPhoneNumber(auth, phoneCheck.e164, verifier);
      confirmationResultRef.current = confirmation;
      pendingPhoneRef.current = {
        mode: 'reset',
        e164Phone: phoneCheck.e164,
        phoneHash: pHash,
      };
      setPendingPhoneOtp(true);
      setPendingOtpPhoneDisplay(phoneCheck.e164);
      setAuthNotice(`تم إرسال رمز استعادة كلمة المرور إلى ${phoneCheck.e164}.`);
      return true;
    } catch (error: unknown) {
      clearRecaptcha();
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomainHost(host || 'current domain');
      }
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const completePhonePasswordReset = async (
    otpCode: string,
    newPassword: string
  ): Promise<boolean> => {
    setAuthError(null);
    const confirmation = confirmationResultRef.current;
    const pending = pendingPhoneRef.current;
    if (!confirmation || !pending || pending.mode !== 'reset') {
      setAuthError('انتهت جلسة التحقق. يرجى طلب رمز OTP جديد.');
      cancelPhoneOtp();
      return false;
    }

    const cleanCode = otpCode.trim();
    if (!/^[0-9]{6}$/.test(cleanCode)) {
      setAuthError('أدخل رمز التحقق المكون من 6 أرقام.');
      return false;
    }

    const pwCheck = evaluatePasswordStrength(newPassword);
    if (!pwCheck.ok) {
      setAuthError(pwCheck.errorAr || 'كلمة المرور الجديدة ضعيفة.');
      return false;
    }

    setSigningIn(true);
    try {
      const cred = await confirmation.confirm(cleanCode);
      await updatePassword(cred.user, newPassword);
      await ensureFirestoreUserDoc(cred.user, {
        phoneOverride: pending.e164Phone,
        authMethod: 'phone',
        recordLogin: true,
      });
      await syncUserWithBackend(cred.user);
      cancelPhoneOtp();
      setAuthNotice('تم تحديث كلمة المرور بنجاح وتسجيل دخولك.');
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setAuthError(null);
    setAuthNotice(null);
    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.ok) {
      setAuthError(emailCheck.errorAr || 'أدخل بريدك الإلكتروني أولاً لإرسال رابط استعادة كلمة المرور.');
      return false;
    }
    setSigningIn(true);
    try {
      await sendPasswordResetEmail(auth, emailCheck.normalized);
      setAuthNotice('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    setAuthError(null);
    if (!auth.currentUser) return false;
    setSigningIn(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthNotice('تم إعادة إرسال رسالة التفعيل إلى بريدك الإلكتروني.');
      return true;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    setAuthError(null);
    if (!auth.currentUser) return false;
    setSigningIn(true);
    try {
      await reload(auth.currentUser);
      const refreshed = auth.currentUser;
      setFirebaseUser(refreshed ? ({ ...refreshed } as FirebaseUser) : null);
      if (refreshed.emailVerified) {
        await ensureFirestoreUserDoc(refreshed, {
          authMethod: 'email',
          recordLogin: true,
        });
        await syncUserWithBackend(refreshed);
        setAuthNotice(null);
        return true;
      }
      setAuthError('لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التفعيل في بريدك واضغط على الرابط.');
      return false;
    } catch (error: unknown) {
      setAuthError(mapFirebaseAuthErrorAr(error));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    setAuthError(null);
    setAuthNotice(null);
    cancelPhoneOtp();
    await signOut(auth);
    setSyncedUser(null);
    setServerRole('user');
    setUserDoc(null);
    setHasAdminDoc(false);
    setHasUserRoleAdmin(false);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  const isPrimaryAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL;
  const isAdmin = Boolean(
    firebaseUser?.emailVerified &&
      (serverRole === 'admin' ||
        isPrimaryAdmin ||
        hasAdminDoc ||
        hasUserRoleAdmin ||
        userDoc?.role === 'admin')
  );
  const isVerified = isFirebaseAccountVerified(firebaseUser);
  const needsEmailVerification = Boolean(firebaseUser && !isVerified);

  return (
    <FirebaseAuthContext.Provider
      value={{
        firebaseUser,
        syncedUser,
        userDoc,
        isAdmin,
        isVerified,
        needsEmailVerification,
        authLoading,
        signingIn,
        pendingPhoneOtp,
        pendingOtpPhoneDisplay,
        authError,
        unauthorizedDomainHost,
        authNotice,
        firestoreConfigError,
        clearAuthError: () => {
          setAuthError(null);
          setUnauthorizedDomainHost(null);
        },
        clearAuthNotice: () => setAuthNotice(null),
        returnTarget,
        setReturnTarget,
        signInWithGoogle,
        registerWithEmail,
        signInWithEmail,
        signInWithPhone,
        sendPhoneRegistrationOtp,
        verifyPhoneOtpAndRegister,
        sendPhonePasswordResetOtp,
        completePhonePasswordReset,
        cancelPhoneOtp,
        resetPassword,
        resendVerificationEmail,
        refreshEmailVerification,
        signOutUser,
        getIdToken,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) throw new Error('useFirebaseAuth must be used inside FirebaseAuthProvider');
  return ctx;
}
