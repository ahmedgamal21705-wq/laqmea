import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { Language, Meal, Order, ProviderProfile, User } from '../../types/database';

interface AdminDashboardChartsProps {
  orders: Order[];
  meals: Meal[];
  users: User[];
  providerProfiles: ProviderProfile[];
  lang: Language;
  loading?: boolean;
}

const STATUS_BUCKET_COLORS: Record<string, string> = {
  pending: '#F7931E',
  active: '#0B3D2E',
  delivery: '#A7C957',
  delivered: '#166B50',
  cancelled: '#B43C25',
};

export const AdminDashboardCharts: React.FC<AdminDashboardChartsProps> = ({
  orders,
  meals,
  users,
  providerProfiles,
  lang,
  loading = false,
}) => {
  const topMealsData = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'rejected'
    );
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    validOrders.forEach((order) => {
      order.items_summary.forEach((item) => {
        const mealObj = meals.find((m) => m.id === item.meal_id);
        const displayName = mealObj
          ? lang === 'ar'
            ? mealObj.name_ar || mealObj.name
            : mealObj.name
          : item.meal_name;
        const prev = map.get(item.meal_id) || { name: displayName, count: 0, revenue: 0 };
        map.set(item.meal_id, {
          name: displayName.length > 20 ? `${displayName.slice(0, 19)}…` : displayName,
          count: prev.count + item.quantity,
          revenue: Number((prev.revenue + item.line_total).toFixed(2)),
        });
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [orders, meals, lang]);

  const topProvidersData = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'rejected'
    );
    const map = new Map<string, { name: string; ordersCount: number; revenue: number }>();
    validOrders.forEach((order) => {
      const prov = providerProfiles.find((p) => p.user_id === order.provider_id);
      const provName = prov?.business_name || order.provider_name || order.provider_id;
      const prev = map.get(order.provider_id) || {
        name: provName,
        ordersCount: 0,
        revenue: 0,
      };
      map.set(order.provider_id, {
        name: provName.length > 18 ? `${provName.slice(0, 17)}…` : provName,
        ordersCount: prev.ordersCount + 1,
        revenue: Number((prev.revenue + order.subtotal_amount).toFixed(2)),
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 6);
  }, [orders, providerProfiles]);

  const statusDistribution = useMemo(() => {
    const buckets = [
      {
        key: 'pending',
        label: lang === 'ar' ? 'بانتظار التأكيد' : 'Pending',
        color: STATUS_BUCKET_COLORS.pending,
        value: orders.filter((o) => o.status === 'pending').length,
      },
      {
        key: 'active',
        label: lang === 'ar' ? 'مؤكد / قيد التجهيز' : 'Confirmed / Preparing',
        color: STATUS_BUCKET_COLORS.active,
        value: orders.filter((o) =>
          ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status)
        ).length,
      },
      {
        key: 'delivery',
        label: lang === 'ar' ? 'مع المندوب / في الطريق' : 'Out for Delivery',
        color: STATUS_BUCKET_COLORS.delivery,
        value: orders.filter((o) =>
          ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)
        ).length,
      },
      {
        key: 'delivered',
        label: lang === 'ar' ? 'مكتمل' : 'Delivered',
        color: STATUS_BUCKET_COLORS.delivered,
        value: orders.filter((o) => o.status === 'delivered').length,
      },
      {
        key: 'cancelled',
        label: lang === 'ar' ? 'ملغي / مرفوض' : 'Cancelled / Rejected',
        color: STATUS_BUCKET_COLORS.cancelled,
        value: orders.filter((o) => ['cancelled', 'rejected'].includes(o.status)).length,
      },
    ];
    return buckets.filter((b) => b.value > 0);
  }, [orders, lang]);

  const growthSummary = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    const series: Array<{ day: string; users: number; orders: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const start = todayStart - i * dayMs;
      const end = start + dayMs;
      const dateObj = new Date(start);
      const label = dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'numeric',
        day: 'numeric',
      });

      const dayUsers = users.filter((u) => {
        const t = Date.parse(u.created_at);
        return !Number.isNaN(t) && t >= start && t < end;
      }).length;

      const dayOrders = orders.filter((o) => {
        const t = Date.parse(o.created_at);
        return !Number.isNaN(t) && t >= start && t < end;
      }).length;

      series.push({ day: label, users: dayUsers, orders: dayOrders });
    }

    const current7Start = todayStart - 6 * dayMs;
    const prev7Start = current7Start - 7 * dayMs;

    const currentUsers = users.filter((u) => {
      const t = Date.parse(u.created_at);
      return !Number.isNaN(t) && t >= current7Start;
    }).length;
    const prevUsers = users.filter((u) => {
      const t = Date.parse(u.created_at);
      return !Number.isNaN(t) && t >= prev7Start && t < current7Start;
    }).length;

    const currentOrders = orders.filter((o) => {
      const t = Date.parse(o.created_at);
      return !Number.isNaN(t) && t >= current7Start;
    }).length;
    const prevOrders = orders.filter((o) => {
      const t = Date.parse(o.created_at);
      return !Number.isNaN(t) && t >= prev7Start && t < current7Start;
    }).length;

    const userGrowthPct =
      prevUsers > 0 ? Math.round(((currentUsers - prevUsers) / prevUsers) * 100) : null;
    const orderGrowthPct =
      prevOrders > 0 ? Math.round(((currentOrders - prevOrders) / prevOrders) * 100) : null;

    return { series, currentUsers, prevUsers, currentOrders, prevOrders, userGrowthPct, orderGrowthPct };
  }, [users, orders, lang]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl border border-[#0B3D2E]/10 p-6 h-80 animate-pulse flex flex-col justify-between"
          >
            <div className="h-5 w-48 bg-[#FBF0D9] rounded-lg" />
            <div className="h-52 w-full bg-[#FFF7E6] rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. Top Ordered Meals */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/10 p-5 sm:p-6 shadow-xs flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7E6] text-[#F7931E] flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'أكثر الوجبات طلبًا' : 'Most Ordered Meals'}
              </h3>
              <p className="text-[11px] text-[#4E6359]">
                {lang === 'ar'
                  ? 'بناءً على الكميات المطلوبة في الطلبات الفعلية'
                  : 'Based on real ordered quantities'}
              </p>
            </div>
          </div>
        </div>

        {topMealsData.length === 0 ? (
          <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center bg-[#FFF7E6]/60 rounded-2xl p-6">
            <UtensilsCrossed className="w-7 h-7 text-[#4E6359]/50 mb-2" />
            <p className="text-xs font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'لا توجد طلبات مسجلة لعرض أكثر الوجبات طلبًا'
                : 'No order data available yet for top meals'}
            </p>
          </div>
        ) : (
          <div className="h-[240px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topMealsData}
                layout="vertical"
                margin={{ top: 4, right: 18, left: 10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0B3D2E14" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#4E6359' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: '#13221C', fontWeight: 600 }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${value} ${lang === 'ar' ? 'وجبة' : 'units'}`,
                    lang === 'ar' ? 'الكمية المطلوبة' : 'Ordered',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#0B3D2E20',
                    fontSize: '12px',
                    fontFamily: 'Cairo, sans-serif',
                  }}
                />
                <Bar dataKey="count" fill="#F7931E" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Most Active Providers */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/10 p-5 sm:p-6 shadow-xs flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#0B3D2E]/8 text-[#0B3D2E] flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'أكثر مقدمي الطعام نشاطًا' : 'Most Active Food Providers'}
              </h3>
              <p className="text-[11px] text-[#4E6359]">
                {lang === 'ar'
                  ? 'إجمالي الطلبات غير الملغاة لكل مطبخ'
                  : 'Valid orders handled per kitchen'}
              </p>
            </div>
          </div>
        </div>

        {topProvidersData.length === 0 ? (
          <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center bg-[#FFF7E6]/60 rounded-2xl p-6">
            <BarChart3 className="w-7 h-7 text-[#4E6359]/50 mb-2" />
            <p className="text-xs font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'لا توجد بيانات نشاط لمقدمي الطعام بعد'
                : 'No provider activity recorded yet'}
            </p>
          </div>
        ) : (
          <div className="h-[240px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProvidersData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0B3D2E14" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#13221C', fontWeight: 600 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4E6359' }} />
                <Tooltip
                  formatter={(value) => [
                    `${value} ${lang === 'ar' ? 'طلب' : 'orders'}`,
                    lang === 'ar' ? 'عدد الطلبات' : 'Orders',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#0B3D2E20',
                    fontSize: '12px',
                    fontFamily: 'Cairo, sans-serif',
                  }}
                />
                <Bar dataKey="ordersCount" fill="#0B3D2E" radius={[8, 8, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 3. Orders Distribution by Status */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/10 p-5 sm:p-6 shadow-xs flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#A7C957]/25 text-[#0B3D2E] flex items-center justify-center">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'توزيع الطلبات حسب الحالة' : 'Orders Distribution by Status'}
              </h3>
              <p className="text-[11px] text-[#4E6359]">
                {lang === 'ar'
                  ? 'التصنيف الفعلي لجميع طلبات المنصة'
                  : 'Real breakdown of all orders'}
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold text-[#0B3D2E] tabular-nums">
            {orders.length} {lang === 'ar' ? 'طلب' : 'orders'}
          </span>
        </div>

        {statusDistribution.length === 0 ? (
          <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center bg-[#FFF7E6]/60 rounded-2xl p-6">
            <PieChartIcon className="w-7 h-7 text-[#4E6359]/50 mb-2" />
            <p className="text-xs font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'لا توجد طلبات حالياً لعرض التوزيع'
                : 'No orders exist yet to show distribution'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
            <div className="h-[220px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value}`, lang === 'ar' ? 'العدد' : 'Count']}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#0B3D2E20',
                      fontSize: '12px',
                      fontFamily: 'Cairo, sans-serif',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {statusDistribution.map((item) => {
                const pct = orders.length > 0 ? Math.round((item.value / orders.length) * 100) : 0;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-xs border-b border-[#0B3D2E]/8 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-bold text-[#13221C] truncate">{item.label}</span>
                    </div>
                    <span className="font-extrabold text-[#4E6359] tabular-nums shrink-0">
                      {item.value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Users & Orders Growth Rate */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/10 p-5 sm:p-6 shadow-xs flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#0B3D2E]/8 text-[#0B3D2E] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'معدل نمو المستخدمين والطلبات (آخر 7 أيام)' : '7-Day Users & Orders Growth'}
              </h3>
              <p className="text-[11px] text-[#4E6359]">
                {growthSummary.userGrowthPct !== null || growthSummary.orderGrowthPct !== null
                  ? lang === 'ar'
                    ? `مقارنة بالأسبوع السابق: مستخدمون ${
                        growthSummary.userGrowthPct !== null
                          ? `${growthSummary.userGrowthPct > 0 ? '+' : ''}${growthSummary.userGrowthPct}%`
                          : '—'
                      } · طلبات ${
                        growthSummary.orderGrowthPct !== null
                          ? `${growthSummary.orderGrowthPct > 0 ? '+' : ''}${growthSummary.orderGrowthPct}%`
                          : '—'
                      }`
                    : `Vs prior 7 days: Users ${
                        growthSummary.userGrowthPct !== null ? `${growthSummary.userGrowthPct}%` : '—'
                      } · Orders ${
                        growthSummary.orderGrowthPct !== null ? `${growthSummary.orderGrowthPct}%` : '—'
                      }`
                  : lang === 'ar'
                  ? 'فترة البداية — لا توجد بيانات مقارنة من الأسبوع السابق'
                  : 'Initial period — no prior 7-day baseline available'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-bold">
            <span className="text-[#0B3D2E] tabular-nums">
              {lang === 'ar' ? 'مستخدمون:' : 'Users:'} {growthSummary.currentUsers}
            </span>
            <span className="text-[#D9780F] tabular-nums">
              {lang === 'ar' ? 'طلبات:' : 'Orders:'} {growthSummary.currentOrders}
            </span>
          </div>
        </div>

        <div className="h-[220px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthSummary.series} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0B3D2E14" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#4E6359' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4E6359' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  borderColor: '#0B3D2E20',
                  fontSize: '12px',
                  fontFamily: 'Cairo, sans-serif',
                }}
              />
              <Area
                type="monotone"
                dataKey="users"
                name={lang === 'ar' ? 'المستخدمون الجدد' : 'New Users'}
                stroke="#0B3D2E"
                fill="#A7C957"
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="orders"
                name={lang === 'ar' ? 'الطلبات' : 'Orders'}
                stroke="#F7931E"
                fill="#F7931E"
                fillOpacity={0.22}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
