import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, UtensilsCrossed } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Language, Order } from '../types/database';

interface ProviderVisualSummaryProps {
  orders: Order[];
  lang: Language;
  onNavigateToMeals: () => void;
}

type EarningsRange = 'daily' | 'weekly';
type DishMetric = 'revenue' | 'qty';

interface EarningsPoint {
  key: string;
  label: string;
  earnings: number;
  ordersCount: number;
}

interface DishPoint {
  mealId: string;
  name: string;
  shortName: string;
  qty: number;
  revenue: number;
}

const DISH_COLORS = ['#0B3D2E', '#F7931E', '#A7C957', '#166B50', '#D9780F', '#6B8F35'];

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function truncateDishName(name: string, maxLen = 16): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export const ProviderVisualSummary: React.FC<ProviderVisualSummaryProps> = ({
  orders,
  lang,
  onNavigateToMeals,
}) => {
  const [earningsRange, setEarningsRange] = useState<EarningsRange>('daily');
  const [dishMetric, setDishMetric] = useState<DishMetric>('revenue');

  const validOrders = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled' && o.status !== 'rejected'),
    [orders]
  );

  // Daily earnings for the last 7 days + Today / 7-day totals
  const { dailySeries, todayEarnings, sevenDayEarnings } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayFormatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
    });

    const buckets: EarningsPoint[] = [];
    const bucketIndex = new Map<string, number>();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const dt = new Date(todayStart);
      dt.setDate(todayStart.getDate() - offset);
      const key = toLocalDateKey(dt);
      bucketIndex.set(key, buckets.length);
      buckets.push({
        key,
        label: dayFormatter.format(dt),
        earnings: 0,
        ordersCount: 0,
      });
    }

    validOrders.forEach((order) => {
      const parsed = new Date(order.created_at);
      if (Number.isNaN(parsed.getTime())) return;
      const key = toLocalDateKey(parsed);
      const idx = bucketIndex.get(key);
      if (idx !== undefined) {
        buckets[idx].earnings = Number(
          (buckets[idx].earnings + Number(order.subtotal_amount || 0)).toFixed(2)
        );
        buckets[idx].ordersCount += 1;
      }
    });

    const todayVal = buckets[buckets.length - 1]?.earnings ?? 0;
    const weekTotal = Number(buckets.reduce((s, b) => s + b.earnings, 0).toFixed(2));
    return {
      dailySeries: buckets,
      todayEarnings: todayVal,
      sevenDayEarnings: weekTotal,
    };
  }, [validOrders, lang]);

  // Weekly earnings for the last 6 rolling 7-day weeks
  const { weeklySeries, sixWeekEarnings } = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const shortFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });

    const weeks: Array<{ startMs: number; endMs: number; point: EarningsPoint }> = [];
    for (let w = 5; w >= 0; w -= 1) {
      const end = new Date(todayEnd);
      end.setDate(todayEnd.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      weeks.push({
        startMs: start.getTime(),
        endMs: end.getTime(),
        point: {
          key: `w_${w}`,
          label: `${shortFmt.format(start)} - ${shortFmt.format(end)}`,
          earnings: 0,
          ordersCount: 0,
        },
      });
    }

    validOrders.forEach((order) => {
      const ms = Date.parse(order.created_at);
      if (Number.isNaN(ms)) return;
      const match = weeks.find((wk) => ms >= wk.startMs && ms <= wk.endMs);
      if (match) {
        match.point.earnings = Number(
          (match.point.earnings + Number(order.subtotal_amount || 0)).toFixed(2)
        );
        match.point.ordersCount += 1;
      }
    });

    const series = weeks.map((w) => w.point);
    const total = Number(series.reduce((s, b) => s + b.earnings, 0).toFixed(2));
    return { weeklySeries: series, sixWeekEarnings: total };
  }, [validOrders, lang]);

  // Top-selling dishes aggregated strictly from real order items
  const topDishes = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    validOrders.forEach((order) => {
      order.items_summary.forEach((item) => {
        const current = map.get(item.meal_id) || {
          name: item.meal_name,
          qty: 0,
          revenue: 0,
        };
        map.set(item.meal_id, {
          name: item.meal_name || current.name,
          qty: current.qty + Number(item.quantity || 0),
          revenue: Number((current.revenue + Number(item.line_total || 0)).toFixed(2)),
        });
      });
    });

    const rows: DishPoint[] = Array.from(map.entries()).map(([mealId, info]) => ({
      mealId,
      name: info.name,
      shortName: truncateDishName(info.name, 15),
      qty: info.qty,
      revenue: info.revenue,
    }));

    rows.sort((a, b) => (dishMetric === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty));
    return rows.slice(0, 6);
  }, [validOrders, dishMetric]);

  const totalUnitsSold = useMemo(
    () => topDishes.reduce((acc, d) => acc + d.qty, 0),
    [topDishes]
  );

  const activeEarningsSeries = earningsRange === 'daily' ? dailySeries : weeklySeries;
  const hasAnyEarnings = activeEarningsSeries.some((p) => p.earnings > 0 || p.ordersCount > 0);

  return (
    <section
      aria-label={lang === 'ar' ? 'الملخص البصري للأرباح والمبيعات' : 'Visual Earnings & Sales Summary'}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* 1. Daily & Weekly Earnings Chart */}
      <div className="lg:col-span-7 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 flex flex-col justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4E6359]">
              <TrendingUp className="w-4 h-4 text-[#0B3D2E]" />
              <span>{lang === 'ar' ? 'تحليل الإيرادات' : 'Revenue Analytics'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {earningsRange === 'daily'
                  ? lang === 'ar'
                    ? 'آخر 7 أيام'
                    : 'Last 7 days'
                  : lang === 'ar'
                  ? 'آخر 6 أسابيع'
                  : 'Last 6 weeks'}
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'الأرباح اليومية والأسبوعية' : 'Daily & Weekly Earnings'}
            </h2>
          </div>

          <div
            role="tablist"
            aria-label={lang === 'ar' ? 'نطاق الأرباح' : 'Earnings period'}
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/12 self-start shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={earningsRange === 'daily'}
              onClick={() => setEarningsRange('daily')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                earningsRange === 'daily'
                  ? 'bg-[#0B3D2E] text-white'
                  : 'text-[#13221C]/75 hover:text-[#0B3D2E]'
              }`}
            >
              {lang === 'ar' ? 'يومي (7 أيام)' : 'Daily (7D)'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={earningsRange === 'weekly'}
              onClick={() => setEarningsRange('weekly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                earningsRange === 'weekly'
                  ? 'bg-[#0B3D2E] text-white'
                  : 'text-[#13221C]/75 hover:text-[#0B3D2E]'
              }`}
            >
              {lang === 'ar' ? 'أسبوعي (6 أسابيع)' : 'Weekly (6W)'}
            </button>
          </div>
        </div>

        {/* Period Highlight Strip */}
        <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-[#0B3D2E]/10 text-xs">
          <div>
            <div className="text-[#4E6359] font-semibold">
              {lang === 'ar' ? 'أرباح اليوم' : 'Today'}
            </div>
            <div className="text-xl font-extrabold text-[#0B3D2E] tabular-nums mt-0.5">
              {todayEarnings} {lang === 'ar' ? 'ج.م' : 'EGP'}
            </div>
          </div>
          <div className="h-8 w-px bg-[#0B3D2E]/12 hidden sm:block" aria-hidden="true" />
          <div>
            <div className="text-[#4E6359] font-semibold">
              {lang === 'ar' ? 'أرباح هذا الأسبوع' : 'Last 7 Days'}
            </div>
            <div className="text-xl font-extrabold text-[#13221C] tabular-nums mt-0.5">
              {sevenDayEarnings} {lang === 'ar' ? 'ج.م' : 'EGP'}
            </div>
          </div>
          <div className="h-8 w-px bg-[#0B3D2E]/12 hidden sm:block" aria-hidden="true" />
          <div>
            <div className="text-[#4E6359] font-semibold">
              {lang === 'ar' ? 'إجمالي آخر 6 أسابيع' : '6-Week Total'}
            </div>
            <div className="text-xl font-extrabold text-[#13221C] tabular-nums mt-0.5">
              {sixWeekEarnings} {lang === 'ar' ? 'ج.م' : 'EGP'}
            </div>
          </div>
        </div>

        {/* Recharts Area / Bar Visualization */}
        {!hasAnyEarnings ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center px-4">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF7E6] text-[#0B3D2E] flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-sm font-extrabold text-[#13221C]">
              {lang === 'ar' ? 'لم تحقق أي أرباح حتى الآن.' : 'No earnings recorded yet.'}
            </p>
            <p className="text-xs text-[#4E6359] mt-1 max-w-sm">
              {lang === 'ar'
                ? 'سيعرض المخطط أرباحك اليومية والأسبوعية تلقائياً بمجرد استقبال الطلبات.'
                : 'Your daily and weekly earnings chart will populate automatically as orders arrive.'}
            </p>
          </div>
        ) : (
          <div dir="ltr" className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              {earningsRange === 'daily' ? (
                <AreaChart
                  data={dailySeries}
                  margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="lokmaEarningsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0B3D2E" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#0B3D2E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0B3D2E" strokeOpacity={0.1} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#4E6359', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4E6359', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0].payload as EarningsPoint;
                      return (
                        <div
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          className="bg-white border border-[#0B3D2E]/18 rounded-2xl px-3.5 py-2.5 shadow-md text-xs space-y-1"
                        >
                          <div className="font-bold text-[#4E6359]">{pt.label}</div>
                          <div className="font-extrabold text-[#0B3D2E] tabular-nums">
                            {pt.earnings} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </div>
                          <div className="text-[#13221C] tabular-nums">
                            {pt.ordersCount} {lang === 'ar' ? 'طلبات' : 'orders'}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="#0B3D2E"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#lokmaEarningsGrad)"
                    activeDot={{ r: 5, fill: '#F7931E', stroke: '#0B3D2E', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={weeklySeries}
                  margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#0B3D2E" strokeOpacity={0.1} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#4E6359', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4E6359', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                  />
                  <Tooltip
                    cursor={{ fill: '#FFF7E6', opacity: 0.7 }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0].payload as EarningsPoint;
                      return (
                        <div
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          className="bg-white border border-[#0B3D2E]/18 rounded-2xl px-3.5 py-2.5 shadow-md text-xs space-y-1"
                        >
                          <div className="font-bold text-[#4E6359]">{pt.label}</div>
                          <div className="font-extrabold text-[#0B3D2E] tabular-nums">
                            {pt.earnings} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </div>
                          <div className="text-[#13221C] tabular-nums">
                            {pt.ordersCount} {lang === 'ar' ? 'طلبات' : 'orders'}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="earnings" radius={[8, 8, 0, 0]} maxBarSize={42}>
                    {weeklySeries.map((entry, idx) => (
                      <Cell
                        key={entry.key}
                        fill={idx === weeklySeries.length - 1 ? '#0B3D2E' : '#F7931E'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Top-Selling Dishes Chart */}
      <div className="lg:col-span-5 bg-white rounded-3xl border border-[#0B3D2E]/12 p-6 flex flex-col justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4E6359]">
              <UtensilsCrossed className="w-4 h-4 text-[#E97858]" />
              <span>{lang === 'ar' ? 'ترتيب القائمة' : 'Menu Performance'}</span>
              {totalUnitsSold > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {totalUnitsSold} {lang === 'ar' ? 'وحدة مباعة' : 'units'}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-lg font-extrabold text-[#0B3D2E]">
              {lang === 'ar' ? 'الأطباق الأكثر مبيعاً' : 'Top-Selling Dishes'}
            </h2>
          </div>

          <div
            role="tablist"
            aria-label={lang === 'ar' ? 'مقياس ترتيب الأطباق' : 'Dish metric'}
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/12 self-start shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={dishMetric === 'revenue'}
              onClick={() => setDishMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                dishMetric === 'revenue'
                  ? 'bg-[#0B3D2E] text-white'
                  : 'text-[#13221C]/75 hover:text-[#0B3D2E]'
              }`}
            >
              {lang === 'ar' ? 'بالإيرادات' : 'Revenue'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dishMetric === 'qty'}
              onClick={() => setDishMetric('qty')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                dishMetric === 'qty'
                  ? 'bg-[#0B3D2E] text-white'
                  : 'text-[#13221C]/75 hover:text-[#0B3D2E]'
              }`}
            >
              {lang === 'ar' ? 'بالكمية' : 'Units'}
            </button>
          </div>
        </div>

        {topDishes.length === 0 ? (
          <div className="h-[310px] flex flex-col items-center justify-center text-center px-4 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF7E6] text-[#E97858] flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#13221C]">
                {lang === 'ar' ? 'لا توجد مبيعات أطباق حتى الآن.' : 'No dish sales recorded yet.'}
              </p>
              <p className="text-xs text-[#4E6359] mt-1">
                {lang === 'ar'
                  ? 'أضف وجباتك البيتي لتظهر هنا أكثر الأطباق طلباً من الطلبة.'
                  : 'Publish homemade dishes to track your best-selling items here.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToMeals}
              className="px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
            >
              {lang === 'ar' ? 'إدارة وجبات المطبخ' : 'Manage Kitchen Meals'}
            </button>
          </div>
        ) : (
          <div dir="ltr" className="w-full h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topDishes}
                layout="vertical"
                margin={{ top: 6, right: 18, left: 8, bottom: 6 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0B3D2E" strokeOpacity={0.1} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#4E6359', fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={108}
                  tick={{ fill: '#13221C', fontSize: 11, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#FFF7E6', opacity: 0.7 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pt = payload[0].payload as DishPoint;
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="bg-white border border-[#0B3D2E]/18 rounded-2xl px-3.5 py-2.5 shadow-md text-xs space-y-1 max-w-[220px]"
                      >
                        <div className="font-extrabold text-[#13221C]">{pt.name}</div>
                        <div className="font-extrabold text-[#0B3D2E] tabular-nums">
                          {pt.revenue} {lang === 'ar' ? 'ج.م' : 'EGP'}
                        </div>
                        <div className="text-[#4E6359] tabular-nums">
                          {pt.qty} {lang === 'ar' ? 'وجبة مباعة' : 'units sold'}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={dishMetric}
                  radius={[0, 8, 8, 0]}
                  barSize={24}
                >
                  {topDishes.map((entry, idx) => (
                    <Cell key={entry.mealId} fill={DISH_COLORS[idx % DISH_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
};
