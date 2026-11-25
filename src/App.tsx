/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AdminNavigationTarget,
  AdminPortal,
  AdminSection,
} from './components/AdminPortal';
import { AdminMealMode } from './components/admin/AdminMealsManager';
import { AuthView } from './components/AuthView';
import { DeliveryPartnerPortal } from './components/DeliveryPartnerPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EventsPortal } from './components/EventsPortal';
import { LandingView } from './components/LandingView';
import { LokmaLogo } from './components/LokmaLogo';
import { Navbar } from './components/Navbar';
import { OnboardingView } from './components/OnboardingView';
import { ProviderPortal } from './components/ProviderPortal';
import { StudentLaunchOptions, StudentPortal, StudentTab } from './components/StudentPortal';
import { FirebaseAuthProvider, useFirebaseAuth } from './context/FirebaseAuthContext';
import { AppView, LokmaProvider, useLokma } from './context/LokmaContext';

interface ResolvedAdminRoute {
  section: AdminSection;
  orderId: string | null;
  mealMode: AdminMealMode;
  mealId: string | null;
}

function resolveAdminRoute(path: string): ResolvedAdminRoute {
  if (path === '/admin/lokma-box' || path === '/admin/market-research') {
    return { section: 'lokma-box', orderId: null, mealMode: 'list', mealId: null };
  }
  if (path === '/admin/events') {
    return { section: 'events', orderId: null, mealMode: 'list', mealId: null };
  }
  if (path === '/admin/registrations') {
    return { section: 'registrations', orderId: null, mealMode: 'list', mealId: null };
  }
  if (path === '/admin/users') {
    return { section: 'users', orderId: null, mealMode: 'list', mealId: null };
  }
  if (path === '/admin/operations') {
    return { section: 'operations', orderId: null, mealMode: 'list', mealId: null };
  }
  if (path === '/admin/orders') {
    return { section: 'orders', orderId: null, mealMode: 'list', mealId: null };
  }
  if (path.startsWith('/admin/orders/')) {
    const orderId = decodeURIComponent(path.slice('/admin/orders/'.length)).split('/')[0] || null;
    return { section: 'orders', orderId, mealMode: 'list', mealId: null };
  }
  if (path === '/admin/meals/new') {
    return { section: 'meals', orderId: null, mealMode: 'new', mealId: null };
  }
  const editMatch = path.match(/^\/admin\/meals\/([^/]+)\/edit$/);
  if (editMatch) {
    return {
      section: 'meals',
      orderId: null,
      mealMode: 'edit',
      mealId: decodeURIComponent(editMatch[1]),
    };
  }
  if (path === '/admin/meals') {
    return { section: 'meals', orderId: null, mealMode: 'list', mealId: null };
  }
  return { section: 'dashboard', orderId: null, mealMode: 'list', mealId: null };
}

function resolveRouteFromLocation(): {
  view: AppView;
  eventId: string | null;
  redirectView: Exclude<AppView, 'auth'> | null;
  studentTab: StudentTab | null;
  adminRoute: ResolvedAdminRoute;
} {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event');
  const redirectParam = params.get('redirect');
  const tabParam = params.get('tab');

  const studentTab: StudentTab | null =
    tabParam === 'discover' ||
    tabParam === 'cart' ||
    tabParam === 'orders' ||
    tabParam === 'profile'
      ? tabParam
      : null;

  let redirectView: Exclude<AppView, 'auth'> | null = null;
  if (redirectParam) {
    const cleanRedirect = redirectParam.split('?')[0].replace(/^\/+|\/+$/g, '');
    if (cleanRedirect === 'admin' || cleanRedirect.startsWith('admin/')) {
      redirectView = 'admin';
    } else if (
      cleanRedirect === 'events' ||
      cleanRedirect === 'student' ||
      cleanRedirect === 'provider' ||
      cleanRedirect === 'delivery' ||
      cleanRedirect === 'onboarding'
    ) {
      redirectView = cleanRedirect;
    } else if (cleanRedirect === '') {
      redirectView = 'landing';
    }
  }

  const defaultAdminRoute: ResolvedAdminRoute = {
    section: 'dashboard',
    orderId: null,
    mealMode: 'list',
    mealId: null,
  };

  if (path === '/admin' || path.startsWith('/admin/')) {
    return {
      view: 'admin',
      eventId: null,
      redirectView: null,
      studentTab: null,
      adminRoute: resolveAdminRoute(path),
    };
  }

  switch (path) {
    case '/login':
      return { view: 'auth', eventId, redirectView, studentTab: null, adminRoute: defaultAdminRoute };
    case '/events':
      return { view: 'events', eventId, redirectView: null, studentTab: null, adminRoute: defaultAdminRoute };
    case '/student':
      return { view: 'student', eventId: null, redirectView: null, studentTab, adminRoute: defaultAdminRoute };
    case '/provider':
      return { view: 'provider', eventId: null, redirectView: null, studentTab: null, adminRoute: defaultAdminRoute };
    case '/delivery':
      return { view: 'delivery', eventId: null, redirectView: null, studentTab: null, adminRoute: defaultAdminRoute };
    case '/onboarding':
      return { view: 'onboarding', eventId: null, redirectView: null, studentTab: null, adminRoute: defaultAdminRoute };
    default:
      return { view: 'landing', eventId: null, redirectView: null, studentTab: null, adminRoute: defaultAdminRoute };
  }
}

const MainShell: React.FC = () => {
  const { view, setView, lang, toasts } = useLokma();
  const { setReturnTarget, isAdmin, firestoreConfigError } = useFirebaseAuth();
  const [openCartSignal, setOpenCartSignal] = useState(0);
  const [studentTargetTab, setStudentTargetTab] = useState<StudentTab>('discover');
  const [studentLaunchMealId, setStudentLaunchMealId] = useState<string | null>(null);
  const [studentLaunchCategoryId, setStudentLaunchCategoryId] = useState<string | null>(null);
  const [studentLaunchMaxPrice, setStudentLaunchMaxPrice] = useState<number | null>(null);
  const [studentTabSignal, setStudentTabSignal] = useState(0);
  const [adminRoute, setAdminRoute] = useState<ResolvedAdminRoute>({
    section: 'dashboard',
    orderId: null,
    mealMode: 'list',
    mealId: null,
  });

  const syncFromLocation = useCallback(() => {
    const resolved = resolveRouteFromLocation();
    if (resolved.view === 'auth') {
      setReturnTarget({
        view: resolved.redirectView ?? (resolved.eventId ? 'events' : 'student'),
        eventId: resolved.eventId,
      });
    } else if (resolved.view === 'events' && resolved.eventId) {
      setReturnTarget({ view: 'events', eventId: resolved.eventId });
    } else if (resolved.view === 'student' && resolved.studentTab) {
      setStudentTargetTab(resolved.studentTab);
      setStudentLaunchMealId(null);
      setStudentLaunchCategoryId(null);
      setStudentLaunchMaxPrice(null);
      setStudentTabSignal((n) => n + 1);
    } else if (resolved.view === 'admin') {
      setAdminRoute(resolved.adminRoute);
    }
    setView(resolved.view);
  }, [setReturnTarget, setView]);

  useEffect(() => {
    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, [syncFromLocation]);

  const navigateView = (target: Exclude<AppView, 'auth'>) => {
    const url = target === 'landing' ? '/' : `/${target}`;
    window.history.pushState({}, '', url);
    setView(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenStudentTab = (target: StudentTab | StudentLaunchOptions) => {
    const opts: StudentLaunchOptions =
      typeof target === 'string' ? { tab: target } : target;
    setStudentTargetTab(opts.tab);
    setStudentLaunchMealId(opts.mealId ?? null);
    setStudentLaunchCategoryId(opts.categoryId ?? null);
    setStudentLaunchMaxPrice(opts.maxPrice ?? null);
    setStudentTabSignal((n) => n + 1);
    const url = opts.tab === 'discover' ? '/student' : `/student?tab=${opts.tab}`;
    window.history.pushState({}, '', url);
    setView('student');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCart = () => {
    setOpenCartSignal((n) => n + 1);
    navigateView('student');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8EC] text-[#29332E]">
      <Navbar onOpenCart={handleOpenCart} />

      {firestoreConfigError && (
        <div className="bg-[#E97858]/15 border-b border-[#E97858]/30 px-4 py-3 text-xs font-bold text-[#9E3F24]">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{firestoreConfigError}</span>
          </div>
        </div>
      )}

      <main className="flex-1">
        {view === 'landing' && <LandingView onOpenStudentTab={handleOpenStudentTab} />}
        {view === 'onboarding' && <OnboardingView />}
        {view === 'auth' && <AuthView />}
        {view === 'student' && (
          <StudentPortal
            initialTab={studentTargetTab}
            openTabSignal={studentTabSignal}
            openCartSignal={openCartSignal}
            launchMealId={studentLaunchMealId}
            launchCategoryId={studentLaunchCategoryId}
            launchMaxPrice={studentLaunchMaxPrice}
          />
        )}
        {view === 'provider' && <ProviderPortal />}
        {view === 'delivery' && <DeliveryPartnerPortal />}
        {view === 'events' && <EventsPortal />}
        {view === 'admin' && (
          <AdminPortal
            activeSection={adminRoute.section}
            selectedOrderId={adminRoute.orderId}
            mealMode={adminRoute.mealMode}
            editingMealId={adminRoute.mealId}
            onNavigate={(target: AdminNavigationTarget) => {
              const nextRoute: ResolvedAdminRoute = {
                section: target.section,
                orderId: target.orderId ?? null,
                mealMode: target.mealMode ?? 'list',
                mealId: target.mealId ?? null,
              };
              setAdminRoute(nextRoute);
              let nextUrl = '/admin';
              if (nextRoute.section === 'orders') {
                nextUrl = nextRoute.orderId
                  ? `/admin/orders/${encodeURIComponent(nextRoute.orderId)}`
                  : '/admin/orders';
              } else if (nextRoute.section === 'meals') {
                if (nextRoute.mealMode === 'new') nextUrl = '/admin/meals/new';
                else if (nextRoute.mealMode === 'edit' && nextRoute.mealId) {
                  nextUrl = `/admin/meals/${encodeURIComponent(nextRoute.mealId)}/edit`;
                } else {
                  nextUrl = '/admin/meals';
                }
              } else if (nextRoute.section !== 'dashboard') {
                nextUrl = `/admin/${nextRoute.section}`;
              }
              window.history.pushState({}, '', nextUrl);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      <footer className="border-t border-[#245B45]/12 bg-white/75 mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <LokmaLogo variant="primary" size="sm" />
            <p className="text-xs sm:text-sm text-[#5C6861]">
              {lang === 'ar'
                ? 'طعم البيت.. على قد جيبك — رفيق الطالب الجامعي للأكل البيتي والميزانية في الفيوم، مصر'
                : 'A Taste of Home, Within Your Budget. — Student FoodTech Companion in Fayoum, Egypt'}
            </p>
          </div>
          <nav
            aria-label={lang === 'ar' ? 'روابط التذييل' : 'Footer Navigation'}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-bold text-[#245B45]"
          >
            <button
              type="button"
              onClick={() => navigateView('landing')}
              className="py-1.5 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'الرئيسية' : 'Home'}
            </button>
            <button
              type="button"
              onClick={() => handleOpenStudentTab('discover')}
              className="py-1.5 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'اكتشف الوجبات' : 'Meals'}
            </button>
            <button
              type="button"
              onClick={() => handleOpenStudentTab('profile')}
              className="py-1.5 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'مخطط الميزانية' : 'Budget Planner'}
            </button>
            <button
              type="button"
              onClick={() => navigateView('provider')}
              className="py-1.5 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'المطبخ' : 'Provider'}
            </button>
            <button
              type="button"
              onClick={() => navigateView('delivery')}
              className="py-1.5 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'التوصيل الطلابي' : 'Delivery Partner'}
            </button>
            <button
              type="button"
              onClick={() => navigateView('events')}
              className="py-1.5 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'الفعاليات والورش' : 'Events'}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigateView('admin')}
                className="py-1.5 hover:underline cursor-pointer"
              >
                {lang === 'ar' ? 'الإدارة' : 'Admin'}
              </button>
            )}
          </nav>
        </div>
      </footer>

      {toasts.length > 0 && (
        <div
          className={`fixed bottom-5 ${
            lang === 'ar' ? 'left-4 sm:left-5' : 'right-4 sm:right-5'
          } z-50 flex flex-col gap-2 max-w-[min(20rem,calc(100vw-2rem))] w-full pointer-events-none`}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-2xl shadow-lg text-xs font-bold border pointer-events-auto ${
                t.tone === 'error'
                  ? 'bg-[#E97858] text-white border-[#9E3F24]'
                  : t.tone === 'info'
                  ? 'bg-[#29332E] text-[#FFF8EC] border-white/10'
                  : 'bg-[#245B45] text-[#FFF8EC] border-white/15'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseAuthProvider>
        <LokmaProvider>
          <MainShell />
        </LokmaProvider>
      </FirebaseAuthProvider>
    </ErrorBoundary>
  );
}
