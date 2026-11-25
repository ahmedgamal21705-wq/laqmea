import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bike,
  Footprints,
  LogIn,
  MailCheck,
  MapPin,
  Navigation,
  PackageCheck,
  Power,
  Star,
} from 'lucide-react';
import studentsSharingPhoto from '../assets/images/students_sharing_homemade_meal_1795442172430.jpg';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';
import { DeliveryMethod } from '../types/database';
import { getOrderStatusBadge } from './admin/AdminOrderDetails';

type PartnerTab = 'requests' | 'active' | 'earnings' | 'settings';
const PARTNER_PAGE_SIZE = 8;

export const DeliveryPartnerPortal: React.FC = () => {
  const {
    lang,
    universities,
    providerProfiles,
    myDeliveryPartnerProfile,
    deliveryOffers,
    orders,
    deliveryTransactions,
    deliveryPricingConfig,
    reviews,
    applyAsDeliveryPartner,
    toggleDeliveryPartnerOnline,
    updateDeliveryPartnerMethod,
    acceptDeliveryRequest,
    updateDeliveryStep,
    setView,
    pushToast,
  } = useLokma();

  const {
    firebaseUser,
    userDoc,
    isAdmin,
    needsEmailVerification,
    setReturnTarget,
    resendVerificationEmail,
    refreshEmailVerification,
    signingIn,
  } = useFirebaseAuth();

  const [tab, setTab] = useState<PartnerTab>('requests');
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  // Application form state
  const [appUniversityId, setAppUniversityId] = useState('');
  const [appMethod, setAppMethod] = useState<DeliveryMethod>('walking');
  const [appNationalId, setAppNationalId] = useState('');
  const [appStudentCard, setAppStudentCard] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appSchedule, setAppSchedule] = useState('');

  // Settings edit state
  const [editMethod, setEditMethod] = useState<DeliveryMethod>('bicycle');
  const [editSchedule, setEditSchedule] = useState('');

  useEffect(() => {
    if (userDoc?.phone && !appPhone) {
      setAppPhone(userDoc.phone);
    }
  }, [userDoc?.phone, appPhone]);

  useEffect(() => {
    if (universities.length > 0 && !appUniversityId) {
      setAppUniversityId(universities[0].id);
    }
  }, [universities, appUniversityId]);

  useEffect(() => {
    if (myDeliveryPartnerProfile) {
      setEditMethod(myDeliveryPartnerProfile.delivery_method);
      setEditSchedule(myDeliveryPartnerProfile.availability_schedule);
    }
  }, [myDeliveryPartnerProfile]);

  const navigateToLogin = () => {
    setReturnTarget({ view: 'delivery' });
    window.history.pushState({}, '', '/login?redirect=delivery');
    setView('auth');
  };

  const pricing = deliveryPricingConfig;

  const deliveryMethodLabel = (method: DeliveryMethod | string) => {
    if (method === 'bicycle') {
      return lang === 'ar' ? 'دراجة هوائية' : 'Bicycle';
    }
    return lang === 'ar' ? 'مشي على الأقدام' : 'Walking';
  };

  const txStatusLabel = (status: string) => {
    if (status === 'settled') {
      return lang === 'ar' ? 'تمت التسوية' : 'Settled';
    }
    return lang === 'ar' ? 'مسجلة' : 'Recorded';
  };

  const availableOffers = useMemo(() => {
    const partnerUniId = myDeliveryPartnerProfile?.university_id || '';
    return deliveryOffers
      .filter((offer) => offer.status === 'open' && !skippedIds.includes(offer.order_id))
      .map((offer) => {
        const prov = providerProfiles.find((p) => p.user_id === offer.provider_id);
        const matchesCampus = Boolean(partnerUniId && prov?.university_id === partnerUniId);
        return { offer, matchesCampus };
      })
      .sort((a, b) => Number(b.matchesCampus) - Number(a.matchesCampus));
  }, [deliveryOffers, skippedIds, providerProfiles, myDeliveryPartnerProfile?.university_id]);

  const myActiveDeliveries = useMemo(() => {
    if (!firebaseUser) return [];
    return orders.filter(
      (o) =>
        o.delivery_partner_id === firebaseUser.uid &&
        ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)
    );
  }, [orders, firebaseUser]);

  const myCompletedDeliveries = useMemo(() => {
    if (!firebaseUser) return [];
    return orders
      .filter((o) => o.delivery_partner_id === firebaseUser.uid && o.status === 'delivered')
      .sort(
        (a, b) =>
          Date.parse(b.updated_at || b.created_at) -
          Date.parse(a.updated_at || a.created_at)
      );
  }, [orders, firebaseUser]);

  const totalCompletedPages = Math.max(
    1,
    Math.ceil(myCompletedDeliveries.length / PARTNER_PAGE_SIZE)
  );
  const paginatedCompleted = useMemo(() => {
    const safePage = Math.min(completedPage, totalCompletedPages);
    const start = (safePage - 1) * PARTNER_PAGE_SIZE;
    return myCompletedDeliveries.slice(start, start + PARTNER_PAGE_SIZE);
  }, [myCompletedDeliveries, completedPage, totalCompletedPages]);

  const myTransactions = useMemo(() => {
    if (!firebaseUser) return [];
    return deliveryTransactions
      .filter((t) => t.delivery_partner_id === firebaseUser.uid)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [deliveryTransactions, firebaseUser]);

  const totalTxPages = Math.max(1, Math.ceil(myTransactions.length / PARTNER_PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const safePage = Math.min(txPage, totalTxPages);
    const start = (safePage - 1) * PARTNER_PAGE_SIZE;
    return myTransactions.slice(start, start + PARTNER_PAGE_SIZE);
  }, [myTransactions, txPage, totalTxPages]);

  const earningsStats = useMemo(() => {
    const total = myTransactions.reduce((s, t) => s + t.partner_earning, 0);
    const nowMs = Date.now();
    const oneDayMs = 86400000;
    const daily = myTransactions
      .filter((t) => nowMs - Date.parse(t.created_at) <= oneDayMs)
      .reduce((s, t) => s + t.partner_earning, 0);
    const weekly = myTransactions
      .filter((t) => nowMs - Date.parse(t.created_at) <= 7 * oneDayMs)
      .reduce((s, t) => s + t.partner_earning, 0);
    const completed = myTransactions.length;
    const avg = completed > 0 ? Number((total / completed).toFixed(1)) : 0;
    return { total, daily, weekly, completed, avg };
  }, [myTransactions]);

  const partnerReviews = useMemo(() => {
    if (!firebaseUser) return [];
    return reviews.filter(
      (r) => r.delivery_partner_id === firebaseUser.uid && r.delivery_rating !== null
    );
  }, [reviews, firebaseUser]);

  const deliveryRatingSummary = useMemo(() => {
    if (partnerReviews.length === 0) return { avg: 0, count: 0 };
    const sum = partnerReviews.reduce((acc, r) => acc + (r.delivery_rating || 0), 0);
    return {
      avg: Number((sum / partnerReviews.length).toFixed(1)),
      count: partnerReviews.length,
    };
  }, [partnerReviews]);

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 bg-[#FBF0D9] min-h-[200px]">
            <img
              src={studentsSharingPhoto}
              alt={
                lang === 'ar'
                  ? 'طلاب جامعيون يتشاركون وجبات بيتي دافئة'
                  : 'University students sharing homemade meals'
              }
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="md:col-span-7 p-7 sm:p-8 flex flex-col justify-center space-y-4 text-start">
            <div className="w-12 h-12 rounded-2xl bg-[#0B3D2E]/10 text-[#0B3D2E] flex items-center justify-center">
              <Bike className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'بوابة شركاء التوصيل الطلابي' : 'Student Delivery Partner Portal'}
            </h1>
            <p className="text-sm text-[#4E6359] leading-relaxed">
              {lang === 'ar'
                ? 'سجّل الدخول بحسابك للتقديم كشريك توصيل طلابي، متابعة حالة التوثيق، واستقبال طلبات التوصيل المتاحة.'
                : 'Sign in with your account to apply as a student delivery partner and accept delivery requests.'}
            </p>
            <div>
              <button
                type="button"
                onClick={navigateToLogin}
                className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#0B3D2E] hover:bg-[#072B20] text-white text-sm font-bold transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل الدخول / إنشاء حساب' : 'Sign In / Create Account'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needsEmailVerification) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-[#F7931E] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F7931E]/20 text-[#8A5A00] flex items-center justify-center mx-auto">
            <MailCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'يرجى تأكيد البريد الإلكتروني أولاً' : 'Email Verification Required'}
          </h2>
          <p className="text-xs text-[#4E6359] leading-relaxed">
            {lang === 'ar'
              ? `أرسلنا رابط التفعيل إلى ${firebaseUser.email}. فعّل بريدك ثم اضغط على زر التحقق للمتابعة.`
              : `Please verify ${firebaseUser.email} via the link sent to your inbox before accessing partner features.`}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void refreshEmailVerification()}
              className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {lang === 'ar' ? 'تحققت من بريدي — متابعة' : 'I Verified — Continue'}
            </button>
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void resendVerificationEmail()}
              className="px-5 py-2.5 rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/20 text-[#0B3D2E] text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {lang === 'ar' ? 'إعادة إرسال رابط التفعيل' : 'Resend Link'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const partnerName =
    myDeliveryPartnerProfile?.full_name ||
    userDoc?.full_name ||
    firebaseUser.displayName ||
    firebaseUser.email ||
    '';

  const handleApplicationSubmit = async () => {
    if (!/^[0-9]{4}$/.test(appNationalId.trim())) {
      pushToast(
        lang === 'ar'
          ? 'يرجى إدخال آخر ٤ أرقام صحيحة من البطاقة القومية'
          : 'Please enter the last 4 digits of your National ID',
        'error'
      );
      return;
    }
    if (appStudentCard.trim().length < 2) {
      pushToast(
        lang === 'ar' ? 'يرجى إدخال رقم الكارنيه الجامعي' : 'Please enter your student ID card number',
        'error'
      );
      return;
    }
    setSubmittingApp(true);
    try {
      await applyAsDeliveryPartner({
        university_id: appUniversityId,
        national_id_last4: appNationalId.trim(),
        student_card_id: appStudentCard.trim(),
        delivery_method: appMethod,
        availability_schedule: appSchedule.trim(),
        phone: appPhone.trim(),
      });
    } finally {
      setSubmittingApp(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#F7931E] font-bold">
            <span>
              {lang === 'ar'
                ? 'شريك التوصيل الطلابي — جامعة الفيوم'
                : 'Student Delivery Partner — Fayoum University'}
            </span>
            <span>·</span>
            <span>
              {lang === 'ar'
                ? `دخل لكل توصيلة: ${pricing.partner_earning} ج.م`
                : `Earning per delivery: ${pricing.partner_earning} EGP`}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">
            {lang === 'ar'
              ? `أهلاً ${partnerName} — توصيل مرن بين المحاضرات`
              : `Welcome, ${partnerName} — Flexible Campus Delivery`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {myDeliveryPartnerProfile?.verification_status === 'verified' && (
            <button
              type="button"
              disabled={togglingOnline}
              onClick={async () => {
                setTogglingOnline(true);
                try {
                  await toggleDeliveryPartnerOnline();
                } finally {
                  setTogglingOnline(false);
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors disabled:opacity-60 ${
                myDeliveryPartnerProfile.is_online
                  ? 'bg-[#F7931E] text-[#13221C]'
                  : 'bg-white/15 text-white border border-white/25'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {togglingOnline
                  ? lang === 'ar'
                    ? 'جاري التحديث...'
                    : 'Updating...'
                  : myDeliveryPartnerProfile.is_online
                  ? lang === 'ar'
                    ? 'متصل لاستقبال الطلبات'
                    : 'Online (Active)'
                  : lang === 'ar'
                  ? 'غير متصل (أوفلاين)'
                  : 'Offline'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Case A: User has NOT applied yet -> Application Form */}
      {!myDeliveryPartnerProfile && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 sm:p-8 max-w-2xl mx-auto space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0B3D2E]/10 text-[#0B3D2E] flex items-center justify-center">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#0B3D2E]">
                {lang === 'ar'
                  ? 'قدّم كطالب توصيل بنفس حسابك'
                  : 'Apply as a Student Delivery Partner'}
              </h2>
              <p className="text-xs text-[#4E6359]">
                {lang === 'ar'
                  ? `اكسب ${pricing.partner_earning} ج.م عن كل طلب توصله مشياً أو بالدراجة في أوقات فراغك`
                  : `Earn ${pricing.partner_earning} EGP per delivery walking or by bicycle alongside your classes`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'آخر ٤ أرقام من البطاقة القومية *' : 'National ID (Last 4 digits) *'}
              </label>
              <input
                type="text"
                maxLength={4}
                value={appNationalId}
                onChange={(e) => setAppNationalId(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'رقم الكارنيه الجامعي *' : 'University Student ID *'}
              </label>
              <input
                type="text"
                value={appStudentCard}
                onChange={(e) => setAppStudentCard(e.target.value)}
                placeholder={lang === 'ar' ? 'رقم الكارنيه الجامعي' : 'Student Card ID'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'رقم الهاتف للتواصل' : 'Contact Phone'}
              </label>
              <input
                type="tel"
                value={appPhone}
                onChange={(e) => setAppPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums"
              />
            </div>
            {universities.length > 0 && (
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'الجامعة' : 'University'}
                </label>
                <select
                  value={appUniversityId}
                  onChange={(e) => setAppUniversityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === 'ar' ? u.name_ar : u.name_en}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold mb-2">
              {lang === 'ar' ? 'وسيلة التوصيل' : 'Delivery Method'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAppMethod('walking')}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                  appMethod === 'walking'
                    ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                    : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                }`}
              >
                <Footprints className="w-4 h-4" />
                <span>{lang === 'ar' ? 'مشي على الأقدام' : 'Walking'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAppMethod('bicycle')}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                  appMethod === 'bicycle'
                    ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                    : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>{lang === 'ar' ? 'دراجة هوائية' : 'Bicycle'}</span>
              </button>
              <div className="p-3 rounded-2xl border border-dashed border-[#0B3D2E]/25 bg-[#FFF7E6]/40 text-xs text-[#4E6359] flex items-center justify-between">
                <span>{lang === 'ar' ? 'دراجة نارية' : 'Motorcycle'}</span>
                <span className="font-bold text-[#E97858]">{lang === 'ar' ? 'قريباً' : 'Future'}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">
              {lang === 'ar' ? 'أوقات التفرغ المتاحة' : 'Availability Schedule'}
            </label>
            <input
              type="text"
              value={appSchedule}
              onChange={(e) => setAppSchedule(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: 2 ظهراً - 7 مساءً' : 'e.g. 2 PM - 7 PM'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
            />
          </div>

          <button
            type="button"
            disabled={submittingApp}
            onClick={() => void handleApplicationSubmit()}
            className="w-full py-3 rounded-xl bg-[#0B3D2E] text-white font-bold text-sm hover:bg-[#072B20] disabled:opacity-50 cursor-pointer"
          >
            {submittingApp
              ? lang === 'ar'
                ? 'جاري إرسال الطلب...'
                : 'Submitting...'
              : lang === 'ar'
              ? 'إرسال طلب التوثيق للإدارة'
              : 'Submit Delivery Partner Application'}
          </button>
        </div>
      )}

      {/* Case B: Pending / Rejected / Suspended Verification */}
      {myDeliveryPartnerProfile && myDeliveryPartnerProfile.verification_status !== 'verified' && (
        <div className="bg-white rounded-3xl border border-[#F7931E] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8A5A00]">
              <AlertCircle className="w-4 h-4" />
              <span>
                {myDeliveryPartnerProfile.verification_status === 'pending'
                  ? lang === 'ar'
                    ? 'حالة الحساب: قيد المراجعة الإدارية'
                    : 'Status: Pending Verification'
                  : myDeliveryPartnerProfile.verification_status === 'rejected'
                  ? lang === 'ar'
                    ? 'حالة الحساب: مرفوض'
                    : 'Status: Rejected'
                  : lang === 'ar'
                  ? 'حالة الحساب: موقوف'
                  : 'Status: Suspended'}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-[#13221C]">
              {myDeliveryPartnerProfile.verification_status === 'pending'
                ? lang === 'ar'
                  ? 'تم استلام بياناتك الجامعية وجاري توثيقها'
                  : 'Your university verification info is under admin review'
                : myDeliveryPartnerProfile.verification_status === 'rejected'
                ? lang === 'ar'
                  ? 'لم يتم قبول طلب التوثيق حالياً'
                  : 'Your application was not approved'
                : lang === 'ar'
                ? 'تم إيقاف حساب التوصيل مؤقتاً'
                : 'Your delivery partner account is suspended'}
            </h3>
            <p className="text-xs text-[#4E6359]">
              {lang === 'ar'
                ? `الوسيلة: ${deliveryMethodLabel(myDeliveryPartnerProfile.delivery_method)} · كارنيه: ${myDeliveryPartnerProfile.student_card_id}`
                : `Method: ${deliveryMethodLabel(myDeliveryPartnerProfile.delivery_method)} · Card: ${myDeliveryPartnerProfile.student_card_id}`}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/admin');
                setView('admin');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              {lang === 'ar' ? 'مراجعة في لوحة الإدارة' : 'Review in Admin Portal'}
            </button>
          )}
        </div>
      )}

      {/* Case C: Verified Student Delivery Partner Dashboard */}
      {myDeliveryPartnerProfile && myDeliveryPartnerProfile.verification_status === 'verified' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
              <div className="inline-flex gap-1.5 p-1.5 bg-white border border-[#0B3D2E]/12 rounded-2xl min-w-max">
                {[
                  {
                    id: 'requests' as const,
                    ar: `طلبات متاحة (${availableOffers.length})`,
                    en: `Available (${availableOffers.length})`,
                  },
                  {
                    id: 'active' as const,
                    ar: `توصيلاتي النشطة (${myActiveDeliveries.length})`,
                    en: `Active (${myActiveDeliveries.length})`,
                  },
                  {
                    id: 'earnings' as const,
                    ar: `الأرباح والتقييم (${earningsStats.total} ج.م)`,
                    en: `Earnings (${earningsStats.total} EGP)`,
                  },
                  { id: 'settings' as const, ar: 'الوسيلة والتفرغ', en: 'Method & Schedule' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`px-4 min-h-[42px] rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      tab === t.id
                        ? 'bg-[#0B3D2E] text-white'
                        : 'text-[#13221C]/80 hover:bg-[#FFF7E6]'
                    }`}
                  >
                    {lang === 'ar' ? t.ar : t.en}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/student');
                setView('student');
              }}
              className="text-xs font-bold text-[#0B3D2E] hover:underline cursor-pointer"
            >
              {lang === 'ar'
                ? 'التبديل لوضع الطالب (طلب وجبة لنفسي) ←'
                : 'Switch to Student Ordering Mode →'}
            </button>
          </div>

          {/* TAB 1: AVAILABLE DELIVERY OFFERS */}
          {tab === 'requests' && (
            <div className="space-y-4">
              {myDeliveryPartnerProfile.is_online && skippedIds.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#4E6359]">
                    {lang === 'ar'
                      ? `قمت بتخطي ${skippedIds.length} طلبات مؤقتاً في هذه الجلسة.`
                      : `You skipped ${skippedIds.length} request(s) in this session.`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSkippedIds([])}
                    className="font-bold text-[#0B3D2E] hover:underline cursor-pointer"
                  >
                    {lang === 'ar' ? 'إظهار العروض المتخطاة' : 'Restore Skipped Requests'}
                  </button>
                </div>
              )}

              {!myDeliveryPartnerProfile.is_online ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
                  <Power className="w-9 h-9 text-[#4E6359] mx-auto" />
                  <h3 className="font-extrabold text-lg">
                    {lang === 'ar' ? 'أنت غير متصل حالياً' : 'You are currently Offline'}
                  </h3>
                  <p className="text-xs text-[#4E6359]">
                    {lang === 'ar'
                      ? 'فعّل وضع الاتصال لاستقبال وقبول طلبات التوصيل الجاهزة.'
                      : 'Go Online to view and claim ready-for-pickup campus deliveries.'}
                  </p>
                  <button
                    type="button"
                    disabled={togglingOnline}
                    onClick={async () => {
                      setTogglingOnline(true);
                      try {
                        await toggleDeliveryPartnerOnline();
                      } finally {
                        setTogglingOnline(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {togglingOnline
                      ? lang === 'ar'
                        ? 'جاري التفعيل...'
                        : 'Connecting...'
                      : lang === 'ar'
                      ? 'تفعيل الاتصال الآن'
                      : 'Go Online Now'}
                  </button>
                </div>
              ) : availableOffers.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-2">
                  <PackageCheck className="w-9 h-9 text-[#0B3D2E] mx-auto" />
                  <p className="font-bold text-[#13221C]">
                    {lang === 'ar'
                      ? 'لا توجد طلبات توصيل متاحة حاليًا.'
                      : 'No delivery requests available right now.'}
                  </p>
                  <p className="text-xs text-[#4E6359]">
                    {lang === 'ar'
                      ? 'ستظهر هنا فور انتهاء المطابخ من تحضير طلبات التوصيل.'
                      : 'New requests appear as soon as kitchens mark delivery orders Ready for Pickup.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {availableOffers.map(({ offer, matchesCampus }) => {
                    const isAccepting = acceptingOrderId === offer.order_id;
                    return (
                      <div
                        key={offer.id}
                        className="bg-white rounded-3xl border border-[#0B3D2E]/15 p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-[#0B3D2E] tabular-nums">
                                {offer.order_number}
                              </span>
                              {matchesCampus && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#A7C957]/30 text-[#0B3D2E] text-[11px] font-extrabold">
                                  <MapPin className="w-3 h-3" />
                                  <span>{lang === 'ar' ? 'قريب من جامعتك' : 'Near Campus'}</span>
                                </span>
                              )}
                            </div>
                            <span className="px-3 py-1 rounded-xl bg-[#F7931E]/25 text-[#13221C] text-xs font-extrabold tabular-nums">
                              +{offer.partner_earning} {lang === 'ar' ? 'ج.م أرباحك' : 'EGP Earning'}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="p-3 rounded-2xl bg-[#FFF7E6]">
                              <div className="font-bold text-[#4E6359]">
                                {lang === 'ar' ? 'استلام من المطبخ:' : 'Pickup From:'}
                              </div>
                              <div className="font-extrabold text-[#0B3D2E] mt-0.5">
                                {offer.provider_name}
                              </div>
                              <div className="text-[#13221C] mt-0.5">{offer.pickup_address}</div>
                            </div>

                            {offer.delivery_area_hint && (
                              <div className="p-3 rounded-2xl bg-[#0B3D2E]/6">
                                <div className="font-bold text-[#4E6359]">
                                  {lang === 'ar' ? 'نطاق التسليم:' : 'Delivery Area:'}
                                </div>
                                <div className="text-[#0B3D2E] font-semibold mt-0.5">
                                  {offer.delivery_area_hint}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="text-xs text-[#4E6359] tabular-nums">
                            {lang === 'ar' ? 'التحصيل كاش عند التسليم:' : 'Cash to collect:'}{' '}
                            <strong className="text-[#13221C]">
                              {offer.total_amount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                            </strong>
                          </div>
                        </div>

                        <div className="flex gap-2.5 pt-2 border-t border-[#0B3D2E]/10">
                          <button
                            type="button"
                            disabled={isAccepting}
                            onClick={async () => {
                              setAcceptingOrderId(offer.order_id);
                              try {
                                const ok = await acceptDeliveryRequest(offer.order_id);
                                if (ok) setTab('active');
                              } finally {
                                setAcceptingOrderId(null);
                              }
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] disabled:opacity-50 cursor-pointer"
                          >
                            {isAccepting
                              ? lang === 'ar'
                                ? 'جاري التعيين...'
                                : 'Claiming...'
                              : lang === 'ar'
                              ? 'قبول التوصيل'
                              : 'Accept Request'}
                          </button>
                          <button
                            type="button"
                            disabled={isAccepting}
                            onClick={() => setSkippedIds((prev) => [...prev, offer.order_id])}
                            className="px-4 py-2.5 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#4E6359] hover:bg-[#FFF7E6] disabled:opacity-50 cursor-pointer"
                          >
                            {lang === 'ar' ? 'تخطي' : 'Skip'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE DELIVERY WORKFLOW */}
          {tab === 'active' && (
            <div className="space-y-4">
              {myActiveDeliveries.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-2">
                  <Navigation className="w-9 h-9 text-[#4E6359] mx-auto" />
                  <p className="font-bold text-[#13221C]">
                    {lang === 'ar' ? 'لا توجد توصيلات نشطة حالياً' : 'No active deliveries right now'}
                  </p>
                  {availableOffers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('requests')}
                      className="mt-2 px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                    >
                      {lang === 'ar' ? 'تصفح الطلبات المتاحة' : 'Browse Available Requests'}
                    </button>
                  )}
                </div>
              ) : (
                myActiveDeliveries.map((order) => {
                  const prov = providerProfiles.find((p) => p.user_id === order.provider_id);
                  const badge = getOrderStatusBadge(order.status, lang);
                  const isUpdating = updatingOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl border border-[#0B3D2E]/15 p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-extrabold text-[#0B3D2E] tabular-nums">
                            {order.order_number}
                          </span>
                          <h3 className="text-lg font-extrabold text-[#13221C]">
                            {order.provider_name} → {order.student_name}
                          </h3>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-xl border text-xs font-extrabold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3.5 rounded-2xl bg-[#FFF7E6]">
                          <strong>{lang === 'ar' ? 'عنوان الاستلام:' : 'Pickup:'}</strong>{' '}
                          {prov?.pickup_address || order.provider_name}
                        </div>
                        <div className="p-3.5 rounded-2xl bg-[#0B3D2E]/8">
                          <strong>{lang === 'ar' ? 'عنوان التسليم:' : 'Destination:'}</strong>{' '}
                          {order.delivery_location}
                          {order.student_phone ? ` · ${order.student_phone}` : ''}
                        </div>
                      </div>

                      {order.items_summary.length > 0 && (
                        <div className="text-xs text-[#4E6359]">
                          <strong className="text-[#13221C]">
                            {lang === 'ar' ? 'محتويات الطلب: ' : 'Items: '}
                          </strong>
                          {order.items_summary.map((i) => `${i.quantity}× ${i.meal_name}`).join(' ، ')}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#0B3D2E]/10">
                        <div className="text-xs font-bold text-[#13221C] tabular-nums">
                          {lang === 'ar' ? 'المطلوب تحصيله كاش:' : 'Collect Cash:'}{' '}
                          <span className="text-[#0B3D2E] text-base">
                            {order.total_amount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {order.status === 'assigned' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={async () => {
                                setUpdatingOrderId(order.id);
                                try {
                                  await updateDeliveryStep(order.id, 'picked_up');
                                } finally {
                                  setUpdatingOrderId(null);
                                }
                              }}
                              className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                            >
                              {isUpdating
                                ? lang === 'ar'
                                  ? 'جاري التحديث...'
                                  : 'Updating...'
                                : lang === 'ar'
                                ? 'تأكيد الاستلام من المطبخ'
                                : 'Confirm Pickup'}
                            </button>
                          )}
                          {order.status === 'picked_up' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={async () => {
                                setUpdatingOrderId(order.id);
                                try {
                                  await updateDeliveryStep(order.id, 'out_for_delivery');
                                } finally {
                                  setUpdatingOrderId(null);
                                }
                              }}
                              className="px-5 py-2.5 rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold disabled:opacity-50 cursor-pointer"
                            >
                              {isUpdating
                                ? lang === 'ar'
                                  ? 'جاري التحديث...'
                                  : 'Updating...'
                                : lang === 'ar'
                                ? 'في الطريق للطالب الآن'
                                : 'Mark Out for Delivery'}
                            </button>
                          )}
                          {order.status === 'out_for_delivery' && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={async () => {
                                setUpdatingOrderId(order.id);
                                try {
                                  await updateDeliveryStep(order.id, 'delivered');
                                } finally {
                                  setUpdatingOrderId(null);
                                }
                              }}
                              className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                            >
                              {isUpdating
                                ? lang === 'ar'
                                  ? 'جاري التأكيد...'
                                  : 'Confirming...'
                                : lang === 'ar'
                                ? 'تأكيد تسليم الطلب للطالب'
                                : 'Confirm Successful Delivery'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: EARNINGS, COMPLETED DELIVERIES & RATINGS */}
          {tab === 'earnings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-3xl p-5">
                  <div className="text-xs text-[#F7931E] font-bold">
                    {lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}
                  </div>
                  <div className="text-3xl font-extrabold mt-1 tabular-nums">
                    {earningsStats.total} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
                  <div className="text-xs font-bold text-[#4E6359]">
                    {lang === 'ar' ? 'أرباح اليوم' : 'Daily Earnings'}
                  </div>
                  <div className="text-2xl font-extrabold text-[#0B3D2E] mt-1 tabular-nums">
                    {earningsStats.daily} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
                  <div className="text-xs font-bold text-[#4E6359]">
                    {lang === 'ar' ? 'أرباح الأسبوع' : 'Weekly Earnings'}
                  </div>
                  <div className="text-2xl font-extrabold text-[#0B3D2E] mt-1 tabular-nums">
                    {earningsStats.weekly} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
                  <div className="text-xs font-bold text-[#4E6359]">
                    {lang === 'ar' ? 'توصيلات مكتملة' : 'Completed Deliveries'}
                  </div>
                  <div className="text-2xl font-extrabold text-[#13221C] mt-1 tabular-nums">
                    {Math.max(
                      earningsStats.completed,
                      myCompletedDeliveries.length,
                      myDeliveryPartnerProfile.completed_deliveries || 0
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
                  <div className="text-xs font-bold text-[#4E6359]">
                    {lang === 'ar' ? 'متوسط كل توصيلة' : 'Avg per Delivery'}
                  </div>
                  <div className="text-2xl font-extrabold text-[#0B3D2E] mt-1 tabular-nums">
                    {earningsStats.avg} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Payment History */}
                <div className="lg:col-span-7 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4">
                  <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'سجل المدفوعات والأرباح' : 'Payment & Earnings History'}
                  </h3>
                  {myTransactions.length === 0 ? (
                    <p className="text-xs text-[#4E6359]">
                      {lang === 'ar'
                        ? 'لم تحقق أي أرباح حتى الآن.'
                        : 'You have not earned any payouts yet.'}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {paginatedTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3.5 rounded-2xl bg-[#FFF7E6] flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-extrabold text-[#0B3D2E] tabular-nums">
                                {tx.order_number}
                              </div>
                              <div className="text-[#4E6359] mt-0.5 tabular-nums">
                                {lang === 'ar' ? 'رسوم العميل:' : 'Customer fee:'}{' '}
                                {tx.customer_delivery_fee} {lang === 'ar' ? 'ج.م' : 'EGP'} ·{' '}
                                {lang === 'ar' ? 'عمولة لقمة:' : 'Platform:'}{' '}
                                {tx.platform_commission} {lang === 'ar' ? 'ج.م' : 'EGP'}
                              </div>
                            </div>
                            <div className="text-end">
                              <div className="text-sm font-extrabold text-[#0B3D2E] tabular-nums">
                                +{tx.partner_earning} {lang === 'ar' ? 'ج.م' : 'EGP'}
                              </div>
                              <div className="text-[11px] font-bold text-[#4E6359]">
                                {txStatusLabel(tx.status)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {totalTxPages > 1 && (
                        <div className="flex items-center justify-between pt-2 text-xs">
                          <span className="font-bold text-[#4E6359] tabular-nums">
                            {lang === 'ar'
                              ? `صفحة ${txPage} من ${totalTxPages}`
                              : `Page ${txPage} of ${totalTxPages}`}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={txPage <= 1}
                              onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                              className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                            >
                              {lang === 'ar' ? 'السابق' : 'Prev'}
                            </button>
                            <button
                              type="button"
                              disabled={txPage >= totalTxPages}
                              onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                              className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                            >
                              {lang === 'ar' ? 'التالي' : 'Next'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Customer Delivery Ratings */}
                <div className="lg:col-span-5 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                      {lang === 'ar' ? 'تقييمات الطلبة للتوصيل' : 'Customer Delivery Ratings'}
                    </h3>
                    {deliveryRatingSummary.count > 0 ? (
                      <span className="inline-flex items-center gap-1 font-extrabold text-sm tabular-nums">
                        <Star className="w-4 h-4 fill-[#F7931E] text-[#F7931E]" />
                        {deliveryRatingSummary.avg} ({deliveryRatingSummary.count})
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#FFF7E6] text-[#0B3D2E]">
                        {lang === 'ar' ? 'جديد · بلا تقييمات' : 'New · No ratings'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {partnerReviews.length === 0 ? (
                      <p className="text-xs text-[#4E6359]">
                        {lang === 'ar' ? 'لا توجد تقييمات حتى الآن.' : 'No reviews yet.'}
                      </p>
                    ) : (
                      partnerReviews.map((rev) => (
                        <div key={rev.id} className="p-3.5 rounded-2xl bg-[#FFF7E6] text-xs space-y-1">
                          <div className="font-bold text-[#0B3D2E] tabular-nums">
                            ★ {rev.delivery_rating}/5
                          </div>
                          <p className="text-[#13221C]">
                            {rev.delivery_comment || rev.comment}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Completed Deliveries History */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'التوصيلات المكتملة' : 'Completed Deliveries'}
                  </h3>
                  <span className="text-xs font-bold text-[#4E6359] tabular-nums">
                    {myCompletedDeliveries.length}{' '}
                    {lang === 'ar' ? 'طلب مكتمل' : 'completed'}
                  </span>
                </div>
                {myCompletedDeliveries.length === 0 ? (
                  <p className="text-xs text-[#4E6359]">
                    {lang === 'ar'
                      ? 'ستظهر هنا تفاصيل التوصيلات التي تم تسليمها للطلبة.'
                      : 'Completed delivery orders will appear here.'}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {paginatedCompleted.map((order) => (
                        <div
                          key={order.id}
                          className="p-4 rounded-2xl border border-[#0B3D2E]/10 bg-[#FFF7E6]/50 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-[#0B3D2E] tabular-nums">
                              {order.order_number}
                            </span>
                            <span className="font-bold text-[#4E6359] tabular-nums">
                              {new Date(
                                order.updated_at || order.created_at
                              ).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                            </span>
                          </div>
                          <div className="font-bold text-[#13221C]">
                            {order.provider_name} → {order.student_name}
                          </div>
                          <div className="text-[#4E6359] truncate">{order.delivery_location}</div>
                        </div>
                      ))}
                    </div>
                    {totalCompletedPages > 1 && (
                      <div className="flex items-center justify-between pt-2 text-xs">
                        <span className="font-bold text-[#4E6359] tabular-nums">
                          {lang === 'ar'
                            ? `صفحة ${completedPage} من ${totalCompletedPages}`
                            : `Page ${completedPage} of ${totalCompletedPages}`}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={completedPage <= 1}
                            onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                          >
                            {lang === 'ar' ? 'السابق' : 'Prev'}
                          </button>
                          <button
                            type="button"
                            disabled={completedPage >= totalCompletedPages}
                            onClick={() =>
                              setCompletedPage((p) => Math.min(totalCompletedPages, p + 1))
                            }
                            className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                          >
                            {lang === 'ar' ? 'التالي' : 'Next'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: METHOD & AVAILABILITY SETTINGS */}
          {tab === 'settings' && (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 max-w-xl space-y-5">
              <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'وسيلة التوصيل وجدول التفرغ' : 'Delivery Method & Availability'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setEditMethod('walking')}
                  className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                    editMethod === 'walking'
                      ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                      : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                  }`}
                >
                  <Footprints className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'مشي' : 'Walking'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditMethod('bicycle')}
                  className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                    editMethod === 'bicycle'
                      ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                      : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'دراجة هوائية' : 'Bicycle'}</span>
                </button>
                <div className="p-3.5 rounded-2xl border border-dashed border-[#0B3D2E]/25 bg-[#FFF7E6]/40 text-xs font-bold text-[#4E6359] flex items-center justify-between">
                  <span>{lang === 'ar' ? 'موتوسيكل' : 'Motorcycle'}</span>
                  <span className="text-[#E97858]">{lang === 'ar' ? 'مستقبلاً' : 'Future'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'جدول ساعات التفرغ' : 'Available Hours'}
                </label>
                <input
                  type="text"
                  value={editSchedule}
                  onChange={(e) => setEditSchedule(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: 2 ظهراً - 8 مساءً' : 'e.g. 2 PM - 8 PM'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>

              <button
                type="button"
                disabled={savingSettings}
                onClick={async () => {
                  setSavingSettings(true);
                  try {
                    await updateDeliveryPartnerMethod(editMethod, editSchedule);
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                className="px-6 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {savingSettings
                  ? lang === 'ar'
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : lang === 'ar'
                  ? 'حفظ الإعدادات'
                  : 'Save Settings'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
