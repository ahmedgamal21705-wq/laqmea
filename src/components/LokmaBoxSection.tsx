import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  HeartHandshake,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Sparkles,
  User,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import lokmaBoxPhoto from '../assets/images/lokma_meal_box_1795519665296.jpg';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';
import {
  LokmaBoxBudgetTier,
  LokmaBoxFoodProblem,
  LokmaBoxMealType,
  LokmaBoxPrepDifficulty,
  LokmaBoxPrepTime,
  LokmaBoxPurchaseFrequency,
  LokmaBoxTimingPreference,
  LokmaBoxTryInterest,
  LokmaBoxWillingnessToBuy,
} from '../types/database';
import {
  BOX_TIMING_OPTIONS,
  BUDGET_TIER_OPTIONS,
  FOOD_PROBLEM_OPTIONS,
  MEAL_TYPE_OPTIONS,
  PREP_DIFFICULTY_OPTIONS,
  PREP_TIME_OPTIONS,
  PURCHASE_FREQUENCY_OPTIONS,
  submitLokmaBoxLead,
  submitLokmaBoxSurvey,
  WANTS_TO_TRY_OPTIONS,
  WILLINGNESS_OPTIONS,
} from '../utils/lokmaBox';

type ModalMode = 'lead' | 'survey' | null;

export const LokmaBoxSection: React.FC = () => {
  const { lang, universities, myStudentProfile, pushToast } = useLokma();
  const { firebaseUser, userDoc } = useFirebaseAuth();

  const [activeModal, setActiveModal] = useState<ModalMode>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // -------------------------------------------------------
  // Lead ("أنا مهتم بالتجربة") State
  // -------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [customUniversity, setCustomUniversity] = useState('');
  const [housingArea, setHousingArea] = useState('');
  const [wantsToTry, setWantsToTry] = useState<LokmaBoxTryInterest>('yes');
  const [leadConsent, setLeadConsent] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState(false);

  // -------------------------------------------------------
  // Survey ("شاركنا رأيك") State
  // -------------------------------------------------------
  const [surveyStep, setSurveyStep] = useState<1 | 2>(1);
  const [dailyPrepDifficulty, setDailyPrepDifficulty] = useState<LokmaBoxPrepDifficulty | ''>('');
  const [biggestFoodProblem, setBiggestFoodProblem] = useState<LokmaBoxFoodProblem | ''>('');
  const [preferredMealTypes, setPreferredMealTypes] = useState<LokmaBoxMealType[]>([]);
  const [preferredPrepTime, setPreferredPrepTime] = useState<LokmaBoxPrepTime | ''>('');
  const [preferredBudgetTier, setPreferredBudgetTier] = useState<LokmaBoxBudgetTier | ''>('');
  const [purchaseFrequency, setPurchaseFrequency] = useState<LokmaBoxPurchaseFrequency | ''>('');
  const [preferredBoxTiming, setPreferredBoxTiming] = useState<LokmaBoxTimingPreference | ''>('');
  const [willingToBuy, setWillingToBuy] = useState<LokmaBoxWillingnessToBuy | ''>('');
  const [suggestions, setSuggestions] = useState('');
  const [surveyUniversity, setSurveyUniversity] = useState('');
  const [surveyConsent, setSurveyConsent] = useState(false);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveySuccess, setSurveySuccess] = useState(false);

  // Pre-fill authenticated student info when available (non-destructive)
  useEffect(() => {
    if (userDoc?.full_name && !fullName) setFullName(userDoc.full_name);
    if (userDoc?.phone && !phone) setPhone(userDoc.phone);
    if (
      userDoc?.email &&
      !email &&
      !userDoc.email.endsWith('@phone.lokma.app') &&
      !userDoc.email.endsWith('@lokma.local')
    ) {
      setEmail(userDoc.email);
    }
    if (myStudentProfile?.university_id && !universityId) {
      setUniversityId(myStudentProfile.university_id);
      const matched = universities.find((u) => u.id === myStudentProfile.university_id);
      if (matched && !surveyUniversity) {
        setSurveyUniversity(lang === 'ar' ? matched.name_ar : matched.name_en);
      }
    }
    if (myStudentProfile?.delivery_location && !housingArea) {
      setHousingArea(myStudentProfile.delivery_location);
    }
  }, [
    userDoc,
    myStudentProfile,
    universities,
    lang,
    fullName,
    phone,
    email,
    universityId,
    housingArea,
    surveyUniversity,
  ]);

  // Escape key closes active modal cleanly
  useEffect(() => {
    if (!activeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal]);

  const openLeadModal = () => {
    setLeadError(null);
    setActiveModal('lead');
  };

  const openSurveyModal = () => {
    setSurveyError(null);
    setSurveyStep(1);
    setActiveModal('survey');
  };

  const resolveUniversityName = (): string => {
    if (universityId === 'other') return customUniversity.trim();
    const found = universities.find((u) => u.id === universityId);
    if (found) return lang === 'ar' ? found.name_ar : found.name_en;
    return customUniversity.trim();
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    setLeadSubmitting(true);

    const resolvedUniName = resolveUniversityName();
    const res = await submitLokmaBoxLead(
      {
        fullName,
        phone,
        email,
        universityId: universityId || null,
        universityName: resolvedUniName,
        housingArea,
        wantsToTry,
        consentAccepted: leadConsent,
      },
      firebaseUser?.uid ?? null
    );

    setLeadSubmitting(false);

    if (!res.ok) {
      setLeadError(lang === 'ar' ? res.errorAr || 'تعذر التسجيل' : res.errorEn || 'Submit failed');
      return;
    }

    setLeadSuccess(true);
    pushToast(
      lang === 'ar'
        ? 'تم تسجيل اهتمامك في LOKMA BOX بنجاح!'
        : 'Your interest in LOKMA BOX has been recorded!'
    );
  };

  const toggleMealType = (value: LokmaBoxMealType) => {
    setPreferredMealTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleAdvanceSurveyStep = () => {
    setSurveyError(null);
    if (!dailyPrepDifficulty) {
      setSurveyError(
        lang === 'ar'
          ? 'يرجى الإجابة على السؤال 1 أولاً.'
          : 'Please answer Question 1 first.'
      );
      return;
    }
    if (!biggestFoodProblem) {
      setSurveyError(
        lang === 'ar'
          ? 'يرجى الإجابة على السؤال 2 أولاً.'
          : 'Please answer Question 2 first.'
      );
      return;
    }
    if (preferredMealTypes.length === 0) {
      setSurveyError(
        lang === 'ar'
          ? 'يرجى اختيار نوع وجبة واحد على الأقل في السؤال 3.'
          : 'Please select at least one meal type in Question 3.'
      );
      return;
    }
    if (!preferredPrepTime) {
      setSurveyError(
        lang === 'ar'
          ? 'يرجى تحديد وقت التحضير المناسب في السؤال 4.'
          : 'Please select preferred prep time in Question 4.'
      );
      return;
    }
    setSurveyStep(2);
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSurveyError(null);
    setSurveySubmitting(true);

    const res = await submitLokmaBoxSurvey(
      {
        dailyPrepDifficulty,
        biggestFoodProblem,
        preferredMealTypes,
        preferredPrepTime,
        preferredBudgetTier,
        purchaseFrequency,
        preferredBoxTiming,
        willingToBuy,
        suggestions,
        universityName: surveyUniversity || resolveUniversityName() || undefined,
        consentAccepted: surveyConsent,
      },
      firebaseUser?.uid ?? null
    );

    setSurveySubmitting(false);

    if (!res.ok) {
      setSurveyError(
        lang === 'ar' ? res.errorAr || 'تعذر إرسال الاستبيان' : res.errorEn || 'Survey failed'
      );
      return;
    }

    setSurveySuccess(true);
    pushToast(
      lang === 'ar'
        ? 'شكراً لمشاركتك! رأيك هيساعدنا نصمّم LOKMA BOX بشكل مثالي للطلاب.'
        : 'Thank you! Your feedback helps us shape LOKMA BOX.'
    );
  };

  const features = [
    {
      icon: Clock,
      ar: 'سريع التحضير',
      en: 'Quick to prepare',
      tone: 'bg-[#F7931E]/18 text-[#0B3D2E]',
    },
    {
      icon: Wallet,
      ar: 'اقتصادي ومناسب للطلاب',
      en: 'Student-budget friendly',
      tone: 'bg-[#A7C957]/28 text-[#0B3D2E]',
    },
    {
      icon: Utensils,
      ar: 'مكونات غذائية مختارة',
      en: 'Curated quality ingredients',
      tone: 'bg-[#0B3D2E]/10 text-[#0B3D2E]',
    },
    {
      icon: Sparkles,
      ar: 'يوفر الوقت والمجهود',
      en: 'Saves daily time & effort',
      tone: 'bg-[#F7931E]/18 text-[#0B3D2E]',
    },
    {
      icon: GraduationCap,
      ar: 'مناسب للطلاب المغتربين',
      en: 'Tailored for dorm & off-campus students',
      tone: 'bg-[#A7C957]/28 text-[#0B3D2E]',
    },
  ];

  return (
    <section id="lokma-box" className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="relative rounded-[32px] sm:rounded-[40px] bg-white border border-[#0B3D2E]/14 p-6 sm:p-10 lg:p-12 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Copy & Features Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Required Launch Status Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F7931E]/16 border border-[#F7931E]/40 text-xs font-black text-[#9A5304]">
              <Package className="w-4 h-4 text-[#F7931E]" />
              <span>COMING SOON – قريباً خلال شهر</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-4xl font-black text-[#0B3D2E] leading-[1.2] text-balance">
                {lang === 'ar'
                  ? 'LOKMA BOX – كل اللي تحتاجه في Box واحد!'
                  : 'LOKMA BOX – Everything You Need in One Box!'}
              </h2>
              <p className="text-sm sm:text-base text-[#4E6359] leading-relaxed max-w-2xl">
                {lang === 'ar'
                  ? 'وقتك ضيق ومش عارف تاكل إيه؟ بنجهزلك حل جديد يخليك تحضر وجبتك بسهولة وسرعة وبسعر يناسب ميزانيتك.'
                  : 'Short on time and unsure what to cook? We are preparing a smart meal-kit box that helps you cook quickly, affordably, and effortlessly on a student budget.'}
              </p>
            </div>

            {/* 5 Core Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.en}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFF7E6]/75 border border-[#0B3D2E]/10"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${feat.tone}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-[#13221C]">
                      {lang === 'ar' ? feat.ar : feat.en}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Two Required Validation CTA Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={openLeadModal}
                className="inline-flex items-center justify-center gap-2 px-7 min-h-[50px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] active:scale-[0.98] text-[#0B3D2E] text-sm sm:text-base font-black transition-all cursor-pointer shadow-xs"
              >
                <HeartHandshake className="w-5 h-5" />
                <span>{lang === 'ar' ? 'أنا مهتم بالتجربة' : "I'm Interested to Try"}</span>
              </button>

              <button
                type="button"
                onClick={openSurveyModal}
                className="inline-flex items-center justify-center gap-2 px-7 min-h-[50px] rounded-2xl bg-[#0B3D2E] hover:bg-[#072B20] active:scale-[0.98] text-[#FFF7E6] text-sm sm:text-base font-bold transition-all cursor-pointer"
              >
                <ClipboardCheck className="w-5 h-5 text-[#A7C957]" />
                <span>{lang === 'ar' ? 'شاركنا رأيك' : 'Share Your Feedback'}</span>
              </button>
            </div>

            <p className="text-[11px] sm:text-xs font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'الخدمة حالياً في مرحلة أبحاث السوق وتصميم الصناديق قبل الإطلاق الرسمي — رأيك واهتمامك يساعدنا نحدد المكونات والباقة الأنسب لك.'
                : 'Currently in pre-launch market validation — no purchase or payment yet. Your feedback shapes the launch boxes.'}
            </p>
          </div>

          {/* Visual Showcase Column (Zero product pricing / zero checkout) */}
          <div className="lg:col-span-5">
            <div className="rounded-[28px] bg-[#0B3D2E] p-4 sm:p-5 text-[#FFF7E6] shadow-lg space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-[#FBF0D9] aspect-[4/3]">
                {!heroImgFailed ? (
                  <img
                    src={lokmaBoxPhoto}
                    alt={
                      lang === 'ar'
                        ? 'نموذج توضيحي لصندوق مكونات LOKMA BOX الجاهز للتحضير السريع للطلاب'
                        : 'Editorial preview of LOKMA BOX pre-portioned cooking kit for university students'
                    }
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#0B3D2E] p-6">
                    <Package className="w-12 h-12 text-[#F7931E]" />
                    <span className="font-black text-base">LOKMA BOX</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-[#FFF7E6] text-[#13221C] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#0B3D2E]">
                    {lang === 'ar' ? 'ماذا نختبر قبل الإطلاق؟' : 'What We Are Validating'}
                  </span>
                  <span className="text-[11px] font-extrabold text-[#C26906]">
                    {lang === 'ar' ? 'إطلاق متوقع خلال شهر' : 'Launching in ~1 month'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-[#0B3D2E]/10">
                    <div className="text-xs font-black text-[#0B3D2E]">
                      {lang === 'ar' ? 'مكونات طازجة' : 'Fresh Kits'}
                    </div>
                    <div className="text-[10px] text-[#4E6359] mt-0.5">
                      {lang === 'ar' ? 'مقاسة وجاهزة' : 'Pre-portioned'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#0B3D2E]/10">
                    <div className="text-xs font-black text-[#0B3D2E]">
                      {lang === 'ar' ? 'تحضير سريع' : 'Fast Cook'}
                    </div>
                    <div className="text-[10px] text-[#4E6359] mt-0.5">
                      {lang === 'ar' ? 'دون هدر وقت' : 'Quick steps'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#0B3D2E]/10">
                    <div className="text-xs font-black text-[#0B3D2E]">
                      {lang === 'ar' ? 'بميزانيتك' : 'Student Fit'}
                    </div>
                    <div className="text-[10px] text-[#4E6359] mt-0.5">
                      {lang === 'ar' ? 'أنت تحددها' : 'You shape it'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          MODAL 1: STUDENT INTEREST LEAD FORM ("أنا مهتم بالتجربة")
         ============================================================ */}
      {activeModal === 'lead' && (
        <div
          className="fixed inset-0 z-50 bg-[#0B3D2E]/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lokma-box-lead-title"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="bg-white rounded-3xl border border-[#0B3D2E]/15 shadow-2xl max-w-lg w-full my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#0B3D2E] text-[#FFF7E6] px-6 py-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold text-[#A7C957]">
                  COMING SOON – LOKMA BOX
                </div>
                <h3 id="lokma-box-lead-title" className="text-lg font-black mt-0.5">
                  {lang === 'ar'
                    ? 'سجّل اهتمامك لتجربة LOKMA BOX'
                    : 'Register Your Interest in LOKMA BOX'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {leadSuccess ? (
              <div className="p-7 text-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[#A7C957]/25 text-[#0B3D2E] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-[#0B3D2E]">
                    {lang === 'ar' ? 'تم تسجيل اهتمامك بنجاح!' : 'You Are on the Early List!'}
                  </h4>
                  <p className="text-sm text-[#4E6359] leading-relaxed">
                    {lang === 'ar'
                      ? 'شكراً لتسجيلك! سنتواصل معك فور إطلاق LOKMA BOX خلال الشهر القادم لإتاحة أولوية التجربة.'
                      : 'Thank you for registering! We will reach out as soon as LOKMA BOX launches next month.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSurveyError(null);
                      setSurveyStep(1);
                      setActiveModal('survey');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] text-xs sm:text-sm font-black cursor-pointer transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>
                      {lang === 'ar' ? 'شاركنا رأيك في الاستبيان أيضاً' : 'Take Quick Feedback Survey'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-5 min-h-[44px] rounded-xl border border-[#0B3D2E]/20 text-xs sm:text-sm font-bold text-[#0B3D2E] hover:bg-[#FFF7E6] cursor-pointer"
                  >
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
                {leadError && (
                  <div className="p-3.5 rounded-2xl bg-[#B43C25]/10 border border-[#B43C25]/25 text-xs font-bold text-[#B43C25] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{leadError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'الاسم بالكامل *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <User
                      className={`w-4 h-4 text-[#4E6359] absolute top-3.5 ${
                        lang === 'ar' ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: أحمد محمد علي' : 'e.g. Ahmed Mohamed'}
                      className={`w-full py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/65 border border-[#0B3D2E]/15 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                        lang === 'ar' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                      {lang === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}
                    </label>
                    <div className="relative">
                      <Phone
                        className={`w-4 h-4 text-[#4E6359] absolute top-3.5 ${
                          lang === 'ar' ? 'right-3.5' : 'left-3.5'
                        }`}
                      />
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        maxLength={20}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+201012345678"
                        className={`w-full py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/65 border border-[#0B3D2E]/15 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                          lang === 'ar' ? 'pr-10 pl-3.5 text-end' : 'pl-10 pr-3.5'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                      {lang === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
                    </label>
                    <div className="relative">
                      <Mail
                        className={`w-4 h-4 text-[#4E6359] absolute top-3.5 ${
                          lang === 'ar' ? 'right-3.5' : 'left-3.5'
                        }`}
                      />
                      <input
                        type="email"
                        dir="ltr"
                        maxLength={150}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className={`w-full py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/65 border border-[#0B3D2E]/15 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                          lang === 'ar' ? 'pr-10 pl-3.5 text-end' : 'pl-10 pr-3.5'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'الجامعة *' : 'University *'}
                  </label>
                  <div className="relative">
                    <GraduationCap
                      className={`w-4 h-4 text-[#4E6359] absolute top-3.5 ${
                        lang === 'ar' ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <select
                      required
                      value={universityId}
                      onChange={(e) => setUniversityId(e.target.value)}
                      className={`w-full py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/65 border border-[#0B3D2E]/15 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                        lang === 'ar' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                      }`}
                    >
                      <option value="">
                        {lang === 'ar' ? 'اختر جامعتك...' : 'Select university...'}
                      </option>
                      {universities.map((u) => (
                        <option key={u.id} value={u.id}>
                          {lang === 'ar' ? u.name_ar : u.name_en}
                        </option>
                      ))}
                      <option value="other">
                        {lang === 'ar' ? 'جامعة أخرى (اكتبها)' : 'Other university'}
                      </option>
                    </select>
                  </div>

                  {universityId === 'other' && (
                    <input
                      type="text"
                      required
                      maxLength={150}
                      value={customUniversity}
                      onChange={(e) => setCustomUniversity(e.target.value)}
                      placeholder={lang === 'ar' ? 'اكتب اسم الجامعة...' : 'Enter university name...'}
                      className="mt-2 w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white border border-[#0B3D2E]/20 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'المنطقة أو مكان السكن *' : 'Area or Housing Location *'}
                  </label>
                  <div className="relative">
                    <MapPin
                      className={`w-4 h-4 text-[#4E6359] absolute top-3.5 ${
                        lang === 'ar' ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={housingArea}
                      onChange={(e) => setHousingArea(e.target.value)}
                      placeholder={
                        lang === 'ar'
                          ? 'مثال: المسلة، السكن الجامعي، حي الجامعة...'
                          : 'e.g. Dorms, Campus district, El-Masalla...'
                      }
                      className={`w-full py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6]/65 border border-[#0B3D2E]/15 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                        lang === 'ar' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-extrabold text-[#13221C] mb-2">
                    {lang === 'ar'
                      ? 'هل ترغب في تجربة LOKMA BOX عند إطلاقه؟ *'
                      : 'Would you like to try LOKMA BOX at launch? *'}
                  </span>
                  <div className="space-y-2">
                    {WANTS_TO_TRY_OPTIONS.map((opt) => {
                      const selected = wantsToTry === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setWantsToTry(opt.value)}
                          className={`w-full text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                              : 'bg-[#FFF7E6]/50 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                          }`}
                        >
                          <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                          {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mandatory Consent Checkbox */}
                <label className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FFF7E6] border border-[#0B3D2E]/15 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leadConsent}
                    onChange={(e) => setLeadConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#0B3D2E] shrink-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[#13221C] leading-relaxed">
                    {lang === 'ar'
                      ? 'أوافق على استخدام بياناتي للتواصل معي بخصوص إطلاق خدمة LOKMA BOX وإشعاري عند توفر التجربة الأولى.'
                      : 'I consent to LOKMA using my contact information to reach out regarding LOKMA BOX launch updates.'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="w-full min-h-[48px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] disabled:opacity-60 text-[#0B3D2E] text-sm font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {leadSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جاري حفظ تسجيلك...' : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <HeartHandshake className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تأكيد التسجيل والاهتمام' : 'Submit Interest'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: STUDENT FEEDBACK SURVEY ("شاركنا رأيك")
         ============================================================ */}
      {activeModal === 'survey' && (
        <div
          className="fixed inset-0 z-50 bg-[#0B3D2E]/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lokma-box-survey-title"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="bg-white rounded-3xl border border-[#0B3D2E]/15 shadow-2xl max-w-2xl w-full my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#0B3D2E] text-[#FFF7E6] px-6 py-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold text-[#A7C957]">
                  {lang === 'ar'
                    ? 'استبيان أبحاث السوق — LOKMA BOX'
                    : 'LOKMA BOX Market Validation Survey'}
                </div>
                <h3 id="lokma-box-survey-title" className="text-lg font-black mt-0.5">
                  {lang === 'ar'
                    ? 'شاركنا رأيك لتصميم LOKMA BOX على مزاجك'
                    : 'Share Your Feedback to Shape LOKMA BOX'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {surveySuccess ? (
              <div className="p-7 text-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[#A7C957]/25 text-[#0B3D2E] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h4 className="text-xl font-black text-[#0B3D2E]">
                    {lang === 'ar'
                      ? 'شكراً لمشاركتك رأيك!'
                      : 'Thank You for Your Feedback!'}
                  </h4>
                  <p className="text-sm text-[#4E6359] leading-relaxed">
                    {lang === 'ar'
                      ? 'إجاباتك وصلت لفريق LOKMA وستساعدنا نجهز صناديق تناسب وقتك وميزانيتك قبل الإطلاق خلال شهر.'
                      : 'Your responses were saved and will directly help us design affordable, practical boxes before launch.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
                  {!leadSuccess && (
                    <button
                      type="button"
                      onClick={() => {
                        setLeadError(null);
                        setActiveModal('lead');
                      }}
                      className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] text-xs sm:text-sm font-black cursor-pointer transition-colors"
                    >
                      <HeartHandshake className="w-4 h-4" />
                      <span>
                        {lang === 'ar'
                          ? 'سجّل رقمك لتصلك أولوية التجربة'
                          : 'Join the Early-Access List'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-5 min-h-[44px] rounded-xl border border-[#0B3D2E]/20 text-xs sm:text-sm font-bold text-[#0B3D2E] hover:bg-[#FFF7E6] cursor-pointer"
                  >
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSurveySubmit}
                className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
              >
                {/* Step Progress Bar */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#0B3D2E]/10">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#0B3D2E] tabular-nums">
                    <span>
                      {lang === 'ar'
                        ? `الخطوة ${surveyStep} من 2`
                        : `Step ${surveyStep} of 2`}
                    </span>
                    <span className="text-[#4E6359] font-bold">
                      ·{' '}
                      {surveyStep === 1
                        ? lang === 'ar'
                          ? 'احتياجاتك اليومية (أسئلة 1 – 4)'
                          : 'Daily Needs (Q1 – Q4)'
                        : lang === 'ar'
                        ? 'الميزانية والاستعداد للشراء (أسئلة 5 – 9)'
                        : 'Budget & Intent (Q5 – Q9)'}
                    </span>
                  </div>
                  <div className="w-24 h-2 rounded-full bg-[#0B3D2E]/10 overflow-hidden shrink-0">
                    <div
                      className={`h-full bg-[#F7931E] transition-all duration-200 ${
                        surveyStep === 1 ? 'w-1/2' : 'w-full'
                      }`}
                    />
                  </div>
                </div>

                {surveyError && (
                  <div className="p-3.5 rounded-2xl bg-[#B43C25]/10 border border-[#B43C25]/25 text-xs font-bold text-[#B43C25] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{surveyError}</span>
                  </div>
                )}

                {surveyStep === 1 ? (
                  <div className="space-y-5">
                    {/* Q1 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '1. هل تواجه صعوبة في تجهيز وجباتك اليومية؟ *'
                          : '1. Do you face difficulty preparing your daily meals? *'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PREP_DIFFICULTY_OPTIONS.map((opt) => {
                          const selected = dailyPrepDifficulty === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setDailyPrepDifficulty(opt.value)}
                              className={`text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q2 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '2. ما أكبر مشكلة تواجهك في توفير الطعام؟ *'
                          : '2. What is your biggest challenge getting food? *'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FOOD_PROBLEM_OPTIONS.map((opt) => {
                          const selected = biggestFoodProblem === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setBiggestFoodProblem(opt.value)}
                              className={`text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q3 (Multi-select) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                          {lang === 'ar'
                            ? '3. ما نوع الوجبات التي تفضل وجودها داخل LOKMA BOX؟ *'
                            : '3. Which meal types do you want inside LOKMA BOX? *'}
                        </label>
                        <span className="text-[11px] font-bold text-[#C26906] shrink-0">
                          {lang === 'ar' ? 'يمكنك اختيار أكثر من نوع' : 'Multi-select'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {MEAL_TYPE_OPTIONS.map((opt) => {
                          const selected = preferredMealTypes.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleMealType(opt.value)}
                              className={`text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#F7931E]/22 text-[#0B3D2E] border-[#F7931E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  selected
                                    ? 'bg-[#0B3D2E] border-[#0B3D2E] text-white'
                                    : 'border-[#0B3D2E]/30 bg-white'
                                }`}
                              >
                                {selected && <Check className="w-3 h-3" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q4 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '4. ما الوقت المناسب لتحضير الوجبة؟ *'
                          : '4. What is your ideal meal prep time? *'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PREP_TIME_OPTIONS.map((opt) => {
                          const selected = preferredPrepTime === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPreferredPrepTime(opt.value)}
                              className={`text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAdvanceSurveyStep}
                      className="w-full min-h-[48px] rounded-2xl bg-[#0B3D2E] hover:bg-[#072B20] text-[#FFF7E6] text-sm font-black transition-colors cursor-pointer"
                    >
                      {lang === 'ar'
                        ? 'التالي: الميزانية والتوقيت ←'
                        : 'Next: Budget & Timing →'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Q5 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '5. ما الميزانية المناسبة لك؟ *'
                          : '5. What budget range suits you best? *'}
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {BUDGET_TIER_OPTIONS.map((opt) => {
                          const selected = preferredBudgetTier === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPreferredBudgetTier(opt.value)}
                              className={`text-start px-3.5 py-3 min-h-[46px] rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q6 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '6. كم مرة تتوقع شراء الصندوق؟ *'
                          : '6. How often would you buy LOKMA BOX? *'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PURCHASE_FREQUENCY_OPTIONS.map((opt) => {
                          const selected = purchaseFrequency === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPurchaseFrequency(opt.value)}
                              className={`text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q7 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '7. هل تفضل Box للإفطار أم الغداء أم العشاء أم Box متنوع؟ *'
                          : '7. Do you prefer Breakfast, Lunch, Dinner, or Mixed Box? *'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {BOX_TIMING_OPTIONS.map((opt) => {
                          const selected = preferredBoxTiming === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPreferredBoxTiming(opt.value)}
                              className={`text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q8 */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-black text-[#0B3D2E]">
                        {lang === 'ar'
                          ? '8. هل ستشتري المنتج فعلياً إذا كان متاحاً بالسعر المناسب؟ *'
                          : '8. Would you actually buy it if priced right? *'}
                      </label>
                      <div className="space-y-2">
                        {WILLINGNESS_OPTIONS.map((opt) => {
                          const selected = willingToBuy === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setWillingToBuy(opt.value)}
                              className={`w-full text-start px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-[#0B3D2E] text-[#FFF7E6] border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6]/55 text-[#13221C] border-[#0B3D2E]/12 hover:border-[#F7931E]'
                              }`}
                            >
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                              {selected && <Check className="w-4 h-4 text-[#A7C957] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q9 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#0B3D2E]">
                        <MessageSquareText className="w-4 h-4 text-[#F7931E]" />
                        <span>
                          {lang === 'ar'
                            ? '9. ما اقتراحاتك لتطوير المنتج؟ (اختياري)'
                            : '9. What suggestions do you have to improve LOKMA BOX? (Optional)'}
                        </span>
                      </label>
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={suggestions}
                        onChange={(e) => setSuggestions(e.target.value)}
                        placeholder={
                          lang === 'ar'
                            ? 'مثال: إضافة وصفات سريعة بالفيديو، عبوات تكفي فرد أو فردين، توابل جاهزة...'
                            : 'Share ingredients, portion sizes, packaging, or delivery ideas...'
                        }
                        className="w-full p-3.5 rounded-xl bg-[#FFF7E6]/65 border border-[#0B3D2E]/15 text-sm text-[#13221C] focus:outline-none focus:border-[#F7931E]"
                      />
                    </div>

                    {/* Optional University Field */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#4E6359] mb-1.5">
                        <Home className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'ar'
                            ? 'الجامعة (اختياري لمساعدتنا في تحديد أولوية التغطية)'
                            : 'University (Optional, helps prioritize coverage)'}
                        </span>
                      </label>
                      <input
                        type="text"
                        maxLength={150}
                        value={surveyUniversity}
                        onChange={(e) => setSurveyUniversity(e.target.value)}
                        placeholder={lang === 'ar' ? 'مثال: جامعة الفيوم' : 'e.g. Fayoum University'}
                        className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl bg-[#FFF7E6]/50 border border-[#0B3D2E]/12 text-xs text-[#13221C] focus:outline-none focus:border-[#F7931E]"
                      />
                    </div>

                    {/* Research Consent */}
                    <label className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FFF7E6] border border-[#0B3D2E]/15 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={surveyConsent}
                        onChange={(e) => setSurveyConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#0B3D2E] shrink-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#13221C] leading-relaxed">
                        {lang === 'ar'
                          ? 'أوافق على استخدام إجاباتي ضمن أبحاث سوق LOKMA BOX لتطوير المنتج قبل إطلاقه.'
                          : 'I consent to sharing these survey answers for LOKMA BOX pre-launch product research.'}
                      </span>
                    </label>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSurveyError(null);
                          setSurveyStep(1);
                        }}
                        className="sm:w-1/3 min-h-[48px] rounded-2xl border border-[#0B3D2E]/20 text-xs sm:text-sm font-bold text-[#0B3D2E] hover:bg-[#FFF7E6] cursor-pointer"
                      >
                        {lang === 'ar' ? '→ السابق' : '← Back'}
                      </button>
                      <button
                        type="submit"
                        disabled={surveySubmitting}
                        className="sm:w-2/3 min-h-[48px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] disabled:opacity-60 text-[#0B3D2E] text-sm font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        {surveySubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{lang === 'ar' ? 'جاري إرسال رأيك...' : 'Submitting...'}</span>
                          </>
                        ) : (
                          <>
                            <ClipboardCheck className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'إرسال الاستبيان' : 'Submit Feedback'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
