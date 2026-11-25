import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Bell,
  Bike,
  Calendar,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  MessageSquareWarning,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';
import {
  ComplaintStatus,
  Language,
  UserRole,
  VerificationStatus,
} from '../types/database';
import { ConfirmDialog } from './ConfirmDialog';
import { LokmaLogo } from './LokmaLogo';
import { AdminDashboardCharts } from './admin/AdminDashboardCharts';
import { AdminLokmaBoxView } from './admin/AdminLokmaBoxView';
import { AdminMealMode, AdminMealsManager } from './admin/AdminMealsManager';
import { AdminOrderDetails, getOrderStatusBadge } from './admin/AdminOrderDetails';
import {
  AdminOrdersFilterState,
  AdminOrdersView,
  DEFAULT_ORDERS_FILTER_STATE,
  parseOrdersFilterFromSearch,
} from './admin/AdminOrdersView';
import { AdminUsersView } from './admin/AdminUsersView';

const ADMIN_OPS_PAGE_SIZE = 10;

export type AdminSection =
  | 'dashboard'
  | 'orders'
  | 'meals'
  | 'users'
  | 'operations'
  | 'events'
  | 'registrations'
  | 'lokma-box';

export interface AdminNavigationTarget {
  section: AdminSection;
  orderId?: string | null;
  mealMode?: AdminMealMode;
  mealId?: string | null;
}

interface AdminPortalProps {
  activeSection?: AdminSection;
  selectedOrderId?: string | null;
  mealMode?: AdminMealMode;
  editingMealId?: string | null;
  onNavigate?: (target: AdminNavigationTarget) => void;
}

interface SqlOverview {
  totalEvents: number;
  publishedEvents: number;
  totalRegistrations: number;
  totalSqlUsers: number;
  sqlConfigured: boolean;
}

interface BackendDashboardResponse {
  authorized: boolean;
  verifiedAdminEmail: string | null;
  role: string;
  sqlOverview: SqlOverview;
}

interface AdminEventItem {
  id: string;
  title: string;
  description: string | null;
  category: 'workshop' | 'course' | 'event';
  startsAt: string;
  location: string | null;
  organizer: string | null;
  coverImageUrl: string | null;
  status: 'draft' | 'published' | 'hidden';
  createdAt: string;
  registrationsCount: number;
}

interface AdminRegistrationItem {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  eventId: string;
  eventTitle: string;
  eventCategory: 'workshop' | 'course' | 'event';
  eventStartsAt: string;
  createdAt: string;
}

function getRoleLabel(role: UserRole, lang: Language): string {
  switch (role) {
    case 'admin':
      return lang === 'ar' ? 'مشرف' : 'Admin';
    case 'provider':
      return lang === 'ar' ? 'مقدم طعام' : 'Food Provider';
    case 'delivery_partner':
      return lang === 'ar' ? 'مندوب توصيل' : 'Delivery Partner';
    case 'student':
    default:
      return lang === 'ar' ? 'طالب' : 'Student';
  }
}

function getVerificationBadge(status: VerificationStatus, lang: Language) {
  switch (status) {
    case 'verified':
      return {
        label: lang === 'ar' ? 'موثق ومفعّل' : 'Verified',
        cls: 'bg-[#A7C957]/25 text-[#0B3D2E]',
      };
    case 'rejected':
      return {
        label: lang === 'ar' ? 'مرفوض' : 'Rejected',
        cls: 'bg-[#B43C25]/12 text-[#B43C25]',
      };
    case 'suspended':
      return {
        label: lang === 'ar' ? 'موقوف' : 'Suspended',
        cls: 'bg-[#B43C25]/15 text-[#B43C25]',
      };
    case 'pending':
    default:
      return {
        label: lang === 'ar' ? 'قيد المراجعة' : 'Pending',
        cls: 'bg-[#F7931E]/20 text-[#9A5304]',
      };
  }
}

function getComplaintStatusLabel(status: ComplaintStatus, lang: Language) {
  switch (status) {
    case 'in_review':
      return lang === 'ar' ? 'قيد الفحص' : 'In Review';
    case 'resolved':
      return lang === 'ar' ? 'تم الحل' : 'Resolved';
    case 'dismissed':
      return lang === 'ar' ? 'مرفوضة/مغلقة' : 'Dismissed';
    case 'open':
    default:
      return lang === 'ar' ? 'مفتوحة' : 'Open';
  }
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  activeSection = 'dashboard',
  selectedOrderId = null,
  mealMode = 'list',
  editingMealId = null,
  onNavigate,
}) => {
  const {
    lang,
    setView,
    users,
    providerProfiles,
    allDeliveryPartnerProfiles,
    meals,
    orders,
    complaints,
    reviews,
    lokmaBoxLeads,
    lokmaBoxSurveys,
    lokmaBoxSyncError,
    deliveryPricingConfig,
    adminSyncLoading,
    adminSyncError,
    retryAdminSync,
    assignDeliveryPartnerByAdmin,
    transitionOrderStatus,
    setProviderVerification,
    setDeliveryPartnerVerification,
    updateComplaintStatus,
    toggleReviewVisibility,
    updateDeliveryPricingConfig,
    pushToast,
  } = useLokma();

  const { firebaseUser, isAdmin, authLoading, signOutUser, setReturnTarget } = useFirebaseAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Server-side Admin verification + SQL summary state
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendAuthorized, setBackendAuthorized] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [sqlOverview, setSqlOverview] = useState<SqlOverview | null>(null);
  const [verifyAttempt, setVerifyAttempt] = useState(0);

  // Orders Section Filter State (persisted across /admin/orders <-> /admin/orders/:id navigation)
  const [ordersFilterState, setOrdersFilterState] = useState<AdminOrdersFilterState>(() =>
    typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/admin/orders'
      ? parseOrdersFilterFromSearch(window.location.search)
      : { ...DEFAULT_ORDERS_FILTER_STATE }
  );

  useEffect(() => {
    const handlePop = () => {
      if (window.location.pathname.replace(/\/+$/, '') === '/admin/orders') {
        setOrdersFilterState(parseOrdersFilterFromSearch(window.location.search));
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Partners & Operations Section State
  const [operationsTab, setOperationsTab] = useState<'providers' | 'delivery' | 'complaints' | 'pricing'>('providers');
  const [providerSearch, setProviderSearch] = useState('');
  const [providerStatusFilter, setProviderStatusFilter] = useState<'all' | VerificationStatus>('all');
  const [providerPage, setProviderPage] = useState(1);

  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | VerificationStatus>('all');
  const [deliveryPage, setDeliveryPage] = useState(1);

  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<'all' | ComplaintStatus>('all');
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [reviewsModPage, setReviewsModPage] = useState(1);

  const [suspendTarget, setSuspendTarget] = useState<{
    kind: 'provider' | 'delivery';
    userId: string;
    name: string;
  } | null>(null);
  const [suspendingPartner, setSuspendingPartner] = useState(false);

  const [complaintNotes, setComplaintNotes] = useState<Record<string, string>>({});
  const [feeInput, setFeeInput] = useState(String(deliveryPricingConfig.customer_delivery_fee));
  const [partnerPayInput, setPartnerPayInput] = useState(String(deliveryPricingConfig.partner_earning));
  const [commissionInput, setCommissionInput] = useState(String(deliveryPricingConfig.platform_commission));
  const [savingPricing, setSavingPricing] = useState(false);

  // Events Section State
  const [adminEvents, setAdminEvents] = useState<AdminEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsSearch, setEventsSearch] = useState('');
  const [eventsPage, setEventsPage] = useState(1);
  const [deleteEventTarget, setDeleteEventTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evCategory, setEvCategory] = useState<'workshop' | 'course' | 'event'>('workshop');
  const [evStartsAt, setEvStartsAt] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evOrganizer, setEvOrganizer] = useState('');
  const [evStatus, setEvStatus] = useState<'draft' | 'published' | 'hidden'>('published');
  const [savingEvent, setSavingEvent] = useState(false);

  // Registrations Section State
  const [adminRegistrations, setAdminRegistrations] = useState<AdminRegistrationItem[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regsError, setRegsError] = useState<string | null>(null);
  const [regsSearch, setRegsSearch] = useState('');
  const [regsPage, setRegsPage] = useState(1);

  useEffect(() => {
    setFeeInput(String(deliveryPricingConfig.customer_delivery_fee));
    setPartnerPayInput(String(deliveryPricingConfig.partner_earning));
    setCommissionInput(String(deliveryPricingConfig.platform_commission));
  }, [deliveryPricingConfig]);

  const navigateAdmin = (target: AdminNavigationTarget) => {
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(target);
      return;
    }
    let nextUrl = '/admin';
    if (target.section === 'orders') {
      nextUrl = target.orderId ? `/admin/orders/${target.orderId}` : '/admin/orders';
    } else if (target.section === 'meals') {
      if (target.mealMode === 'new') nextUrl = '/admin/meals/new';
      else if (target.mealMode === 'edit' && target.mealId) nextUrl = `/admin/meals/${target.mealId}/edit`;
      else nextUrl = '/admin/meals';
    } else if (target.section !== 'dashboard') {
      nextUrl = `/admin/${target.section}`;
    }
    window.history.pushState({}, '', nextUrl);
  };

  // Verify admin authorization directly against Backend Express middleware
  const verifyBackendAdmin = useCallback(async () => {
    if (!firebaseUser) {
      setBackendLoading(false);
      setBackendAuthorized(false);
      setBackendError(null);
      return;
    }
    setBackendLoading(true);
    setBackendError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setBackendAuthorized(false);
        setBackendLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = (await res.json()) as BackendDashboardResponse;
      setBackendAuthorized(Boolean(data.authorized));
      setSqlOverview(data.sqlOverview);
    } catch (err) {
      console.error('Admin backend verification failed:', err);
      setBackendError(
        lang === 'ar'
          ? 'تعذر التحقق من صلاحيات الخادم أو تحميل الملخص. يرجى المحاولة مرة أخرى.'
          : 'Failed verifying admin session with backend server.'
      );
    } finally {
      setBackendLoading(false);
    }
  }, [firebaseUser, lang]);

  useEffect(() => {
    if (!authLoading) {
      verifyBackendAdmin();
    }
  }, [authLoading, verifyBackendAdmin, verifyAttempt]);

  const verifyAdminAction = useCallback(async (): Promise<boolean> => {
    if (!firebaseUser) return false;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setBackendAuthorized(false);
        return false;
      }
      if (!res.ok) return false;
      const data = (await res.json()) as BackendDashboardResponse;
      const ok = Boolean(data.authorized);
      setBackendAuthorized(ok);
      return ok;
    } catch {
      return false;
    }
  }, [firebaseUser]);

  const fetchAdminEvents = useCallback(async () => {
    if (!firebaseUser || !backendAuthorized) return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed loading events');
      const data = await res.json();
      setAdminEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEventsError(
        lang === 'ar' ? 'تعذر تحميل قائمة الفعاليات من الخادم' : 'Failed loading admin events'
      );
    } finally {
      setEventsLoading(false);
    }
  }, [firebaseUser, backendAuthorized, lang]);

  const fetchAdminRegistrations = useCallback(async () => {
    if (!firebaseUser || !backendAuthorized) return;
    setRegsLoading(true);
    setRegsError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/registrations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed loading registrations');
      const data = await res.json();
      setAdminRegistrations(Array.isArray(data.registrations) ? data.registrations : []);
    } catch {
      setRegsError(
        lang === 'ar' ? 'تعذر تحميل تسجيلات الفعاليات' : 'Failed loading event registrations'
      );
    } finally {
      setRegsLoading(false);
    }
  }, [firebaseUser, backendAuthorized, lang]);

  useEffect(() => {
    if (backendAuthorized && activeSection === 'events') {
      fetchAdminEvents();
    }
    if (backendAuthorized && activeSection === 'registrations') {
      fetchAdminRegistrations();
    }
  }, [backendAuthorized, activeSection, fetchAdminEvents, fetchAdminRegistrations]);

  // -------------------------------------------------------
  // Real Metrics & Alerts Computation (Zero Mock Data)
  // -------------------------------------------------------
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const studentsCount = users.filter((u) => u.role === 'student').length;

    const providerIds = new Set<string>();
    providerProfiles.forEach((p) => providerIds.add(p.user_id));
    users.filter((u) => u.role === 'provider').forEach((u) => providerIds.add(u.id));

    const deliveryIds = new Set<string>();
    allDeliveryPartnerProfiles.forEach((d) => deliveryIds.add(d.user_id));
    users.filter((u) => u.role === 'delivery_partner').forEach((u) => deliveryIds.add(u.id));

    const totalMeals = meals.length;
    const totalOrders = orders.length;
    const activeOrders = orders.filter(
      (o) => !['delivered', 'cancelled', 'rejected'].includes(o.status)
    ).length;
    const completedOrders = orders.filter((o) => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(
      (o) => o.status === 'cancelled' || o.status === 'rejected'
    ).length;

    const paidOrders = orders.filter(
      (o) => o.payment_status === 'paid' || o.status === 'delivered'
    );
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    return {
      totalUsers,
      studentsCount,
      providersCount: providerIds.size,
      deliveryPartnersCount: deliveryIds.size,
      totalMeals,
      totalOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      paidOrdersCount: paidOrders.length,
      totalRevenue,
    };
  }, [users, providerProfiles, allDeliveryPartnerProfiles, meals, orders]);

  const adminAlerts = useMemo(() => {
    const now = Date.now();
    const pendingConfirmOrders = orders.filter((o) => o.status === 'pending');
    const delayedOrders = orders.filter((o) => {
      if (['delivered', 'cancelled', 'rejected'].includes(o.status)) return false;
      const elapsedMin = (now - Date.parse(o.created_at)) / 60000;
      return o.status === 'pending' ? elapsedMin > 15 : elapsedMin > 45;
    });
    const pendingProviders = providerProfiles.filter(
      (p) => p.verification_status === 'pending'
    );
    const pendingDelivery = allDeliveryPartnerProfiles.filter(
      (d) => d.verification_status === 'pending'
    );
    const activeComplaints = complaints.filter(
      (c) => c.status === 'open' || c.status === 'in_review'
    );

    const items: Array<{
      id: string;
      severity: 'high' | 'medium';
      title: string;
      detail: string;
      actionLabel: string;
      onAction: () => void;
    }> = [];

    if (pendingConfirmOrders.length > 0) {
      items.push({
        id: 'pending_orders',
        severity: 'medium',
        title:
          lang === 'ar'
            ? `${pendingConfirmOrders.length} طلبات جديدة لم يتم تأكيدها`
            : `${pendingConfirmOrders.length} Unconfirmed Orders`,
        detail:
          lang === 'ar'
            ? 'طلبات بانتظار قبول المطبخ أو تدخل الإدارة.'
            : 'Orders waiting for kitchen confirmation.',
        actionLabel: lang === 'ar' ? 'مراجعة الطلبات' : 'Review Orders',
        onAction: () => {
          setOrdersFilterState({ ...DEFAULT_ORDERS_FILTER_STATE, status: 'pending' });
          navigateAdmin({ section: 'orders' });
        },
      });
    }

    if (delayedOrders.length > 0) {
      items.push({
        id: 'delayed_orders',
        severity: 'high',
        title:
          lang === 'ar'
            ? `${delayedOrders.length} طلبات نشطة متأخرة`
            : `${delayedOrders.length} Delayed Active Orders`,
        detail:
          lang === 'ar'
            ? 'تجاوزت المدة القياسية للتحضير أو التأكيد وتحتاج متابعة عاجلة.'
            : 'Exceeded target confirmation or preparation threshold.',
        actionLabel: lang === 'ar' ? 'فتح أول طلب متأخر' : 'Open Delayed Order',
        onAction: () =>
          navigateAdmin({ section: 'orders', orderId: delayedOrders[0].id }),
      });
    }

    if (pendingProviders.length > 0) {
      items.push({
        id: 'pending_providers',
        severity: 'medium',
        title:
          lang === 'ar'
            ? `${pendingProviders.length} مقدم طعام بانتظار المراجعة والتفعيل`
            : `${pendingProviders.length} Providers Awaiting Approval`,
        detail:
          lang === 'ar'
            ? 'مطابخ منزلية جديدة مسجلة وتنتظر اعتماد الإدارة للبدء.'
            : 'New home kitchens pending verification.',
        actionLabel: lang === 'ar' ? 'مراجعة المطابخ' : 'Review Providers',
        onAction: () => {
          setOperationsTab('providers');
          navigateAdmin({ section: 'operations' });
        },
      });
    }

    if (pendingDelivery.length > 0) {
      items.push({
        id: 'pending_delivery',
        severity: 'medium',
        title:
          lang === 'ar'
            ? `${pendingDelivery.length} طلب انضمام لمندوب توصيل`
            : `${pendingDelivery.length} Delivery Partners Pending`,
        detail:
          lang === 'ar'
            ? 'طلاب متقدمون للعمل كمندوبي توصيل ويحتاجون تفعيل الحساب.'
            : 'Student couriers waiting for verification.',
        actionLabel: lang === 'ar' ? 'مراجعة المناديب' : 'Review Partners',
        onAction: () => {
          setOperationsTab('delivery');
          navigateAdmin({ section: 'operations' });
        },
      });
    }

    if (activeComplaints.length > 0) {
      items.push({
        id: 'open_complaints',
        severity: 'high',
        title:
          lang === 'ar'
            ? `${activeComplaints.length} شكاوى وبلاغات مفتوحة`
            : `${activeComplaints.length} Open Complaints`,
        detail:
          lang === 'ar'
            ? 'بلاغات واردة من المستخدمين تحتاج للمعالجة والإغلاق.'
            : 'User-reported issues requiring resolution.',
        actionLabel: lang === 'ar' ? 'معالجة الشكاوى' : 'Handle Complaints',
        onAction: () => {
          setOperationsTab('complaints');
          navigateAdmin({ section: 'operations' });
        },
      });
    }

    return items;
  }, [orders, providerProfiles, allDeliveryPartnerProfiles, complaints, lang]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 5),
    [users]
  );

  // Filtered & paginated Operations / Events / Registrations lists
  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return providerProfiles.filter((p) => {
      if (providerStatusFilter !== 'all' && p.verification_status !== providerStatusFilter) {
        return false;
      }
      if (q) {
        const text = `${p.business_name} ${p.area} ${p.pickup_address}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [providerProfiles, providerSearch, providerStatusFilter]);

  useEffect(() => {
    setProviderPage(1);
  }, [providerSearch, providerStatusFilter]);

  const totalProviderPages = Math.max(
    1,
    Math.ceil(filteredProviders.length / ADMIN_OPS_PAGE_SIZE)
  );
  const paginatedProviders = useMemo(() => {
    const safePage = Math.min(providerPage, totalProviderPages);
    const start = (safePage - 1) * ADMIN_OPS_PAGE_SIZE;
    return filteredProviders.slice(start, start + ADMIN_OPS_PAGE_SIZE);
  }, [filteredProviders, providerPage, totalProviderPages]);

  const filteredDeliveryPartners = useMemo(() => {
    const q = deliverySearch.trim().toLowerCase();
    return allDeliveryPartnerProfiles.filter((dp) => {
      if (deliveryStatusFilter !== 'all' && dp.verification_status !== deliveryStatusFilter) {
        return false;
      }
      if (q) {
        const text = `${dp.full_name} ${dp.student_card_id} ${dp.phone || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allDeliveryPartnerProfiles, deliverySearch, deliveryStatusFilter]);

  useEffect(() => {
    setDeliveryPage(1);
  }, [deliverySearch, deliveryStatusFilter]);

  const totalDeliveryPages = Math.max(
    1,
    Math.ceil(filteredDeliveryPartners.length / ADMIN_OPS_PAGE_SIZE)
  );
  const paginatedDeliveryPartners = useMemo(() => {
    const safePage = Math.min(deliveryPage, totalDeliveryPages);
    const start = (safePage - 1) * ADMIN_OPS_PAGE_SIZE;
    return filteredDeliveryPartners.slice(start, start + ADMIN_OPS_PAGE_SIZE);
  }, [filteredDeliveryPartners, deliveryPage, totalDeliveryPages]);

  const filteredComplaints = useMemo(() => {
    const q = complaintSearch.trim().toLowerCase();
    return complaints.filter((c) => {
      if (complaintStatusFilter !== 'all' && c.status !== complaintStatusFilter) return false;
      if (q) {
        const text = `${c.subject} ${c.description} ${c.resolution_note || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [complaints, complaintSearch, complaintStatusFilter]);

  useEffect(() => {
    setComplaintsPage(1);
  }, [complaintSearch, complaintStatusFilter]);

  const totalComplaintPages = Math.max(
    1,
    Math.ceil(filteredComplaints.length / ADMIN_OPS_PAGE_SIZE)
  );
  const paginatedComplaints = useMemo(() => {
    const safePage = Math.min(complaintsPage, totalComplaintPages);
    const start = (safePage - 1) * ADMIN_OPS_PAGE_SIZE;
    return filteredComplaints.slice(start, start + ADMIN_OPS_PAGE_SIZE);
  }, [filteredComplaints, complaintsPage, totalComplaintPages]);

  const totalReviewModPages = Math.max(1, Math.ceil(reviews.length / ADMIN_OPS_PAGE_SIZE));
  const paginatedReviewsMod = useMemo(() => {
    const safePage = Math.min(reviewsModPage, totalReviewModPages);
    const start = (safePage - 1) * ADMIN_OPS_PAGE_SIZE;
    return reviews.slice(start, start + ADMIN_OPS_PAGE_SIZE);
  }, [reviews, reviewsModPage, totalReviewModPages]);

  const filteredEvents = useMemo(() => {
    const q = eventsSearch.trim().toLowerCase();
    if (!q) return adminEvents;
    return adminEvents.filter((ev) =>
      `${ev.title} ${ev.location || ''} ${ev.organizer || ''}`.toLowerCase().includes(q)
    );
  }, [adminEvents, eventsSearch]);

  useEffect(() => {
    setEventsPage(1);
  }, [eventsSearch]);

  const totalEventsPages = Math.max(1, Math.ceil(filteredEvents.length / ADMIN_OPS_PAGE_SIZE));
  const paginatedEvents = useMemo(() => {
    const safePage = Math.min(eventsPage, totalEventsPages);
    const start = (safePage - 1) * ADMIN_OPS_PAGE_SIZE;
    return filteredEvents.slice(start, start + ADMIN_OPS_PAGE_SIZE);
  }, [filteredEvents, eventsPage, totalEventsPages]);

  const filteredRegistrations = useMemo(() => {
    const q = regsSearch.trim().toLowerCase();
    if (!q) return adminRegistrations;
    return adminRegistrations.filter((reg) =>
      `${reg.userName || ''} ${reg.userEmail || ''} ${reg.eventTitle}`.toLowerCase().includes(q)
    );
  }, [adminRegistrations, regsSearch]);

  useEffect(() => {
    setRegsPage(1);
  }, [regsSearch]);

  const totalRegsPages = Math.max(
    1,
    Math.ceil(filteredRegistrations.length / ADMIN_OPS_PAGE_SIZE)
  );
  const paginatedRegistrations = useMemo(() => {
    const safePage = Math.min(regsPage, totalRegsPages);
    const start = (safePage - 1) * ADMIN_OPS_PAGE_SIZE;
    return filteredRegistrations.slice(start, start + ADMIN_OPS_PAGE_SIZE);
  }, [filteredRegistrations, regsPage, totalRegsPages]);

  const navItems: Array<{
    id: AdminSection;
    labelAr: string;
    labelEn: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', labelAr: 'الطلبات', labelEn: 'Orders', icon: ShoppingBag },
    { id: 'meals', labelAr: 'الوجبات (القائمة)', labelEn: 'Meals Menu', icon: UtensilsCrossed },
    { id: 'users', labelAr: 'المستخدمون', labelEn: 'Users', icon: Users },
    { id: 'operations', labelAr: 'الشركاء والشكاوى', labelEn: 'Partners & Complaints', icon: ShieldCheck },
    { id: 'lokma-box', labelAr: 'أبحاث LOKMA BOX', labelEn: 'LOKMA BOX Research', icon: Package },
    { id: 'events', labelAr: 'الفعاليات', labelEn: 'Events', icon: Calendar },
    { id: 'registrations', labelAr: 'التسجيلات', labelEn: 'Registrations', icon: ClipboardList },
  ];

  const currentNavItem = navItems.find((i) => i.id === activeSection) ?? navItems[0];

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOutUser();
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  // Event CRUD handlers (Admin SQL Backend)
  const openCreateEventModal = () => {
    setEditingEventId(null);
    setEvTitle('');
    setEvDesc('');
    setEvCategory('workshop');
    setEvStartsAt(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setEvLocation('');
    setEvOrganizer('فريق لقمة');
    setEvStatus('published');
    setEventModalOpen(true);
  };

  const openEditEventModal = (ev: AdminEventItem) => {
    setEditingEventId(ev.id);
    setEvTitle(ev.title);
    setEvDesc(ev.description || '');
    setEvCategory(ev.category);
    setEvStartsAt(new Date(ev.startsAt).toISOString().slice(0, 16));
    setEvLocation(ev.location || '');
    setEvOrganizer(ev.organizer || '');
    setEvStatus(ev.status);
    setEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !evTitle.trim() || !evStartsAt) return;
    setSavingEvent(true);
    try {
      const token = await firebaseUser.getIdToken();
      const endpoint = editingEventId
        ? `/api/admin/events/${editingEventId}`
        : '/api/admin/events';
      const method = editingEventId ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: evTitle.trim(),
          description: evDesc.trim() || null,
          category: evCategory,
          startsAt: new Date(evStartsAt).toISOString(),
          location: evLocation.trim() || null,
          organizer: evOrganizer.trim() || null,
          status: evStatus,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed saving event');
      }
      setEventModalOpen(false);
      pushToast(
        editingEventId
          ? lang === 'ar'
            ? 'تم تحديث الفعالية بنجاح'
            : 'Event updated'
          : lang === 'ar'
          ? 'تمت إضافة الفعالية بنجاح'
          : 'Event created'
      );
      fetchAdminEvents();
    } catch (err: unknown) {
      pushToast(err instanceof Error ? err.message : 'Error saving event', 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed deleting event');
      pushToast(lang === 'ar' ? 'تم حذف الفعالية' : 'Event deleted', 'info');
      fetchAdminEvents();
    } catch {
      pushToast(lang === 'ar' ? 'تعذر حذف الفعالية' : 'Could not delete event', 'error');
    }
  };

  // -------------------------------------------------------
  // Auth & Backend RBAC Gates
  // -------------------------------------------------------
  if (authLoading || (firebaseUser && backendLoading)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="hidden lg:block h-[420px] rounded-3xl bg-white border border-[#0B3D2E]/10 animate-pulse" />
          <div className="lg:col-span-3 space-y-5">
            <div className="h-20 rounded-3xl bg-white border border-[#0B3D2E]/10 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-24 rounded-2xl bg-white border border-[#0B3D2E]/10 animate-pulse"
                />
              ))}
            </div>
            <div className="h-64 rounded-3xl bg-white border border-[#0B3D2E]/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (backendError) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-3xl border border-[#B43C25]/30 p-8 text-center space-y-4 shadow-xs">
          <AlertTriangle className="w-10 h-10 text-[#B43C25] mx-auto" />
          <h1 className="text-xl font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Backend Verification Error'}
          </h1>
          <p className="text-xs text-[#4E6359]">{backendError}</p>
          <button
            type="button"
            onClick={() => setVerifyAttempt((n) => n + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !isAdmin || !backendAuthorized) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-3xl border border-[#B43C25]/30 p-8 sm:p-10 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#B43C25]/12 text-[#B43C25] flex items-center justify-center mx-auto">
            {firebaseUser ? <ShieldAlert className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'غير مصرّح' : 'Unauthorized'}
          </h1>
          <p className="text-sm text-[#4E6359] leading-relaxed max-w-md mx-auto">
            {firebaseUser
              ? lang === 'ar'
                ? 'حسابك الحالي لا يملك صلاحيات المشرف المعتمدة على الخادم للوصول إلى لوحة الإدارة.'
                : 'Your account does not have server-verified administrator privileges.'
              : lang === 'ar'
              ? 'يجب تسجيل الدخول بحساب مشرف معتمد للوصول إلى لوحة إدارة لقمة.'
              : 'Sign in with an authorized administrator account to access this console.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {!firebaseUser && (
              <button
                type="button"
                onClick={() => {
                  setReturnTarget({ view: 'admin' });
                  window.history.pushState({}, '', '/login?redirect=admin');
                  setView('auth');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/');
                setView('landing');
              }}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/20 text-[#0B3D2E] text-xs font-bold hover:bg-[#F7931E]/20 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stat cards config (all 10 required KPIs)
  const statCards = [
    {
      label: lang === 'ar' ? 'إجمالي المستخدمين' : 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      tone: 'bg-[#0B3D2E]/8 text-[#0B3D2E]',
      onClick: () => navigateAdmin({ section: 'users' }),
    },
    {
      label: lang === 'ar' ? 'الطلاب المسجلون' : 'Students',
      value: stats.studentsCount,
      icon: GraduationCap,
      tone: 'bg-[#A7C957]/25 text-[#0B3D2E]',
      onClick: () => navigateAdmin({ section: 'users' }),
    },
    {
      label: lang === 'ar' ? 'مقدمو الطعام' : 'Food Providers',
      value: stats.providersCount,
      icon: ChefHat,
      tone: 'bg-[#F7931E]/18 text-[#9A5304]',
      onClick: () => {
        setOperationsTab('providers');
        navigateAdmin({ section: 'operations' });
      },
    },
    {
      label: lang === 'ar' ? 'مندوبو التوصيل' : 'Delivery Partners',
      value: stats.deliveryPartnersCount,
      icon: Bike,
      tone: 'bg-[#0B3D2E]/8 text-[#0B3D2E]',
      onClick: () => {
        setOperationsTab('delivery');
        navigateAdmin({ section: 'operations' });
      },
    },
    {
      label: lang === 'ar' ? 'إجمالي الوجبات' : 'Listed Meals',
      value: stats.totalMeals,
      icon: UtensilsCrossed,
      tone: 'bg-[#FBF0D9] text-[#0B3D2E]',
      onClick: () => navigateAdmin({ section: 'meals', mealMode: 'list' }),
    },
    {
      label: lang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingBag,
      tone: 'bg-[#0B3D2E]/8 text-[#0B3D2E]',
      onClick: () => {
        setOrdersFilterState({ ...DEFAULT_ORDERS_FILTER_STATE, status: 'all' });
        navigateAdmin({ section: 'orders' });
      },
    },
    {
      label: lang === 'ar' ? 'الطلبات النشطة' : 'Active Orders',
      value: stats.activeOrders,
      icon: Clock,
      tone: 'bg-[#F7931E]/18 text-[#9A5304]',
      onClick: () => navigateAdmin({ section: 'orders' }),
    },
    {
      label: lang === 'ar' ? 'الطلبات المكتملة' : 'Completed Orders',
      value: stats.completedOrders,
      icon: CheckCircle2,
      tone: 'bg-[#A7C957]/25 text-[#0B3D2E]',
      onClick: () => {
        setOrdersFilterState({ ...DEFAULT_ORDERS_FILTER_STATE, status: 'delivered' });
        navigateAdmin({ section: 'orders' });
      },
    },
    {
      label: lang === 'ar' ? 'الطلبات الملغاة' : 'Cancelled Orders',
      value: stats.cancelledOrders,
      icon: XCircle,
      tone: 'bg-[#B43C25]/12 text-[#B43C25]',
      onClick: () => {
        setOrdersFilterState({ ...DEFAULT_ORDERS_FILTER_STATE, status: 'cancelled' });
        navigateAdmin({ section: 'orders' });
      },
    },
    {
      label: lang === 'ar' ? 'إجمالي الإيرادات المحصّلة' : 'Collected Revenue',
      value:
        stats.paidOrdersCount > 0
          ? `${stats.totalRevenue.toFixed(0)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`
          : lang === 'ar'
          ? '0 ج.م'
          : '0 EGP',
      subtext:
        stats.paidOrdersCount === 0
          ? lang === 'ar'
            ? 'لا توجد مدفوعات محصّلة بعد'
            : 'No paid orders yet'
          : lang === 'ar'
          ? `من ${stats.paidOrdersCount} طلب مدفوع`
          : `From ${stats.paidOrdersCount} paid orders`,
      icon: Banknote,
      tone: 'bg-[#0B3D2E] text-[#FFF7E6]',
      isDark: true,
      onClick: () => navigateAdmin({ section: 'orders' }),
    },
  ];

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-6 sm:py-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Mobile Dropdown Navigation */}
      <div className="lg:hidden mb-5 relative">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-white border border-[#0B3D2E]/15 text-sm font-bold text-[#13221C] shadow-xs cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5 text-[#0B3D2E]">
            <currentNavItem.icon className="w-4 h-4" />
            <span>{lang === 'ar' ? currentNavItem.labelAr : currentNavItem.labelEn}</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#4E6359] transition-transform ${
              mobileMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {mobileMenuOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-[#0B3D2E]/15 rounded-2xl shadow-lg p-2 z-30 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    navigateAdmin({
                      section: item.id,
                      mealMode: item.id === 'meals' ? 'list' : undefined,
                    })
                  }
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#0B3D2E] text-white'
                      : 'text-[#13221C] hover:bg-[#FFF7E6]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
                </button>
              );
            })}

            <div className="border-t border-[#0B3D2E]/10 my-1 pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-[#B43C25] hover:bg-[#B43C25]/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop RTL Layout: Right Sidebar + Main Content */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <aside
          aria-label={lang === 'ar' ? 'قائمة لوحة الإدارة' : 'Admin Sidebar'}
          className="hidden lg:flex lg:w-64 shrink-0 flex-col justify-between bg-white rounded-3xl border border-[#0B3D2E]/12 p-4 shadow-xs min-h-[540px] sticky top-24"
        >
          <div className="space-y-4">
            <div className="px-3.5 py-3.5 rounded-2xl bg-[#0B3D2E] text-[#FFF7E6] space-y-2">
              <LokmaLogo variant="primary" size="sm" inverted />
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#A7C957]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'بوابة إدارة المنصة' : 'Admin Operations'}</span>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigateAdmin({
                        section: item.id,
                        mealMode: item.id === 'meals' ? 'list' : undefined,
                      })
                    }
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0B3D2E] text-white'
                        : 'text-[#13221C]/85 hover:bg-[#FFF7E6] hover:text-[#0B3D2E]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{lang === 'ar' ? item.labelAr : item.labelEn}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 mt-6 border-t border-[#0B3D2E]/10 space-y-2">
            <p className="px-2 text-[11px] text-[#4E6359] truncate" title={firebaseUser.email || ''}>
              {firebaseUser.email}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3.5 py-3 min-h-[44px] rounded-xl text-xs font-bold text-[#B43C25] hover:bg-[#B43C25]/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <section className="flex-1 min-w-0 w-full space-y-6">
          {/* Firestore Sync Error Banner (if applicable) */}
          {adminSyncError && activeSection !== 'meals' && (
            <div className="bg-white rounded-3xl border border-[#B43C25]/30 p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs font-bold text-[#B43C25]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{adminSyncError}</span>
              </div>
              <button
                type="button"
                onClick={retryAdminSync}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          )}

          {/* -------------------------------------------------------
              SECTION 1: MAIN DASHBOARD (/admin)
             ------------------------------------------------------- */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Header */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E]">
                    {lang === 'ar'
                      ? 'لوحة تحكم الإدارة — منصة لقمة'
                      : 'LOKMA Admin Control Center'}
                  </h1>
                  <p className="text-xs text-[#4E6359] mt-1">
                    {lang === 'ar'
                      ? 'متابعة حية ومباشرة للمستخدمين، الوجبات، الطلبات، مقدمي الطعام، ومندوبي التوصيل'
                      : 'Live overview of users, meals, orders, providers, and delivery partners'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      navigateAdmin({ section: 'meals', mealMode: 'new' })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'ar' ? '+ إضافة وجبة' : '+ Add Meal'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      retryAdminSync();
                      setVerifyAttempt((n) => n + 1);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/20 bg-white text-[#0B3D2E] text-xs font-bold hover:bg-[#FFF7E6] transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${adminSyncLoading ? 'animate-spin' : ''}`} />
                    <span>{lang === 'ar' ? 'تحديث البيانات' : 'Refresh'}</span>
                  </button>
                </div>
              </div>

              {/* 10 Statistics Cards */}
              {adminSyncLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-28 rounded-2xl bg-white border border-[#0B3D2E]/10 animate-pulse p-4"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
                  {statCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={card.onClick}
                        className={`text-start rounded-2xl border p-4 transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                          card.isDark
                            ? 'bg-[#0B3D2E] border-[#0B3D2E] text-[#FFF7E6] hover:bg-[#072B20]'
                            : 'bg-white border-[#0B3D2E]/12 text-[#13221C] hover:border-[#F7931E]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span
                            className={`text-[11px] font-bold ${
                              card.isDark ? 'text-[#FFF7E6]/80' : 'text-[#4E6359]'
                            }`}
                          >
                            {card.label}
                          </span>
                          <span
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              card.isDark ? 'bg-white/15 text-[#F7931E]' : card.tone
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                        </div>
                        <div>
                          <div className="text-xl sm:text-2xl font-extrabold tabular-nums">
                            {card.value}
                          </div>
                          {card.subtext && (
                            <p
                              className={`text-[10px] font-bold mt-0.5 ${
                                card.isDark ? 'text-[#A7C957]' : 'text-[#4E6359]'
                              }`}
                            >
                              {card.subtext}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Actionable Admin Alerts */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#F7931E]/18 text-[#9A5304] flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-[#13221C]">
                        {lang === 'ar' ? 'التنبيهات والإجراءات المطلوبة' : 'Operational Alerts'}
                      </h2>
                      <p className="text-[11px] text-[#4E6359]">
                        {lang === 'ar'
                          ? 'عمليات حقيقية تتطلب مراجعة أو تدخل الإدارة'
                          : 'Live platform items requiring administrative action'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[#0B3D2E] tabular-nums">
                    {adminAlerts.length} {lang === 'ar' ? 'تنبيه' : 'alerts'}
                  </span>
                </div>

                {adminAlerts.length === 0 ? (
                  <div className="rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 p-5 flex items-center gap-3 text-xs font-bold text-[#0B3D2E]">
                    <CheckCircle2 className="w-5 h-5 text-[#166B50] shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? 'لا توجد طلبات متأخرة أو حسابات معلقة أو شكاوى مفتوحة حالياً.'
                        : 'All systems clear — no delayed orders, pending verifications, or open complaints.'}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {adminAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                          alert.severity === 'high'
                            ? 'bg-[#B43C25]/8 border-[#B43C25]/25'
                            : 'bg-[#FFF7E6] border-[#F7931E]/35'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p
                            className={`text-xs font-extrabold ${
                              alert.severity === 'high' ? 'text-[#B43C25]' : 'text-[#9A5304]'
                            }`}
                          >
                            {alert.title}
                          </p>
                          <p className="text-[11px] text-[#4E6359]">{alert.detail}</p>
                        </div>
                        <button
                          type="button"
                          onClick={alert.onAction}
                          className="px-3.5 py-2 rounded-xl bg-white border border-[#0B3D2E]/18 text-[#0B3D2E] text-[11px] font-extrabold hover:bg-[#0B3D2E] hover:text-white transition-colors cursor-pointer shrink-0"
                        >
                          {alert.actionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent 5 Orders + Recent 5 Users */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Recent 5 Orders */}
                <div className="xl:col-span-2 bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-extrabold text-[#13221C]">
                        {lang === 'ar' ? 'آخر 5 طلبات' : 'Latest 5 Orders'}
                      </h2>
                      <p className="text-[11px] text-[#4E6359]">
                        {lang === 'ar'
                          ? 'أحدث الطلبات المسجلة على المنصة مع تفاصيل الحالة'
                          : 'Most recent orders placed on the platform'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateAdmin({ section: 'orders' })}
                      className="text-xs font-extrabold text-[#0B3D2E] hover:text-[#F7931E] cursor-pointer"
                    >
                      {lang === 'ar' ? 'عرض جميع الطلبات' : 'View All Orders'}
                    </button>
                  </div>

                  {recentOrders.length === 0 ? (
                    <div className="rounded-2xl bg-[#FFF7E6]/60 p-8 text-center text-xs font-bold text-[#4E6359]">
                      {lang === 'ar' ? 'لا توجد طلبات مسجلة حتى الآن.' : 'No orders recorded yet.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-start border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#0B3D2E]/10 text-[11px] font-extrabold text-[#4E6359]">
                            <th className="py-2.5 px-2 text-start">
                              {lang === 'ar' ? 'الطالب' : 'Student'}
                            </th>
                            <th className="py-2.5 px-2 text-start">
                              {lang === 'ar' ? 'الوجبة' : 'Meal'}
                            </th>
                            <th className="py-2.5 px-2 text-start">
                              {lang === 'ar' ? 'مقدم الطعام' : 'Provider'}
                            </th>
                            <th className="py-2.5 px-2 text-start">
                              {lang === 'ar' ? 'الإجمالي' : 'Total'}
                            </th>
                            <th className="py-2.5 px-2 text-start">
                              {lang === 'ar' ? 'التاريخ' : 'Date'}
                            </th>
                            <th className="py-2.5 px-2 text-start">
                              {lang === 'ar' ? 'الحالة' : 'Status'}
                            </th>
                            <th className="py-2.5 px-2 text-end">
                              {lang === 'ar' ? 'التفاصيل' : 'Details'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0B3D2E]/8">
                          {recentOrders.map((order) => {
                            const badge = getOrderStatusBadge(order.status, lang);
                            const mealSummary =
                              order.items_summary.map((i) => i.meal_name).join('، ') || '—';
                            return (
                              <tr key={order.id} className="hover:bg-[#FFF7E6]/40">
                                <td className="py-3 px-2 font-bold text-[#13221C] whitespace-nowrap">
                                  {order.student_name}
                                </td>
                                <td className="py-3 px-2 text-[#13221C] max-w-[160px] truncate">
                                  {mealSummary}
                                </td>
                                <td className="py-3 px-2 font-bold text-[#0B3D2E] whitespace-nowrap">
                                  {order.provider_name}
                                </td>
                                <td className="py-3 px-2 font-extrabold tabular-nums whitespace-nowrap">
                                  {order.total_amount.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-2 text-[11px] text-[#4E6359] tabular-nums whitespace-nowrap">
                                  {new Date(order.created_at).toLocaleString(
                                    lang === 'ar' ? 'ar-EG' : 'en-US',
                                    { dateStyle: 'short', timeStyle: 'short' }
                                  )}
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-extrabold ${badge.cls}`}
                                  >
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-end whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigateAdmin({ section: 'orders', orderId: order.id })
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-[#FFF7E6] border border-[#0B3D2E]/15 text-[11px] font-bold text-[#0B3D2E] hover:bg-[#0B3D2E] hover:text-white transition-colors cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'التفاصيل' : 'View'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent 5 Users (no unnecessary PII) */}
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-extrabold text-[#13221C]">
                        {lang === 'ar' ? 'أحدث 5 مستخدمين' : 'Latest 5 Users'}
                      </h2>
                      <p className="text-[11px] text-[#4E6359]">
                        {lang === 'ar' ? 'أحدث الحسابات المنضمة للمنصة' : 'Newest joined accounts'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateAdmin({ section: 'users' })}
                      className="text-xs font-extrabold text-[#0B3D2E] hover:text-[#F7931E] cursor-pointer"
                    >
                      {lang === 'ar' ? 'الكل' : 'All'}
                    </button>
                  </div>

                  {recentUsers.length === 0 ? (
                    <div className="rounded-2xl bg-[#FFF7E6]/60 p-8 text-center text-xs font-bold text-[#4E6359]">
                      {lang === 'ar' ? 'لا يوجد مستخدمون مسجلون بعد.' : 'No users registered yet.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#0B3D2E]/8">
                      {recentUsers.map((u) => (
                        <div key={u.id} className="py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-[#13221C] truncate">
                              {u.full_name || u.email}
                            </p>
                            <p className="text-[11px] text-[#4E6359] truncate" dir="ltr">
                              {u.email}
                            </p>
                            <p className="text-[10px] text-[#4E6359] tabular-nums mt-0.5">
                              {new Date(u.created_at).toLocaleDateString(
                                lang === 'ar' ? 'ar-EG' : 'en-US',
                                { dateStyle: 'medium' }
                              )}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-[#FFF7E6] border border-[#0B3D2E]/12 text-[10px] font-extrabold text-[#0B3D2E] shrink-0">
                            {getRoleLabel(u.role, lang)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Charts Analytics */}
              <AdminDashboardCharts
                orders={orders}
                meals={meals}
                users={users}
                providerProfiles={providerProfiles}
                lang={lang}
                loading={adminSyncLoading}
              />

              {/* Events & Registrations Real Summary Strip */}
              {sqlOverview && (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-[#0B3D2E]">
                      {lang === 'ar'
                        ? 'ملخص الفعاليات والتسجيلات المجتمعية'
                        : 'Community Events & Registrations Summary'}
                    </h3>
                    <p className="text-xs text-[#4E6359] tabular-nums">
                      {lang === 'ar'
                        ? `إجمالي الفعاليات: ${sqlOverview.totalEvents} (${sqlOverview.publishedEvents} منشورة) · إجمالي التسجيلات: ${sqlOverview.totalRegistrations}`
                        : `Total Events: ${sqlOverview.totalEvents} (${sqlOverview.publishedEvents} published) · Registrations: ${sqlOverview.totalRegistrations}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigateAdmin({ section: 'events' })}
                      className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
                    >
                      {lang === 'ar' ? 'إدارة الفعاليات' : 'Manage Events'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateAdmin({ section: 'registrations' })}
                      className="px-4 py-2 rounded-xl border border-[#0B3D2E]/20 text-[#0B3D2E] text-xs font-bold hover:bg-[#FFF7E6] cursor-pointer"
                    >
                      {lang === 'ar' ? 'عرض التسجيلات' : 'View Registrations'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------------
              SECTION 2: ORDERS & ORDER DETAILS (/admin/orders & /admin/orders/:id)
             ------------------------------------------------------- */}
          {activeSection === 'orders' &&
            (selectedOrderId ? (
              <AdminOrderDetails
                order={orders.find((o) => o.id === selectedOrderId) ?? null}
                providerProfiles={providerProfiles}
                deliveryPartners={allDeliveryPartnerProfiles}
                lang={lang}
                onBack={() => navigateAdmin({ section: 'orders' })}
                onAssignPartner={assignDeliveryPartnerByAdmin}
                onTransitionStatus={transitionOrderStatus}
              />
            ) : (
              <AdminOrdersView
                loading={adminSyncLoading}
                error={adminSyncError}
                filters={ordersFilterState}
                onChangeFilters={setOrdersFilterState}
                onRetry={retryAdminSync}
                onSelectOrder={(orderId: string) =>
                  navigateAdmin({ section: 'orders', orderId })
                }
              />
            ))}

          {/* -------------------------------------------------------
              SECTION 3: MEALS MENU MANAGEMENT (/admin/meals*)
             ------------------------------------------------------- */}
          {activeSection === 'meals' && (
            <AdminMealsManager
              mode={mealMode}
              editingMealId={editingMealId}
              loading={adminSyncLoading}
              error={adminSyncError}
              onRetry={retryAdminSync}
              onVerifyAdminAction={verifyAdminAction}
              onNavigateList={() => navigateAdmin({ section: 'meals', mealMode: 'list' })}
              onNavigateNew={() => navigateAdmin({ section: 'meals', mealMode: 'new' })}
              onNavigateEdit={(id: string) =>
                navigateAdmin({ section: 'meals', mealMode: 'edit', mealId: id })
              }
            />
          )}

          {/* -------------------------------------------------------
              SECTION 4: READ-ONLY USERS MANAGEMENT (/admin/users)
             ------------------------------------------------------- */}
          {activeSection === 'users' && (
            <AdminUsersView
              loading={adminSyncLoading}
              error={adminSyncError}
              onRetry={retryAdminSync}
            />
          )}

          {/* -------------------------------------------------------
              SECTION 4B: PARTNERS, COMPLAINTS & PRICING (/admin/operations)
             ------------------------------------------------------- */}
          {activeSection === 'operations' && (
            <div className="space-y-5">
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <h2 className="text-xl font-extrabold text-[#0B3D2E]">
                  {lang === 'ar'
                    ? 'اعتماد الشركاء والشكاوى وتسعيرة التوصيل'
                    : 'Partners, Complaints & Delivery Pricing'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'providers', label: lang === 'ar' ? `مقدمو الطعام (${providerProfiles.length})` : `Providers (${providerProfiles.length})` },
                    { id: 'delivery', label: lang === 'ar' ? `مندوبو التوصيل (${allDeliveryPartnerProfiles.length})` : `Delivery (${allDeliveryPartnerProfiles.length})` },
                    { id: 'complaints', label: lang === 'ar' ? `الشكاوى والتقييمات (${complaints.length})` : `Complaints & Reviews` },
                    { id: 'pricing', label: lang === 'ar' ? 'تسعيرة التوصيل' : 'Delivery Pricing' },
                  ].map((tabItem) => (
                    <button
                      key={tabItem.id}
                      type="button"
                      onClick={() =>
                        setOperationsTab(
                          tabItem.id as 'providers' | 'delivery' | 'complaints' | 'pricing'
                        )
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        operationsTab === tabItem.id
                          ? 'bg-[#0B3D2E] text-white'
                          : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#FBF0D9]'
                      }`}
                    >
                      {tabItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {operationsTab === 'providers' && (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'all', ar: 'الكل', en: 'All' },
                          { id: 'pending', ar: 'قيد المراجعة', en: 'Pending' },
                          { id: 'verified', ar: 'موثق', en: 'Verified' },
                          { id: 'suspended', ar: 'موقوف', en: 'Suspended' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setProviderStatusFilter(st.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                            providerStatusFilter === st.id
                              ? 'bg-[#0B3D2E] text-white'
                              : 'bg-[#FFF7E6] text-[#13221C]'
                          }`}
                        >
                          {lang === 'ar' ? st.ar : st.en}
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
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder={lang === 'ar' ? 'بحث باسم المطبخ أو المنطقة...' : 'Search kitchens...'}
                        className={`w-full py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                          lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                        }`}
                      />
                    </div>
                  </div>

                  {filteredProviders.length === 0 ? (
                    <p className="text-xs font-bold text-[#4E6359] py-4 text-center">
                      {lang === 'ar' ? 'لا يوجد مقدمو طعام مطابقون.' : 'No food providers found.'}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {paginatedProviders.map((p) => {
                          const badge = getVerificationBadge(p.verification_status, lang);
                          return (
                            <div
                              key={p.user_id}
                              className="rounded-2xl border border-[#0B3D2E]/10 p-4 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div>
                                <p className="text-sm font-extrabold text-[#0B3D2E]">{p.business_name}</p>
                                <p className="text-xs text-[#4E6359]">
                                  {p.area} · {p.pickup_address}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                                {p.verification_status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={() => void setProviderVerification(p.user_id, 'verified')}
                                    className="px-3 py-1.5 rounded-lg bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'اعتماد وتفعيل' : 'Verify'}
                                  </button>
                                )}
                                {p.verification_status !== 'suspended' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSuspendTarget({
                                        kind: 'provider',
                                        userId: p.user_id,
                                        name: p.business_name,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-[#B43C25]/30 text-[#B43C25] text-xs font-bold cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'إيقاف' : 'Suspend'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalProviderPages > 1 && (
                        <div className="flex items-center justify-between pt-2 text-xs">
                          <span className="font-bold text-[#4E6359] tabular-nums">
                            {lang === 'ar'
                              ? `صفحة ${providerPage} من ${totalProviderPages}`
                              : `Page ${providerPage} of ${totalProviderPages}`}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={providerPage <= 1}
                              onClick={() => setProviderPage((p) => Math.max(1, p - 1))}
                              className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                            >
                              {lang === 'ar' ? 'السابق' : 'Prev'}
                            </button>
                            <button
                              type="button"
                              disabled={providerPage >= totalProviderPages}
                              onClick={() => setProviderPage((p) => Math.min(totalProviderPages, p + 1))}
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
              )}

              {operationsTab === 'delivery' && (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'all', ar: 'الكل', en: 'All' },
                          { id: 'pending', ar: 'قيد المراجعة', en: 'Pending' },
                          { id: 'verified', ar: 'موثق', en: 'Verified' },
                          { id: 'suspended', ar: 'موقوف', en: 'Suspended' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setDeliveryStatusFilter(st.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                            deliveryStatusFilter === st.id
                              ? 'bg-[#0B3D2E] text-white'
                              : 'bg-[#FFF7E6] text-[#13221C]'
                          }`}
                        >
                          {lang === 'ar' ? st.ar : st.en}
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
                        value={deliverySearch}
                        onChange={(e) => setDeliverySearch(e.target.value)}
                        placeholder={lang === 'ar' ? 'بحث بالاسم أو الكارنيه...' : 'Search partner or card...'}
                        className={`w-full py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                          lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                        }`}
                      />
                    </div>
                  </div>

                  {filteredDeliveryPartners.length === 0 ? (
                    <p className="text-xs font-bold text-[#4E6359] py-4 text-center">
                      {lang === 'ar' ? 'لا يوجد مندوبو توصيل مطابقون.' : 'No delivery partners found.'}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {paginatedDeliveryPartners.map((dp) => {
                          const badge = getVerificationBadge(dp.verification_status, lang);
                          return (
                            <div
                              key={dp.user_id}
                              className="rounded-2xl border border-[#0B3D2E]/10 p-4 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div>
                                <p className="text-sm font-extrabold text-[#0B3D2E]">{dp.full_name}</p>
                                <p className="text-xs text-[#4E6359] tabular-nums">
                                  {dp.delivery_method === 'bicycle'
                                    ? lang === 'ar'
                                      ? 'دراجة هوائية'
                                      : 'Bicycle'
                                    : lang === 'ar'
                                    ? 'سير على الأقدام'
                                    : 'Walking'}{' '}
                                  · {dp.completed_deliveries}{' '}
                                  {lang === 'ar' ? 'توصيلة مكتملة' : 'completed deliveries'}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                                {dp.verification_status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={() => void setDeliveryPartnerVerification(dp.user_id, 'verified')}
                                    className="px-3 py-1.5 rounded-lg bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'اعتماد المندوب' : 'Approve'}
                                  </button>
                                )}
                                {dp.verification_status !== 'suspended' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSuspendTarget({
                                        kind: 'delivery',
                                        userId: dp.user_id,
                                        name: dp.full_name,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-[#B43C25]/30 text-[#B43C25] text-xs font-bold cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'إيقاف' : 'Suspend'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalDeliveryPages > 1 && (
                        <div className="flex items-center justify-between pt-2 text-xs">
                          <span className="font-bold text-[#4E6359] tabular-nums">
                            {lang === 'ar'
                              ? `صفحة ${deliveryPage} من ${totalDeliveryPages}`
                              : `Page ${deliveryPage} of ${totalDeliveryPages}`}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={deliveryPage <= 1}
                              onClick={() => setDeliveryPage((p) => Math.max(1, p - 1))}
                              className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                            >
                              {lang === 'ar' ? 'السابق' : 'Prev'}
                            </button>
                            <button
                              type="button"
                              disabled={deliveryPage >= totalDeliveryPages}
                              onClick={() =>
                                setDeliveryPage((p) => Math.min(totalDeliveryPages, p + 1))
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
              )}

              {operationsTab === 'complaints' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="text-sm font-extrabold text-[#13221C] flex items-center gap-2">
                        <MessageSquareWarning className="w-4 h-4 text-[#B43C25]" />
                        <span>{lang === 'ar' ? 'سجل الشكاوى' : 'Complaints'}</span>
                      </h3>
                      <div className="relative sm:w-64">
                        <Search
                          className={`w-3.5 h-3.5 text-[#4E6359] absolute top-3 ${
                            lang === 'ar' ? 'right-3' : 'left-3'
                          }`}
                        />
                        <input
                          type="text"
                          value={complaintSearch}
                          onChange={(e) => setComplaintSearch(e.target.value)}
                          placeholder={lang === 'ar' ? 'بحث في الشكاوى...' : 'Search complaints...'}
                          className={`w-full py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                            lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'all', ar: 'الكل', en: 'All' },
                          { id: 'open', ar: 'مفتوحة', en: 'Open' },
                          { id: 'in_review', ar: 'قيد الفحص', en: 'In Review' },
                          { id: 'resolved', ar: 'تم الحل', en: 'Resolved' },
                          { id: 'dismissed', ar: 'مغلقة', en: 'Dismissed' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setComplaintStatusFilter(st.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                            complaintStatusFilter === st.id
                              ? 'bg-[#0B3D2E] text-white'
                              : 'bg-[#FFF7E6] text-[#13221C]'
                          }`}
                        >
                          {lang === 'ar' ? st.ar : st.en}
                        </button>
                      ))}
                    </div>

                    {filteredComplaints.length === 0 ? (
                      <p className="text-xs text-[#4E6359] py-3">
                        {lang === 'ar' ? 'لا توجد شكاوى مطابقة.' : 'No complaints found.'}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {paginatedComplaints.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-2xl border border-[#0B3D2E]/10 p-4 space-y-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-extrabold text-[#13221C]">{c.subject}</p>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#FFF7E6] text-[#0B3D2E]">
                                  {getComplaintStatusLabel(c.status, lang)}
                                </span>
                              </div>
                              <p className="text-xs text-[#4E6359]">{c.description}</p>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  value={complaintNotes[c.id] ?? c.resolution_note ?? ''}
                                  onChange={(e) =>
                                    setComplaintNotes((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={lang === 'ar' ? 'ملاحظة الحل...' : 'Resolution note...'}
                                  className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-[#0B3D2E]/18 text-xs"
                                />
                                {(['in_review', 'resolved', 'dismissed'] as ComplaintStatus[]).map(
                                  (st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() =>
                                        void updateComplaintStatus(c.id, st, complaintNotes[c.id] || '')
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-[#0B3D2E]/8 text-[#0B3D2E] text-[11px] font-bold hover:bg-[#0B3D2E] hover:text-white cursor-pointer"
                                    >
                                      {getComplaintStatusLabel(st, lang)}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {totalComplaintPages > 1 && (
                          <div className="flex items-center justify-between pt-2 text-xs">
                            <span className="font-bold text-[#4E6359] tabular-nums">
                              {lang === 'ar'
                                ? `صفحة ${complaintsPage} من ${totalComplaintPages}`
                                : `Page ${complaintsPage} of ${totalComplaintPages}`}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={complaintsPage <= 1}
                                onClick={() => setComplaintsPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                              >
                                {lang === 'ar' ? 'السابق' : 'Prev'}
                              </button>
                              <button
                                type="button"
                                disabled={complaintsPage >= totalComplaintPages}
                                onClick={() =>
                                  setComplaintsPage((p) => Math.min(totalComplaintPages, p + 1))
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

                  <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-3">
                    <h3 className="text-sm font-extrabold text-[#13221C]">
                      {lang === 'ar' ? 'مراقبة التقييمات' : 'Reviews Moderation'}
                    </h3>
                    {reviews.length === 0 ? (
                      <p className="text-xs text-[#4E6359]">
                        {lang === 'ar' ? 'لا توجد تقييمات بعد.' : 'No reviews yet.'}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2.5">
                          {paginatedReviewsMod.map((rev) => (
                            <div
                              key={rev.id}
                              className="rounded-2xl border border-[#0B3D2E]/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <p className="font-bold text-[#13221C] tabular-nums">
                                  ★ {rev.rating}/5 — {rev.comment || '—'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void toggleReviewVisibility(rev.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#0B3D2E]/20 font-bold text-[#0B3D2E] cursor-pointer"
                              >
                                {rev.is_visible ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>{lang === 'ar' ? 'إخفاء' : 'Hide'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{lang === 'ar' ? 'إظهار' : 'Show'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>

                        {totalReviewModPages > 1 && (
                          <div className="flex items-center justify-between pt-2 text-xs">
                            <span className="font-bold text-[#4E6359] tabular-nums">
                              {lang === 'ar'
                                ? `صفحة ${reviewsModPage} من ${totalReviewModPages}`
                                : `Page ${reviewsModPage} of ${totalReviewModPages}`}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={reviewsModPage <= 1}
                                onClick={() => setReviewsModPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 font-bold disabled:opacity-45 cursor-pointer"
                              >
                                {lang === 'ar' ? 'السابق' : 'Prev'}
                              </button>
                              <button
                                type="button"
                                disabled={reviewsModPage >= totalReviewModPages}
                                onClick={() =>
                                  setReviewsModPage((p) => Math.min(totalReviewModPages, p + 1))
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

              {operationsTab === 'pricing' && (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4 max-w-xl">
                  <h3 className="text-sm font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'إعدادات تسعيرة التوصيل' : 'Delivery Pricing Config'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-[#4E6359] mb-1">
                        {lang === 'ar' ? 'رسوم الطالب (ج.م)' : 'Customer Fee'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={feeInput}
                        onChange={(e) => setFeeInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#0B3D2E]/20 font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#4E6359] mb-1">
                        {lang === 'ar' ? 'ربح المندوب (ج.م)' : 'Partner Earning'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={partnerPayInput}
                        onChange={(e) => setPartnerPayInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#0B3D2E]/20 font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#4E6359] mb-1">
                        {lang === 'ar' ? 'عمولة المنصة (ج.م)' : 'Platform Commission'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={commissionInput}
                        onChange={(e) => setCommissionInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#0B3D2E]/20 font-bold tabular-nums"
                      />
                    </div>
                  </div>
                  {Number(partnerPayInput || 0) + Number(commissionInput || 0) >
                    Number(feeInput || 0) && (
                    <p className="text-xs font-semibold text-[#9A5304] bg-[#F7931E]/15 px-3 py-2 rounded-xl">
                      {lang === 'ar'
                        ? 'تنبيه: مجموع ربح المندوب والعمولة أكبر من رسوم الطالب (سيتم احتساب الفرق كدعم من المنصة).'
                        : 'Note: Partner earning + commission exceeds customer fee (platform subsidizes difference).'}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={savingPricing}
                    onClick={async () => {
                      const fee = Number(feeInput);
                      const partner = Number(partnerPayInput);
                      const commission = Number(commissionInput);
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
                            ? 'أدخل قيماً صحيحة للتسعيرة بين 0 و 500 ج.م'
                            : 'Enter valid pricing numbers between 0 and 500 EGP',
                          'error'
                        );
                        return;
                      }
                      setSavingPricing(true);
                      try {
                        await updateDeliveryPricingConfig({
                          customer_delivery_fee: fee,
                          partner_earning: partner,
                          platform_commission: commission,
                        });
                      } finally {
                        setSavingPricing(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] disabled:opacity-50 cursor-pointer"
                  >
                    {savingPricing
                      ? lang === 'ar'
                        ? 'جاري الحفظ...'
                        : 'Saving...'
                      : lang === 'ar'
                      ? 'حفظ التسعيرة'
                      : 'Save Pricing'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------------
              SECTION 5: EVENTS MANAGEMENT (/admin/events)
             ------------------------------------------------------- */}
          {activeSection === 'events' && (
            <div className="space-y-5">
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'إدارة الفعاليات والورش' : 'Events & Workshops'}
                  </h2>
                  <p className="text-xs text-[#4E6359] mt-0.5">
                    {lang === 'ar'
                      ? 'إضافة وتعديل ونشر فعاليات لقمة المرتبطة بقاعدة البيانات'
                      : 'Manage LOKMA community workshops and events'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search
                      className={`w-3.5 h-3.5 text-[#4E6359] absolute top-3 ${
                        lang === 'ar' ? 'right-3' : 'left-3'
                      }`}
                    />
                    <input
                      type="text"
                      value={eventsSearch}
                      onChange={(e) => setEventsSearch(e.target.value)}
                      placeholder={lang === 'ar' ? 'بحث في الفعاليات...' : 'Search events...'}
                      className={`py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                        lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openCreateEventModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'ar' ? '+ إضافة فعالية' : '+ New Event'}</span>
                  </button>
                </div>
              </div>

              {eventsError && (
                <div className="bg-white rounded-2xl border border-[#B43C25]/30 p-4 flex items-center justify-between text-xs font-bold text-[#B43C25]">
                  <span>{eventsError}</span>
                  <button type="button" onClick={fetchAdminEvents} className="underline cursor-pointer">
                    {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              )}

              {eventsLoading ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-2xl bg-[#FFF7E6]" />
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center text-xs font-bold text-[#4E6359]">
                  {lang === 'ar' ? 'لا توجد فعاليات مطابقة حالياً.' : 'No matching events found.'}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-extrabold text-[#0B3D2E]">{ev.title}</h3>
                            <span className="px-2 py-0.5 rounded-lg bg-[#FFF7E6] text-[10px] font-extrabold text-[#0B3D2E]">
                              {ev.status === 'published'
                                ? lang === 'ar'
                                  ? 'منشورة'
                                  : 'Published'
                                : ev.status === 'hidden'
                                ? lang === 'ar'
                                  ? 'مخفية'
                                  : 'Hidden'
                                : lang === 'ar'
                                ? 'مسودة'
                                : 'Draft'}
                            </span>
                          </div>
                          <p className="text-xs text-[#4E6359] tabular-nums">
                            {new Date(ev.startsAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}{' '}
                            · {ev.location || '—'} ·{' '}
                            <strong className="text-[#0B3D2E]">
                              {ev.registrationsCount} {lang === 'ar' ? 'مسجّل' : 'registered'}
                            </strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditEventModal(ev)}
                            aria-label={lang === 'ar' ? 'تعديل الفعالية' : 'Edit event'}
                            className="p-2 rounded-xl border border-[#0B3D2E]/18 text-[#0B3D2E] hover:bg-[#FFF7E6] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteEventTarget({ id: ev.id, title: ev.title })}
                            aria-label={lang === 'ar' ? 'حذف الفعالية' : 'Delete event'}
                            className="p-2 rounded-xl border border-[#B43C25]/25 text-[#B43C25] hover:bg-[#B43C25]/10 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalEventsPages > 1 && (
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="font-bold text-[#4E6359] tabular-nums">
                        {lang === 'ar'
                          ? `صفحة ${eventsPage} من ${totalEventsPages}`
                          : `Page ${eventsPage} of ${totalEventsPages}`}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={eventsPage <= 1}
                          onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 bg-white font-bold disabled:opacity-45 cursor-pointer"
                        >
                          {lang === 'ar' ? 'السابق' : 'Prev'}
                        </button>
                        <button
                          type="button"
                          disabled={eventsPage >= totalEventsPages}
                          onClick={() => setEventsPage((p) => Math.min(totalEventsPages, p + 1))}
                          className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 bg-white font-bold disabled:opacity-45 cursor-pointer"
                        >
                          {lang === 'ar' ? 'التالي' : 'Next'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {eventModalOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                  role="dialog"
                  aria-modal="true"
                >
                  <form
                    onSubmit={handleSaveEvent}
                    className="bg-white rounded-3xl border border-[#0B3D2E]/15 max-w-lg w-full p-6 space-y-4 shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-[#0B3D2E]">
                        {editingEventId
                          ? lang === 'ar'
                            ? 'تعديل الفعالية'
                            : 'Edit Event'
                          : lang === 'ar'
                          ? 'إضافة فعالية جديدة'
                          : 'Create Event'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEventModalOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-[#FFF7E6] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <input
                        type="text"
                        required
                        value={evTitle}
                        onChange={(e) => setEvTitle(e.target.value)}
                        placeholder={lang === 'ar' ? 'عنوان الفعالية *' : 'Event Title *'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20"
                      />
                      <textarea
                        rows={3}
                        value={evDesc}
                        onChange={(e) => setEvDesc(e.target.value)}
                        placeholder={lang === 'ar' ? 'وصف الفعالية' : 'Description'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={evCategory}
                          onChange={(e) =>
                            setEvCategory(e.target.value as 'workshop' | 'course' | 'event')
                          }
                          className="px-3 py-2.5 rounded-xl border border-[#0B3D2E]/20 font-bold"
                        >
                          <option value="workshop">{lang === 'ar' ? 'ورشة عمل' : 'Workshop'}</option>
                          <option value="course">{lang === 'ar' ? 'دورة تدريبية' : 'Course'}</option>
                          <option value="event">{lang === 'ar' ? 'فعالية' : 'Event'}</option>
                        </select>
                        <select
                          value={evStatus}
                          onChange={(e) =>
                            setEvStatus(e.target.value as 'draft' | 'published' | 'hidden')
                          }
                          className="px-3 py-2.5 rounded-xl border border-[#0B3D2E]/20 font-bold"
                        >
                          <option value="published">{lang === 'ar' ? 'منشورة' : 'Published'}</option>
                          <option value="draft">{lang === 'ar' ? 'مسودة' : 'Draft'}</option>
                          <option value="hidden">{lang === 'ar' ? 'مخفية' : 'Hidden'}</option>
                        </select>
                      </div>
                      <input
                        type="datetime-local"
                        required
                        value={evStartsAt}
                        onChange={(e) => setEvStartsAt(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20"
                      />
                      <input
                        type="text"
                        value={evLocation}
                        onChange={(e) => setEvLocation(e.target.value)}
                        placeholder={lang === 'ar' ? 'المكان' : 'Location'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20"
                      />
                      <input
                        type="text"
                        value={evOrganizer}
                        onChange={(e) => setEvOrganizer(e.target.value)}
                        placeholder={lang === 'ar' ? 'الجهة المنظمة' : 'Organizer'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#0B3D2E]/20"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEventModalOpen(false)}
                        className="px-4 py-2 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold cursor-pointer"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={savingEvent}
                        className="px-5 py-2 rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] disabled:opacity-50 cursor-pointer"
                      >
                        {savingEvent
                          ? lang === 'ar'
                            ? 'جاري الحفظ...'
                            : 'Saving...'
                          : lang === 'ar'
                          ? 'حفظ الفعالية'
                          : 'Save Event'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------------
              SECTION 6: EVENT REGISTRATIONS (/admin/registrations)
             ------------------------------------------------------- */}
          {activeSection === 'registrations' && (
            <div className="space-y-5">
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'تسجيلات الفعاليات' : 'Event Registrations'}
                  </h2>
                  <p className="text-xs text-[#4E6359] mt-0.5 tabular-nums">
                    {lang === 'ar'
                      ? `إجمالي التسجيلات: ${adminRegistrations.length}`
                      : `Total registrations: ${adminRegistrations.length}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search
                      className={`w-3.5 h-3.5 text-[#4E6359] absolute top-3 ${
                        lang === 'ar' ? 'right-3' : 'left-3'
                      }`}
                    />
                    <input
                      type="text"
                      value={regsSearch}
                      onChange={(e) => setRegsSearch(e.target.value)}
                      placeholder={lang === 'ar' ? 'بحث بالاسم أو الفعالية...' : 'Search registrations...'}
                      className={`py-2 rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs ${
                        lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchAdminRegistrations}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#0B3D2E] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
                  </button>
                </div>
              </div>

              {regsError && (
                <div className="bg-white rounded-2xl border border-[#B43C25]/30 p-4 text-xs font-bold text-[#B43C25]">
                  {regsError}
                </div>
              )}

              {regsLoading ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 h-40 animate-pulse" />
              ) : filteredRegistrations.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center text-xs font-bold text-[#4E6359]">
                  {lang === 'ar'
                    ? 'لا توجد تسجيلات مطابقة حتى الآن.'
                    : 'No matching event registrations found.'}
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FFF7E6]/80 border-b border-[#0B3D2E]/10 text-[11px] font-extrabold text-[#4E6359]">
                            <th className="py-3.5 px-4 text-start">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                            <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'البريد' : 'Email'}</th>
                            <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'الفعالية' : 'Event'}</th>
                            <th className="py-3.5 px-3 text-start">{lang === 'ar' ? 'تاريخ التسجيل' : 'Registered At'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0B3D2E]/8">
                          {paginatedRegistrations.map((reg) => (
                            <tr key={reg.id}>
                              <td className="py-3.5 px-4 font-bold text-[#13221C]">
                                {reg.userName || reg.userId}
                              </td>
                              <td className="py-3.5 px-3 text-[#4E6359]" dir="ltr">
                                {reg.userEmail || '—'}
                              </td>
                              <td className="py-3.5 px-3 font-bold text-[#0B3D2E]">
                                {reg.eventTitle}
                              </td>
                              <td className="py-3.5 px-3 text-[11px] text-[#4E6359] tabular-nums">
                                {new Date(reg.createdAt).toLocaleString(
                                  lang === 'ar' ? 'ar-EG' : 'en-US',
                                  { dateStyle: 'medium', timeStyle: 'short' }
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {totalRegsPages > 1 && (
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="font-bold text-[#4E6359] tabular-nums">
                        {lang === 'ar'
                          ? `صفحة ${regsPage} من ${totalRegsPages}`
                          : `Page ${regsPage} of ${totalRegsPages}`}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={regsPage <= 1}
                          onClick={() => setRegsPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 bg-white font-bold disabled:opacity-45 cursor-pointer"
                        >
                          {lang === 'ar' ? 'السابق' : 'Prev'}
                        </button>
                        <button
                          type="button"
                          disabled={regsPage >= totalRegsPages}
                          onClick={() => setRegsPage((p) => Math.min(totalRegsPages, p + 1))}
                          className="px-3 py-1.5 rounded-xl border border-[#0B3D2E]/15 bg-white font-bold disabled:opacity-45 cursor-pointer"
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

          {/* -------------------------------------------------------
              SECTION 7: LOKMA BOX MARKET RESEARCH (/admin/lokma-box)
             ------------------------------------------------------- */}
          {activeSection === 'lokma-box' && (
            <AdminLokmaBoxView
              leads={lokmaBoxLeads}
              surveys={lokmaBoxSurveys}
              lang={lang}
              loading={adminSyncLoading}
              error={lokmaBoxSyncError}
              onRetry={retryAdminSync}
            />
          )}
        </section>
      </div>

      {/* Confirm Suspend Partner */}
      <ConfirmDialog
        isOpen={Boolean(suspendTarget)}
        lang={lang}
        tone="danger"
        busy={suspendingPartner}
        title={
          lang === 'ar'
            ? `تأكيد إيقاف ${suspendTarget?.kind === 'provider' ? 'مقدم الطعام' : 'مندوب التوصيل'}: ${
                suspendTarget?.name || ''
              }`
            : `Suspend ${suspendTarget?.kind === 'provider' ? 'Provider' : 'Delivery Partner'}: ${
                suspendTarget?.name || ''
              }`
        }
        description={
          lang === 'ar'
            ? 'لن يتمكن هذا الحساب من استقبال طلبات أو عروض جديدة أثناء الإيقاف. يمكنك إعادة تفعيله لاحقاً.'
            : 'This account will not be able to accept new orders or deliveries while suspended. You can re-verify them later.'
        }
        confirmLabel={lang === 'ar' ? 'تأكيد الإيقاف' : 'Confirm Suspend'}
        cancelLabel={lang === 'ar' ? 'تراجع' : 'Cancel'}
        onCancel={() => setSuspendTarget(null)}
        onConfirm={async () => {
          if (!suspendTarget) return;
          setSuspendingPartner(true);
          try {
            if (suspendTarget.kind === 'provider') {
              await setProviderVerification(suspendTarget.userId, 'suspended');
            } else {
              await setDeliveryPartnerVerification(suspendTarget.userId, 'suspended');
            }
            setSuspendTarget(null);
          } finally {
            setSuspendingPartner(false);
          }
        }}
      />

      {/* Confirm Delete Event */}
      <ConfirmDialog
        isOpen={Boolean(deleteEventTarget)}
        lang={lang}
        tone="danger"
        busy={deletingEvent}
        title={
          lang === 'ar'
            ? `حذف فعالية "${deleteEventTarget?.title || ''}"`
            : `Delete Event "${deleteEventTarget?.title || ''}"`
        }
        description={
          lang === 'ar'
            ? 'هل أنت متأكد من حذف هذه الفعالية نهائياً من النظام؟'
            : 'Are you sure you want to permanently delete this event?'
        }
        confirmLabel={lang === 'ar' ? 'حذف الفعالية' : 'Delete Event'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        onCancel={() => setDeleteEventTarget(null)}
        onConfirm={async () => {
          if (!deleteEventTarget) return;
          setDeletingEvent(true);
          try {
            await handleDeleteEvent(deleteEventTarget.id);
            setDeleteEventTarget(null);
          } finally {
            setDeletingEvent(false);
          }
        }}
      />
    </div>
  );
};
