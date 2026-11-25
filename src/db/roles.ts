export type AppRole = 'admin' | 'user';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'ahmedgamal21705@gmail.com';

// Server-side role store keyed by Firebase UID.
// Roles are never accepted from browser payloads and only verified from server-side records
// or the cryptographically verified Firebase ID token email for the designated first admin.
const userRolesStore = new Map<string, { userId: string; email: string; role: AppRole }>();

export async function getUserRole(
  userId: string,
  verifiedEmail?: string | null,
  emailVerified?: boolean
): Promise<AppRole> {
  if (!userId) return 'user';

  const existing = userRolesStore.get(userId);
  if (existing) {
    return existing.role;
  }

  const normalizedEmail = (verifiedEmail || '').trim().toLowerCase();
  if (emailVerified && normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL) {
    userRolesStore.set(userId, {
      userId,
      email: normalizedEmail,
      role: 'admin',
    });
    return 'admin';
  }

  if (normalizedEmail) {
    userRolesStore.set(userId, {
      userId,
      email: normalizedEmail,
      role: 'user',
    });
  }

  return 'user';
}
