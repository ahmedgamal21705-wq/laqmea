import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Allergen,
  CartItem,
  Complaint,
  ComplaintStatus,
  DeliveryMethod,
  DeliveryOffer,
  DeliveryPartnerProfile,
  DeliveryPricingConfig,
  DeliveryTransaction,
  DietaryPreference,
  FulfillmentType,
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
  Meal,
  MealCategory,
  Notification,
  Order,
  OrderStatus,
  ProviderProfile,
  RecommendationFeedback,
  Review,
  StudentProfile,
  University,
  User,
  UserStatus,
  VerificationStatus,
} from '../types/database';
import {
  isFirebaseAccountVerified,
  PRIMARY_ADMIN_EMAIL,
  useFirebaseAuth,
} from './FirebaseAuthContext';

export type AppView =
  | 'landing'
  | 'onboarding'
  | 'auth'
  | 'student'
  | 'provider'
  | 'delivery'
  | 'events'
  | 'admin';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface LokmaContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  view: AppView;
  setView: (view: AppView) => void;
  dataLoading: boolean;
  adminSyncLoading: boolean;
  adminSyncError: string | null;
  retryAdminSync: () => void;

  // Real Firestore Collections (merged safely per user access scope)
  users: User[];
  universities: University[];
  mealCategories: MealCategory[];
  allergens: Allergen[];
  dietaryPreferences: DietaryPreference[];
  providerProfiles: ProviderProfile[];
  myStudentProfile: StudentProfile | null;
  myProviderProfile: ProviderProfile | null;
  myDeliveryPartnerProfile: DeliveryPartnerProfile | null;
  allDeliveryPartnerProfiles: DeliveryPartnerProfile[];
  meals: Meal[];
  orders: Order[];
  deliveryOffers: DeliveryOffer[];
  deliveryTransactions: DeliveryTransaction[];
  deliveryPricingConfig: DeliveryPricingConfig;
  reviews: Review[];
  notifications: Notification[];
  complaints: Complaint[];
  lokmaBoxLeads: LokmaBoxLead[];
  lokmaBoxSurveys: LokmaBoxSurvey[];
  lokmaBoxSyncError: string | null;

  // Cart & UI Recommendations Feedback (session state)
  cart: CartItem[];
  recommendationFeedback: Record<string, RecommendationFeedback>;
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: 'success' | 'error' | 'info') => void;

  // Cart Actions
  addToCart: (
    mealId: string,
    qty?: number,
    notes?: string,
    replaceDifferentProvider?: boolean
  ) => { ok: boolean; conflictProviderName?: string };
  updateCartQty: (mealId: string, qty: number) => void;
  removeFromCart: (mealId: string) => void;
  clearCart: () => void;
  setRecommendationFeedbackItem: (mealId: string, feedback: RecommendationFeedback) => void;

  // Student Actions
  updateStudentSettings: (payload: {
    daily_budget: number;
    weekly_budget: number;
    delivery_location: string;
    faculty: string;
    university_id: string;
    allergen_ids: string[];
    dietary_pref_ids: string[];
    category_prefs: Record<string, number>;
  }) => Promise<boolean>;
  placeOrder: (payload: {
    fulfillment_type: FulfillmentType;
    delivery_location: string;
    student_notes: string;
  }) => Promise<{ ok: boolean; orderId?: string; orderNumber?: string }>;
  transitionOrderStatus: (orderId: string, nextStatus: OrderStatus, note?: string) => Promise<boolean>;
  submitReview: (
    orderId: string,
    rating: number,
    comment: string,
    deliveryRating?: number | null,
    deliveryComment?: string
  ) => Promise<boolean>;
  fileComplaint: (payload: {
    against_user_id: string;
    order_id: string | null;
    subject: string;
    description: string;
  }) => Promise<boolean>;

  // Provider Actions
  registerOrUpdateProviderProfile: (payload: {
    business_name: string;
    bio: string;
    area: string;
    pickup_address: string;
    university_id: string;
    logo_url?: string;
  }) => Promise<boolean>;
  toggleProviderAcceptingOrders: () => Promise<void>;
  saveMeal: (payload: {
    id?: string;
    provider_id?: string;
    category_id: string;
    name: string;
    name_ar?: string;
    description: string;
    price: number;
    portion_description: string;
    prep_time_minutes: number;
    is_available: boolean;
    image_url: string;
    calories_kcal?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    serving_size_g?: number;
    ingredients_text?: string;
    allergen_ids: string[];
    dietary_pref_ids: string[];
    silentToast?: boolean;
  }) => Promise<boolean>;
  toggleMealAvailability: (mealId: string) => Promise<boolean>;
  softDeleteMeal: (mealId: string) => Promise<void>;
  deleteMealSafely: (mealId: string) => Promise<{
    ok: boolean;
    reason?: 'active_orders' | 'unauthorized' | 'not_found' | 'error';
    activeOrdersCount?: number;
    mode?: 'hard_deleted' | 'archived';
  }>;
  replyToReview: (reviewId: string, response: string) => Promise<void>;

  // Delivery Partner Actions
  applyAsDeliveryPartner: (payload: {
    university_id: string;
    national_id_last4: string;
    student_card_id: string;
    delivery_method: DeliveryMethod;
    availability_schedule: string;
    phone?: string;
  }) => Promise<boolean>;
  toggleDeliveryPartnerOnline: () => Promise<void>;
  updateDeliveryPartnerMethod: (method: DeliveryMethod, schedule: string) => Promise<void>;
  acceptDeliveryRequest: (orderId: string) => Promise<boolean>;
  updateDeliveryStep: (
    orderId: string,
    nextStatus: 'picked_up' | 'out_for_delivery' | 'delivered'
  ) => Promise<boolean>;

  // Admin Actions
  setUserStatus: (userId: string, status: UserStatus) => Promise<void>;
  setProviderVerification: (providerId: string, status: VerificationStatus) => Promise<void>;
  setDeliveryPartnerVerification: (partnerId: string, status: VerificationStatus) => Promise<void>;
  assignDeliveryPartnerByAdmin: (orderId: string, partnerId: string) => Promise<boolean>;
  updateDeliveryPricingConfig: (cfg: {
    customer_delivery_fee: number;
    partner_earning: number;
    platform_commission: number;
  }) => Promise<boolean>;
  addLookupItem: (
    kind: 'category' | 'allergen' | 'dietary' | 'university',
    payload: {
      name_ar: string;
      name_en: string;
      is_restriction?: boolean;
      city?: string;
      governorate?: string;
    }
  ) => Promise<boolean>;
  toggleCategoryActive: (catId: string) => Promise<void>;
  updateComplaintStatus: (
    complaintId: string,
    status: ComplaintStatus,
    resolutionNote: string
  ) => Promise<void>;
  toggleReviewVisibility: (reviewId: string) => Promise<void>;

  // Notifications
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const LokmaContext = createContext<LokmaContextValue | undefined>(undefined);

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function mapProviderDoc(id: string, d: Record<string, unknown>): ProviderProfile {
  return {
    user_id: String(d.user_id || id),
    university_id: String(d.university_id || ''),
    business_name: String(d.business_name || ''),
    bio: String(d.bio || ''),
    area: String(d.area || ''),
    pickup_address: String(d.pickup_address || ''),
    logo_url: String(d.logo_url || ''),
    verification_status: (d.verification_status as VerificationStatus) || 'pending',
    verified_by: d.verified_by ? String(d.verified_by) : null,
    verified_at: d.verified_at ? tsToIso(d.verified_at) : null,
    is_accepting_orders: Boolean(d.is_accepting_orders),
    avg_rating: Number(d.avg_rating || 0),
    review_count: Number(d.review_count || 0),
    created_at: tsToIso(d.createdAt),
    updated_at: tsToIso(d.updatedAt),
  };
}

function mapMealDoc(id: string, d: Record<string, unknown>): Meal {
  return {
    id,
    provider_id: String(d.provider_id || ''),
    provider_name: d.provider_name ? String(d.provider_name) : undefined,
    category_id: String(d.category_id || ''),
    name: String(d.name || ''),
    name_ar: d.name_ar ? String(d.name_ar) : undefined,
    description: String(d.description || ''),
    price: Number(d.price || 0),
    portion_description: String(d.portion_description || ''),
    image_url: String(d.image_url || ''),
    prep_time_minutes: Number(d.prep_time_minutes || 15),
    is_available: Boolean(d.is_available),
    deleted_at: d.deleted_at ? tsToIso(d.deleted_at) : null,
    calories_kcal: d.calories_kcal !== undefined ? Number(d.calories_kcal) : undefined,
    protein_g: d.protein_g !== undefined ? Number(d.protein_g) : undefined,
    carbs_g: d.carbs_g !== undefined ? Number(d.carbs_g) : undefined,
    fat_g: d.fat_g !== undefined ? Number(d.fat_g) : undefined,
    fiber_g: d.fiber_g !== undefined ? Number(d.fiber_g) : undefined,
    serving_size_g: d.serving_size_g !== undefined ? Number(d.serving_size_g) : undefined,
    ingredients_text: d.ingredients_text ? String(d.ingredients_text) : undefined,
    allergen_ids: Array.isArray(d.allergen_ids) ? d.allergen_ids.map(String) : [],
    dietary_pref_ids: Array.isArray(d.dietary_pref_ids) ? d.dietary_pref_ids.map(String) : [],
    created_at: tsToIso(d.createdAt),
    updated_at: tsToIso(d.updatedAt),
  };
}

function mapOrderDoc(id: string, d: Record<string, unknown>): Order {
  return {
    id,
    order_number: String(d.order_number || ''),
    student_id: String(d.student_id || ''),
    student_name: String(d.student_name || ''),
    student_phone: d.student_phone ? String(d.student_phone) : undefined,
    provider_id: String(d.provider_id || ''),
    provider_name: String(d.provider_name || ''),
    delivery_partner_id: d.delivery_partner_id ? String(d.delivery_partner_id) : null,
    delivery_partner_name: d.delivery_partner_name ? String(d.delivery_partner_name) : null,
    delivery_partner_method: d.delivery_partner_method ? String(d.delivery_partner_method) : null,
    status: (d.status as OrderStatus) || 'pending',
    fulfillment_type: (d.fulfillment_type as FulfillmentType) || 'delivery',
    delivery_location: String(d.delivery_location || ''),
    subtotal_amount: Number(d.subtotal_amount || 0),
    delivery_fee: Number(d.delivery_fee || 0),
    total_amount: Number(d.total_amount || 0),
    payment_method: 'cash',
    payment_status: d.payment_status === 'paid' ? 'paid' : 'unpaid',
    student_notes: String(d.student_notes || ''),
    item_count: Number(d.item_count || 0),
    items_summary: Array.isArray(d.items_summary) ? d.items_summary : [],
    status_history: Array.isArray(d.status_history) ? d.status_history : [],
    created_at: tsToIso(d.createdAt),
    updated_at: tsToIso(d.updatedAt),
  };
}

function mapDeliveryPartnerDoc(id: string, d: Record<string, unknown>): DeliveryPartnerProfile {
  return {
    user_id: String(d.user_id || id),
    full_name: String(d.full_name || ''),
    phone: d.phone ? String(d.phone) : '',
    university_id: String(d.university_id || ''),
    national_id_last4: String(d.national_id_last4 || ''),
    student_card_id: String(d.student_card_id || ''),
    delivery_method: d.delivery_method === 'bicycle' ? 'bicycle' : 'walking',
    verification_status: (d.verification_status as VerificationStatus) || 'pending',
    verified_by: d.verified_by ? String(d.verified_by) : null,
    verified_at: d.verified_at ? tsToIso(d.verified_at) : null,
    is_online: Boolean(d.is_online),
    availability_schedule: String(d.availability_schedule || ''),
    completed_deliveries: Number(d.completed_deliveries || 0),
    created_at: tsToIso(d.createdAt),
    updated_at: tsToIso(d.updatedAt),
  };
}

function mapReviewDoc(id: string, d: Record<string, unknown>): Review {
  return {
    id,
    order_id: String(d.order_id || id),
    student_id: String(d.student_id || ''),
    provider_id: String(d.provider_id || ''),
    delivery_partner_id: d.delivery_partner_id ? String(d.delivery_partner_id) : null,
    rating: Number(d.rating || 5),
    delivery_rating: d.delivery_rating !== null && d.delivery_rating !== undefined ? Number(d.delivery_rating) : null,
    comment: String(d.comment || ''),
    delivery_comment: d.delivery_comment ? String(d.delivery_comment) : null,
    provider_response: d.provider_response ? String(d.provider_response) : null,
    responded_at: d.responded_at ? tsToIso(d.responded_at) : null,
    is_visible: Boolean(d.is_visible),
    created_at: tsToIso(d.createdAt),
    updated_at: tsToIso(d.updatedAt),
  };
}

export const LokmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, userDoc, isAdmin } = useFirebaseAuth();

  const [lang, setLang] = useState<Language>('ar');
  const [view, setView] = useState<AppView>('landing');
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [adminSyncLoading, setAdminSyncLoading] = useState<boolean>(false);
  const [adminSyncError, setAdminSyncError] = useState<string | null>(null);
  const [adminRetryCounter, setAdminRetryCounter] = useState<number>(0);

  // Public Firestore collections
  const [universities, setUniversities] = useState<University[]>([]);
  const [mealCategories, setMealCategories] = useState<MealCategory[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreference[]>([]);
  const [verifiedProviders, setVerifiedProviders] = useState<ProviderProfile[]>([]);
  const [adminAllProviders, setAdminAllProviders] = useState<ProviderProfile[]>([]);
  const [myProviderProfile, setMyProviderProfile] = useState<ProviderProfile | null>(null);
  const [myStudentProfile, setMyStudentProfile] = useState<StudentProfile | null>(null);
  const [myDeliveryPartnerProfile, setMyDeliveryPartnerProfile] =
    useState<DeliveryPartnerProfile | null>(null);
  const [allDeliveryPartnerProfiles, setAllDeliveryPartnerProfiles] = useState<
    DeliveryPartnerProfile[]
  >([]);
  const [users, setUsers] = useState<User[]>([]);

  // Meals merged across public available + provider own + admin all
  const [publicMeals, setPublicMeals] = useState<Meal[]>([]);
  const [ownProviderMeals, setOwnProviderMeals] = useState<Meal[]>([]);
  const [adminAllMeals, setAdminAllMeals] = useState<Meal[]>([]);

  // Orders merged across student + provider + partner + admin
  const [studentOrders, setStudentOrders] = useState<Order[]>([]);
  const [providerOrders, setProviderOrders] = useState<Order[]>([]);
  const [partnerOrders, setPartnerOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);

  const [deliveryOffers, setDeliveryOffers] = useState<DeliveryOffer[]>([]);
  const [deliveryTransactions, setDeliveryTransactions] = useState<DeliveryTransaction[]>([]);
  const [deliveryPricingConfig, setDeliveryPricingConfig] = useState<DeliveryPricingConfig>({
    customer_delivery_fee: 15,
    partner_earning: 12,
    platform_commission: 3,
    updated_at: '',
  });
  const [visibleReviews, setVisibleReviews] = useState<Review[]>([]);
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [lokmaBoxLeads, setLokmaBoxLeads] = useState<LokmaBoxLead[]>([]);
  const [lokmaBoxSurveys, setLokmaBoxSurveys] = useState<LokmaBoxSurvey[]>([]);
  const [lokmaBoxSyncError, setLokmaBoxSyncError] = useState<string | null>(null);

  // Persistent Cart (localStorage) + transient recommendation feedback
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('lokma_cart_v1') : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (item): item is CartItem =>
            Boolean(item) &&
            typeof item.meal_id === 'string' &&
            typeof item.quantity === 'number' &&
            item.quantity >= 1
        )
        .slice(0, 5)
        .map((item) => ({
          meal_id: item.meal_id,
          quantity: Math.max(1, Math.min(20, Math.round(item.quantity))),
          notes: typeof item.notes === 'string' ? item.notes.slice(0, 300) : '',
        }));
    } catch {
      return [];
    }
  });
  const [recommendationFeedback, setRecommendationFeedback] = useState<
    Record<string, RecommendationFeedback>
  >({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isTokenAdminUser = Boolean(
    firebaseUser?.emailVerified &&
      firebaseUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL
  );

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem('lokma_cart_v1', JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  const pushToast = (text: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const handleMutationError = (
    err: unknown,
    operationType: OperationType,
    path: string,
    arMessage: string,
    enMessage: string
  ) => {
    console.error(
      'Firestore Error:',
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
        operationType,
        path,
      })
    );
    pushToast(lang === 'ar' ? arMessage : enMessage, 'error');
  };

  // Clear user-scoped data & cart on sign out
  useEffect(() => {
    if (!firebaseUser) {
      setCart([]);
      setRecommendationFeedback({});
      setMyStudentProfile(null);
      setMyProviderProfile(null);
      setMyDeliveryPartnerProfile(null);
      setOwnProviderMeals([]);
      setStudentOrders([]);
      setProviderOrders([]);
      setPartnerOrders([]);
      setDeliveryOffers([]);
      setDeliveryTransactions([]);
      setNotifications([]);
      setComplaints([]);
      setUsers([]);
      setAdminAllProviders([]);
      setAllDeliveryPartnerProfiles([]);
      setAdminAllMeals([]);
      setAdminOrders([]);
      setAdminReviews([]);
      setLokmaBoxLeads([]);
      setLokmaBoxSurveys([]);
      setLokmaBoxSyncError(null);
    }
  }, [firebaseUser]);

  // 1. Public Firestore Listeners
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'universities'),
        (snap) => {
          setUniversities(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name_ar: String(d.name_ar || ''),
                name_en: String(d.name_en || ''),
                city: String(d.city || ''),
                governorate: String(d.governorate || ''),
                is_active: d.is_active !== false,
                created_at: tsToIso(d.createdAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'universities')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'meal_categories'),
        (snap) => {
          const list = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name_ar: String(d.name_ar || ''),
              name_en: String(d.name_en || ''),
              sort_order: Number(d.sort_order || 0),
              is_active: d.is_active !== false,
              created_at: tsToIso(d.createdAt),
            };
          });
          list.sort((a, b) => a.sort_order - b.sort_order);
          setMealCategories(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'meal_categories')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'allergens'),
        (snap) => {
          setAllergens(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                code: String(d.code || docSnap.id),
                name_ar: String(d.name_ar || ''),
                name_en: String(d.name_en || ''),
                created_at: tsToIso(d.createdAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'allergens')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'dietary_preferences'),
        (snap) => {
          setDietaryPreferences(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                code: String(d.code || docSnap.id),
                name_ar: String(d.name_ar || ''),
                name_en: String(d.name_en || ''),
                is_restriction: Boolean(d.is_restriction),
                created_at: tsToIso(d.createdAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'dietary_preferences')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'config', 'delivery_pricing'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setDeliveryPricingConfig({
              customer_delivery_fee: Number(d.customer_delivery_fee ?? 15),
              partner_earning: Number(d.partner_earning ?? 12),
              platform_commission: Number(d.platform_commission ?? 3),
              updated_at: tsToIso(d.updatedAt),
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'config/delivery_pricing')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'provider_profiles'), where('verification_status', '==', 'verified')),
        (snap) => {
          setVerifiedProviders(snap.docs.map((ds) => mapProviderDoc(ds.id, ds.data())));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'provider_profiles')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'meals'), where('is_available', '==', true)),
        (snap) => {
          setPublicMeals(
            snap.docs
              .map((ds) => mapMealDoc(ds.id, ds.data()))
              .filter((m) => m.deleted_at === null)
          );
          setDataLoading(false);
        },
        (err) => {
          setDataLoading(false);
          handleFirestoreError(err, OperationType.LIST, 'meals');
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'reviews'), where('is_visible', '==', true)),
        (snap) => {
          setVisibleReviews(snap.docs.map((ds) => mapReviewDoc(ds.id, ds.data())));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // 2. Authenticated Owner-Scoped Firestore Listeners
  useEffect(() => {
    if (!firebaseUser || !isFirebaseAccountVerified(firebaseUser)) return;
    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'student_profiles', uid),
        (snap) => {
          if (!snap.exists()) {
            setMyStudentProfile(null);
            return;
          }
          const d = snap.data();
          setMyStudentProfile({
            user_id: String(d.user_id || snap.id),
            university_id: String(d.university_id || ''),
            university_name: d.university_name ? String(d.university_name) : '',
            faculty: String(d.faculty || ''),
            academic_year: d.academic_year ? Number(d.academic_year) : undefined,
            daily_budget: Number(d.daily_budget || 0),
            weekly_budget: Number(d.weekly_budget || 0),
            delivery_location: String(d.delivery_location || ''),
            allergen_ids: Array.isArray(d.allergen_ids) ? d.allergen_ids.map(String) : [],
            dietary_pref_ids: Array.isArray(d.dietary_pref_ids) ? d.dietary_pref_ids.map(String) : [],
            category_prefs:
              d.category_prefs && typeof d.category_prefs === 'object' ? d.category_prefs : {},
            created_at: tsToIso(d.createdAt),
            updated_at: tsToIso(d.updatedAt),
          });
        },
        (err) => handleFirestoreError(err, OperationType.GET, `student_profiles/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'provider_profiles', uid),
        (snap) => {
          if (!snap.exists()) {
            setMyProviderProfile(null);
            return;
          }
          setMyProviderProfile(mapProviderDoc(snap.id, snap.data()));
        },
        (err) => handleFirestoreError(err, OperationType.GET, `provider_profiles/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'delivery_partner_profiles', uid),
        (snap) => {
          if (!snap.exists()) {
            setMyDeliveryPartnerProfile(null);
            return;
          }
          setMyDeliveryPartnerProfile(mapDeliveryPartnerDoc(snap.id, snap.data()));
        },
        (err) => handleFirestoreError(err, OperationType.GET, `delivery_partner_profiles/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'meals'), where('provider_id', '==', uid)),
        (snap) => {
          setOwnProviderMeals(
            snap.docs
              .map((ds) => mapMealDoc(ds.id, ds.data()))
              .filter((m) => m.deleted_at === null)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'meals')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('student_id', '==', uid)),
        (snap) => {
          setStudentOrders(snap.docs.map((ds) => mapOrderDoc(ds.id, ds.data())));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('provider_id', '==', uid)),
        (snap) => {
          setProviderOrders(snap.docs.map((ds) => mapOrderDoc(ds.id, ds.data())));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('delivery_partner_id', '==', uid)),
        (snap) => {
          setPartnerOrders(snap.docs.map((ds) => mapOrderDoc(ds.id, ds.data())));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'delivery_transactions'), where('delivery_partner_id', '==', uid)),
        (snap) => {
          if (isTokenAdminUser) return;
          setDeliveryTransactions(
            snap.docs.map((ds) => {
              const d = ds.data();
              return {
                id: ds.id,
                order_id: String(d.order_id || ''),
                order_number: String(d.order_number || ''),
                delivery_partner_id: String(d.delivery_partner_id || ''),
                customer_delivery_fee: Number(d.customer_delivery_fee || 0),
                partner_earning: Number(d.partner_earning || 0),
                platform_commission: Number(d.platform_commission || 0),
                status: d.status === 'settled' ? 'settled' : 'recorded',
                created_at: tsToIso(d.createdAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'delivery_transactions')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('user_id', '==', uid)),
        (snap) => {
          const list: Notification[] = snap.docs.map((ds) => {
            const d = ds.data();
            return {
              id: ds.id,
              user_id: String(d.user_id || ''),
              type: d.type || 'order_placed',
              title: String(d.title || ''),
              body: String(d.body || ''),
              order_id: d.order_id ? String(d.order_id) : null,
              status: d.status === 'read' ? 'read' : 'unread',
              read_at: d.read_at ? tsToIso(d.read_at) : null,
              created_at: tsToIso(d.createdAt),
            };
          });
          list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
          setNotifications(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    if (!isTokenAdminUser) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'complaints'), where('complainant_id', '==', uid)),
          (snap) => {
            setComplaints(
              snap.docs.map((ds) => {
                const d = ds.data();
                return {
                  id: ds.id,
                  complainant_id: String(d.complainant_id || ''),
                  against_user_id: String(d.against_user_id || ''),
                  order_id: d.order_id ? String(d.order_id) : null,
                  subject: String(d.subject || ''),
                  description: String(d.description || ''),
                  status: (d.status as ComplaintStatus) || 'open',
                  resolved_by: d.resolved_by ? String(d.resolved_by) : null,
                  resolution_note: d.resolution_note ? String(d.resolution_note) : null,
                  resolved_at: d.resolved_at ? tsToIso(d.resolved_at) : null,
                  created_at: tsToIso(d.createdAt),
                  updated_at: tsToIso(d.updatedAt),
                };
              })
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, isTokenAdminUser]);

  // 3. Verified Delivery Partner Open Offers Listener
  useEffect(() => {
    if (
      !firebaseUser ||
      !isFirebaseAccountVerified(firebaseUser) ||
      myDeliveryPartnerProfile?.verification_status !== 'verified'
    ) {
      setDeliveryOffers([]);
      return;
    }

    const unsub = onSnapshot(
      query(collection(db, 'delivery_offers'), where('status', '==', 'open')),
      (snap) => {
        setDeliveryOffers(
          snap.docs.map((ds) => {
            const d = ds.data();
            return {
              id: ds.id,
              order_id: String(d.order_id || ds.id),
              order_number: String(d.order_number || ''),
              provider_id: String(d.provider_id || ''),
              provider_name: String(d.provider_name || ''),
              pickup_address: String(d.pickup_address || ''),
              delivery_area_hint: d.delivery_area_hint ? String(d.delivery_area_hint) : '',
              partner_earning: Number(d.partner_earning || 0),
              total_amount: Number(d.total_amount || 0),
              status: 'open',
              delivery_partner_id: d.delivery_partner_id ? String(d.delivery_partner_id) : null,
              created_at: tsToIso(d.createdAt),
              updated_at: tsToIso(d.updatedAt),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'delivery_offers')
    );

    return () => unsub();
  }, [firebaseUser, myDeliveryPartnerProfile?.verification_status]);

  const retryAdminSync = () => {
    setAdminSyncError(null);
    setAdminRetryCounter((c) => c + 1);
  };

  // 4. Token Admin Broad Platform Listeners
  useEffect(() => {
    if (!isTokenAdminUser) {
      setAdminSyncLoading(false);
      setAdminSyncError(null);
      setLokmaBoxLeads([]);
      setLokmaBoxSurveys([]);
      setLokmaBoxSyncError(null);
      return;
    }

    setAdminSyncLoading(true);
    setAdminSyncError(null);
    setLokmaBoxSyncError(null);

    const expectedStreams = [
      'users',
      'provider_profiles',
      'delivery_partner_profiles',
      'meals',
      'orders',
      'delivery_transactions',
      'reviews',
      'complaints',
    ];
    const settledStreams = new Set<string>();
    const markSettled = (name: string) => {
      settledStreams.add(name);
      if (settledStreams.size >= expectedStreams.length) {
        setAdminSyncLoading(false);
      }
    };
    const handleAdminSnapshotError = (streamName: string, err: unknown) => {
      console.error(`Admin Firestore listener failed (${streamName}):`, err);
      markSettled(streamName);
      setAdminSyncError(
        lang === 'ar'
          ? 'تعذر مزامنة بيانات الإدارة من قاعدة البيانات. يرجى التحقق من الاتصال والصلاحيات والمحاولة مرة أخرى.'
          : 'Could not sync platform administration data from Firestore. Please check connection and permissions and retry.'
      );
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setUsers(
            snap.docs.map((ds) => {
              const d = ds.data();
              return {
                id: String(d.id || ds.id),
                full_name: String(d.full_name || ''),
                email: String(d.email || ''),
                phone: String(d.phone || ''),
                role: d.role || 'student',
                status: d.status || 'active',
                auth_method:
                  d.auth_method === 'phone' || d.auth_method === 'google' || d.auth_method === 'email'
                    ? d.auth_method
                    : undefined,
                email_verified: typeof d.email_verified === 'boolean' ? d.email_verified : undefined,
                phone_verified: typeof d.phone_verified === 'boolean' ? d.phone_verified : undefined,
                terms_accepted_at: d.terms_accepted_at ? tsToIso(d.terms_accepted_at) : undefined,
                last_login_at: d.last_login_at ? tsToIso(d.last_login_at) : undefined,
                created_at: tsToIso(d.createdAt),
                updated_at: tsToIso(d.updatedAt),
              };
            })
          );
          markSettled('users');
        },
        (err) => handleAdminSnapshotError('users', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'provider_profiles'),
        (snap) => {
          setAdminAllProviders(snap.docs.map((ds) => mapProviderDoc(ds.id, ds.data())));
          markSettled('provider_profiles');
        },
        (err) => handleAdminSnapshotError('provider_profiles', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'delivery_partner_profiles'),
        (snap) => {
          setAllDeliveryPartnerProfiles(
            snap.docs.map((ds) => mapDeliveryPartnerDoc(ds.id, ds.data()))
          );
          markSettled('delivery_partner_profiles');
        },
        (err) => handleAdminSnapshotError('delivery_partner_profiles', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'meals'),
        (snap) => {
          setAdminAllMeals(
            snap.docs
              .map((ds) => mapMealDoc(ds.id, ds.data()))
              .filter((m) => m.deleted_at === null)
          );
          markSettled('meals');
        },
        (err) => handleAdminSnapshotError('meals', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          setAdminOrders(snap.docs.map((ds) => mapOrderDoc(ds.id, ds.data())));
          markSettled('orders');
        },
        (err) => handleAdminSnapshotError('orders', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'delivery_transactions'),
        (snap) => {
          setDeliveryTransactions(
            snap.docs.map((ds) => {
              const d = ds.data();
              return {
                id: ds.id,
                order_id: String(d.order_id || ''),
                order_number: String(d.order_number || ''),
                delivery_partner_id: String(d.delivery_partner_id || ''),
                customer_delivery_fee: Number(d.customer_delivery_fee || 0),
                partner_earning: Number(d.partner_earning || 0),
                platform_commission: Number(d.platform_commission || 0),
                status: d.status === 'settled' ? 'settled' : 'recorded',
                created_at: tsToIso(d.createdAt),
              };
            })
          );
          markSettled('delivery_transactions');
        },
        (err) => handleAdminSnapshotError('delivery_transactions', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'reviews'),
        (snap) => {
          setAdminReviews(snap.docs.map((ds) => mapReviewDoc(ds.id, ds.data())));
          markSettled('reviews');
        },
        (err) => handleAdminSnapshotError('reviews', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'complaints'),
        (snap) => {
          setComplaints(
            snap.docs.map((ds) => {
              const d = ds.data();
              return {
                id: ds.id,
                complainant_id: String(d.complainant_id || ''),
                against_user_id: String(d.against_user_id || ''),
                order_id: d.order_id ? String(d.order_id) : null,
                subject: String(d.subject || ''),
                description: String(d.description || ''),
                status: (d.status as ComplaintStatus) || 'open',
                resolved_by: d.resolved_by ? String(d.resolved_by) : null,
                resolution_note: d.resolution_note ? String(d.resolution_note) : null,
                resolved_at: d.resolved_at ? tsToIso(d.resolved_at) : null,
                created_at: tsToIso(d.createdAt),
                updated_at: tsToIso(d.updatedAt),
              };
            })
          );
          markSettled('complaints');
        },
        (err) => handleAdminSnapshotError('complaints', err)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'lokma_box_leads'),
        (snap) => {
          const list: LokmaBoxLead[] = snap.docs.map((ds) => {
            const d = ds.data();
            return {
              id: ds.id,
              full_name: String(d.full_name || ''),
              phone: String(d.phone || ''),
              email: d.email ? String(d.email) : null,
              university_id: d.university_id ? String(d.university_id) : null,
              university_name: String(d.university_name || ''),
              housing_area: String(d.housing_area || ''),
              wants_to_try: (d.wants_to_try as LokmaBoxTryInterest) || 'yes',
              consent_accepted: Boolean(d.consent_accepted),
              consent_accepted_at: tsToIso(d.consent_accepted_at),
              user_id: d.user_id ? String(d.user_id) : null,
              source: 'landing_lokma_box',
              created_at: tsToIso(d.createdAt),
            };
          });
          list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
          setLokmaBoxLeads(list);
          setLokmaBoxSyncError(null);
        },
        (err) => {
          console.error('Admin Firestore listener failed (lokma_box_leads):', err);
          setLokmaBoxSyncError(
            lang === 'ar'
              ? 'تعذر تحميل بيانات LOKMA BOX من قاعدة البيانات. تأكد من نشر قواعد Firestore المحدثة.'
              : 'Could not load LOKMA BOX market research leads. Ensure updated Firestore rules are published.'
          );
        }
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'lokma_box_surveys'),
        (snap) => {
          const list: LokmaBoxSurvey[] = snap.docs.map((ds) => {
            const d = ds.data();
            return {
              id: ds.id,
              daily_prep_difficulty:
                (d.daily_prep_difficulty as LokmaBoxPrepDifficulty) || 'sometimes',
              biggest_food_problem: (d.biggest_food_problem as LokmaBoxFoodProblem) || 'time',
              preferred_meal_types: Array.isArray(d.preferred_meal_types)
                ? (d.preferred_meal_types.map(String) as LokmaBoxMealType[])
                : [],
              preferred_prep_time: (d.preferred_prep_time as LokmaBoxPrepTime) || '10_to_20_min',
              preferred_budget_tier:
                (d.preferred_budget_tier as LokmaBoxBudgetTier) || '50_to_75',
              purchase_frequency: (d.purchase_frequency as LokmaBoxPurchaseFrequency) || 'weekly',
              preferred_box_timing: (d.preferred_box_timing as LokmaBoxTimingPreference) || 'lunch',
              willing_to_buy: (d.willing_to_buy as LokmaBoxWillingnessToBuy) || 'maybe',
              suggestions: String(d.suggestions || ''),
              university_name: d.university_name ? String(d.university_name) : null,
              consent_accepted: Boolean(d.consent_accepted),
              user_id: d.user_id ? String(d.user_id) : null,
              created_at: tsToIso(d.createdAt),
            };
          });
          list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
          setLokmaBoxSurveys(list);
        },
        (err) => {
          console.error('Admin Firestore listener failed (lokma_box_surveys):', err);
          setLokmaBoxSyncError(
            lang === 'ar'
              ? 'تعذر تحميل نتائج استبيان LOKMA BOX من قاعدة البيانات. تأكد من نشر قواعد Firestore المحدثة.'
              : 'Could not load LOKMA BOX survey results. Ensure updated Firestore rules are published.'
          );
        }
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isTokenAdminUser, adminRetryCounter, lang]);

  // Deduplicated merged views
  const providerProfiles = useMemo(() => {
    const map = new Map<string, ProviderProfile>();
    verifiedProviders.forEach((p) => map.set(p.user_id, p));
    if (myProviderProfile) map.set(myProviderProfile.user_id, myProviderProfile);
    if (isTokenAdminUser) {
      adminAllProviders.forEach((p) => map.set(p.user_id, p));
    }
    return Array.from(map.values());
  }, [verifiedProviders, myProviderProfile, isTokenAdminUser, adminAllProviders]);

  const meals = useMemo(() => {
    const map = new Map<string, Meal>();
    publicMeals.forEach((m) => map.set(m.id, m));
    ownProviderMeals.forEach((m) => map.set(m.id, m));
    if (isTokenAdminUser) {
      adminAllMeals.forEach((m) => map.set(m.id, m));
    }
    return Array.from(map.values()).filter((m) => m.deleted_at === null);
  }, [publicMeals, ownProviderMeals, isTokenAdminUser, adminAllMeals]);

  // Prune unavailable/deleted meals from restored cart once live catalog has loaded
  useEffect(() => {
    if (dataLoading || cart.length === 0 || meals.length === 0) return;
    const valid = cart.filter((ci) => {
      const m = meals.find((meal) => meal.id === ci.meal_id);
      return Boolean(m && m.is_available && m.deleted_at === null);
    });
    if (valid.length !== cart.length) {
      setCart(valid);
    }
  }, [dataLoading, meals, cart]);

  const orders = useMemo(() => {
    const map = new Map<string, Order>();
    studentOrders.forEach((o) => map.set(o.id, o));
    providerOrders.forEach((o) => map.set(o.id, o));
    partnerOrders.forEach((o) => map.set(o.id, o));
    if (isTokenAdminUser) {
      adminOrders.forEach((o) => map.set(o.id, o));
    }
    return Array.from(map.values()).sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
  }, [studentOrders, providerOrders, partnerOrders, isTokenAdminUser, adminOrders]);

  const reviews = useMemo(() => {
    const map = new Map<string, Review>();
    visibleReviews.forEach((r) => map.set(r.id, r));
    if (isTokenAdminUser) {
      adminReviews.forEach((r) => map.set(r.id, r));
    }
    return Array.from(map.values()).sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
  }, [visibleReviews, isTokenAdminUser, adminReviews]);

  const toggleLang = () => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));

  const requireVerifiedAuth = (): string | null => {
    if (!firebaseUser) {
      pushToast(
        lang === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first',
        'info'
      );
      return null;
    }
    if (!isFirebaseAccountVerified(firebaseUser)) {
      pushToast(
        lang === 'ar'
          ? 'يرجى تأكيد حسابك (البريد الإلكتروني أو رقم الهاتف) قبل إجراء هذه العملية'
          : 'Please verify your email or phone number first',
        'error'
      );
      return null;
    }
    if (userDoc?.status === 'suspended') {
      pushToast(
        lang === 'ar' ? 'هذا الحساب موقوف حالياً' : 'This account is suspended',
        'error'
      );
      return null;
    }
    return firebaseUser.uid;
  };

  // Cart Actions
  const addToCart = (
    mealId: string,
    qty = 1,
    notes = '',
    replaceDifferentProvider = false
  ): { ok: boolean; conflictProviderName?: string } => {
    const targetMeal = meals.find((m) => m.id === mealId);
    if (!targetMeal || !targetMeal.is_available || targetMeal.deleted_at !== null) {
      return { ok: false };
    }

    if (cart.length > 0) {
      const firstMeal = meals.find((m) => m.id === cart[0].meal_id);
      if (firstMeal && firstMeal.provider_id !== targetMeal.provider_id && !replaceDifferentProvider) {
        const conflictProv = providerProfiles.find((p) => p.user_id === firstMeal.provider_id);
        return {
          ok: false,
          conflictProviderName: conflictProv?.business_name || firstMeal.provider_name || 'Kitchen',
        };
      }
      if (firstMeal && firstMeal.provider_id !== targetMeal.provider_id && replaceDifferentProvider) {
        setCart([{ meal_id: mealId, quantity: Math.max(1, Math.min(20, qty)), notes }]);
        pushToast(
          lang === 'ar' ? 'تم بدء سلة جديدة من المطبخ المختار' : 'Started new cart from selected kitchen',
          'info'
        );
        return { ok: true };
      }
    }

    const exists = cart.find((c) => c.meal_id === mealId);
    if (!exists && cart.length >= 5) {
      pushToast(
        lang === 'ar'
          ? 'الحد الأقصى 5 أصناف مختلفة في الطلب الواحد'
          : 'Maximum 5 distinct meal items per order',
        'error'
      );
      return { ok: false };
    }

    setCart((prev) => {
      const found = prev.find((c) => c.meal_id === mealId);
      if (found) {
        return prev.map((c) =>
          c.meal_id === mealId
            ? { ...c, quantity: Math.min(20, c.quantity + qty) }
            : c
        );
      }
      return [...prev, { meal_id: mealId, quantity: Math.max(1, Math.min(20, qty)), notes }];
    });
    pushToast(lang === 'ar' ? 'تمت إضافة الوجبة للسلة' : 'Added meal to cart');
    return { ok: true };
  };

  const updateCartQty = (mealId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(mealId);
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.meal_id === mealId ? { ...c, quantity: Math.min(20, qty) } : c))
    );
  };

  const removeFromCart = (mealId: string) => {
    setCart((prev) => prev.filter((c) => c.meal_id !== mealId));
  };

  const clearCart = () => setCart([]);

  const setRecommendationFeedbackItem = (mealId: string, feedback: RecommendationFeedback) => {
    setRecommendationFeedback((prev) => ({ ...prev, [mealId]: feedback }));
  };

  // Student Actions
  const updateStudentSettings: LokmaContextValue['updateStudentSettings'] = async (payload) => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;
    const path = `student_profiles/${uid}`;
    const uni = universities.find((u) => u.id === payload.university_id);
    const data = {
      user_id: uid,
      university_id: payload.university_id.slice(0, 128),
      university_name: (uni ? (lang === 'ar' ? uni.name_ar : uni.name_en) : '').slice(0, 150),
      faculty: payload.faculty.trim().slice(0, 150),
      daily_budget: Math.max(0, Math.min(10000, Number(payload.daily_budget) || 0)),
      weekly_budget: Math.max(0, Math.min(50000, Number(payload.weekly_budget) || 0)),
      delivery_location: payload.delivery_location.trim().slice(0, 300),
      allergen_ids: payload.allergen_ids.slice(0, 30),
      dietary_pref_ids: payload.dietary_pref_ids.slice(0, 30),
      category_prefs: payload.category_prefs || {},
      updatedAt: serverTimestamp(),
    };
    try {
      if (myStudentProfile) {
        await updateDoc(doc(db, 'student_profiles', uid), data);
      } else {
        await setDoc(doc(db, 'student_profiles', uid), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      pushToast(
        lang === 'ar'
          ? 'تم حفظ ميزانيتك وتفضيلاتك الغذائية في قاعدة البيانات'
          : 'Budget and dietary settings saved'
      );
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        path,
        'تعذر حفظ الإعدادات. يرجى المحاولة مرة أخرى.',
        'Could not save budget settings. Please try again.'
      );
      return false;
    }
  };

  const placeOrder: LokmaContextValue['placeOrder'] = async (payload) => {
    const uid = requireVerifiedAuth();
    if (!uid) return { ok: false };

    if (cart.length === 0) {
      pushToast(lang === 'ar' ? 'السلة فارغة' : 'Cart is empty', 'error');
      return { ok: false };
    }
    if (cart.length > 5) {
      pushToast(
        lang === 'ar' ? 'الحد الأقصى 5 أصناف في الطلب الواحد' : 'Max 5 items per order',
        'error'
      );
      return { ok: false };
    }
    if (
      payload.fulfillment_type === 'delivery' &&
      payload.delivery_location.trim().length < 2
    ) {
      pushToast(
        lang === 'ar' ? 'يرجى إدخال عنوان التوصيل' : 'Please provide a delivery location',
        'error'
      );
      return { ok: false };
    }

    const lineItems = cart
      .map((ci) => {
        const meal = meals.find((m) => m.id === ci.meal_id);
        if (!meal || !meal.is_available || meal.deleted_at !== null) return null;
        const unitPrice = Number(meal.price);
        const lineTotal = Number((unitPrice * ci.quantity).toFixed(2));
        return {
          meal,
          meal_id: meal.id,
          meal_name: (lang === 'ar' ? meal.name_ar || meal.name : meal.name).slice(0, 150),
          quantity: ci.quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          notes: (ci.notes || '').slice(0, 300),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (lineItems.length !== cart.length || lineItems.length === 0) {
      pushToast(
        lang === 'ar' ? 'بعض الوجبات غير متاحة حالياً' : 'Some meals are no longer available',
        'error'
      );
      return { ok: false };
    }

    const providerId = lineItems[0].meal.provider_id;
    const provider = providerProfiles.find((p) => p.user_id === providerId);
    if (
      !provider ||
      provider.verification_status !== 'verified' ||
      !provider.is_accepting_orders
    ) {
      pushToast(
        lang === 'ar'
          ? 'هذا المطبخ غير متاح لاستقبال الطلبات حالياً'
          : 'This kitchen is not accepting orders right now',
        'error'
      );
      return { ok: false };
    }

    const subtotal = Number(
      lineItems.reduce((sum, li) => sum + li.line_total, 0).toFixed(2)
    );
    const deliveryFee =
      payload.fulfillment_type === 'delivery'
        ? Number(deliveryPricingConfig.customer_delivery_fee)
        : 0;
    const total = Number((subtotal + deliveryFee).toFixed(2));
    const orderRef = doc(collection(db, 'orders'));
    const orderNumber = `LKM-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const studentName = (
      userDoc?.full_name ||
      firebaseUser?.displayName ||
      firebaseUser?.email?.split('@')[0] ||
      'Student'
    )
      .trim()
      .slice(0, 120);

    const batch = writeBatch(db);
    batch.set(orderRef, {
      order_number: orderNumber,
      student_id: uid,
      student_name: studentName,
      student_phone: (userDoc?.phone || '').slice(0, 30),
      provider_id: providerId,
      provider_name: provider.business_name.slice(0, 150),
      delivery_partner_id: null,
      delivery_partner_name: null,
      delivery_partner_method: null,
      status: 'pending',
      fulfillment_type: payload.fulfillment_type,
      delivery_location:
        payload.fulfillment_type === 'delivery'
          ? payload.delivery_location.trim().slice(0, 300)
          : provider.pickup_address.slice(0, 300),
      subtotal_amount: subtotal,
      delivery_fee: deliveryFee,
      total_amount: total,
      payment_method: 'cash',
      payment_status: 'unpaid',
      student_notes: payload.student_notes.trim().slice(0, 500),
      item_count: lineItems.length,
      items_summary: lineItems.map((li) => ({
        meal_id: li.meal_id,
        meal_name: li.meal_name,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
        notes: li.notes,
      })),
      status_history: [
        {
          status: 'pending',
          changed_by: uid,
          note:
            lang === 'ar'
              ? 'تم إرسال الطلب إلى المطبخ'
              : 'Order sent to kitchen',
          created_at: nowIso,
        },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    lineItems.forEach((li, idx) => {
      batch.set(doc(db, 'orders', orderRef.id, 'items', `item_${idx}`), {
        meal_id: li.meal_id,
        meal_name: li.meal_name,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
        notes: li.notes,
        createdAt: serverTimestamp(),
      });
    });

    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      user_id: providerId,
      type: 'order_placed',
      title: lang === 'ar' ? `طلب جديد ${orderNumber}` : `New Order ${orderNumber}`,
      body:
        lang === 'ar'
          ? `طلب جديد من ${studentName} بقيمة ${subtotal} ج.م`
          : `New order from ${studentName} totaling ${subtotal} EGP`,
      order_id: orderRef.id,
      status: 'unread',
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      setCart([]);
      pushToast(
        lang === 'ar'
          ? `تم إرسال طلبك ${orderNumber} بنجاح`
          : `Order ${orderNumber} placed successfully`
      );
      return { ok: true, orderId: orderRef.id, orderNumber };
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        `orders/${orderRef.id}`,
        'تعذر إرسال الطلب حالياً. تأكد من الاتصال وحالة الوجبات.',
        'Could not submit order right now. Please check your connection and meal availability.'
      );
      return { ok: false };
    }
  };

  const transitionOrderStatus: LokmaContextValue['transitionOrderStatus'] = async (
    orderId,
    nextStatus,
    note = ''
  ) => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    const updatedHistory = [
      ...order.status_history.slice(-19),
      {
        status: nextStatus,
        changed_by: uid,
        note: note || nextStatus,
        created_at: nowIso,
      },
    ];

    const orderUpdate: Record<string, unknown> = {
      status: nextStatus,
      status_history: updatedHistory,
      updatedAt: serverTimestamp(),
    };
    if (nextStatus === 'delivered') {
      orderUpdate.payment_status = 'paid';
    }
    batch.update(doc(db, 'orders', orderId), orderUpdate);

    // If kitchen marks a delivery order ready_for_pickup, publish a non-PII DeliveryOffer
    if (nextStatus === 'ready_for_pickup' && order.fulfillment_type === 'delivery') {
      const prov = providerProfiles.find((p) => p.user_id === order.provider_id);
      batch.set(doc(db, 'delivery_offers', orderId), {
        order_id: orderId,
        order_number: order.order_number,
        provider_id: order.provider_id,
        provider_name: order.provider_name,
        pickup_address: (prov?.pickup_address || order.provider_name).slice(0, 300),
        delivery_area_hint: (prov?.area || '').slice(0, 150),
        partner_earning: Number(deliveryPricingConfig.partner_earning),
        total_amount: Number(order.total_amount),
        status: 'open',
        delivery_partner_id: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const targetNotifUser =
      nextStatus === 'cancelled' ? order.provider_id : order.student_id;
    batch.set(doc(collection(db, 'notifications')), {
      user_id: targetNotifUser,
      type: `order_${nextStatus}`,
      title: `${order.order_number}`,
      body:
        note ||
        (lang === 'ar'
          ? `تم تحديث حالة الطلب إلى ${nextStatus}`
          : `Order status updated to ${nextStatus}`),
      order_id: orderId,
      status: 'unread',
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      pushToast(lang === 'ar' ? 'تم تحديث حالة الطلب' : 'Order status updated');
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `orders/${orderId}`,
        'تعذر تحديث حالة الطلب. يرجى المحاولة مرة أخرى.',
        'Could not update order status.'
      );
      return false;
    }
  };

  const submitReview: LokmaContextValue['submitReview'] = async (
    orderId,
    rating,
    comment,
    deliveryRating = null,
    deliveryComment = ''
  ) => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'delivered') return false;

    const batch = writeBatch(db);
    batch.set(doc(db, 'reviews', orderId), {
      order_id: orderId,
      student_id: uid,
      provider_id: order.provider_id,
      delivery_partner_id: order.delivery_partner_id ?? null,
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      delivery_rating:
        order.fulfillment_type === 'delivery' && deliveryRating !== null
          ? Math.max(1, Math.min(5, Math.round(deliveryRating)))
          : null,
      comment: comment.trim().slice(0, 1000),
      delivery_comment: deliveryComment.trim()
        ? deliveryComment.trim().slice(0, 500)
        : null,
      provider_response: null,
      responded_at: null,
      is_visible: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'notifications')), {
      user_id: order.provider_id,
      type: 'review_received',
      title: lang === 'ar' ? 'تقييم جديد لطلب مكتمل' : 'New Order Review',
      body: `${order.order_number} · ${rating}/5`,
      order_id: orderId,
      status: 'unread',
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      pushToast(lang === 'ar' ? 'شكراً لتقييمك!' : 'Thank you for your review!');
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        `reviews/${orderId}`,
        'تعذر إرسال التقييم. يرجى المحاولة مرة أخرى.',
        'Could not submit review.'
      );
      return false;
    }
  };

  const fileComplaint: LokmaContextValue['fileComplaint'] = async (payload) => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;
    const compRef = doc(collection(db, 'complaints'));
    try {
      await setDoc(compRef, {
        complainant_id: uid,
        against_user_id: payload.against_user_id,
        order_id: payload.order_id,
        subject: payload.subject.trim().slice(0, 150),
        description: payload.description.trim().slice(0, 1000),
        status: 'open',
        resolved_by: null,
        resolution_note: null,
        resolved_at: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      pushToast(
        lang === 'ar' ? 'تم إرسال الشكوى للإدارة بنجاح' : 'Complaint submitted to admin'
      );
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.CREATE,
        `complaints/${compRef.id}`,
        'تعذر إرسال الشكوى حالياً.',
        'Could not submit complaint.'
      );
      return false;
    }
  };

  // Provider Actions
  const registerOrUpdateProviderProfile: LokmaContextValue['registerOrUpdateProviderProfile'] =
    async (payload) => {
      const uid = requireVerifiedAuth();
      if (!uid) return false;
      const path = `provider_profiles/${uid}`;
      try {
        if (myProviderProfile) {
          await updateDoc(doc(db, 'provider_profiles', uid), {
            university_id: payload.university_id.slice(0, 128),
            business_name: payload.business_name.trim().slice(0, 150),
            bio: payload.bio.trim().slice(0, 600),
            area: payload.area.trim().slice(0, 150),
            pickup_address: payload.pickup_address.trim().slice(0, 300),
            logo_url: (payload.logo_url ?? myProviderProfile.logo_url ?? '').slice(0, 500000),
            updatedAt: serverTimestamp(),
          });
          pushToast(lang === 'ar' ? 'تم تحديث بيانات المطبخ' : 'Kitchen profile updated');
        } else {
          await setDoc(doc(db, 'provider_profiles', uid), {
            user_id: uid,
            university_id: payload.university_id.slice(0, 128),
            business_name: payload.business_name.trim().slice(0, 150),
            bio: payload.bio.trim().slice(0, 600),
            area: payload.area.trim().slice(0, 150),
            pickup_address: payload.pickup_address.trim().slice(0, 300),
            logo_url: (payload.logo_url ?? '').slice(0, 500000),
            verification_status: 'pending',
            verified_by: null,
            verified_at: null,
            is_accepting_orders: true,
            avg_rating: 0,
            review_count: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          pushToast(
            lang === 'ar'
              ? 'تم تسجيل مطبخك وإرساله لمراجعة الإدارة'
              : 'Kitchen profile submitted for verification'
          );
        }
        return true;
      } catch (err) {
        handleMutationError(
          err,
          OperationType.WRITE,
          path,
          'تعذر حفظ بيانات المطبخ. يرجى المحاولة مرة أخرى.',
          'Could not save kitchen profile.'
        );
        return false;
      }
    };

  const toggleProviderAcceptingOrders = async () => {
    const uid = requireVerifiedAuth();
    if (!uid || !myProviderProfile) return;
    if (myProviderProfile.verification_status !== 'verified') {
      pushToast(
        lang === 'ar'
          ? 'يجب اعتماد المطبخ من الإدارة قبل تفعيل استقبال الطلبات'
          : 'Kitchen must be verified by admin before accepting orders',
        'error'
      );
      return;
    }
    try {
      const nextAccepting = !myProviderProfile.is_accepting_orders;
      await updateDoc(doc(db, 'provider_profiles', uid), {
        is_accepting_orders: nextAccepting,
        updatedAt: serverTimestamp(),
      });
      pushToast(
        nextAccepting
          ? lang === 'ar'
            ? 'المطبخ يستقبل الطلبات الآن'
            : 'Kitchen is now accepting orders'
          : lang === 'ar'
          ? 'تم إيقاف استقبال الطلبات مؤقتاً'
          : 'Orders paused',
        'info'
      );
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `provider_profiles/${uid}`,
        'تعذر تحديث حالة استقبال الطلبات.',
        'Could not update kitchen availability.'
      );
    }
  };

  const saveMeal: LokmaContextValue['saveMeal'] = async (payload) => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;

    const targetProviderId =
      isAdmin && payload.provider_id ? payload.provider_id.trim() : myProviderProfile?.user_id;

    if (!targetProviderId) {
      pushToast(
        lang === 'ar' ? 'يرجى اختيار مقدم الطعام المسؤول عن الوجبة' : 'Provider profile required',
        'error'
      );
      return false;
    }

    const resolvedProvider =
      providerProfiles.find((p) => p.user_id === targetProviderId) ??
      (myProviderProfile?.user_id === targetProviderId ? myProviderProfile : undefined);

    if (!resolvedProvider) {
      pushToast(
        lang === 'ar' ? 'مقدم الطعام المحدد غير موجود' : 'Selected food provider not found',
        'error'
      );
      return false;
    }

    if (!payload.name.trim() && !(payload.name_ar || '').trim()) {
      pushToast(lang === 'ar' ? 'يرجى إدخال اسم الوجبة' : 'Meal name is required', 'error');
      return false;
    }

    if (!Number.isFinite(payload.price) || payload.price <= 0 || payload.price > 10000) {
      pushToast(lang === 'ar' ? 'السعر غير صالح' : 'Invalid price', 'error');
      return false;
    }

    const mealId = payload.id || doc(collection(db, 'meals')).id;
    const path = `meals/${mealId}`;
    const safeImage =
      payload.image_url &&
      (payload.image_url.startsWith('https://') || payload.image_url.startsWith('data:image/'))
        ? payload.image_url.slice(0, 600000)
        : '';

    const docPayload: Record<string, unknown> = {
      provider_id: resolvedProvider.user_id,
      provider_name: resolvedProvider.business_name.slice(0, 150),
      category_id: payload.category_id.slice(0, 128),
      name: payload.name.trim().slice(0, 150),
      name_ar: (payload.name_ar || payload.name).trim().slice(0, 150),
      description: payload.description.trim().slice(0, 1000),
      price: Number(payload.price),
      portion_description: (payload.portion_description || 'وجبة فردية').trim().slice(0, 150),
      image_url: safeImage,
      prep_time_minutes: Math.max(1, Math.min(300, Math.round(payload.prep_time_minutes || 20))),
      is_available: payload.is_available,
      deleted_at: null,
      allergen_ids: payload.allergen_ids.slice(0, 20),
      dietary_pref_ids: payload.dietary_pref_ids.slice(0, 20),
      updatedAt: serverTimestamp(),
    };

    if (payload.calories_kcal !== undefined) {
      docPayload.calories_kcal = Math.max(0, Math.min(5000, Number(payload.calories_kcal)));
    }
    if (payload.protein_g !== undefined) {
      docPayload.protein_g = Math.max(0, Math.min(500, Number(payload.protein_g)));
    }
    if (payload.carbs_g !== undefined) {
      docPayload.carbs_g = Math.max(0, Math.min(500, Number(payload.carbs_g)));
    }
    if (payload.fat_g !== undefined) {
      docPayload.fat_g = Math.max(0, Math.min(500, Number(payload.fat_g)));
    }
    if (payload.fiber_g !== undefined) {
      docPayload.fiber_g = Math.max(0, Math.min(200, Number(payload.fiber_g)));
    }
    if (payload.serving_size_g !== undefined) {
      docPayload.serving_size_g = Math.max(0, Math.min(5000, Number(payload.serving_size_g)));
    }
    docPayload.ingredients_text = (payload.ingredients_text ?? '').trim().slice(0, 500);

    try {
      if (payload.id) {
        await updateDoc(doc(db, 'meals', mealId), docPayload);
      } else {
        await setDoc(doc(db, 'meals', mealId), {
          ...docPayload,
          createdAt: serverTimestamp(),
        });
      }
      if (!payload.silentToast) {
        pushToast(lang === 'ar' ? 'تم حفظ الوجبة في قاعدة البيانات' : 'Meal saved');
      }
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        path,
        'تعذر حفظ الوجبة. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
        'Could not save meal.'
      );
      return false;
    }
  };

  const toggleMealAvailability = async (mealId: string): Promise<boolean> => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return false;
    if (!isAdmin && meal.provider_id !== uid) return false;
    const nextState = !meal.is_available;
    try {
      await updateDoc(doc(db, 'meals', mealId), {
        is_available: nextState,
        updatedAt: serverTimestamp(),
      });
      pushToast(
        nextState
          ? lang === 'ar'
            ? 'تم نشر الوجبة وإتاحتها على المنصة'
            : 'Meal published'
          : lang === 'ar'
          ? 'تم إخفاء الوجبة عن العرض مؤقتاً'
          : 'Meal hidden',
        'info'
      );
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `meals/${mealId}`,
        'تعذر تغيير حالة توفر الوجبة.',
        'Could not update meal availability.'
      );
      return false;
    }
  };

  const softDeleteMeal = async (mealId: string) => {
    const uid = requireVerifiedAuth();
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'meals', mealId), {
        deleted_at: serverTimestamp(),
        is_available: false,
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم حذف الوجبة' : 'Meal deleted', 'info');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `meals/${mealId}`,
        'تعذر حذف الوجبة.',
        'Could not delete meal.'
      );
    }
  };

  const deleteMealSafely: LokmaContextValue['deleteMealSafely'] = async (mealId) => {
    const uid = requireVerifiedAuth();
    if (!uid) {
      return { ok: false, reason: 'unauthorized' };
    }
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) {
      return { ok: false, reason: 'not_found' };
    }
    if (!isAdmin && meal.provider_id !== uid) {
      return { ok: false, reason: 'unauthorized' };
    }

    const linkedOrders = orders.filter((order) =>
      order.items_summary.some((item) => item.meal_id === mealId)
    );
    const activeOrders = linkedOrders.filter(
      (order) => !['delivered', 'cancelled', 'rejected'].includes(order.status)
    );

    if (activeOrders.length > 0) {
      return {
        ok: false,
        reason: 'active_orders',
        activeOrdersCount: activeOrders.length,
      };
    }

    try {
      if (linkedOrders.length > 0) {
        await updateDoc(doc(db, 'meals', mealId), {
          deleted_at: serverTimestamp(),
          is_available: false,
          updatedAt: serverTimestamp(),
        });
        return { ok: true, mode: 'archived' };
      }

      await deleteDoc(doc(db, 'meals', mealId));
      return { ok: true, mode: 'hard_deleted' };
    } catch (err) {
      console.error('Failed deleting meal safely:', err);
      return { ok: false, reason: 'error' };
    }
  };

  const replyToReview = async (reviewId: string, response: string) => {
    const uid = requireVerifiedAuth();
    if (!uid || !response.trim()) return;
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        provider_response: response.trim().slice(0, 1000),
        responded_at: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم نشر الرد على التقييم' : 'Reply posted');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `reviews/${reviewId}`,
        'تعذر نشر الرد على التقييم.',
        'Could not post reply.'
      );
    }
  };

  // Delivery Partner Actions
  const applyAsDeliveryPartner: LokmaContextValue['applyAsDeliveryPartner'] = async (payload) => {
    const uid = requireVerifiedAuth();
    if (!uid) return false;
    if (!/^[0-9]{4}$/.test(payload.national_id_last4.trim())) {
      pushToast(
        lang === 'ar'
          ? 'يرجى إدخال آخر 4 أرقام صحيحة من البطاقة القومية'
          : 'Enter last 4 digits of National ID',
        'error'
      );
      return false;
    }
    const fullName = (
      userDoc?.full_name ||
      firebaseUser?.displayName ||
      firebaseUser?.email?.split('@')[0] ||
      'Student Partner'
    )
      .trim()
      .slice(0, 120);
    try {
      await setDoc(doc(db, 'delivery_partner_profiles', uid), {
        user_id: uid,
        full_name: fullName,
        phone: (payload.phone || userDoc?.phone || '').trim().slice(0, 30),
        university_id: payload.university_id.slice(0, 128),
        national_id_last4: payload.national_id_last4.trim(),
        student_card_id: payload.student_card_id.trim().slice(0, 50),
        delivery_method: payload.delivery_method,
        verification_status: 'pending',
        verified_by: null,
        verified_at: null,
        is_online: false,
        availability_schedule: payload.availability_schedule.trim().slice(0, 150),
        completed_deliveries: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      pushToast(
        lang === 'ar'
          ? 'تم إرسال طلب شريك التوصيل للإدارة للمراجعة'
          : 'Delivery partner application submitted'
      );
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.CREATE,
        `delivery_partner_profiles/${uid}`,
        'تعذر إرسال طلب التوصيل. يرجى المحاولة مرة أخرى.',
        'Could not submit delivery partner application.'
      );
      return false;
    }
  };

  const toggleDeliveryPartnerOnline = async () => {
    const uid = requireVerifiedAuth();
    if (!uid || !myDeliveryPartnerProfile) return;
    if (myDeliveryPartnerProfile.verification_status !== 'verified') return;
    try {
      const nextOnline = !myDeliveryPartnerProfile.is_online;
      await updateDoc(doc(db, 'delivery_partner_profiles', uid), {
        is_online: nextOnline,
        updatedAt: serverTimestamp(),
      });
      pushToast(
        nextOnline
          ? lang === 'ar'
            ? 'أنت متصل الآن لاستقبال طلبات التوصيل'
            : 'You are now Online'
          : lang === 'ar'
          ? 'تم تحويل وضعك إلى غير متصل'
          : 'You are now Offline',
        'info'
      );
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `delivery_partner_profiles/${uid}`,
        'تعذر تغيير حالة الاتصال.',
        'Could not update online status.'
      );
    }
  };

  const updateDeliveryPartnerMethod = async (method: DeliveryMethod, schedule: string) => {
    const uid = requireVerifiedAuth();
    if (!uid || !myDeliveryPartnerProfile) return;
    try {
      await updateDoc(doc(db, 'delivery_partner_profiles', uid), {
        delivery_method: method,
        availability_schedule: schedule.trim().slice(0, 150),
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم تحديث وسيلة التوصيل والتفرغ' : 'Delivery settings updated');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `delivery_partner_profiles/${uid}`,
        'تعذر حفظ إعدادات التوصيل.',
        'Could not save delivery settings.'
      );
    }
  };

  const acceptDeliveryRequest = async (orderId: string): Promise<boolean> => {
    const uid = requireVerifiedAuth();
    if (!uid || !myDeliveryPartnerProfile) return false;
    if (myDeliveryPartnerProfile.verification_status !== 'verified') {
      pushToast(
        lang === 'ar' ? 'حساب التوصيل غير موثق بعد' : 'Partner not verified yet',
        'error'
      );
      return false;
    }

    try {
      const ok = await runTransaction(db, async (tx) => {
        const offerRef = doc(db, 'delivery_offers', orderId);
        const orderRef = doc(db, 'orders', orderId);
        const offerSnap = await tx.get(offerRef);
        const orderSnap = await tx.get(orderRef);

        if (!offerSnap.exists() || !orderSnap.exists()) return false;
        const offerData = offerSnap.data();
        const orderData = orderSnap.data();
        if (
          offerData.status !== 'open' ||
          orderData.status !== 'ready_for_pickup' ||
          orderData.delivery_partner_id !== null
        ) {
          return false;
        }

        const existingHistory = Array.isArray(orderData.status_history)
          ? orderData.status_history
          : [];
        const partnerName = myDeliveryPartnerProfile.full_name.slice(0, 120);

        tx.update(offerRef, {
          status: 'claimed',
          delivery_partner_id: uid,
          updatedAt: serverTimestamp(),
        });

        tx.update(orderRef, {
          delivery_partner_id: uid,
          delivery_partner_name: partnerName,
          delivery_partner_method: myDeliveryPartnerProfile.delivery_method,
          status: 'assigned',
          status_history: [
            ...existingHistory.slice(-19),
            {
              status: 'assigned',
              changed_by: uid,
              note:
                lang === 'ar'
                  ? `قبل ${partnerName} توصيل الطلب`
                  : `Accepted by ${partnerName}`,
              created_at: new Date().toISOString(),
            },
          ],
          updatedAt: serverTimestamp(),
        });

        return true;
      });

      if (!ok) {
        pushToast(
          lang === 'ar'
            ? 'تم استلام هذا الطلب بالفعل من زميل آخر'
            : 'This request has already been claimed',
          'error'
        );
        return false;
      }

      pushToast(lang === 'ar' ? 'تم قبول التوصيلة بنجاح!' : 'Delivery accepted!');
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        `delivery_offers/${orderId}`,
        'تعذر قبول التوصيلة. يرجى المحاولة مرة أخرى.',
        'Could not accept delivery request.'
      );
      return false;
    }
  };

  const updateDeliveryStep: LokmaContextValue['updateDeliveryStep'] = async (
    orderId,
    nextStatus
  ) => {
    const uid = requireVerifiedAuth();
    if (!uid || !myDeliveryPartnerProfile) return false;

    const validPrevStatus: Record<'picked_up' | 'out_for_delivery' | 'delivered', OrderStatus> = {
      picked_up: 'assigned',
      out_for_delivery: 'picked_up',
      delivered: 'out_for_delivery',
    };

    try {
      const txResult = await runTransaction(db, async (tx) => {
        const orderRef = doc(db, 'orders', orderId);
        const partnerRef = doc(db, 'delivery_partner_profiles', uid);
        const orderSnap = await tx.get(orderRef);
        const partnerSnap = await tx.get(partnerRef);

        if (!orderSnap.exists() || !partnerSnap.exists()) {
          return { ok: false as const, reason: 'not_found' as const };
        }

        const orderData = orderSnap.data();
        if (orderData.delivery_partner_id !== uid) {
          return { ok: false as const, reason: 'unauthorized' as const };
        }
        if (orderData.status !== validPrevStatus[nextStatus]) {
          return { ok: false as const, reason: 'invalid_step' as const };
        }

        const existingHistory = Array.isArray(orderData.status_history)
          ? orderData.status_history
          : [];
        const updatedHistory = [
          ...existingHistory.slice(-19),
          {
            status: nextStatus,
            changed_by: uid,
            note: nextStatus,
            created_at: new Date().toISOString(),
          },
        ];

        const orderUpdate: Record<string, unknown> = {
          status: nextStatus,
          status_history: updatedHistory,
          updatedAt: serverTimestamp(),
        };

        if (nextStatus === 'delivered') {
          orderUpdate.payment_status = 'paid';
          const partnerData = partnerSnap.data();
          const currentCompleted = Number(partnerData.completed_deliveries || 0);

          tx.set(doc(db, 'delivery_transactions', orderId), {
            order_id: orderId,
            order_number: String(orderData.order_number || ''),
            delivery_partner_id: uid,
            customer_delivery_fee: Number(deliveryPricingConfig.customer_delivery_fee),
            partner_earning: Number(deliveryPricingConfig.partner_earning),
            platform_commission: Number(deliveryPricingConfig.platform_commission),
            status: 'recorded',
            createdAt: serverTimestamp(),
          });

          tx.update(partnerRef, {
            completed_deliveries: currentCompleted + 1,
            updatedAt: serverTimestamp(),
          });
        }

        tx.update(orderRef, orderUpdate);

        tx.set(doc(collection(db, 'notifications')), {
          user_id: String(orderData.student_id || ''),
          type: `order_${nextStatus}`,
          title: String(orderData.order_number || ''),
          body:
            nextStatus === 'delivered'
              ? lang === 'ar'
                ? 'تم تسليم طلبك! يمكنك تقييم الوجبة والتوصيل الآن.'
                : 'Order delivered! You can rate your meal and delivery.'
              : lang === 'ar'
              ? `تحديث التوصيل: ${nextStatus}`
              : `Delivery update: ${nextStatus}`,
          order_id: orderId,
          status: 'unread',
          createdAt: serverTimestamp(),
        });

        return { ok: true as const };
      });

      if (!txResult.ok) {
        pushToast(
          lang === 'ar'
            ? 'تم تحديث هذه المرحلة مسبقاً أو لم تعد صالحة'
            : 'This delivery step is already updated or invalid',
          'info'
        );
        return false;
      }

      pushToast(
        nextStatus === 'delivered'
          ? lang === 'ar'
            ? `تم تأكيد التسليم وإضافة ${deliveryPricingConfig.partner_earning} ج.م لأرباحك`
            : `Delivered! +${deliveryPricingConfig.partner_earning} EGP added`
          : lang === 'ar'
          ? 'تم تحديث مرحلة التوصيل'
          : 'Delivery step updated'
      );
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        `orders/${orderId}`,
        'تعذر تحديث حالة التوصيل. يرجى المحاولة مرة أخرى.',
        'Could not update delivery step.'
      );
      return false;
    }
  };

  // Admin Actions
  const setUserStatus = async (userId: string, status: UserStatus) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        status,
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم تحديث حالة المستخدم' : 'User status updated', 'info');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `users/${userId}`,
        'تعذر تحديث حالة المستخدم.',
        'Could not update user status.'
      );
    }
  };

  const setProviderVerification = async (providerId: string, status: VerificationStatus) => {
    const uid = requireVerifiedAuth();
    if (!uid || !isAdmin) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'provider_profiles', providerId), {
      verification_status: status,
      verified_by: uid,
      verified_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (status === 'verified') {
      batch.set(doc(collection(db, 'notifications')), {
        user_id: providerId,
        type: 'provider_verified',
        title: lang === 'ar' ? 'تم اعتماد مطبخك' : 'Kitchen Verified',
        body:
          lang === 'ar'
            ? 'تهانينا! أصبح مطبخك موثقاً ومتاحاً لطلبات الطلبة.'
            : 'Your kitchen is now verified and live for orders.',
        status: 'unread',
        createdAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
      pushToast(lang === 'ar' ? 'تم تحديث حالة توثيق المطبخ' : 'Provider verification updated');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `provider_profiles/${providerId}`,
        'تعذر تحديث حالة توثيق المطبخ.',
        'Could not update provider verification.'
      );
    }
  };

  const setDeliveryPartnerVerification = async (partnerId: string, status: VerificationStatus) => {
    const uid = requireVerifiedAuth();
    if (!uid || !isAdmin) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'delivery_partner_profiles', partnerId), {
      verification_status: status,
      verified_by: uid,
      verified_at: serverTimestamp(),
      is_online: status === 'verified',
      updatedAt: serverTimestamp(),
    });
    if (status === 'verified') {
      batch.set(doc(collection(db, 'notifications')), {
        user_id: partnerId,
        type: 'delivery_partner_verified',
        title: lang === 'ar' ? 'تم اعتمادك كشريك توصيل' : 'Delivery Partner Approved',
        body:
          lang === 'ar'
            ? 'أصبح حسابك موثقاً الآن لقبول طلبات التوصيل.'
            : 'Your delivery partner profile is approved.',
        status: 'unread',
        createdAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
      pushToast(lang === 'ar' ? 'تم تحديث توثيق طالب التوصيل' : 'Delivery partner updated');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `delivery_partner_profiles/${partnerId}`,
        'تعذر تحديث توثيق طالب التوصيل.',
        'Could not update delivery partner.'
      );
    }
  };

  const assignDeliveryPartnerByAdmin = async (
    orderId: string,
    partnerId: string
  ): Promise<boolean> => {
    const uid = requireVerifiedAuth();
    if (!uid || !isAdmin) return false;
    const order = orders.find((o) => o.id === orderId);
    const partner = allDeliveryPartnerProfiles.find((dp) => dp.user_id === partnerId);
    if (!order || !partner) return false;

    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', orderId), {
      delivery_partner_id: partnerId,
      delivery_partner_name: partner.full_name,
      delivery_partner_method: partner.delivery_method,
      status: 'assigned',
      status_history: [
        ...order.status_history.slice(-19),
        {
          status: 'assigned',
          changed_by: uid,
          note:
            lang === 'ar'
              ? `تعيين إداري: ${partner.full_name}`
              : `Admin assigned ${partner.full_name}`,
          created_at: new Date().toISOString(),
        },
      ],
      updatedAt: serverTimestamp(),
    });

    batch.set(
      doc(db, 'delivery_offers', orderId),
      {
        order_id: orderId,
        order_number: order.order_number,
        provider_id: order.provider_id,
        provider_name: order.provider_name,
        pickup_address: order.provider_name,
        partner_earning: Number(deliveryPricingConfig.partner_earning),
        total_amount: Number(order.total_amount),
        status: 'claimed',
        delivery_partner_id: partnerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    try {
      await batch.commit();
      pushToast(lang === 'ar' ? 'تم تعيين طالب التوصيل للطلب' : 'Delivery partner assigned');
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `orders/${orderId}`,
        'تعذر تعيين طالب التوصيل.',
        'Could not assign delivery partner.'
      );
      return false;
    }
  };

  const updateDeliveryPricingConfig: LokmaContextValue['updateDeliveryPricingConfig'] = async (
    cfg
  ) => {
    if (!isAdmin) return false;
    const fee = Number(cfg.customer_delivery_fee);
    const partner = Number(cfg.partner_earning);
    const commission = Number(cfg.platform_commission);

    if (
      !Number.isFinite(fee) ||
      !Number.isFinite(partner) ||
      !Number.isFinite(commission) ||
      fee < 0 ||
      fee > 500 ||
      partner < 0 ||
      partner > 500 ||
      commission < 0 ||
      commission > 500
    ) {
      pushToast(
        lang === 'ar'
          ? 'يرجى إدخال قيم صالحة بين 0 و 500 ج.م'
          : 'Enter valid numbers between 0 and 500 EGP',
        'error'
      );
      return false;
    }

    try {
      await setDoc(doc(db, 'config', 'delivery_pricing'), {
        customer_delivery_fee: fee,
        partner_earning: partner,
        platform_commission: commission,
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم حفظ تسعيرة التوصيل' : 'Delivery pricing saved');
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.WRITE,
        'config/delivery_pricing',
        'تعذر حفظ تسعيرة التوصيل.',
        'Could not save delivery pricing.'
      );
      return false;
    }
  };

  const addLookupItem: LokmaContextValue['addLookupItem'] = async (kind, payload) => {
    if (!isAdmin) return false;
    const colName =
      kind === 'category'
        ? 'meal_categories'
        : kind === 'allergen'
        ? 'allergens'
        : kind === 'university'
        ? 'universities'
        : 'dietary_preferences';

    const ref = doc(collection(db, colName));
    const docData: Record<string, unknown> = {
      name_ar: payload.name_ar.trim().slice(0, 120),
      name_en: payload.name_en.trim().slice(0, 120),
      createdAt: serverTimestamp(),
    };

    if (kind === 'category') {
      docData.sort_order = mealCategories.length + 1;
      docData.is_active = true;
    } else if (kind === 'university') {
      docData.city = (payload.city || '').trim().slice(0, 100);
      docData.governorate = (payload.governorate || '').trim().slice(0, 100);
      docData.is_active = true;
    } else if (kind === 'allergen') {
      docData.code = payload.name_en.toLowerCase().replace(/\s+/g, '_').slice(0, 80);
    } else {
      docData.code = payload.name_en.toLowerCase().replace(/\s+/g, '_').slice(0, 80);
      docData.is_restriction = Boolean(payload.is_restriction);
    }

    try {
      await setDoc(ref, docData);
      pushToast(lang === 'ar' ? 'تمت الإضافة بنجاح' : 'Added lookup item');
      return true;
    } catch (err) {
      handleMutationError(
        err,
        OperationType.CREATE,
        `${colName}/${ref.id}`,
        'تعذر إضافة العنصر.',
        'Could not add item.'
      );
      return false;
    }
  };

  const toggleCategoryActive = async (catId: string) => {
    if (!isAdmin) return;
    const cat = mealCategories.find((c) => c.id === catId);
    if (!cat) return;
    try {
      await updateDoc(doc(db, 'meal_categories', catId), {
        is_active: !cat.is_active,
      });
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `meal_categories/${catId}`,
        'تعذر تحديث التصنيف.',
        'Could not update category.'
      );
    }
  };

  const updateComplaintStatus = async (
    complaintId: string,
    status: ComplaintStatus,
    resolutionNote: string
  ) => {
    const uid = requireVerifiedAuth();
    if (!uid || !isAdmin) return;
    try {
      await updateDoc(doc(db, 'complaints', complaintId), {
        status,
        resolved_by: uid,
        resolution_note: resolutionNote.trim().slice(0, 500),
        resolved_at:
          status === 'resolved' || status === 'dismissed' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم تحديث حالة الشكوى' : 'Complaint updated', 'info');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `complaints/${complaintId}`,
        'تعذر تحديث حالة الشكوى.',
        'Could not update complaint.'
      );
    }
  };

  const toggleReviewVisibility = async (reviewId: string) => {
    if (!isAdmin) return;
    const rev = reviews.find((r) => r.id === reviewId);
    if (!rev) return;
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        is_visible: !rev.is_visible,
        updatedAt: serverTimestamp(),
      });
      pushToast(lang === 'ar' ? 'تم تحديث ظهور التقييم' : 'Review visibility updated', 'info');
    } catch (err) {
      handleMutationError(
        err,
        OperationType.UPDATE,
        `reviews/${reviewId}`,
        'تعذر تحديث حالة التقييم.',
        'Could not update review visibility.'
      );
    }
  };

  const markNotificationRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        status: 'read',
        read_at: serverTimestamp(),
      });
    } catch (err) {
      console.error('Notification read update failed:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => n.status === 'unread');
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), {
        status: 'read',
        read_at: serverTimestamp(),
      });
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error('Mark all notifications failed:', err);
    }
  };

  return (
    <LokmaContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        view,
        setView,
        dataLoading,
        adminSyncLoading,
        adminSyncError,
        retryAdminSync,
        users,
        universities,
        mealCategories,
        allergens,
        dietaryPreferences,
        providerProfiles,
        myStudentProfile,
        myProviderProfile,
        myDeliveryPartnerProfile,
        allDeliveryPartnerProfiles,
        meals,
        orders,
        deliveryOffers,
        deliveryTransactions,
        deliveryPricingConfig,
        reviews,
        notifications,
        complaints,
        lokmaBoxLeads,
        lokmaBoxSurveys,
        lokmaBoxSyncError,
        cart,
        recommendationFeedback,
        toasts,
        pushToast,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        setRecommendationFeedbackItem,
        updateStudentSettings,
        placeOrder,
        transitionOrderStatus,
        submitReview,
        fileComplaint,
        registerOrUpdateProviderProfile,
        toggleProviderAcceptingOrders,
        saveMeal,
        toggleMealAvailability,
        softDeleteMeal,
        deleteMealSafely,
        replyToReview,
        applyAsDeliveryPartner,
        toggleDeliveryPartnerOnline,
        updateDeliveryPartnerMethod,
        acceptDeliveryRequest,
        updateDeliveryStep,
        setUserStatus,
        setProviderVerification,
        setDeliveryPartnerVerification,
        assignDeliveryPartnerByAdmin,
        updateDeliveryPricingConfig,
        addLookupItem,
        toggleCategoryActive,
        updateComplaintStatus,
        toggleReviewVisibility,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </LokmaContext.Provider>
  );
};

export function useLokma(): LokmaContextValue {
  const ctx = useContext(LokmaContext);
  if (!ctx) throw new Error('useLokma must be used inside LokmaProvider');
  return ctx;
}
