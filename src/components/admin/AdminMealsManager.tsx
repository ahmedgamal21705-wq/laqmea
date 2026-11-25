import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useFirebaseAuth } from '../../context/FirebaseAuthContext';
import { useLokma } from '../../context/LokmaContext';
import { db } from '../../lib/firebase';
import { Language, Meal, Order } from '../../types/database';
import {
  compressImageToDataUrl,
  readFileAsBase64,
  validateImageFileClient,
} from '../../utils/imageUpload';
import { MealArtwork } from '../MealArtwork';

export type AdminMealMode = 'list' | 'new' | 'edit';

type ComputedMealStatus = 'available' | 'hidden' | 'unavailable';
type MealSortBy = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'orders_desc';

interface AdminMealsManagerProps {
  mode: AdminMealMode;
  editingMealId: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onVerifyAdminAction?: () => Promise<boolean>;
  onNavigateList: () => void;
  onNavigateNew: () => void;
  onNavigateEdit: (mealId: string) => void;
}

const PAGE_SIZE = 10;

function getMealStatus(
  meal: Meal,
  providerMap: Map<string, { verification_status: string; is_accepting_orders: boolean }>
): ComputedMealStatus {
  if (!meal.is_available) return 'hidden';
  const prov = providerMap.get(meal.provider_id);
  if (!prov || prov.verification_status !== 'verified' || !prov.is_accepting_orders) {
    return 'unavailable';
  }
  return 'available';
}

function getMealStatusBadge(status: ComputedMealStatus, lang: Language) {
  switch (status) {
    case 'available':
      return {
        label: lang === 'ar' ? 'متاحة' : 'Available',
        cls: 'bg-[#A7C957]/25 text-[#0B3D2E] border-[#0B3D2E]/20',
        icon: CheckCircle2,
      };
    case 'hidden':
      return {
        label: lang === 'ar' ? 'مخفية' : 'Hidden',
        cls: 'bg-[#13221C]/8 text-[#4E6359] border-[#13221C]/15',
        icon: EyeOff,
      };
    case 'unavailable':
      return {
        label: lang === 'ar' ? 'غير متاحة' : 'Unavailable',
        cls: 'bg-[#F7931E]/18 text-[#9A5304] border-[#F7931E]/35',
        icon: PauseCircle,
      };
  }
}

const MealThumb: React.FC<{
  src: string;
  alt: string;
  lang: Language;
  className?: string;
}> = ({ src, alt, lang, className = 'w-14 h-14 rounded-xl' }) => {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const isSafeUrl = Boolean(
    src && (src.startsWith('https://') || src.startsWith('data:image/'))
  );

  if (isSafeUrl && !broken) {
    return (
      <div className={`${className} overflow-hidden shrink-0 border border-[#0B3D2E]/10 bg-[#FBF0D9]`}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} overflow-hidden shrink-0 border border-[#0B3D2E]/10 bg-[#FBF0D9] flex flex-col items-center justify-center text-[#4E6359]`}
      title={lang === 'ar' ? 'لا توجد صورة مرفوعة' : 'No photo uploaded'}
    >
      <UtensilsCrossed className="w-4 h-4" />
      <span className="text-[9px] font-bold mt-0.5 leading-none">
        {lang === 'ar' ? 'بدون صورة' : 'No Photo'}
      </span>
    </div>
  );
};

export const AdminMealsManager: React.FC<AdminMealsManagerProps> = ({
  mode,
  editingMealId,
  loading,
  error,
  onRetry,
  onVerifyAdminAction,
  onNavigateList,
  onNavigateNew,
  onNavigateEdit,
}) => {
  const { getIdToken } = useFirebaseAuth();
  const {
    lang,
    meals,
    orders,
    mealCategories,
    providerProfiles,
    allergens,
    dietaryPreferences,
    saveMeal,
    toggleMealAvailability,
    deleteMealSafely,
    addLookupItem,
    pushToast,
  } = useLokma();

  // Filters & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ComputedMealStatus>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [sortBy, setSortBy] = useState<MealSortBy>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Action feedback & modals state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [detailMeal, setDetailMeal] = useState<Meal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state for New / Edit Meal
  const [fNameAr, setFNameAr] = useState('');
  const [fNameEn, setFNameEn] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCategoryId, setFCategoryId] = useState('');
  const [fProviderId, setFProviderId] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fPortion, setFPortion] = useState('وجبة فردية');
  const [fPrepTime, setFPrepTime] = useState('25');
  const [fIsAvailable, setFIsAvailable] = useState(true);
  const [fImageUrl, setFImageUrl] = useState('');
  const [fImageUrlInput, setFImageUrlInput] = useState('');
  const [fIngredients, setFIngredients] = useState('');
  const [fAllergens, setFAllergens] = useState<string[]>([]);
  const [fDietary, setFDietary] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savingForm, setSavingForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lastSubmitAction, setLastSubmitAction] = useState<'draft' | 'publish'>('publish');
  const [fetchedEditMeal, setFetchedEditMeal] = useState<Meal | null>(null);
  const [fetchingEditMeal, setFetchingEditMeal] = useState(false);
  const [fetchEditError, setFetchEditError] = useState<string | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatAr, setNewCatAr] = useState('');
  const [newCatEn, setNewCatEn] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const initializedFormKeyRef = useRef<string | null>(null);

  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  const providerLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        business_name: string;
        verification_status: string;
        is_accepting_orders: boolean;
        area: string;
      }
    >();
    providerProfiles.forEach((p) => {
      map.set(p.user_id, {
        business_name: p.business_name,
        verification_status: p.verification_status,
        is_accepting_orders: p.is_accepting_orders,
        area: p.area,
      });
    });
    return map;
  }, [providerProfiles]);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    mealCategories.forEach((c) => {
      map.set(c.id, lang === 'ar' ? c.name_ar : c.name_en);
    });
    return map;
  }, [mealCategories, lang]);

  // Orders linked per meal (total count + active orders count)
  const mealOrdersMap = useMemo(() => {
    const map = new Map<string, { totalOrders: number; activeOrders: number; linkedOrders: Order[] }>();
    orders.forEach((order) => {
      const seenInOrder = new Set<string>();
      const isActive = !['delivered', 'cancelled', 'rejected'].includes(order.status);
      order.items_summary.forEach((item) => {
        if (!item.meal_id || seenInOrder.has(item.meal_id)) return;
        seenInOrder.add(item.meal_id);
        const cur = map.get(item.meal_id) || { totalOrders: 0, activeOrders: 0, linkedOrders: [] };
        map.set(item.meal_id, {
          totalOrders: cur.totalOrders + 1,
          activeOrders: cur.activeOrders + (isActive ? 1 : 0),
          linkedOrders: [...cur.linkedOrders, order],
        });
      });
    });
    return map;
  }, [orders]);

  // Fetch meal directly by ID from Firestore when entering /admin/meals/:id/edit
  useEffect(() => {
    if (mode !== 'edit' || !editingMealId) {
      setFetchedEditMeal(null);
      setFetchingEditMeal(false);
      setFetchEditError(null);
      return;
    }

    let cancelled = false;
    setFetchingEditMeal(true);
    setFetchEditError(null);

    getDoc(doc(db, 'meals', editingMealId))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setFetchedEditMeal(null);
          setFetchEditError(
            lang === 'ar'
              ? 'الوجبة المطلوبة غير موجودة في قاعدة البيانات.'
              : 'The requested meal does not exist.'
          );
          return;
        }
        const d = snap.data();
        if (d.deleted_at) {
          setFetchedEditMeal(null);
          setFetchEditError(
            lang === 'ar'
              ? 'تم حذف أو أرشفة هذه الوجبة مسبقًا ولا يمكن تعديلها.'
              : 'This meal was archived and cannot be edited.'
          );
          return;
        }
        const toIso = (val: unknown) =>
          val instanceof Timestamp ? val.toDate().toISOString() : typeof val === 'string' ? val : new Date().toISOString();
        setFetchedEditMeal({
          id: snap.id,
          provider_id: String(d.provider_id || ''),
          provider_name: d.provider_name ? String(d.provider_name) : undefined,
          category_id: String(d.category_id || ''),
          name: String(d.name || ''),
          name_ar: d.name_ar ? String(d.name_ar) : undefined,
          description: String(d.description || ''),
          price: Number(d.price || 0),
          portion_description: String(d.portion_description || 'وجبة فردية'),
          image_url: String(d.image_url || ''),
          prep_time_minutes: Number(d.prep_time_minutes || 20),
          is_available: Boolean(d.is_available),
          deleted_at: d.deleted_at ? toIso(d.deleted_at) : null,
          ingredients_text: d.ingredients_text ? String(d.ingredients_text) : undefined,
          allergen_ids: Array.isArray(d.allergen_ids) ? d.allergen_ids.map(String) : [],
          dietary_pref_ids: Array.isArray(d.dietary_pref_ids) ? d.dietary_pref_ids.map(String) : [],
          created_at: toIso(d.createdAt),
          updated_at: toIso(d.updatedAt),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFetchEditError(
          lang === 'ar'
            ? 'تعذر جلب بيانات الوجبة من قاعدة البيانات أو لا تملك صلاحية تعديلها.'
            : 'Could not load meal record or insufficient permissions.'
        );
      })
      .finally(() => {
        if (!cancelled) setFetchingEditMeal(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, editingMealId, lang]);

  // Populate form when entering New or Edit mode
  const mealToEdit = useMemo(() => {
    if (mode !== 'edit' || !editingMealId) return null;
    return fetchedEditMeal ?? meals.find((m) => m.id === editingMealId) ?? null;
  }, [mode, editingMealId, fetchedEditMeal, meals]);

  useEffect(() => {
    if (mode === 'list') {
      initializedFormKeyRef.current = null;
      setNewCatOpen(false);
      return;
    }

    const targetKey =
      mode === 'new' ? 'new' : mealToEdit ? `edit:${mealToEdit.id}` : `pending:${editingMealId ?? ''}`;

    if (mode === 'new' && initializedFormKeyRef.current === 'new') {
      // Populate defaults once lookups finish loading without wiping typed input
      if (!fCategoryId && mealCategories[0]?.id) {
        setFCategoryId(mealCategories[0].id);
      }
      if (!fProviderId && providerProfiles[0]?.user_id) {
        setFProviderId(providerProfiles[0].user_id);
      }
      return;
    }

    if (initializedFormKeyRef.current === targetKey) {
      return;
    }

    if (mode === 'new') {
      initializedFormKeyRef.current = 'new';
      setFormErrors({});
      setActionError(null);
      setFNameAr('');
      setFNameEn('');
      setFDesc('');
      setFCategoryId(mealCategories[0]?.id || '');
      setFProviderId(providerProfiles[0]?.user_id || '');
      setFPrice('');
      setFPortion('وجبة فردية');
      setFPrepTime('25');
      setFIsAvailable(true);
      setFImageUrl('');
      setFImageUrlInput('');
      setFIngredients('');
      setFAllergens([]);
      setFDietary([]);
    } else if (mode === 'edit' && mealToEdit) {
      initializedFormKeyRef.current = `edit:${mealToEdit.id}`;
      setFormErrors({});
      setActionError(null);
      setFNameAr(mealToEdit.name_ar || mealToEdit.name || '');
      setFNameEn(mealToEdit.name || '');
      setFDesc(mealToEdit.description || '');
      setFCategoryId(mealToEdit.category_id || mealCategories[0]?.id || '');
      setFProviderId(mealToEdit.provider_id || '');
      setFPrice(String(mealToEdit.price || ''));
      setFPortion(mealToEdit.portion_description || 'وجبة فردية');
      setFPrepTime(String(mealToEdit.prep_time_minutes || 20));
      setFIsAvailable(mealToEdit.is_available);
      setFImageUrl(mealToEdit.image_url || '');
      setFImageUrlInput(
        mealToEdit.image_url && mealToEdit.image_url.startsWith('https://')
          ? mealToEdit.image_url
          : ''
      );
      setFIngredients(mealToEdit.ingredients_text || '');
      setFAllergens(mealToEdit.allergen_ids || []);
      setFDietary(mealToEdit.dietary_pref_ids || []);
    }
  }, [mode, editingMealId, mealToEdit, mealCategories, providerProfiles, fCategoryId, fProviderId]);

  // Unique provider options for filter dropdown (from profiles + existing meals)
  const providerOptions = useMemo(() => {
    const map = new Map<string, string>();
    providerProfiles.forEach((p) => map.set(p.user_id, p.business_name));
    meals.forEach((m) => {
      if (!map.has(m.provider_id) && m.provider_name) {
        map.set(m.provider_id, m.provider_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [providerProfiles, meals]);

  // Filtered & sorted meals
  const filteredMeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = meals.filter((meal) => {
      if (q) {
        const matchesName =
          meal.name.toLowerCase().includes(q) ||
          (meal.name_ar || '').toLowerCase().includes(q) ||
          meal.description.toLowerCase().includes(q);
        if (!matchesName) return false;
      }
      if (categoryFilter !== 'all' && meal.category_id !== categoryFilter) {
        return false;
      }
      if (providerFilter !== 'all' && meal.provider_id !== providerFilter) {
        return false;
      }
      if (statusFilter !== 'all') {
        const computed = getMealStatus(meal, providerLookup);
        if (computed !== statusFilter) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return Date.parse(a.created_at) - Date.parse(b.created_at);
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'orders_desc': {
          const countA = mealOrdersMap.get(a.id)?.totalOrders || 0;
          const countB = mealOrdersMap.get(b.id)?.totalOrders || 0;
          return countB - countA;
        }
        case 'newest':
        default:
          return Date.parse(b.created_at) - Date.parse(a.created_at);
      }
    });

    return list;
  }, [
    meals,
    searchQuery,
    categoryFilter,
    providerFilter,
    statusFilter,
    sortBy,
    providerLookup,
    mealOrdersMap,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredMeals.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMeals = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredMeals.slice(start, start + PAGE_SIZE);
  }, [filteredMeals, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter, providerFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    providerFilter !== 'all' ||
    sortBy !== 'newest';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setProviderFilter('all');
    setSortBy('newest');
  };

  // Image upload handler: client check -> server magic-byte & size verification -> Firestore compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setActionError(null);

    const clientCheck = validateImageFileClient(file);
    if (!clientCheck.ok) {
      setFormErrors((prev) => ({ ...prev, image: clientCheck.error }));
      return;
    }

    setUploadingImage(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setFormErrors((prev) => ({
          ...prev,
          image: lang === 'ar' ? 'يجب تسجيل الدخول كمشرف لرفع الصور' : 'Admin sign-in required',
        }));
        return;
      }

      const dataBase64 = await readFileAsBase64(file);
      const verifyRes = await fetch('/api/admin/meals/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          dataBase64,
        }),
      });

      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        setFormErrors((prev) => ({
          ...prev,
          image:
            typeof verifyBody.error === 'string'
              ? verifyBody.error
              : lang === 'ar'
              ? 'فشل التحقق من ملف الصورة على الخادم'
              : 'Server image validation failed',
        }));
        return;
      }

      const dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > 550000) {
        setFormErrors((prev) => ({
          ...prev,
          image:
            lang === 'ar'
              ? 'حجم الصورة يتجاوز الحد المسموح به بعد الضغط. يرجى اختيار صورة أصغر.'
              : 'Image exceeds maximum storage limit even after compression.',
        }));
        return;
      }
      setFImageUrl(dataUrl);
      setFImageUrlInput('');
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.image;
        return copy;
      });
    } catch {
      setFormErrors((prev) => ({
        ...prev,
        image:
          lang === 'ar'
            ? 'تعذر قراءة أو رفع ملف الصورة. تأكد من أن الملف صورة صالحة.'
            : 'Invalid image file.',
      }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleApplyExternalImageUrl = () => {
    const trimmed = fImageUrlInput.trim();
    if (!trimmed) {
      setFImageUrl('');
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.image;
        return copy;
      });
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' || !parsed.hostname) {
        throw new Error('invalid');
      }
    } catch {
      setFormErrors((prev) => ({
        ...prev,
        image:
          lang === 'ar'
            ? 'رابط الصورة غير صالح — يجب أن يبدأ بـ https://'
            : 'Image URL must be a valid https:// URL',
      }));
      return;
    }
    setFImageUrl(trimmed);
    setFormErrors((prev) => {
      const copy = { ...prev };
      delete copy.image;
      return copy;
    });
  };

  const verifyBackendPermission = async (): Promise<boolean> => {
    if (!onVerifyAdminAction) return true;
    const ok = await onVerifyAdminAction();
    if (!ok) {
      setActionError(
        lang === 'ar'
          ? 'انتهت صلاحية الجلسة أو لا تملك صلاحية المشرف المعتمدة على الخادم لتنفيذ هذا الإجراء.'
          : 'Backend admin authorization check failed.'
      );
    }
    return ok;
  };

  const handleToggleVisibility = async (meal: Meal) => {
    setTogglingId(meal.id);
    setActionError(null);
    const nextLabel = meal.is_available
      ? lang === 'ar'
        ? 'تم إخفاء الوجبة بنجاح'
        : 'Meal hidden successfully'
      : lang === 'ar'
      ? 'تم نشر الوجبة وإتاحتها بنجاح'
      : 'Meal published successfully';
    try {
      const authorized = await verifyBackendPermission();
      if (!authorized) return;
      const ok = await toggleMealAvailability(meal.id);
      if (ok) {
        setSuccessMessage(`${nextLabel}: ${meal.name_ar || meal.name}`);
      } else {
        setActionError(
          lang === 'ar' ? 'تعذر تحديث حالة نشر الوجبة' : 'Failed updating meal availability'
        );
      }
    } catch {
      setActionError(
        lang === 'ar' ? 'حدث خطأ أثناء تغيير حالة النشر' : 'Error updating meal status'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const authorized = await verifyBackendPermission();
    if (!authorized) {
      setDeleting(false);
      return;
    }
    const result = await deleteMealSafely(deleteTarget.id);
    setDeleting(false);

    if (result.ok) {
      const mealLabel = deleteTarget.name_ar || deleteTarget.name;
      setDeleteTarget(null);
      setSuccessMessage(
        result.mode === 'archived'
          ? lang === 'ar'
            ? `تم أرشفة وحذف الوجبة "${mealLabel}" من القائمة مع الحفاظ الكامل على سجل الطلبات والمعاملات السابقة.`
            : `Meal "${mealLabel}" archived safely while preserving past orders.`
          : lang === 'ar'
          ? `تم حذف الوجبة "${mealLabel}" نهائيًا من قاعدة البيانات.`
          : `Meal "${mealLabel}" deleted permanently.`
      );
    } else if (result.reason === 'active_orders') {
      setActionError(
        lang === 'ar'
          ? `لا يمكن حذف هذه الوجبة لأنها مرتبطة بـ ${result.activeOrdersCount} طلب نشط حاليًا. يرجى الانتظار حتى تكتمل الطلبات أو إخفاء الوجبة مؤقتاً.`
          : `Cannot delete meal linked to ${result.activeOrdersCount} active orders.`
      );
    } else {
      setActionError(
        lang === 'ar' ? 'تعذر حذف الوجبة. يرجى المحاولة مرة أخرى.' : 'Failed to delete meal.'
      );
    }
  };

  const executeMealSave = async (submitAction: 'draft' | 'publish') => {
    setLastSubmitAction(submitAction);
    const nextIsAvailable = submitAction === 'publish';
    setFIsAvailable(nextIsAvailable);

    const errs: Record<string, string> = {};
    const primaryName = fNameAr.trim() || fNameEn.trim();
    const numericPrice = Number(fPrice);
    const numericPrep = Number(fPrepTime);
    const categoryExists = mealCategories.some((c) => c.id === fCategoryId);
    const selectedProvider = providerProfiles.find((p) => p.user_id === fProviderId);

    if (!primaryName || primaryName.length < 2) {
      errs.name = lang === 'ar' ? 'اسم الوجبة مطلوب' : 'Meal name is required';
    }
    if (submitAction === 'publish' && (!fDesc.trim() || fDesc.trim().length < 5)) {
      errs.description =
        lang === 'ar'
          ? 'يرجى إدخال وصف تفصيلي للوجبة (5 أحرف على الأقل)'
          : 'Detailed meal description is required';
    }
    if (!fCategoryId || !categoryExists) {
      errs.category = lang === 'ar' ? 'يرجى اختيار التصنيف' : 'Please select a category';
    }
    if (!fProviderId || !selectedProvider) {
      errs.provider = lang === 'ar' ? 'يرجى اختيار مقدم الطعام' : 'Please select a food provider';
    } else if (
      submitAction === 'publish' &&
      (selectedProvider.verification_status === 'rejected' ||
        selectedProvider.verification_status === 'suspended')
    ) {
      errs.provider =
        lang === 'ar'
          ? 'حساب مقدم الطعام المحدد موقوف أو مرفوض ولا يمكن نشر وجبات له'
          : 'Selected provider account is suspended or rejected';
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 10000) {
      errs.price =
        lang === 'ar'
          ? 'يرجى إدخال سعر صحيح أكبر من صفر'
          : 'Please enter a valid positive price';
    }
    if (!Number.isFinite(numericPrep) || numericPrep < 1 || numericPrep > 300) {
      errs.prep =
        lang === 'ar' ? 'مدة التحضير يجب أن تكون بين 1 و 300 دقيقة' : 'Prep time must be 1–300 min';
    }
    if (
      fImageUrl &&
      !fImageUrl.startsWith('https://') &&
      !fImageUrl.startsWith('data:image/')
    ) {
      errs.image =
        lang === 'ar'
          ? 'رابط الصورة غير صالح — يجب استخدام رابط https:// صحيح'
          : 'Invalid image URL';
    }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingForm(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setActionError(
          lang === 'ar'
            ? 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول.'
            : 'Session expired. Please sign in again.'
        );
        return;
      }

      // Re-run full validation & admin role verification on Backend Express API
      const validateRes = await fetch('/api/admin/meals/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: submitAction,
          name: fNameEn.trim() || primaryName,
          name_ar: primaryName,
          description: fDesc.trim(),
          category_id: fCategoryId,
          provider_id: fProviderId,
          price: Number(numericPrice.toFixed(2)),
          portion_description: fPortion.trim() || 'وجبة فردية',
          prep_time_minutes: Math.round(numericPrep),
          is_available: nextIsAvailable,
          image_url: fImageUrl,
          ingredients_text: fIngredients.trim(),
        }),
      });

      const validateBody = await validateRes.json().catch(() => ({}));
      if (!validateRes.ok) {
        if (validateBody.fieldErrors && typeof validateBody.fieldErrors === 'object') {
          setFormErrors(validateBody.fieldErrors as Record<string, string>);
        }
        setActionError(
          typeof validateBody.error === 'string'
            ? validateBody.error
            : lang === 'ar'
            ? 'فشل التحقق من صحة البيانات على الخادم'
            : 'Backend validation failed'
        );
        return;
      }

      const ok = await saveMeal({
        id: mode === 'edit' && mealToEdit ? mealToEdit.id : undefined,
        provider_id: fProviderId,
        category_id: fCategoryId,
        name: fNameEn.trim() || primaryName,
        name_ar: primaryName,
        description: fDesc.trim(),
        price: Number(numericPrice.toFixed(2)),
        portion_description: fPortion.trim() || 'وجبة فردية',
        prep_time_minutes: Math.round(numericPrep),
        is_available: nextIsAvailable,
        image_url: fImageUrl,
        ingredients_text: fIngredients.trim() || undefined,
        allergen_ids: fAllergens,
        dietary_pref_ids: fDietary,
        silentToast: true,
      });

      if (ok) {
        const toastMsg =
          mode === 'edit'
            ? lang === 'ar'
              ? 'تم تحديث بيانات الوجبة بنجاح'
              : 'Meal updated successfully'
            : submitAction === 'draft'
            ? lang === 'ar'
              ? 'تم حفظ الوجبة كمسودة بنجاح'
              : 'Meal saved as draft successfully'
            : lang === 'ar'
            ? 'تم نشر الوجبة بنجاح'
            : 'Meal published successfully';

        pushToast(toastMsg, 'success');
        setSuccessMessage(`${toastMsg} (${primaryName})`);
        onNavigateList();
      } else {
        setActionError(
          lang === 'ar' ? 'تعذر حفظ الوجبة. تحقق من البيانات والصلاحيات.' : 'Could not save meal.'
        );
      }
    } catch (err) {
      console.error('Error saving meal in admin:', err);
      setActionError(
        lang === 'ar'
          ? 'حدث خطأ أثناء حفظ الوجبة في قاعدة البيانات. لم يتم فقد أي بيانات أدخلتها — يمكنك إعادة المحاولة.'
          : 'Error saving meal to database. Your form inputs are preserved — please retry.'
      );
    } finally {
      setSavingForm(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeMealSave(fIsAvailable ? 'publish' : 'draft');
  };

  // -------------------------------------------------------
  // SUB-VIEW: ADD NEW MEAL (/admin/meals/new) or EDIT MEAL (/admin/meals/:id/edit)
  // -------------------------------------------------------
  if (mode === 'new' || mode === 'edit') {
    if (mode === 'edit' && (loading || fetchingEditMeal)) {
      return (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-8 space-y-4 animate-pulse">
          <div className="h-6 w-48 bg-[#FBF0D9] rounded-xl" />
          <div className="h-40 w-full bg-[#FFF7E6] rounded-2xl" />
          <div className="h-40 w-full bg-[#FFF7E6] rounded-2xl" />
        </div>
      );
    }

    if (mode === 'edit' && (fetchEditError || !mealToEdit)) {
      return (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-4">
          <UtensilsCrossed className="w-10 h-10 text-[#B43C25]/70 mx-auto" />
          <h2 className="text-lg font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'الوجبة المطلوبة غير متاحة للتعديل' : 'Meal Not Available'}
          </h2>
          <p className="text-xs text-[#4E6359] max-w-md mx-auto">
            {fetchEditError ||
              (lang === 'ar'
                ? 'قد تكون الوجبة قد حُذفت أو أن المعرف غير صحيح أو لا تملك صلاحية تعديلها.'
                : 'This meal may have been removed or the ID is invalid.')}
          </p>
          <button
            type="button"
            onClick={onNavigateList}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
          >
            <BackArrow className="w-4 h-4" />
            <span>{lang === 'ar' ? 'العودة لإدارة الوجبات' : 'Back to Meals'}</span>
          </button>
        </div>
      );
    }

    const selectedProviderObj = providerProfiles.find((p) => p.user_id === fProviderId);
    const providerWarning =
      selectedProviderObj &&
      (selectedProviderObj.verification_status !== 'verified' ||
        !selectedProviderObj.is_accepting_orders);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onNavigateList}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B3D2E] hover:text-[#F7931E] mb-2 cursor-pointer"
            >
              <BackArrow className="w-4 h-4" />
              <span>{lang === 'ar' ? 'العودة إلى قائمة الوجبات' : 'Back to Meals List'}</span>
            </button>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E]">
              {mode === 'edit'
                ? lang === 'ar'
                  ? 'تعديل بيانات الوجبة'
                  : 'Edit Meal'
                : lang === 'ar'
                ? 'إضافة وجبة جديدة'
                : 'Add New Meal'}
            </h2>
          </div>
        </div>

        {actionError && (
          <div className="rounded-2xl bg-[#B43C25]/10 border border-[#B43C25]/30 px-4 py-3 text-xs font-bold text-[#B43C25] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              disabled={savingForm}
              onClick={() => void executeMealSave(lastSubmitAction)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B43C25] text-white text-[11px] font-bold hover:bg-[#8E2D1A] cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmitForm}
          noValidate
          className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Image Column */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'صورة الوجبة' : 'Meal Image'}
              </label>

              <div className="rounded-2xl overflow-hidden border border-[#0B3D2E]/15 bg-[#FFF7E6]">
                <MealArtwork
                  slug={fImageUrl}
                  alt={fNameAr || fNameEn || 'صورة الوجبة'}
                  className="w-full h-52"
                  lang={lang}
                />
                {!fImageUrl && (
                  <div className="px-3 py-2 bg-[#FBF0D9] text-[11px] font-bold text-[#4E6359] text-center">
                    {lang === 'ar'
                      ? 'صورة افتراضية توضيحية — يمكنك رفع صورة حقيقية أو إدخال رابط'
                      : 'Default placeholder shown — upload a photo or paste URL'}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] transition-colors cursor-pointer">
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                  <span>
                    {uploadingImage
                      ? lang === 'ar'
                        ? 'جاري فحص الصورة...'
                        : 'Verifying...'
                      : fImageUrl
                      ? lang === 'ar'
                        ? 'استبدال الصورة'
                        : 'Replace Image'
                      : lang === 'ar'
                      ? 'رفع صورة (JPG/PNG/WebP)'
                      : 'Upload Photo'}
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={uploadingImage}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {fImageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setFImageUrl('');
                      setFImageUrlInput('');
                    }}
                    className="px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#B43C25]/30 text-[#B43C25] text-xs font-bold hover:bg-[#B43C25]/10 cursor-pointer"
                  >
                    {lang === 'ar' ? 'إزالة الصورة' : 'Remove'}
                  </button>
                )}
              </div>

              <p className="text-[11px] text-[#4E6359] leading-relaxed">
                {lang === 'ar'
                  ? 'الصيغ المدعومة: JPG، JPEG، PNG، WebP (بحد أقصى 5MB). يتم التحقق من الملف على الخادم قبل الحفظ.'
                  : 'Supported: JPG, JPEG, PNG, WebP (Max 5MB, verified on backend).'}
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-bold text-[#4E6359]">
                  {lang === 'ar' ? 'أو إدخال رابط صورة مباشر (Image URL)' : 'Or paste HTTPS image URL'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={fImageUrlInput}
                    onChange={(e) => setFImageUrlInput(e.target.value)}
                    placeholder="https://..."
                    dir="ltr"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#0B3D2E]/20 bg-[#FFF7E6]/40 text-xs text-[#13221C]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyExternalImageUrl}
                    className="px-3 py-2 rounded-xl bg-[#FBF0D9] text-[#0B3D2E] text-xs font-bold hover:bg-[#F7931E]/25 cursor-pointer"
                  >
                    {lang === 'ar' ? 'تطبيق' : 'Apply'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/10 px-3 py-2 text-[10px] font-semibold text-[#4E6359] leading-relaxed">
                {lang === 'ar'
                  ? 'ملاحظة: خدمة Cloud Storage غير مفعّلة حاليًا؛ يتم فحص الصور المرفوعة على الخادم وحفظها مع دعم روابط الصور المباشرة (https://).'
                  : 'Note: Cloud Storage bucket is not provisioned; uploaded images are backend-verified and stored directly or via HTTPS image URLs.'}
              </div>

              {formErrors.image && (
                <p className="text-[11px] font-bold text-[#B43C25]">{formErrors.image}</p>
              )}
            </div>

            {/* Fields Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'اسم الوجبة (بالعربية) *' : 'Meal Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    value={fNameAr}
                    onChange={(e) => setFNameAr(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: صينية مكرونة بشاميل بيتي' : 'e.g. Baked Pasta'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
                  />
                  {formErrors.name && (
                    <p className="text-[11px] font-bold text-[#B43C25] mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'الاسم بالإنجليزية (اختياري)' : 'Meal Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={fNameEn}
                    onChange={(e) => setFNameEn(e.target.value)}
                    dir="ltr"
                    placeholder="Homemade Bechamel Pasta"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                  {lang === 'ar' ? 'وصف الوجبة *' : 'Meal Description *'}
                </label>
                <textarea
                  rows={3}
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'اشرح مكونات الطبق وطريقة التحضير وحجم الوجبة...'
                      : 'Describe the dish, ingredients, and portion...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
                />
                {formErrors.description && (
                  <p className="text-[11px] font-bold text-[#B43C25] mt-1">
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-extrabold text-[#13221C]">
                      {lang === 'ar' ? 'التصنيف *' : 'Category *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewCatOpen((prev) => !prev)}
                      className="text-[11px] font-bold text-[#0B3D2E] hover:text-[#F7931E] cursor-pointer"
                    >
                      {newCatOpen
                        ? lang === 'ar'
                          ? 'إغلاق'
                          : 'Close'
                        : lang === 'ar'
                        ? '+ تصنيف جديد'
                        : '+ New Category'}
                    </button>
                  </div>
                  <select
                    value={fCategoryId}
                    onChange={(e) => setFCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm font-bold text-[#13221C]"
                  >
                    <option value="">
                      {lang === 'ar' ? 'اختر التصنيف...' : 'Select category...'}
                    </option>
                    {mealCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {lang === 'ar' ? cat.name_ar : cat.name_en}
                      </option>
                    ))}
                  </select>
                  {newCatOpen && (
                    <div className="mt-2 p-3 rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/15 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newCatAr}
                          onChange={(e) => setNewCatAr(e.target.value)}
                          placeholder={lang === 'ar' ? 'اسم التصنيف بالعربية' : 'Arabic name'}
                          className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/20 bg-white text-xs"
                        />
                        <input
                          type="text"
                          value={newCatEn}
                          onChange={(e) => setNewCatEn(e.target.value)}
                          placeholder={lang === 'ar' ? 'الاسم بالإنجليزية (اختياري)' : 'English name'}
                          dir="ltr"
                          className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/20 bg-white text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={creatingCat || !newCatAr.trim()}
                        onClick={async () => {
                          if (!newCatAr.trim()) return;
                          setCreatingCat(true);
                          const authorized = await verifyBackendPermission();
                          if (authorized) {
                            const created = await addLookupItem('category', {
                              name_ar: newCatAr.trim(),
                              name_en: newCatEn.trim() || newCatAr.trim(),
                            });
                            if (created) {
                              setNewCatAr('');
                              setNewCatEn('');
                              setNewCatOpen(false);
                            }
                          }
                          setCreatingCat(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#0B3D2E] text-white text-[11px] font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {lang === 'ar' ? 'حفظ التصنيف' : 'Save Category'}
                      </button>
                    </div>
                  )}
                  {formErrors.category && (
                    <p className="text-[11px] font-bold text-[#B43C25] mt-1">
                      {formErrors.category}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'مقدم الطعام المسؤول عنها *' : 'Food Provider *'}
                  </label>
                  <select
                    value={fProviderId}
                    onChange={(e) => setFProviderId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm font-bold text-[#13221C]"
                  >
                    <option value="">
                      {lang === 'ar' ? 'اختر مقدم الطعام...' : 'Select provider...'}
                    </option>
                    {providerProfiles.map((prov) => (
                      <option key={prov.user_id} value={prov.user_id}>
                        {prov.business_name} (
                        {prov.verification_status === 'verified'
                          ? lang === 'ar'
                            ? 'موثق'
                            : 'Verified'
                          : lang === 'ar'
                          ? 'قيد المراجعة/غير موثق'
                          : prov.verification_status}
                        )
                      </option>
                    ))}
                  </select>
                  {providerProfiles.length === 0 && (
                    <p className="text-[11px] font-bold text-[#9A5304] mt-1">
                      {lang === 'ar'
                        ? 'لا يوجد مقدمو طعام مسجلون حالياً في قاعدة البيانات.'
                        : 'No registered food providers found yet.'}
                    </p>
                  )}
                  {formErrors.provider && (
                    <p className="text-[11px] font-bold text-[#B43C25] mt-1">
                      {formErrors.provider}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'السعر (ج.م) *' : 'Price (EGP) *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10000"
                    value={fPrice}
                    onChange={(e) => setFPrice(e.target.value)}
                    placeholder="75"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm font-bold text-[#13221C] tabular-nums"
                  />
                  {formErrors.price && (
                    <p className="text-[11px] font-bold text-[#B43C25] mt-1">{formErrors.price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'حجم الحصة' : 'Portion Size'}
                  </label>
                  <input
                    type="text"
                    value={fPortion}
                    onChange={(e) => setFPortion(e.target.value)}
                    placeholder={lang === 'ar' ? 'وجبة فردية مشبعة' : 'Single serving'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm text-[#13221C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                    {lang === 'ar' ? 'وقت التحضير (دقيقة)' : 'Prep Time (min)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={fPrepTime}
                    onChange={(e) => setFPrepTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm font-bold text-[#13221C] tabular-nums"
                  />
                  {formErrors.prep && (
                    <p className="text-[11px] font-bold text-[#B43C25] mt-1">{formErrors.prep}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                  {lang === 'ar' ? 'حالة الوجبة والظهور *' : 'Availability Status *'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFIsAvailable(true)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      fIsAvailable
                        ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                        : 'bg-[#FFF7E6]/50 text-[#13221C] border-[#0B3D2E]/15 hover:bg-[#FFF7E6]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {providerWarning
                        ? lang === 'ar'
                          ? 'منشورة (غير متاحة حتى تفعيل المطبخ)'
                          : 'Published (Kitchen Paused/Pending)'
                        : lang === 'ar'
                        ? 'متاحة ومنشورة للطلاب'
                        : 'Available & Published'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFIsAvailable(false)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      !fIsAvailable
                        ? 'bg-[#13221C] text-white border-[#13221C]'
                        : 'bg-[#FFF7E6]/50 text-[#13221C] border-[#0B3D2E]/15 hover:bg-[#FFF7E6]'
                    }`}
                  >
                    <EyeOff className="w-4 h-4 shrink-0" />
                    <span>{lang === 'ar' ? 'مخفية / مسودة (غير معروضة)' : 'Hidden / Draft'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#13221C] mb-1.5">
                  {lang === 'ar' ? 'المكونات (اختياري)' : 'Ingredients (Optional)'}
                </label>
                <input
                  type="text"
                  value={fIngredients}
                  onChange={(e) => setFIngredients(e.target.value)}
                  placeholder={lang === 'ar' ? 'أرز بسمتي، صدور دجاج، توابل منزلية...' : 'Rice, chicken...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20 bg-white text-sm text-[#13221C]"
                />
              </div>

              {(allergens.length > 0 || dietaryPreferences.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {allergens.length > 0 && (
                    <div>
                      <span className="block text-xs font-extrabold text-[#13221C] mb-2">
                        {lang === 'ar' ? 'مسببات الحساسية' : 'Allergens'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {allergens.map((alg) => {
                          const active = fAllergens.includes(alg.id);
                          return (
                            <button
                              key={alg.id}
                              type="button"
                              onClick={() =>
                                setFAllergens((prev) =>
                                  active ? prev.filter((id) => id !== alg.id) : [...prev, alg.id]
                                )
                              }
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#F7931E] text-[#13221C] border-[#F7931E]'
                                  : 'bg-[#FFF7E6] text-[#4E6359] border-[#0B3D2E]/15'
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
                      <span className="block text-xs font-extrabold text-[#13221C] mb-2">
                        {lang === 'ar' ? 'التفضيلات الغذائية' : 'Dietary Preferences'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {dietaryPreferences.map((pref) => {
                          const active = fDietary.includes(pref.id);
                          return (
                            <button
                              key={pref.id}
                              type="button"
                              onClick={() =>
                                setFDietary((prev) =>
                                  active ? prev.filter((id) => id !== pref.id) : [...prev, pref.id]
                                )
                              }
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#0B3D2E] text-white border-[#0B3D2E]'
                                  : 'bg-[#FFF7E6] text-[#4E6359] border-[#0B3D2E]/15'
                              }`}
                            >
                              {lang === 'ar' ? pref.name_ar : pref.name_en}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#0B3D2E]/10">
            <button
              type="button"
              onClick={onNavigateList}
              className="px-5 py-2.5 min-h-[44px] rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#13221C] hover:bg-[#FFF7E6] cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء والعودة' : 'Cancel'}
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={savingForm || uploadingImage || providerProfiles.length === 0}
                onClick={() => void executeMealSave('draft')}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl border border-[#0B3D2E]/25 bg-white text-[#0B3D2E] text-xs font-extrabold hover:bg-[#FFF7E6] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {savingForm && lastSubmitAction === 'draft' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <EyeOff className="w-4 h-4" />
                <span>{lang === 'ar' ? 'حفظ كمسودة' : 'Save as Draft'}</span>
              </button>
              <button
                type="button"
                disabled={savingForm || uploadingImage || providerProfiles.length === 0}
                onClick={() => void executeMealSave('publish')}
                className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {savingForm && lastSubmitAction === 'publish' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {mode === 'edit'
                    ? lang === 'ar'
                      ? 'حفظ ونشر الوجبة'
                      : 'Update & Publish'
                    : lang === 'ar'
                    ? 'نشر الوجبة'
                    : 'Publish Meal'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------
  // MAIN VIEW: MEALS TABLE & FILTERS (/admin/meals)
  // -------------------------------------------------------
  const deleteTargetStats = deleteTarget
    ? mealOrdersMap.get(deleteTarget.id) || { totalOrders: 0, activeOrders: 0, linkedOrders: [] }
    : null;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E]">
            {lang === 'ar' ? 'إدارة الوجبات (القائمة)' : 'Meals Catalog Management'}
          </h2>
          <p className="text-xs text-[#4E6359] mt-1">
            {lang === 'ar'
              ? `إجمالي الوجبات المسجلة: ${meals.length} وجبة`
              : `Total registered meals: ${meals.length}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null);
            onNavigateNew();
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>{lang === 'ar' ? '+ إضافة وجبة جديدة' : '+ Add New Meal'}</span>
        </button>
      </div>

      {/* Feedback Banners */}
      {successMessage && (
        <div
          role="status"
          className="rounded-2xl bg-[#A7C957]/25 border border-[#0B3D2E]/20 px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold text-[#0B3D2E]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label={lang === 'ar' ? 'إغلاق التنبيه' : 'Dismiss'}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#B43C25]/10 border border-[#B43C25]/30 px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold text-[#B43C25]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error State (Firestore sync failure) */}
      {error && (
        <div className="bg-white rounded-3xl border border-[#B43C25]/30 p-8 text-center space-y-4">
          <AlertTriangle className="w-9 h-9 text-[#B43C25] mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#13221C]">
              {lang === 'ar' ? 'تعذر تحميل بيانات الوجبات' : 'Failed Loading Meals'}
            </h3>
            <p className="text-xs text-[#4E6359]">{error}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Search & Filters Bar */}
      {!error && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar' ? 'ابحث باسم الوجبة أو الوصف...' : 'Search by meal name...'
                }
                className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/18 bg-[#FFF7E6]/35 text-xs font-semibold text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label={lang === 'ar' ? 'تصفية حسب التصنيف' : 'Filter by category'}
              className="px-3 py-2.5 rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C]"
            >
              <option value="all">{lang === 'ar' ? 'كل التصنيفات' : 'All Categories'}</option>
              {mealCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {lang === 'ar' ? cat.name_ar : cat.name_en}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ComputedMealStatus)}
              aria-label={lang === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'}
              className="px-3 py-2.5 rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C]"
            >
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="available">{lang === 'ar' ? 'متاحة' : 'Available'}</option>
              <option value="hidden">{lang === 'ar' ? 'مخفية' : 'Hidden'}</option>
              <option value="unavailable">{lang === 'ar' ? 'غير متاحة' : 'Unavailable'}</option>
            </select>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              aria-label={lang === 'ar' ? 'تصفية حسب مقدم الطعام' : 'Filter by provider'}
              className="px-3 py-2.5 rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C]"
            >
              <option value="all">{lang === 'ar' ? 'كل مقدمي الطعام' : 'All Providers'}</option>
              {providerOptions.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#4E6359]">
                {lang === 'ar' ? 'الترتيب:' : 'Sort by:'}
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as MealSortBy)}
                className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 bg-[#FFF7E6]/50 text-xs font-bold text-[#0B3D2E]"
              >
                <option value="newest">{lang === 'ar' ? 'الأحدث إضافة' : 'Newest first'}</option>
                <option value="oldest">{lang === 'ar' ? 'الأقدم إضافة' : 'Oldest first'}</option>
                <option value="price_asc">
                  {lang === 'ar' ? 'السعر: الأقل أولاً' : 'Price: Low to High'}
                </option>
                <option value="price_desc">
                  {lang === 'ar' ? 'السعر: الأعلى أولاً' : 'Price: High to Low'}
                </option>
                <option value="orders_desc">
                  {lang === 'ar' ? 'الأكثر طلبًا' : 'Most Ordered'}
                </option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-[#4E6359] tabular-nums">
                {lang === 'ar'
                  ? `عرض ${filteredMeals.length} من ${meals.length} وجبة`
                  : `Showing ${filteredMeals.length} of ${meals.length}`}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FBF0D9] text-[#0B3D2E] text-[11px] font-bold hover:bg-[#F7931E]/25 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton State */}
      {loading && !error && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-2xl bg-[#FFF7E6] animate-pulse flex items-center px-4 gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FBF0D9]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 bg-[#FBF0D9] rounded" />
                <div className="h-2.5 w-32 bg-[#FBF0D9] rounded" />
              </div>
              <div className="h-6 w-20 bg-[#FBF0D9] rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State (No meals in database at all) */}
      {!loading && !error && meals.length === 0 && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF7E6] text-[#0B3D2E] flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'لا توجد وجبات مضافة حتى الآن' : 'No meals added yet'}
          </h3>
          <p className="text-xs text-[#4E6359] max-w-md mx-auto">
            {lang === 'ar'
              ? 'ابدأ بإضافة أول وجبة وربطها بمقدم الطعام والتصنيف المناسب لتظهر للطلاب على منصة لقمة.'
              : 'Add your first meal and assign it to a provider to populate the student catalog.'}
          </p>
          <button
            type="button"
            onClick={onNavigateNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] cursor-pointer"
          >
            <span>{lang === 'ar' ? '+ إضافة وجبة جديدة' : '+ Add New Meal'}</span>
          </button>
        </div>
      )}

      {/* No Search Results State */}
      {!loading && !error && meals.length > 0 && filteredMeals.length === 0 && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-4">
          <Search className="w-9 h-9 text-[#4E6359]/60 mx-auto" />
          <h3 className="text-base font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'لم يتم العثور على وجبات مطابقة' : 'No matching meals found'}
          </h3>
          <p className="text-xs text-[#4E6359]">
            {lang === 'ar'
              ? 'جرّب تعديل كلمات البحث أو إعادة ضبط الفلاتر لعرض جميع الوجبات.'
              : 'Try adjusting your search term or resetting the active filters.'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
          </button>
        </div>
      )}

      {/* Populated Desktop Table */}
      {!loading && !error && paginatedMeals.length > 0 && (
        <>
          <div className="hidden lg:block bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#FFF7E6]/80 border-b border-[#0B3D2E]/10 text-[11px] font-extrabold text-[#4E6359]">
                    <th className="py-3.5 px-4 text-start">{lang === 'ar' ? 'الوجبة' : 'Meal'}</th>
                    <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'التصنيف' : 'Category'}</th>
                    <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'مقدم الطعام' : 'Provider'}</th>
                    <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                    <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'تاريخ الإضافة' : 'Added'}</th>
                    <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'الطلبات' : 'Orders'}</th>
                    <th className="py-3.5 px-4 text-end">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0B3D2E]/8 text-xs">
                  {paginatedMeals.map((meal) => {
                    const computedStatus = getMealStatus(meal, providerLookup);
                    const badge = getMealStatusBadge(computedStatus, lang);
                    const BadgeIcon = badge.icon;
                    const provName =
                      providerLookup.get(meal.provider_id)?.business_name ||
                      meal.provider_name ||
                      meal.provider_id;
                    const catName =
                      categoryLookup.get(meal.category_id) ||
                      meal.category_id ||
                      (lang === 'ar' ? 'غير مصنف' : 'Uncategorized');
                    const orderStats = mealOrdersMap.get(meal.id) || {
                      totalOrders: 0,
                      activeOrders: 0,
                    };

                    return (
                      <tr key={meal.id} className="hover:bg-[#FFF7E6]/35 transition-colors">
                        <td className="py-3.5 px-4 max-w-[270px]">
                          <div className="flex items-center gap-3">
                            <MealThumb
                              src={meal.image_url}
                              alt={meal.name_ar || meal.name}
                              lang={lang}
                              className="w-14 h-14 rounded-xl"
                            />
                            <div className="min-w-0">
                              <p className="font-extrabold text-[#13221C] truncate">
                                {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                              </p>
                              <p className="text-[11px] text-[#4E6359] line-clamp-2 mt-0.5">
                                {meal.description || (lang === 'ar' ? 'لا يوجد وصف' : 'No description')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-[#13221C] whitespace-nowrap">
                          {catName}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-[#0B3D2E]">
                          <span className="line-clamp-1">{provName}</span>
                        </td>
                        <td className="py-3.5 px-3 font-extrabold text-[#13221C] tabular-nums whitespace-nowrap">
                          {meal.price.toFixed(2)} {lang === 'ar' ? 'ج.م' : 'EGP'}
                        </td>
                        <td className="py-3.5 px-3 text-[11px] text-[#4E6359] tabular-nums whitespace-nowrap">
                          {new Date(meal.created_at).toLocaleDateString(
                            lang === 'ar' ? 'ar-EG' : 'en-US',
                            { dateStyle: 'medium' }
                          )}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${badge.cls}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 tabular-nums whitespace-nowrap">
                          <span className="font-extrabold text-[#13221C]">
                            {orderStats.totalOrders}
                          </span>
                          {orderStats.activeOrders > 0 && (
                            <span className="block text-[10px] font-bold text-[#9A5304]">
                              {orderStats.activeOrders}{' '}
                              {lang === 'ar' ? 'نشط' : 'active'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailMeal(meal)}
                              title={lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                              aria-label={lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                              className="p-2 rounded-lg border border-[#0B3D2E]/15 text-[#0B3D2E] hover:bg-[#FFF7E6] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigateEdit(meal.id)}
                              title={lang === 'ar' ? 'تعديل' : 'Edit'}
                              aria-label={lang === 'ar' ? 'تعديل' : 'Edit'}
                              className="p-2 rounded-lg border border-[#0B3D2E]/15 text-[#0B3D2E] hover:bg-[#FFF7E6] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={togglingId === meal.id}
                              onClick={() => handleToggleVisibility(meal)}
                              title={
                                meal.is_available
                                  ? lang === 'ar'
                                    ? 'إخفاء'
                                    : 'Hide'
                                  : lang === 'ar'
                                  ? 'نشر'
                                  : 'Publish'
                              }
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                meal.is_available
                                  ? 'border-[#13221C]/15 text-[#4E6359] hover:bg-[#13221C]/5'
                                  : 'border-[#0B3D2E]/25 bg-[#A7C957]/25 text-[#0B3D2E] hover:bg-[#A7C957]/40'
                              }`}
                            >
                              {meal.is_available
                                ? lang === 'ar'
                                  ? 'إخفاء'
                                  : 'Hide'
                                : lang === 'ar'
                                ? 'نشر'
                                : 'Publish'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setDeleteTarget(meal);
                              }}
                              title={lang === 'ar' ? 'حذف' : 'Delete'}
                              aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
                              className="p-2 rounded-lg border border-[#B43C25]/25 text-[#B43C25] hover:bg-[#B43C25]/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="lg:hidden space-y-3">
            {paginatedMeals.map((meal) => {
              const computedStatus = getMealStatus(meal, providerLookup);
              const badge = getMealStatusBadge(computedStatus, lang);
              const BadgeIcon = badge.icon;
              const provName =
                providerLookup.get(meal.provider_id)?.business_name ||
                meal.provider_name ||
                meal.provider_id;
              const catName =
                categoryLookup.get(meal.category_id) ||
                meal.category_id ||
                (lang === 'ar' ? 'غير مصنف' : 'Uncategorized');
              const orderStats = mealOrdersMap.get(meal.id) || {
                totalOrders: 0,
                activeOrders: 0,
              };

              return (
                <div
                  key={meal.id}
                  className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <MealThumb
                      src={meal.image_url}
                      alt={meal.name_ar || meal.name}
                      lang={lang}
                      className="w-16 h-16 rounded-2xl"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-[#13221C] truncate">
                          {lang === 'ar' ? meal.name_ar || meal.name : meal.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold shrink-0 ${badge.cls}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </div>
                      <p className="text-xs text-[#4E6359] line-clamp-2 mt-0.5">
                        {meal.description || (lang === 'ar' ? 'لا يوجد وصف' : 'No description')}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-bold text-[#4E6359] mt-2">
                        <span className="text-[#0B3D2E]">{provName}</span>
                        <span>·</span>
                        <span>{catName}</span>
                        <span>·</span>
                        <span className="text-[#13221C] font-extrabold tabular-nums">
                          {meal.price.toFixed(2)} ج.م
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {orderStats.totalOrders} {lang === 'ar' ? 'طلب' : 'orders'}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {new Date(meal.created_at).toLocaleDateString(
                            lang === 'ar' ? 'ar-EG' : 'en-US',
                            { dateStyle: 'short' }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#0B3D2E]/8">
                    <button
                      type="button"
                      onClick={() => setDetailMeal(meal)}
                      className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFF7E6] text-[#0B3D2E] text-xs font-bold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'التفاصيل' : 'Details'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateEdit(meal.id)}
                      className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B3D2E]/8 text-[#0B3D2E] text-xs font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={togglingId === meal.id}
                      onClick={() => handleToggleVisibility(meal)}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-[#0B3D2E]/18 text-xs font-bold text-[#13221C] cursor-pointer"
                    >
                      {meal.is_available
                        ? lang === 'ar'
                          ? 'إخفاء'
                          : 'Hide'
                        : lang === 'ar'
                        ? 'نشر'
                        : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setDeleteTarget(meal);
                      }}
                      aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-[#B43C25]/25 text-[#B43C25] text-xs font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-[#0B3D2E]/10 px-4 py-3 text-xs">
              <span className="font-bold text-[#4E6359] tabular-nums">
                {lang === 'ar'
                  ? `صفحة ${safePage} من ${totalPages}`
                  : `Page ${safePage} of ${totalPages}`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/15 font-bold text-[#0B3D2E] disabled:opacity-40 cursor-pointer"
                >
                  {lang === 'ar' ? 'السابق' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/15 font-bold text-[#0B3D2E] disabled:opacity-40 cursor-pointer"
                >
                  {lang === 'ar' ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Meal Details Modal */}
      {detailMeal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#0B3D2E]/15 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="relative">
              <MealArtwork
                slug={detailMeal.image_url}
                alt={detailMeal.name_ar || detailMeal.name}
                className="w-full h-56"
                lang={lang}
              />
              <button
                type="button"
                onClick={() => setDetailMeal(null)}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="absolute top-3 end-3 w-9 h-9 rounded-full bg-white/95 text-[#13221C] flex items-center justify-center shadow-sm hover:bg-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const status = getMealStatus(detailMeal, providerLookup);
                const statusBadge = getMealStatusBadge(status, lang);
                const StatusIcon = statusBadge.icon;
                return (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-extrabold text-[#0B3D2E]">
                          {detailMeal.name_ar || detailMeal.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold ${statusBadge.cls}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusBadge.label}</span>
                        </span>
                      </div>
                      {detailMeal.name_ar && detailMeal.name !== detailMeal.name_ar && (
                        <p className="text-xs text-[#4E6359]" dir="ltr">
                          {detailMeal.name}
                        </p>
                      )}
                      <p className="text-[11px] text-[#4E6359] tabular-nums">
                        {lang === 'ar' ? 'أُضيفت بتاريخ: ' : 'Added on: '}
                        {new Date(detailMeal.created_at).toLocaleDateString(
                          lang === 'ar' ? 'ar-EG' : 'en-US',
                          { dateStyle: 'medium' }
                        )}
                        {detailMeal.portion_description ? ` · ${detailMeal.portion_description}` : ''}
                      </p>
                    </div>
                    <span className="text-xl font-extrabold text-[#F7931E] tabular-nums">
                      {detailMeal.price.toFixed(2)} {lang === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                );
              })()}

              <p className="text-sm text-[#13221C] leading-relaxed">{detailMeal.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl bg-[#FFF7E6] p-3">
                  <span className="text-[#4E6359] block text-[11px]">
                    {lang === 'ar' ? 'التصنيف' : 'Category'}
                  </span>
                  <span className="font-extrabold text-[#0B3D2E]">
                    {categoryLookup.get(detailMeal.category_id) || detailMeal.category_id}
                  </span>
                </div>
                <div className="rounded-xl bg-[#FFF7E6] p-3">
                  <span className="text-[#4E6359] block text-[11px]">
                    {lang === 'ar' ? 'مقدم الطعام' : 'Provider'}
                  </span>
                  <span className="font-extrabold text-[#0B3D2E]">
                    {providerLookup.get(detailMeal.provider_id)?.business_name ||
                      detailMeal.provider_name ||
                      detailMeal.provider_id}
                  </span>
                </div>
                <div className="rounded-xl bg-[#FFF7E6] p-3">
                  <span className="text-[#4E6359] block text-[11px]">
                    {lang === 'ar' ? 'مدة التحضير' : 'Prep Time'}
                  </span>
                  <span className="font-extrabold text-[#13221C] tabular-nums">
                    {detailMeal.prep_time_minutes} {lang === 'ar' ? 'دقيقة' : 'min'}
                  </span>
                </div>
                <div className="rounded-xl bg-[#FFF7E6] p-3">
                  <span className="text-[#4E6359] block text-[11px]">
                    {lang === 'ar' ? 'الطلبات المرتبطة' : 'Linked Orders'}
                  </span>
                  <span className="font-extrabold text-[#13221C] tabular-nums">
                    {mealOrdersMap.get(detailMeal.id)?.totalOrders || 0}
                  </span>
                </div>
              </div>

              {detailMeal.ingredients_text && (
                <div className="text-xs text-[#4E6359]">
                  <span className="font-extrabold text-[#13221C]">
                    {lang === 'ar' ? 'المكونات: ' : 'Ingredients: '}
                  </span>
                  {detailMeal.ingredients_text}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-[#0B3D2E]/10">
                <button
                  type="button"
                  disabled={togglingId === detailMeal.id}
                  onClick={async () => {
                    const target = detailMeal;
                    setDetailMeal(null);
                    await handleToggleVisibility(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#0B3D2E] hover:bg-[#FFF7E6] cursor-pointer"
                >
                  {detailMeal.is_available ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إخفاء الوجبة' : 'Hide Meal'}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'نشر الوجبة' : 'Publish Meal'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = detailMeal.id;
                    setDetailMeal(null);
                    onNavigateEdit(id);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تعديل الوجبة' : 'Edit Meal'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailMeal(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#13221C] cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (exact required Arabic text + active-order guard) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-[#B43C25]/25 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#B43C25]/12 text-[#B43C25] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#13221C]">
                  {lang === 'ar' ? 'تأكيد حذف الوجبة' : 'Confirm Meal Deletion'}
                </h3>
                <p className="text-xs font-bold text-[#0B3D2E]">
                  {deleteTarget.name_ar || deleteTarget.name}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#13221C] leading-relaxed bg-[#FFF7E6] rounded-2xl p-4 border border-[#0B3D2E]/10">
              هل أنت متأكد من حذف هذه الوجبة؟ قد يؤثر الحذف على الطلبات والسجلات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.
            </p>

            {deleteTargetStats && deleteTargetStats.activeOrders > 0 ? (
              <div className="rounded-2xl bg-[#B43C25]/10 border border-[#B43C25]/30 p-3.5 text-xs font-bold text-[#B43C25] space-y-2">
                <p>
                  {lang === 'ar'
                    ? `تنبيه: لا يمكن حذف هذه الوجبة لأنها مرتبطة بـ ${deleteTargetStats.activeOrders} طلب نشط حاليًا.`
                    : `Blocked: Meal has ${deleteTargetStats.activeOrders} active orders.`}
                </p>
                {deleteTarget.is_available && (
                  <button
                    type="button"
                    onClick={async () => {
                      const target = deleteTarget;
                      setDeleteTarget(null);
                      await handleToggleVisibility(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3D2E] text-white text-[11px] font-bold cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إخفاء الوجبة بدلاً من الحذف' : 'Hide Meal Instead'}</span>
                  </button>
                )}
              </div>
            ) : deleteTargetStats && deleteTargetStats.totalOrders > 0 ? (
              <p className="text-[11px] font-bold text-[#4E6359]">
                {lang === 'ar'
                  ? `ترتبط هذه الوجبة بـ ${deleteTargetStats.totalOrders} طلب سابق مكتمل/ملغي — سيتم أرشفتها وإزالتها من القائمة مع إبقاء سجل الطلبات والمعاملات السابقة سليمًا.`
                  : `Linked to ${deleteTargetStats.totalOrders} historical orders — meal will be archived while preserving order records.`}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#13221C] hover:bg-[#FFF7E6] cursor-pointer"
              >
                {lang === 'ar' ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting || (deleteTargetStats?.activeOrders ?? 0) > 0}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[42px] rounded-xl bg-[#B43C25] text-white text-xs font-bold hover:bg-[#8E2D1A] disabled:opacity-45 cursor-pointer"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
