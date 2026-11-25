export type Language = 'ar' | 'en';

export type UserRole = 'student' | 'provider' | 'delivery_partner' | 'admin';
export type UserStatus = 'active' | 'pending' | 'suspended';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export type DeliveryMethod = 'walking' | 'bicycle';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'ready_for_pickup'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type FulfillmentType = 'pickup' | 'delivery';
export type PaymentMethod = 'cash';
export type PaymentStatus = 'unpaid' | 'paid';
export type RecommendationFeedback = 'liked' | 'disliked' | 'ordered' | null;
export type NotificationStatus = 'unread' | 'read';
export type NotificationType =
  | 'order_placed'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_preparing'
  | 'order_ready_for_pickup'
  | 'order_assigned'
  | 'order_picked_up'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'provider_verified'
  | 'delivery_partner_verified'
  | 'review_received';

export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export interface University {
  id: string;
  name_ar: string;
  name_en: string;
  city: string;
  governorate: string;
  is_active: boolean;
  created_at: string;
}

export type AuthMethod = 'email' | 'phone' | 'google';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  auth_method?: AuthMethod;
  email_verified?: boolean;
  phone_verified?: boolean;
  terms_accepted_at?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  user_id: string;
  university_id: string;
  university_name?: string;
  faculty: string;
  academic_year?: number;
  daily_budget: number;
  weekly_budget: number;
  delivery_location: string;
  allergen_ids: string[];
  dietary_pref_ids: string[];
  category_prefs: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ProviderProfile {
  user_id: string;
  university_id: string;
  business_name: string;
  bio: string;
  area: string;
  pickup_address: string;
  logo_url: string;
  verification_status: VerificationStatus;
  verified_by?: string | null;
  verified_at?: string | null;
  is_accepting_orders: boolean;
  avg_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartnerProfile {
  user_id: string;
  full_name: string;
  phone?: string;
  university_id: string;
  national_id_last4: string;
  student_card_id: string;
  delivery_method: DeliveryMethod;
  verification_status: VerificationStatus;
  verified_by?: string | null;
  verified_at?: string | null;
  is_online: boolean;
  availability_schedule: string;
  completed_deliveries: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPricingConfig {
  customer_delivery_fee: number;
  partner_earning: number;
  platform_commission: number;
  updated_at: string;
}

export interface DeliveryTransaction {
  id: string;
  order_id: string;
  order_number: string;
  delivery_partner_id: string;
  customer_delivery_fee: number;
  partner_earning: number;
  platform_commission: number;
  status: 'recorded' | 'settled';
  created_at: string;
}

export interface DeliveryOffer {
  id: string;
  order_id: string;
  order_number: string;
  provider_id: string;
  provider_name: string;
  pickup_address: string;
  delivery_area_hint?: string;
  partner_earning: number;
  total_amount: number;
  status: 'open' | 'claimed' | 'cancelled';
  delivery_partner_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealCategory {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Allergen {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  created_at: string;
}

export interface DietaryPreference {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  is_restriction: boolean;
  created_at: string;
}

export interface Meal {
  id: string;
  provider_id: string;
  provider_name?: string;
  category_id: string;
  name: string;
  name_ar?: string;
  description: string;
  price: number;
  portion_description: string;
  image_url: string;
  prep_time_minutes: number;
  is_available: boolean;
  deleted_at: string | null;
  calories_kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  serving_size_g?: number;
  ingredients_text?: string;
  allergen_ids: string[];
  dietary_pref_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface OrderItemSummary {
  meal_id: string;
  meal_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  changed_by: string;
  note: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  student_id: string;
  student_name: string;
  student_phone?: string;
  provider_id: string;
  provider_name: string;
  delivery_partner_id: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_method?: string | null;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  delivery_location: string;
  subtotal_amount: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  student_notes: string;
  item_count: number;
  items_summary: OrderItemSummary[];
  status_history: OrderStatusHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  student_id: string;
  provider_id: string;
  delivery_partner_id?: string | null;
  rating: number;
  delivery_rating: number | null;
  comment: string;
  delivery_comment: string | null;
  provider_response: string | null;
  responded_at: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  order_id: string | null;
  status: NotificationStatus;
  read_at: string | null;
  created_at: string;
}

export interface Complaint {
  id: string;
  complainant_id: string;
  against_user_id: string;
  order_id: string | null;
  subject: string;
  description: string;
  status: ComplaintStatus;
  resolved_by: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecommendedMeal {
  id: string;
  meal_id: string;
  rank_position: number;
  score: number;
  reason: string;
  reason_ar?: string;
  feedback: RecommendationFeedback;
}

export interface CartItem {
  meal_id: string;
  quantity: number;
  notes: string;
}

export type LokmaBoxTryInterest = 'yes' | 'maybe' | 'no';

export type LokmaBoxPrepDifficulty = 'always' | 'sometimes' | 'rarely' | 'no';

export type LokmaBoxFoodProblem =
  | 'time'
  | 'cost'
  | 'cooking_skills'
  | 'ingredients_waste'
  | 'quality_hygiene'
  | 'variety';

export type LokmaBoxMealType =
  | 'quick_pasta_rice'
  | 'chicken_protein'
  | 'egyptian_home'
  | 'breakfast_snacks'
  | 'healthy_light'
  | 'sandwiches_wraps';

export type LokmaBoxPrepTime =
  | 'under_10_min'
  | '10_to_20_min'
  | '20_to_30_min'
  | 'ready_heat';

export type LokmaBoxBudgetTier = 'under_50' | '50_to_75' | '75_to_100' | 'over_100';

export type LokmaBoxPurchaseFrequency =
  | 'daily'
  | '2_to_3_weekly'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export type LokmaBoxTimingPreference = 'breakfast' | 'lunch' | 'dinner' | 'mixed';

export type LokmaBoxWillingnessToBuy = 'yes' | 'maybe' | 'no';

export interface LokmaBoxLead {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  university_id: string | null;
  university_name: string;
  housing_area: string;
  wants_to_try: LokmaBoxTryInterest;
  consent_accepted: boolean;
  consent_accepted_at: string;
  user_id: string | null;
  source: 'landing_lokma_box';
  created_at: string;
}

export interface LokmaBoxSurvey {
  id: string;
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
  consent_accepted: boolean;
  user_id: string | null;
  created_at: string;
}

