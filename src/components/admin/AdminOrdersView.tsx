import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChefHat,
  Eye,
  Filter,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  User as UserIcon,
  UtensilsCrossed,
} from 'lucide-react';
import { useFirebaseAuth } from '../../context/FirebaseAuthContext';
import { useLokma } from '../../context/LokmaContext';
import { Language, Meal, Order, OrderStatus, ProviderProfile, User } from '../../types/database';
import { getOrderStatusBadge } from './AdminOrderDetails';

export interface AdminOrdersFilterState {
  providerId: string;
  mealId: string;
  status: 'all' | OrderStatus;
  search: string;
  page: number;
}

export const DEFAULT_ORDERS_FILTER_STATE: AdminOrdersFilterState = {
  providerId: 'all',
  mealId: 'all',
  status: 'all',
  search: '',
  page: 1,
};

const VALID_ORDER_STATUS_LIST: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected',
];

const PAGE_SIZE = 10;

export function parseOrdersFilterFromSearch(searchStr: string): AdminOrdersFilterState {
  const params = new URLSearchParams(searchStr);
  const providerId = params.get('provider') || 'all';
  const mealId = params.get('meal') || 'all';
  const rawStatus = params.get('status') || 'all';
  const status: 'all' | OrderStatus = VALID_ORDER_STATUS_LIST.includes(rawStatus as OrderStatus)
    ? (rawStatus as OrderStatus)
    : 'all';
  const search = params.get('q') || '';
  const rawPage = Number(params.get('page') || '1');
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  return { providerId, mealId, status, search, page };
}

interface AdminOrdersViewProps {
  loading: boolean;
  error: string | null;
  filters: AdminOrdersFilterState;
  onChangeFilters: React.Dispatch<React.SetStateAction<AdminOrdersFilterState>>;
  onRetry: () => void;
  onSelectOrder: (orderId: string) => void;
}

function formatEgyptCurrency(amount: number, lang: Language): string {
  const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
  return lang === 'ar' ? `${formatted} ج.م` : `${formatted} EGP`;
}

function formatEgyptDateTime(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStatusFilterLabel(status: OrderStatus, lang: Language): string {
  return getOrderStatusBadge(status, lang).label;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({
  loading,
  error,
  filters,
  onChangeFilters,
  onRetry,
  onSelectOrder,
}) => {
  const { firebaseUser, getIdToken } = useFirebaseAuth();
  const { lang, orders, users, meals, providerProfiles } = useLokma();

  const [backendVerifying, setBackendVerifying] = useState(true);
  const [backendAuthorized, setBackendAuthorized] = useState(false);
  const [backendVerifyError, setBackendVerifyError] = useState<string | null>(null);
  const [verifyTick, setVerifyTick] = useState(0);

  // Strict Read-Only Backend Admin Verification
  const verifyReadOnlyAccess = useCallback(async () => {
    if (!firebaseUser) {
      setBackendVerifying(false);
      setBackendAuthorized(false);
      setBackendVerifyError(null);
      return;
    }

    setBackendVerifying(true);
    setBackendVerifyError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setBackendAuthorized(false);
        setBackendVerifying(false);
        return;
      }

      const res = await fetch('/api/admin/orders/verify', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setBackendAuthorized(false);
        setBackendVerifyError(null);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setBackendAuthorized(Boolean(data?.authorized));
    } catch {
      setBackendVerifyError(
        lang === 'ar'
          ? 'تعذر التحقق من صلاحيات عرض الطلبات مع الخادم. يرجى المحاولة مرة أخرى.'
          : 'Could not verify admin read-only access with the backend server.'
      );
    } finally {
      setBackendVerifying(false);
    }
  }, [firebaseUser, getIdToken, lang]);

  useEffect(() => {
    void verifyReadOnlyAccess();
  }, [verifyReadOnlyAccess, verifyTick]);

  // Sync filters & page to /admin/orders query string while active
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname.replace(/\/+$/, '');
    if (currentPath !== '/admin/orders') return;

    const params = new URLSearchParams();
    if (filters.providerId !== 'all') params.set('provider', filters.providerId);
    if (filters.mealId !== 'all') params.set('meal', filters.mealId);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    if (filters.page > 1) params.set('page', String(filters.page));

    const qs = params.toString();
    const targetUrl = qs ? `/admin/orders?${qs}` : '/admin/orders';
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      window.history.replaceState({}, '', targetUrl);
    }
  }, [filters]);

  // Relational Lookup Maps (zero duplication)
  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => {
      if (u.id) map.set(u.id, u);
    });
    return map;
  }, [users]);

  const providersById = useMemo(() => {
    const map = new Map<string, ProviderProfile>();
    providerProfiles.forEach((p) => {
      if (p.user_id) map.set(p.user_id, p);
    });
    return map;
  }, [providerProfiles]);

  const mealsById = useMemo(() => {
    const map = new Map<string, Meal>();
    meals.forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    return map;
  }, [meals]);

  // Real Food Provider filter options from database
  const providerOptions = useMemo(() => {
    const map = new Map<string, string>();
    providerProfiles.forEach((p) => {
      if (p.user_id && p.business_name) {
        map.set(p.user_id, p.business_name);
      }
    });
    orders.forEach((o) => {
      if (o.provider_id && !map.has(o.provider_id)) {
        map.set(o.provider_id, o.provider_name || o.provider_id);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, lang === 'ar' ? 'ar' : 'en'));
  }, [providerProfiles, orders, lang]);

  // Real Meal filter options from database (optionally scoped by chosen provider)
  const mealOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; providerId: string }>();

    meals.forEach((m) => {
      if (filters.providerId !== 'all' && m.provider_id !== filters.providerId) return;
      map.set(m.id, {
        id: m.id,
        name: m.name_ar || m.name,
        providerId: m.provider_id,
      });
    });

    orders.forEach((o) => {
      if (filters.providerId !== 'all' && o.provider_id !== filters.providerId) return;
      o.items_summary.forEach((item) => {
        if (!item.meal_id) return;
        if (!map.has(item.meal_id)) {
          const dbMeal = mealsById.get(item.meal_id);
          map.set(item.meal_id, {
            id: item.meal_id,
            name: dbMeal ? dbMeal.name_ar || dbMeal.name : item.meal_name || item.meal_id,
            providerId: o.provider_id,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, lang === 'ar' ? 'ar' : 'en')
    );
  }, [meals, orders, mealsById, filters.providerId, lang]);

  // Ensure mealId stays valid if providerId narrows mealOptions
  useEffect(() => {
    if (filters.mealId === 'all' || loading) return;
    const stillValid = mealOptions.some((m) => m.id === filters.mealId);
    if (!stillValid && mealOptions.length > 0 && filters.providerId !== 'all') {
      onChangeFilters((prev) => ({ ...prev, mealId: 'all', page: 1 }));
    }
  }, [filters.mealId, filters.providerId, mealOptions, loading, onChangeFilters]);

  // Enrich each order ONCE using relational lookups (prevents JOIN duplicate rows)
  const enrichedOrders = useMemo(() => {
    const seenOrderIds = new Set<string>();
    const rows: Array<{
      order: Order;
      studentName: string;
      studentEmail: string;
      providerName: string;
      mealNames: string[];
      mealDisplayText: string;
    }> = [];

    orders.forEach((order) => {
      if (!order.id || seenOrderIds.has(order.id)) return;
      seenOrderIds.add(order.id);

      const student = usersById.get(order.student_id);
      const provider = providersById.get(order.provider_id);

      const studentName = order.student_name || student?.full_name || '—';
      const studentEmail = student?.email || (lang === 'ar' ? 'غير متوفر' : 'Not available');
      const providerName = provider?.business_name || order.provider_name || '—';

      const mealNames = order.items_summary.map((item) => {
        const dbMeal = mealsById.get(item.meal_id);
        const label = dbMeal ? dbMeal.name_ar || dbMeal.name : item.meal_name;
        return item.quantity > 1 ? `${label} (×${item.quantity})` : label;
      });

      const mealDisplayText = mealNames.length > 0 ? mealNames.join('، ') : '—';

      rows.push({
        order,
        studentName,
        studentEmail,
        providerName,
        mealNames,
        mealDisplayText,
      });
    });

    return rows;
  }, [orders, usersById, providersById, mealsById, lang]);

  // Apply Filters & Search
  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();

    return enrichedOrders.filter((row) => {
      const { order, studentName } = row;

      if (filters.providerId !== 'all' && order.provider_id !== filters.providerId) {
        return false;
      }

      if (filters.mealId !== 'all') {
        const hasMeal = order.items_summary.some((item) => item.meal_id === filters.mealId);
        if (!hasMeal) return false;
      }

      if (filters.status !== 'all' && order.status !== filters.status) {
        return false;
      }

      if (q) {
        const orderNumber = (order.order_number || '').toLowerCase();
        const orderDocId = order.id.toLowerCase();
        const sName = studentName.toLowerCase();
        if (!orderNumber.includes(q) && !orderDocId.includes(q) && !sName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedOrders, filters]);

  // Dynamic Summary computed solely from filteredRows
  const summary = useMemo(() => {
    const countsByStatus = new Map<OrderStatus, number>();
    VALID_ORDER_STATUS_LIST.forEach((st) => countsByStatus.set(st, 0));

    filteredRows.forEach((row) => {
      const current = countsByStatus.get(row.order.status) ?? 0;
      countsByStatus.set(row.order.status, current + 1);
    });

    const activeStatusCounts = VALID_ORDER_STATUS_LIST.map((status) => ({
      status,
      count: countsByStatus.get(status) ?? 0,
    })).filter((item) => item.count > 0);

    return {
      totalMatching: filteredRows.length,
      totalAll: enrichedOrders.length,
      activeStatusCounts,
    };
  }, [filteredRows, enrichedOrders.length]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, filters.page), totalPages);

  useEffect(() => {
    if (filters.page > totalPages && !loading) {
      onChangeFilters((prev) => ({ ...prev, page: totalPages }));
    }
  }, [filters.page, totalPages, loading, onChangeFilters]);

  const paginatedRows = useMemo(() => {
    const startIdx = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const hasActiveFilters =
    filters.providerId !== 'all' ||
    filters.mealId !== 'all' ||
    filters.status !== 'all' ||
    filters.search.trim() !== '';

  const resetFilters = () => {
    onChangeFilters({ ...DEFAULT_ORDERS_FILTER_STATE });
  };

  const handleRetryAll = () => {
    setVerifyTick((n) => n + 1);
    onRetry();
  };

  const PrevIcon = lang === 'ar' ? ArrowRight : ArrowLeft;
  const NextIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  // 1. Loading State (Skeleton)
  if (loading || backendVerifying) {
    return (
      <div className="space-y-5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4 animate-pulse">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-6 w-52 rounded-lg bg-[#0B3D2E]/10" />
              <div className="h-3.5 w-72 rounded-lg bg-[#0B3D2E]/8" />
            </div>
            <div className="h-8 w-28 rounded-xl bg-[#0B3D2E]/10" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 rounded-xl bg-[#FFF7E6]" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-white border border-[#0B3D2E]/10 p-4"
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-[#FFF7E6]/70" />
          ))}
        </div>
      </div>
    );
  }

  // 2. Backend Error State
  if (error || backendVerifyError) {
    return (
      <div
        className="bg-white rounded-3xl border border-[#B43C25]/30 p-8 sm:p-10 text-center space-y-4 shadow-xs"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="w-12 h-12 rounded-2xl bg-[#B43C25]/12 text-[#B43C25] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-[#13221C]">
          {lang === 'ar' ? 'تعذر تحميل بيانات الطلبات' : 'Unable to Load Orders'}
        </h2>
        <p className="text-xs text-[#4E6359] max-w-md mx-auto">
          {backendVerifyError || error}
        </p>
        <button
          type="button"
          onClick={handleRetryAll}
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
        </button>
      </div>
    );
  }

  // 3. Backend Read-Only Authorization Gate
  if (!backendAuthorized) {
    return (
      <div
        className="bg-white rounded-3xl border border-[#B43C25]/30 p-8 text-center space-y-3"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <Lock className="w-8 h-8 text-[#B43C25] mx-auto" />
        <h2 className="text-lg font-extrabold text-[#13221C]">
          {lang === 'ar' ? 'غير مصرّح' : 'Unauthorized'}
        </h2>
        <p className="text-xs text-[#4E6359]">
          {lang === 'ar'
            ? 'لا تملك صلاحيات المشرف المعتمدة من الخادم لعرض سجل الطلبات.'
            : 'Backend admin authorization is required to view platform orders.'}
        </p>
      </div>
    );
  }

  const pageRangeStart = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageRangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);

  return (
    <div className="space-y-5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header + Read-Only Notice + Filters */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'عرض الطلبات' : 'View Orders'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF7E6] border border-[#0B3D2E]/15 text-[11px] font-extrabold text-[#0B3D2E]">
                <Eye className="w-3.5 h-3.5 text-[#F7931E]" />
                <span>{lang === 'ar' ? 'للعرض فقط' : 'Read Only'}</span>
              </span>
            </div>
            <p className="text-xs text-[#4E6359] mt-1">
              {lang === 'ar'
                ? 'متابعة جميع طلبات الطلاب ومراقبة توزيعها حسب مقدم الطعام والوجبات وحالات التنفيذ من قاعدة البيانات الحقيقية'
                : 'Read-only monitoring of all student orders by provider, meal, and fulfillment status'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRetryAll}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/20 bg-white text-[#0B3D2E] text-xs font-bold hover:bg-[#FFF7E6] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'تحديث العرض' : 'Refresh'}</span>
          </button>
        </div>

        {/* Search & Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Search by Order ID or Student Name */}
          <div className="relative">
            <label htmlFor="orders-search-input" className="sr-only">
              {lang === 'ar' ? 'بحث برقم الطلب أو اسم الطالب' : 'Search order ID or student name'}
            </label>
            <Search className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
            <input
              id="orders-search-input"
              type="search"
              value={filters.search}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  search: e.target.value,
                  page: 1,
                }))
              }
              placeholder={
                lang === 'ar'
                  ? 'ابحث برقم الطلب أو اسم الطالب...'
                  : 'Search order ID or student name...'
              }
              className="w-full ps-10 pe-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-[#FFF7E6]/35 text-xs font-medium text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
            />
          </div>

          {/* Food Provider Dropdown (DB) */}
          <div>
            <label htmlFor="orders-provider-filter" className="sr-only">
              {lang === 'ar' ? 'مقدم الطعام' : 'Food Provider'}
            </label>
            <select
              id="orders-provider-filter"
              value={filters.providerId}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  providerId: e.target.value,
                  page: 1,
                }))
              }
              className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
            >
              <option value="all">
                {lang === 'ar' ? 'كل مقدمي الطعام' : 'All Food Providers'}
              </option>
              {providerOptions.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name}
                </option>
              ))}
            </select>
          </div>

          {/* Meal Dropdown (DB) */}
          <div>
            <label htmlFor="orders-meal-filter" className="sr-only">
              {lang === 'ar' ? 'الوجبة' : 'Meal'}
            </label>
            <select
              id="orders-meal-filter"
              value={filters.mealId}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  mealId: e.target.value,
                  page: 1,
                }))
              }
              className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
            >
              <option value="all">{lang === 'ar' ? 'كل الوجبات' : 'All Meals'}</option>
              {mealOptions.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="orders-status-filter" className="sr-only">
              {lang === 'ar' ? 'حالة الطلب' : 'Order Status'}
            </label>
            <select
              id="orders-status-filter"
              value={filters.status}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  status: e.target.value as 'all' | OrderStatus,
                  page: 1,
                }))
              }
              className="flex-1 px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
            >
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              {VALID_ORDER_STATUS_LIST.map((st) => (
                <option key={st} value={st}>
                  {getStatusFilterLabel(st, lang)}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title={lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
                className="inline-flex items-center justify-center gap-1 px-3 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-[#FFF7E6] text-[#0B3D2E] text-xs font-bold hover:bg-[#F7931E]/20 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === 'ar' ? 'إعادة ضبط' : 'Reset'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Orders Summary (Top of Table, updates with filters) */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#0B3D2E] text-[#FFF7E6] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-[#4E6359]">
                {lang === 'ar' ? 'إجمالي عدد الطلبات' : 'Total Orders'}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-[#0B3D2E] tabular-nums">
                  {new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG').format(
                    summary.totalMatching
                  )}
                </span>
                {hasActiveFilters && (
                  <span className="text-[11px] font-bold text-[#4E6359] tabular-nums">
                    {lang === 'ar'
                      ? `(من أصل ${new Intl.NumberFormat('ar-EG').format(summary.totalAll)} طلب)`
                      : `(of ${summary.totalAll} total)`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {summary.activeStatusCounts.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#4E6359]">
              <Filter className="w-3.5 h-3.5 text-[#0B3D2E]" />
              <span>
                {lang === 'ar' ? 'التوزيع حسب الحالة:' : 'By Status:'}
              </span>
            </div>
          )}
        </div>

        {summary.activeStatusCounts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-[#0B3D2E]/8">
            {summary.activeStatusCounts.map(({ status, count }) => {
              const badge = getOrderStatusBadge(status, lang);
              return (
                <div
                  key={status}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${badge.cls}`}
                >
                  <span>{badge.label}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/75 text-[#13221C] text-[11px] font-extrabold tabular-nums">
                    {new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG').format(count)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty States or Orders List */}
      {enrichedOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 sm:p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF7E6] text-[#0B3D2E] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'لا توجد طلبات مسجلة حتى الآن' : 'No orders registered yet'}
          </h2>
          <p className="text-xs text-[#4E6359]">
            {lang === 'ar'
              ? 'ستظهر طلبات الطلاب هنا فور إتمام أول طلب على منصة لقمة.'
              : 'Student orders will appear here as soon as orders are placed on LOKMA.'}
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF7E6] text-[#9A5304] flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#13221C]">
            {lang === 'ar'
              ? 'لا توجد طلبات مطابقة لخيارات البحث'
              : 'No orders match the selected search/filters'}
          </h2>
          <p className="text-xs text-[#4E6359]">
            {lang === 'ar'
              ? 'جرّب تغيير معايير التصفية أو مسح البحث لعرض جميع الطلبات.'
              : 'Try adjusting the filters or resetting your search criteria.'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Read-Only Orders Table */}
          <div className="hidden lg:block bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FFF7E6]/85 border-b border-[#0B3D2E]/10 text-[11px] font-extrabold text-[#4E6359]">
                    <th className="py-3.5 px-4 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'رقم الطلب' : 'Order ID'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'اسم الطالب' : 'Student Name'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'البريد الإلكتروني للطالب' : 'Student Email'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'اسم الوجبة' : 'Meal Name'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'مقدم الطعام' : 'Food Provider'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'الإجمالي' : 'Total Price'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'تاريخ ووقت الطلب' : 'Order Date'}
                    </th>
                    <th className="py-3.5 px-4 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'حالة الطلب' : 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0B3D2E]/8">
                  {paginatedRows.map(
                    ({
                      order,
                      studentName,
                      studentEmail,
                      providerName,
                      mealDisplayText,
                    }) => {
                      const badge = getOrderStatusBadge(order.status, lang);
                      const BadgeIcon = badge.icon;
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-[#FFF7E6]/45 transition-colors"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectOrder(order.id)}
                              title={
                                lang === 'ar'
                                  ? 'عرض تفاصيل الطلب'
                                  : 'Open order details'
                              }
                              className="inline-flex items-center gap-1.5 font-extrabold text-[#0B3D2E] hover:text-[#F7931E] underline decoration-[#0B3D2E]/30 hover:decoration-[#F7931E] underline-offset-4 tabular-nums cursor-pointer"
                            >
                              <span>#{order.order_number || order.id}</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-3 font-bold text-[#13221C] whitespace-nowrap">
                            {studentName}
                          </td>
                          <td
                            className="py-3.5 px-3 text-[#4E6359] whitespace-nowrap max-w-[200px] truncate"
                            dir="ltr"
                            title={studentEmail}
                          >
                            {studentEmail}
                          </td>
                          <td
                            className="py-3.5 px-3 text-[#13221C] max-w-[230px] truncate"
                            title={mealDisplayText}
                          >
                            {mealDisplayText}
                          </td>
                          <td className="py-3.5 px-3 font-bold text-[#0B3D2E] whitespace-nowrap">
                            {providerName}
                          </td>
                          <td className="py-3.5 px-3 font-extrabold text-[#13221C] tabular-nums whitespace-nowrap">
                            {formatEgyptCurrency(order.total_amount, lang)}
                          </td>
                          <td className="py-3.5 px-3 text-[11px] text-[#4E6359] tabular-nums whitespace-nowrap">
                            {formatEgyptDateTime(order.created_at, lang)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${badge.cls}`}
                            >
                              <BadgeIcon className="w-3 h-3 shrink-0" />
                              <span>{badge.label}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Read-Only Cards */}
          <div className="lg:hidden space-y-3">
            {paginatedRows.map(
              ({
                order,
                studentName,
                studentEmail,
                providerName,
                mealDisplayText,
              }) => {
                const badge = getOrderStatusBadge(order.status, lang);
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0B3D2E]/8 pb-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order.id)}
                        className="text-sm font-extrabold text-[#0B3D2E] hover:text-[#F7931E] underline decoration-[#0B3D2E]/30 underline-offset-4 tabular-nums cursor-pointer"
                      >
                        #{order.order_number || order.id}
                      </button>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${badge.cls}`}
                      >
                        <BadgeIcon className="w-3 h-3 shrink-0" />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-[#13221C]">
                        <UserIcon className="w-3.5 h-3.5 text-[#0B3D2E] shrink-0" />
                        <span className="font-bold">{studentName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#4E6359]">
                        <Mail className="w-3.5 h-3.5 text-[#4E6359] shrink-0" />
                        <span className="truncate" dir="ltr">
                          {studentEmail}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-[#13221C]">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-[#F7931E] shrink-0 mt-0.5" />
                        <span className="font-medium leading-relaxed">
                          {mealDisplayText}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#0B3D2E]">
                        <ChefHat className="w-3.5 h-3.5 text-[#0B3D2E] shrink-0" />
                        <span className="font-bold">{providerName}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#0B3D2E]/8 text-xs">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#4E6359] tabular-nums">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatEgyptDateTime(order.created_at, lang)}</span>
                      </span>
                      <span className="text-sm font-extrabold text-[#0B3D2E] tabular-nums">
                        {formatEgyptCurrency(order.total_amount, lang)}
                      </span>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* Pagination Bar */}
          {filteredRows.length > PAGE_SIZE && (
            <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="font-bold text-[#4E6359] tabular-nums">
                {lang === 'ar'
                  ? `عرض ${new Intl.NumberFormat('ar-EG').format(pageRangeStart)}–${new Intl.NumberFormat('ar-EG').format(pageRangeEnd)} من أصل ${new Intl.NumberFormat('ar-EG').format(filteredRows.length)} طلب (صفحة ${new Intl.NumberFormat('ar-EG').format(safePage)} من ${new Intl.NumberFormat('ar-EG').format(totalPages)})`
                  : `Showing ${pageRangeStart}–${pageRangeEnd} of ${filteredRows.length} orders (Page ${safePage} of ${totalPages})`}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() =>
                    onChangeFilters((prev) => ({
                      ...prev,
                      page: Math.max(1, safePage - 1),
                    }))
                  }
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-xl border border-[#0B3D2E]/18 text-[#0B3D2E] font-bold hover:bg-[#FFF7E6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <PrevIcon className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'السابق' : 'Previous'}</span>
                </button>

                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 1
                    )
                    .map((pageNum, idx, arr) => {
                      const prevNum = arr[idx - 1];
                      const showEllipsis = prevNum !== undefined && pageNum - prevNum > 1;
                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsis && (
                            <span className="px-1.5 text-[#4E6359] font-bold">…</span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onChangeFilters((prev) => ({ ...prev, page: pageNum }))
                            }
                            className={`w-9 h-9 rounded-xl text-xs font-extrabold tabular-nums transition-colors cursor-pointer ${
                              pageNum === safePage
                                ? 'bg-[#0B3D2E] text-white'
                                : 'border border-[#0B3D2E]/15 text-[#13221C] hover:bg-[#FFF7E6]'
                            }`}
                          >
                            {lang === 'ar'
                              ? new Intl.NumberFormat('ar-EG').format(pageNum)
                              : pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    onChangeFilters((prev) => ({
                      ...prev,
                      page: Math.min(totalPages, safePage + 1),
                    }))
                  }
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-xl border border-[#0B3D2E]/18 text-[#0B3D2E] font-bold hover:bg-[#FFF7E6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                  <NextIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
