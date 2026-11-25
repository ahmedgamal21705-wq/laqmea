import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { type AppRole, getUserRole } from '../db/roles.ts';
import type { DbUser } from '../db/schema.ts';
import { getOrCreateUser } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
  userRole?: AppRole;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً للوصول إلى هذه الخدمة' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const email = decodedToken.email || `${decodedToken.uid}@lokma.local`;
    const name =
      (typeof decodedToken.name === 'string' && decodedToken.name.trim()) ||
      email.split('@')[0];

    req.dbUser = await getOrCreateUser(decodedToken.uid, name, email);
    req.userRole = await getUserRole(
      decodedToken.uid,
      decodedToken.email,
      Boolean(decodedToken.email_verified)
    );
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token or syncing user:', error);
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة أو الرمز غير صالح، يرجى إعادة تسجيل الدخول' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.uid) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }

  try {
    // Always re-verify the role directly on the server before executing any admin route
    const role = await getUserRole(
      req.user.uid,
      req.user.email,
      Boolean(req.user.email_verified)
    );
    req.userRole = role;

    if (role !== 'admin') {
      return res.status(403).json({
        error: 'غير مصرح لك بالوصول — هذه العملية مخصصة للمشرفين فقط',
      });
    }

    next();
  } catch (error) {
    console.error('Error verifying admin role:', error);
    return res.status(500).json({ error: 'تعذر التحقق من صلاحيات المشرف' });
  }
};
