export const MAX_MEAL_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

export function validateImageFileClient(file: File): { ok: true } | { ok: false; error: string } {
  const nameLower = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_IMAGE_EXTS.some((ext) => nameLower.endsWith(ext));
  const hasAllowedMime = !file.type || ALLOWED_IMAGE_MIMES.has(file.type.toLowerCase());

  if (!hasAllowedExt || !hasAllowedMime) {
    return {
      ok: false,
      error: 'صيغة الصورة غير مدعومة (يُسمح فقط بـ JPG وJPEG وPNG وWebP)',
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: 'ملف الصورة فارغ أو غير صالح',
    };
  }

  if (file.size > MAX_MEAL_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'حجم الصورة يتجاوز الحد المسموح به (5MB)',
    };
  }

  return { ok: true };
}

export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const idx = res.indexOf('base64,');
      resolve(idx >= 0 ? res.slice(idx + 7) : res);
    };
    reader.readAsDataURL(file);
  });
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed reading image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const attempts = [
          { maxDim: 900, quality: 0.78 },
          { maxDim: 720, quality: 0.7 },
          { maxDim: 560, quality: 0.62 },
        ];

        for (const attempt of attempts) {
          let width = img.width;
          let height = img.height;
          if (width > attempt.maxDim || height > attempt.maxDim) {
            if (width > height) {
              height = Math.round((height * attempt.maxDim) / width);
              width = attempt.maxDim;
            } else {
              width = Math.round((width * attempt.maxDim) / height);
              height = attempt.maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(typeof reader.result === 'string' ? reader.result : '');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', attempt.quality);
          if (compressed.length <= 550000 || attempt === attempts[attempts.length - 1]) {
            resolve(compressed);
            return;
          }
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
