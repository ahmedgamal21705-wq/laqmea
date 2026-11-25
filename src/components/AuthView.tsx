import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  X,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { SignupRole, useFirebaseAuth } from '../context/FirebaseAuthContext';
import { AppView, useLokma } from '../context/LokmaContext';
import {
  evaluatePasswordStrength,
  normalizeEgyptPhone,
  validateEmailAddress,
} from '../utils/authValidation';
import { LokmaLogo } from './LokmaLogo';

type AuthMode = 'login' | 'register' | 'reset';
type AuthChannel = 'email' | 'phone';

const RECAPTCHA_CONTAINER_ID = 'lokma-phone-recaptcha';

export const AuthView: React.FC = () => {
  const { lang, setView, pushToast } = useLokma();
  const {
    firebaseUser,
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
    clearAuthError,
    clearAuthNotice,
    returnTarget,
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
  } = useFirebaseAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [channel, setChannel] = useState<AuthChannel>('email');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [role, setRole] = useState<SignupRole>('student');
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;
  const isAr = lang === 'ar';

  const phonePreview = useMemo(() => {
    if (!phone.trim()) return null;
    return normalizeEgyptPhone(phone);
  }, [phone]);

  const emailPreview = useMemo(() => {
    if (!email.trim()) return null;
    return validateEmailAddress(email);
  }, [email]);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(mode === 'reset' ? newPassword : password),
    [mode, newPassword, password]
  );

  const navigateAfterAuth = (explicitRole?: string, allowFallbackLanding = false) => {
    let destView: Exclude<AppView, 'auth'> = returnTarget.view || 'landing';

    if (destView === 'landing') {
      const effectiveRole = explicitRole || userDoc?.role;
      if (effectiveRole === 'admin' && isAdmin) {
        destView = 'admin';
      } else if (effectiveRole === 'provider') {
        destView = 'provider';
      } else if (effectiveRole === 'delivery_partner') {
        destView = 'delivery';
      } else if (effectiveRole === 'student') {
        destView = 'student';
      } else if (!allowFallbackLanding) {
        return;
      }
    }

    const nextUrl =
      destView === 'events' && returnTarget.eventId
        ? `/events?event=${encodeURIComponent(returnTarget.eventId)}`
        : destView === 'landing'
        ? '/'
        : `/${destView}`;
    window.history.replaceState({}, '', nextUrl);
    setView(destView);
  };

  useEffect(() => {
    if (!authLoading && !signingIn && !authError && !pendingPhoneOtp && firebaseUser && isVerified) {
      if (returnTarget.view === 'landing' && !userDoc) {
        return;
      }
      navigateAfterAuth(userDoc?.role, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, signingIn, authError, pendingPhoneOtp, firebaseUser, isVerified, userDoc?.role, returnTarget.view]);

  const handleModeSwitch = (next: AuthMode) => {
    clearAuthError();
    clearAuthNotice();
    setLocalError(null);
    cancelPhoneOtp();
    setOtpCode('');
    setMode(next);
  };

  const handleChannelSwitch = (next: AuthChannel) => {
    clearAuthError();
    clearAuthNotice();
    setLocalError(null);
    cancelPhoneOtp();
    setOtpCode('');
    setChannel(next);
  };

  const handleGoogleLogin = async () => {
    clearAuthError();
    setLocalError(null);
    const ok = await signInWithGoogle(role, rememberMe);
    if (ok) {
      pushToast(isAr ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully', 'success');
      navigateAfterAuth(undefined, false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    clearAuthNotice();
    setLocalError(null);

    // 1) LOGIN
    if (mode === 'login') {
      if (channel === 'email') {
        const ok = await signInWithEmail(email, password, rememberMe);
        if (ok) {
          pushToast(isAr ? 'مرحباً بعودتك! تم تسجيل الدخول بنجاح' : 'Signed in successfully');
          navigateAfterAuth(undefined, false);
        }
        return;
      }

      const ok = await signInWithPhone(phone, password, rememberMe);
      if (ok) {
        pushToast(isAr ? 'مرحباً بعودتك! تم تسجيل الدخول برقم الهاتف' : 'Signed in successfully');
        navigateAfterAuth(undefined, false);
      }
      return;
    }

    // 2) REGISTER
    if (mode === 'register') {
      if (!fullName.trim() || fullName.trim().length < 2) {
        setLocalError(
          isAr ? 'يرجى كتابة الاسم بالكامل (حرفين على الأقل).' : 'Please enter your full name.'
        );
        return;
      }

      if (channel === 'email') {
        const eCheck = validateEmailAddress(email);
        if (!eCheck.ok) {
          setLocalError(isAr ? eCheck.errorAr || '' : eCheck.errorEn || '');
          return;
        }
        if (phone.trim()) {
          const pCheck = normalizeEgyptPhone(phone);
          if (!pCheck.ok) {
            setLocalError(isAr ? pCheck.errorAr || '' : pCheck.errorEn || '');
            return;
          }
        }
      } else {
        const pCheck = normalizeEgyptPhone(phone);
        if (!pCheck.ok) {
          setLocalError(isAr ? pCheck.errorAr || '' : pCheck.errorEn || '');
          return;
        }
      }

      if (!passwordStrength.ok) {
        setLocalError(
          isAr ? passwordStrength.errorAr || '' : passwordStrength.errorEn || ''
        );
        return;
      }

      if (password !== confirmPassword) {
        setLocalError(
          isAr
            ? 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.'
            : 'Password and confirmation do not match.'
        );
        return;
      }

      if (!acceptedTerms) {
        setLocalError(
          isAr
            ? 'يجب الموافقة على الشروط والأحكام قبل إنشاء الحساب.'
            : 'You must accept the Terms & Conditions to create an account.'
        );
        return;
      }

      if (channel === 'email') {
        await registerWithEmail({
          fullName,
          email,
          password,
          phone,
          role,
          acceptedTerms,
        });
        return;
      }

      if (!pendingPhoneOtp) {
        await sendPhoneRegistrationOtp(
          {
            fullName,
            phone,
            password,
            role,
            acceptedTerms,
          },
          RECAPTCHA_CONTAINER_ID
        );
      } else {
        const ok = await verifyPhoneOtpAndRegister(otpCode);
        if (ok) {
          pushToast(
            isAr
              ? 'تم توثيق رقم الهاتف وإنشاء حسابك بنجاح!'
              : 'Phone verified and account created!',
            'success'
          );
          navigateAfterAuth(role);
        }
      }
      return;
    }

    // 3) FORGOT PASSWORD RESET
    if (mode === 'reset') {
      if (channel === 'email') {
        await resetPassword(email);
        return;
      }

      if (!pendingPhoneOtp) {
        await sendPhonePasswordResetOtp(phone, RECAPTCHA_CONTAINER_ID);
      } else {
        if (!passwordStrength.ok) {
          setLocalError(
            isAr ? passwordStrength.errorAr || '' : passwordStrength.errorEn || ''
          );
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setLocalError(
            isAr
              ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين.'
              : 'New password and confirmation do not match.'
          );
          return;
        }
        const ok = await completePhonePasswordReset(otpCode, newPassword);
        if (ok) {
          pushToast(
            isAr ? 'تم تحديث كلمة المرور وتسجيل الدخول بنجاح' : 'Password updated successfully',
            'success'
          );
          navigateAfterAuth();
        }
      }
    }
  };

  // Pending Email Verification View
  if (!authLoading && firebaseUser && needsEmailVerification) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-7 sm:p-9 shadow-sm space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#F7931E]/20 text-[#8A5A00] flex items-center justify-center">
            <MailCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-[#0B3D2E]">
            {isAr ? 'تأكيد البريد الإلكتروني لتفعيل الحساب' : 'Verify Your Email to Activate Account'}
          </h1>
          <p className="text-sm text-[#4E6359] leading-relaxed">
            {isAr
              ? `أرسلنا رسالة تفعيل إلى ${firebaseUser.email}. لن يتم اعتبار بريدك موثقًا أو تفعيل الحساب قبل فتح رابط التحقق ثم الضغط على زر المتابعة.`
              : `We sent a verification link to ${firebaseUser.email}. Your account remains unverified until you open the link and continue below.`}
          </p>

          {authError && (
            <div
              role="alert"
              className="px-4 py-3 rounded-2xl bg-[#E97858]/12 border border-[#E97858]/35 text-xs text-[#9E3F24] font-semibold"
            >
              {authError}
            </div>
          )}
          {authNotice && (
            <div className="px-4 py-3 rounded-2xl bg-[#0B3D2E]/10 border border-[#0B3D2E]/25 text-xs text-[#0B3D2E] font-semibold">
              {authNotice}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={signingIn}
              onClick={async () => {
                const verified = await refreshEmailVerification();
                if (verified) {
                  pushToast(isAr ? 'تم تفعيل حسابك بنجاح!' : 'Account verified!', 'success');
                  navigateAfterAuth();
                }
              }}
              className="w-full py-3 rounded-2xl bg-[#0B3D2E] text-white font-bold text-sm hover:bg-[#072B20] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {signingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>
                {isAr ? 'تحققت من بريدي — تفعيل ومتابعة' : 'I Verified My Email — Continue'}
              </span>
            </button>

            <button
              type="button"
              disabled={signingIn}
              onClick={() => resendVerificationEmail()}
              className="w-full py-2.5 rounded-2xl border border-[#0B3D2E]/20 text-xs font-bold text-[#0B3D2E] hover:bg-[#FFF7E6] cursor-pointer"
            >
              {isAr ? 'إعادة إرسال رابط التفعيل' : 'Resend Verification Email'}
            </button>

            <button
              type="button"
              onClick={() => signOutUser()}
              className="w-full py-2 text-xs font-semibold text-[#4E6359] hover:underline cursor-pointer"
            >
              {isAr ? 'استخدام حساب آخر' : 'Use a different account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayedError = localError || authError;

  const strengthLabel =
    passwordStrength.score <= 1
      ? isAr
        ? 'ضعيفة'
        : 'Weak'
      : passwordStrength.score === 2
      ? isAr
        ? 'متوسطة'
        : 'Fair'
      : passwordStrength.score === 3
      ? isAr
        ? 'جيدة'
        : 'Good'
      : isAr
      ? 'قوية جداً'
      : 'Strong';

  const strengthColor =
    passwordStrength.score <= 1
      ? 'bg-[#E97858]'
      : passwordStrength.score === 2
      ? 'bg-[#F7931E]'
      : passwordStrength.score === 3
      ? 'bg-[#A7C957]'
      : 'bg-[#0B3D2E]';

  const roleOptions: Array<{
    id: SignupRole;
    labelAr: string;
    labelEn: string;
    subAr: string;
    subEn: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    {
      id: 'student',
      labelAr: 'طالب',
      labelEn: 'Student',
      subAr: 'لطلب الوجبات البيتية',
      subEn: 'Order homemade meals',
      icon: GraduationCap,
    },
    {
      id: 'provider',
      labelAr: 'مطبخ',
      labelEn: 'Kitchen',
      subAr: 'تقديم أكل بيتي للطلاب',
      subEn: 'Cook & sell meals',
      icon: ChefHat,
    },
    {
      id: 'delivery_partner',
      labelAr: 'موصل طلبات',
      labelEn: 'Delivery',
      subAr: 'دخل مرن بالجامعة',
      subEn: 'Deliver orders on campus',
      icon: Bike,
    },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Persistent invisible reCAPTCHA mount for Firebase Phone Auth */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 sm:p-9 shadow-sm space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <LokmaLogo variant="primary" size="sm" />
          <button
            type="button"
            onClick={() => navigateAfterAuth(undefined, true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B3D2E] hover:underline cursor-pointer"
          >
            <BackIcon className="w-3.5 h-3.5" />
            <span>{isAr ? 'رجوع' : 'Back'}</span>
          </button>
        </div>

        {/* Main Mode Tabs (Login / Sign Up) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#FFF7E6] rounded-2xl border border-[#0B3D2E]/10">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-[#0B3D2E] text-white shadow-xs' : 'text-[#4E6359]'
            }`}
          >
            {isAr ? 'تسجيل الدخول' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              mode === 'register' ? 'bg-[#0B3D2E] text-white shadow-xs' : 'text-[#4E6359]'
            }`}
          >
            {isAr ? 'إنشاء حساب جديد' : 'Create Account'}
          </button>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold text-[#0B3D2E]">
            {mode === 'login'
              ? isAr
                ? 'مرحباً بعودتك إلى لقمة'
                : 'Welcome Back to LOKMA'
              : mode === 'register'
              ? isAr
                ? 'أنشئ حسابك في لقمة'
                : 'Create Your LOKMA Account'
              : isAr
              ? 'استعادة كلمة المرور'
              : 'Reset Your Password'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4E6359] leading-relaxed">
            {returnTarget.eventId
              ? isAr
                ? 'سجّل الدخول لتأكيد تسجيلك في الفعالية، وسيتم إرجاعك إليها مباشرة.'
                : 'Sign in to complete your event registration and return directly to the event.'
              : mode === 'register'
              ? isAr
                ? 'اختر دورك وسجّل بالبريد الإلكتروني أو برقم هاتفك المصري (+20) بأمان تام.'
                : 'Choose your role and register securely with email or Egyptian phone (+20).'
              : mode === 'login'
              ? isAr
                ? 'ادخل باستخدام البريد الإلكتروني أو رقم الهاتف (+20) وكلمة المرور.'
                : 'Sign in with your email or Egyptian phone (+20) and password.'
              : isAr
              ? 'اختر استعادة كلمة المرور عبر رابط البريد الإلكتروني أو عبر رمز SMS على هاتفك.'
              : 'Recover your password via email reset link or phone SMS verification.'}
          </p>
        </div>

        {/* Channel Switcher (Email vs Egyptian Phone +20) */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-bold text-[#4E6359]">
            {mode === 'register'
              ? isAr
                ? 'طريقة التسجيل والتحقق'
                : 'Registration Method'
              : mode === 'login'
              ? isAr
                ? 'طريقة تسجيل الدخول'
                : 'Sign In Method'
              : isAr
              ? 'طريقة الاستعادة'
              : 'Recovery Method'}
          </span>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#FFF7E6]/70 rounded-2xl border border-[#0B3D2E]/12">
            <button
              type="button"
              onClick={() => handleChannelSwitch('email')}
              className={`py-2.5 px-3 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                channel === 'email'
                  ? 'bg-white text-[#0B3D2E] border border-[#0B3D2E]/20 shadow-xs'
                  : 'text-[#4E6359] hover:text-[#0B3D2E]'
              }`}
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>{isAr ? 'البريد الإلكتروني' : 'Email Address'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleChannelSwitch('phone')}
              className={`py-2.5 px-3 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                channel === 'phone'
                  ? 'bg-white text-[#0B3D2E] border border-[#0B3D2E]/20 shadow-xs'
                  : 'text-[#4E6359] hover:text-[#0B3D2E]'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>{isAr ? 'رقم الهاتف (+20)' : 'Phone (+20)'}</span>
            </button>
          </div>
        </div>

        {/* Error & Notice Banners */}
        {displayedError && (
          <div
            role="alert"
            className="px-4 py-3 rounded-2xl bg-[#E97858]/12 border border-[#E97858]/35 text-xs sm:text-sm text-[#9E3F24] font-semibold leading-relaxed space-y-2.5"
          >
            <p>{displayedError}</p>
            {unauthorizedDomainHost && !localError && (
              <div className="p-3 rounded-xl bg-white/85 border border-[#E97858]/30 text-[11px] text-[#13221C] space-y-2">
                <p className="font-bold text-[#9E3F24]">
                  {isAr
                    ? `لإصلاح الدخول عبر جوجل أو الهاتف على هذا النطاق، أضفه إلى Authorized domains في مشروع Firebase (${firebaseConfig.projectId}):`
                    : `To enable Google & Phone Auth on this origin, add it to Authorized domains in Firebase project (${firebaseConfig.projectId}):`}
                </p>
                <div className="flex items-center justify-between gap-2 bg-[#FFF7E6] border border-[#0B3D2E]/15 rounded-lg px-2.5 py-1.5" dir="ltr">
                  <code className="text-[11px] font-mono text-[#0B3D2E] truncate">
                    {unauthorizedDomainHost}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(unauthorizedDomainHost);
                      setCopiedDomain(true);
                      setTimeout(() => setCopiedDomain(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0B3D2E] text-white text-[10px] font-bold shrink-0 cursor-pointer"
                  >
                    {copiedDomain ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{isAr ? 'نسخ النطاق' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-[#4E6359]">
                  {isAr
                    ? 'المسار: Firebase Console → Authentication → Settings → Authorized domains → Add domain'
                    : 'Path: Firebase Console → Authentication → Settings → Authorized domains → Add domain'}
                </p>
              </div>
            )}
          </div>
        )}

        {authNotice && (
          <div className="px-4 py-3 rounded-2xl bg-[#0B3D2E]/10 border border-[#0B3D2E]/25 text-xs sm:text-sm text-[#0B3D2E] font-semibold leading-relaxed">
            {authNotice}
          </div>
        )}

        {/* Role Picker (Register Only — Student, Kitchen/Provider, Delivery Partner; Admin NEVER selectable) */}
        {mode === 'register' && !pendingPhoneOtp && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#4E6359]">
                {isAr ? 'نوع الحساب في لقمة *' : 'Account Role *'}
              </label>
              <span className="text-[11px] text-[#4E6359]">
                {isAr ? 'لا يمكن تغييره بعد التسجيل' : 'Locked after registration'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {roleOptions.map((opt) => {
                const Icon = opt.icon;
                const active = role === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRole(opt.id)}
                    className={`p-3 rounded-2xl border text-start transition-all cursor-pointer flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-1.5 ${
                      active
                        ? 'bg-[#0B3D2E] text-white border-[#0B3D2E] shadow-xs'
                        : 'bg-[#FFF7E6]/70 text-[#13221C] border-[#0B3D2E]/15 hover:border-[#0B3D2E]/35'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-xs font-extrabold">
                        {isAr ? opt.labelAr : opt.labelEn}
                      </div>
                      <div
                        className={`text-[10px] leading-tight mt-0.5 ${
                          active ? 'text-[#FFF7E6]/85' : 'text-[#4E6359]'
                        }`}
                      >
                        {isAr ? opt.subAr : opt.subEn}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* OTP Verification Step for Phone Registration / Phone Password Reset */}
          {pendingPhoneOtp ? (
            <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-[#FFF7E6]/75 border border-[#0B3D2E]/15">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#0B3D2E]">
                  <Smartphone className="w-5 h-5" />
                  <span className="text-sm font-extrabold">
                    {isAr ? 'أدخل رمز التحقق (OTP)' : 'Enter Verification Code'}
                  </span>
                </div>
                <span className="text-xs font-bold text-[#4E6359] tabular-nums" dir="ltr">
                  {pendingOtpPhoneDisplay}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E6359] mb-1">
                  {isAr ? 'رمز التحقق المكون من 6 أرقام *' : '6-Digit SMS Code *'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  dir="ltr"
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-white border border-[#0B3D2E]/25 text-center text-lg font-extrabold tracking-[0.35em] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                />
              </div>

              {mode === 'reset' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#4E6359] mb-1">
                      {isAr ? 'كلمة المرور الجديدة *' : 'New Password *'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white border border-[#0B3D2E]/20 text-sm pe-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={isAr ? 'إظهار أو إخفاء كلمة المرور' : 'Toggle password visibility'}
                        className="absolute inset-y-0 end-2 flex items-center px-2 text-[#4E6359] hover:text-[#0B3D2E] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#4E6359] mb-1">
                      {isAr ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
                    </label>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white border border-[#0B3D2E]/20 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={signingIn || otpCode.length !== 6}
                  className="flex-1 py-3 min-h-[44px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] disabled:opacity-60 text-[#13221C] font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {mode === 'reset'
                      ? isAr
                        ? 'تأكيد الرمز وتغيير كلمة المرور'
                        : 'Verify & Update Password'
                      : isAr
                      ? 'تأكيد الرمز وتفعيل الحساب'
                      : 'Verify OTP & Create Account'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelPhoneOtp();
                    setOtpCode('');
                    clearAuthNotice();
                  }}
                  className="px-4 py-2.5 rounded-2xl border border-[#0B3D2E]/20 text-xs font-bold text-[#0B3D2E] hover:bg-white cursor-pointer"
                >
                  {isAr ? 'تعديل الرقم' : 'Change Number'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Full Name (Sign Up) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {isAr ? 'الاسم بالكامل *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={isAr ? 'مثال: أحمد جمال محمد' : 'Your full name'}
                      className="w-full ps-10 pe-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                    />
                  </div>
                </div>
              )}

              {/* Email Field (Email Channel) */}
              {channel === 'email' && (
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {isAr ? 'البريد الإلكتروني *' : 'Email Address *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      maxLength={150}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      dir="ltr"
                      className="w-full ps-10 pe-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                    />
                  </div>
                  {mode === 'register' && emailPreview && !emailPreview.ok && (
                    <p className="text-[11px] font-semibold text-[#9E3F24] mt-1">
                      {isAr ? emailPreview.errorAr : emailPreview.errorEn}
                    </p>
                  )}
                </div>
              )}

              {/* Egyptian Phone (+20) Field (Phone Channel OR optional/recommended in Email Sign Up) */}
              {(channel === 'phone' || mode === 'register') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#4E6359]">
                      {channel === 'phone'
                        ? isAr
                          ? 'رقم الهاتف المصري (+20) *'
                          : 'Egyptian Phone Number (+20) *'
                        : isAr
                        ? 'رقم الهاتف المصري (+20) — اختياري'
                        : 'Egyptian Phone (+20) — optional'}
                    </label>
                    {phonePreview?.ok && (
                      <span
                        className="text-[11px] font-bold text-[#0B3D2E] tabular-nums"
                        dir="ltr"
                      >
                        {phonePreview.e164}
                      </span>
                    )}
                  </div>
                  <div className="flex items-stretch gap-2" dir="ltr">
                    <span className="inline-flex items-center gap-1.5 px-3 rounded-xl bg-[#0B3D2E]/8 border border-[#0B3D2E]/20 text-xs font-extrabold text-[#0B3D2E] shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                      <span>+20</span>
                    </span>
                    <input
                      type="tel"
                      required={channel === 'phone'}
                      maxLength={20}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01012345678"
                      className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                    />
                  </div>
                  {phone.trim() && phonePreview && !phonePreview.ok && (
                    <p className="text-[11px] font-semibold text-[#9E3F24] mt-1">
                      {isAr ? phonePreview.errorAr : phonePreview.errorEn}
                    </p>
                  )}
                </div>
              )}

              {/* Password Field (Login & Register) */}
              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#4E6359]">
                      {isAr ? 'كلمة المرور *' : 'Password *'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('reset')}
                        className="text-[11px] font-bold text-[#0B3D2E] hover:underline cursor-pointer"
                      >
                        {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={mode === 'register' ? 8 : 6}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full ps-10 pe-11 py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={isAr ? 'إظهار أو إخفاء كلمة المرور' : 'Toggle password visibility'}
                      className="absolute inset-y-0 end-2 flex items-center px-2 text-[#4E6359] hover:text-[#0B3D2E] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength bar during registration */}
                  {mode === 'register' && password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#4E6359] font-semibold">
                          {isAr ? 'قوة كلمة المرور:' : 'Password strength:'}
                        </span>
                        <span className="font-extrabold text-[#0B3D2E]">{strengthLabel}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 h-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`rounded-full transition-colors ${
                              passwordStrength.score >= step
                                ? strengthColor
                                : 'bg-[#0B3D2E]/10'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#4E6359]">
                        {isAr
                          ? '8 أحرف على الأقل وتحتوي على حروف وأرقام.'
                          : 'At least 8 characters with letters and numbers.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm Password (Register Only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full ps-10 pe-11 py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      aria-label={
                        isAr ? 'إظهار أو إخفاء تأكيد كلمة المرور' : 'Toggle confirm password visibility'
                      }
                      className="absolute inset-y-0 end-2 flex items-center px-2 text-[#4E6359] hover:text-[#0B3D2E] cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p
                      className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
                        password === confirmPassword ? 'text-[#0B3D2E]' : 'text-[#9E3F24]'
                      }`}
                    >
                      {password === confirmPassword ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'كلمة المرور متطابقة' : 'Passwords match'}</span>
                        </>
                      ) : (
                        <span>
                          {isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Remember Me (Login Only) */}
              {mode === 'login' && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0B3D2E] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-[#13221C]">
                    {isAr
                      ? 'الاحتفاظ بتسجيل الدخول على هذا الجهاز (تذكرني)'
                      : 'Keep me signed in on this device (Remember me)'}
                  </span>
                </label>
              )}

              {/* Terms & Conditions (Register Only) */}
              {mode === 'register' && (
                <div className="p-3 rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/12 space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#0B3D2E] cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-[#13221C] leading-relaxed">
                      {isAr ? 'أوافق على ' : 'I agree to LOKMA '}
                      <button
                        type="button"
                        onClick={() => setTermsModalOpen(true)}
                        className="font-extrabold text-[#0B3D2E] underline hover:text-[#F7931E] cursor-pointer"
                      >
                        {isAr ? 'الشروط والأحكام وسياسة الخصوصية' : 'Terms & Conditions and Privacy Policy'}
                      </button>
                      {isAr
                        ? ' الخاصة بمنصة لقمة.'
                        : '.'}
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={signingIn || authLoading}
                className="w-full py-3 min-h-[46px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] disabled:opacity-60 text-[#13221C] font-extrabold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'reset' && !signingIn && <KeyRound className="w-4 h-4" />}
                <span>
                  {mode === 'login'
                    ? channel === 'email'
                      ? isAr
                        ? 'تسجيل الدخول بالبريد الإلكتروني'
                        : 'Sign In with Email'
                      : isAr
                      ? 'تسجيل الدخول برقم الهاتف'
                      : 'Sign In with Phone'
                    : mode === 'register'
                    ? channel === 'email'
                      ? isAr
                        ? 'إنشاء الحساب وإرسال رابط التفعيل'
                        : 'Create Account & Send Verification'
                      : isAr
                      ? 'إرسال رمز التحقق (OTP) عبر SMS'
                      : 'Send SMS OTP Code'
                    : channel === 'email'
                    ? isAr
                      ? 'إرسال رابط إعادة التعيين'
                      : 'Send Reset Link'
                    : isAr
                    ? 'إرسال رمز استعادة كلمة المرور (OTP)'
                    : 'Send Recovery OTP'}
                </span>
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="w-full min-h-[38px] text-xs font-bold text-[#0B3D2E] hover:underline cursor-pointer"
                >
                  {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </button>
              )}
            </>
          )}
        </form>

        {/* Google Sign-In Divider & Button */}
        {!pendingPhoneOtp && (
          <>
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#0B3D2E]/12" />
              <span className="shrink mx-3 text-[11px] font-bold text-[#4E6359]">
                {isAr ? 'أو' : 'OR'}
              </span>
              <div className="flex-grow border-t border-[#0B3D2E]/12" />
            </div>

            <button
              type="button"
              disabled={signingIn || authLoading}
              onClick={handleGoogleLogin}
              className="w-full py-3.5 px-5 min-h-[46px] rounded-2xl bg-[#0B3D2E] hover:bg-[#072B20] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-sm"
            >
              {signingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isAr ? 'جاري الدخول بحساب جوجل...' : 'Signing in with Google...'}</span>
                </>
              ) : (
                <>
                  <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                  </span>
                  <span>{isAr ? 'الدخول بحساب جوجل' : 'Continue with Google'}</span>
                </>
              )}
            </button>
          </>
        )}

        {/* Security & Provider Notice */}
        <div className="pt-4 border-t border-[#0B3D2E]/10 space-y-2 text-xs text-[#4E6359]">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0B3D2E] shrink-0 mt-0.5" />
            <span>
              {isAr
                ? 'كلمات المرور مشفرة بالكامل عبر Firebase Authentication ولا تُخزّن كنص عادي مطلقاً.'
                : 'Passwords are encrypted and managed securely by Firebase Authentication—never stored in plaintext.'}
            </span>
          </div>
          {channel === 'phone' && (
            <p className="text-[11px] text-[#4E6359]/90 leading-relaxed ps-6">
              {isAr
                ? 'ملاحظة: إرسال رسائل SMS الحقيقية (OTP) يعتمد على تفعيل موفر Phone في Firebase Console (Authentication → Sign-in method → Phone).'
                : 'Note: Live SMS OTP delivery requires the Phone provider enabled in Firebase Console (Authentication → Sign-in method → Phone).'}
            </p>
          )}
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      {termsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#0B3D2E]/15 max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#0B3D2E]">
                <FileText className="w-5 h-5" />
                <h2 className="text-lg font-extrabold">
                  {isAr ? 'الشروط والأحكام وسياسة الخصوصية — لقمة' : 'LOKMA Terms & Privacy Policy'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTermsModalOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="p-2 rounded-xl hover:bg-[#FFF7E6] text-[#4E6359] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-[#13221C] space-y-2.5 leading-relaxed max-h-72 overflow-y-auto pe-1">
              <p>
                {isAr
                  ? '1. يلتزم المستخدم بتقديم بيانات صحيحة وحقيقية عند التسجيل (الاسم، البريد الإلكتروني، ورقم الهاتف المصري).'
                  : '1. Users must provide accurate information (full name, email, and Egyptian phone number) upon registration.'}
              </p>
              <p>
                {isAr
                  ? '2. تُستخدم بيانات الاتصال حصرياً لتوثيق الحساب وتنسيق استلام وتوصيل الطلبات بين الطالب والمطبخ ومندوب التوصيل.'
                  : '2. Contact details are used strictly for account verification and order coordination between students, kitchens, and delivery partners.'}
              </p>
              <p>
                {isAr
                  ? '3. نوع الحساب (طالب / مطبخ / موصل طلبات) يُحدد وقت التسجيل ولا يمكن تعديله ذاتياً، وتخضع حسابات المطابخ وموصلي الطلبات لمراجعة واعتماد الإدارة.'
                  : '3. Account role (Student / Kitchen / Delivery) is fixed upon registration; Kitchen and Delivery accounts require admin verification before going live.'}
              </p>
              <p>
                {isAr
                  ? '4. لا يُسمح بتكرار رقم الهاتف أو البريد الإلكتروني لأكثر من حساب، وتُحفظ بيانات الجلسة بأمان عبر Firebase Authentication.'
                  : '4. Duplicate phone numbers or emails are prohibited, and credentials are secured via Firebase Authentication.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0B3D2E]/10">
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setTermsModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
              >
                {isAr ? 'موافق وإغلاق' : 'Accept & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
