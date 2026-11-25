import React, { useState } from 'react';
import { Bell, Globe, LogOut, Menu, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { AppView, useLokma } from '../context/LokmaContext';
import { LokmaLogo } from './LokmaLogo';

export const Navbar: React.FC<{ onOpenCart?: () => void }> = ({ onOpenCart }) => {
  const {
    notifications,
    lang,
    toggleLang,
    view,
    setView,
    cart,
    markNotificationRead,
    markAllNotificationsRead,
  } = useLokma();

  const {
    firebaseUser,
    userDoc,
    syncedUser,
    isAdmin,
    authLoading,
    signOutUser,
    setReturnTarget,
  } = useFirebaseAuth();

  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const navItems: Array<{ id: AppView; labelAr: string; labelEn: string }> = [
    { id: 'landing', labelAr: 'الرئيسية', labelEn: 'Home' },
    { id: 'student', labelAr: 'الطالب', labelEn: 'Student' },
    { id: 'provider', labelAr: 'المطبخ', labelEn: 'Provider' },
    { id: 'delivery', labelAr: 'التوصيل الطلابي', labelEn: 'Delivery' },
    { id: 'events', labelAr: 'الفعاليات والورش', labelEn: 'Events' },
    ...(isAdmin ? [{ id: 'admin' as AppView, labelAr: 'الإدارة', labelEn: 'Admin' }] : []),
  ];

  const handleNav = (target: AppView) => {
    setMobileOpen(false);
    const url =
      target === 'landing' ? '/' : target === 'auth' ? '/login' : `/${target}`;
    window.history.pushState({}, '', url);
    setView(target);
  };

  const handleOpenLogin = () => {
    setMobileOpen(false);
    const originView = view === 'auth' ? 'landing' : view;
    setReturnTarget({ view: originView, eventId: null });
    window.history.pushState({}, '', '/login');
    setView('auth');
  };

  const handleSignOut = async () => {
    setNotifOpen(false);
    setMobileOpen(false);
    await signOutUser();
  };

  const displayName =
    userDoc?.full_name ||
    syncedUser?.name ||
    firebaseUser?.displayName ||
    firebaseUser?.email ||
    '';

  return (
    <header className="sticky top-0 z-40 bg-[#FFF7E6]/95 backdrop-blur-md border-b border-[#0B3D2E]/12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        <button
          type="button"
          onClick={() => handleNav('landing')}
          className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] rounded-xl min-h-[44px] flex items-center shrink-0"
          aria-label="LOKMA Home"
        >
          <LokmaLogo variant="primary" size="sm" />
        </button>

        <nav
          aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main Navigation'}
          className="hidden lg:flex items-center gap-6 text-sm font-semibold text-[#13221C]/85"
        >
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors duration-150 cursor-pointer ${
                  active
                    ? 'border-[#F7931E] text-[#0B3D2E] font-extrabold'
                    : 'border-transparent hover:text-[#0B3D2E]'
                }`}
              >
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-bold text-[#0B3D2E] border border-[#0B3D2E]/20 bg-white/85 rounded-xl hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {firebaseUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative min-w-[40px] min-h-[40px] flex items-center justify-center text-[#0B3D2E] hover:bg-[#0B3D2E]/8 rounded-xl transition-colors cursor-pointer"
                aria-label={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#F7931E] text-[#0B3D2E] text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  className={`absolute top-12 ${
                    lang === 'ar' ? 'left-0' : 'right-0'
                  } w-[min(22rem,calc(100vw-2rem))] bg-white border border-[#0B3D2E]/15 rounded-2xl shadow-xl z-50 overflow-hidden`}
                >
                  <div className="px-4 py-3 bg-[#FFF7E6] border-b border-[#0B3D2E]/10 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0B3D2E]">
                      {lang === 'ar' ? 'الإشعارات' : 'Notifications'} ({unreadCount})
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllNotificationsRead()}
                        className="text-xs font-bold text-[#0B3D2E] hover:underline cursor-pointer"
                      >
                        {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#0B3D2E]/8">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#4E6359]">
                        {lang === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markNotificationRead(n.id)}
                          className={`w-full text-start px-4 py-3 hover:bg-[#FFF7E6]/60 transition-colors cursor-pointer ${
                            n.status === 'unread' ? 'bg-[#F7931E]/10' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#13221C]">{n.title}</span>
                            {n.status === 'unread' && (
                              <span className="text-[11px] font-bold text-[#C26906]">
                                {lang === 'ar' ? 'جديد' : 'New'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#4E6359] mt-1 leading-relaxed">{n.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {cartCount > 0 && onOpenCart && (
            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] bg-[#F7931E] text-[#0B3D2E] text-xs font-extrabold rounded-xl hover:bg-[#E08112] transition-colors tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={lang === 'ar' ? 'سلة الطلبات' : 'Shopping Cart'}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{cartCount}</span>
            </button>
          )}

          {!authLoading &&
            (firebaseUser ? (
              <div className="hidden sm:flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 min-h-[40px] bg-[#0B3D2E]/8 text-[#0B3D2E] text-xs font-bold rounded-xl whitespace-nowrap shrink-0">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span className="max-w-[120px] truncate">{displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[40px] border border-[#B43C25]/35 text-[#B43C25] hover:bg-[#B43C25]/8 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenLogin}
                className="px-4 min-h-[40px] bg-[#0B3D2E] text-[#FFF7E6] text-xs font-bold rounded-xl hover:bg-[#072B20] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            ))}

          <button
            type="button"
            onClick={() => setMobileOpen((p) => !p)}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-[#0B3D2E] hover:bg-[#0B3D2E]/10 rounded-xl cursor-pointer"
            aria-label={lang === 'ar' ? 'فتح القائمة' : 'Toggle menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[#0B3D2E]/12 bg-[#FFF7E6] px-4 py-4 space-y-3 shadow-md">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  view === item.id
                    ? 'bg-[#0B3D2E] text-[#FFF7E6]'
                    : 'bg-white text-[#13221C] border border-[#0B3D2E]/15'
                }`}
              >
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </button>
            ))}
          </div>

          {!authLoading && firebaseUser && (
            <div className="pt-3 border-t border-[#0B3D2E]/10 flex items-center justify-between gap-2 sm:hidden">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0B3D2E] truncate">
                <UserIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{displayName}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 min-h-[40px] border border-[#B43C25]/35 text-[#B43C25] bg-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'خروج' : 'Sign Out'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
