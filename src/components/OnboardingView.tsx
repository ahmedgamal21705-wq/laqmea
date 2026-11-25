import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Bike, ChefHat, GraduationCap } from 'lucide-react';
import heroMealPhoto from '../assets/images/hero_egyptian_homemade_table_1795442171477.jpg';
import kitchenCookingPhoto from '../assets/images/shared_kitchen_cooking_1795442172702.jpg';
import studentsSharingPhoto from '../assets/images/students_sharing_homemade_meal_1795442172430.jpg';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';

export const OnboardingView: React.FC = () => {
  const { lang, setView, deliveryPricingConfig } = useLokma();
  const { setReturnTarget } = useFirebaseAuth();
  const [step, setStep] = useState(0);
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  const goToLogin = () => {
    setReturnTarget({ view: 'student', eventId: null });
    window.history.pushState({}, '', '/login');
    setView('auth');
  };

  const slides = [
    {
      titleAr: 'أكل بيتي صحي على قد ميزانيتك',
      titleEn: 'Healthy Homemade Meals Within Your Budget',
      descAr:
        'سجّل ميزانيتك اليومية أو الأسبوعية وحساسياتك الغذائية، وسيقوم محرك لقمة بترشيح الوجبات المناسبة لك من مقدمي الطعام الموثقين.',
      descEn:
        'Set your daily food budget and allergies so LOKMA prioritizes affordable, home-cooked meals tailored to your university life.',
      badgeAr: 'للطلاب المغتربين في الفيوم',
      badgeEn: 'For University Students',
      icon: GraduationCap,
      image: heroMealPhoto,
      imageAltAr: 'وجبة بيتي مصرية دافئة على طاولة خشبية',
      imageAltEn: 'Warm Egyptian homemade meal on a wooden table',
    },
    {
      titleAr: 'مطابخ منزلية موثقة بجوار الجامعة',
      titleEn: 'Verified Local Home Kitchens Around Campus',
      descAr:
        'يتقدم مقدمو الطعام المنزلي بطلب التوثيق وإضافة وجباتهم الحقيقية مع وضوح السعر والمكونات والقيم الغذائية.',
      descEn:
        'Local cooks register their kitchens, submit verification details, and publish real homemade dishes with transparent ingredients.',
      badgeAr: 'لمقدمي الطعام المنزلي',
      badgeEn: 'For Home Food Providers',
      icon: ChefHat,
      image: kitchenCookingPhoto,
      imageAltAr: 'تحضير وجبة منزلية طازجة في مطبخ دافئ',
      imageAltEn: 'Preparing a fresh homemade meal in a sunlit kitchen',
    },
    {
      titleAr: 'توصيل طلابي مرن — مشياً أو بالدراجة',
      titleEn: 'Flexible Student Delivery — Walking or Bicycle',
      descAr: `يمكن لأي طالب جامعي الانضمام كشريك توصيل بنفس حسابه وكسب ${deliveryPricingConfig.partner_earning} ج.م عن كل طلب يوصله بين المحاضرات.`,
      descEn: `Verified students can earn ${deliveryPricingConfig.partner_earning} EGP per delivery using the same account by delivering orders on foot or by bicycle.`,
      badgeAr: 'لشركاء التوصيل من الطلبة',
      badgeEn: 'For Student Delivery Partners',
      icon: Bike,
      image: studentsSharingPhoto,
      imageAltAr: 'طلاب جامعيون يتشاركون وجبة بيتي معاً',
      imageAltEn: 'University students sharing homemade meals together',
    },
  ];

  const active = slides[step];
  const Icon = active.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="bg-white rounded-[32px] border border-[#0B3D2E]/12 p-5 sm:p-10 space-y-7 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  step === idx ? 'w-10 bg-[#0B3D2E]' : 'w-3 bg-[#0B3D2E]/20'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goToLogin}
            className="min-h-[40px] px-3 text-xs font-bold text-[#4E6359] hover:text-[#0B3D2E] cursor-pointer"
          >
            {lang === 'ar' ? 'تخطي' : 'Skip'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-6 relative rounded-3xl overflow-hidden bg-[#FBF0D9] border border-[#0B3D2E]/12 aspect-[4/3]">
            <img
              src={active.image}
              alt={lang === 'ar' ? active.imageAltAr : active.imageAltEn}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B3D2E]/80 via-[#0B3D2E]/15 to-transparent" />
            <div className="absolute bottom-4 inset-x-4 flex items-center gap-2.5 text-[#FFF7E6]">
              <div className="w-10 h-10 rounded-xl bg-[#F7931E] text-[#13221C] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold">
                {lang === 'ar' ? active.badgeAr : active.badgeEn}
              </span>
            </div>
          </div>
          <div className="md:col-span-6 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D2E] leading-snug">
              {lang === 'ar' ? active.titleAr : active.titleEn}
            </h2>
            <p className="text-sm sm:text-base text-[#4E6359] leading-relaxed">
              {lang === 'ar' ? active.descAr : active.descEn}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#0B3D2E]/10">
          <span className="text-xs font-bold text-[#4E6359] tabular-nums">
            {step + 1} / {slides.length}
          </span>

          {step < slides.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#0B3D2E] hover:bg-[#072B20] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
              <ArrowIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={goToLogin}
              className="px-6 min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#13221C] text-xs sm:text-sm font-extrabold transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'تسجيل الدخول والبدء' : 'Sign In & Get Started'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
