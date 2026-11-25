import { and, asc, desc, eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db, isSqlConfigured } from './index.ts';
import { type DbEvent, type DbRegistration, events, registrations, users } from './schema.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EventCategory = 'workshop' | 'course' | 'event';
export type EventStatus = 'draft' | 'published' | 'hidden';

export interface AdminEventInput {
  title: string;
  description?: string | null;
  category: EventCategory;
  startsAt: Date;
  location?: string | null;
  organizer?: string | null;
  coverImageUrl?: string | null;
  status?: EventStatus;
}

const mockEvents: DbEvent[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'ورشة التغذية الاقتصادية للطلاب — جامعة الفيوم',
    description: 'كيف تخطط وجباتك الأسبوعية بميزانية طلابية متوازنة مع أكلات بيتي صحية.',
    category: 'workshop',
    startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    location: 'قاعة المؤتمرات — جامعة الفيوم',
    organizer: 'فريق لقمة المجتمعي',
    coverImageUrl: null,
    status: 'published',
    createdAt: new Date(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'دورة سلامة الغذاء والتغليف للمطابخ المنزلية',
    description: 'معايير النظافة والحفظ والتغليف الآمن لمقدمي الطعام البيتي في الفيوم.',
    category: 'course',
    startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: 'مركز ريادة الأعمال — الفيوم الجديدة',
    organizer: 'أكاديمية لقمة للجودة',
    coverImageUrl: null,
    status: 'published',
    createdAt: new Date(),
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'تجمع لقمة للتذوق والتعارف الطلابي',
    description: 'لقاء مفتوح لتجربة أشهر الأطباق البيتية والتعرف على شركاء التوصيل والطلاب.',
    category: 'event',
    startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    location: 'الساحة الرئيسية — الحرم الجامعي بالفيوم',
    organizer: 'مجتمع لقمة',
    coverImageUrl: null,
    status: 'published',
    createdAt: new Date(),
  },
];

const mockRegistrations: DbRegistration[] = [];

export async function getPublishedEvents(category?: string) {
  if (!isSqlConfigured) {
    const filtered =
      category && (category === 'workshop' || category === 'course' || category === 'event')
        ? mockEvents.filter((e) => e.status === 'published' && e.category === category)
        : mockEvents.filter((e) => e.status === 'published');
    return [...filtered].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  try {
    if (category && (category === 'workshop' || category === 'course' || category === 'event')) {
      return await db
        .select()
        .from(events)
        .where(and(eq(events.status, 'published'), eq(events.category, category)))
        .orderBy(asc(events.startsAt));
    }

    return await db
      .select()
      .from(events)
      .where(eq(events.status, 'published'))
      .orderBy(asc(events.startsAt));
  } catch (error) {
    console.error('Database query failed in getPublishedEvents:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserRegistrations(userId: string) {
  if (!isSqlConfigured) {
    return mockRegistrations
      .filter((r) => r.userId === userId)
      .map((r) => {
        const ev = mockEvents.find((e) => e.id === r.eventId && e.status === 'published');
        if (!ev) return null;
        return {
          id: r.id,
          userId: r.userId,
          eventId: r.eventId,
          createdAt: r.createdAt,
          eventTitle: ev.title,
          eventDescription: ev.description,
          eventCategory: ev.category,
          eventStartsAt: ev.startsAt,
          eventLocation: ev.location,
          eventOrganizer: ev.organizer,
          eventCoverImageUrl: ev.coverImageUrl,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  try {
    return await db
      .select({
        id: registrations.id,
        userId: registrations.userId,
        eventId: registrations.eventId,
        createdAt: registrations.createdAt,
        eventTitle: events.title,
        eventDescription: events.description,
        eventCategory: events.category,
        eventStartsAt: events.startsAt,
        eventLocation: events.location,
        eventOrganizer: events.organizer,
        eventCoverImageUrl: events.coverImageUrl,
      })
      .from(registrations)
      .innerJoin(events, eq(registrations.eventId, events.id))
      .where(and(eq(registrations.userId, userId), eq(events.status, 'published')))
      .orderBy(desc(registrations.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserRegistrations:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export type CreateRegistrationResult =
  | { status: 'created'; registration: typeof registrations.$inferSelect }
  | { status: 'not_found' }
  | { status: 'duplicate' }
  | { status: 'invalid_event_id' };

export async function createUserRegistration(
  userId: string,
  eventId: string
): Promise<CreateRegistrationResult> {
  if (!UUID_REGEX.test(eventId)) {
    return { status: 'invalid_event_id' };
  }

  if (!isSqlConfigured) {
    const foundEvent = mockEvents.find((e) => e.id === eventId && e.status === 'published');
    if (!foundEvent) {
      return { status: 'not_found' };
    }
    const existing = mockRegistrations.find(
      (r) => r.userId === userId && r.eventId === eventId
    );
    if (existing) {
      return { status: 'duplicate' };
    }
    const created: DbRegistration = {
      id: crypto.randomUUID(),
      userId,
      eventId,
      createdAt: new Date(),
    };
    mockRegistrations.push(created);
    return { status: 'created', registration: created };
  }

  try {
    const foundEvent = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, 'published')))
      .limit(1);

    if (foundEvent.length === 0) {
      return { status: 'not_found' };
    }

    const inserted = await db
      .insert(registrations)
      .values({
        userId,
        eventId,
      })
      .onConflictDoNothing({
        target: [registrations.userId, registrations.eventId],
      })
      .returning();

    if (inserted.length === 0) {
      return { status: 'duplicate' };
    }

    return { status: 'created', registration: inserted[0] };
  } catch (error) {
    console.error('Database query failed in createUserRegistration:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createEventAdmin(input: AdminEventInput): Promise<DbEvent> {
  if (!isSqlConfigured) {
    const created: DbEvent = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      startsAt: input.startsAt,
      location: input.location ?? null,
      organizer: input.organizer ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      status: input.status ?? 'draft',
      createdAt: new Date(),
    };
    mockEvents.push(created);
    return created;
  }

  try {
    const inserted = await db
      .insert(events)
      .values({
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        startsAt: input.startsAt,
        location: input.location ?? null,
        organizer: input.organizer ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        status: input.status ?? 'draft',
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createEventAdmin:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateEventAdmin(
  eventId: string,
  input: Partial<AdminEventInput>
): Promise<{ status: 'invalid_id' | 'not_found' | 'updated'; event?: DbEvent }> {
  if (!UUID_REGEX.test(eventId)) {
    return { status: 'invalid_id' };
  }

  if (!isSqlConfigured) {
    const idx = mockEvents.findIndex((e) => e.id === eventId);
    if (idx === -1) return { status: 'not_found' };
    const updated: DbEvent = {
      ...mockEvents[idx],
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.organizer !== undefined ? { organizer: input.organizer } : {}),
      ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    mockEvents[idx] = updated;
    return { status: 'updated', event: updated };
  }

  try {
    const updates: Partial<typeof events.$inferInsert> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.category !== undefined) updates.category = input.category;
    if (input.startsAt !== undefined) updates.startsAt = input.startsAt;
    if (input.location !== undefined) updates.location = input.location;
    if (input.organizer !== undefined) updates.organizer = input.organizer;
    if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl;
    if (input.status !== undefined) updates.status = input.status;

    const updated = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, eventId))
      .returning();

    if (updated.length === 0) {
      return { status: 'not_found' };
    }
    return { status: 'updated', event: updated[0] };
  } catch (error) {
    console.error('Database query failed in updateEventAdmin:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteEventAdmin(
  eventId: string
): Promise<{ status: 'invalid_id' | 'not_found' | 'deleted' }> {
  if (!UUID_REGEX.test(eventId)) {
    return { status: 'invalid_id' };
  }

  if (!isSqlConfigured) {
    const idx = mockEvents.findIndex((e) => e.id === eventId);
    if (idx === -1) return { status: 'not_found' };
    mockEvents.splice(idx, 1);
    return { status: 'deleted' };
  }

  try {
    const deleted = await db
      .delete(events)
      .where(eq(events.id, eventId))
      .returning({ id: events.id });

    if (deleted.length === 0) {
      return { status: 'not_found' };
    }
    return { status: 'deleted' };
  } catch (error) {
    console.error('Database query failed in deleteEventAdmin:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getAllRegistrationsAdmin() {
  if (!isSqlConfigured) {
    return mockRegistrations
      .map((r) => {
        const ev = mockEvents.find((e) => e.id === r.eventId);
        return {
          id: r.id,
          userId: r.userId,
          userName: null as string | null,
          userEmail: null as string | null,
          eventId: r.eventId,
          eventTitle: ev?.title ?? '',
          eventCategory: ev?.category ?? ('event' as const),
          eventStartsAt: ev?.startsAt ?? r.createdAt,
          createdAt: r.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  try {
    return await db
      .select({
        id: registrations.id,
        userId: registrations.userId,
        userName: users.name,
        userEmail: users.email,
        eventId: registrations.eventId,
        eventTitle: events.title,
        eventCategory: events.category,
        eventStartsAt: events.startsAt,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .innerJoin(events, eq(registrations.eventId, events.id))
      .leftJoin(users, eq(registrations.userId, users.id))
      .orderBy(desc(registrations.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllRegistrationsAdmin:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}


export interface AdminEventRow extends DbEvent {
  registrationsCount: number;
}

export async function getAllEventsAdmin(): Promise<AdminEventRow[]> {
  if (!isSqlConfigured) {
    return [...mockEvents]
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .map((ev) => ({
        ...ev,
        registrationsCount: mockRegistrations.filter((r) => r.eventId === ev.id).length,
      }));
  }

  try {
    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        category: events.category,
        startsAt: events.startsAt,
        location: events.location,
        organizer: events.organizer,
        coverImageUrl: events.coverImageUrl,
        status: events.status,
        createdAt: events.createdAt,
        registrationsCount: sql<number>`cast(count(${registrations.id}) as int)`,
      })
      .from(events)
      .leftJoin(registrations, eq(events.id, registrations.eventId))
      .groupBy(events.id)
      .orderBy(desc(events.startsAt));

    return rows;
  } catch (error) {
    console.error('Database query failed in getAllEventsAdmin:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export interface AdminSqlOverview {
  totalEvents: number;
  publishedEvents: number;
  totalRegistrations: number;
  totalSqlUsers: number;
  sqlConfigured: boolean;
}

export async function getAdminSqlOverview(): Promise<AdminSqlOverview> {
  if (!isSqlConfigured) {
    return {
      totalEvents: mockEvents.length,
      publishedEvents: mockEvents.filter((e) => e.status === 'published').length,
      totalRegistrations: mockRegistrations.length,
      totalSqlUsers: 0,
      sqlConfigured: false,
    };
  }

  try {
    const [eventsSummary, regSummary, usersSummary] = await Promise.all([
      db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          published: sql<number>`cast(count(*) filter (where ${events.status} = 'published') as int)`,
        })
        .from(events),
      db
        .select({
          total: sql<number>`cast(count(*) as int)`,
        })
        .from(registrations),
      db
        .select({
          total: sql<number>`cast(count(*) as int)`,
        })
        .from(users),
    ]);

    return {
      totalEvents: Number(eventsSummary[0]?.total ?? 0),
      publishedEvents: Number(eventsSummary[0]?.published ?? 0),
      totalRegistrations: Number(regSummary[0]?.total ?? 0),
      totalSqlUsers: Number(usersSummary[0]?.total ?? 0),
      sqlConfigured: true,
    };
  } catch (error) {
    console.error('Database query failed in getAdminSqlOverview:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
