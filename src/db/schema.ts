import { relations } from 'drizzle-orm';
import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const eventCategoryEnum = pgEnum('event_category', ['workshop', 'course', 'event']);
export const eventStatusEnum = pgEnum('event_status', ['draft', 'published', 'hidden']);

// 1. users (id comes from Firebase Auth UID on the server)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. events
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  category: eventCategoryEnum('category').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  location: text('location'),
  organizer: text('organizer'),
  coverImageUrl: text('cover_image_url'),
  status: eventStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. registrations
export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('registrations_user_event_unique').on(table.userId, table.eventId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  registrations: many(registrations),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(registrations),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  user: one(users, {
    fields: [registrations.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [registrations.eventId],
    references: [events.id],
  }),
}));

export type DbUser = typeof users.$inferSelect;
export type DbEvent = typeof events.$inferSelect;
export type DbRegistration = typeof registrations.$inferSelect;
