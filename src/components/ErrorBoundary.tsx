import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = 'حدث خطأ غير متوقع أثناء تحميل البيانات.';
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        if (
          parsed.error.toLowerCase().includes('permission') ||
          parsed.error.toLowerCase().includes('insufficient')
        ) {
          friendly = `تعذر الوصول إلى البيانات (${parsed.path || 'Firestore'}). تأكد من تسجيل الدخول وتفعيل البريد الإلكتروني وصلاحيات الحساب.`;
        } else {
          friendly = parsed.error;
        }
      }
    } catch {
      if (raw) friendly = raw;
    }
    return { hasError: true, errorMessage: friendly };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF7E6] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-[#B43C25]/30 p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#B43C25]/12 text-[#B43C25] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-[#13221C]">
              تعذر إتمام العملية
            </h2>
            <p className="text-sm text-[#4E6359] leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3D2E] text-[#FFF7E6] text-xs font-bold hover:bg-[#072B20] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
