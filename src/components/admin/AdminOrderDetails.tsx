import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  Package,
  Receipt,
  Truck,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import {
  DeliveryPartnerProfile,
  Language,
  Order,
  OrderStatus,
  ProviderProfile,
} from '../../types/database';
import { ConfirmDialog } from '../ConfirmDialog';

export function getOrderStatusBadge(status: OrderStatus, lang: Language) {
  switch (status) {
    case 'pending':
      return {
        label: lang === 'ar' ? 'بانتظار التأكيد' : 'Pending',
        cls: 'bg-[#F7931E]/15 text-[#9A5304] border-[#F7931E]/35',
        icon: Clock,
      };
    case 'accepted':
      return {
        label: lang === 'ar' ? 'تم التأكيد' : 'Confirmed',
        cls: 'bg-[#0B3D2E]/10 text-[#0B3D2E] border-[#0B3D2E]/25',
        icon: CheckCircle2,
      };
    case 'preparing':
      return {
        label: lang === 'ar' ? 'قيد التحضير' : 'Preparing',
        cls: 'bg-[#F7931E]/15 text-[#9A5304] border-[#F7931E]/35',
        icon: ChefHat,
      };
    case 'ready_for_pickup':
      return {
        label: lang === 'ar' ? 'جاهز للاستلام' : 'Ready for Pickup',
        cls: 'bg-[#A7C957]/25 text-[#0B3D2E] border-[#A7C957]/50',
        icon: Package,
      };
    case 'assigned':
      return {
        label: lang === 'ar' ? 'تم تعيين المندوب' : 'Partner Assigned',
        cls: 'bg-[#0B3D2E]/10 text-[#0B3D2E] border-[#0B3D2E]/25',
        icon: Bike,
      };
    case 'picked_up':
      return {
        label: lang === 'ar' ? 'تم الاستلام من المطبخ' : 'Picked Up',
        cls: 'bg-[#0B3D2E]/10 text-[#0B3D2E] border-[#0B3D2E]/25',
        icon: Bike,
      };
    case 'out_for_delivery':
      return {
        label: lang === 'ar' ? 'في الطريق للطالب' : 'Out for Delivery',
        cls: 'bg-[#F7931E]/20 text-[#9A5304] border-[#F7931E]/40',
        icon: Truck,
      };
    case 'delivered':
      return {
        label: lang === 'ar' ? 'تم التسليم' : 'Delivered',
        cls: 'bg-[#A7C957]/30 text-[#0B3D2E] border-[#0B3D2E]/25',
        icon: CheckCircle2,
      };
    case 'cancelled':
    case 'rejected':
    default:
      return {
        label:
          status === 'rejected'
            ? lang === 'ar'
              ? 'مرفوض'
              : 'Rejected'
            : lang === 'ar'
            ? 'ملغي'
            : 'Cancelled',
        cls: 'bg-[#B43C25]/12 text-[#B43C25] border-[#B43C25]/30',
        icon: XCircle,
      };
  }
}

interface AdminOrderDetailsProps {
  order: Order | null;
  providerProfiles: ProviderProfile[];
  deliveryPartners: DeliveryPartnerProfile[];
  lang: Language;
  onBack: () => void;
  onAssignPartner: (orderId: string, partnerId: string) => Promise<boolean>;
  onTransitionStatus: (orderId: string, nextStatus: OrderStatus, note?: string) => Promise<boolean>;
}

export const AdminOrderDetails: React.FC<AdminOrderDetailsProps> = ({
  order,
  providerProfiles,
  deliveryPartners,
  lang,
  onBack,
  onAssignPartner,
  onTransitionStatus,
}) => {
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  if (!order) {
    return (
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-8 sm:p-12 text-center space-y-4">
        <Receipt className="w-10 h-10 text-[#4E6359]/60 mx-auto" />
        <h2 className="text-lg font-extrabold text-[#13221C]">
          {lang === 'ar' ? 'لم يتم العثور على هذا الطلب' : 'Order Not Found'}
        </h2>
        <p className="text-xs text-[#4E6359]">
          {lang === 'ar'
            ? 'قد يكون معرف الطلب غير صحيح أو لم تكتمل مزامنة السجلات بعد.'
            : 'The requested order ID could not be found in the system.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] transition-colors cursor-pointer"
        >
          <BackArrow className="w-4 h-4" />
          <span>{lang === 'ar' ? 'العودة لقائمة الطلبات' : 'Back to Orders'}</span>
        </button>
      </div>
    );
  }

  const badge = getOrderStatusBadge(order.status, lang);
  const BadgeIcon = badge.icon;
  const provider = providerProfiles.find((p) => p.user_id === order.provider_id);
  const verifiedPartners = deliveryPartners.filter(
    (dp) => dp.verification_status === 'verified'
  );
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(order.status);

  const handleAssign = async () => {
    if (!selectedPartnerId) return;
    setBusy(true);
    await onAssignPartner(order.id, selectedPartnerId);
    setBusy(false);
    setSelectedPartnerId('');
  };

  const handleTransition = async (next: OrderStatus) => {
    setBusy(true);
    await onTransitionStatus(order.id, next, statusNote.trim() || undefined);
    setStatusNote('');
    setBusy(false);
  };

  const formattedDate = new Date(order.created_at).toLocaleString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { dateStyle: 'medium', timeStyle: 'short' }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-white border border-[#0B3D2E]/15 text-xs font-bold text-[#0B3D2E] hover:bg-[#FFF7E6] transition-colors cursor-pointer"
        >
          <BackArrow className="w-4 h-4" />
          <span>{lang === 'ar' ? 'العودة إلى الطلبات' : 'Back to Orders'}</span>
        </button>

        <span
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold ${badge.cls}`}
        >
          <BadgeIcon className="w-3.5 h-3.5" />
          <span>{badge.label}</span>
        </span>
      </div>

      {/* Header Summary */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#0B3D2E]/10 pb-4">
          <div>
            <p className="text-xs font-bold text-[#4E6359]">
              {lang === 'ar' ? 'تفاصيل الطلب' : 'Order Details'}
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E] tabular-nums mt-0.5">
              #{order.order_number || order.id}
            </h2>
            <p className="text-xs text-[#4E6359] mt-1 tabular-nums">{formattedDate}</p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-xs font-bold text-[#4E6359]">
              {lang === 'ar' ? 'إجمالي الطلب' : 'Total Amount'}
            </span>
            <span className="text-2xl font-extrabold text-[#13221C] tabular-nums">
              {order.total_amount.toFixed(2)} {lang === 'ar' ? 'ج.م' : 'EGP'}
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                order.payment_status === 'paid'
                  ? 'bg-[#A7C957]/30 text-[#0B3D2E]'
                  : 'bg-[#FFF7E6] text-[#9A5304]'
              }`}
            >
              {order.payment_status === 'paid'
                ? lang === 'ar'
                  ? 'مدفوع (نقدي عند الاستلام)'
                  : 'Paid (Cash)'
                : lang === 'ar'
                ? 'غير مدفوع بعد (الدفع عند التسليم)'
                : 'Unpaid (Cash on Delivery)'}
            </span>
          </div>
        </div>

        {/* Parties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#4E6359]">
              <UserIcon className="w-3.5 h-3.5 text-[#0B3D2E]" />
              <span>{lang === 'ar' ? 'الطالب' : 'Student'}</span>
            </div>
            <p className="text-sm font-extrabold text-[#13221C]">{order.student_name}</p>
            <div className="flex items-start gap-1.5 text-xs text-[#4E6359] pt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#F7931E]" />
              <span>
                {order.fulfillment_type === 'pickup'
                  ? lang === 'ar'
                    ? 'استلام شخصي من المطبخ'
                    : 'Self-Pickup from Kitchen'
                  : order.delivery_location || (lang === 'ar' ? 'غير محدد' : 'Not specified')}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#4E6359]">
              <ChefHat className="w-3.5 h-3.5 text-[#F7931E]" />
              <span>{lang === 'ar' ? 'مقدم الطعام' : 'Food Provider'}</span>
            </div>
            <p className="text-sm font-extrabold text-[#13221C]">
              {provider?.business_name || order.provider_name}
            </p>
            {provider?.area && (
              <p className="text-xs text-[#4E6359]">
                {provider.area} · {provider.pickup_address}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#4E6359]">
              <Bike className="w-3.5 h-3.5 text-[#0B3D2E]" />
              <span>{lang === 'ar' ? 'مندوب التوصيل' : 'Delivery Partner'}</span>
            </div>
            {order.fulfillment_type === 'pickup' ? (
              <p className="text-xs font-bold text-[#4E6359]">
                {lang === 'ar' ? 'لا ينطبق (استلام ذاتي)' : 'Not applicable (Pickup)'}
              </p>
            ) : order.delivery_partner_name ? (
              <div>
                <p className="text-sm font-extrabold text-[#13221C]">
                  {order.delivery_partner_name}
                </p>
                <p className="text-xs text-[#4E6359]">
                  {order.delivery_partner_method === 'bicycle'
                    ? lang === 'ar'
                      ? 'دراجة هوائية'
                      : 'Bicycle'
                    : lang === 'ar'
                    ? 'سير على الأقدام'
                    : 'Walking'}
                </p>
              </div>
            ) : (
              <p className="text-xs font-bold text-[#9A5304]">
                {lang === 'ar' ? 'لم يتم تعيين مندوب بعد' : 'Not assigned yet'}
              </p>
            )}
          </div>
        </div>

        {/* Admin Actions: Assign Partner or Status Override */}
        {!isTerminal && (
          <div className="rounded-2xl border border-[#0B3D2E]/12 bg-[#FBF0D9]/45 p-4 space-y-4">
            <h3 className="text-xs font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'إجراءات الإدارة المباشرة' : 'Administrative Controls'}
            </h3>

            {order.fulfillment_type === 'delivery' &&
              !order.delivery_partner_id &&
              verifiedPartners.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    aria-label={lang === 'ar' ? 'اختر مندوب توصيل' : 'Select delivery partner'}
                    className="flex-1 min-w-[200px] px-3 py-2.5 rounded-xl bg-white border border-[#0B3D2E]/20 text-xs font-bold text-[#13221C]"
                  >
                    <option value="">
                      {lang === 'ar' ? 'اختر مندوب توصيل موثق لتعيينه...' : 'Select verified delivery partner...'}
                    </option>
                    {verifiedPartners.map((dp) => (
                      <option key={dp.user_id} value={dp.user_id}>
                        {dp.full_name} ({dp.is_online ? (lang === 'ar' ? 'متصل' : 'Online') : (lang === 'ar' ? 'غير متصل' : 'Offline')})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPartnerId || busy}
                    onClick={handleAssign}
                    className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'تعيين المندوب' : 'Assign Partner'}
                  </button>
                </div>
              )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder={
                  lang === 'ar' ? 'ملاحظة إدارية لتحديث الحالة (اختياري)...' : 'Admin status note (optional)...'
                }
                className="flex-1 min-w-[200px] px-3 py-2.5 rounded-xl bg-white border border-[#0B3D2E]/20 text-xs text-[#13221C]"
              />
              {order.status === 'pending' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTransition('accepted')}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] disabled:opacity-50 cursor-pointer"
                >
                  {lang === 'ar' ? 'تأكيد الطلب' : 'Confirm Order'}
                </button>
              )}
              {['accepted', 'preparing', 'ready_for_pickup', 'assigned', 'picked_up', 'out_for_delivery'].includes(
                order.status
              ) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTransition('delivered')}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#A7C957] text-[#0B3D2E] text-xs font-extrabold hover:bg-[#95B848] disabled:opacity-50 cursor-pointer"
                >
                  {lang === 'ar' ? 'تحديد كمكتمل' : 'Mark Delivered'}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelConfirmOpen(true)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#B43C25]/10 text-[#B43C25] border border-[#B43C25]/25 text-xs font-bold hover:bg-[#B43C25]/20 disabled:opacity-50 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Items & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'الوجبات المطلوبة' : 'Order Items'}
          </h3>
          <div className="divide-y divide-[#0B3D2E]/10">
            {order.items_summary.map((item, idx) => (
              <div key={`${item.meal_id}_${idx}`} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-[#13221C]">{item.meal_name}</p>
                  <p className="text-[#4E6359] tabular-nums">
                    {item.quantity} × {item.unit_price.toFixed(2)} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </p>
                  {item.notes && (
                    <p className="text-[11px] text-[#9A5304] mt-0.5">{item.notes}</p>
                  )}
                </div>
                <span className="font-extrabold text-[#0B3D2E] tabular-nums">
                  {item.line_total.toFixed(2)} {lang === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#0B3D2E]/12 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#4E6359]">
              <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span className="font-bold tabular-nums">{order.subtotal_amount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-[#4E6359]">
              <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
              <span className="font-bold tabular-nums">{order.delivery_fee.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[#0B3D2E] pt-1">
              <span>{lang === 'ar' ? 'الإجمالي النهائي' : 'Grand Total'}</span>
              <span className="tabular-nums">{order.total_amount.toFixed(2)} ج.م</span>
            </div>
          </div>

          {order.student_notes && (
            <div className="rounded-xl bg-[#FFF7E6] p-3 text-xs text-[#4E6359]">
              <span className="font-bold text-[#13221C]">
                {lang === 'ar' ? 'ملاحظات الطالب: ' : 'Student Notes: '}
              </span>
              {order.student_notes}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-[#13221C]">
            {lang === 'ar' ? 'سجل تتبع حالات الطلب' : 'Order Status Timeline'}
          </h3>
          <div className="space-y-3">
            {order.status_history.map((entry, idx) => {
              const info = getOrderStatusBadge(entry.status, lang);
              return (
                <div
                  key={`${entry.status}_${idx}`}
                  className="flex items-start justify-between gap-3 border-b border-[#0B3D2E]/8 pb-3 last:border-b-0 last:pb-0 text-xs"
                >
                  <div>
                    <span className="font-extrabold text-[#0B3D2E]">{info.label}</span>
                    {entry.note && <p className="text-[#4E6359] mt-0.5">{entry.note}</p>}
                  </div>
                  <span className="text-[11px] text-[#4E6359] tabular-nums shrink-0">
                    {new Date(entry.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        lang={lang}
        tone="danger"
        busy={busy}
        title={
          lang === 'ar'
            ? `تأكيد إلغاء الطلب #${order.order_number || order.id}`
            : `Cancel Order #${order.order_number || order.id}`
        }
        description={
          lang === 'ar'
            ? 'سيتم تغيير حالة الطلب إلى ملغي وإشعار الطالب والمطبخ. هل أنت متأكد من المتابعة؟'
            : 'This will mark the order as cancelled and notify the student and kitchen. Do you want to continue?'
        }
        confirmLabel={lang === 'ar' ? 'تأكيد الإلغاء' : 'Confirm Cancel'}
        cancelLabel={lang === 'ar' ? 'تراجع' : 'Keep Order'}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          await handleTransition('cancelled');
          setCancelConfirmOpen(false);
        }}
      />
    </div>
  );
};
