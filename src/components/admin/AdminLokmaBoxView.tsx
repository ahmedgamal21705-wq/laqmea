import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  GraduationCap,
  HeartHandshake,
  MessageSquareText,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';
import {
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
import {
  Language,
  LokmaBoxBudgetTier,
  LokmaBoxLead,
  LokmaBoxSurvey,
  LokmaBoxWillingnessToBuy,
} from '../../types/database';
import {
  BOX_TIMING_OPTIONS,
  BUDGET_TIER_OPTIONS,
  computeLokmaBoxAnalytics,
  exportLokmaBoxLeadsCsv,
  exportLokmaBoxResearchExcel,
  exportLokmaBoxSurveysCsv,
  FOOD_PROBLEM_OPTIONS,
  getOptionLabel,
  MEAL_TYPE_OPTIONS,
  PREP_DIFFICULTY_OPTIONS,
  PREP_TIME_OPTIONS,
  PURCHASE_FREQUENCY_OPTIONS,
  WANTS_TO_TRY_OPTIONS,
  WILLINGNESS_OPTIONS,
} from '../../utils/lokmaBox';

interface AdminLokmaBoxViewProps {
  leads: LokmaBoxLead[];
  surveys: LokmaBoxSurvey[];
  lang: Language;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const PAGE_SIZE = 10;
const BAR_PALETTE = ['#0B3D2E', '#F7931E', '#A7C957', '#166B50', '#C26906', '#4E6359'];
const WILLINGNESS_COLORS: Record<string, string> = {
  yes: '#166B50',
  maybe: '#F7931E',
  no: '#B43C25',
};

export const AdminLokmaBoxView: React.FC<AdminLokmaBoxViewProps> = ({
  leads,
  surveys,
  lang,
  loading = false,
  error = null,
  onRetry,
}) => {
  const [subTab, setSubTab] = useState<'analytics' | 'leads' | 'surveys'>('analytics');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadUniFilter, setLeadUniFilter] = useState('all');
  const [leadPage, setLeadPage] = useState(1);

  const [surveySearch, setSurveySearch] = useState('');
  const [surveyWillingFilter, setSurveyWillingFilter] = useState<'all' | LokmaBoxWillingnessToBuy>('all');
  const [surveyBudgetFilter, setSurveyBudgetFilter] = useState<'all' | LokmaBoxBudgetTier>('all');
  const [surveyPage, setSurveyPage] = useState(1);

  const analytics = useMemo(
    () => computeLokmaBoxAnalytics(leads, surveys, lang),
    [leads, surveys, lang]
  );

  const uniqueUniversities = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.university_name.trim()) set.add(l.university_name.trim());
    });
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadUniFilter !== 'all' && l.university_name.trim() !== leadUniFilter) return false;
      if (q) {
        const hay = `${l.full_name} ${l.phone} ${l.email || ''} ${l.university_name} ${l.housing_area}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, leadSearch, leadUniFilter]);

  const totalLeadPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const paginatedLeads = useMemo(() => {
    const safePage = Math.min(leadPage, totalLeadPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, leadPage, totalLeadPages]);

  const filteredSurveys = useMemo(() => {
    const q = surveySearch.trim().toLowerCase();
    return surveys.filter((s) => {
      if (surveyWillingFilter !== 'all' && s.willing_to_buy !== surveyWillingFilter) return false;
      if (surveyBudgetFilter !== 'all' && s.preferred_budget_tier !== surveyBudgetFilter) return false;
      if (q) {
        const hay = `${s.suggestions} ${s.university_name || ''} ${getOptionLabel(
          FOOD_PROBLEM_OPTIONS,
          s.biggest_food_problem,
          lang
        )}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [surveys, surveySearch, surveyWillingFilter, surveyBudgetFilter, lang]);

  const totalSurveyPages = Math.max(1, Math.ceil(filteredSurveys.length / PAGE_SIZE));
  const paginatedSurveys = useMemo(() => {
    const safePage = Math.min(surveyPage, totalSurveyPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSurveys.slice(start, start + PAGE_SIZE);
  }, [filteredSurveys, surveyPage, totalSurveyPages]);

  const hasAnyData = leads.length > 0 || surveys.length > 0;

  return (
    <div className="space-y-6">
      {/* Header & Export Toolbar */}
      <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#C26906]">
            <Package className="w-3.5 h-3.5 text-[#F7931E]" />
            <span>LOKMA BOX MARKET RESEARCH</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B3D2E]">
            {lang === 'ar'
              ? 'أبحاث السوق واهتمامات الطلاب — LOKMA BOX'
              : 'LOKMA BOX Pre-Launch Market Research'}
          </h1>
          <p className="text-xs text-[#4E6359]">
            {lang === 'ar'
              ? 'بيانات حقيقية ومباشرة من الطلاب المهتمين ونتائج الاستبيان التفاعلي قبل الإطلاق'
              : 'Live pre-launch student demand leads and survey insights stored in Firestore'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!hasAnyData}
            onClick={() => exportLokmaBoxResearchExcel(leads, surveys, lang)}
            className="inline-flex items-center gap-1.5 px-4 min-h-[42px] rounded-xl bg-[#0B3D2E] hover:bg-[#072B20] disabled:opacity-45 text-[#FFF7E6] text-xs font-extrabold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#A7C957]" />
            <span>{lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            disabled={leads.length === 0}
            onClick={() => exportLokmaBoxLeadsCsv(leads, lang)}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/18 hover:border-[#F7931E] disabled:opacity-45 text-[#0B3D2E] text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'CSV المهتمين' : 'Leads CSV'}</span>
          </button>

          <button
            type="button"
            disabled={surveys.length === 0}
            onClick={() => exportLokmaBoxSurveysCsv(surveys, lang)}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-[#FFF7E6] border border-[#0B3D2E]/18 hover:border-[#F7931E] disabled:opacity-45 text-[#0B3D2E] text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'CSV الاستبيان' : 'Surveys CSV'}</span>
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-[#0B3D2E]/20 bg-white text-[#0B3D2E] text-xs font-bold hover:bg-[#FFF7E6] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync / Rules Error Alert */}
      {error && (
        <div className="bg-white rounded-3xl border border-[#B43C25]/30 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-bold text-[#B43C25]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B3D2E] text-white text-xs font-bold hover:bg-[#072B20] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          )}
        </div>
      )}

      {/* 5 Core Validation KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'عدد الطلاب المهتمين' : 'Interested Students'}
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#F7931E]/18 text-[#9A5304] flex items-center justify-center shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-[#0B3D2E] tabular-nums">
              {analytics.totalLeads}
            </div>
            <p className="text-[10px] font-bold text-[#4E6359] mt-0.5 tabular-nums">
              {lang === 'ar'
                ? `${analytics.wantsToTryYesCount} يرغب بالتجربة فوراً`
                : `${analytics.wantsToTryYesCount} eager at launch`}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'الاستبيانات المكتملة' : 'Completed Surveys'}
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#0B3D2E]/10 text-[#0B3D2E] flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-[#0B3D2E] tabular-nums">
              {analytics.totalSurveys}
            </div>
            <p className="text-[10px] font-bold text-[#4E6359] mt-0.5 tabular-nums">
              {lang === 'ar'
                ? `${surveys.filter((s) => s.suggestions.trim().length > 0).length} استبيان يتضمن اقتراحاً`
                : `${surveys.filter((s) => s.suggestions.trim().length > 0).length} with written suggestions`}
            </p>
          </div>
        </div>

        <div className="bg-[#0B3D2E] text-[#FFF7E6] rounded-2xl border border-[#0B3D2E] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#FFF7E6]/85">
              {lang === 'ar' ? 'مستعدون للشراء فعلياً' : 'Willing to Buy'}
            </span>
            <span className="w-8 h-8 rounded-xl bg-white/15 text-[#A7C957] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black tabular-nums">
              {analytics.willingToBuyYesCount}{' '}
              <span className="text-xs font-extrabold text-[#A7C957]">
                ({analytics.willingToBuyYesPct}%)
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#FFF7E6]/80 mt-0.5 tabular-nums">
              {lang === 'ar'
                ? `و ${analytics.willingToBuyMaybeCount} أجابوا "ربما"`
                : `+ ${analytics.willingToBuyMaybeCount} answered "Maybe"`}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'الميزانية المفضلة' : 'Preferred Budget'}
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#A7C957]/25 text-[#0B3D2E] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-[#0B3D2E] leading-snug">
              {analytics.topBudgetTier}
            </div>
            <p className="text-[10px] font-bold text-[#4E6359] mt-0.5">
              {lang === 'ar' ? 'الفئة السعرية الأعلى طلباً' : 'Most requested price tier'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#0B3D2E]/12 p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#4E6359]">
              {lang === 'ar' ? 'أعلى مشكلة غذائية' : 'Top Food Challenge'}
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#FBF0D9] text-[#0B3D2E] flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black text-[#0B3D2E] line-clamp-2 leading-snug">
              {analytics.topFoodProblem}
            </div>
            <p className="text-[10px] font-bold text-[#4E6359] mt-0.5 truncate">
              {analytics.topUniversity !== '—'
                ? `${lang === 'ar' ? 'أعلى جامعة:' : 'Top uni:'} ${analytics.topUniversity}`
                : lang === 'ar'
                ? 'من ردود الاستبيان'
                : 'From student survey'}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            id: 'analytics' as const,
            ar: 'الرسوم البيانية والتحليلات',
            en: 'Analytics & Charts',
            icon: BarChart3,
          },
          {
            id: 'leads' as const,
            ar: `الطلاب المهتمون (${leads.length})`,
            en: `Interested Students (${leads.length})`,
            icon: Users,
          },
          {
            id: 'surveys' as const,
            ar: `ردود الاستبيان والمقترحات (${surveys.length})`,
            en: `Survey Responses (${surveys.length})`,
            icon: MessageSquareText,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0B3D2E] text-white'
                  : 'bg-white border border-[#0B3D2E]/15 text-[#0B3D2E] hover:bg-[#FFF7E6]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{lang === 'ar' ? tab.ar : tab.en}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================
          TAB 1: ANALYTICS & CHARTS
         ============================================================ */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          {!hasAnyData ? (
            <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF7E6] border border-[#0B3D2E]/12 flex items-center justify-center mx-auto text-[#0B3D2E]">
                <Package className="w-6 h-6 text-[#F7931E]" />
              </div>
              <h2 className="text-base font-black text-[#0B3D2E]">
                {lang === 'ar'
                  ? 'لا توجد بيانات أبحاث سوق مسجلة بعد'
                  : 'No Market Research Submissions Yet'}
              </h2>
              <p className="text-xs text-[#4E6359] max-w-md mx-auto leading-relaxed">
                {lang === 'ar'
                  ? 'بمجرد تسجيل الطلاب في نموذج "أنا مهتم بالتجربة" أو إرسال استبيان "شاركنا رأيك" في الصفحة الرئيسية، ستظهر الإحصائيات والرسوم البيانية هنا مباشرةً بدون أي بيانات تجريبية.'
                  : 'As soon as students submit the interest form or feedback survey on the homepage, real charts and insights will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. University Distribution */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#0B3D2E]">
                      {lang === 'ar' ? 'توزيع الطلاب حسب الجامعات' : 'University Distribution'}
                    </h3>
                    <p className="text-[11px] text-[#4E6359]">
                      {lang === 'ar'
                        ? 'بناءً على تسجيلات الطلاب المهتمين بالتجربة'
                        : 'Based on submitted student leads'}
                    </p>
                  </div>
                  <GraduationCap className="w-5 h-5 text-[#F7931E]" />
                </div>

                {analytics.universityDistribution.length === 0 ? (
                  <p className="text-xs font-bold text-[#4E6359] py-8 text-center">
                    {lang === 'ar'
                      ? 'لا توجد تسجيلات مهتمين لتوزيع الجامعات بعد.'
                      : 'No student leads recorded yet.'}
                  </p>
                ) : (
                  <div className="h-[240px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.universityDistribution.slice(0, 8)}
                        margin={{ top: 10, right: 12, left: 0, bottom: 24 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8DFC9" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#13221C' }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4E6359' }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#0B3D2E" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* 2. Preferred Budget Tiers */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#0B3D2E]">
                      {lang === 'ar' ? 'الميزانية السعرية المفضلة' : 'Preferred Budget Tiers'}
                    </h3>
                    <p className="text-[11px] text-[#4E6359]">
                      {lang === 'ar'
                        ? 'الفئة السعرية الأنسب للصندوق وفق إجابات الطلاب'
                        : 'Student preferred price tier per box'}
                    </p>
                  </div>
                  <Wallet className="w-5 h-5 text-[#F7931E]" />
                </div>

                {surveys.length === 0 ? (
                  <p className="text-xs font-bold text-[#4E6359] py-8 text-center">
                    {lang === 'ar'
                      ? 'لا توجد ردود استبيان لعرض توزيع الميزانية.'
                      : 'No survey responses yet.'}
                  </p>
                ) : (
                  <div className="h-[240px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.budgetDistribution}
                        margin={{ top: 10, right: 12, left: 0, bottom: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8DFC9" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#13221C' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4E6359' }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                          {analytics.budgetDistribution.map((entry, idx) => (
                            <Cell
                              key={entry.key}
                              fill={BAR_PALETTE[idx % BAR_PALETTE.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* 3. Most Common Food Problems */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0B3D2E]">
                    {lang === 'ar'
                      ? 'أكثر المشكلات الغذائية شيوعاً'
                      : 'Most Common Food Challenges'}
                  </h3>
                  <p className="text-[11px] text-[#4E6359]">
                    {lang === 'ar'
                      ? 'أبرز التحديات التي يواجهها الطلاب في توفير الطعام'
                      : 'Primary hurdles students reported'}
                  </p>
                </div>

                {surveys.length === 0 ? (
                  <p className="text-xs font-bold text-[#4E6359] py-8 text-center">
                    {lang === 'ar' ? 'بانتظار مشاركات الاستبيان.' : 'Waiting for survey responses.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.foodProblemsDistribution.map((item, idx) => (
                      <div key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#13221C]">
                          <span className="truncate">{item.label}</span>
                          <span className="tabular-nums text-[#0B3D2E] shrink-0">
                            {item.count} ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[#FFF7E6] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(item.count > 0 ? 6 : 0, item.pct)}%`,
                              backgroundColor: BAR_PALETTE[idx % BAR_PALETTE.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Most Requested Meal Types */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0B3D2E]">
                    {lang === 'ar' ? 'أنواع الوجبات الأكثر طلباً' : 'Most Requested Meal Types'}
                  </h3>
                  <p className="text-[11px] text-[#4E6359]">
                    {lang === 'ar'
                      ? 'الوجبات التي يفضل الطلاب وجودها داخل LOKMA BOX'
                      : 'Meal kit styles selected by students'}
                  </p>
                </div>

                {surveys.length === 0 ? (
                  <p className="text-xs font-bold text-[#4E6359] py-8 text-center">
                    {lang === 'ar' ? 'بانتظار مشاركات الاستبيان.' : 'Waiting for survey responses.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.mealTypesDistribution.map((item, idx) => (
                      <div key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#13221C]">
                          <span className="truncate">{item.label}</span>
                          <span className="tabular-nums text-[#0B3D2E] shrink-0">
                            {item.count} ({item.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[#FFF7E6] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(item.count > 0 ? 6 : 0, item.pct)}%`,
                              backgroundColor: BAR_PALETTE[(idx + 1) % BAR_PALETTE.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Willingness to Buy Pie + Secondary Survey Distributions */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0B3D2E]">
                    {lang === 'ar'
                      ? 'الاستعداد الفعلي للشراء عند الإطلاق'
                      : 'Purchase Intent Breakdown'}
                  </h3>
                  <p className="text-[11px] text-[#4E6359]">
                    {lang === 'ar'
                      ? 'إجابات سؤال: هل ستشتري المنتج فعلياً بالسعر المناسب؟'
                      : 'Responses to real purchase intent'}
                  </p>
                </div>

                {surveys.length === 0 ? (
                  <p className="text-xs font-bold text-[#4E6359] py-8 text-center">
                    {lang === 'ar' ? 'بانتظار مشاركات الاستبيان.' : 'Waiting for survey responses.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="h-[200px] w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.willingnessDistribution.filter((d) => d.count > 0)}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={76}
                            paddingAngle={3}
                          >
                            {analytics.willingnessDistribution
                              .filter((d) => d.count > 0)
                              .map((entry) => (
                                <Cell
                                  key={entry.key}
                                  fill={WILLINGNESS_COLORS[entry.key] || '#0B3D2E'}
                                />
                              ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2.5">
                      {analytics.willingnessDistribution.map((item) => (
                        <div
                          key={item.key}
                          className="p-2.5 rounded-xl bg-[#FFF7E6]/75 border border-[#0B3D2E]/10 flex items-center justify-between gap-2 text-xs font-bold"
                        >
                          <span className="inline-flex items-center gap-2 text-[#13221C]">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: WILLINGNESS_COLORS[item.key] || '#0B3D2E' }}
                            />
                            <span className="truncate max-w-[160px]">{item.label}</span>
                          </span>
                          <span className="tabular-nums text-[#0B3D2E] font-black shrink-0">
                            {item.count} ({item.pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Box Timing, Prep Time & Purchase Frequency Summary */}
              <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0B3D2E]">
                    {lang === 'ar'
                      ? 'التوقيت ووقت التحضير وتكرار الشراء'
                      : 'Box Timing, Prep Time & Frequency'}
                  </h3>
                  <p className="text-[11px] text-[#4E6359]">
                    {lang === 'ar'
                      ? 'تفضيلات الاستخدام العملي اليومية للطلاب'
                      : 'Operational preferences for box design'}
                  </p>
                </div>

                {surveys.length === 0 ? (
                  <p className="text-xs font-bold text-[#4E6359] py-8 text-center">
                    {lang === 'ar' ? 'بانتظار مشاركات الاستبيان.' : 'Waiting for survey responses.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 space-y-2">
                      <div className="font-black text-[#0B3D2E]">
                        {lang === 'ar' ? 'توقيت الصندوق' : 'Box Timing'}
                      </div>
                      {analytics.timingDistribution.map((item) => (
                        <div key={item.key} className="flex justify-between gap-1 text-[11px]">
                          <span className="text-[#4E6359] truncate">{item.label}</span>
                          <span className="font-extrabold text-[#0B3D2E] tabular-nums shrink-0">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 space-y-2">
                      <div className="font-black text-[#0B3D2E]">
                        {lang === 'ar' ? 'وقت التحضير' : 'Prep Time'}
                      </div>
                      {analytics.prepTimeDistribution.map((item) => (
                        <div key={item.key} className="flex justify-between gap-1 text-[11px]">
                          <span className="text-[#4E6359] truncate">{item.label}</span>
                          <span className="font-extrabold text-[#0B3D2E] tabular-nums shrink-0">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/10 space-y-2">
                      <div className="font-black text-[#0B3D2E]">
                        {lang === 'ar' ? 'تكرار الشراء' : 'Frequency'}
                      </div>
                      {analytics.frequencyDistribution.map((item) => (
                        <div key={item.key} className="flex justify-between gap-1 text-[11px]">
                          <span className="text-[#4E6359] truncate">{item.label}</span>
                          <span className="font-extrabold text-[#0B3D2E] tabular-nums shrink-0">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: INTERESTED STUDENTS LEADS LIST
         ============================================================ */}
      {subTab === 'leads' && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 sm:max-w-sm">
              <Search
                className={`w-4 h-4 text-[#4E6359] absolute top-3 ${
                  lang === 'ar' ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => {
                  setLeadSearch(e.target.value);
                  setLeadPage(1);
                }}
                placeholder={
                  lang === 'ar'
                    ? 'بحث بالاسم، الهاتف، الجامعة أو السكن...'
                    : 'Search name, phone, university, area...'
                }
                className={`w-full py-2.5 min-h-[42px] rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                  lang === 'ar' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                }`}
              />
            </div>

            <select
              value={leadUniFilter}
              onChange={(e) => {
                setLeadUniFilter(e.target.value);
                setLeadPage(1);
              }}
              className="px-3.5 py-2.5 min-h-[42px] rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs font-bold text-[#0B3D2E]"
            >
              <option value="all">{lang === 'ar' ? 'كل الجامعات' : 'All Universities'}</option>
              {uniqueUniversities.map((uni) => (
                <option key={uni} value={uni}>
                  {uni}
                </option>
              ))}
            </select>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="rounded-2xl bg-[#FFF7E6]/60 p-8 text-center text-xs font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'لا توجد تسجيلات مطابقة للبحث حالياً.'
                : 'No matching interested student leads.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#0B3D2E]/10 text-[11px] font-extrabold text-[#4E6359]">
                      <th className="py-2.5 px-2.5 text-start">
                        {lang === 'ar' ? 'الاسم' : 'Name'}
                      </th>
                      <th className="py-2.5 px-2.5 text-start">
                        {lang === 'ar' ? 'الهاتف' : 'Phone'}
                      </th>
                      <th className="py-2.5 px-2.5 text-start">
                        {lang === 'ar' ? 'الجامعة' : 'University'}
                      </th>
                      <th className="py-2.5 px-2.5 text-start">
                        {lang === 'ar' ? 'المنطقة / السكن' : 'Area'}
                      </th>
                      <th className="py-2.5 px-2.5 text-start">
                        {lang === 'ar' ? 'الرغبة في التجربة' : 'Interest'}
                      </th>
                      <th className="py-2.5 px-2.5 text-start">
                        {lang === 'ar' ? 'تاريخ التسجيل' : 'Date'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0B3D2E]/8">
                    {paginatedLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-[#FFF7E6]/40">
                        <td className="py-3 px-2.5">
                          <div className="font-extrabold text-[#13221C]">{lead.full_name}</div>
                          {lead.email && (
                            <div className="text-[11px] text-[#4E6359]" dir="ltr">
                              {lead.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2.5 font-bold tabular-nums text-[#0B3D2E]" dir="ltr">
                          {lead.phone}
                        </td>
                        <td className="py-3 px-2.5 font-bold text-[#13221C]">
                          {lead.university_name}
                        </td>
                        <td className="py-3 px-2.5 text-[#4E6359]">{lead.housing_area}</td>
                        <td className="py-3 px-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                              lead.wants_to_try === 'yes'
                                ? 'bg-[#A7C957]/25 text-[#0B3D2E]'
                                : lead.wants_to_try === 'maybe'
                                ? 'bg-[#F7931E]/20 text-[#9A5304]'
                                : 'bg-[#0B3D2E]/10 text-[#4E6359]'
                            }`}
                          >
                            {lead.wants_to_try === 'yes' && <CheckCircle2 className="w-3 h-3" />}
                            <span>{getOptionLabel(WANTS_TO_TRY_OPTIONS, lead.wants_to_try, lang)}</span>
                          </span>
                        </td>
                        <td className="py-3 px-2.5 text-[11px] text-[#4E6359] tabular-nums whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleString(
                            lang === 'ar' ? 'ar-EG' : 'en-US',
                            { dateStyle: 'short', timeStyle: 'short' }
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalLeadPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#4E6359] tabular-nums">
                  <span>
                    {lang === 'ar'
                      ? `صفحة ${leadPage} من ${totalLeadPages}`
                      : `Page ${leadPage} of ${totalLeadPages}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={leadPage <= 1}
                      onClick={() => setLeadPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/15 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={leadPage >= totalLeadPages}
                      onClick={() => setLeadPage((p) => Math.min(totalLeadPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/15 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'ar' ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 3: SURVEY RESPONSES & SUGGESTIONS
         ============================================================ */}
      {subTab === 'surveys' && (
        <div className="bg-white rounded-3xl border border-[#0B3D2E]/12 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 md:max-w-sm">
              <Search
                className={`w-4 h-4 text-[#4E6359] absolute top-3 ${
                  lang === 'ar' ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="text"
                value={surveySearch}
                onChange={(e) => {
                  setSurveySearch(e.target.value);
                  setSurveyPage(1);
                }}
                placeholder={
                  lang === 'ar'
                    ? 'بحث في المقترحات أو المشكلة أو الجامعة...'
                    : 'Search suggestions, problem, university...'
                }
                className={`w-full py-2.5 min-h-[42px] rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs text-[#13221C] focus:outline-none focus:border-[#F7931E] ${
                  lang === 'ar' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={surveyWillingFilter}
                onChange={(e) => {
                  setSurveyWillingFilter(e.target.value as 'all' | LokmaBoxWillingnessToBuy);
                  setSurveyPage(1);
                }}
                className="px-3 py-2 min-h-[42px] rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs font-bold text-[#0B3D2E]"
              >
                <option value="all">{lang === 'ar' ? 'كل نيات الشراء' : 'All Purchase Intent'}</option>
                {WILLINGNESS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {lang === 'ar' ? o.ar : o.en}
                  </option>
                ))}
              </select>

              <select
                value={surveyBudgetFilter}
                onChange={(e) => {
                  setSurveyBudgetFilter(e.target.value as 'all' | LokmaBoxBudgetTier);
                  setSurveyPage(1);
                }}
                className="px-3 py-2 min-h-[42px] rounded-xl bg-[#FFF7E6]/70 border border-[#0B3D2E]/15 text-xs font-bold text-[#0B3D2E]"
              >
                <option value="all">{lang === 'ar' ? 'كل الميزانيات' : 'All Budget Tiers'}</option>
                {BUDGET_TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {lang === 'ar' ? o.ar : o.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredSurveys.length === 0 ? (
            <div className="rounded-2xl bg-[#FFF7E6]/60 p-8 text-center text-xs font-bold text-[#4E6359]">
              {lang === 'ar'
                ? 'لا توجد مشاركات استبيان مطابقة للبحث حالياً.'
                : 'No matching survey responses.'}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedSurveys.map((s) => (
                  <article
                    key={s.id}
                    className="rounded-2xl border border-[#0B3D2E]/12 bg-[#FFF7E6]/35 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                        <span
                          className={`px-2.5 py-1 rounded-lg ${
                            s.willing_to_buy === 'yes'
                              ? 'bg-[#166B50] text-white'
                              : s.willing_to_buy === 'maybe'
                              ? 'bg-[#F7931E]/25 text-[#9A5304]'
                              : 'bg-[#B43C25]/15 text-[#B43C25]'
                          }`}
                        >
                          {getOptionLabel(WILLINGNESS_OPTIONS, s.willing_to_buy, lang)}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-[#0B3D2E]/12 text-[#0B3D2E]">
                          {getOptionLabel(BUDGET_TIER_OPTIONS, s.preferred_budget_tier, lang)}
                        </span>
                        {s.university_name && (
                          <span className="text-[#4E6359]">{s.university_name}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#4E6359] tabular-nums">
                        {new Date(s.created_at).toLocaleString(
                          lang === 'ar' ? 'ar-EG' : 'en-US',
                          { dateStyle: 'short', timeStyle: 'short' }
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
                      <div>
                        <span className="font-bold text-[#4E6359]">
                          {lang === 'ar' ? 'صعوبة التحضير: ' : 'Prep difficulty: '}
                        </span>
                        <span className="font-extrabold text-[#13221C]">
                          {getOptionLabel(PREP_DIFFICULTY_OPTIONS, s.daily_prep_difficulty, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#4E6359]">
                          {lang === 'ar' ? 'المشكلة الأكبر: ' : 'Top problem: '}
                        </span>
                        <span className="font-extrabold text-[#13221C]">
                          {getOptionLabel(FOOD_PROBLEM_OPTIONS, s.biggest_food_problem, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#4E6359]">
                          {lang === 'ar' ? 'وقت التحضير: ' : 'Prep time: '}
                        </span>
                        <span className="font-extrabold text-[#13221C]">
                          {getOptionLabel(PREP_TIME_OPTIONS, s.preferred_prep_time, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#4E6359]">
                          {lang === 'ar' ? 'تكرار الشراء: ' : 'Frequency: '}
                        </span>
                        <span className="font-extrabold text-[#13221C]">
                          {getOptionLabel(PURCHASE_FREQUENCY_OPTIONS, s.purchase_frequency, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#4E6359]">
                          {lang === 'ar' ? 'التوقيت: ' : 'Timing: '}
                        </span>
                        <span className="font-extrabold text-[#13221C]">
                          {getOptionLabel(BOX_TIMING_OPTIONS, s.preferred_box_timing, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#4E6359]">
                          {lang === 'ar' ? 'الوجبات: ' : 'Meals: '}
                        </span>
                        <span className="font-extrabold text-[#0B3D2E]">
                          {s.preferred_meal_types
                            .map((mt) => getOptionLabel(MEAL_TYPE_OPTIONS, mt, lang))
                            .join(' · ')}
                        </span>
                      </div>
                    </div>

                    {s.suggestions.trim() && (
                      <div className="rounded-xl bg-white border border-[#0B3D2E]/10 p-3 text-xs text-[#13221C]">
                        <span className="font-black text-[#0B3D2E]">
                          {lang === 'ar' ? 'اقتراح الطالب: ' : 'Suggestion: '}
                        </span>
                        <span className="leading-relaxed">{s.suggestions}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {totalSurveyPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#4E6359] tabular-nums">
                  <span>
                    {lang === 'ar'
                      ? `صفحة ${surveyPage} من ${totalSurveyPages}`
                      : `Page ${surveyPage} of ${totalSurveyPages}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={surveyPage <= 1}
                      onClick={() => setSurveyPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/15 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={surveyPage >= totalSurveyPages}
                      onClick={() => setSurveyPage((p) => Math.min(totalSurveyPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-[#0B3D2E]/15 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'ar' ? 'التالي' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
