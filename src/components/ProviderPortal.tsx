import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  ChefHat,
  Edit3,
  ImagePlus,
  LogIn,
  Package,
  Plus,
  Power,
  Search,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import homemadePackagingPhoto from '../assets/images/homemade_packaging_prep_1795442588513.jpg';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';
import { Meal, OrderStatus } from '../types/database';
import { getProviderRatingStats } from '../utils/recommendation';
import { MealArtwork } from './MealArtwork';
import { ProviderVisualSummary } from './ProviderVisualSummary';
import { ConfirmDialog } from './ConfirmDialog';
import { compressImageToDataUrl, validateImageFileClient } from '../utils/imageUpload';

type ProviderTab = 'dashboard' | 'orders' | 'meals' | 'reviews' | 'profile';
type ProviderOrderFilter = 'all' | 'pending' | 'active' | 'delivered' | 'cancelled';
type ProviderMealFilter = 'all' | 'available' | 'hidden';

const PROVIDER_ORDERS_PAGE_SIZE = 8;
const PROVIDER_MEALS_PAGE_SIZE = 9;
const PROVIDER_REVIEWS_PAGE_SIZE = 8;

export const ProviderPortal: React.FC = () => {
  const {
    lang,
    universities,
    mealCategories,
    allergens,
    dietaryPreferences,
    myProviderProfile,
    meals,
    orders,
    reviews,
    pushToast,
    registerOrUpdateProviderProfile,
    toggleProviderAcceptingOrders,
    transitionOrderStatus,
    saveMeal,
    toggleMealAvailability,
    deleteMealSafely,
    replyToReview,
    setView,
  } = useLokma();

  const { firebaseUser, needsEmailVerification, setReturnTarget } = useFirebaseAuth();

  const [tab, setTab] = useState<ProviderTab>('dashboard');

  const providerMeals = useMemo(() => {
    if (!firebaseUser) return [];
    return meals.filter(
      (m) => m.provider_id === firebaseUser.uid && m.deleted_at === null
    );
  }, [meals, firebaseUser]);

  const providerOrders = useMemo(() => {
    if (!firebaseUser) return [];
    return orders
      .filter((o) => o.provider_id === firebaseUser.uid)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [orders, firebaseUser]);

  const completedRevenue = providerOrders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'rejected')
    .reduce((acc, o) => acc + o.subtotal_amount, 0);

  const deliveredCount = providerOrders.filter((o) => o.status === 'delivered').length;
  const activeQueue = providerOrders.filter(
    (o) => !['delivered', 'cancelled', 'rejected'].includes(o.status)
  );

  const ratingStats = useMemo(
    () =>
      firebaseUser
        ? getProviderRatingStats(firebaseUser.uid, reviews)
        : { avg_rating: 0, review_count: 0 },
    [firebaseUser, reviews]
  );

  const mealSalesStats = useMemo(() => {
    const validOrders = providerOrders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'rejected'
    );
    const map = new Map<string, { mealName: string; qty: number; revenue: number }>();
    validOrders.forEach((order) => {
      order.items_summary.forEach((oi) => {
        const cur = map.get(oi.meal_id) || {
          mealName: oi.meal_name,
          qty: 0,
          revenue: 0,
        };
        map.set(oi.meal_id, {
          mealName: oi.meal_name,
          qty: cur.qty + oi.quantity,
          revenue: cur.revenue + oi.line_total,
        });
      });
    });
    return Array.from(map.entries())
      .map(([mealId, stat]) => ({ mealId, ...stat }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [providerOrders]);

  const providerReviews = useMemo(() => {
    if (!firebaseUser) return [];
    return reviews.filter((r) => r.provider_id === firebaseUser.uid);
  }, [reviews, firebaseUser]);

  // Meal Form Modal state
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | undefined>(undefined);
  const [mName, setMName] = useState('');
  const [mNameAr, setMNameAr] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mCategory, setMCategory] = useState('');
  const [mPrice, setMPrice] = useState<number>(0);
  const [mPortion, setMPortion] = useState('');
  const [mPrep, setMPrep] = useState<number>(20);
  const [mIngredientsText, setMIngredientsText] = useState('');
  const [mCalories, setMCalories] = useState<string>('');
  const [mProtein, setMProtein] = useState<string>('');
  const [mCarbs, setMCarbs] = useState<string>('');
  const [mFat, setMFat] = useState<string>('');
  const [mFiber, setMFiber] = useState<string>('');
  const [mAllergens, setMAllergens] = useState<string[]>([]);
  const [mDietary, setMDietary] = useState<string[]>([]);
  const [mImageUrl, setMImageUrl] = useState<string>('');

  // Reply state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);

  // Filters, search, pagination & confirmation states
  const [ordersFilter, setOrdersFilter] = useState<ProviderOrderFilter>('all');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [rejectOrderTarget, setRejectOrderTarget] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [mealsFilter, setMealsFilter] = useState<ProviderMealFilter>('all');
  const [mealsSearch, setMealsSearch] = useState('');
  const [mealsPage, setMealsPage] = useState(1);
  const [togglingMealId, setTogglingMealId] = useState<string | null>(null);
  const [savingMeal, setSavingMeal] = useState(false);
  const [deleteMealTarget, setDeleteMealTarget] = useState<Meal | null>(null);
  const [deletingMeal, setDeletingMeal] = useState(false);

  // Profile / Kitchen registration state
  const [pName, setPName] = useState('');
  const [pBio, setPBio] = useState('');
  const [pArea, setPArea] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pUniId, setPUniId] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (myProviderProfile) {
      setPName(myProviderProfile.business_name);
      setPBio(myProviderProfile.bio);
      setPArea(myProviderProfile.area);
      setPAddress(myProviderProfile.pickup_address);
      setPUniId(myProviderProfile.university_id);
    }
  }, [myProviderProfile]);

  const filteredOrders = useMemo(() => {
    const q = ordersSearch.trim().toLowerCase();
    return providerOrders.filter((o) => {
      if (ordersFilter === 'pending' && o.status !== 'pending') return false;
      if (
        ordersFilter === 'active' &&
        ['pending', 'delivered', 'cancelled', 'rejected'].includes(o.status)
      ) {
        return false;
      }
      if (ordersFilter === 'delivered' && o.status !== 'delivered') return false;
      if (ordersFilter === 'cancelled' && o.status !== 'cancelled' && o.status !== 'rejected') {
        return false;
      }
      if (q) {
        const text = `${o.order_number} ${o.student_name} ${o.delivery_location || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [providerOrders, ordersFilter, ordersSearch]);

  useEffect(() => {
    setOrdersPage(1);
  }, [ordersFilter, ordersSearch]);

  const totalOrdersPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / PROVIDER_ORDERS_PAGE_SIZE)
  );
  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(ordersPage, totalOrdersPages);
    const start = (safePage - 1) * PROVIDER_ORDERS_PAGE_SIZE;
    return filteredOrders.slice(start, start + PROVIDER_ORDERS_PAGE_SIZE);
  }, [filteredOrders, ordersPage, totalOrdersPages]);

  const filteredMeals = useMemo(() => {
    const q = mealsSearch.trim().toLowerCase();
    return providerMeals.filter((m) => {
      if (mealsFilter === 'available' && !m.is_available) return false;
      if (mealsFilter === 'hidden' && m.is_available) return false;
      if (q) {
        const text = `${m.name} ${m.name_ar || ''} ${m.description}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [providerMeals, mealsFilter, mealsSearch]);

  useEffect(() => {
    setMealsPage(1);
  }, [mealsFilter, mealsSearch]);

  const totalMealsPages = Math.max(1, Math.ceil(filteredMeals.length / PROVIDER_MEALS_PAGE_SIZE));
  const paginatedMeals = useMemo(() => {
    const safePage = Math.min(mealsPage, totalMealsPages);
    const start = (safePage - 1) * PROVIDER_MEALS_PAGE_SIZE;
    return filteredMeals.slice(start, start + PROVIDER_MEALS_PAGE_SIZE);
  }, [filteredMeals, mealsPage, totalMealsPages]);

  const totalReviewsPages = Math.max(
    1,
    Math.ceil(providerReviews.length / PROVIDER_REVIEWS_PAGE_SIZE)
  );
  const paginatedReviews = useMemo(() => {
    const safePage = Math.min(reviewsPage, totalReviewsPages);
    const start = (safePage - 1) * PROVIDER_REVIEWS_PAGE_SIZE;
    return providerReviews.slice(start, start + PROVIDER_REVIEWS_PAGE_SIZE);
  }, [providerReviews, reviewsPage, totalReviewsPages]);

  const goToLogin = () => {
    setReturnTarget({ view: 'provider', eventId: null });
    window.history.pushState({}, '', '/login');
    setView('auth');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFileClient(file);
    if (!validation.ok) {
      pushToast(
        lang === 'ar'
          ? validation.error
          : 'Unsupported or invalid image file (JPG, PNG, WebP up to 5MB)',
        'error'
      );
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > 550000) {
        pushToast(
          lang === 'ar'
            ? 'حجم الصورة كبير جداً. اختر صورة أصغر حجماً.'
            : 'Image is too large even after compression.',
          'error'
        );
        return;
      }
      setMImageUrl(dataUrl);
    } catch {
      pushToast(
        lang === 'ar' ? 'تعذر قراءة ملف الصورة' : 'Could not load image file',
        'error'
      );
    } finally {
      e.target.value = '';
    }
  };

  const openMealForm = (meal?: Meal) => {
    if (meal) {
      setEditingMealId(meal.id);
      setMName(meal.name);
      setMNameAr(meal.name_ar || '');
      setMDesc(meal.description);
      setMCategory(meal.category_id);
      setMPrice(meal.price);
      setMPortion(meal.portion_description);
      setMPrep(meal.prep_time_minutes);
      setMIngredientsText(meal.ingredients_text || '');
      setMImageUrl(meal.image_url || '');
      setMCalories(meal.calories_kcal !== undefined ? String(meal.calories_kcal) : '');
      setMProtein(meal.protein_g !== undefined ? String(meal.protein_g) : '');
      setMCarbs(meal.carbs_g !== undefined ? String(meal.carbs_g) : '');
      setMFat(meal.fat_g !== undefined ? String(meal.fat_g) : '');
      setMFiber(meal.fiber_g !== undefined ? String(meal.fiber_g) : '');
      setMAllergens(meal.allergen_ids || []);
      setMDietary(meal.dietary_pref_ids || []);
    } else {
      setEditingMealId(undefined);
      setMName('');
      setMNameAr('');
      setMDesc('');
      setMCategory(mealCategories[0]?.id || '');
      setMPrice(0);
      setMPortion('');
      setMPrep(25);
      setMIngredientsText('');
      setMImageUrl('');
      setMCalories('');
      setMProtein('');
      setMCarbs('');
      setMFat('');
      setMFiber('');
      setMAllergens([]);
      setMDietary([]);
    }
    setMealModalOpen(true);
  };

  const getNextAction = (status: OrderStatus, fulfillment: 'pickup' | 'delivery') => {
    if (status === 'accepted') {
      return { next: 'preparing' as OrderStatus, ar: 'بدء التحضير', en: 'Start Preparing' };
    }
    if (status === 'preparing') {
      return {
        next: 'ready_for_pickup' as OrderStatus,
        ar: fulfillment === 'delivery' ? 'جاهز لاستلام المندوب' : 'جاهز لاستلام الطالب',
        en: 'Ready for Pickup',
      };
    }
    if (status === 'ready_for_pickup' && fulfillment === 'pickup') {
      return { next: 'delivered' as OrderStatus, ar: 'تم التسليم للطالب', en: 'Complete Pickup' };
    }
    return null;
  };

  const orderStatusBadge = (status: OrderStatus) => {
    const map: Record<OrderStatus, { ar: string; en: string }> = {
      pending: { ar: 'بانتظار القبول', en: 'Pending' },
      accepted: { ar: 'مقبول', en: 'Accepted' },
      rejected: { ar: 'مرفوض', en: 'Rejected' },
      preparing: { ar: 'جاري التحضير', en: 'Preparing' },
      ready_for_pickup: { ar: 'جاهز للاستلام', en: 'Ready for Pickup' },
      assigned: { ar: 'المندوب في الطريق للمطبخ', en: 'Partner Assigned' },
      picked_up: { ar: 'تم التسليم للمندوب', en: 'Picked Up' },
      out_for_delivery: { ar: 'في الطريق للطالب', en: 'Out for Delivery' },
      delivered: { ar: 'تم التسليم', en: 'Delivered' },
      cancelled: { ar: 'ملغي', en: 'Cancelled' },
    };
    return lang === 'ar' ? map[status].ar : map[status].en;
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 bg-[#FBF0D9] min-h-[200px]">
            <img
              src={homemadePackagingPhoto}
              alt={
                lang === 'ar'
                  ? 'تجهيز وتغليف الوجبات البيتي الطازجة في مطبخ منزلي'
                  : 'Fresh homemade meals packed for university students'
              }
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="md:col-span-7 p-7 sm:p-8 flex flex-col justify-center space-y-4 text-start">
            <div className="w-12 h-12 rounded-2xl bg-[#F7931E]/20 text-[#8A5A00] flex items-center justify-center">
              <ChefHat className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'بوابة مقدم الطعام البيتي' : 'Home Food Provider Portal'}
            </h1>
            <p className="text-sm text-[#4E6359] leading-relaxed">
              {lang === 'ar'
                ? 'سجّل الدخول أو أنشئ حساب مقدم طعام لتسجيل مطبخك وإضافة وجباتك الحقيقية واستقبال طلبات الطلبة.'
                : 'Sign in or create a food provider account to register your kitchen and publish homemade meals.'}
            </p>
            <div>
              <button
                type="button"
                onClick={goToLogin}
                className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#0B3D2E] hover:bg-[#072B20] text-white text-sm font-bold transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل الدخول أو إنشاء حساب' : 'Sign In / Create Account'}</span>
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
        <div className="bg-white rounded-3xl border border-[#E97858]/35 p-8 text-center space-y-4">
          <h2 className="text-xl font-extrabold text-[#9E3F24]">
            {lang === 'ar' ? 'يرجى تأكيد البريد الإلكتروني' : 'Email Verification Required'}
          </h2>
          <p className="text-sm text-[#4E6359]">
            {lang === 'ar'
              ? 'أكّد بريدك الإلكتروني لتتمكن من تسجيل مطبخك وإضافة الوجبات.'
              : 'Please verify your email address before registering your kitchen.'}
          </p>
          <button
            type="button"
            onClick={goToLogin}
            className="px-6 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
          >
            {lang === 'ar' ? 'صفحة تأكيد البريد' : 'Go to Verification'}
          </button>
        </div>
      </div>
    );
  }

  if (!myProviderProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B3D2E]/10 text-[#0B3D2E] flex items-center justify-center">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'تسجيل مطبخ بيتي جديد' : 'Register Your Home Kitchen'}
              </h1>
              <p className="text-xs text-[#4E6359]">
                {lang === 'ar'
                  ? 'أدخل بيانات مطبخك الفعلية ليتم مراجعتها وتوثيقها من قبل إدارة لقمة'
                  : 'Submit your real kitchen details for admin verification'}
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'اسم المطبخ / المشروع *' : 'Kitchen Business Name *'}
              </label>
              <input
                type="text"
                maxLength={150}
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم مطبخك' : 'Your kitchen name'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'المنطقة *' : 'Area *'}
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={pArea}
                  onChange={(e) => setPArea(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: حي الجامعة - الفيوم' : 'e.g. University District'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'الجامعة القريبة' : 'Nearby University'}
                </label>
                <select
                  value={pUniId}
                  onChange={(e) => setPUniId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                >
                  <option value="">{lang === 'ar' ? 'اختر الجامعة' : 'Select university'}</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === 'ar' ? u.name_ar : u.name_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'عنوان الاستلام بالتفصيل *' : 'Pickup Address *'}
              </label>
              <input
                type="text"
                maxLength={300}
                value={pAddress}
                onChange={(e) => setPAddress(e.target.value)}
                placeholder={lang === 'ar' ? 'الشارع والعمارة لاستلام الطلبات' : 'Full pickup address'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'نبذة عن المطبخ' : 'Kitchen Bio'}
              </label>
              <textarea
                rows={3}
                maxLength={600}
                value={pBio}
                onChange={(e) => setPBio(e.target.value)}
                placeholder={lang === 'ar' ? 'تخصصك في الطبخ البيتي ومعايير النظافة...' : 'About your kitchen...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!pName.trim() || !pArea.trim() || !pAddress.trim()) {
                  pushToast(
                    lang === 'ar'
                      ? 'يرجى إكمال اسم المطبخ والمنطقة وعنوان الاستلام'
                      : 'Please fill kitchen name, area, and pickup address',
                    'error'
                  );
                  return;
                }
                void registerOrUpdateProviderProfile({
                  business_name: pName,
                  bio: pBio,
                  area: pArea,
                  pickup_address: pAddress,
                  university_id: pUniId,
                });
              }}
              className="w-full py-3 rounded-xl bg-[#0B3D2E] text-white text-sm font-bold hover:bg-[#072B20] cursor-pointer"
            >
              {lang === 'ar' ? 'تسجيل المطبخ وإرساله للمراجعة' : 'Submit Kitchen Profile'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Provider Header */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4E6359]">
            <span className="font-bold text-[#0B3D2E]">
              {lang === 'ar' ? 'بوابة مقدم الطعام (المطبخ المنزلي)' : 'Home Food Provider Portal'}
            </span>
            <span>·</span>
            <span
              className={`font-bold ${
                myProviderProfile.verification_status === 'verified'
                  ? 'text-[#0B3D2E]'
                  : 'text-[#9E3F24]'
              }`}
            >
              {myProviderProfile.verification_status === 'verified'
                ? lang === 'ar'
                  ? 'مطبخ موثق ✓'
                  : 'Verified ✓'
                : myProviderProfile.verification_status === 'rejected'
                ? lang === 'ar'
                  ? 'مرفوض'
                  : 'Rejected'
                : lang === 'ar'
                ? 'بانتظار موافقة الإدارة'
                : 'Pending Verification'}
            </span>
            <span>·</span>
            <span>{myProviderProfile.area}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#13221C] mt-1">
            {myProviderProfile.business_name}
          </h1>
        </div>

        <button
          type="button"
          disabled={myProviderProfile.verification_status !== 'verified'}
          onClick={() => void toggleProviderAcceptingOrders()}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            myProviderProfile.verification_status !== 'verified'
              ? 'bg-[#13221C]/10 text-[#4E6359] cursor-not-allowed'
              : myProviderProfile.is_accepting_orders
              ? 'bg-[#0B3D2E] text-white cursor-pointer'
              : 'bg-[#E97858]/15 text-[#9E3F24] border border-[#E97858]/30 cursor-pointer'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>
            {myProviderProfile.is_accepting_orders
              ? lang === 'ar'
                ? 'يستقبل طلبات'
                : 'Accepting Orders'
              : lang === 'ar'
              ? 'متوقف مؤقتاً'
              : 'Paused'}
          </span>
        </button>
      </div>

      {myProviderProfile.verification_status !== 'verified' && (
        <div
          className={`rounded-3xl border p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-3 ${
            myProviderProfile.verification_status === 'rejected' ||
            myProviderProfile.verification_status === 'suspended'
              ? 'bg-[#E97858]/12 border-[#E97858]/35 text-[#9E3F24]'
              : 'bg-[#F7931E]/15 border-[#F7931E]/40 text-[#8A5A00]'
          }`}
        >
          <div className="text-xs sm:text-sm font-bold leading-relaxed">
            {myProviderProfile.verification_status === 'pending'
              ? lang === 'ar'
                ? 'مطبخك قيد المراجعة الإدارية حالياً. يمكنك تجهيز قائمة وجباتك الآن، وستظهر للطلبة فور اعتماد التوثيق.'
                : 'Your kitchen is pending admin verification. You can prepare your menu now, and meals will appear to students once verified.'
              : myProviderProfile.verification_status === 'suspended'
              ? lang === 'ar'
                ? 'حساب المطبخ موقوف مؤقتاً من قبل الإدارة ولا يستقبل طلبات حالياً.'
                : 'Your kitchen account is currently suspended and cannot accept orders.'
              : lang === 'ar'
              ? 'تم رفض طلب التوثيق حالياً. يمكنك تحديث بيانات مطبخك من تبويب ملف المطبخ.'
              : 'Your kitchen verification was rejected. Please review and update your Kitchen Profile.'}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <div className="inline-flex gap-1.5 p-1.5 bg-white border border-[#0B3D2E]/12 rounded-2xl min-w-max">
          {[
            { id: 'dashboard' as const, ar: 'لوحة التحكم', en: 'Dashboard' },
            {
              id: 'orders' as const,
              ar: `الطلبات (${activeQueue.length})`,
              en: `Orders Queue (${activeQueue.length})`,
            },
            {
              id: 'meals' as const,
              ar: `وجباتي (${providerMeals.length})`,
              en: `My Meals (${providerMeals.length})`,
            },
            {
              id: 'reviews' as const,
              ar: `التقييمات (${providerReviews.length})`,
              en: `Reviews (${providerReviews.length})`,
            },
            { id: 'profile' as const, ar: 'ملف المطبخ', en: 'Kitchen Profile' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 min-h-[42px] rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.id ? 'bg-[#0B3D2E] text-white' : 'text-[#13221C]/80 hover:bg-[#FFF7E6]'
              }`}
            >
              {lang === 'ar' ? t.ar : t.en}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
              <div className="text-xs font-bold text-[#4E6359]">
                {lang === 'ar' ? 'الطلبات النشطة' : 'Active Orders'}
              </div>
              <div className="text-3xl font-extrabold text-[#0B3D2E] mt-1 tabular-nums">
                {activeQueue.length}
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
              <div className="text-xs font-bold text-[#4E6359]">
                {lang === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
              </div>
              <div className="text-3xl font-extrabold text-[#0B3D2E] mt-1 tabular-nums">
                {completedRevenue} {lang === 'ar' ? 'ج.م' : 'EGP'}
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
              <div className="text-xs font-bold text-[#4E6359]">
                {lang === 'ar' ? 'التقييم العام' : 'Kitchen Rating'}
              </div>
              {ratingStats.review_count > 0 ? (
                <div className="text-3xl font-extrabold text-[#13221C] mt-1 tabular-nums flex items-center gap-1.5">
                  <Star className="w-6 h-6 fill-[#F7931E] text-[#F7931E]" />
                  <span>{ratingStats.avg_rating}</span>
                  <span className="text-sm font-semibold text-[#4E6359]">
                    ({ratingStats.review_count})
                  </span>
                </div>
              ) : (
                <div className="mt-1.5">
                  <span className="text-xl font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'جديد' : 'New'}
                  </span>
                  <p className="text-[11px] font-semibold text-[#4E6359] mt-0.5">
                    {lang === 'ar' ? 'بلا تقييمات بعد' : 'No reviews yet'}
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
              <div className="text-xs font-bold text-[#4E6359]">
                {lang === 'ar' ? 'الوجبات المتاحة' : 'Active Meals'}
              </div>
              <div className="text-3xl font-extrabold text-[#0B3D2E] mt-1 tabular-nums">
                {providerMeals.filter((m) => m.is_available).length} / {providerMeals.length}
              </div>
            </div>
          </div>

          <ProviderVisualSummary
            orders={providerOrders}
            lang={lang}
            onNavigateToMeals={() => setTab('meals')}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6">
              <h3 className="text-lg font-extrabold text-[#0B3D2E] mb-4">
                {lang === 'ar' ? 'أحدث الطلبات الواردة' : 'Latest Incoming Orders'}
              </h3>
              {providerOrders.length === 0 ? (
                <p className="text-sm text-[#4E6359] py-4">
                  {lang === 'ar' ? 'ليس لديك أي طلبات حتى الآن.' : 'No orders received yet.'}
                </p>
              ) : (
                providerOrders.slice(0, 5).map((o) => (
                  <div
                    key={o.id}
                    className="py-3 border-b last:border-b-0 border-[#0B3D2E]/10 flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <span className="font-bold text-[#0B3D2E] tabular-nums">{o.order_number}</span>
                      <span className="mx-2 text-[#4E6359]">·</span>
                      <span>{o.student_name}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="font-extrabold">
                        {o.subtotal_amount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#FFF7E6] text-xs font-bold text-[#0B3D2E]">
                        {orderStatusBadge(o.status)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-5 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                  {lang === 'ar' ? 'إحصائيات المبيعات' : 'Sales Statistics'}
                </h3>
                <span className="text-xs font-bold text-[#4E6359] tabular-nums">
                  {deliveredCount} {lang === 'ar' ? 'طلب مكتمل' : 'delivered'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-[#FFF7E6]">
                  <div className="text-[#4E6359]">
                    {lang === 'ar' ? 'طلبات التوصيل' : 'Delivery Orders'}
                  </div>
                  <div className="text-xl font-extrabold text-[#0B3D2E] mt-0.5 tabular-nums">
                    {providerOrders.filter((o) => o.fulfillment_type === 'delivery').length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFF7E6]">
                  <div className="text-[#4E6359]">
                    {lang === 'ar' ? 'استلام من المطبخ' : 'Pickup Orders'}
                  </div>
                  <div className="text-xl font-extrabold text-[#0B3D2E] mt-0.5 tabular-nums">
                    {providerOrders.filter((o) => o.fulfillment_type === 'pickup').length}
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-[#0B3D2E]/10">
                <div className="text-xs font-bold text-[#4E6359]">
                  {lang === 'ar' ? 'الأكثر مبيعاً في مطبخك' : 'Top Selling Meals'}
                </div>
                {mealSalesStats.length === 0 ? (
                  <p className="text-xs text-[#4E6359]">
                    {lang === 'ar' ? 'لا توجد مبيعات مسجلة بعد.' : 'No sales recorded yet.'}
                  </p>
                ) : (
                  mealSalesStats.slice(0, 4).map(({ mealId, mealName, qty, revenue }) => (
                    <div key={mealId} className="flex items-center justify-between text-xs py-1.5">
                      <span className="font-bold text-[#13221C]">
                        {mealName} ({qty}×)
                      </span>
                      <span className="font-extrabold text-[#0B3D2E] tabular-nums">
                        {revenue} {lang === 'ar' ? 'ج.م' : 'EGP'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDERS QUEUE */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {providerOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center">
              <Package className="w-9 h-9 text-[#4E6359] mx-auto mb-2" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'ليس لديك أي طلبات حتى الآن.' : 'No orders received yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', ar: `الكل (${providerOrders.length})`, en: `All (${providerOrders.length})` },
                      {
                        id: 'pending',
                        ar: `جديدة (${providerOrders.filter((o) => o.status === 'pending').length})`,
                        en: `Pending (${providerOrders.filter((o) => o.status === 'pending').length})`,
                      },
                      { id: 'active', ar: 'قيد التنفيذ', en: 'In Progress' },
                      { id: 'delivered', ar: 'مكتملة', en: 'Delivered' },
                      { id: 'cancelled', ar: 'ملغاة/مرفوضة', en: 'Cancelled' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOrdersFilter(item.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        ordersFilter === item.id
                          ? 'bg-[#0B3D2E] text-white'
                          : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
                      }`}
                    >
                      {lang === 'ar' ? item.ar : item.en}
                    </button>
                  ))}
                </div>
                <div className="relative sm:w-60">
                  <Search
                    className={`w-3.5 h-3.5 text-[#4E6359] absolute top-3 ${
                      lang === 'ar' ? 'right-3' : 'left-3'
                    }`}
                  />
                  <input
                    type="text"
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث برقم الطلب أو الطالب...' : 'Search order or student...'}
                    className={`w-full py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                      lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                    }`}
                  />
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-8 text-center text-xs font-bold text-[#4E6359]">
                  {lang === 'ar' ? 'لا توجد طلبات مطابقة للبحث أو الفلتر.' : 'No orders match your filter.'}
                </div>
              ) : (
                <>
                  {paginatedOrders.map((order) => {
                    const nextAction = getNextAction(order.status, order.fulfillment_type);
                    const isBusy = busyOrderId === order.id;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4E6359]">
                            <span className="font-extrabold text-[#0B3D2E] tabular-nums">
                              {order.order_number}
                            </span>
                            <span>·</span>
                            <span className="font-bold text-[#13221C]">{order.student_name}</span>
                            <span>·</span>
                            <span>
                              {order.fulfillment_type === 'delivery'
                                ? order.delivery_location
                                : lang === 'ar'
                                ? 'استلام من المطبخ'
                                : 'Pickup'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[#13221C]">
                            {order.items_summary
                              .map((oi) => `${oi.quantity}× ${oi.meal_name}`)
                              .join(' ، ')}
                          </div>
                          {order.student_notes && (
                            <p className="text-xs text-[#9E3F24] bg-[#E97858]/10 px-3 py-1.5 rounded-lg inline-block">
                              {lang === 'ar' ? 'ملاحظة الطالب: ' : 'Note: '}
                              {order.student_notes}
                            </p>
                          )}
                          {order.delivery_partner_id && (
                            <div className="text-xs font-bold text-[#0B3D2E] inline-flex items-center gap-1.5">
                              <Bike className="w-3.5 h-3.5" />
                              <span>
                                {lang === 'ar' ? 'المندوب:' : 'Partner:'}{' '}
                                {order.delivery_partner_name}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <span className="text-lg font-extrabold text-[#0B3D2E] tabular-nums">
                            {order.subtotal_amount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>

                          {order.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyOrderId(order.id);
                                  try {
                                    await transitionOrderStatus(order.id, 'accepted');
                                  } finally {
                                    setBusyOrderId(null);
                                  }
                                }}
                                className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                              >
                                {isBusy
                                  ? lang === 'ar'
                                    ? 'جاري التنفيذ...'
                                    : 'Updating...'
                                  : lang === 'ar'
                                  ? 'قبول الطلب'
                                  : 'Accept'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setRejectReason('');
                                  setRejectOrderTarget({
                                    id: order.id,
                                    orderNumber: order.order_number,
                                  });
                                }}
                                className="px-4 py-2 rounded-xl bg-[#E97858]/15 text-[#9E3F24] text-xs font-bold disabled:opacity-50 cursor-pointer"
                              >
                                {lang === 'ar' ? 'رفض' : 'Reject'}
                              </button>
                            </>
                          )}

                          {nextAction && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyOrderId(order.id);
                                try {
                                  await transitionOrderStatus(order.id, nextAction.next);
                                } finally {
                                  setBusyOrderId(null);
                                }
                              }}
                              className="px-4 py-2 rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] disabled:opacity-50 cursor-pointer"
                            >
                              {isBusy
                                ? lang === 'ar'
                                  ? 'جاري التحديث...'
                                  : 'Updating...'
                                : lang === 'ar'
                                ? nextAction.ar
                                : nextAction.en}
                            </button>
                          )}

                          <span className="px-3 py-1.5 rounded-xl bg-[#FFF7E6] text-xs font-bold text-[#0B3D2E]">
                            {orderStatusBadge(order.status)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {totalOrdersPages > 1 && (
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <span className="text-xs font-bold text-[#4E6359] tabular-nums">
                        {lang === 'ar'
                          ? `صفحة ${ordersPage} من ${totalOrdersPages}`
                          : `Page ${ordersPage} of ${totalOrdersPages}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={ordersPage <= 1}
                          onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                          className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/15 bg-white text-xs font-bold text-[#0B3D2E] disabled:opacity-45 cursor-pointer"
                        >
                          {lang === 'ar' ? 'السابق' : 'Prev'}
                        </button>
                        <button
                          type="button"
                          disabled={ordersPage >= totalOrdersPages}
                          onClick={() => setOrdersPage((p) => Math.min(totalOrdersPages, p + 1))}
                          className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/15 bg-white text-xs font-bold text-[#0B3D2E] disabled:opacity-45 cursor-pointer"
                        >
                          {lang === 'ar' ? 'التالي' : 'Next'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* MY MEALS CRUD */}
      {tab === 'meals' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'قائمة وجبات المطبخ' : 'Kitchen Menu'}
            </h2>
            <button
              type="button"
              onClick={() => openMealForm()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة وجبة جديدة' : 'Add Meal'}</span>
            </button>
          </div>

          {providerMeals.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', ar: `الكل (${providerMeals.length})`, en: `All (${providerMeals.length})` },
                    {
                      id: 'available',
                      ar: `متاح (${providerMeals.filter((m) => m.is_available).length})`,
                      en: `Available (${providerMeals.filter((m) => m.is_available).length})`,
                    },
                    {
                      id: 'hidden',
                      ar: `مخفي (${providerMeals.filter((m) => !m.is_available).length})`,
                      en: `Hidden (${providerMeals.filter((m) => !m.is_available).length})`,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMealsFilter(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      mealsFilter === item.id
                        ? 'bg-[#0B3D2E] text-white'
                        : 'bg-[#FFF7E6] text-[#13221C]'
                    }`}
                  >
                    {lang === 'ar' ? item.ar : item.en}
                  </button>
                ))}
              </div>
              <div className="relative sm:w-64">
                <Search
                  className={`w-3.5 h-3.5 text-[#4E6359] absolute top-3 ${
                    lang === 'ar' ? 'right-3' : 'left-3'
                  }`}
                />
                <input
                  type="text"
                  value={mealsSearch}
                  onChange={(e) => setMealsSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث في وجباتك...' : 'Search your meals...'}
                  className={`w-full py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                    lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                  }`}
                />
              </div>
            </div>
          )}

          {providerMeals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
              <UtensilsCrossed className="w-9 h-9 text-[#4E6359] mx-auto" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'لا توجد وجبات مضافة حتى الآن.' : 'No meals created yet.'}
              </p>
              <button
                type="button"
                onClick={() => openMealForm()}
                className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إضافة أول وجبة' : 'Add Your First Meal'}
              </button>
            </div>
          ) : filteredMeals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-8 text-center text-xs font-bold text-[#4E6359]">
              {lang === 'ar' ? 'لا توجد وجبات مطابقة للبحث.' : 'No meals match your search.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedMeals.map((meal) => {
                  const cat = mealCategories.find((c) => c.id === meal.category_id);
                  const isToggling = togglingMealId === meal.id;
                  return (
                    <div
                      key={meal.id}
                      className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <MealArtwork
                          slug={meal.image_url}
                          alt={lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                          lang={lang}
                          className="w-full h-36"
                        />
                        <div className="p-4">
                          <div className="flex items-center justify-between text-xs text-[#4E6359]">
                            <span>{cat ? (lang === 'ar' ? cat.name_ar : cat.name_en) : ''}</span>
                            <span className="font-extrabold text-[#0B3D2E] tabular-nums">
                              {meal.price} {lang === 'ar' ? 'ج.م' : 'EGP'}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-base text-[#13221C] mt-1">
                            {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                          </h3>
                          <p className="text-xs text-[#4E6359] mt-1 line-clamp-2">{meal.description}</p>
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-[#FFF7E6]/60 border-t border-[#0B3D2E]/10 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={async () => {
                            setTogglingMealId(meal.id);
                            try {
                              await toggleMealAvailability(meal.id);
                            } finally {
                              setTogglingMealId(null);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer ${
                            meal.is_available
                              ? 'bg-[#0B3D2E] text-white'
                              : 'bg-[#13221C]/10 text-[#4E6359]'
                          }`}
                        >
                          {isToggling
                            ? '...'
                            : meal.is_available
                            ? lang === 'ar'
                              ? 'متاح'
                              : 'Available'
                            : lang === 'ar'
                            ? 'غير متاح'
                            : 'Hidden'}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMealForm(meal)}
                            aria-label={lang === 'ar' ? 'تعديل الوجبة' : 'Edit meal'}
                            className="p-2 rounded-xl border border-[#0B3D2E]/15 text-[#0B3D2E] hover:bg-[#0B3D2E]/10 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteMealTarget(meal)}
                            aria-label={lang === 'ar' ? 'حذف الوجبة' : 'Delete meal'}
                            className="p-2 rounded-xl border border-[#E97858]/30 text-[#E97858] hover:bg-[#E97858]/10 cursor-pointer"
                            title={lang === 'ar' ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalMealsPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-xs font-bold text-[#4E6359] tabular-nums">
                    {lang === 'ar'
                      ? `صفحة ${mealsPage} من ${totalMealsPages}`
                      : `Page ${mealsPage} of ${totalMealsPages}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={mealsPage <= 1}
                      onClick={() => setMealsPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/15 bg-white text-xs font-bold text-[#0B3D2E] disabled:opacity-45 cursor-pointer"
                    >
                      {lang === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={mealsPage >= totalMealsPages}
                      onClick={() => setMealsPage((p) => Math.min(totalMealsPages, p + 1))}
                      className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/15 bg-white text-xs font-bold text-[#0B3D2E] disabled:opacity-45 cursor-pointer"
                    >
                      {lang === 'ar' ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* REVIEWS */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          {providerReviews.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center">
              <Star className="w-9 h-9 text-[#4E6359] mx-auto mb-2" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'لا توجد تقييمات حتى الآن.' : 'No reviews yet.'}
              </p>
            </div>
          ) : (
            <>
              {paginatedReviews.map((rev) => {
                const isReplying = replyingReviewId === rev.id;
                return (
                  <div key={rev.id} className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 font-extrabold text-[#0B3D2E] tabular-nums">
                        <Star className="w-4 h-4 fill-[#F7931E] text-[#F7931E]" />
                        <span>{rev.rating} / 5</span>
                      </div>
                      <span className="text-xs text-[#4E6359]">#{rev.order_id.slice(0, 8)}</span>
                    </div>
                    <p className="text-sm text-[#13221C]">{rev.comment}</p>
                    {rev.provider_response ? (
                      <div className="mt-3 p-3 rounded-xl bg-[#FFF7E6] text-xs font-semibold text-[#0B3D2E]">
                        {lang === 'ar' ? 'ردك: ' : 'Your reply: '}
                        {rev.provider_response}
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={replyDrafts[rev.id] || ''}
                          onChange={(e) => setReplyDrafts((p) => ({ ...p, [rev.id]: e.target.value }))}
                          placeholder={lang === 'ar' ? 'اكتب رداً للطالب...' : 'Write a reply...'}
                          className="flex-1 px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-xs"
                        />
                        <button
                          type="button"
                          disabled={isReplying}
                          onClick={async () => {
                            const draft = (replyDrafts[rev.id] || '').trim();
                            if (!draft) {
                              pushToast(
                                lang === 'ar' ? 'يرجى كتابة نص الرد أولاً' : 'Please enter a reply first',
                                'error'
                              );
                              return;
                            }
                            setReplyingReviewId(rev.id);
                            try {
                              await replyToReview(rev.id, draft);
                            } finally {
                              setReplyingReviewId(null);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {isReplying
                            ? lang === 'ar'
                              ? 'جاري الإرسال...'
                              : 'Sending...'
                            : lang === 'ar'
                            ? 'رد'
                            : 'Reply'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {totalReviewsPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-xs font-bold text-[#4E6359] tabular-nums">
                    {lang === 'ar'
                      ? `صفحة ${reviewsPage} من ${totalReviewsPages}`
                      : `Page ${reviewsPage} of ${totalReviewsPages}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reviewsPage <= 1}
                      onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/15 bg-white text-xs font-bold text-[#0B3D2E] disabled:opacity-45 cursor-pointer"
                    >
                      {lang === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={reviewsPage >= totalReviewsPages}
                      onClick={() => setReviewsPage((p) => Math.min(totalReviewsPages, p + 1))}
                      className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/15 bg-white text-xs font-bold text-[#0B3D2E] disabled:opacity-45 cursor-pointer"
                    >
                      {lang === 'ar' ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PROFILE */}
      {tab === 'profile' && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 max-w-2xl space-y-4">
          <h2 className="text-xl font-extrabold text-[#0B3D2E]">
            {lang === 'ar' ? 'بيانات المطبخ' : 'Kitchen Profile'}
          </h2>
          <div>
            <label className="block text-xs font-bold mb-1">
              {lang === 'ar' ? 'اسم المطبخ *' : 'Business Name *'}
            </label>
            <input
              type="text"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">{lang === 'ar' ? 'نبذة عن المطبخ' : 'Bio'}</label>
            <textarea
              rows={3}
              value={pBio}
              onChange={(e) => setPBio(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">{lang === 'ar' ? 'المنطقة *' : 'Area *'}</label>
              <input
                type="text"
                value={pArea}
                onChange={(e) => setPArea(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'عنوان الاستلام *' : 'Pickup Address *'}
              </label>
              <input
                type="text"
                value={pAddress}
                onChange={(e) => setPAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={savingProfile}
            onClick={async () => {
              if (!pName.trim() || !pArea.trim() || !pAddress.trim()) {
                pushToast(
                  lang === 'ar'
                    ? 'يرجى إكمال اسم المطبخ والمنطقة وعنوان الاستلام'
                    : 'Please fill kitchen name, area, and pickup address',
                  'error'
                );
                return;
              }
              setSavingProfile(true);
              try {
                await registerOrUpdateProviderProfile({
                  business_name: pName,
                  bio: pBio,
                  area: pArea,
                  pickup_address: pAddress,
                  university_id: pUniId,
                });
              } finally {
                setSavingProfile(false);
              }
            }}
            className="px-6 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {savingProfile
              ? lang === 'ar'
                ? 'جاري الحفظ...'
                : 'Saving...'
              : lang === 'ar'
              ? 'حفظ التغييرات'
              : 'Save Profile'}
          </button>
        </div>
      )}

      {/* ADD / EDIT MEAL MODAL */}
      {mealModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                {editingMealId
                  ? lang === 'ar'
                    ? 'تعديل بيانات الوجبة'
                    : 'Edit Meal'
                  : lang === 'ar'
                  ? 'إضافة وجبة بيتي جديدة'
                  : 'Add Homemade Meal'}
              </h3>
              <button
                type="button"
                onClick={() => setMealModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#FFF7E6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Real Image Upload or Neutral Placeholder */}
            <div className="p-4 rounded-2xl bg-[#FFF7E6]/80 border border-[#0B3D2E]/12 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-[#0B3D2E]">
                  {lang === 'ar' ? 'صورة الوجبة (اختياري)' : 'Meal Image (optional)'}
                </span>
                <div className="flex items-center gap-2">
                  {mImageUrl && (
                    <button
                      type="button"
                      onClick={() => setMImageUrl('')}
                      className="text-xs font-bold text-[#E97858] hover:underline cursor-pointer"
                    >
                      {lang === 'ar' ? 'إزالة الصورة' : 'Remove'}
                    </button>
                  )}
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'رفع صورة حقيقية' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="w-full h-36 rounded-2xl overflow-hidden border border-[#0B3D2E]/15">
                <MealArtwork slug={mImageUrl} alt={mName || 'Meal'} lang={lang} className="w-full h-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'الاسم بالعربية *' : 'Arabic Name'}
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={mNameAr}
                  onChange={(e) => setMNameAr(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'الاسم بالإنجليزية' : 'English Name *'}
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'التصنيف' : 'Category'}
                </label>
                <select
                  value={mCategory}
                  onChange={(e) => setMCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-xs"
                >
                  <option value="">{lang === 'ar' ? 'عام' : 'General'}</option>
                  {mealCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'ar' ? c.name_ar : c.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'السعر (ج.م) *' : 'Price (EGP) *'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={mPrice || ''}
                  onChange={(e) => setMPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'التحضير (د)' : 'Prep (min)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={mPrep}
                  onChange={(e) => setMPrep(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'حجم الحصة' : 'Portion Size'}
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={mPortion}
                  onChange={(e) => setMPortion(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: وجبة فردية 400 جم' : 'e.g. Single serving 400g'}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {lang === 'ar' ? 'المكونات' : 'Ingredients'}
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={mIngredientsText}
                  onChange={(e) => setMIngredientsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                {lang === 'ar' ? 'وصف الوجبة' : 'Description'}
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Kcal', val: mCalories, set: setMCalories },
                { label: 'Protein', val: mProtein, set: setMProtein },
                { label: 'Carbs', val: mCarbs, set: setMCarbs },
                { label: 'Fat', val: mFat, set: setMFat },
                { label: 'Fiber', val: mFiber, set: setMFiber },
              ].map((nut) => (
                <div key={nut.label}>
                  <label className="block text-[11px] font-bold mb-1">{nut.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={nut.val}
                    onChange={(e) => nut.set(e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-1.5 rounded-lg bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-xs tabular-nums"
                  />
                </div>
              ))}
            </div>

            {allergens.length > 0 && (
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  {lang === 'ar' ? 'مسببات الحساسية' : 'Allergens'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allergens.map((a) => {
                    const sel = mAllergens.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setMAllergens((p) => (sel ? p.filter((x) => x !== a.id) : [...p, a.id]))
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                          sel ? 'bg-[#E97858] text-white' : 'bg-[#FFF7E6] text-[#13221C]'
                        }`}
                      >
                        {lang === 'ar' ? a.name_ar : a.name_en}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {dietaryPreferences.length > 0 && (
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  {lang === 'ar' ? 'الخصائص الغذائية' : 'Dietary Tags'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {dietaryPreferences.map((d) => {
                    const sel = mDietary.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setMDietary((p) => (sel ? p.filter((x) => x !== d.id) : [...p, d.id]))
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                          sel ? 'bg-[#0B3D2E] text-white' : 'bg-[#FFF7E6] text-[#13221C]'
                        }`}
                      >
                        {lang === 'ar' ? d.name_ar : d.name_en}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={savingMeal}
              onClick={async () => {
                if ((!mName.trim() && !mNameAr.trim()) || !mPrice || mPrice <= 0) {
                  pushToast(
                    lang === 'ar'
                      ? 'يرجى إدخال اسم الوجبة وسعر صحيح أكبر من 0'
                      : 'Enter meal name and valid price > 0',
                    'error'
                  );
                  return;
                }
                setSavingMeal(true);
                try {
                  const ok = await saveMeal({
                    id: editingMealId,
                    category_id: mCategory || mealCategories[0]?.id || '',
                    name: mName.trim() || mNameAr.trim(),
                    name_ar: mNameAr.trim() || mName.trim(),
                    description: mDesc,
                    price: mPrice,
                    portion_description: mPortion || 'وجبة فردية',
                    prep_time_minutes: mPrep || 20,
                    is_available: true,
                    image_url: mImageUrl,
                    ingredients_text: mIngredientsText || undefined,
                    calories_kcal: mCalories !== '' ? Number(mCalories) : undefined,
                    protein_g: mProtein !== '' ? Number(mProtein) : undefined,
                    carbs_g: mCarbs !== '' ? Number(mCarbs) : undefined,
                    fat_g: mFat !== '' ? Number(mFat) : undefined,
                    fiber_g: mFiber !== '' ? Number(mFiber) : undefined,
                    allergen_ids: mAllergens,
                    dietary_pref_ids: mDietary,
                  });
                  if (ok) setMealModalOpen(false);
                } finally {
                  setSavingMeal(false);
                }
              }}
              className="w-full py-3 rounded-xl bg-[#0B3D2E] text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
            >
              {savingMeal
                ? lang === 'ar'
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : lang === 'ar'
                ? 'حفظ الوجبة'
                : 'Save Meal'}
            </button>
          </div>
        </div>
      )}

      {/* Reject Order Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(rejectOrderTarget)}
        lang={lang}
        tone="danger"
        busy={Boolean(rejectOrderTarget && busyOrderId === rejectOrderTarget.id)}
        title={
          lang === 'ar'
            ? `رفض الطلب ${rejectOrderTarget?.orderNumber || ''}`
            : `Reject Order ${rejectOrderTarget?.orderNumber || ''}`
        }
        description={
          lang === 'ar'
            ? 'سيتم إشعار الطالب برفض الطلب وإغلاقه. يمكنك توضيح سبب الرفض أدناه:'
            : 'The student will be notified that this order was rejected. You may add an optional reason below:'
        }
        confirmLabel={lang === 'ar' ? 'تأكيد الرفض' : 'Confirm Rejection'}
        cancelLabel={lang === 'ar' ? 'تراجع' : 'Keep Order'}
        onCancel={() => {
          setRejectOrderTarget(null);
          setRejectReason('');
        }}
        onConfirm={async () => {
          if (!rejectOrderTarget) return;
          setBusyOrderId(rejectOrderTarget.id);
          try {
            await transitionOrderStatus(
              rejectOrderTarget.id,
              'rejected',
              rejectReason.trim() ||
                (lang === 'ar' ? 'المطبخ غير متاح حالياً' : 'Kitchen currently unavailable')
            );
            setRejectOrderTarget(null);
            setRejectReason('');
          } finally {
            setBusyOrderId(null);
          }
        }}
      >
        <input
          type="text"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={
            lang === 'ar'
              ? 'سبب الرفض (اختياري، مثال: نفدت المكونات اليوم)'
              : 'Reason (optional, e.g. Ingredients sold out)'
          }
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/20 text-xs text-[#13221C]"
        />
      </ConfirmDialog>

      {/* Safe Delete Meal Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteMealTarget)}
        lang={lang}
        tone="danger"
        busy={deletingMeal}
        title={
          lang === 'ar'
            ? `حذف وجبة "${deleteMealTarget?.name_ar || deleteMealTarget?.name || ''}"`
            : `Delete "${deleteMealTarget?.name || ''}"`
        }
        description={
          lang === 'ar'
            ? 'هل أنت متأكد من حذف هذه الوجبة؟ لن يتم الحذف إذا كانت مرتبطة بطلبات نشطة حالياً، وإذا كانت مرتبطة بطلبات سابقة مكتملة فسيتم أرشفتها بأمان.'
            : 'Are you sure you want to delete this meal? Meals tied to active orders cannot be deleted; meals with completed order history will be safely archived.'
        }
        confirmLabel={lang === 'ar' ? 'حذف الوجبة' : 'Delete Meal'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onCancel={() => setDeleteMealTarget(null)}
        onConfirm={async () => {
          if (!deleteMealTarget) return;
          setDeletingMeal(true);
          try {
            const res = await deleteMealSafely(deleteMealTarget.id);
            if (!res.ok && res.reason === 'active_orders') {
              pushToast(
                lang === 'ar'
                  ? `لا يمكن حذف الوجبة لوجود ${res.activeOrdersCount || 1} طلبات نشطة مرتبطة بها. يمكنك إخفاؤها مؤقتاً بدلاً من ذلك.`
                  : `Cannot delete meal because it has ${res.activeOrdersCount || 1} active order(s). You can hide it instead.`,
                'error'
              );
            }
            setDeleteMealTarget(null);
          } finally {
            setDeletingMeal(false);
          }
        }}
      />
    </div>
  );
};
