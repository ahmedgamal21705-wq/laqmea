import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Language } from '../types/database';

interface ConfirmDialogProps {
  isOpen: boolean;
  lang: Language;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  lang,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  const defaultConfirm =
    confirmLabel ?? (lang === 'ar' ? 'تأكيد' : 'Confirm');
  const defaultCancel =
    cancelLabel ?? (lang === 'ar' ? 'إلغاء' : 'Cancel');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-[#0B3D2E]/15 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                tone === 'danger'
                  ? 'bg-[#E97858]/15 text-[#9E3F24]'
                  : 'bg-[#0B3D2E]/10 text-[#0B3D2E]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3
              id="confirm-dialog-title"
              className="text-lg font-extrabold text-[#13221C]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            className="min-w-[34px] min-h-[34px] rounded-xl text-[#4E6359] hover:bg-[#FFF7E6] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#4E6359] leading-relaxed">{description}</p>

        {children}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`flex-1 min-h-[42px] px-4 rounded-xl text-xs font-extrabold text-white transition-colors cursor-pointer disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-[#9E3F24] hover:bg-[#7F311B]'
                : 'bg-[#0B3D2E] hover:bg-[#072B20]'
            }`}
          >
            {busy
              ? lang === 'ar'
                ? 'جاري التنفيذ...'
                : 'Processing...'
              : defaultConfirm}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 min-h-[42px] px-4 rounded-xl border border-[#0B3D2E]/20 text-xs font-bold text-[#13221C] hover:bg-[#FFF7E6] cursor-pointer disabled:opacity-50"
          >
            {defaultCancel}
          </button>
        </div>
      </div>
    </div>
  );
};
