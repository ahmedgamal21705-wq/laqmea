import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createEventAdmin,
  createUserRegistration,
  deleteEventAdmin,
  type EventCategory,
  type EventStatus,
  getAdminSqlOverview,
  getAllEventsAdmin,
  getAllRegistrationsAdmin,
  getPublishedEvents,
  getUserRegistrations,
  updateEventAdmin,
} from './src/db/events.ts';
import { type AuthRequest, requireAdmin, requireAuth } from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_CATEGORIES = new Set<EventCategory>(['workshop', 'course', 'event']);
const VALID_STATUSES = new Set<EventStatus>(['draft', 'published', 'hidden']);

function isValidImageUrl(value: unknown): value is string | null {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  return value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/');
}

const MAX_MEAL_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VALID_DOC_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function detectImageFormatFromMagicBytes(
  buf: Buffer
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function isValidMealHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use('/api/admin/meals/upload-image', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '2mb' }));

  // Public route: visitors and users read ONLY published events
  app.get('/api/events', async (req, res) => {
    try {
      const category =
        typeof req.query.category === 'string' ? req.query.category : undefined;
      const rows = await getPublishedEvents(category);
      res.json({ events: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load events';
      res.status(500).json({ error: msg });
    }
  });

  // Authenticated route: verifies session, syncs user record, and returns server-computed role
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({
      user: req.dbUser ?? {
        id: req.user!.uid,
        email: req.user!.email ?? null,
        name: req.user!.name ?? null,
      },
      role: req.userRole ?? 'user',
    });
  });

  // Authenticated route: user reads ONLY their own registrations (from verified session UID)
  app.get('/api/registrations/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await getUserRegistrations(req.user!.uid);
      res.json({ registrations: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load registrations';
      res.status(500).json({ error: msg });
    }
  });

  // Authenticated route: user adds a registration for themselves ONLY (ignores any client user_id/role)
  app.post('/api/registrations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rawEventId = req.body?.event_id ?? req.body?.eventId;
      if (typeof rawEventId !== 'string' || !rawEventId.trim()) {
        return res.status(400).json({ error: 'event_id is required' });
      }

      const result = await createUserRegistration(req.user!.uid, rawEventId.trim());

      if (result.status === 'invalid_event_id') {
        return res.status(400).json({ error: 'Invalid event ID format' });
      }
      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'Published event not found' });
      }
      if (result.status === 'duplicate') {
        return res.status(409).json({ error: 'Already registered for this event' });
      }

      return res.status(201).json({ registration: result.registration });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to register for event';
      return res.status(500).json({ error: msg });
    }
  });

  // Explicitly block registration updates/deletes from client users
  app.all('/api/registrations/:id', requireAuth, (_req, res) => {
    return res.status(405).json({ error: 'Registrations cannot be modified or deleted' });
  });

  // ------------------------------------------------------------------
  // Admin Routes — strictly verified via requireAuth + requireAdmin
  // ------------------------------------------------------------------
  app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const sqlOverview = await getAdminSqlOverview();
      return res.json({
        authorized: true,
        verifiedAdminEmail: req.user?.email ?? null,
        role: req.userRole ?? 'admin',
        sqlOverview,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load admin overview';
      return res.status(500).json({ error: msg });
    }
  });

  // Read-only admin authorization check for /admin/orders (zero database writes)
  app.get('/api/admin/orders/verify', requireAuth, requireAdmin, (req: AuthRequest, res) => {
    return res.json({
      authorized: true,
      readOnly: true,
      verifiedAdminEmail: req.user?.email ?? null,
      role: req.userRole ?? 'admin',
      checkedAt: new Date().toISOString(),
    });
  });

  // Read-only admin authorization check for /admin/users (verifies role on server, zero database writes)
  app.get('/api/admin/users/verify', requireAuth, requireAdmin, (req: AuthRequest, res) => {
    return res.json({
      authorized: true,
      readOnly: true,
      verifiedAdminEmail: req.user?.email ?? null,
      role: req.userRole ?? 'admin',
      checkedAt: new Date().toISOString(),
    });
  });

  app.get('/api/admin/events', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const rows = await getAllEventsAdmin();
      return res.json({ events: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load admin events';
      return res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/events', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const body = req.body ?? {};
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const category = body.category as EventCategory;
      const startsAtRaw = body.startsAt ?? body.starts_at;
      const startsAt = startsAtRaw ? new Date(String(startsAtRaw)) : null;

      if (!title || title.length > 200) {
        return res.status(400).json({ error: 'عنوان الفعالية مطلوب ويجب ألا يتجاوز 200 حرف' });
      }
      if (!VALID_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'تصنيف الفعالية غير صالح' });
      }
      if (!startsAt || Number.isNaN(startsAt.getTime())) {
        return res.status(400).json({ error: 'تاريخ بداية الفعالية غير صالح' });
      }

      const status = body.status !== undefined ? (body.status as EventStatus) : 'draft';
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ error: 'حالة الفعالية غير صالحة' });
      }

      const coverImageUrl = body.coverImageUrl ?? body.cover_image_url ?? null;
      if (!isValidImageUrl(coverImageUrl)) {
        return res.status(400).json({ error: 'رابط صورة الغلاف غير صالح' });
      }

      const created = await createEventAdmin({
        title,
        description: typeof body.description === 'string' ? body.description.trim() : null,
        category,
        startsAt,
        location: typeof body.location === 'string' ? body.location.trim() : null,
        organizer: typeof body.organizer === 'string' ? body.organizer.trim() : null,
        coverImageUrl: coverImageUrl || null,
        status,
      });

      return res.status(201).json({ event: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create event';
      return res.status(500).json({ error: msg });
    }
  });

  const handleUpdateEvent = async (req: AuthRequest, res: express.Response) => {
    try {
      const eventId = req.params.id;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = {};

      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
          return res.status(400).json({ error: 'عنوان الفعالية غير صالح' });
        }
        patch.title = body.title.trim();
      }
      if (body.description !== undefined) {
        patch.description = typeof body.description === 'string' ? body.description.trim() : null;
      }
      if (body.category !== undefined) {
        if (!VALID_CATEGORIES.has(body.category)) {
          return res.status(400).json({ error: 'تصنيف الفعالية غير صالح' });
        }
        patch.category = body.category;
      }
      if (body.startsAt !== undefined || body.starts_at !== undefined) {
        const dt = new Date(String(body.startsAt ?? body.starts_at));
        if (Number.isNaN(dt.getTime())) {
          return res.status(400).json({ error: 'تاريخ بداية الفعالية غير صالح' });
        }
        patch.startsAt = dt;
      }
      if (body.location !== undefined) {
        patch.location = typeof body.location === 'string' ? body.location.trim() : null;
      }
      if (body.organizer !== undefined) {
        patch.organizer = typeof body.organizer === 'string' ? body.organizer.trim() : null;
      }
      if (body.coverImageUrl !== undefined || body.cover_image_url !== undefined) {
        const img = body.coverImageUrl ?? body.cover_image_url ?? null;
        if (!isValidImageUrl(img)) {
          return res.status(400).json({ error: 'رابط صورة الغلاف غير صالح' });
        }
        patch.coverImageUrl = img || null;
      }
      if (body.status !== undefined) {
        if (!VALID_STATUSES.has(body.status)) {
          return res.status(400).json({ error: 'حالة الفعالية غير صالحة' });
        }
        patch.status = body.status;
      }

      const result = await updateEventAdmin(eventId, patch);
      if (result.status === 'invalid_id') {
        return res.status(400).json({ error: 'معرف الفعالية غير صالح' });
      }
      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'الفعالية غير موجودة' });
      }

      return res.json({ event: result.event });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update event';
      return res.status(500).json({ error: msg });
    }
  };

  app.patch('/api/admin/events/:id', requireAuth, requireAdmin, handleUpdateEvent);
  app.put('/api/admin/events/:id', requireAuth, requireAdmin, handleUpdateEvent);

  app.delete('/api/admin/events/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await deleteEventAdmin(req.params.id);
      if (result.status === 'invalid_id') {
        return res.status(400).json({ error: 'معرف الفعالية غير صالح' });
      }
      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'الفعالية غير موجودة' });
      }
      return res.json({ deleted: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete event';
      return res.status(500).json({ error: msg });
    }
  });

  app.get('/api/admin/registrations', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const rows = await getAllRegistrationsAdmin();
      return res.json({ registrations: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load registrations';
      return res.status(500).json({ error: msg });
    }
  });

  // Admin-only meal image validation (MIME, extension, 5MB cap, magic-byte inspection)
  app.post(
    '/api/admin/meals/upload-image',
    requireAuth,
    requireAdmin,
    (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        const rawBase64 = typeof body.dataBase64 === 'string' ? body.dataBase64.trim() : '';
        const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
        const filename = typeof body.filename === 'string' ? body.filename.trim() : '';

        if (!rawBase64) {
          return res.status(400).json({ error: 'ملف الصورة مطلوب' });
        }

        if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
          return res.status(400).json({
            error: 'صيغة الصورة غير مدعومة (يُسمح فقط بـ JPG وJPEG وPNG وWebP)',
          });
        }

        if (filename) {
          const ext = path.extname(filename).toLowerCase();
          if (ext && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
            return res.status(400).json({
              error: 'صيغة الصورة غير مدعومة (يُسمح فقط بـ JPG وJPEG وPNG وWebP)',
            });
          }
        }

        const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
        if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
          return res.status(400).json({ error: 'بيانات الصورة غير صالحة' });
        }

        const buffer = Buffer.from(cleanBase64, 'base64');
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'ملف الصورة فارغ أو تالف' });
        }

        if (buffer.length > MAX_MEAL_IMAGE_BYTES) {
          return res.status(400).json({
            error: 'حجم الصورة يتجاوز الحد المسموح به (5MB)',
          });
        }

        const detectedMime = detectImageFormatFromMagicBytes(buffer);
        if (!detectedMime) {
          return res.status(400).json({
            error: 'صيغة الصورة غير مدعومة أو الملف ليس صورة حقيقية (JPG / PNG / WebP)',
          });
        }

        return res.json({
          ok: true,
          mimeType: detectedMime,
          sizeBytes: buffer.length,
        });
      } catch {
        return res.status(400).json({ error: 'تعذر فحص ملف الصورة على الخادم' });
      }
    }
  );

  // Admin-only backend validation for meal creation/editing/publishing
  app.post('/api/admin/meals/validate', requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const body = req.body ?? {};
    const action = body.action === 'draft' ? 'draft' : 'publish';
    const nameAr = typeof body.name_ar === 'string' ? body.name_ar.trim() : '';
    const nameEn = typeof body.name === 'string' ? body.name.trim() : '';
    const primaryName = nameAr || nameEn;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const categoryId = typeof body.category_id === 'string' ? body.category_id.trim() : '';
    const providerId = typeof body.provider_id === 'string' ? body.provider_id.trim() : '';
    const price = Number(body.price);
    const prepTime = Number(body.prep_time_minutes);
    const portionDescription =
      typeof body.portion_description === 'string' ? body.portion_description.trim() : '';
    const ingredientsText =
      typeof body.ingredients_text === 'string' ? body.ingredients_text.trim() : '';
    const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';

    const fieldErrors: Record<string, string> = {};

    if (!primaryName || primaryName.length < 2) {
      fieldErrors.name = 'اسم الوجبة مطلوب';
    } else if (primaryName.length > 150 || nameEn.length > 150) {
      fieldErrors.name = 'اسم الوجبة يجب ألا يتجاوز 150 حرفًا';
    }

    if (action === 'publish' && (!description || description.length < 5)) {
      fieldErrors.description = 'يرجى إدخال وصف تفصيلي للوجبة (5 أحرف على الأقل)';
    } else if (description.length > 1000) {
      fieldErrors.description = 'وصف الوجبة يجب ألا يتجاوز 1000 حرف';
    }

    if (!categoryId || !VALID_DOC_ID_RE.test(categoryId)) {
      fieldErrors.category = 'يرجى اختيار التصنيف';
    }

    if (!providerId || !VALID_DOC_ID_RE.test(providerId)) {
      fieldErrors.provider = 'يرجى اختيار مقدم الطعام';
    }

    if (!Number.isFinite(price) || price <= 0 || price > 10000) {
      fieldErrors.price = 'يرجى إدخال سعر صحيح أكبر من صفر';
    }

    if (!Number.isFinite(prepTime) || !Number.isInteger(prepTime) || prepTime < 1 || prepTime > 300) {
      fieldErrors.prep = 'مدة التحضير يجب أن تكون عددًا صحيحًا بين 1 و300 دقيقة';
    }

    if (portionDescription.length > 150) {
      fieldErrors.portion = 'وصف الحصة يجب ألا يتجاوز 150 حرفًا';
    }

    if (ingredientsText.length > 500) {
      fieldErrors.ingredients = 'نص المكونات يجب ألا يتجاوز 500 حرف';
    }

    if (imageUrl) {
      const isSafeDataImage =
        /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(imageUrl) &&
        imageUrl.length <= 600000;
      const isSafeHttps = imageUrl.startsWith('https://') && isValidMealHttpsUrl(imageUrl);
      if (!isSafeDataImage && !isSafeHttps) {
        fieldErrors.image =
          'رابط الصورة غير صالح — يجب استخدام رابط https:// صالح أو صورة مرفوعة بصيغة مدعومة';
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      const firstMsg = Object.values(fieldErrors)[0];
      return res.status(400).json({
        ok: false,
        error: firstMsg,
        fieldErrors,
      });
    }

    return res.json({ ok: true });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`LOKMA server running on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
