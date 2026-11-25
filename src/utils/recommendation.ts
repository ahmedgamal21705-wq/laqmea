import {
  DietaryPreference,
  Meal,
  Order,
  ProviderProfile,
  RecommendedMeal,
  Review,
  StudentProfile,
} from '../types/database';

export interface RecommendationItemOutput {
  recommendation: RecommendedMeal;
  meal: Meal;
  protein_g: number;
  calories_kcal: number;
  provider_name: string;
  provider_rating: number;
  units_sold_30d: number;
}

export function getPerMealBudget(dailyBudget: number, weeklyBudget: number): number {
  if (dailyBudget > 0) return Number((dailyBudget / 2).toFixed(2));
  if (weeklyBudget > 0) return Number((weeklyBudget / 14).toFixed(2));
  return 0;
}

export function getProviderRatingStats(
  providerId: string,
  reviews: Review[]
): { avg_rating: number; review_count: number } {
  const visible = reviews.filter((r) => r.provider_id === providerId && r.is_visible);
  if (visible.length === 0) return { avg_rating: 0, review_count: 0 };
  const sum = visible.reduce((acc, r) => acc + r.rating, 0);
  return {
    avg_rating: Number((sum / visible.length).toFixed(1)),
    review_count: visible.length,
  };
}

export function runBudgetRecommendations(params: {
  meals: Meal[];
  providers: ProviderProfile[];
  reviews: Review[];
  orders: Order[];
  dietaryPreferences: DietaryPreference[];
  studentProfile: StudentProfile | null;
  lang: 'ar' | 'en';
  feedbackMap?: Record<string, 'liked' | 'disliked' | 'ordered' | null>;
}): { mealBudget: number; items: RecommendationItemOutput[] } {
  const {
    meals,
    providers,
    reviews,
    orders,
    dietaryPreferences,
    studentProfile,
    lang,
    feedbackMap = {},
  } = params;

  const mealBudget = studentProfile
    ? getPerMealBudget(studentProfile.daily_budget, studentProfile.weekly_budget)
    : 0;

  const studentAllergenIds = new Set(studentProfile?.allergen_ids ?? []);
  const studentPrefIds = studentProfile?.dietary_pref_ids ?? [];
  const studentRestrictionIds = studentPrefIds.filter((prefId) => {
    const pref = dietaryPreferences.find((d) => d.id === prefId);
    return pref?.is_restriction === true;
  });

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const unitsSoldMap = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'cancelled' || order.status === 'rejected') continue;
    const createdMs = Date.parse(order.created_at);
    if (!Number.isNaN(createdMs) && createdMs >= thirtyDaysAgo) {
      for (const item of order.items_summary) {
        unitsSoldMap.set(item.meal_id, (unitsSoldMap.get(item.meal_id) || 0) + item.quantity);
      }
    }
  }

  const eligibleMeals = meals.filter((meal) => {
    if (!meal.is_available || meal.deleted_at !== null) return false;
    const provider = providers.find((p) => p.user_id === meal.provider_id);
    if (!provider || provider.verification_status !== 'verified' || !provider.is_accepting_orders) {
      return false;
    }
    if (mealBudget > 0 && meal.price > mealBudget) return false;

    if (meal.allergen_ids.some((aid) => studentAllergenIds.has(aid))) {
      return false;
    }

    const mealDietSet = new Set(meal.dietary_pref_ids);
    for (const reqId of studentRestrictionIds) {
      if (!mealDietSet.has(reqId)) return false;
    }

    return true;
  });

  const effectiveBudget = mealBudget > 0 ? mealBudget : 100;

  const scored = eligibleMeals.map((meal) => {
    const provider = providers.find((p) => p.user_id === meal.provider_id)!;
    const ratingStats = getProviderRatingStats(provider.user_id, reviews);
    const protein_g = meal.protein_g ?? 0;
    const calories_kcal = meal.calories_kcal ?? 0;
    const categoryLevel = studentProfile?.category_prefs?.[meal.category_id] ?? 2;

    const mealDietSet = new Set(meal.dietary_pref_ids);
    const matchingDietCount = studentPrefIds.filter((id) => mealDietSet.has(id)).length;
    const unitsSold = unitsSoldMap.get(meal.id) || 0;

    const priceScore =
      mealBudget > 0 ? Math.max(0, 30 * (1 - meal.price / Math.max(1, effectiveBudget))) : 15;
    const catScore = 6 * categoryLevel;
    const dietScore = 15 * matchingDietCount;
    const popularityScore = Math.min(10, 2 * unitsSold);
    const ratingScore = 2 * ratingStats.avg_rating;
    const proteinScore = Math.min(10, protein_g / 2.5);

    const totalScore = Number(
      (priceScore + catScore + dietScore + popularityScore + ratingScore + proteinScore).toFixed(2)
    );

    const reasonsAr: string[] = [];
    const reasonsEn: string[] = [];

    if (mealBudget > 0) {
      const savings = Math.max(0, Math.round(mealBudget - meal.price));
      if (savings >= 10) {
        reasonsAr.push(`يوفر ${savings} ج.م من ميزانية الوجبة`);
        reasonsEn.push(`Saves ${savings} EGP under your per-meal budget`);
      } else {
        reasonsAr.push(`مطابق لميزانية الوجبة (${mealBudget} ج.م)`);
        reasonsEn.push(`Fits within your ${mealBudget} EGP meal budget`);
      }
    } else {
      reasonsAr.push(`السعر: ${meal.price} ج.م`);
      reasonsEn.push(`Price: ${meal.price} EGP`);
    }

    if (matchingDietCount > 0) {
      reasonsAr.push('يطابق تفضيلاتك الغذائية');
      reasonsEn.push('Matches your dietary preferences');
    }
    if (protein_g >= 24) {
      reasonsAr.push(`غني بالبروتين (${protein_g} جم)`);
      reasonsEn.push(`High protein (${protein_g}g)`);
    }
    if (ratingStats.avg_rating >= 4.5 && ratingStats.review_count > 0) {
      reasonsAr.push(`مطبخ بتقييم مرتفع (${ratingStats.avg_rating}★)`);
      reasonsEn.push(`Top-rated kitchen (${ratingStats.avg_rating}★)`);
    }

    const reasonEn = reasonsEn.slice(0, 2).join(' · ');
    const reasonAr = reasonsAr.slice(0, 2).join(' · ');

    return {
      meal,
      score: totalScore,
      reason: lang === 'ar' ? reasonAr : reasonEn,
      reasonAr,
      reasonEn,
      protein_g,
      calories_kcal,
      provider_name: provider.business_name,
      provider_rating: ratingStats.avg_rating,
      units_sold_30d: unitsSold,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top5 = scored.slice(0, 5);

  const items: RecommendationItemOutput[] = top5.map((entry, idx) => ({
    recommendation: {
      id: `rec_${entry.meal.id}`,
      meal_id: entry.meal.id,
      rank_position: idx + 1,
      score: entry.score,
      reason: entry.reasonEn,
      reason_ar: entry.reasonAr,
      feedback: feedbackMap[entry.meal.id] ?? null,
    },
    meal: entry.meal,
    protein_g: entry.protein_g,
    calories_kcal: entry.calories_kcal,
    provider_name: entry.provider_name,
    provider_rating: entry.provider_rating,
    units_sold_30d: entry.units_sold_30d,
  }));

  return { mealBudget, items };
}
