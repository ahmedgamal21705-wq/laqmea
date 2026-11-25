import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  LogIn,
  MapPin,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { useLokma } from '../context/LokmaContext';

interface ApiEvent {
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
}

interface ApiRegistration {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string;
  eventTitle: string;
  eventDescription: string | null;
  eventCategory: 'workshop' | 'course' | 'event';
  eventStartsAt: string;
  eventLocation: string | null;
  eventOrganizer: string | null;
  eventCoverImageUrl: string | null;
}

function isSafeImageUrl(url: string | null): url is string {
  if (!url) return false;
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('/');
}

export const EventsPortal: React.FC = () => {
  const { lang, setView, pushToast } = useLokma();
  const {
    firebaseUser,
    syncedUser,
    authLoading,
    returnTarget,
    setReturnTarget,
    getIdToken,
  } = useFirebaseAuth();

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [registrations, setRegistrations] = useState<ApiRegistration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  const [activeCategory, setActiveCategory] = useState<'all' | 'workshop' | 'course' | 'event'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [submittingEventId, setSubmittingEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [focusedEvent, setFocusedEvent] = useState<ApiEvent | null>(null);

  const fetchPublishedEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تحميل الفعاليات');
      }
      const list: ApiEvent[] = Array.isArray(data.events) ? data.events : [];
      setEvents(list);

      // If user returned from /login after clicking a specific event, re-open that event!
      const urlEventId = new URLSearchParams(window.location.search).get('event');
      const targetId = returnTarget.eventId || urlEventId;
      if (targetId) {
        const matched = list.find((item) => item.id === targetId);
        if (matched) {
          setFocusedEvent(matched);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل الفعاليات';
      setEventsError(msg);
    } finally {
      setLoadingEvents(false);
    }
  }, [returnTarget.eventId]);

  const fetchMyRegistrations = useCallback(async () => {
    if (!firebaseUser) {
      setRegistrations([]);
      return;
    }
    setLoadingRegs(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/registrations/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.registrations)) {
        setRegistrations(data.registrations);
      }
    } catch {
      // handled gracefully without crashing UI
    } finally {
      setLoadingRegs(false);
    }
  }, [firebaseUser, getIdToken]);

  useEffect(() => {
    fetchPublishedEvents();
  }, [fetchPublishedEvents]);

  useEffect(() => {
    fetchMyRegistrations();
  }, [fetchMyRegistrations]);

  const redirectToLoginForEvent = (eventId: string | null = null) => {
    setReturnTarget({ view: 'events', eventId });
    const loginPath = eventId ? `/login?event=${encodeURIComponent(eventId)}` : '/login';
    window.history.pushState({}, '', loginPath);
    setView('auth');
  };

  const registeredEventIds = useMemo(
    () => new Set(registrations.map((r) => r.eventId)),
    [registrations]
  );

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (activeCategory !== 'all' && ev.category !== activeCategory) return false;
      if (q) {
        const hay = `${ev.title} ${ev.description || ''} ${ev.location || ''} ${
          ev.organizer || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, activeCategory, searchQuery]);

  const handleRegister = async (eventId: string) => {
    if (!firebaseUser) {
      redirectToLoginForEvent(eventId);
      return;
    }

    setSubmittingEventId(eventId);
    try {
      const token = await getIdToken();
      if (!token) {
        redirectToLoginForEvent(eventId);
        return;
      }

      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLoginForEvent(eventId);
          return;
        }
        if (res.status === 409) {
          pushToast(
            lang === 'ar' ? 'أنت مسجل بالفعل في هذه الفعالية' : 'Already registered for this event',
            'info'
          );
          await fetchMyRegistrations();
          return;
        }
        throw new Error(data.error || 'تعذر إتمام التسجيل');
      }

      pushToast(
        lang === 'ar' ? 'تم تسجيلك في الفعالية بنجاح!' : 'Registered for the event successfully!',
        'success'
      );
      await fetchMyRegistrations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام التسجيل';
      pushToast(msg, 'error');
    } finally {
      setSubmittingEventId(null);
    }
  };

  const categoryLabel = (cat: ApiEvent['category']) => {
    const map: Record<ApiEvent['category'], { ar: string; en: string; cls: string }> = {
      workshop: { ar: 'ورشة عمل', en: 'Workshop', cls: 'text-[#9A6300] border-[#F7931E]' },
      course: { ar: 'دورة تدريبية', en: 'Course', cls: 'text-[#0B3D2E] border-[#0B3D2E]' },
      event: { ar: 'فعالية مجتمعية', en: 'Community Event', cls: 'text-[#B44628] border-[#E97858]' },
    };
    return {
      text: lang === 'ar' ? map[cat].ar : map[cat].en,
      cls: map[cat].cls,
    };
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F7931E]">
            <Sparkles className="w-4 h-4" />
            <span>
              {lang === 'ar'
                ? 'مجتمع لقمة — جامعة الفيوم'
                : 'LOKMA Community — Fayoum University'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            {lang === 'ar'
              ? 'الفعاليات، الورش، والدورات التدريبية'
              : 'Events, Workshops & Training Courses'}
          </h1>
          <p className="text-xs sm:text-sm text-[#FFF7E6]/80 max-w-2xl">
            {lang === 'ar'
              ? 'اكتشف أحدث الورش الطلابية ودورات سلامة الغذاء وتجمعات الأكل البيتي في الفيوم وسجّل حضورك مباشرة.'
              : 'Explore student nutrition workshops, kitchen food-safety courses, and community events in Fayoum.'}
          </p>
        </div>

        <div className="bg-white/10 border border-white/15 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          {authLoading ? (
            <span className="text-xs font-semibold text-[#FFF7E6]/80">
              {lang === 'ar' ? 'جاري التحقق من الجلسة...' : 'Checking session...'}
            </span>
          ) : firebaseUser ? (
            <div className="text-xs">
              <div className="font-extrabold text-[#F7931E] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                <span>{syncedUser?.name || firebaseUser.displayName || firebaseUser.email}</span>
              </div>
              <div className="text-[#FFF7E6]/75 mt-0.5">{firebaseUser.email}</div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-xs text-[#FFF7E6]/85">
                {lang === 'ar'
                  ? 'سجّل الدخول بحساب جوجل لتأكيد حضورك'
                  : 'Sign in with Google to confirm attendance'}
              </span>
              <button
                type="button"
                onClick={() => redirectToLoginForEvent(null)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F7931E] text-[#13221C] text-xs font-extrabold hover:bg-[#E08112] cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs & Filters */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              viewMode === 'all'
                ? 'bg-[#0B3D2E] text-white'
                : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
            }`}
          >
            {lang === 'ar' ? `الفعاليات المتاحة (${events.length})` : `Published Events (${events.length})`}
          </button>

          {firebaseUser && (
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                viewMode === 'mine'
                  ? 'bg-[#0B3D2E] text-white'
                  : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
              }`}
            >
              {lang === 'ar'
                ? `تسجيلاتي (${registrations.length})`
                : `My Registrations (${registrations.length})`}
            </button>
          )}
        </div>

        {viewMode === 'all' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-60">
              <Search
                className={`w-4 h-4 text-[#4E6359] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                  lang === 'ar' ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث عن فعالية أو ورشة...' : 'Search events...'}
                className={`py-2.5 min-h-[42px] rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E]/35 ${
                  lang === 'ar' ? 'pr-10 pl-3' : 'pl-10 pr-3'
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All' },
                  { id: 'workshop', ar: 'ورش عمل', en: 'Workshops' },
                  { id: 'course', ar: 'دورات', en: 'Courses' },
                  { id: 'event', ar: 'فعاليات', en: 'Events' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-[#0B3D2E] text-white'
                      : 'bg-[#FFF7E6] text-[#13221C] hover:bg-[#F7931E]/20'
                  }`}
                >
                  {lang === 'ar' ? cat.ar : cat.en}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: PUBLISHED EVENTS LIST */}
      {viewMode === 'all' && (
        <>
          {loadingEvents ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-12 text-center text-sm font-bold text-[#4E6359]">
              {lang === 'ar' ? 'جاري تحميل الفعاليات...' : 'Loading events...'}
            </div>
          ) : eventsError ? (
            <div className="bg-white rounded-3xl border border-[#E97858]/30 p-8 text-center space-y-3">
              <p className="text-sm font-bold text-[#9E3F24]">{eventsError}</p>
              <button
                type="button"
                onClick={fetchPublishedEvents}
                className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-12 text-center text-sm font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'لا توجد فعاليات منشورة مطابقة للبحث حالياً'
                : 'No published events match your filter'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((ev) => {
                const badge = categoryLabel(ev.category);
                const isRegistered = registeredEventIds.has(ev.id);
                const isSubmitting = submittingEventId === ev.id;

                return (
                  <article
                    key={ev.id}
                    className="bg-white rounded-3xl border border-[#0B3D2E]/12 overflow-hidden flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      {isSafeImageUrl(ev.coverImageUrl) ? (
                        <img
                          src={ev.coverImageUrl}
                          alt={ev.title}
                          className="w-full h-40 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-3 bg-[#0B3D2E]" />
                      )}

                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`ps-2 border-s-2 text-[11px] font-extrabold ${badge.cls}`}>
                            {badge.text}
                          </span>
                          {isRegistered && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#0B3D2E]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'مسجل' : 'Registered'}</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setFocusedEvent(ev)}
                          className="text-start cursor-pointer block w-full"
                        >
                          <h2 className="text-lg font-extrabold text-[#13221C] hover:text-[#0B3D2E] leading-snug">
                            {ev.title}
                          </h2>
                        </button>

                        {ev.description && (
                          <p className="text-xs text-[#4E6359] leading-relaxed">{ev.description}</p>
                        )}

                        <div className="space-y-1.5 pt-2 text-xs text-[#13221C]/85">
                          <div className="flex items-center gap-2 tabular-nums">
                            <Calendar className="w-3.5 h-3.5 text-[#0B3D2E] shrink-0" />
                            <span>{formatDate(ev.startsAt)}</span>
                          </div>
                          {ev.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-[#E97858] shrink-0" />
                              <span>{ev.location}</span>
                            </div>
                          )}
                          {ev.organizer && (
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-[#4E6359] shrink-0" />
                              <span>{ev.organizer}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-3.5 bg-[#FFF7E6]/60 border-t border-[#0B3D2E]/10">
                      {isRegistered ? (
                        <div className="w-full py-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-[#0B3D2E]/10 text-[#0B3D2E] text-xs font-extrabold text-center">
                          {lang === 'ar' ? 'تم تسجيل حضورك بنجاح ✓' : 'You are registered ✓'}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleRegister(ev.id)}
                          className="w-full py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {isSubmitting
                            ? lang === 'ar'
                              ? 'جاري التسجيل...'
                              : 'Registering...'
                            : firebaseUser
                            ? lang === 'ar'
                              ? 'تسجيل الحضور الآن'
                              : 'Register Now'
                            : lang === 'ar'
                            ? 'سجّل الدخول للحضور'
                            : 'Sign In to Register'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: USER'S OWN REGISTRATIONS (READ-ONLY) */}
      {viewMode === 'mine' && (
        <div className="space-y-4">
          {loadingRegs ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center text-sm text-[#4E6359]">
              {lang === 'ar' ? 'جاري تحميل تسجيلاتك...' : 'Loading your registrations...'}
            </div>
          ) : registrations.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
              <p className="font-bold text-[#13221C]">
                {lang === 'ar'
                  ? 'لم تقم بالتسجيل في أي فعالية بعد'
                  : 'You have not registered for any events yet'}
              </p>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'استعرض الفعاليات المتاحة' : 'Browse Published Events'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registrations.map((reg) => {
                const badge = categoryLabel(reg.eventCategory);
                return (
                  <div
                    key={reg.id}
                    className="bg-white rounded-3xl border border-[#0B3D2E]/15 p-5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`ps-2 border-s-2 text-[11px] font-extrabold ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className="text-[11px] font-bold text-[#0B3D2E] tabular-nums">
                        {lang === 'ar' ? 'تاريخ التسجيل:' : 'Registered:'}{' '}
                        {formatDate(reg.createdAt)}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-[#13221C]">{reg.eventTitle}</h3>
                    <div className="text-xs text-[#4E6359] space-y-1">
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#0B3D2E]" />
                        <span>{formatDate(reg.eventStartsAt)}</span>
                      </div>
                      {reg.eventLocation && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#E97858]" />
                          <span>{reg.eventLocation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FOCUSED EVENT DETAIL MODAL (supports returning directly to the event after /login) */}
      {focusedEvent && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-4 shadow-2xl border border-[#0B3D2E]/15">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`ps-2.5 border-s-2 text-xs font-extrabold ${
                  categoryLabel(focusedEvent.category).cls
                }`}
              >
                {categoryLabel(focusedEvent.category).text}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFocusedEvent(null);
                  setReturnTarget({ view: 'events', eventId: null });
                  window.history.replaceState({}, '', '/events');
                }}
                className="w-10 h-10 rounded-full bg-[#FFF7E6] hover:bg-[#F7931E]/25 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-[#13221C]" />
              </button>
            </div>

            <h2 className="text-xl font-extrabold text-[#0B3D2E] leading-snug">
              {focusedEvent.title}
            </h2>

            {focusedEvent.description && (
              <p className="text-sm text-[#13221C]/85 leading-relaxed">
                {focusedEvent.description}
              </p>
            )}

            <div className="space-y-2 p-4 rounded-2xl bg-[#FFF7E6] text-xs text-[#13221C]">
              <div className="flex items-center gap-2 tabular-nums">
                <Calendar className="w-4 h-4 text-[#0B3D2E] shrink-0" />
                <span>{formatDate(focusedEvent.startsAt)}</span>
              </div>
              {focusedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E97858] shrink-0" />
                  <span>{focusedEvent.location}</span>
                </div>
              )}
              {focusedEvent.organizer && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4E6359] shrink-0" />
                  <span>{focusedEvent.organizer}</span>
                </div>
              )}
            </div>

            {registeredEventIds.has(focusedEvent.id) ? (
              <div className="w-full py-3 min-h-[44px] flex items-center justify-center rounded-xl bg-[#0B3D2E]/12 text-[#0B3D2E] text-xs font-extrabold text-center">
                {lang === 'ar' ? 'تم تسجيل حضورك بنجاح ✓' : 'You are registered ✓'}
              </div>
            ) : (
              <button
                type="button"
                disabled={submittingEventId === focusedEvent.id}
                onClick={() => handleRegister(focusedEvent.id)}
                className="w-full py-3 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] disabled:opacity-50 cursor-pointer"
              >
                {submittingEventId === focusedEvent.id
                  ? lang === 'ar'
                    ? 'جاري التسجيل...'
                    : 'Registering...'
                  : firebaseUser
                  ? lang === 'ar'
                    ? 'تأكيد تسجيل الحضور'
                    : 'Confirm Registration'
                  : lang === 'ar'
                  ? 'الدخول بحساب جوجل للتسجيل'
                  : 'Sign in with Google to Register'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
