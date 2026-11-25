import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Calendar,
  ChefHat,
  Eye,
  GraduationCap,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { useFirebaseAuth } from '../../context/FirebaseAuthContext';
import { useLokma } from '../../context/LokmaContext';
import {
  DeliveryPartnerProfile,
  Language,
  ProviderProfile,
  User,
  UserRole,
} from '../../types/database';

type AccountTypeFilter = 'all' | 'student' | 'provider' | 'delivery_partner' | 'admin';

interface AdminUsersViewProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const PAGE_SIZE = 10;

function formatEgyptCount(num: number, lang: Language): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG').format(num);
}

function formatEgyptDateTime(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getAccountTypeBadge(role: UserRole, lang: Language) {
  switch (role) {
    case 'provider':
      return {
        label: lang === 'ar' ? 'مقدم طعام' : 'Food Provider',
        subLabel: lang === 'ar' ? 'Food Provider' : 'Provider',
        cls: 'bg-[#F7931E]/18 text-[#9A5304] border-[#F7931E]/35',
        icon: ChefHat,
      };
    case 'delivery_partner':
      return {
        label: lang === 'ar' ? 'مندوب توصيل' : 'Delivery Partner',
        subLabel: lang === 'ar' ? 'Delivery Partner' : 'Courier',
        cls: 'bg-[#0B3D2E]/10 text-[#0B3D2E] border-[#0B3D2E]/25',
        icon: Bike,
      };
    case 'admin':
      return {
        label: lang === 'ar' ? 'مشرف المنصة' : 'Admin',
        subLabel: lang === 'ar' ? 'Admin' : 'Admin',
        cls: 'bg-[#13221C] text-[#FFF7E6] border-[#13221C]',
        icon: ShieldCheck,
      };
    case 'student':
    default:
      return {
        label: lang === 'ar' ? 'طالب' : 'Student',
        subLabel: lang === 'ar' ? 'Student' : 'Student',
        cls: 'bg-[#A7C957]/25 text-[#0B3D2E] border-[#0B3D2E]/20',
        icon: GraduationCap,
      };
  }
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  loading,
  error,
  onRetry,
}) => {
  const { firebaseUser, getIdToken } = useFirebaseAuth();
  const {
    lang,
    users,
    orders,
    providerProfiles,
    allDeliveryPartnerProfiles,
  } = useLokma();

  const [backendVerifying, setBackendVerifying] = useState(true);
  const [backendAuthorized, setBackendAuthorized] = useState(false);
  const [backendVerifyError, setBackendVerifyError] = useState<string | null>(null);
  const [verifyTick, setVerifyTick] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Strict Read-Only Backend Admin Verification (verifies role via user_roles on server)
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

      const res = await fetch('/api/admin/users/verify', {
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
          ? 'تعذر التحقق من صلاحيات عرض المستخدمين مع الخادم. يرجى المحاولة مرة أخرى.'
          : 'Could not verify admin read-only access with the backend server.'
      );
    } finally {
      setBackendVerifying(false);
    }
  }, [firebaseUser, getIdToken, lang]);

  useEffect(() => {
    void verifyReadOnlyAccess();
  }, [verifyReadOnlyAccess, verifyTick]);

  // Lookup maps for partner profiles & real order activity (zero duplicates)
  const providerProfileByUserId = useMemo(() => {
    const map = new Map<string, ProviderProfile>();
    providerProfiles.forEach((p) => {
      if (p.user_id) map.set(p.user_id, p);
    });
    return map;
  }, [providerProfiles]);

  const deliveryProfileByUserId = useMemo(() => {
    const map = new Map<string, DeliveryPartnerProfile>();
    allDeliveryPartnerProfiles.forEach((dp) => {
      if (dp.user_id) map.set(dp.user_id, dp);
    });
    return map;
  }, [allDeliveryPartnerProfiles]);

  // Aggregate real order metrics per user UID in a single pass
  const orderStatsByUser = useMemo(() => {
    const studentOrders = new Map<string, number>();
    const providerTotalOrders = new Map<string, number>();
    const providerCompletedOrders = new Map<string, number>();
    const deliveryTotalOrders = new Map<string, number>();
    const deliveryCompletedOrders = new Map<string, number>();

    const seenOrderIds = new Set<string>();
    orders.forEach((o) => {
      if (!o.id || seenOrderIds.has(o.id)) return;
      seenOrderIds.add(o.id);

      if (o.student_id) {
        studentOrders.set(o.student_id, (studentOrders.get(o.student_id) ?? 0) + 1);
      }
      if (o.provider_id) {
        providerTotalOrders.set(
          o.provider_id,
          (providerTotalOrders.get(o.provider_id) ?? 0) + 1
        );
        if (o.status === 'delivered') {
          providerCompletedOrders.set(
            o.provider_id,
            (providerCompletedOrders.get(o.provider_id) ?? 0) + 1
          );
        }
      }
      if (o.delivery_partner_id) {
        deliveryTotalOrders.set(
          o.delivery_partner_id,
          (deliveryTotalOrders.get(o.delivery_partner_id) ?? 0) + 1
        );
        if (o.status === 'delivered') {
          deliveryCompletedOrders.set(
            o.delivery_partner_id,
            (deliveryCompletedOrders.get(o.delivery_partner_id) ?? 0) + 1
          );
        }
      }
    });

    return {
      studentOrders,
      providerTotalOrders,
      providerCompletedOrders,
      deliveryTotalOrders,
      deliveryCompletedOrders,
    };
  }, [orders]);

  // Deduplicate users strictly by unique UID and sort newest-first
  const enrichedUsers = useMemo(() => {
    const uniqueUsers = new Map<string, User>();
    users.forEach((u) => {
      if (u.id && !uniqueUsers.has(u.id)) {
        uniqueUsers.set(u.id, u);
      }
    });

    return Array.from(uniqueUsers.values())
      .map((u) => {
        const providerProfile = providerProfileByUserId.get(u.id) ?? null;
        const deliveryProfile = deliveryProfileByUserId.get(u.id) ?? null;

        const isProvider = u.role === 'provider' || Boolean(providerProfile);
        const isDeliveryPartner =
          u.role === 'delivery_partner' || Boolean(deliveryProfile);
        const isStudent = u.role === 'student';

        const studentOrdersCount = orderStatsByUser.studentOrders.get(u.id) ?? 0;
        const providerFulfilledCount =
          orderStatsByUser.providerCompletedOrders.get(u.id) ?? 0;
        const providerReceivedCount =
          orderStatsByUser.providerTotalOrders.get(u.id) ?? 0;
        const deliveryCompletedCount = Math.max(
          orderStatsByUser.deliveryCompletedOrders.get(u.id) ?? 0,
          deliveryProfile?.completed_deliveries ?? 0
        );

        return {
          user: u,
          providerProfile,
          deliveryProfile,
          isStudent,
          isProvider,
          isDeliveryPartner,
          studentOrdersCount,
          providerFulfilledCount,
          providerReceivedCount,
          deliveryCompletedCount,
        };
      })
      .sort(
        (a, b) =>
          Date.parse(b.user.created_at) - Date.parse(a.user.created_at)
      );
  }, [users, providerProfileByUserId, deliveryProfileByUserId, orderStatsByUser]);

  // Real platform user statistics
  const stats = useMemo(() => {
    const totalUsers = enrichedUsers.length;
    const studentsCount = enrichedUsers.filter((item) => item.isStudent).length;

    const providerIds = new Set<string>();
    providerProfiles.forEach((p) => providerIds.add(p.user_id));
    enrichedUsers
      .filter((item) => item.user.role === 'provider')
      .forEach((item) => providerIds.add(item.user.id));

    const deliveryIds = new Set<string>();
    allDeliveryPartnerProfiles.forEach((d) => deliveryIds.add(d.user_id));
    enrichedUsers
      .filter((item) => item.user.role === 'delivery_partner')
      .forEach((item) => deliveryIds.add(item.user.id));

    return {
      totalUsers,
      studentsCount,
      providersCount: providerIds.size,
      deliveryPartnersCount: deliveryIds.size,
    };
  }, [enrichedUsers, providerProfiles, allDeliveryPartnerProfiles]);

  // Filter & search
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return enrichedUsers.filter((item) => {
      const { user, isStudent, isProvider, isDeliveryPartner, providerProfile } = item;

      if (accountTypeFilter === 'student' && !isStudent) return false;
      if (accountTypeFilter === 'provider' && !isProvider) return false;
      if (accountTypeFilter === 'delivery_partner' && !isDeliveryPartner) return false;
      if (accountTypeFilter === 'admin' && user.role !== 'admin') return false;

      if (q) {
        const nameMatch = (user.full_name || '').toLowerCase().includes(q);
        const emailMatch = (user.email || '').toLowerCase().includes(q);
        const phoneMatch = (user.phone || '').toLowerCase().includes(q);
        const businessMatch = (providerProfile?.business_name || '')
          .toLowerCase()
          .includes(q);
        if (!nameMatch && !emailMatch && !phoneMatch && !businessMatch) return false;
      }

      return true;
    });
  }, [enrichedUsers, searchQuery, accountTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (currentPage > totalPages && !loading) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, loading]);

  const paginatedUsers = useMemo(() => {
    const startIdx = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredUsers, safePage]);

  const hasActiveFilters =
    accountTypeFilter !== 'all' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setSearchQuery('');
    setAccountTypeFilter('all');
    setCurrentPage(1);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white border border-[#0B3D2E]/10 p-4"
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4 animate-pulse">
          <div className="h-6 w-52 rounded-lg bg-[#0B3D2E]/10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="h-11 rounded-xl bg-[#FFF7E6] md:col-span-2" />
            <div className="h-11 rounded-xl bg-[#FFF7E6]" />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-[#FFF7E6]/70" />
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
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
          {lang === 'ar' ? 'تعذر تحميل بيانات المستخدمين' : 'Unable to Load Users'}
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

  // 3. Backend Authorization Gate
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
            ? 'هذه الصفحة مخصصة للمشرفين المعتمدين في الخادم فقط.'
            : 'Server-verified administrator access is required to view platform users.'}
        </p>
      </div>
    );
  }

  const pageRangeStart = filteredUsers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageRangeEnd = Math.min(safePage * PAGE_SIZE, filteredUsers.length);

  return (
    <div className="space-y-5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Users Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-[#0B3D2E] text-[#FFF7E6] border border-[#0B3D2E] p-4 flex items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-[#FFF7E6]/80">
              {lang === 'ar' ? 'إجمالي المستخدمين (Total Users)' : 'Total Users'}
            </p>
            <p className="text-2xl font-extrabold tabular-nums mt-1">
              {formatEgyptCount(stats.totalUsers, lang)}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-white/15 text-[#F7931E] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </span>
        </div>

        <div className="rounded-2xl bg-white border border-[#0B3D2E]/12 p-4 flex items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'إجمالي الطلاب (Students)' : 'Total Students'}
            </p>
            <p className="text-2xl font-extrabold text-[#13221C] tabular-nums mt-1">
              {formatEgyptCount(stats.studentsCount, lang)}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-[#A7C957]/25 text-[#0B3D2E] flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </span>
        </div>

        <div className="rounded-2xl bg-white border border-[#0B3D2E]/12 p-4 flex items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'مقدمو الطعام (Providers)' : 'Food Providers'}
            </p>
            <p className="text-2xl font-extrabold text-[#13221C] tabular-nums mt-1">
              {formatEgyptCount(stats.providersCount, lang)}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-[#F7931E]/18 text-[#9A5304] flex items-center justify-center shrink-0">
            <ChefHat className="w-5 h-5" />
          </span>
        </div>

        <div className="rounded-2xl bg-white border border-[#0B3D2E]/12 p-4 flex items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'مندوبو التوصيل (Delivery)' : 'Delivery Partners'}
            </p>
            <p className="text-2xl font-extrabold text-[#13221C] tabular-nums mt-1">
              {formatEgyptCount(stats.deliveryPartnersCount, lang)}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-[#0B3D2E]/8 text-[#0B3D2E] flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* Header, Search & Account Type Filter */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E]">
                {lang === 'ar' ? 'المستخدمون' : 'Users'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF7E6] border border-[#0B3D2E]/15 text-[11px] font-extrabold text-[#0B3D2E]">
                <Eye className="w-3.5 h-3.5 text-[#F7931E]" />
                <span>{lang === 'ar' ? 'للعرض فقط' : 'Read Only'}</span>
              </span>
            </div>
            <p className="text-xs text-[#4E6359] mt-1">
              {lang === 'ar'
                ? 'استعراض الحسابات المسجلة فعليًا ونشاط الطلبات لكل نوع حساب (مرتبون من الأحدث تسجيلًا)'
                : 'Read-only directory of registered LOKMA accounts and verified order activity (newest first)'}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <label htmlFor="users-search-input" className="sr-only">
              {lang === 'ar' ? 'بحث بالاسم أو البريد الإلكتروني' : 'Search by name or email'}
            </label>
            <Search className="w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
            <input
              id="users-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                lang === 'ar'
                  ? 'ابحث بالاسم الكامل أو البريد الإلكتروني...'
                  : 'Search by full name or email...'
              }
              className="w-full ps-10 pe-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-[#FFF7E6]/35 text-xs font-medium text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="users-role-filter" className="sr-only">
              {lang === 'ar' ? 'نوع الحساب' : 'Account Type'}
            </label>
            <select
              id="users-role-filter"
              value={accountTypeFilter}
              onChange={(e) => {
                setAccountTypeFilter(e.target.value as AccountTypeFilter);
                setCurrentPage(1);
              }}
              className="flex-1 px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/18 bg-white text-xs font-bold text-[#13221C] focus:outline-none focus:border-[#0B3D2E]"
            >
              <option value="all">{lang === 'ar' ? 'كل أنواع الحسابات' : 'All Account Types'}</option>
              <option value="student">{lang === 'ar' ? 'طالب (Student)' : 'Student'}</option>
              <option value="provider">{lang === 'ar' ? 'مقدم طعام (Food Provider)' : 'Food Provider'}</option>
              <option value="delivery_partner">
                {lang === 'ar' ? 'مندوب توصيل (Delivery Partner)' : 'Delivery Partner'}
              </option>
              <option value="admin">{lang === 'ar' ? 'مشرف (Admin)' : 'Admin'}</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title={lang === 'ar' ? 'إعادة ضبط البحث' : 'Reset'}
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

      {/* Empty States or Users Table/Cards */}
      {enrichedUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 sm:p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF7E6] text-[#0B3D2E] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'لا يوجد مستخدمون مسجلون حتى الآن' : 'No users registered yet'}
          </h2>
          <p className="text-xs text-[#4E6359]">
            {lang === 'ar'
              ? 'ستظهر الحسابات المسجلة هنا فور تسجيل دخول المستخدمين إلى منصة لقمة.'
              : 'Registered user accounts will appear here automatically.'}
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF7E6] text-[#9A5304] flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'لم يتم العثور على مستخدمين مطابقين' : 'No matching users found'}
          </h2>
          <p className="text-xs text-[#4E6359]">
            {lang === 'ar'
              ? 'جرّب تعديل كلمة البحث أو اختيار نوع حساب آخر.'
              : 'Try a different name, email, or account type filter.'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'عرض جميع المستخدمين' : 'Show All Users'}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Read-Only Users Table */}
          <div className="hidden lg:block bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FFF7E6]/85 border-b border-[#0B3D2E]/10 text-[11px] font-extrabold text-[#4E6359]">
                    <th className="py-3.5 px-4 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'نوع الحساب' : 'Account Type'}
                    </th>
                    <th className="py-3.5 px-3 text-start whitespace-nowrap">
                      {lang === 'ar'
                        ? 'تاريخ تسجيل الحساب (أول دخول)'
                        : 'Account Registration Date'}
                    </th>
                    <th className="py-3.5 px-4 text-start whitespace-nowrap">
                      {lang === 'ar' ? 'نشاط الطلبات الفعلي' : 'Order Activity'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0B3D2E]/8">
                  {paginatedUsers.map(
                    ({
                      user,
                      providerProfile,
                      isStudent,
                      isProvider,
                      isDeliveryPartner,
                      studentOrdersCount,
                      providerFulfilledCount,
                      providerReceivedCount,
                      deliveryCompletedCount,
                    }) => {
                      const primaryBadge = getAccountTypeBadge(user.role, lang);
                      const PrimaryIcon = primaryBadge.icon;
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-[#FFF7E6]/45 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-[#13221C]">
                              {user.full_name || '—'}
                            </p>
                            {providerProfile?.business_name && (
                              <p className="text-[11px] text-[#4E6359] mt-0.5">
                                {providerProfile.business_name}
                              </p>
                            )}
                          </td>
                          <td
                            className="py-3.5 px-3 text-[#4E6359] whitespace-nowrap max-w-[230px]"
                            dir="ltr"
                            title={user.email}
                          >
                            <p className="truncate">
                              {user.email && !user.email.endsWith('@phone.lokma.app')
                                ? user.email
                                : '—'}
                            </p>
                            {user.phone && (
                              <p className="text-[11px] font-semibold text-[#0B3D2E] tabular-nums mt-0.5">
                                {user.phone}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${primaryBadge.cls}`}
                              >
                                <PrimaryIcon className="w-3 h-3 shrink-0" />
                                <span>{primaryBadge.label}</span>
                              </span>
                              {user.role === 'student' && isDeliveryPartner && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border bg-[#0B3D2E]/8 text-[#0B3D2E] border-[#0B3D2E]/20 text-[10px] font-bold">
                                  <Bike className="w-3 h-3 shrink-0" />
                                  <span>
                                    {lang === 'ar' ? 'مندوب توصيل' : 'Delivery'}
                                  </span>
                                </span>
                              )}
                              {user.role === 'student' && isProvider && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border bg-[#F7931E]/15 text-[#9A5304] border-[#F7931E]/30 text-[10px] font-bold">
                                  <ChefHat className="w-3 h-3 shrink-0" />
                                  <span>{lang === 'ar' ? 'مقدم طعام' : 'Provider'}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <p className="text-[11px] font-bold text-[#13221C] tabular-nums">
                              {formatEgyptDateTime(user.created_at, lang)}
                            </p>
                            <p className="text-[10px] text-[#4E6359] tabular-nums">
                              {user.last_login_at
                                ? lang === 'ar'
                                  ? `آخر دخول: ${formatEgyptDateTime(user.last_login_at, lang)}`
                                  : `Last login: ${formatEgyptDateTime(user.last_login_at, lang)}`
                                : lang === 'ar'
                                ? 'تاريخ إنشاء الحساب'
                                : 'Account created timestamp'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-1 text-[11px] font-bold text-[#13221C] tabular-nums">
                              {isStudent && (
                                <p className="inline-flex items-center gap-1.5 text-[#0B3D2E] me-3">
                                  <ShoppingBag className="w-3.5 h-3.5 text-[#A7C957]" />
                                  <span>
                                    {lang === 'ar'
                                      ? `الطلبات المنشأة: ${formatEgyptCount(studentOrdersCount, lang)}`
                                      : `Created orders: ${studentOrdersCount}`}
                                  </span>
                                </p>
                              )}
                              {isProvider && (
                                <p className="inline-flex items-center gap-1.5 text-[#9A5304] me-3">
                                  <ChefHat className="w-3.5 h-3.5 text-[#F7931E]" />
                                  <span>
                                    {lang === 'ar'
                                      ? `طلبات منفّذة: ${formatEgyptCount(providerFulfilledCount, lang)} (من ${formatEgyptCount(providerReceivedCount, lang)})`
                                      : `Fulfilled: ${providerFulfilledCount} (${providerReceivedCount} total)`}
                                  </span>
                                </p>
                              )}
                              {isDeliveryPartner && (
                                <p className="inline-flex items-center gap-1.5 text-[#0B3D2E]">
                                  <Bike className="w-3.5 h-3.5 text-[#0B3D2E]" />
                                  <span>
                                    {lang === 'ar'
                                      ? `توصيلات مكتملة: ${formatEgyptCount(deliveryCompletedCount, lang)}`
                                      : `Completed deliveries: ${deliveryCompletedCount}`}
                                  </span>
                                </p>
                              )}
                              {user.role === 'admin' &&
                                !isProvider &&
                                !isDeliveryPartner &&
                                studentOrdersCount === 0 && (
                                  <span className="text-[#4E6359]">
                                    {lang === 'ar' ? 'إدارة المنصة' : 'Platform Admin'}
                                  </span>
                                )}
                            </div>
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
            {paginatedUsers.map(
              ({
                user,
                providerProfile,
                isStudent,
                isProvider,
                isDeliveryPartner,
                studentOrdersCount,
                providerFulfilledCount,
                providerReceivedCount,
                deliveryCompletedCount,
              }) => {
                const primaryBadge = getAccountTypeBadge(user.role, lang);
                const PrimaryIcon = primaryBadge.icon;
                return (
                  <div
                    key={user.id}
                    className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#0B3D2E]/8 pb-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#13221C] truncate">
                          {user.full_name || '—'}
                        </p>
                        {providerProfile?.business_name && (
                          <p className="text-[11px] text-[#4E6359]">
                            {providerProfile.business_name}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold shrink-0 ${primaryBadge.cls}`}
                      >
                        <PrimaryIcon className="w-3 h-3 shrink-0" />
                        <span>{primaryBadge.label}</span>
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-[#4E6359]">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate" dir="ltr">
                          {user.email && !user.email.endsWith('@phone.lokma.app')
                            ? user.email
                            : user.phone || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#4E6359]">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] tabular-nums">
                          {lang === 'ar' ? 'تاريخ التسجيل: ' : 'Registered: '}
                          {formatEgyptDateTime(user.created_at, lang)}
                        </span>
                      </div>
                      {user.last_login_at && (
                        <div className="flex items-center gap-2 text-[#4E6359]">
                          <Calendar className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          <span className="text-[11px] tabular-nums">
                            {lang === 'ar' ? 'آخر دخول: ' : 'Last login: '}
                            {formatEgyptDateTime(user.last_login_at, lang)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-[#0B3D2E]/8 space-y-1 text-xs font-bold tabular-nums">
                      {isStudent && (
                        <p className="text-[#0B3D2E]">
                          {lang === 'ar'
                            ? `الطلبات المنشأة: ${formatEgyptCount(studentOrdersCount, lang)}`
                            : `Created orders: ${studentOrdersCount}`}
                        </p>
                      )}
                      {isProvider && (
                        <p className="text-[#9A5304]">
                          {lang === 'ar'
                            ? `طلبات منفّذة: ${formatEgyptCount(providerFulfilledCount, lang)} (من ${formatEgyptCount(providerReceivedCount, lang)})`
                            : `Fulfilled: ${providerFulfilledCount} (${providerReceivedCount} total)`}
                        </p>
                      )}
                      {isDeliveryPartner && (
                        <p className="text-[#0B3D2E]">
                          {lang === 'ar'
                            ? `توصيلات مكتملة: ${formatEgyptCount(deliveryCompletedCount, lang)}`
                            : `Completed deliveries: ${deliveryCompletedCount}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* Pagination */}
          {filteredUsers.length > PAGE_SIZE && (
            <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="font-bold text-[#4E6359] tabular-nums">
                {lang === 'ar'
                  ? `عرض ${formatEgyptCount(pageRangeStart, lang)}–${formatEgyptCount(pageRangeEnd, lang)} من أصل ${formatEgyptCount(filteredUsers.length, lang)} مستخدم (صفحة ${formatEgyptCount(safePage, lang)} من ${formatEgyptCount(totalPages, lang)})`
                  : `Showing ${pageRangeStart}–${pageRangeEnd} of ${filteredUsers.length} users (Page ${safePage} of ${totalPages})`}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-xl border border-[#0B3D2E]/18 text-[#0B3D2E] font-bold hover:bg-[#FFF7E6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <PrevIcon className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'السابق' : 'Previous'}</span>
                </button>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
