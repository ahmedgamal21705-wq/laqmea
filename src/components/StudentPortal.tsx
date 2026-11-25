import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  Filter,
  LogIn,
  MessageSquareWarning,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';
import { FulfillmentType, Meal, OrderStatus } from '../types/database';
import {
  getPerMealBudget,
  getProviderRatingStats,
  runBudgetRecommendations,
} from '../utils/recommendation';
import { MealArtwork } from './MealArtwork';
import { ConfirmDialog } from './ConfirmDialog';

export type StudentTab = 'discover' | 'orders' | 'cart' | 'profile';
export interface StudentLaunchOptions {
  tab: StudentTab;
  mealId?: string;
  categoryId?: string;
  maxPrice?: number;
}
type MealSort = 'default' | 'price_asc' | 'price_desc' | 'prep_asc';
type OrderFilterTab = 'all' | 'active' | 'delivered' | 'cancelled';

const MEALS_PAGE_SIZE = 9;
const ORDERS_PAGE_SIZE = 6;

export const StudentPortal: React.FC<{
  initialTab?: StudentTab;
  openTabSignal?: number;
  openCartSignal?: number;
  launchMealId?: string | null;
  launchCategoryId?: string | null;
  launchMaxPrice?: number | null;
}> = ({
  initialTab = 'discover',
  openTabSignal = 0,
  openCartSignal = 0,
  launchMealId = null,
  launchCategoryId = null,
  launchMaxPrice = null,
}) => {
  const {
    lang,
    universities,
    mealCategories,
    allergens,
    dietaryPreferences,
    providerProfiles,
    myStudentProfile,
    myDeliveryPartnerProfile,
    meals,
    orders,
    reviews,
    deliveryPricingConfig,
    cart,
    recommendationFeedback,
    setRecommendationFeedbackItem,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    placeOrder,
    transitionOrderStatus,
    submitReview,
    fileComplaint,
    updateStudentSettings,
    setView,
  } = useLokma();

  const { firebaseUser, userDoc, needsEmailVerification, setReturnTarget } = useFirebaseAuth();

  const [tab, setTab] = useState<StudentTab>(initialTab);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedDietaryId, setSelectedDietaryId] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(300);
  const [priceManuallyAdjusted, setPriceManuallyAdjusted] = useState(false);
  const [sortBy, setSortBy] = useState<MealSort>('default');
  const [hideMyAllergens, setHideMyAllergens] = useState<boolean>(true);
  const [mealsPage, setMealsPage] = useState<number>(1);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [detailQty, setDetailQty] = useState<number>(1);
  const [conflictModal, setConflictModal] = useState<{
    mealId: string;
    qty: number;
    providerName: string;
  } | null>(null);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('delivery');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryLocationError, setDeliveryLocationError] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrderBanner, setConfirmedOrderBanner] = useState<{
    orderNumber: string;
    orderId: string;
  } | null>(null);

  const [orderFilter, setOrderFilter] = useState<OrderFilterTab>('all');
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const [cancelOrderConfirmId, setCancelOrderConfirmId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Review & Complaint modals
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [deliveryComment, setDeliveryComment] = useState('');

  const [complaintOrder, setComplaintOrder] = useState<{
    orderId: string;
    againstUserId: string;
  } | null>(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');

  // Profile form state
  const [formDailyBudget, setFormDailyBudget] = useState<number>(0);
  const [formWeeklyBudget, setFormWeeklyBudget] = useState<number>(0);
  const [formLocation, setFormLocation] = useState('');
  const [formFaculty, setFormFaculty] = useState('');
  const [formUniId, setFormUniId] = useState('');
  const [editAllergens, setEditAllergens] = useState<string[]>([]);
  const [editDietary, setEditDietary] = useState<string[]>([]);
  const [editCatPrefs, setEditCatPrefs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (myStudentProfile) {
      setFormDailyBudget(myStudentProfile.daily_budget || 0);
      setFormWeeklyBudget(myStudentProfile.weekly_budget || 0);
      setFormLocation(myStudentProfile.delivery_location || '');
      setDeliveryLocation(myStudentProfile.delivery_location || '');
      setFormFaculty(myStudentProfile.faculty || '');
      setFormUniId(myStudentProfile.university_id || '');
      setEditAllergens(myStudentProfile.allergen_ids || []);
      setEditDietary(myStudentProfile.dietary_pref_ids || []);
      setEditCatPrefs(myStudentProfile.category_prefs || {});
    } else {
      setFormDailyBudget(0);
      setFormWeeklyBudget(0);
      setFormLocation('');
      setDeliveryLocation('');
      setFormFaculty('');
      setFormUniId('');
      setEditAllergens([]);
      setEditDietary([]);
      setEditCatPrefs({});
    }
  }, [myStudentProfile]);

  const studentAllergenIds = useMemo(
    () => myStudentProfile?.allergen_ids ?? [],
    [myStudentProfile]
  );

  const perMealBudget = getPerMealBudget(
    myStudentProfile?.daily_budget ?? 0,
    myStudentProfile?.weekly_budget ?? 0
  );

  const liveRecommendations = useMemo(
    () =>
      runBudgetRecommendations({
        meals,
        providers: providerProfiles,
        reviews,
        orders,
        dietaryPreferences,
        studentProfile: myStudentProfile,
        lang,
        feedbackMap: recommendationFeedback,
      }).items,
    [
      meals,
      providerProfiles,
      reviews,
      orders,
      dietaryPreferences,
      myStudentProfile,
      lang,
      recommendationFeedback,
    ]
  );

  const eligibleMeals = useMemo(() => {
    return meals.filter((meal) => {
      if (!meal.is_available || meal.deleted_at !== null) return false;
      const prov = providerProfiles.find((p) => p.user_id === meal.provider_id);
      return prov?.verification_status === 'verified' && prov.is_accepting_orders;
    });
  }, [meals, providerProfiles]);

  const priceCeiling = useMemo(() => {
    if (eligibleMeals.length === 0) return 300;
    const highest = Math.max(...eligibleMeals.map((m) => Number(m.price || 0)));
    return Math.max(150, Math.ceil(highest / 10) * 10);
  }, [eligibleMeals]);

  useEffect(() => {
    if (!priceManuallyAdjusted && launchMaxPrice === null) {
      setMaxPrice(priceCeiling);
    }
  }, [priceCeiling, priceManuallyAdjusted, launchMaxPrice]);

  useEffect(() => {
    if (openTabSignal > 0) {
      setTab(initialTab);
      if (launchCategoryId) {
        setSelectedCategoryId(launchCategoryId);
      }
      if (launchMaxPrice !== null && launchMaxPrice > 0) {
        setMaxPrice(launchMaxPrice);
        setPriceManuallyAdjusted(true);
      }
      if (launchMealId) {
        const found = meals.find((m) => m.id === launchMealId);
        if (found) {
          setDetailQty(1);
          setSelectedMeal(found);
        }
      }
    }
  }, [
    initialTab,
    openTabSignal,
    launchCategoryId,
    launchMaxPrice,
    launchMealId,
    meals,
  ]);

  useEffect(() => {
    if (openCartSignal > 0) {
      setTab('cart');
    }
  }, [openCartSignal]);

  const filteredMeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = eligibleMeals.filter((meal) => {
      if (meal.price > maxPrice) return false;
      if (selectedCategoryId !== 'all' && meal.category_id !== selectedCategoryId) return false;
      if (selectedDietaryId !== 'all' && !meal.dietary_pref_ids.includes(selectedDietaryId)) {
        return false;
      }
      if (hideMyAllergens && studentAllergenIds.length > 0) {
        if (meal.allergen_ids.some((aid) => studentAllergenIds.includes(aid))) return false;
      }
      if (q) {
        const prov = providerProfiles.find((p) => p.user_id === meal.provider_id);
        const text = `${meal.name} ${meal.name_ar || ''} ${meal.description} ${
          prov?.business_name || meal.provider_name || ''
        }`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'prep_asc') {
      return [...list].sort((a, b) => a.prep_time_minutes - b.prep_time_minutes);
    }
    return list;
  }, [
    eligibleMeals,
    providerProfiles,
    searchQuery,
    maxPrice,
    selectedCategoryId,
    selectedDietaryId,
    hideMyAllergens,
    studentAllergenIds,
    sortBy,
  ]);

  useEffect(() => {
    setMealsPage(1);
  }, [searchQuery, maxPrice, selectedCategoryId, selectedDietaryId, hideMyAllergens, sortBy]);

  const totalMealsPages = Math.max(1, Math.ceil(filteredMeals.length / MEALS_PAGE_SIZE));
  const paginatedMeals = useMemo(() => {
    const safePage = Math.min(mealsPage, totalMealsPages);
    const start = (safePage - 1) * MEALS_PAGE_SIZE;
    return filteredMeals.slice(start, start + MEALS_PAGE_SIZE);
  }, [filteredMeals, mealsPage, totalMealsPages]);

  const myOrders = useMemo(() => {
    if (!firebaseUser) return [];
    return orders
      .filter((o) => o.student_id === firebaseUser.uid)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [orders, firebaseUser]);

  const filteredMyOrders = useMemo(() => {
    if (orderFilter === 'all') return myOrders;
    if (orderFilter === 'active') {
      return myOrders.filter((o) => !['delivered', 'cancelled', 'rejected'].includes(o.status));
    }
    if (orderFilter === 'delivered') {
      return myOrders.filter((o) => o.status === 'delivered');
    }
    return myOrders.filter((o) => o.status === 'cancelled' || o.status === 'rejected');
  }, [myOrders, orderFilter]);

  useEffect(() => {
    setOrdersPage(1);
  }, [orderFilter]);

  const totalOrdersPages = Math.max(1, Math.ceil(filteredMyOrders.length / ORDERS_PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(ordersPage, totalOrdersPages);
    const start = (safePage - 1) * ORDERS_PAGE_SIZE;
    return filteredMyOrders.slice(start, start + ORDERS_PAGE_SIZE);
  }, [filteredMyOrders, ordersPage, totalOrdersPages]);

  const monthlySpending = useMemo(() => {
    const validOrders = myOrders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'rejected'
    );
    const total = validOrders.reduce((acc, o) => acc + o.total_amount, 0);
    return {
      total,
      count: validOrders.length,
      monthlyBudget: (myStudentProfile?.daily_budget ?? 0) * 30,
    };
  }, [myOrders, myStudentProfile]);

  const goToLogin = () => {
    setReturnTarget({ view: 'student', eventId: null });
    window.history.pushState({}, '', '/login');
    setView('auth');
  };

  const openMealDetails = (meal: Meal) => {
    setDetailQty(1);
    setSelectedMeal(meal);
  };

  const handleAddMealToCart = (mealId: string, qty = 1) => {
    const res = addToCart(mealId, qty, '');
    if (!res.ok && res.conflictProviderName) {
      setConflictModal({ mealId, qty, providerName: res.conflictProviderName });
    }
  };

  const cartSubtotal = Number(
    cart
      .reduce((sum, item) => {
        const m = meals.find((x) => x.id === item.meal_id);
        return sum + (m ? m.price * item.quantity : 0);
      }, 0)
      .toFixed(2)
  );
  const configuredDeliveryFee = deliveryPricingConfig.customer_delivery_fee;
  const deliveryFee =
    fulfillmentType === 'delivery' && cart.length > 0 ? configuredDeliveryFee : 0;
  const cartTotal = Number((cartSubtotal + deliveryFee).toFixed(2));

  const cartProvider = useMemo(() => {
    if (cart.length === 0) return null;
    const m = meals.find((x) => x.id === cart[0].meal_id);
    if (!m) return null;
    return providerProfiles.find((p) => p.user_id === m.provider_id) ?? null;
  }, [cart, meals, providerProfiles]);

  const statusLabel = (s: OrderStatus) => {
    const map: Record<OrderStatus, { ar: string; en: string; cls: string }> = {
      pending: { ar: 'في انتظار موافقة المطبخ', en: 'Pending', cls: 'bg-[#F7931E]/20 text-[#8A5A00]' },
      accepted: { ar: 'تم القبول', en: 'Accepted', cls: 'bg-[#0B3D2E]/12 text-[#0B3D2E]' },
      rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-[#E97858]/18 text-[#9E3F24]' },
      preparing: { ar: 'جاري التحضير', en: 'Preparing', cls: 'bg-[#F7931E]/25 text-[#7A4F00]' },
      ready_for_pickup: { ar: 'جاهز للاستلام', en: 'Ready for Pickup', cls: 'bg-[#0B3D2E]/18 text-[#0B3D2E]' },
      assigned: { ar: 'تم تعيين طالب توصيل', en: 'Partner Assigned', cls: 'bg-[#0B3D2E]/18 text-[#0B3D2E]' },
      picked_up: { ar: 'تم الاستلام من المطبخ', en: 'Picked Up', cls: 'bg-[#F7931E]/25 text-[#7A4F00]' },
      out_for_delivery: { ar: 'في الطريق للتوصيل', en: 'Out for Delivery', cls: 'bg-[#E97858]/20 text-[#9E3F24]' },
      delivered: { ar: 'تم التوصيل', en: 'Delivered', cls: 'bg-[#0B3D2E] text-white' },
      cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-[#13221C]/10 text-[#4E6359]' },
    };
    const item = map[s];
    return { text: lang === 'ar' ? item.ar : item.en, cls: item.cls };
  };

  const displayStudentName =
    userDoc?.full_name || firebaseUser?.displayName || firebaseUser?.email || '';

  const monthlyRemaining = Math.max(
    0,
    monthlySpending.monthlyBudget - monthlySpending.total
  );
  const monthlyProgressPct =
    monthlySpending.monthlyBudget > 0
      ? Math.min(100, Math.round((monthlySpending.total / monthlySpending.monthlyBudget) * 100))
      : 0;

  return (
    <div
      className={`max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 ${
        cart.length > 0 && tab !== 'cart' ? 'pb-24 md:pb-10' : 'pb-10'
      }`}
    >
      {/* Student Header */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4E6359]">
            <span className="font-bold text-[#0B3D2E]">
              {lang === 'ar' ? 'بوابة الطالب' : 'Student Portal'}
            </span>
            {myStudentProfile?.faculty && (
              <>
                <span aria-hidden="true">·</span>
                <span>{myStudentProfile.faculty}</span>
              </>
            )}
            {perMealBudget > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums font-semibold text-[#13221C]">
                  {lang === 'ar'
                    ? `ميزانية الوجبة: ${perMealBudget} ج.م`
                    : `Per-Meal Budget: ${perMealBudget} EGP`}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#13221C] mt-1">
            {firebaseUser
              ? lang === 'ar'
                ? `أهلاً ${displayStudentName}، وجبتك البيتي على قد جيبك`
                : `Welcome, ${displayStudentName} — Homemade Meals Within Budget`
              : lang === 'ar'
              ? 'اكتشف وجبات بيتي طازجة على قد ميزانيتك'
              : 'Discover Homemade Meals Within Your Budget'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!firebaseUser ? (
            <button
              type="button"
              onClick={goToLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تسجيل الدخول للطلب' : 'Sign In to Order'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/delivery');
                setView('delivery');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] transition-colors cursor-pointer"
            >
              <Bike className="w-4 h-4" />
              <span>
                {myDeliveryPartnerProfile?.verification_status === 'verified'
                  ? lang === 'ar'
                    ? 'وضع شريك التوصيل'
                    : 'Delivery Partner Mode'
                  : lang === 'ar'
                  ? 'أوصل واكسب دخل إضافي'
                  : 'Become a Delivery Partner'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Portal Sub-navigation Tabs */}
      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <div className="inline-flex gap-1.5 p-1.5 bg-white border border-[#0B3D2E]/12 rounded-2xl min-w-max">
          {[
            { id: 'discover' as const, ar: 'اكتشف الوجبات', en: 'Discover Meals', icon: Sparkles },
            {
              id: 'cart' as const,
              ar: `السلة (${cart.reduce((s, c) => s + c.quantity, 0)})`,
              en: `Cart (${cart.reduce((s, c) => s + c.quantity, 0)})`,
              icon: ShoppingBag,
            },
            {
              id: 'orders' as const,
              ar: `طلباتي (${myOrders.length})`,
              en: `My Orders (${myOrders.length})`,
              icon: Package,
            },
            { id: 'profile' as const, ar: 'الميزانية والحساب', en: 'Budget & Profile', icon: Wallet },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0B3D2E] text-white'
                    : 'text-[#13221C]/80 hover:bg-[#FFF7E6]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? t.ar : t.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: DISCOVER & BUDGET RECOMMENDATIONS */}
      {tab === 'discover' && (
        <div className="space-y-8">
          {/* Compact Budget Companion Bar */}
          <section className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
            {firebaseUser && monthlySpending.monthlyBudget > 0 ? (
              <>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-[#0B3D2E]">
                      <Wallet className="w-4 h-4 text-[#E97858]" />
                      {lang === 'ar' ? 'مخطط ميزانيتك' : 'Your Budget Planner'}
                    </span>
                    <span className="text-[#4E6359] tabular-nums">
                      {lang === 'ar'
                        ? `تم إنفاق ${monthlySpending.total} ج.م · المتبقي ${monthlyRemaining} ج.م من ${monthlySpending.monthlyBudget} ج.م`
                        : `Spent ${monthlySpending.total} EGP · ${monthlyRemaining} EGP remaining of ${monthlySpending.monthlyBudget} EGP`}
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#FFF7E6] border border-[#0B3D2E]/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        monthlyProgressPct >= 90 ? 'bg-[#E97858]' : 'bg-[#0B3D2E]'
                      }`}
                      style={{ width: `${monthlyProgressPct}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {perMealBudget > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (maxPrice === perMealBudget) {
                          setMaxPrice(priceCeiling);
                          setPriceManuallyAdjusted(false);
                        } else {
                          setMaxPrice(Math.max(20, perMealBudget));
                          setPriceManuallyAdjusted(true);
                        }
                      }}
                      className={`px-4 min-h-[42px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        maxPrice === perMealBudget
                          ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                          : 'bg-[#FFF7E6] text-[#0B3D2E] border-[#0B3D2E]/20 hover:bg-[#F7931E]/20'
                      }`}
                    >
                      {lang === 'ar'
                        ? maxPrice === perMealBudget
                          ? 'إظهار كل الأسعار'
                          : `ضمن ميزانية الوجبة (${perMealBudget} ج.م)`
                        : maxPrice === perMealBudget
                        ? 'Show All Prices'
                        : `Within Meal Budget (${perMealBudget} EGP)`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTab('profile')}
                    className="px-4 min-h-[42px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#13221C] text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'تعديل الميزانية' : 'Edit Budget'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#F7931E]/22 text-[#8A5A00] flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-[#0B3D2E]">
                      {lang === 'ar'
                        ? 'فعّل مخطط ميزانيتك الشخصية'
                        : 'Activate Your Food Budget Planner'}
                    </div>
                    <p className="text-xs text-[#4E6359] mt-0.5">
                      {lang === 'ar'
                        ? 'حدّد ميزانيتك اليومية والأسبوعية لترتيب الوجبات تلقائياً حسب قدرتك الشرائية ومتابعة إنفاقك.'
                        : 'Set your daily or weekly budget to automatically prioritize affordable dishes and track spending.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (firebaseUser ? setTab('profile') : goToLogin())}
                  className="px-5 min-h-[42px] rounded-xl bg-[#0B3D2E] hover:bg-[#072B20] text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  {firebaseUser
                    ? lang === 'ar'
                      ? 'نظّم ميزانيتك الآن'
                      : 'Set Your Budget'
                    : lang === 'ar'
                    ? 'سجّل الدخول لضبط الميزانية'
                    : 'Sign In to Plan Budget'}
                </button>
              </>
            )}
          </section>

          <section className="bg-[#0B3D2E] text-[#FFF7E6] rounded-3xl p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F7931E] mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {lang === 'ar'
                      ? 'ترشيحات ذكية حسب ميزانيتك'
                      : 'Budget-Matched Smart Picks'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold">
                  {perMealBudget > 0
                    ? lang === 'ar'
                      ? `وجبات مقترحة لميزانيتك (${perMealBudget} ج.م للوجبة)`
                      : `Meals Matched to Your Budget (${perMealBudget} EGP/meal)`
                    : lang === 'ar'
                    ? 'ترشيحات الوجبات من المطابخ الموثقة'
                    : 'Recommended Meals from Verified Kitchens'}
                </h2>
              </div>
              {firebaseUser && (
                <button
                  type="button"
                  onClick={() => setTab('profile')}
                  className="px-4 min-h-[42px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] transition-colors shrink-0 cursor-pointer"
                >
                  {lang === 'ar' ? 'ضبط الميزانية والحساسيات' : 'Adjust Budget & Allergies'}
                </button>
              )}
            </div>

            {liveRecommendations.length === 0 ? (
              <div className="bg-white/10 rounded-2xl p-6 text-center text-sm">
                {lang === 'ar' ? 'لا توجد وجبات متاحة حاليًا.' : 'No meals available right now.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveRecommendations.map((entry) => {
                  const { recommendation, meal, protein_g, calories_kcal, provider_name } = entry;
                  return (
                    <div
                      key={meal.id}
                      className="bg-[#FFF7E6] text-[#13221C] rounded-2xl p-4 flex flex-col justify-between border border-white/15"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#4E6359] mb-2">
                          <span className="font-bold text-[#0B3D2E] tabular-nums">
                            #{recommendation.rank_position} · {meal.prep_time_minutes}{' '}
                            {lang === 'ar' ? 'د' : 'min'}
                          </span>
                          <span className="tabular-nums font-extrabold text-sm text-[#E97858]">
                            {meal.price} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base text-[#13221C]">
                          {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                        </h3>
                        <p className="text-xs text-[#4E6359] mt-0.5">{provider_name}</p>
                        <p className="text-xs text-[#0B3D2E] font-semibold mt-2 bg-[#0B3D2E]/8 rounded-lg px-2.5 py-1.5">
                          {lang === 'ar'
                            ? recommendation.reason_ar || recommendation.reason
                            : recommendation.reason}
                        </p>
                        {(calories_kcal > 0 || protein_g > 0) && (
                          <div className="flex items-center gap-3 text-[11px] text-[#4E6359] mt-2.5 tabular-nums">
                            {calories_kcal > 0 && <span>{calories_kcal} kcal</span>}
                            {calories_kcal > 0 && protein_g > 0 && <span>·</span>}
                            {protein_g > 0 && (
                              <span>
                                {protein_g}g {lang === 'ar' ? 'بروتين' : 'protein'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#0B3D2E]/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setRecommendationFeedbackItem(meal.id, 'liked')}
                            className={`min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                              recommendation.feedback === 'liked'
                                ? 'bg-[#0B3D2E] text-white'
                                : 'text-[#4E6359] hover:bg-[#0B3D2E]/10'
                            }`}
                            aria-label={lang === 'ar' ? 'أعجبني' : 'Like'}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecommendationFeedbackItem(meal.id, 'disliked')}
                            className={`min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                              recommendation.feedback === 'disliked'
                                ? 'bg-[#E97858] text-white'
                                : 'text-[#4E6359] hover:bg-[#E97858]/15'
                            }`}
                            aria-label={lang === 'ar' ? 'غير مناسب' : 'Dislike'}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMealDetails(meal)}
                            className="px-3 min-h-[38px] rounded-lg text-xs font-bold text-[#0B3D2E] hover:bg-[#0B3D2E]/10 cursor-pointer"
                          >
                            {lang === 'ar' ? 'التفاصيل' : 'Details'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMealToCart(meal.id)}
                            className="px-3.5 min-h-[38px] rounded-lg bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            {lang === 'ar' ? 'أضف للسلة' : 'Add'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Meal Browser Filters */}
          <section className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-4">
                <label className="block text-xs font-bold text-[#4E6359] mb-1.5">
                  {lang === 'ar' ? 'ابحث عن أكلة بيتي' : 'Search homemade meals'}
                </label>
                <div className="relative">
                  <Search
                    className={`w-4 h-4 text-[#4E6359] absolute top-3.5 ${
                      lang === 'ar' ? 'right-3.5' : 'left-3.5'
                    }`}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ar' ? 'ابحث باسم الوجبة...' : 'Search meals...'}
                    className={`w-full min-h-[44px] py-2.5 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-sm ${
                      lang === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'
                    }`}
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-[#4E6359] mb-1.5">
                  {lang === 'ar' ? 'النظام الغذائي' : 'Dietary Tag'}
                </label>
                <select
                  value={selectedDietaryId}
                  onChange={(e) => setSelectedDietaryId(e.target.value)}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-sm"
                >
                  <option value="all">{lang === 'ar' ? 'الكل' : 'All Diets'}</option>
                  {dietaryPreferences.map((d) => (
                    <option key={d.id} value={d.id}>
                      {lang === 'ar' ? d.name_ar : d.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-[#4E6359] mb-1.5">
                  {lang === 'ar' ? 'ترتيب حسب' : 'Sort By'}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as MealSort)}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-sm"
                >
                  <option value="default">{lang === 'ar' ? 'الافتراضي' : 'Default'}</option>
                  <option value="price_asc">{lang === 'ar' ? 'الأقل سعراً' : 'Price: Low to High'}</option>
                  <option value="price_desc">{lang === 'ar' ? 'الأعلى سعراً' : 'Price: High to Low'}</option>
                  <option value="prep_asc">{lang === 'ar' ? 'الأسرع تحضيراً' : 'Fastest Prep'}</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#4E6359] mb-1.5">
                  <span>{lang === 'ar' ? 'أقصى سعر' : 'Max Price'}</span>
                  <span className="text-[#0B3D2E] tabular-nums">
                    {maxPrice} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={priceCeiling}
                  step={5}
                  value={Math.min(maxPrice, priceCeiling)}
                  onChange={(e) => {
                    setMaxPrice(Number(e.target.value));
                    setPriceManuallyAdjusted(true);
                  }}
                  className="w-full accent-[#0B3D2E] h-7 cursor-pointer"
                />
              </div>

              <div className="lg:col-span-2 flex items-center min-h-[44px]">
                <label className="flex items-center gap-2 text-xs font-bold text-[#0B3D2E] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideMyAllergens}
                    onChange={(e) => setHideMyAllergens(e.target.checked)}
                    className="w-4 h-4 accent-[#0B3D2E] rounded"
                  />
                  <span>{lang === 'ar' ? 'إخفاء حساسياتي' : 'Hide my allergens'}</span>
                </label>
              </div>
            </div>

            {mealCategories.filter((c) => c.is_active).length > 0 && (
              <div className="flex items-center gap-2 pt-3 border-t border-[#0B3D2E]/10 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-4 min-h-[40px] rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategoryId === 'all'
                      ? 'bg-[#0B3D2E] text-white'
                      : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
                  }`}
                >
                  {lang === 'ar' ? 'جميع التصنيفات' : 'All Categories'}
                </button>
                {mealCategories
                  .filter((c) => c.is_active)
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-4 min-h-[40px] rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? 'bg-[#0B3D2E] text-white'
                          : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
                      }`}
                    >
                      {lang === 'ar' ? cat.name_ar : cat.name_en}
                    </button>
                  ))}
              </div>
            )}
          </section>

          {/* Meal Grid */}
          {eligibleMeals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-2">
              <UtensilsCrossed className="w-9 h-9 text-[#4E6359] mx-auto" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'لا توجد وجبات متاحة حاليًا.' : 'No meals available right now.'}
              </p>
            </div>
          ) : filteredMeals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center">
              <Filter className="w-8 h-8 text-[#4E6359] mx-auto mb-2" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar'
                  ? 'لا توجد وجبات تطابق معايير البحث الحالية'
                  : 'No meals match your current filters'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId('all');
                  setSelectedDietaryId('all');
                  setMaxPrice(priceCeiling);
                  setPriceManuallyAdjusted(false);
                  setSortBy('default');
                  setHideMyAllergens(false);
                }}
                className="mt-3 px-5 min-h-[42px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedMeals.map((meal) => {
                  const provider = providerProfiles.find((p) => p.user_id === meal.provider_id);
                  const category = mealCategories.find((c) => c.id === meal.category_id);
                  const ratingStats = getProviderRatingStats(meal.provider_id, reviews);
                  const mealAllergenNames = meal.allergen_ids
                    .map((aid) => allergens.find((a) => a.id === aid))
                    .filter(Boolean);

                  return (
                    <article
                      key={meal.id}
                      className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200 shadow-xs"
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => openMealDetails(meal)}
                          className="w-full text-start cursor-pointer block"
                        >
                          <MealArtwork
                            slug={meal.image_url}
                            alt={lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                            lang={lang}
                            className="w-full h-48"
                          />
                        </button>

                        <div className="p-5">
                          <div className="flex items-center justify-between text-xs text-[#4E6359] mb-1.5">
                            <span className="font-semibold text-[#0B3D2E] truncate">
                              {category ? (lang === 'ar' ? category.name_ar : category.name_en) : ''}
                            </span>
                            {ratingStats.review_count > 0 ? (
                              <span className="inline-flex items-center gap-1 tabular-nums shrink-0">
                                <Star className="w-3.5 h-3.5 fill-[#F7931E] text-[#F7931E]" />
                                <strong className="text-[#13221C]">{ratingStats.avg_rating}</strong>
                                <span>({ratingStats.review_count})</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-[#4E6359] shrink-0">
                                {lang === 'ar' ? 'جديد · بلا تقييمات' : 'New'}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => openMealDetails(meal)}
                            className="text-start cursor-pointer"
                          >
                            <h3 className="text-lg font-extrabold text-[#13221C] hover:text-[#0B3D2E] transition-colors">
                              {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                            </h3>
                          </button>

                          <p className="text-xs text-[#4E6359] mt-1">
                            {provider?.business_name || meal.provider_name}
                          </p>
                          {meal.description && (
                            <p className="text-xs sm:text-sm text-[#13221C]/75 mt-2 line-clamp-2 leading-relaxed">
                              {meal.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4E6359] mt-3 tabular-nums">
                            <span className="inline-flex items-center gap-1 font-bold text-[#0B3D2E]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {meal.is_available
                                ? lang === 'ar'
                                  ? 'متاحة الآن'
                                  : 'Available'
                                : lang === 'ar'
                                ? 'غير متاحة'
                                : 'Unavailable'}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {meal.prep_time_minutes} {lang === 'ar' ? 'د' : 'min'}
                            </span>
                            {meal.calories_kcal ? <span>· {meal.calories_kcal} kcal</span> : null}
                            {meal.protein_g ? (
                              <span>
                                · {meal.protein_g}g {lang === 'ar' ? 'بروتين' : 'protein'}
                              </span>
                            ) : null}
                          </div>

                          {mealAllergenNames.length > 0 && (
                            <p className="text-[11px] text-[#9E3F24] mt-2">
                              {lang === 'ar' ? 'يحتوي على: ' : 'Contains: '}
                              {mealAllergenNames
                                .map((a) => (lang === 'ar' ? a?.name_ar : a?.name_en))
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="px-5 py-3.5 bg-[#FFF7E6]/60 border-t border-[#0B3D2E]/10 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-xl font-extrabold text-[#0B3D2E] tabular-nums">
                            {meal.price}
                          </span>{' '}
                          <span className="text-xs font-bold text-[#0B3D2E]">
                            {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openMealDetails(meal)}
                            className="px-3.5 min-h-[40px] rounded-xl text-xs font-bold text-[#0B3D2E] border border-[#0B3D2E]/20 hover:bg-[#0B3D2E]/8 cursor-pointer"
                          >
                            {lang === 'ar' ? 'التفاصيل' : 'Details'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMealToCart(meal.id)}
                            className="inline-flex items-center gap-1 px-4 min-h-[40px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'أضف' : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalMealsPages > 1 && (
                <div className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-[#0B3D2E]/12 px-5 py-3 text-xs">
                  <span className="text-[#4E6359] font-bold tabular-nums">
                    {lang === 'ar'
                      ? `صفحة ${mealsPage} من ${totalMealsPages} (${filteredMeals.length} وجبة)`
                      : `Page ${mealsPage} of ${totalMealsPages} (${filteredMeals.length} meals)`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={mealsPage <= 1}
                      onClick={() => setMealsPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-2 rounded-xl border border-[#0B3D2E]/20 font-bold text-[#0B3D2E] disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={mealsPage >= totalMealsPages}
                      onClick={() => setMealsPage((p) => Math.min(totalMealsPages, p + 1))}
                      className="px-3.5 py-2 rounded-xl bg-[#0B3D2E] text-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'ar' ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CART & CHECKOUT */}
      {tab === 'cart' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'سلة الطلبات' : 'Shopping Cart'}
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-bold text-[#E97858] hover:underline cursor-pointer"
                >
                  {lang === 'ar' ? 'إفراغ السلة' : 'Clear Cart'}
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="w-10 h-10 text-[#4E6359] mx-auto mb-3" />
                <p className="font-bold text-[#13221C]">
                  {lang === 'ar' ? 'سلتك فارغة حالياً' : 'Your cart is empty'}
                </p>
                <p className="text-xs text-[#4E6359] mt-1">
                  {lang === 'ar'
                    ? 'اختر وجبات بيتي من مطبخ واحد في كل طلب'
                    : 'Add homemade meals from one verified kitchen per order'}
                </p>
                <button
                  type="button"
                  onClick={() => setTab('discover')}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'تصفح الوجبات' : 'Browse Meals'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartProvider && (
                  <div className="px-4 py-2.5 rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/15 text-xs font-bold text-[#0B3D2E] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4" />
                      <span>
                        {lang === 'ar' ? 'الطلب من: ' : 'Ordering from: '}
                        {cartProvider.business_name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#4E6359] tabular-nums">
                      {lang === 'ar' ? `${cart.length} / 5 أصناف` : `${cart.length} / 5 items`}
                    </span>
                  </div>
                )}

                {cart.map((item) => {
                  const meal = meals.find((m) => m.id === item.meal_id);
                  if (!meal) return null;
                  return (
                    <div
                      key={item.meal_id}
                      className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-[#0B3D2E]/10 bg-[#FFF7E6]/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-14 rounded-xl overflow-hidden shrink-0">
                          <MealArtwork slug={meal.image_url} alt={meal.name} className="w-full h-full" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#13221C]">
                            {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                          </h4>
                          <p className="text-xs text-[#4E6359] tabular-nums">
                            {meal.price} {lang === 'ar' ? 'ج.م' : 'EGP'} × {item.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.meal_id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg border border-[#0B3D2E]/20 flex items-center justify-center hover:bg-[#0B3D2E]/10 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.meal_id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg border border-[#0B3D2E]/20 flex items-center justify-center hover:bg-[#0B3D2E]/10 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.meal_id)}
                          className="p-1.5 text-[#E97858] hover:bg-[#E97858]/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checkout Form */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 h-fit">
            <h3 className="text-lg font-extrabold text-[#0B3D2E] mb-4">
              {lang === 'ar' ? 'تأكيد الطلب والدفع' : 'Checkout Summary'}
            </h3>

            {!firebaseUser ? (
              <div className="p-5 rounded-2xl bg-[#FFF7E6] border border-[#0B3D2E]/15 text-center space-y-3">
                <p className="text-xs font-bold text-[#13221C]">
                  {lang === 'ar'
                    ? 'يرجى تسجيل الدخول لإرسال طلبك إلى المطبخ'
                    : 'Please sign in to submit your order'}
                </p>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
                </button>
              </div>
            ) : needsEmailVerification ? (
              <div className="p-5 rounded-2xl bg-[#FFF7E6] border border-[#E97858]/30 text-center space-y-3">
                <p className="text-xs font-bold text-[#9E3F24]">
                  {lang === 'ar'
                    ? 'يرجى تأكيد بريدك الإلكتروني أولاً قبل إتمام الطلب'
                    : 'Please verify your email address before placing an order'}
                </p>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'صفحة التفعيل' : 'Verification Page'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1.5">
                    {lang === 'ar' ? 'طريقة الاستلام' : 'Fulfillment Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('delivery')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                        fulfillmentType === 'delivery'
                          ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                          : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                      }`}
                    >
                      {lang === 'ar'
                        ? `توصيل (+${configuredDeliveryFee} ج.م)`
                        : `Delivery (+${configuredDeliveryFee} EGP)`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('pickup')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                        fulfillmentType === 'pickup'
                          ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                          : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                      }`}
                    >
                      {lang === 'ar' ? 'استلام من المطبخ (مجاني)' : 'Kitchen Pickup (Free)'}
                    </button>
                  </div>
                </div>

                {fulfillmentType === 'delivery' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#4E6359] mb-1.5">
                      {lang === 'ar' ? 'عنوان التوصيل (مطلوب)' : 'Delivery Location (Required)'}
                    </label>
                    <input
                      type="text"
                      value={deliveryLocation}
                      onChange={(e) => {
                        setDeliveryLocation(e.target.value);
                        if (deliveryLocationError) setDeliveryLocationError('');
                      }}
                      placeholder={
                        lang === 'ar' ? 'أدخل عنوان التوصيل بالتفصيل' : 'Enter delivery address'
                      }
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border text-sm ${
                        deliveryLocationError ? 'border-[#9E3F24]' : 'border-[#0B3D2E]/20'
                      }`}
                    />
                    {deliveryLocationError && (
                      <p className="text-[11px] font-bold text-[#9E3F24] mt-1">
                        {deliveryLocationError}
                      </p>
                    )}
                  </div>
                ) : (
                  cartProvider && (
                    <div className="p-3 rounded-xl bg-[#FFF7E6] text-xs text-[#13221C]">
                      <span className="font-bold">
                        {lang === 'ar' ? 'عنوان الاستلام: ' : 'Pickup at: '}
                      </span>
                      {cartProvider.pickup_address}
                    </div>
                  )
                )}

                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1.5">
                    {lang === 'ar' ? 'ملاحظات للمطبخ' : 'Notes for Kitchen'}
                  </label>
                  <textarea
                    rows={2}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder={lang === 'ar' ? 'أي ملاحظات حول الطلب...' : 'Any order notes...'}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-[#0B3D2E]/10 space-y-2 text-sm tabular-nums">
                  <div className="flex justify-between text-[#4E6359]">
                    <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                    <span>
                      {cartSubtotal} {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#4E6359]">
                    <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
                    <span>
                      {deliveryFee} {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-[#0B3D2E] pt-2 border-t border-[#0B3D2E]/10">
                    <span>
                      {lang === 'ar' ? 'الإجمالي (نقداً عند الاستلام)' : 'Total (Cash on Delivery)'}
                    </span>
                    <span>
                      {cartTotal} {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={cart.length === 0 || placingOrder}
                  onClick={async () => {
                    if (fulfillmentType === 'delivery' && deliveryLocation.trim().length < 3) {
                      setDeliveryLocationError(
                        lang === 'ar'
                          ? 'يرجى كتابة عنوان التوصيل بالتفصيل (3 أحرف على الأقل)'
                          : 'Please enter a valid delivery location (min 3 characters)'
                      );
                      return;
                    }
                    setDeliveryLocationError('');
                    setPlacingOrder(true);
                    try {
                      const res = await placeOrder({
                        fulfillment_type: fulfillmentType,
                        delivery_location: deliveryLocation,
                        student_notes: orderNotes,
                      });
                      if (res.ok) {
                        setOrderNotes('');
                        if (res.orderId && res.orderNumber) {
                          setConfirmedOrderBanner({
                            orderId: res.orderId,
                            orderNumber: res.orderNumber,
                          });
                        }
                        setOrderFilter('all');
                        setTab('orders');
                      }
                    } finally {
                      setPlacingOrder(false);
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-[#0B3D2E] text-white font-bold text-sm hover:bg-[#072B20] disabled:opacity-45 transition-colors cursor-pointer"
                >
                  {placingOrder
                    ? lang === 'ar'
                      ? 'جاري إرسال الطلب...'
                      : 'Submitting Order...'
                    : lang === 'ar'
                    ? 'تأكيد وإرسال الطلب'
                    : 'Place Cash Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MY ORDERS */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {confirmedOrderBanner && (
            <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#A7C957]/25 text-[#A7C957] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {lang === 'ar'
                      ? `تم إرسال طلبك ${confirmedOrderBanner.orderNumber} بنجاح!`
                      : `Order ${confirmedOrderBanner.orderNumber} placed successfully!`}
                  </h3>
                  <p className="text-xs text-[#FFF7E6]/80 mt-0.5">
                    {lang === 'ar'
                      ? 'طلبك الآن قيد مراجعة المطبخ، ويمكنك متابعة حالته مباشرةً من هنا.'
                      : 'Your order is awaiting kitchen confirmation. Track live status below.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmedOrderBanner(null)}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'حسناً' : 'Dismiss'}
              </button>
            </div>
          )}

          {!firebaseUser ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
              <Package className="w-10 h-10 text-[#4E6359] mx-auto" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'سجّل الدخول لعرض طلباتك' : 'Sign in to view your orders'}
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            </div>
          ) : myOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
              <Package className="w-10 h-10 text-[#4E6359] mx-auto" />
              <p className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'ليس لديك أي طلبات حتى الآن.' : 'You have no orders yet.'}
              </p>
              <button
                type="button"
                onClick={() => setTab('discover')}
                className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'استكشف الوجبات المتاحة' : 'Browse Available Meals'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-[#0B3D2E]/12 p-2.5">
                {(
                  [
                    { id: 'all', ar: `الكل (${myOrders.length})`, en: `All (${myOrders.length})` },
                    {
                      id: 'active',
                      ar: 'النشطة',
                      en: 'Active',
                    },
                    { id: 'delivered', ar: 'المكتملة', en: 'Delivered' },
                    { id: 'cancelled', ar: 'الملغاة', en: 'Cancelled' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOrderFilter(item.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      orderFilter === item.id
                        ? 'bg-[#0B3D2E] text-white'
                        : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
                    }`}
                  >
                    {lang === 'ar' ? item.ar : item.en}
                  </button>
                ))}
              </div>

              {filteredMyOrders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-8 text-center text-xs font-bold text-[#4E6359]">
                  {lang === 'ar' ? 'لا توجد طلبات ضمن هذا الفلتر.' : 'No orders in this filter.'}
                </div>
              ) : (
                <>
                  {paginatedOrders.map((order) => {
                    const existingReview = reviews.find((r) => r.order_id === order.id);
                    const st = statusLabel(order.status);

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#0B3D2E]/10">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-[#4E6359] tabular-nums">
                              <span className="font-bold text-[#0B3D2E]">{order.order_number}</span>
                              <span>·</span>
                              <span>{order.provider_name}</span>
                              <span>·</span>
                              <span>
                                {order.fulfillment_type === 'delivery'
                                  ? lang === 'ar'
                                    ? 'توصيل'
                                    : 'Delivery'
                                  : lang === 'ar'
                                  ? 'استلام'
                                  : 'Pickup'}
                              </span>
                            </div>
                            <div className="text-base font-extrabold text-[#13221C] mt-1 tabular-nums">
                              {order.total_amount} {lang === 'ar' ? 'ج.م (كاش)' : 'EGP (Cash)'}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-3 py-1 rounded-xl text-xs font-bold ${st.cls}`}>
                              {st.text}
                            </span>

                            {order.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => setCancelOrderConfirmId(order.id)}
                                className="px-3 py-1 rounded-xl border border-[#E97858]/40 text-[#9E3F24] text-xs font-bold hover:bg-[#E97858]/10 cursor-pointer"
                              >
                                {lang === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                              </button>
                            )}

                            {order.status === 'delivered' && !existingReview && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewOrderId(order.id);
                                  setReviewRating(5);
                                  setReviewComment('');
                                  setDeliveryRating(5);
                                  setDeliveryComment('');
                                }}
                                className="px-3 py-1 rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-bold hover:bg-[#E08112] cursor-pointer"
                              >
                                {lang === 'ar' ? 'تقييم الطلب والتوصيل' : 'Rate Order'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setComplaintOrder({
                                  orderId: order.id,
                                  againstUserId: order.provider_id,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-[#4E6359] hover:bg-[#FFF7E6] cursor-pointer"
                            >
                              <MessageSquareWarning className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'شكوى' : 'Report'}</span>
                            </button>
                          </div>
                        </div>

                        {order.delivery_partner_id && (
                          <div className="mt-3 px-3.5 py-2.5 rounded-2xl bg-[#FFF7E6] border border-[#0B3D2E]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 font-bold text-[#0B3D2E]">
                              <Bike className="w-4 h-4" />
                              <span>
                                {lang === 'ar' ? 'شريك التوصيل:' : 'Delivery Partner:'}{' '}
                                {order.delivery_partner_name || 'Student Partner'}
                              </span>
                            </div>
                            {order.delivery_partner_method && (
                              <span className="text-[#4E6359]">
                                {order.delivery_partner_method === 'bicycle'
                                  ? lang === 'ar'
                                    ? 'دراجة هوائية'
                                    : 'Bicycle'
                                  : lang === 'ar'
                                  ? 'مشي على الأقدام'
                                  : 'Walking'}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="py-3 space-y-1.5 text-sm">
                          {order.items_summary.map((oi, idx) => (
                            <div
                              key={`${oi.meal_id}_${idx}`}
                              className="flex justify-between text-xs sm:text-sm"
                            >
                              <span>
                                {oi.quantity}× {oi.meal_name}
                              </span>
                              <span className="font-bold tabular-nums">
                                {oi.line_total} {lang === 'ar' ? 'ج.م' : 'EGP'}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 pt-3 border-t border-[#0B3D2E]/10">
                          <div className="text-xs font-bold text-[#4E6359] mb-2">
                            {lang === 'ar' ? 'سجل متابعة الحالة:' : 'Status Timeline:'}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {order.status_history.map((h, i) => (
                              <div
                                key={`${h.status}_${i}`}
                                className="px-3 py-1.5 rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/10 text-xs"
                              >
                                <span className="font-bold text-[#0B3D2E]">
                                  {statusLabel(h.status).text}
                                </span>
                                {h.note && <span className="text-[#4E6359]"> — {h.note}</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {existingReview && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-[#FFF7E6] border border-[#F7931E]/30 text-xs space-y-1">
                            <div className="flex flex-wrap items-center gap-3 font-bold text-[#0B3D2E]">
                              <span className="inline-flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-[#F7931E] text-[#F7931E]" />
                                {lang === 'ar' ? 'تقييم الوجبة:' : 'Meal:'} {existingReview.rating}/5
                              </span>
                              {existingReview.delivery_rating !== null && (
                                <span className="inline-flex items-center gap-1 text-[#13221C]">
                                  <Bike className="w-3.5 h-3.5 text-[#0B3D2E]" />
                                  {lang === 'ar' ? 'تقييم التوصيل:' : 'Delivery:'}{' '}
                                  {existingReview.delivery_rating}/5
                                </span>
                              )}
                            </div>
                            <p className="text-[#13221C]">{existingReview.comment}</p>
                            {existingReview.delivery_comment && (
                              <p className="text-[#4E6359]">
                                {lang === 'ar' ? 'ملاحظة التوصيل: ' : 'Delivery note: '}
                                {existingReview.delivery_comment}
                              </p>
                            )}
                            {existingReview.provider_response && (
                              <p className="text-[#0B3D2E] font-semibold mt-1">
                                {lang === 'ar' ? 'رد المطبخ: ' : 'Kitchen reply: '}
                                {existingReview.provider_response}
                              </p>
                            )}
                          </div>
                        )}
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

      {/* TAB 4: PROFILE & BUDGET SETTINGS */}
      {tab === 'profile' && (
        !firebaseUser ? (
          <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
            <UserIcon className="w-10 h-10 text-[#4E6359] mx-auto" />
            <p className="font-bold text-[#13221C]">
              {lang === 'ar'
                ? 'سجّل الدخول لحفظ ميزانيتك وتفضيلاتك الغذائية'
                : 'Sign in to configure your budget and dietary profile'}
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
            >
              {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-5">
              <h2 className="text-xl font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'إعدادات الميزانية والتفضيلات الغذائية' : 'Budget & Dietary Preferences'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {lang === 'ar' ? 'الجامعة' : 'University'}
                  </label>
                  <select
                    value={formUniId}
                    onChange={(e) => setFormUniId(e.target.value)}
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
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {lang === 'ar' ? 'الكلية' : 'Faculty'}
                  </label>
                  <input
                    type="text"
                    value={formFaculty}
                    onChange={(e) => setFormFaculty(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم الكلية' : 'Faculty name'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {lang === 'ar' ? 'الميزانية اليومية (ج.م)' : 'Daily Budget (EGP)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formDailyBudget}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFormDailyBudget(v);
                      setFormWeeklyBudget(v * 7);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-1">
                    {lang === 'ar' ? 'الميزانية الأسبوعية (ج.م)' : 'Weekly Budget (EGP)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formWeeklyBudget}
                    onChange={(e) => setFormWeeklyBudget(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E6359] mb-1">
                  {lang === 'ar' ? 'عنوان التوصيل الافتراضي' : 'Default Delivery Location'}
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder={lang === 'ar' ? 'المدينة / الحي / السكن' : 'City / Area / Housing'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />
              </div>

              {allergens.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-2">
                    {lang === 'ar'
                      ? 'الحساسيات الغذائية (تُستبعد تلقائياً)'
                      : 'Allergies (Hard Excluded)'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map((alg) => {
                      const selected = editAllergens.includes(alg.id);
                      return (
                        <button
                          key={alg.id}
                          type="button"
                          onClick={() =>
                            setEditAllergens((prev) =>
                              selected ? prev.filter((x) => x !== alg.id) : [...prev, alg.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                            selected
                              ? 'bg-[#E97858] text-white border-[#E97858]'
                              : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                          }`}
                        >
                          {lang === 'ar' ? alg.name_ar : alg.name_en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {dietaryPreferences.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-2">
                    {lang === 'ar' ? 'التفضيلات والقيود الغذائية' : 'Dietary Preferences'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dietaryPreferences.map((dp) => {
                      const selected = editDietary.includes(dp.id);
                      return (
                        <button
                          key={dp.id}
                          type="button"
                          onClick={() =>
                            setEditDietary((prev) =>
                              selected ? prev.filter((x) => x !== dp.id) : [...prev, dp.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                            selected
                              ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                              : 'bg-[#FFF7E6] text-[#13221C] border-[#0B3D2E]/15'
                          }`}
                        >
                          {lang === 'ar' ? dp.name_ar : dp.name_en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mealCategories.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#4E6359] mb-2">
                    {lang === 'ar' ? 'تفضيل التصنيفات (١ إلى ٥)' : 'Category Weights (1–5)'}
                  </label>
                  <div className="space-y-2">
                    {mealCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-xl bg-[#FFF7E6]/70"
                      >
                        <span className="text-xs font-bold text-[#13221C]">
                          {lang === 'ar' ? cat.name_ar : cat.name_en}
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                setEditCatPrefs((p) => ({ ...p, [cat.id]: lvl }))
                              }
                              className={`w-7 h-7 rounded-lg text-xs font-bold tabular-nums cursor-pointer ${
                                (editCatPrefs[cat.id] ?? 3) === lvl
                                  ? 'bg-[#0B3D2E] text-white'
                                  : 'bg-white text-[#4E6359] border border-[#0B3D2E]/15'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={savingProfile}
                onClick={async () => {
                  setSavingProfile(true);
                  try {
                    await updateStudentSettings({
                      daily_budget: formDailyBudget,
                      weekly_budget: formWeeklyBudget,
                      delivery_location: formLocation,
                      faculty: formFaculty,
                      university_id: formUniId,
                      allergen_ids: editAllergens,
                      dietary_pref_ids: editDietary,
                      category_prefs: editCatPrefs,
                    });
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="w-full py-3 rounded-xl bg-[#0B3D2E] text-white font-bold text-sm hover:bg-[#072B20] disabled:opacity-60 cursor-pointer"
              >
                {savingProfile
                  ? lang === 'ar'
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : lang === 'ar'
                  ? 'حفظ الإعدادات'
                  : 'Save Settings'}
              </button>
            </div>

            {/* Real Spending Summary & Remaining Budget */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="inline-flex items-center gap-2 text-[#F7931E]">
                    <Wallet className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'مخطط الميزانية والإنفاق الفعلي' : 'Budget Planner & Actual Spending'}</span>
                  </span>
                </div>

                <div>
                  <div className="text-xs text-[#FFF7E6]/70">
                    {lang === 'ar' ? 'إجمالي الإنفاق المسجل' : 'Total Recorded Spending'}
                  </div>
                  <div className="text-3xl font-extrabold tabular-nums mt-0.5">
                    {monthlySpending.total} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </div>
                  <p className="text-xs text-[#FFF7E6]/80 mt-1 tabular-nums">
                    {monthlySpending.monthlyBudget > 0
                      ? lang === 'ar'
                        ? `من أصل ميزانية شهرية ${monthlySpending.monthlyBudget} ج.م · المتبقي: ${monthlyRemaining} ج.م (${monthlySpending.count} طلبات)`
                        : `Out of ${monthlySpending.monthlyBudget} EGP monthly budget · Remaining: ${monthlyRemaining} EGP (${monthlySpending.count} orders)`
                      : lang === 'ar'
                      ? `${monthlySpending.count} طلبات مسجلة · أدخل ميزانيتك لحساب المتبقي`
                      : `${monthlySpending.count} orders recorded · Set daily budget to track remaining balance`}
                  </p>
                </div>

                <div className="h-3 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      monthlyProgressPct >= 90 ? 'bg-[#E97858]' : 'bg-[#F7931E]'
                    }`}
                    style={{ width: `${monthlyProgressPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-white/10">
                    <div className="text-[#FFF7E6]/70">
                      {lang === 'ar' ? 'المتبقي من الميزانية' : 'Remaining Budget'}
                    </div>
                    <div className="text-lg font-extrabold text-[#F7931E] mt-0.5 tabular-nums">
                      {monthlySpending.monthlyBudget > 0
                        ? `${monthlyRemaining} ${lang === 'ar' ? 'ج.م' : 'EGP'}`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/10">
                    <div className="text-[#FFF7E6]/70">
                      {lang === 'ar' ? 'حد الوجبة الواحدة' : 'Per-Meal Limit'}
                    </div>
                    <div className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
                      {getPerMealBudget(formDailyBudget, formWeeklyBudget)}{' '}
                      {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const limit = getPerMealBudget(formDailyBudget, formWeeklyBudget);
                    if (limit > 0) {
                      setMaxPrice(Math.max(20, limit));
                    }
                    setTab('discover');
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#E08112] text-[#13221C] text-xs font-extrabold transition-colors cursor-pointer"
                >
                  {lang === 'ar'
                    ? 'اكتشف الوجبات المناسبة لميزانيتي'
                    : 'Discover Meals Within My Budget'}
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* MEAL DETAILS MODAL */}
      {selectedMeal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#0B3D2E]/15">
            <div className="relative">
              <MealArtwork
                slug={selectedMeal.image_url}
                alt={lang === 'ar' ? selectedMeal.name_ar || selectedMeal.name : selectedMeal.name}
                lang={lang}
                className="w-full h-52"
              />
              <button
                type="button"
                onClick={() => setSelectedMeal(null)}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className={`absolute top-3 ${
                  lang === 'ar' ? 'left-3' : 'right-3'
                } min-w-[40px] min-h-[40px] rounded-full bg-white/95 text-[#13221C] flex items-center justify-center shadow cursor-pointer`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {(() => {
                const prov = providerProfiles.find((p) => p.user_id === selectedMeal.provider_id);
                const category = mealCategories.find((c) => c.id === selectedMeal.category_id);
                const stats = getProviderRatingStats(selectedMeal.provider_id, reviews);
                const mealAllergenNames = selectedMeal.allergen_ids
                  .map((aid) => allergens.find((a) => a.id === aid))
                  .filter(Boolean);
                const mealDietaryNames = selectedMeal.dietary_pref_ids
                  .map((did) => dietaryPreferences.find((d) => d.id === did))
                  .filter(Boolean);

                return (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                          {category && (
                            <span className="font-bold text-[#0B3D2E] bg-[#FFF7E6] px-2.5 py-0.5 rounded-lg border border-[#0B3D2E]/12">
                              {lang === 'ar' ? category.name_ar : category.name_en}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 font-bold text-[#0B3D2E]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#A7C957]" />
                            {selectedMeal.is_available
                              ? lang === 'ar'
                                ? 'متاحة للطلب'
                                : 'Available Now'
                              : lang === 'ar'
                              ? 'غير متاحة'
                              : 'Unavailable'}
                          </span>
                        </div>
                        <h3 className="text-2xl font-extrabold text-[#13221C]">
                          {lang === 'ar' ? selectedMeal.name_ar || selectedMeal.name : selectedMeal.name}
                        </h3>
                        <p className="text-sm text-[#4E6359] mt-0.5">
                          {prov?.business_name || selectedMeal.provider_name}
                          {prov?.area ? ` · ${prov.area}` : ''}
                          {' · '}
                          {stats.review_count > 0
                            ? `★ ${stats.avg_rating} (${stats.review_count})`
                            : lang === 'ar'
                            ? 'مطبخ جديد · بلا تقييمات بعد'
                            : 'New kitchen · No reviews yet'}
                        </p>
                      </div>
                      <div className="text-2xl font-extrabold text-[#0B3D2E] tabular-nums shrink-0">
                        {selectedMeal.price} {lang === 'ar' ? 'ج.م' : 'EGP'}
                      </div>
                    </div>

                    {selectedMeal.description && (
                      <p className="text-sm text-[#13221C]/85 leading-relaxed">
                        {selectedMeal.description}
                      </p>
                    )}

                    <div className="text-xs text-[#4E6359] flex flex-wrap gap-3">
                      {selectedMeal.portion_description && (
                        <span>{selectedMeal.portion_description}</span>
                      )}
                      {selectedMeal.portion_description && <span>·</span>}
                      <span>
                        {lang === 'ar' ? 'وقت التحضير:' : 'Prep time:'}{' '}
                        {selectedMeal.prep_time_minutes} {lang === 'ar' ? 'دقيقة' : 'min'}
                      </span>
                    </div>

                    {mealDietaryNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mealDietaryNames.map((dp) => (
                          <span
                            key={dp!.id}
                            className="px-2.5 py-1 rounded-lg bg-[#A7C957]/25 text-[#0B3D2E] text-[11px] font-bold"
                          >
                            {lang === 'ar' ? dp!.name_ar : dp!.name_en}
                          </span>
                        ))}
                      </div>
                    )}

                    {mealAllergenNames.length > 0 && (
                      <p className="text-xs font-bold text-[#9E3F24] bg-[#E97858]/10 px-3 py-2 rounded-xl">
                        {lang === 'ar' ? 'تنبيه حساسية — يحتوي على: ' : 'Allergen notice — Contains: '}
                        {mealAllergenNames
                          .map((a) => (lang === 'ar' ? a?.name_ar : a?.name_en))
                          .join(' · ')}
                      </p>
                    )}

                    {(selectedMeal.calories_kcal || selectedMeal.protein_g) && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#FFF7E6] p-3.5 rounded-2xl border border-[#0B3D2E]/10 text-center tabular-nums">
                        <div>
                          <div className="text-[11px] text-[#4E6359]">{lang === 'ar' ? 'سعرات' : 'Kcal'}</div>
                          <div className="font-extrabold text-[#0B3D2E]">{selectedMeal.calories_kcal ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#4E6359]">{lang === 'ar' ? 'بروتين' : 'Protein'}</div>
                          <div className="font-extrabold text-[#0B3D2E]">{selectedMeal.protein_g ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#4E6359]">{lang === 'ar' ? 'كارب' : 'Carbs'}</div>
                          <div className="font-extrabold text-[#0B3D2E]">{selectedMeal.carbs_g ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#4E6359]">{lang === 'ar' ? 'دهون' : 'Fat'}</div>
                          <div className="font-extrabold text-[#0B3D2E]">{selectedMeal.fat_g ?? 0}g</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#4E6359]">{lang === 'ar' ? 'ألياف' : 'Fiber'}</div>
                          <div className="font-extrabold text-[#0B3D2E]">{selectedMeal.fiber_g ?? 0}g</div>
                        </div>
                      </div>
                    )}

                    {selectedMeal.ingredients_text && (
                      <div>
                        <h4 className="text-xs font-bold text-[#4E6359] mb-1">
                          {lang === 'ar' ? 'المكونات' : 'Ingredients'}
                        </h4>
                        <p className="text-xs text-[#13221C] bg-[#FFF7E6] p-3 rounded-xl">
                          {selectedMeal.ingredients_text}
                        </p>
                      </div>
                    )}

                    {prov?.bio && (
                      <div className="rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 p-3.5 text-xs">
                        <div className="font-bold text-[#0B3D2E] mb-1">
                          {lang === 'ar' ? 'عن المطبخ:' : 'About the Kitchen:'}
                        </div>
                        <p className="text-[#4E6359] leading-relaxed">{prov.bio}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                      <div className="flex items-center justify-center gap-2 border border-[#0B3D2E]/20 rounded-xl px-3 py-1.5 bg-[#FFF7E6]/50">
                        <button
                          type="button"
                          onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                          className="w-8 h-8 rounded-lg hover:bg-[#0B3D2E]/10 flex items-center justify-center cursor-pointer"
                          aria-label={lang === 'ar' ? 'تقليل الكمية' : 'Decrease quantity'}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-extrabold tabular-nums">
                          {detailQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailQty((q) => Math.min(20, q + 1))}
                          className="w-8 h-8 rounded-lg hover:bg-[#0B3D2E]/10 flex items-center justify-center cursor-pointer"
                          aria-label={lang === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={!selectedMeal.is_available}
                        onClick={() => {
                          handleAddMealToCart(selectedMeal.id, detailQty);
                          setSelectedMeal(null);
                        }}
                        className="flex-1 py-3 rounded-xl bg-[#0B3D2E] text-white font-bold text-sm hover:bg-[#072B20] disabled:opacity-50 cursor-pointer tabular-nums"
                      >
                        {lang === 'ar'
                          ? `أضف للسلة — ${(selectedMeal.price * detailQty).toFixed(0)} ج.م`
                          : `Add to Cart — ${(selectedMeal.price * detailQty).toFixed(0)} EGP`}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ONE PROVIDER PER ORDER CONFLICT MODAL */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'بدء سلة من مطبخ جديد؟' : 'Start a cart from a new kitchen?'}
            </h3>
            <p className="text-sm text-[#4E6359] leading-relaxed">
              {lang === 'ar'
                ? `تحتوي سلتك حالياً على وجبات من "${conflictModal.providerName}". كل طلب في لقمة يكون من مطبخ واحد فقط.`
                : `Your cart currently has items from "${conflictModal.providerName}". Each order belongs to one kitchen.`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  addToCart(conflictModal.mealId, conflictModal.qty, '', true);
                  setConflictModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'نعم، ابدأ سلة جديدة' : 'Yes, replace cart'}
              </button>
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Keep current'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT CANCEL ORDER CONFIRMATION */}
      <ConfirmDialog
        isOpen={cancelOrderConfirmId !== null}
        lang={lang}
        title={lang === 'ar' ? 'تأكيد إلغاء الطلب' : 'Confirm Order Cancellation'}
        description={
          lang === 'ar'
            ? 'هل أنت متأكد من إلغاء هذا الطلب؟ لن يتم تحضير الطلب بعد تأكيد الإلغاء.'
            : 'Are you sure you want to cancel this pending order?'
        }
        confirmLabel={lang === 'ar' ? 'نعم، إلغاء الطلب' : 'Yes, Cancel Order'}
        cancelLabel={lang === 'ar' ? 'تراجع' : 'Keep Order'}
        tone="danger"
        busy={cancellingOrder}
        onCancel={() => setCancelOrderConfirmId(null)}
        onConfirm={async () => {
          if (!cancelOrderConfirmId) return;
          setCancellingOrder(true);
          try {
            await transitionOrderStatus(
              cancelOrderConfirmId,
              'cancelled',
              lang === 'ar' ? 'ألغى الطالب الطلب' : 'Cancelled by student'
            );
            setCancelOrderConfirmId(null);
          } finally {
            setCancellingOrder(false);
          }
        }}
      />

      {/* REVIEW MODAL */}
      {reviewOrderId !== null &&
        (() => {
          const targetOrder = orders.find((o) => o.id === reviewOrderId);
          const isDeliveryOrder = targetOrder?.fulfillment_type === 'delivery';
          return (
            <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-extrabold text-[#0B3D2E]">
                  {lang === 'ar' ? 'تقييم جودة الوجبة والتوصيل' : 'Rate Meal & Delivery'}
                </h3>

                <div>
                  <div className="text-xs font-bold text-[#4E6359] mb-1">
                    {lang === 'ar' ? 'تقييم الوجبة والمطبخ:' : 'Meal & Kitchen Rating:'}
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        className="p-1.5 cursor-pointer"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            n <= reviewRating ? 'fill-[#F7931E] text-[#F7931E]' : 'text-[#4E6359]/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={lang === 'ar' ? 'اكتب تقييمك للوجبة...' : 'Share your meal review...'}
                  className="w-full p-3 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
                />

                {isDeliveryOrder && (
                  <div className="pt-3 border-t border-[#0B3D2E]/10 space-y-2.5">
                    <div className="text-xs font-bold text-[#0B3D2E] flex items-center gap-1.5">
                      <Bike className="w-4 h-4" />
                      <span>
                        {lang === 'ar'
                          ? 'تقييم تجربة التوصيل:'
                          : 'Delivery Experience Rating:'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDeliveryRating(n)}
                          className="p-1.5 cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              n <= deliveryRating ? 'fill-[#0B3D2E] text-[#0B3D2E]' : 'text-[#4E6359]/30'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={deliveryComment}
                      onChange={(e) => setDeliveryComment(e.target.value)}
                      placeholder={
                        lang === 'ar' ? 'ملاحظة حول التوصيل...' : 'Delivery comment...'
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-xs"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await submitReview(
                        reviewOrderId,
                        reviewRating,
                        reviewComment,
                        isDeliveryOrder ? deliveryRating : null,
                        deliveryComment
                      );
                      if (ok) setReviewOrderId(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                  >
                    {lang === 'ar' ? 'إرسال التقييم' : 'Submit Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewOrderId(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold cursor-pointer"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* COMPLAINT MODAL */}
      {complaintOrder && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#9E3F24]">
              {lang === 'ar' ? 'تقديم شكوى للإدارة' : 'File Order Complaint'}
            </h3>
            <input
              type="text"
              value={complaintSubject}
              onChange={(e) => setComplaintSubject(e.target.value)}
              placeholder={lang === 'ar' ? 'عنوان المشكلة' : 'Subject'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
            />
            <textarea
              rows={3}
              value={complaintDesc}
              onChange={(e) => setComplaintDesc(e.target.value)}
              placeholder={lang === 'ar' ? 'اشرح التفاصيل...' : 'Describe the issue...'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF7E6]/60 border border-[#0B3D2E]/20 text-sm"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!complaintSubject.trim()) return;
                  const ok = await fileComplaint({
                    against_user_id: complaintOrder.againstUserId,
                    order_id: complaintOrder.orderId,
                    subject: complaintSubject,
                    description: complaintDesc,
                  });
                  if (ok) {
                    setComplaintOrder(null);
                    setComplaintSubject('');
                    setComplaintDesc('');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#E97858] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إرسال الشكوى' : 'Submit Complaint'}
              </button>
              <button
                type="button"
                onClick={() => setComplaintOrder(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Cart Bar */}
      {cart.length > 0 && tab !== 'cart' && (
        <div className="md:hidden fixed bottom-3 inset-x-4 z-30">
          <button
            type="button"
            onClick={() => setTab('cart')}
            className="w-full min-h-[52px] px-4 rounded-2xl bg-[#0B3D2E] text-[#FFF7E6] shadow-xl flex items-center justify-between gap-3 border border-white/15 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold">
              <span className="w-7 h-7 rounded-xl bg-[#F7931E] text-[#13221C] font-extrabold flex items-center justify-center tabular-nums">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
              <span>{lang === 'ar' ? 'عرض سلة الطلبات' : 'View Shopping Cart'}</span>
            </span>
            <span className="text-sm font-extrabold text-[#F7931E] tabular-nums">
              {cartSubtotal} {lang === 'ar' ? 'ج.م' : 'EGP'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
