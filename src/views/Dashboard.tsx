'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CreditCard,
  Dumbbell,
  FileText,
  IndianRupee,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Snowflake,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { getMembers, type Member } from '../services/members';
import { getPayments, type Payment } from '../services/payments';

const DAY_MS = 86_400_000;

const money = (value: unknown) => Math.max(0, Number(value) || 0);

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(money(value));

const parseDateOnly = (value: string): Date | null => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const display = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (display) {
    const parsed = new Date(Number(display[3]), Number(display[2]) - 1, Number(display[1]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const createdAtDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const memberStatusStyle = (status: Member['status']) => {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Expiring') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Expired') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Frozen') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
};

const paymentStatusStyle = (status: Payment['status']) => {
  if (status === 'Paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Partial') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

const Avatar = ({ url, name, size = 'normal' }: { url?: string | null; name: string; size?: 'normal' | 'large' }) => {
  const dimensions = size === 'large' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  if (url) {
    return <img src={url} alt={name} className={`${dimensions} shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm`} />;
  }
  return (
    <div className={`${dimensions} flex shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 font-bold text-blue-700 shadow-sm`}>
      {(name.trim().charAt(0) || 'M').toUpperCase()}
    </div>
  );
};

type StatCardData = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClass: string;
  iconBackground: string;
  route: string;
};

const StatCard = ({ card, onOpen }: { card: StatCardData; onOpen: (route: string) => void }) => (
  <button
    type="button"
    onClick={() => onOpen(card.route)}
    className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 sm:p-5"
  >
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm">{card.label}</p>
      <span className={`rounded-xl p-2.5 ${card.iconBackground} ${card.iconClass}`}>
        <card.icon className="h-5 w-5" />
      </span>
    </div>
    <p className="mt-3 truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{card.value}</p>
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="truncate text-xs text-slate-500">{card.detail}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
    </div>
  </button>
);

export const Dashboard: React.FC = () => {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshRequest, setRefreshRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (refreshRequest > 0) setRefreshing(true);
      try {
        setLoadError('');
        const [membersData, paymentsData] = await Promise.all([getMembers(), getPayments()]);
        if (!cancelled) {
          setMembers(membersData);
          setPayments(paymentsData);
        }
      } catch (error) {
        console.error('Error loading dashboard data', error);
        if (!cancelled) setLoadError('Dashboard data could not be loaded. Check your connection and try again.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [refreshRequest]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Preparing your gym overview...</p>
      </div>
    );
  }

  if (loadError && members.length === 0 && payments.length === 0) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <span className="rounded-2xl bg-red-50 p-4 text-red-600"><AlertTriangle className="h-8 w-8" /></span>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Could not load the dashboard</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{loadError}</p>
        <button type="button" onClick={() => setRefreshRequest(value => value + 1)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalMembers = members.length;
  const countStatus = (status: Member['status']) => members.filter(member => member.status === status).length;
  const activeMembers = countStatus('Active');
  const expiringMembers = countStatus('Expiring');
  const expiredMembers = countStatus('Expired');
  const frozenMembers = countStatus('Frozen');
  const cancelledMembers = countStatus('Cancelled');
  const pendingMembers = members.filter(member => money(member.balanceDue) > 0 && member.status !== 'Cancelled');
  const pendingBalance = pendingMembers.reduce((sum, member) => sum + money(member.balanceDue), 0);
  const personalTrainingMembers = members.filter(member => money(member.personalTrainingFee) > 0 && member.status !== 'Cancelled').length;

  const grossMemberValue = members.reduce((sum, member) => sum + Math.max(0, money(member.totalFee) - money(member.discount)), 0);
  const collectedFromMembers = members.reduce((sum, member) => sum + money(member.amountPaid), 0);
  const collectionRate = grossMemberValue > 0 ? Math.min(100, Math.round((collectedFromMembers / grossMemberValue) * 100)) : 0;
  const lifetimeCollections = payments.reduce((sum, payment) => sum + money(payment.amountPaid), 0);
  const currentMonthCollections = payments.reduce((sum, payment) => {
    const date = parseDateOnly(payment.transactionDate);
    return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() ? sum + money(payment.amountPaid) : sum;
  }, 0);
  const todayCollections = payments.reduce((sum, payment) => {
    const date = parseDateOnly(payment.transactionDate);
    return date && dateKey(date) === dateKey(today) ? sum + money(payment.amountPaid) : sum;
  }, 0);
  const newMembersThisMonth = members.filter(member => {
    const created = createdAtDate(member.createdAt) || parseDateOnly(member.startDate);
    return created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const expiryEntries = members
    .filter(member => member.status === 'Active' || member.status === 'Expiring')
    .map(member => {
      const expiry = parseDateOnly(member.expiryDate);
      const daysRemaining = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / DAY_MS) : Number.MAX_SAFE_INTEGER;
      return { member, expiry, daysRemaining };
    })
    .filter(entry => entry.expiry && entry.daysRemaining >= 0 && entry.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const highestBalances = [...pendingMembers].sort((a, b) => money(b.balanceDue) - money(a.balanceDue)).slice(0, 5);
  const recentPayments = [...payments]
    .sort((a, b) => (parseDateOnly(b.transactionDate)?.getTime() || 0) - (parseDateOnly(a.transactionDate)?.getTime() || 0))
    .slice(0, 6);

  const revenueDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = dateKey(date);
    const amount = payments.reduce((sum, payment) => {
      const paymentDate = parseDateOnly(payment.transactionDate);
      return paymentDate && dateKey(paymentDate) === key ? sum + money(payment.amountPaid) : sum;
    }, 0);
    return { key, label: date.toLocaleDateString('en-IN', { weekday: 'short' }), amount };
  });
  const highestRevenueDay = Math.max(1, ...revenueDays.map(day => day.amount));

  const paymentModes: Payment['paymentMode'][] = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
  const paymentModeBreakdown = paymentModes.map(mode => ({
    mode,
    amount: payments.filter(payment => payment.paymentMode === mode).reduce((sum, payment) => sum + money(payment.amountPaid), 0),
    count: payments.filter(payment => payment.paymentMode === mode).length,
  }));
  const largestPaymentMode = Math.max(1, ...paymentModeBreakdown.map(item => item.amount));

  const planTotals = members.reduce<Record<string, number>>((totals, member) => {
    const plan = member.planType || 'Unassigned';
    totals[plan] = (totals[plan] || 0) + 1;
    return totals;
  }, {});
  const popularPlans = Object.entries(planTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const largestPlan = Math.max(1, ...popularPlans.map(([, count]) => count));

  const statusBreakdown = [
    { label: 'Active', count: activeMembers, color: '#2563EB', dot: 'bg-blue-600' },
    { label: 'Expiring', count: expiringMembers, color: '#D97706', dot: 'bg-amber-600' },
    { label: 'Expired', count: expiredMembers, color: '#DC2626', dot: 'bg-red-600' },
    { label: 'Frozen', count: frozenMembers, color: '#0891B2', dot: 'bg-cyan-600' },
    { label: 'Cancelled', count: cancelledMembers, color: '#64748B', dot: 'bg-slate-500' },
  ];
  const circumference = 2 * Math.PI * 42;
  let accumulatedDash = 0;
  const donutSegments = statusBreakdown.map(item => {
    const dash = totalMembers > 0 ? (item.count / totalMembers) * circumference : 0;
    const segment = { ...item, dash, offset: accumulatedDash, percent: totalMembers > 0 ? Math.round((item.count / totalMembers) * 100) : 0 };
    accumulatedDash += dash;
    return segment;
  });

  const statCards: StatCardData[] = [
    { label: 'Total Members', value: String(totalMembers), detail: `${newMembersThisMonth} joined this month`, icon: Users, iconClass: 'text-blue-700', iconBackground: 'bg-blue-50', route: '/members' },
    { label: 'Active', value: String(activeMembers), detail: `${totalMembers ? Math.round((activeMembers / totalMembers) * 100) : 0}% of all members`, icon: UserCheck, iconClass: 'text-emerald-700', iconBackground: 'bg-emerald-50', route: '/members' },
    { label: 'Expiring', value: String(expiringMembers), detail: `${expiryEntries.length} due within 30 days`, icon: CalendarClock, iconClass: 'text-amber-700', iconBackground: 'bg-amber-50', route: '/members' },
    { label: 'Expired', value: String(expiredMembers), detail: 'Renewal follow-up needed', icon: AlertTriangle, iconClass: 'text-red-700', iconBackground: 'bg-red-50', route: '/members' },
    { label: 'Frozen', value: String(frozenMembers), detail: 'Memberships currently paused', icon: Snowflake, iconClass: 'text-cyan-700', iconBackground: 'bg-cyan-50', route: '/members' },
    { label: 'Cancelled', value: String(cancelledMembers), detail: 'Closed memberships', icon: UserX, iconClass: 'text-slate-700', iconBackground: 'bg-slate-100', route: '/members' },
    { label: 'Personal Training', value: String(personalTrainingMembers), detail: 'Members enrolled in PT', icon: Dumbbell, iconClass: 'text-violet-700', iconBackground: 'bg-violet-50', route: '/members' },
    { label: 'Pending Balance', value: formatCurrency(pendingBalance), detail: `${pendingMembers.length} members have dues`, icon: IndianRupee, iconClass: 'text-rose-700', iconBackground: 'bg-rose-50', route: '/payments' },
  ];

  const quickActions = [
    { label: 'Add Member', icon: Plus, route: '/members/add', primary: true },
    { label: 'Record Payment', icon: CreditCard, route: '/payments/record', primary: false },
    { label: 'Open Reports', icon: FileText, route: '/reports', primary: false },
    { label: 'Gym Settings', icon: Settings, route: '/settings', primary: false },
  ];

  return (
    <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-xl sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50 backdrop-blur">
                <Activity className="h-3.5 w-3.5 text-cyan-300" /> Live operations overview
              </span>
              <button type="button" onClick={() => setRefreshRequest(value => value + 1)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">MR GYM Command Center</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Members, collections, renewals, personal training and daily priorities—all in one clear view.
            </p>
            <p className="mt-3 text-xs font-medium text-blue-200 sm:text-sm">
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto">
            {quickActions.map(action => (
              <button
                key={action.label}
                type="button"
                onClick={() => router.push(action.route)}
                className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-xs font-bold transition sm:min-w-28 ${action.primary ? 'bg-white text-blue-700 shadow-lg hover:bg-blue-50' : 'border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20'}`}
              >
                <action.icon className="h-5 w-5" /> {action.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Some fresh data could not be loaded. The last successful overview is still shown.</span>
          <button type="button" onClick={() => setRefreshRequest(value => value + 1)} className="font-bold text-amber-900 underline">Retry</button>
        </div>
      ) : null}

      <section aria-label="Membership statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {statCards.map(card => <StatCard key={card.label} card={card} onOpen={route => router.push(route)} />)}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Member health</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Membership mix</h2></div>
            <button type="button" onClick={() => router.push('/members')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800">View all <ArrowRight className="h-4 w-4" /></button>
          </div>
          <div className="mt-6 grid items-center gap-6 sm:grid-cols-[160px_1fr]">
            <div className="relative mx-auto h-40 w-40">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" role="img" aria-label="Membership status chart">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" strokeWidth="11" />
                {donutSegments.map(segment => segment.dash > 0 ? (
                  <circle key={segment.label} cx="50" cy="50" r="42" fill="none" stroke={segment.color} strokeWidth="11" strokeLinecap="butt" strokeDasharray={`${segment.dash} ${circumference}`} strokeDashoffset={`-${segment.offset}`} />
                ) : null)}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-black text-slate-900">{totalMembers}</span><span className="text-xs font-medium text-slate-500">members</span></div>
            </div>
            <div className="space-y-3">
              {donutSegments.map(segment => (
                <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${segment.dot}`} />{segment.label}</span>
                  <span className="font-bold text-slate-900">{segment.count} <span className="ml-1 text-xs font-medium text-slate-400">{segment.percent}%</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Collections</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Last 7 days</h2></div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Today</p><p className="text-sm font-extrabold text-slate-900">{formatCurrency(todayCollections)}</p></div>
              <div className="rounded-xl bg-blue-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-blue-500">This month</p><p className="text-sm font-extrabold text-blue-800">{formatCurrency(currentMonthCollections)}</p></div>
            </div>
          </div>
          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-4">
            {revenueDays.map(day => {
              const barHeight = day.amount > 0 ? Math.max(12, Math.round((day.amount / highestRevenueDay) * 100)) : 4;
              return (
                <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="max-w-full truncate text-[9px] font-bold text-slate-500 sm:text-xs">{day.amount > 0 ? formatCurrency(day.amount) : '—'}</span>
                  <div className="group relative flex h-28 w-full items-end overflow-hidden rounded-xl bg-slate-100">
                    <div className="w-full rounded-xl bg-gradient-to-t from-blue-700 to-cyan-400 transition-all group-hover:from-violet-700 group-hover:to-blue-400" style={{ height: `${barHeight}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 sm:text-xs">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Revenue</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Collection summary</h2></div><WalletCards className="h-6 w-6 text-emerald-600" /></div>
          <p className="mt-5 text-3xl font-black tracking-tight text-slate-900">{formatCurrency(lifetimeCollections)}</p>
          <p className="mt-1 text-xs text-slate-500">Lifetime transactions recorded</p>
          <div className="mt-5 flex items-end justify-between"><span className="text-sm font-semibold text-slate-600">Current collection rate</span><span className="text-lg font-black text-emerald-700">{collectionRate}%</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${collectionRate}%` }} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Collected</p><p className="mt-1 truncate text-base font-extrabold text-emerald-900">{formatCurrency(collectedFromMembers)}</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-xs text-rose-700">Outstanding</p><p className="mt-1 truncate text-base font-extrabold text-rose-900">{formatCurrency(pendingBalance)}</p></div></div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Payments</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Payment modes</h2></div><CreditCard className="h-6 w-6 text-blue-600" /></div>
          <div className="mt-5 space-y-4">
            {paymentModeBreakdown.map(item => (
              <div key={item.mode}>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-600">{item.mode} <span className="text-xs font-normal text-slate-400">({item.count})</span></span><span className="font-extrabold text-slate-900">{formatCurrency(item.amount)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round((item.amount / largestPaymentMode) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Demand</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Popular plans</h2></div><BarChart3 className="h-6 w-6 text-violet-600" /></div>
          <div className="mt-5 space-y-4">
            {popularPlans.length ? popularPlans.map(([plan, count], index) => (
              <div key={plan}>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold text-slate-600">{index + 1}. {plan}</span><span className="font-extrabold text-slate-900">{count}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" style={{ width: `${Math.round((count / largestPlan) * 100)}%` }} /></div>
              </div>
            )) : <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">No membership plans to display yet.</p>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Action center</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Upcoming expiries</h2></div><button type="button" onClick={() => router.push('/members')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">View all <ArrowRight className="h-4 w-4" /></button></div>
          <div className="divide-y divide-slate-100">
            {expiryEntries.slice(0, 5).map(({ member, expiry, daysRemaining }) => (
              <button key={member.id} type="button" onClick={() => router.push(`/members/${member.id}`)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 sm:px-6">
                <Avatar url={member.profilePicUrl} name={member.fullName} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{member.fullName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{member.membershipId} · {member.planType}</p>{money(member.personalTrainingFee) > 0 ? <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700"><Dumbbell className="h-3 w-3" /> Personal training</p> : null}</div>
                <div className="shrink-0 text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${daysRemaining <= 3 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{daysRemaining === 0 ? 'Today' : `${daysRemaining} days`}</span><p className="mt-1 text-[10px] text-slate-400">{expiry?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p></div>
              </button>
            ))}
            {!expiryEntries.length ? <div className="flex flex-col items-center px-5 py-10 text-center"><CalendarClock className="h-8 w-8 text-emerald-500" /><p className="mt-3 text-sm font-bold text-slate-800">No expiries in the next 30 days</p><p className="mt-1 text-xs text-slate-500">Your renewal schedule is clear.</p></div> : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-rose-600">Payment follow-up</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Highest outstanding balances</h2></div><button type="button" onClick={() => router.push('/payments')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">Payments <ArrowRight className="h-4 w-4" /></button></div>
          <div className="divide-y divide-slate-100">
            {highestBalances.map(member => (
              <button key={member.id} type="button" onClick={() => router.push(`/members/${member.id}`)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 sm:px-6">
                <Avatar url={member.profilePicUrl} name={member.fullName} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{member.fullName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{member.membershipId} · Paid {formatCurrency(member.amountPaid)}</p></div>
                <div className="shrink-0 text-right"><p className="text-sm font-black text-rose-700">{formatCurrency(member.balanceDue)}</p><span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${memberStatusStyle(member.status)}`}>{member.status}</span></div>
              </button>
            ))}
            {!highestBalances.length ? <div className="flex flex-col items-center px-5 py-10 text-center"><UserCheck className="h-8 w-8 text-emerald-500" /><p className="mt-3 text-sm font-bold text-slate-800">No pending member balances</p><p className="mt-1 text-xs text-slate-500">All current balances are settled.</p></div> : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Latest activity</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Recent transactions</h2></div><button type="button" onClick={() => router.push('/payments')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 sm:text-sm">View all <ArrowRight className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {recentPayments.map(payment => {
            const member = members.find(item => item.id === payment.memberId || item.membershipId === payment.membershipId);
            return (
              <button key={payment.id} type="button" onClick={() => router.push(`/payments/invoice/${payment.id}`)} className="flex min-w-0 items-center gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 sm:px-6 lg:odd:border-r">
                <Avatar url={member?.profilePicUrl} name={payment.memberName} size="large" />
                <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-bold text-slate-900">{payment.memberName}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${paymentStatusStyle(payment.status)}`}>{payment.status}</span></div><p className="mt-1 truncate text-xs text-slate-500">{payment.invoiceNumber} · {payment.transactionDate} · {payment.paymentMode}</p><p className="mt-1 truncate text-[11px] text-slate-400">Membership {formatCurrency(payment.membershipFee ?? money(payment.totalFee) - money(payment.personalTrainingFee))}{money(payment.personalTrainingFee) > 0 ? ` + PT ${formatCurrency(payment.personalTrainingFee)}` : ''}</p></div>
                <div className="shrink-0 text-right"><p className="text-base font-black text-slate-900">{formatCurrency(payment.amountPaid)}</p>{money(payment.balanceDue) > 0 ? <p className="mt-1 text-[10px] font-semibold text-rose-600">Due {formatCurrency(payment.balanceDue)}</p> : <p className="mt-1 text-[10px] font-semibold text-emerald-600">Settled</p>}</div>
              </button>
            );
          })}
          {!recentPayments.length ? <div className="col-span-full flex flex-col items-center px-5 py-12 text-center"><TrendingUp className="h-9 w-9 text-blue-500" /><p className="mt-3 text-sm font-bold text-slate-800">No transactions recorded yet</p><button type="button" onClick={() => router.push('/payments/record')} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Record first payment</button></div> : null}
        </div>
      </section>
    </div>
  );
};
