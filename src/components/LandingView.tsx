import React, { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock,
  Compass,
  GraduationCap,
  MapPin,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';
import heroMealPhoto from '../assets/images/hero_egyptian_homemade_table_1795442171477.jpg';
import homemadePackagingPhoto from '../assets/images/homemade_packaging_prep_1795442588513.jpg';
import mealKitPhoto from '../assets/images/ready_to_cook_meal_kit_1795442171755.jpg';
import kitchenCookingPhoto from '../assets/images/shared_kitchen_cooking_1795442172702.jpg';
import studentsSharingPhoto from '../assets/images/students_sharing_homemade_meal_1795442172430.jpg';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';
import { getPerMealBudget, getProviderRatingStats } from '../utils/recommendation';
import { LokmaBoxSection } from './LokmaBoxSection';
import { LokmaLogo } from './LokmaLogo';
import { MealArtwork } from './MealArtwork';
import { StudentLaunchOptions, StudentTab } from './StudentPortal';

interface LandingViewProps {
  onOpenStudentTab?: (target: StudentTab | StudentLaunchOptions) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onOpenStudentTab }) => {
  const {
    lang,
    setView,
    meals,
    mealCategories,
    providerProfiles,
    universities,
    myStudentProfile,
    orders,
    reviews,
    deliveryPricingConfig,
    dataLoading,
  } = useLokma();
  const { firebaseUser, isAdmin, setReturnTarget } = useFirebaseAuth();
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  const verifiedProviderIds = useMemo(
    () =>
      new Set(
        providerProfiles
          .filter((p) => p.verification_status === 'verified' && p.is_accepting_orders)
          .map((p) => p.user_id)
      ),
    [providerProfiles]
  );

  const availableMeals = useMemo(
    () =>
      meals.filter(
        (m) =>
          m.is_available &&
          m.deleted_at === null &&
          verifiedProviderIds.has(m.provider_id)
      ),
    [meals, verifiedProviderIds]
  );

  const featuredMeals = useMemo(() => {
    // Prioritize affordable student-friendly dishes first while remaining strictly real catalog items
    return [...availableMeals]
      .sort((a, b) => a.price - b.price)
      .slice(0, 6);
  }, [availableMeals]);

  const affordableMealsCount = useMemo(
    () => availableMeals.filter((m) => m.price <= 75).length,
    [availableMeals]
  );

  const heroMeal = featuredMeals[0] ?? null;
  const heroProvider = heroMeal
    ? providerProfiles.find((p) => p.user_id === heroMeal.provider_id)
    : null;

  const activeUniversity = useMemo(() => {
    if (myStudentProfile?.university_id) {
      return universities.find((u) => u.id === myStudentProfile.university_id) ?? null;
    }
    return universities[0] ?? null;
  }, [myStudentProfile?.university_id, universities]);

  const studentSpendingSummary = useMemo(() => {
    if (!firebaseUser) return null;
    const validOrders = orders.filter(
      (o) =>
        o.student_id === firebaseUser.uid &&
        o.status !== 'cancelled' &&
        o.status !== 'rejected'
    );
    const totalSpent = validOrders.reduce((acc, o) => acc + o.total_amount, 0);
    const dailyBudget = myStudentProfile?.daily_budget ?? 0;
    const weeklyBudget = myStudentProfile?.weekly_budget ?? 0;
    const monthlyBudget = dailyBudget * 30;
    const remainingMonthly = Math.max(0, monthlyBudget - totalSpent);
    const perMeal = getPerMealBudget(dailyBudget, weeklyBudget);
    return {
      totalSpent,
      orderCount: validOrders.length,
      dailyBudget,
      monthlyBudget,
      remainingMonthly,
      perMeal,
    };
  }, [firebaseUser, orders, myStudentProfile]);

  const navigatePortal = (
    target: 'student' | 'provider' | 'delivery' | 'admin' | 'events' | 'onboarding'
  ) => {
    window.history.pushState({}, '', `/${target}`);
    setView(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openStudentTab = (target: StudentTab | StudentLaunchOptions) => {
    if (onOpenStudentTab) {
      onOpenStudentTab(target);
      return;
    }
    navigatePortal('student');
  };

  const goToSignIn = (dest: 'student' | 'provider' | 'delivery') => {
    setReturnTarget({ view: dest, eventId: null });
    window.history.pushState({}, '', '/login');
    setView('auth');
  };

  const brandValues = [
    {
      icon: ShieldCheck,
      tone: 'green',
      titleAr: 'أمان وجودة',
      titleEn: 'Safety & Quality',
      descAr: 'مطابخ منزلية موثقة بمكونات واضحة وتنبيهات حساسية دقيقة.',
      descEn: 'Verified home kitchens with clear ingredients and allergy safeguards.',
    },
    {
      icon: Zap,
      tone: 'orange',
      titleAr: 'سرعة في التوصيل',
      titleEn: 'Fast Campus Delivery',
      descAr: 'توضيح وقت التحضير مسبقاً مع توصيل طلابي مرن أو استلام قريب.',
      descEn: 'Upfront prep times paired with flexible campus delivery or pickup.',
    },
    {
      icon: UtensilsCrossed,
      tone: 'fresh',
      titleAr: 'تنوع في الخيارات',
      titleEn: 'Diverse Homemade Menu',
      descAr: 'وجبات بيتي جاهزة وباقات تحضير سريع تناسب جدول يومك الجامعي.',
      descEn: 'Ready home-cooked dishes and quick-prep kits for busy lecture days.',
    },
    {
      icon: GraduationCap,
      tone: 'orange',
      titleAr: 'مناسب للطلاب',
      titleEn: 'Student Budget-First',
      descAr: 'فلترة فورية حسب حد الوجبة ومتابعة مصروفك اليومي والأسبوعي.',
      descEn: 'Filter dishes by per-meal budget and track real monthly spending.',
    },
  ];

  const steps = [
    {
      num: '01',
      icon: Wallet,
      tone: 'green',
      titleAr: 'حدّد ميزانيتك وحساسياتك',
      titleEn: 'Set Budget & Preferences',
      descAr:
        'سجّل ميزانيتك اليومية والأسبوعية وأي حساسيات غذائية مرة واحدة في ملفك الطلابي.',
      descEn:
        'Configure your daily or weekly food budget and allergen exclusions once in your profile.',
    },
    {
      num: '02',
      icon: Sparkles,
      tone: 'orange',
      titleAr: 'اكتشف وجبات تناسب جيبك',
      titleEn: 'Discover Matched Meals',
      descAr:
        'تصفّح الأكل البيتي الحقيقي وباقات التحضير السريع المرتبطة مباشرةً بحد الوجبة المناسب لك.',
      descEn:
        'Browse real homemade meals and ready-to-cook dishes matched to your per-meal limit.',
    },
    {
      num: '03',
      icon: Bike,
      tone: 'fresh',
      titleAr: 'اطلب استلام أو توصيل طلابي',
      titleEn: 'Pickup or Student Delivery',
      descAr:
        'اختر الاستلام المجاني من المطبخ القريب أو التوصيل عبر زميل طالب بالدراجة أو مشياً.',
      descEn:
        'Choose free nearby kitchen pickup or campus delivery by fellow university students.',
    },
    {
      num: '04',
      icon: CheckCircle2,
      tone: 'green',
      titleAr: 'تابع طلبك وراقب إنفاقك',
      titleEn: 'Track Orders & Spending',
      descAr:
        'تابع حالة التحضير خطوة بخطوة وراقب ما أنفقته وما تبقى من ميزانيتك في مكان واحد.',
      descEn:
        'Follow live kitchen preparation status and track actual spending against your budget.',
    },
  ];

  return (
    <div className="space-y-14 sm:space-y-20 pb-16">
      {/* A. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8">
        <div className="relative rounded-[32px] sm:rounded-[40px] bg-white border border-[#0B3D2E]/12 p-6 sm:p-10 lg:p-12 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Hero Brand Copy & CTAs */}
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#0B3D2E]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F7931E]" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'أكل بيتك .. في أي مكان · الفيوم، مصر'
                    : 'Homemade Food Anywhere · Fayoum, Egypt'}
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl lg:text-[3.45rem] font-black leading-[1.15] text-[#0B3D2E] text-balance">
                  {lang === 'ar' ? (
                    <>
                      <span className="text-[#F7931E]">لقمة..</span> أكلك في أي مكان
                    </>
                  ) : (
                    <>
                      <span className="text-[#F7931E]">LOKMA..</span> Home Food Anywhere
                    </>
                  )}
                </h1>
                <p className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E] leading-snug">
                  {lang === 'ar'
                    ? 'حلّك الذكي لكل مشاكل الأكل وأنت مغترب!'
                    : 'Your smart solution for student meals away from home!'}
                </p>
              </div>

              <p className="text-sm sm:text-base text-[#4E6359] leading-relaxed max-w-xl">
                {lang === 'ar'
                  ? 'نربط طلاب الجامعة بمطابخ بيتي موثقة، تخطيط ذكي لميزانيتك، وتوصيل طلابي مرن يوفر وقتك بين المحاضرات.'
                  : 'Connecting university students with verified home kitchens, smart budget planning, and flexible campus delivery.'}
              </p>

              {/* Signature Orange Brush Accent */}
              <svg
                viewBox="0 0 220 14"
                fill="none"
                className="w-40 h-3"
                aria-hidden="true"
              >
                <path
                  d="M4 9C66 2 146 2 216 9"
                  stroke="#F7931E"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => openStudentTab('discover')}
                  className="inline-flex items-center justify-center gap-2 px-7 min-h-[50px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] active:scale-[0.98] text-[#0B3D2E] text-sm sm:text-base font-black transition-all cursor-pointer shadow-sm"
                >
                  <span>{lang === 'ar' ? 'اكتشف الوجبات' : 'Explore Meals'}</span>
                  <ArrowIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openStudentTab('profile')}
                  className="inline-flex items-center justify-center gap-2 px-6 min-h-[50px] rounded-2xl bg-[#0B3D2E] hover:bg-[#072B20] active:scale-[0.98] text-[#FFF7E6] text-sm sm:text-base font-bold transition-all cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-[#A7C957]" />
                  <span>{lang === 'ar' ? 'نظّم ميزانيتك' : 'Plan Your Budget'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm font-bold text-[#0B3D2E]/80">
                <button
                  type="button"
                  onClick={() => navigatePortal('onboarding')}
                  className="hover:text-[#F7931E] transition-colors cursor-pointer py-1"
                >
                  {lang === 'ar' ? 'جولة تعريفية سريعة' : 'Quick Platform Guide'}
                </button>
                <span aria-hidden="true" className="text-[#0B3D2E]/25">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => navigatePortal('events')}
                  className="inline-flex items-center gap-1.5 hover:text-[#F7931E] transition-colors cursor-pointer py-1"
                >
                  <CalendarDays className="w-4 h-4 text-[#F7931E]" />
                  <span>{lang === 'ar' ? 'الفعاليات والورش الطلابية' : 'Campus Events & Workshops'}</span>
                </button>
              </div>
            </div>

            {/* Hero Visual Showcase: Authentic Food Photo + Live App Discovery Card */}
            <div className="lg:col-span-6">
              <div className="rounded-[28px] bg-[#0B3D2E] p-4 sm:p-5 text-[#FFF7E6] shadow-xl space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-[#FBF0D9] aspect-[16/10]">
                  <img
                    src={heroMealPhoto}
                    alt={
                      lang === 'ar'
                        ? 'مائدة أكل بيتي مصري دافئة مجهزة لطلاب الجامعة'
                        : 'Warm Egyptian homemade food bowls prepared for university students'
                    }
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Live Interactive Discovery Strip (100% Real Data) */}
                <div className="bg-[#FFF7E6] text-[#13221C] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#0B3D2E] min-w-0">
                      <MapPin className="w-4 h-4 text-[#F7931E] shrink-0" />
                      <span className="truncate">
                        {activeUniversity
                          ? lang === 'ar'
                            ? activeUniversity.name_ar
                            : activeUniversity.name_en
                          : lang === 'ar'
                          ? 'اختر جامعتك أو منطقتك'
                          : 'Select your university or area'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openStudentTab('profile')}
                      className="text-[11px] font-extrabold text-[#0B3D2E] hover:text-[#F7931E] shrink-0 cursor-pointer"
                    >
                      {lang === 'ar' ? 'تحديد ←' : 'Set →'}
                    </button>
                  </div>

                  {heroMeal ? (
                    <button
                      type="button"
                      onClick={() =>
                        openStudentTab({ tab: 'discover', mealId: heroMeal.id })
                      }
                      className="w-full rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] p-3.5 flex items-center justify-between gap-4 text-start transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold opacity-85">
                          {lang === 'ar' ? 'وجبة متاحة الآن على لقمة' : 'Available Now on LOKMA'}
                        </div>
                        <div className="font-black text-sm sm:text-base truncate">
                          {lang === 'ar' ? heroMeal.name_ar || heroMeal.name : heroMeal.name}
                        </div>
                        <div className="text-xs font-bold opacity-85 truncate">
                          {heroProvider?.business_name || heroMeal.provider_name} ·{' '}
                          {heroMeal.prep_time_minutes} {lang === 'ar' ? 'دقيقة' : 'min'}
                        </div>
                      </div>
                      <div className="text-end shrink-0 tabular-nums">
                        <div className="text-lg font-black">
                          {heroMeal.price} {lang === 'ar' ? 'ج.م' : 'EGP'}
                        </div>
                        <div className="text-[11px] font-bold">
                          {lang === 'ar'
                            ? `توصيل ${deliveryPricingConfig.customer_delivery_fee} ج.م`
                            : `Delivery ${deliveryPricingConfig.customer_delivery_fee} EGP`}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-xl bg-[#FBF0D9] border border-[#0B3D2E]/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-[#0B3D2E]">
                          {dataLoading
                            ? lang === 'ar'
                              ? 'جاري الاتصال بالمطابخ الحية...'
                              : 'Connecting to live kitchens...'
                            : lang === 'ar'
                            ? 'وجبات لذيذة بأسعار مناسبة · مطابخ موثقة'
                            : 'Verified Home Kitchens · Fair Student Pricing'}
                        </div>
                        <p className="text-[11px] text-[#4E6359] mt-0.5 tabular-nums">
                          {lang === 'ar'
                            ? `التوصيل الطلابي: ${deliveryPricingConfig.customer_delivery_fee} ج.م أو استلام مجاني`
                            : `Campus delivery: ${deliveryPricingConfig.customer_delivery_fee} EGP or free pickup`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          firebaseUser ? navigatePortal('provider') : goToSignIn('provider')
                        }
                        className="px-3.5 min-h-[38px] rounded-xl bg-[#0B3D2E] text-[#FFF7E6] text-xs font-bold hover:bg-[#072B20] transition-colors shrink-0 cursor-pointer"
                      >
                        {lang === 'ar' ? 'سجّل مطبخك البيتي' : 'Register Kitchen'}
                      </button>
                    </div>
                  )}

                  {/* Quick App Category Entry Points */}
                  <div className="grid grid-cols-4 gap-2 pt-0.5">
                    {[
                      {
                        icon: UtensilsCrossed,
                        ar: 'أكل منزلي',
                        en: 'Home Food',
                        action: () => openStudentTab('discover'),
                      },
                      {
                        icon: Wallet,
                        ar: 'الميزانية',
                        en: 'Budget',
                        action: () => openStudentTab('profile'),
                      },
                      {
                        icon: Bike,
                        ar: 'التوصيل',
                        en: 'Delivery',
                        action: () => navigatePortal('delivery'),
                      },
                      {
                        icon: Compass,
                        ar: 'الفعاليات',
                        en: 'Events',
                        action: () => navigatePortal('events'),
                      },
                    ].map((tile) => {
                      const TileIcon = tile.icon;
                      return (
                        <button
                          key={tile.en}
                          type="button"
                          onClick={tile.action}
                          className="p-2.5 rounded-xl bg-white border border-[#0B3D2E]/10 hover:border-[#F7931E] flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                        >
                          <TileIcon className="w-4 h-4 text-[#0B3D2E]" />
                          <span className="text-[11px] font-bold text-[#13221C] leading-tight">
                            {lang === 'ar' ? tile.ar : tile.en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* B. OUR VALUE STRIP (DIRECTLY FROM BRAND IDENTITY BOARD) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
          <div>
            <div className="text-xs font-extrabold text-[#C26906]">
              {lang === 'ar' ? 'قيمنا الأساسية' : 'Our Value'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B3D2E]">
              {lang === 'ar' ? 'لماذا يثق الطلاب في لقمة؟' : 'Why Students Choose LOKMA'}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {brandValues.map((val) => {
            const ValIcon = val.icon;
            const iconStyle =
              val.tone === 'orange'
                ? 'bg-[#F7931E]/18 text-[#0B3D2E]'
                : val.tone === 'fresh'
                ? 'bg-[#A7C957]/28 text-[#0B3D2E]'
                : 'bg-[#0B3D2E]/10 text-[#0B3D2E]';
            return (
              <div
                key={val.titleEn}
                className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-3 shadow-xs hover:-translate-y-0.5 transition-transform duration-200"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconStyle}`}>
                  <ValIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                  {lang === 'ar' ? val.titleAr : val.titleEn}
                </h3>
                <p className="text-xs sm:text-sm text-[#4E6359] leading-relaxed">
                  {lang === 'ar' ? val.descAr : val.descEn}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* C. BRAND PROMISE, OUR MISSION & ABOUT LOKMA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Signature Brand Statement Card */}
          <div className="lg:col-span-5 bg-[#0B3D2E] text-[#FFF7E6] rounded-[32px] p-7 sm:p-9 flex flex-col justify-between gap-6 shadow-md">
            <div className="space-y-4">
              <LokmaLogo variant="secondary" size="sm" inverted />
              <div className="space-y-2 pt-2">
                <h2 className="text-2xl sm:text-3xl font-black leading-snug">
                  {lang === 'ar' ? (
                    <>
                      <span className="text-[#F7931E]">لقمة...</span> مش مجرد أكل، دي{' '}
                      <span className="text-[#F7931E]">راحة واطمئنان.</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#F7931E]">LOKMA...</span> More than food, it is{' '}
                      <span className="text-[#F7931E]">comfort & peace of mind.</span>
                    </>
                  )}
                </h2>
                <svg viewBox="0 0 180 12" fill="none" className="w-36 h-2.5" aria-hidden="true">
                  <path
                    d="M3 8C54 2 118 2 177 8"
                    stroke="#F7931E"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <div className="pt-4 border-t border-white/12 flex items-center justify-between text-xs font-bold text-[#A7C957]">
              <span>{lang === 'ar' ? 'أكل بيتك .. في أي مكان' : 'Eat Smart. Live Better.'}</span>
              <span>Fayoum · Egypt</span>
            </div>
          </div>

          {/* Our Mission + About Lokma Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-[32px] border border-[#0B3D2E]/12 p-7 flex flex-col justify-between gap-5 shadow-xs">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#A7C957]/25 text-[#0B3D2E] flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-[#C26906] mb-1">
                    {lang === 'ar' ? 'رسالتنا' : 'Our Mission'}
                  </div>
                  <h3 className="text-xl font-black text-[#0B3D2E]">
                    {lang === 'ar' ? 'Our Mission · رسالتنا' : 'Our Mission'}
                  </h3>
                </div>
                <p className="text-sm text-[#4E6359] leading-relaxed">
                  {lang === 'ar'
                    ? 'توفير تجربة طعام سهلة، موثوقة ومريحة للطلاب المغتربين، في أي مكان.'
                    : 'Delivering a simple, trustworthy, and comforting food experience for university students living away from home, anywhere.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openStudentTab('discover')}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0B3D2E] hover:text-[#F7931E] transition-colors cursor-pointer self-start"
              >
                <span>{lang === 'ar' ? 'استكشف الوجبات' : 'Browse Meals'}</span>
                <ArrowIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white rounded-[32px] border border-[#0B3D2E]/12 p-7 flex flex-col justify-between gap-5 shadow-xs">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F7931E]/18 text-[#0B3D2E] flex items-center justify-center">
                  <Rocket className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-[#C26906] mb-1">
                    {lang === 'ar' ? 'عن المنصة' : 'About Lokma'}
                  </div>
                  <h3 className="text-xl font-black text-[#0B3D2E]">
                    {lang === 'ar' ? 'About Lokma · عن لقمة' : 'About Lokma'}
                  </h3>
                </div>
                <p className="text-sm text-[#4E6359] leading-relaxed">
                  {lang === 'ar'
                    ? 'منصة ذكية تربط الطلاب بأشهى الأطعمة المنزلية وخيارات متنوعة، لحياة جامعية أفضل.'
                    : 'A smart food-tech platform connecting students with clean home-cooked meals and diverse choices for a better campus life.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigatePortal('onboarding')}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0B3D2E] hover:text-[#F7931E] transition-colors cursor-pointer self-start"
              >
                <span>{lang === 'ar' ? 'تعرّف على المنظومة' : 'Explore Platform Guide'}</span>
                <ArrowIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* D. EXPLORE AVAILABLE MEALS (REAL FIRESTORE DATA ONLY) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
          <div>
            <div className="text-xs font-extrabold text-[#C26906] mb-1">
              {lang === 'ar' ? 'مباشرةً من المطابخ الموثقة' : 'Live From Verified Kitchens'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B3D2E]">
              {lang === 'ar' ? 'استكشف الوجبات المتاحة' : 'Explore Available Meals'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {affordableMealsCount > 0 && (
              <button
                type="button"
                onClick={() => openStudentTab({ tab: 'discover', maxPrice: 75 })}
                className="inline-flex items-center gap-1.5 px-4 min-h-[42px] rounded-xl bg-[#A7C957]/25 border border-[#0B3D2E]/15 text-xs font-extrabold text-[#0B3D2E] hover:bg-[#A7C957]/40 transition-colors cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? `وجبات اقتصادية (≤ 75 ج.م · ${affordableMealsCount})`
                    : `Budget Picks (≤ 75 EGP · ${affordableMealsCount})`}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openStudentTab('discover')}
              className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl bg-white border border-[#0B3D2E]/20 text-xs sm:text-sm font-bold text-[#0B3D2E] hover:bg-[#0B3D2E] hover:text-[#FFF7E6] transition-colors cursor-pointer"
            >
              <span>{lang === 'ar' ? 'عرض كل الوجبات والفلاتر' : 'Browse All Meals & Filters'}</span>
              <ArrowIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Category Chips */}
        {mealCategories.filter((c) => c.is_active).length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
            {mealCategories
              .filter((c) => c.is_active)
              .map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => openStudentTab({ tab: 'discover', categoryId: cat.id })}
                  className="px-4 min-h-[38px] rounded-xl bg-white border border-[#0B3D2E]/12 hover:border-[#F7931E] hover:bg-[#FFF7E6] text-xs font-bold text-[#0B3D2E] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? cat.name_ar : cat.name_en}
                </button>
              ))}
          </div>
        )}

        {featuredMeals.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF7E6] border border-[#0B3D2E]/12 flex items-center justify-center mx-auto text-[#0B3D2E]">
              <UtensilsCrossed className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <p className="text-lg font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'لا توجد وجبات متاحة حاليًا.' : 'No meals available right now.'}
              </p>
              <p className="text-xs sm:text-sm text-[#4E6359] leading-relaxed">
                {lang === 'ar'
                  ? 'تعتمد لقمة على وجبات حقيقية يضيفها مقدمو الطعام البيتي الموثقون فقط. عند إضافة وجبات جديدة ستظهر هنا مباشرة.'
                  : 'LOKMA displays real meals added by verified local home cooks only. Published dishes appear here immediately.'}
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  firebaseUser ? navigatePortal('provider') : goToSignIn('provider')
                }
                className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] text-xs sm:text-sm font-extrabold transition-colors cursor-pointer"
              >
                <ChefHat className="w-4 h-4" />
                <span>{lang === 'ar' ? 'انضم كمقدم طعام وأضف وجبة' : 'Join as Provider & Add Meals'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredMeals.map((meal) => {
              const prov = providerProfiles.find((p) => p.user_id === meal.provider_id);
              const category = mealCategories.find((c) => c.id === meal.category_id);
              const stats = getProviderRatingStats(meal.provider_id, reviews);

              return (
                <article
                  key={meal.id}
                  className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200 shadow-xs"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => openStudentTab({ tab: 'discover', mealId: meal.id })}
                      className="w-full text-start cursor-pointer block"
                    >
                      <MealArtwork
                        slug={meal.image_url}
                        alt={lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                        lang={lang}
                        className="w-full h-48"
                      />
                    </button>

                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#4E6359]">
                        <span className="truncate font-bold text-[#0B3D2E]">
                          {category
                            ? lang === 'ar'
                              ? category.name_ar
                              : category.name_en
                            : prov?.business_name || meal.provider_name}
                        </span>
                        {stats.review_count > 0 ? (
                          <span className="inline-flex items-center gap-1 tabular-nums font-bold text-[#13221C] shrink-0">
                            <Star className="w-3.5 h-3.5 fill-[#F7931E] text-[#F7931E]" />
                            {stats.avg_rating} ({stats.review_count})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[#4E6359] shrink-0">
                            {lang === 'ar' ? 'جديد' : 'New'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openStudentTab({ tab: 'discover', mealId: meal.id })}
                        className="text-start cursor-pointer"
                      >
                        <h3 className="font-extrabold text-lg text-[#13221C] hover:text-[#0B3D2E] transition-colors">
                          {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                        </h3>
                      </button>

                      <p className="text-xs text-[#4E6359]">
                        {prov?.business_name || meal.provider_name}
                      </p>

                      {meal.description && (
                        <p className="text-xs sm:text-sm text-[#13221C]/75 line-clamp-2 leading-relaxed">
                          {meal.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#4E6359] pt-1 tabular-nums">
                        <span className="inline-flex items-center gap-1 text-[#0B3D2E] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#A7C957]" />
                          {lang === 'ar' ? 'متاحة الآن' : 'Available'}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {meal.prep_time_minutes} {lang === 'ar' ? 'د' : 'min'}
                        </span>
                        {meal.portion_description && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[140px]">
                              {meal.portion_description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 bg-[#FFF7E6]/85 border-t border-[#0B3D2E]/10 flex items-center justify-between gap-3">
                    <div className="tabular-nums">
                      <span className="text-xl font-black text-[#0B3D2E]">
                        {meal.price}
                      </span>{' '}
                      <span className="text-xs font-bold text-[#0B3D2E]">
                        {lang === 'ar' ? 'ج.م' : 'EGP'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openStudentTab({ tab: 'discover', mealId: meal.id })}
                      className="px-4 min-h-[40px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      {lang === 'ar' ? 'اطلب الآن' : 'Order Now'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* D2. LOKMA BOX — MARKET VALIDATION (COMING SOON) */}
      <LokmaBoxSection />

      {/* E. HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-8 space-y-2">
          <div className="text-xs font-extrabold text-[#C26906]">
            {lang === 'ar' ? 'تجربة بسيطة وواضحة' : 'Simple & Clear Flow'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B3D2E]">
            {lang === 'ar' ? 'كيف تعمل لقمة؟' : 'How LOKMA Works'}
          </h2>
          <p className="text-sm sm:text-base text-[#4E6359] leading-relaxed">
            {lang === 'ar'
              ? 'أربع خطوات عملية تساعدك تأكل أكل بيتي نضيف وتتحكم في مصروفك اليومي بدون تعقيد.'
              : 'Four straightforward steps to enjoy clean homemade food and stay in control of your daily budget.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step) => {
            const StepIcon = step.icon;
            const iconBg =
              step.tone === 'orange'
                ? 'bg-[#F7931E]/18 text-[#0B3D2E]'
                : step.tone === 'fresh'
                ? 'bg-[#A7C957]/28 text-[#0B3D2E]'
                : 'bg-[#0B3D2E]/10 text-[#0B3D2E]';
            return (
              <div
                key={step.num}
                className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 flex flex-col justify-between gap-5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg}`}
                  >
                    <StepIcon className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-[#0B3D2E]/18 tabular-nums">
                    {step.num}
                  </span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#13221C]">
                    {lang === 'ar' ? step.titleAr : step.titleEn}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#4E6359] mt-2 leading-relaxed">
                    {lang === 'ar' ? step.descAr : step.descEn}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* F. SMART RECOMMENDATIONS & READY-TO-COOK EXPERIENCE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-[32px] border border-[#0B3D2E]/12 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="rounded-3xl overflow-hidden bg-[#FBF0D9] border border-[#0B3D2E]/10 aspect-[4/3] col-span-2">
              <img
                src={mealKitPhoto}
                alt={
                  lang === 'ar'
                    ? 'صندوق وجبات جاهزة للتحضير السريع بمكونات طازجة'
                    : 'Ready-to-cook meal kit box with fresh pre-portioned ingredients'
                }
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#FBF0D9] border border-[#0B3D2E]/10 aspect-[4/3]">
              <img
                src={kitchenCookingPhoto}
                alt={
                  lang === 'ar'
                    ? 'طالب جامعي يحضّر وجبة بيتي صحية في مطبخ السكن'
                    : 'University student preparing a fresh homemade dish in shared kitchen'
                }
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#FBF0D9] border border-[#0B3D2E]/10 aspect-[4/3]">
              <img
                src={homemadePackagingPhoto}
                alt={
                  lang === 'ar'
                    ? 'تحضير وتغليف وجبات بيتي طازجة في عبوات صحية جاهزة للتوصيل الطلابي'
                    : 'Freshly prepared homemade Egyptian meals packed cleanly for campus delivery'
                }
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5">
            <div className="text-xs font-extrabold text-[#C26906]">
              {lang === 'ar'
                ? 'ترشيحات شخصية + باقات سريعة التحضير'
                : 'Smart Picks & Ready-to-Cook Kits'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B3D2E] leading-snug">
              {lang === 'ar'
                ? 'ترشيحات مصممة ليومك الدراسي وميزانيتك'
                : 'Recommendations Tailored to Your Schedule & Wallet'}
            </h2>
            <p className="text-sm sm:text-base text-[#4E6359] leading-relaxed">
              {lang === 'ar'
                ? 'سواء كنت بتدور على وجبة بيتي جاهزة بين المحاضرات أو باقة تحضير سريع في السكن المشترك، محرك لقمة بيرتب لك الخيارات الحقيقية المتاحة بناءً على ميزانية الوجبة وتقييمات الطلاب وتفضيلاتك.'
                : 'Whether you need a ready homemade meal between lectures or a quick-prep meal kit in shared housing, LOKMA ranks real available dishes using your meal budget, kitchen ratings, and dietary filters.'}
            </p>

            <ul className="space-y-2.5 text-sm text-[#13221C]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0B3D2E] shrink-0 mt-1" />
                <span>
                  {lang === 'ar'
                    ? 'إخفاء تلقائي للوجبات اللي بتحتوي على مكونات تسبب لك حساسية'
                    : 'Hard exclusion for meals containing your registered food allergens'}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0B3D2E] shrink-0 mt-1" />
                <span>
                  {lang === 'ar'
                    ? 'توضيح سبب ترشيح كل وجبة ومقارنة سعرها مع حد ميزانيتك'
                    : 'Clear explanation for why each meal fits your per-meal spending limit'}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0B3D2E] shrink-0 mt-1" />
                <span>
                  {lang === 'ar'
                    ? 'تفاعل مباشر (أعجبني / غير مناسب) لتحسين ترتيب الترشيحات لك'
                    : 'Instant like/dislike controls to refine your personal meal ranking'}
                </span>
              </li>
            </ul>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => openStudentTab('discover')}
                className="inline-flex items-center gap-2 px-6 min-h-[46px] rounded-2xl bg-[#0B3D2E] hover:bg-[#072B20] text-[#FFF7E6] text-sm font-bold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#F7931E]" />
                <span>{lang === 'ar' ? 'شاهد ترشيحاتك الآن' : 'View Your Recommendations'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* G. BUDGET PLANNER SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-[32px] p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-md">
          <div className="lg:col-span-6 space-y-5">
            <div className="text-xs font-extrabold text-[#A7C957]">
              {lang === 'ar' ? 'مخطط ميزانية الطالب' : 'Student Food Budget Planner'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black leading-snug">
              {lang === 'ar'
                ? 'اضبط ميزانيتك وشوف المتبقي أول بأول'
                : 'Plan Your Food Budget and Track Every Pound'}
            </h2>
            <p className="text-sm sm:text-base text-[#FFF7E6]/85 leading-relaxed">
              {lang === 'ar'
                ? 'وداعاً للمصروف العشوائي في آخر الشهر. حدد مصروفك اليومي أو الأسبوعي للأكل، ولقمة هتحسب لك تلقائياً إجمالي إنفاقك من طلباتك الفعلية، المتبقي من ميزانيتك، والوجبات المتاحة في حدودك.'
                : 'No more end-of-month surprises. Set your daily or weekly meal limit and LOKMA automatically calculates your real order spending, remaining balance, and affordable options.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => openStudentTab('profile')}
                className="inline-flex items-center gap-2 px-6 min-h-[46px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] text-sm font-black transition-colors cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>{lang === 'ar' ? 'نظّم ميزانيتك الآن' : 'Configure Your Budget'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#FFF7E6] text-[#13221C] rounded-3xl p-6 sm:p-7 space-y-5 shadow-md">
            <div className="flex items-center justify-between border-b border-[#0B3D2E]/10 pb-4">
              <div>
                <div className="text-xs font-bold text-[#4E6359]">
                  {lang === 'ar' ? 'لوحة متابعة الميزانية' : 'Budget Companion Panel'}
                </div>
                <div className="text-lg font-black text-[#0B3D2E] mt-0.5">
                  {studentSpendingSummary
                    ? lang === 'ar'
                      ? 'ملخص حسابك الفعلي'
                      : 'Your Live Account Summary'
                    : lang === 'ar'
                    ? 'إمكانيات مخطط الميزانية'
                    : 'What Your Planner Tracks'}
                </div>
              </div>
              <Wallet className="w-7 h-7 text-[#F7931E]" />
            </div>

            {studentSpendingSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 tabular-nums">
                  <div className="p-4 rounded-2xl bg-white border border-[#0B3D2E]/10">
                    <div className="text-xs text-[#4E6359]">
                      {lang === 'ar' ? 'المصروف الفعلي' : 'Actual Spent'}
                    </div>
                    <div className="text-xl font-black text-[#0B3D2E] mt-1">
                      {studentSpendingSummary.totalSpent} {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-[#0B3D2E]/10">
                    <div className="text-xs text-[#4E6359]">
                      {lang === 'ar' ? 'المتبقي الشهري' : 'Monthly Remaining'}
                    </div>
                    <div className="text-xl font-black text-[#C26906] mt-1">
                      {studentSpendingSummary.monthlyBudget > 0
                        ? `${studentSpendingSummary.remainingMonthly} ${lang === 'ar' ? 'ج.م' : 'EGP'}`
                        : lang === 'ar'
                        ? 'لم يُحدد بعد'
                        : 'Not set yet'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[#4E6359] tabular-nums">
                  {studentSpendingSummary.perMeal > 0
                    ? lang === 'ar'
                      ? `حد الوجبة المحسوب: ${studentSpendingSummary.perMeal} ج.م · إجمالي الطلبات المسجلة: ${studentSpendingSummary.orderCount}`
                      : `Per-meal limit: ${studentSpendingSummary.perMeal} EGP · Recorded orders: ${studentSpendingSummary.orderCount}`
                    : lang === 'ar'
                    ? 'أدخل ميزانيتك اليومية في ملفك الشخصي لتفعيل حساب المتبقي وحد الوجبة تلقائياً.'
                    : 'Enter your daily budget in your profile to activate automatic remaining-budget tracking.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  {
                    ar: 'تحديد حد يومي وأسبوعي',
                    en: 'Daily & Weekly Limits',
                    subAr: 'يحسب حد الوجبة الواحدة تلقائياً',
                    subEn: 'Auto-calculates per-meal budget',
                  },
                  {
                    ar: 'متابعة الإنفاق الحقيقي',
                    en: 'Real Order Tracking',
                    subAr: 'يجمع قيمة طلباتك الفعلية فقط',
                    subEn: 'Sums only your actual placed orders',
                  },
                  {
                    ar: 'معرفة المتبقي من الميزانية',
                    en: 'Remaining Balance',
                    subAr: 'تنبيه واضح عند الاقتراب من الحد',
                    subEn: 'Visual progress bar against limit',
                  },
                  {
                    ar: 'فلترة الوجبات المناسبة',
                    en: 'Filter Affordable Meals',
                    subAr: 'عرض الوجبات داخل نطاق ميزانيتك',
                    subEn: 'Show dishes inside your meal limit',
                  },
                ].map((item) => (
                  <div
                    key={item.en}
                    className="p-3.5 rounded-2xl bg-white border border-[#0B3D2E]/10 space-y-1"
                  >
                    <div className="font-extrabold text-[#0B3D2E]">
                      {lang === 'ar' ? item.ar : item.en}
                    </div>
                    <div className="text-[#4E6359] leading-relaxed">
                      {lang === 'ar' ? item.subAr : item.subEn}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* H. STUDENT COMMUNITY & ECOSYSTEM PORTALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="bg-white rounded-[32px] border border-[#0B3D2E]/12 p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-3xl overflow-hidden border border-[#0B3D2E]/12 bg-[#FBF0D9] aspect-[4/3]">
              <img
                src={studentsSharingPhoto}
                alt={
                  lang === 'ar'
                    ? 'طلاب جامعيون يتشاركون وجبات بيتي دافئة معاً'
                    : 'University students sharing warm homemade meals together'
                }
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="text-xs font-extrabold text-[#C26906]">
              {lang === 'ar' ? 'رفيقك اليومي في الغربة' : 'Your Daily Campus Companion'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B3D2E]">
              {lang === 'ar'
                ? 'جاهز تستمتع بأكل بيتي على قد ميزانيتك؟'
                : 'Ready for Homemade Food Within Your Budget?'}
            </h2>
            <p className="text-sm sm:text-base text-[#4E6359] leading-relaxed">
              {lang === 'ar'
                ? 'ابدأ الآن كطالب، أو انضم كمقدم طعام بيتي أو شريك توصيل جامعي في الفيوم.'
                : 'Start browsing meals now, or join LOKMA as a local home cook or student delivery partner.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openStudentTab('discover')}
                className="inline-flex items-center justify-center gap-2 px-6 min-h-[46px] rounded-2xl bg-[#F7931E] hover:bg-[#E08112] text-[#0B3D2E] text-sm font-black transition-colors cursor-pointer"
              >
                <span>{lang === 'ar' ? 'اكتشف الوجبات' : 'Explore Meals'}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => openStudentTab('profile')}
                className="inline-flex items-center justify-center gap-2 px-6 min-h-[46px] rounded-2xl bg-[#0B3D2E] hover:bg-[#072B20] text-[#FFF7E6] text-sm font-bold transition-colors cursor-pointer"
              >
                <span>{lang === 'ar' ? 'نظّم ميزانيتك' : 'Plan Budget'}</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl sm:text-2xl font-black text-[#0B3D2E] mb-4">
            {lang === 'ar' ? 'بوابات منظومة لقمة' : 'LOKMA Ecosystem Portals'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <button
              type="button"
              onClick={() => navigatePortal('student')}
              className="text-start bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 hover:-translate-y-0.5 transition-transform cursor-pointer flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#0B3D2E]/10 text-[#0B3D2E] flex items-center justify-center mb-4">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-[#13221C]">
                  {lang === 'ar' ? 'بوابة الطالب (العميل)' : 'Student Customer'}
                </h4>
                <p className="text-xs sm:text-sm text-[#4E6359] mt-2 leading-relaxed">
                  {lang === 'ar'
                    ? 'استكشف الوجبات البيتي الحقيقية، اضبط ميزانيتك وحساسياتك، وتابع طلباتك مباشرة.'
                    : 'Discover real homemade meals matched to your budget and dietary needs with live order tracking.'}
                </p>
              </div>
              <div className="mt-5 text-xs font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'فتح بوابة الطالب ←' : 'Open Student Portal →'}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                firebaseUser ? navigatePortal('provider') : goToSignIn('provider')
              }
              className="text-start bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 hover:-translate-y-0.5 transition-transform cursor-pointer flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#F7931E]/20 text-[#0B3D2E] flex items-center justify-center mb-4">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-[#13221C]">
                  {lang === 'ar' ? 'بوابة مقدم الطعام البيتي' : 'Food Provider Portal'}
                </h4>
                <p className="text-xs sm:text-sm text-[#4E6359] mt-2 leading-relaxed">
                  {lang === 'ar'
                    ? 'أنشئ ملف مطبخك، أضف وجباتك وصورها الحقيقية، وأدر الطلبات الواردة.'
                    : 'Create your kitchen profile, publish homemade meals with real pricing, and fulfill orders.'}
                </p>
              </div>
              <div className="mt-5 text-xs font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'فتح بوابة المطبخ ←' : 'Open Provider Portal →'}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                firebaseUser ? navigatePortal('delivery') : goToSignIn('delivery')
              }
              className="text-start bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 hover:-translate-y-0.5 transition-transform cursor-pointer flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#0B3D2E] text-[#F7931E] flex items-center justify-center mb-4">
                  <Bike className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-[#13221C]">
                  {lang === 'ar' ? 'بوابة طالب التوصيل' : 'Student Delivery Partner'}
                </h4>
                <p className="text-xs sm:text-sm text-[#4E6359] mt-2 leading-relaxed">
                  {lang === 'ar'
                    ? 'تقدّم بطلب توثيق بالكارنيه الجامعي لاستلام عروض التوصيل مشياً أو بالدراجة.'
                    : 'Apply with your university ID to claim campus delivery offers and track real earnings.'}
                </p>
              </div>
              <div className="mt-5 text-xs font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'فتح بوابة التوصيل ←' : 'Open Delivery Portal →'}
              </div>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigatePortal('admin')}
                className="text-start bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 hover:-translate-y-0.5 transition-transform cursor-pointer flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-[#A7C957]/28 text-[#0B3D2E] flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-extrabold text-[#13221C]">
                    {lang === 'ar' ? 'لوحة الإدارة' : 'Admin Console'}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#4E6359] mt-2 leading-relaxed">
                    {lang === 'ar'
                      ? 'إدارة الفعاليات والتسجيلات ومتابعة منظومة لقمة بصلاحيات المشرف.'
                      : 'Manage campus events, registrations, and workspace operations with admin access.'}
                  </p>
                </div>
                <div className="mt-5 text-xs font-extrabold text-[#0B3D2E]">
                  {lang === 'ar' ? 'دخول الإدارة ←' : 'Open Admin Console →'}
                </div>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
