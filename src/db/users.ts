import { db, isSqlConfigured } from './index.ts';
import { type DbUser, users } from './schema.ts';

const mockUsers = new Map<string, DbUser>();

export async function getOrCreateUser(id: string, name: string, email: string) {
  const safeName = name.trim() || email.split('@')[0] || 'LOKMA Member';

  if (!isSqlConfigured) {
    const existing = mockUsers.get(id);
    const user: DbUser = {
      id,
      name: safeName,
      email,
      createdAt: existing?.createdAt ?? new Date(),
    };
    mockUsers.set(id, user);
    return user;
  }

  try {
    const result = await db
      .insert(users)
      .values({
        id,
        name: safeName,
        email,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: safeName,
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
