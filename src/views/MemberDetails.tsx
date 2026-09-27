'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Dumbbell,
  Edit,
  FileText,
  History,
  Loader2,
  Mail,
  MessageCircle,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import {
  cancelMembership,
  freezeMembership,
  getMember,
  getWhatsAppLink,
  reactivateMembership,
  renewMembership,
  resumeMembership,
  type Member,
  type MembershipActivity,
} from '../services/members';
import { getPayments, type Payment } from '../services/payments';
import { getPlans, type Plan } from '../services/settings';

type Tab = 'Overview' | 'Membership' | 'Payments' | 'Activity';
type Modal = 'renew' | 'freeze' | 'cancel' | null;

const DAY_MS = 86_400_000;

const money = (value: unknown) => Math.max(0, Number(value) || 0);
const currency = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(money(value));

const parseDateOnly = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const todayValue = () => formatDateOnly(new Date());

const expiryFromDuration = (startValue: string, duration: string) => {
  const start = parseDateOnly(startValue);
  if (!start) return '';
  const number = Math.max(1, Number.parseInt(duration, 10) || 1);
  const normalized = duration.toLowerCase();
  const expiry = new Date(start);
  if (normalized.includes('year')) expiry.setFullYear(expiry.getFullYear() + number);
  else if (normalized.includes('week')) expiry.setDate(expiry.getDate() + number * 7);
  else if (normalized.includes('day')) expiry.setDate(expiry.getDate() + number);
  else expiry.setMonth(expiry.getMonth() + number);
  return formatDateOnly(expiry);
};

const statusStyle = (status: Member['status']) => {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Expiring') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Expired') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Frozen') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-slate-300 bg-slate-100 text-slate-700';
};

const paymentStyle = (status: Payment['status']) => {
  if (status === 'Paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Partial') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

export const MemberDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [modal, setModal] = useState<Modal>(null);
  const [freezeData, setFreezeData] = useState({ from: todayValue(), until: '', reason: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [renewal, setRenewal] = useState({ planId: '', startDate: todayValue(), expiryDate: '', membershipFee: 0, keepPersonalTraining: true });

  const fetchMemberData = useCallback(async (showRefresh = false) => {
    if (!id) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [memberData, paymentData, planData] = await Promise.all([getMember(id), getPayments(), getPlans()]);
      setMember(memberData);
      setPayments(paymentData.filter(payment => payment.memberId === id || payment.membershipId === memberData?.membershipId));
      setPlans(planData);
    } catch (loadError) {
      console.error(loadError);
      setError('Member details could not be loaded. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchMemberData();
  }, [fetchMemberData]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => (parseDateOnly(b.transactionDate)?.getTime() || 0) - (parseDateOnly(a.transactionDate)?.getTime() || 0)),
    [payments],
  );

  const openRenewal = () => {
    if (!member) return;
    const matchingPlan = plans.find(plan => plan.name === member.planType) || plans[0];
    const startDate = todayValue();
    setRenewal({
      planId: matchingPlan?.id || '',
      startDate,
      expiryDate: expiryFromDuration(startDate, matchingPlan?.duration || '1 month'),
      membershipFee: matchingPlan?.price ?? money(member.membershipFee),
      keepPersonalTraining: money(member.personalTrainingFee) > 0,
    });
    setModal('renew');
  };

  const updateRenewalPlan = (planId: string) => {
    const plan = plans.find(item => item.id === planId);
    setRenewal(current => ({
      ...current,
      planId,
      membershipFee: plan?.price ?? current.membershipFee,
      expiryDate: expiryFromDuration(current.startDate, plan?.duration || '1 month'),
    }));
  };

  const updateRenewalStart = (startDate: string) => {
    const plan = plans.find(item => item.id === renewal.planId);
    setRenewal(current => ({ ...current, startDate, expiryDate: expiryFromDuration(startDate, plan?.duration || '1 month') }));
  };

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setProcessing(true);
    setError('');
    try {
      await action();
      setModal(null);
      setNotice(successMessage);
      await fetchMemberData(true);
    } catch (actionError) {
      console.error(actionError);
      setError(actionError instanceof Error ? actionError.message : 'The action could not be completed.');
    } finally {
      setProcessing(false);
    }
  };

  const submitFreeze = async (event: React.FormEvent) => {
    event.preventDefault();
    if (freezeData.until && freezeData.until < freezeData.from) {
      setError('Expected resume date cannot be earlier than the freeze start date.');
      return;
    }
    await runAction(() => freezeMembership(id, freezeData), 'Membership frozen successfully. It can be resumed at any time.');
  };

  const submitRenewal = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedPlan = plans.find(plan => plan.id === renewal.planId);
    if (!selectedPlan || !renewal.expiryDate) {
      setError('Select a valid membership plan and renewal date.');
      return;
    }
    await runAction(
      () => renewMembership(id, { planType: selectedPlan.name, startDate: renewal.startDate, expiryDate: renewal.expiryDate, membershipFee: renewal.membershipFee, keepPersonalTraining: renewal.keepPersonalTraining }),
      'Membership renewed successfully. A new balance is ready for payment.',
    );
  };

  const submitCancellation = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAction(() => cancelMembership(id, cancelReason), 'Membership cancelled. You can renew or reactivate this member later.');
  };

  const handleResume = async () => {
    if (!window.confirm('Resume this membership now? The expiry date will be extended by the actual paused days.')) return;
    await runAction(() => resumeMembership(id), 'Membership resumed and expiry adjusted successfully.');
  };

  const handleReactivate = async () => {
    if (!window.confirm('Reactivate this cancelled membership with its existing expiry date?')) return;
    await runAction(() => reactivateMembership(id), 'Membership reactivated successfully.');
  };

  if (loading) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3"><Loader2 className="h-9 w-9 animate-spin text-blue-600" /><p className="text-sm font-medium text-slate-500">Loading member profile...</p></div>;
  if (!member) return <div className="rounded-3xl border border-red-200 bg-white p-10 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-red-500" /><h2 className="mt-3 text-xl font-bold text-slate-900">Member not found</h2><button onClick={() => router.push('/members')} className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Back to members</button></div>;

  const start = parseDateOnly(member.startDate);
  const expiry = parseDateOnly(member.expiryDate);
  const today = parseDateOnly(todayValue())!;
  const totalDays = start && expiry ? Math.max(1, Math.ceil((expiry.getTime() - start.getTime()) / DAY_MS)) : 1;
  const elapsedDays = start ? Math.max(0, Math.ceil((today.getTime() - start.getTime()) / DAY_MS)) : 0;
  const progress = member.status === 'Cancelled' ? 100 : Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const remainingDays = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / DAY_MS) : 0;
  const paidPercent = money(member.totalFee) > 0 ? Math.min(100, Math.round((money(member.amountPaid) / Math.max(1, money(member.totalFee) - money(member.discount))) * 100)) : 0;
  const fallbackHistory: MembershipActivity[] = [{ id: 'created', type: 'Created', title: 'Member profile created', details: `Membership started on ${member.startDate}.`, occurredAt: typeof member.createdAt === 'object' && member.createdAt && 'toDate' in member.createdAt ? (member.createdAt as { toDate: () => Date }).toDate().toISOString() : member.startDate }];
  const history = [...(member.membershipHistory || []), ...fallbackHistory].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const selectedRenewalPlan = plans.find(plan => plan.id === renewal.planId);
  const renewalTotal = renewal.membershipFee + (renewal.keepPersonalTraining ? money(member.personalTrainingFee) : 0);

  const tabs: Array<{ name: Tab; icon: typeof Activity }> = [
    { name: 'Overview', icon: UserRound },
    { name: 'Membership', icon: ShieldCheck },
    { name: 'Payments', icon: CreditCard },
    { name: 'Activity', icon: History },
  ];

  return (
    <div className="space-y-5 pb-8">
      {notice ? <div className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-semibold text-emerald-800 shadow-2xl"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />{notice}</div> : null}

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.push('/members')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:-translate-x-0.5 hover:text-blue-700"><ArrowLeft className="h-4 w-4" /> Members</button>
        <button onClick={() => void fetchMemberData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {error ? <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"><span className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div> : null}

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-xl sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {member.profilePicUrl ? <img src={member.profilePicUrl} alt={member.fullName} className="h-24 w-24 shrink-0 rounded-3xl border-4 border-white/20 object-cover shadow-2xl" /> : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border-4 border-white/20 bg-white/10 text-3xl font-black shadow-2xl">{member.fullName.charAt(0).toUpperCase()}</div>}
            <div className="min-w-0"><div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyle(member.status)}`}>{member.status}</span>{money(member.personalTrainingFee) > 0 ? <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-400/15 px-3 py-1 text-xs font-bold text-violet-100"><Dumbbell className="h-3.5 w-3.5" /> Personal Training</span> : null}</div><h1 className="mt-3 truncate text-2xl font-black tracking-tight sm:text-3xl">{member.fullName}</h1><p className="mt-1 text-sm font-medium text-blue-200">{member.membershipId} · {member.planType} · {member.accessShift}</p><div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-blue-100 sm:justify-start">{member.mobileNumber ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{member.mobileNumber}</span> : null}{member.email ? <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{member.email}</span> : null}</div></div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:grid-cols-2">
            <button onClick={() => router.push(`/members/edit/${id}`)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold backdrop-blur transition hover:bg-white/20"><Edit className="h-4 w-4" /> Edit</button>
            <a href={getWhatsAppLink(member)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white transition hover:bg-emerald-400"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            <button onClick={() => router.push('/payments/record')} className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-blue-700 shadow-lg transition hover:bg-blue-50"><CircleDollarSign className="h-5 w-5" /> Record Payment</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Fee</p><p className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">{currency(member.totalFee)}</p><p className="mt-1 text-xs text-slate-500">Discount {currency(member.discount)}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Amount Paid</p><p className="mt-2 text-xl font-black text-emerald-800 sm:text-2xl">{currency(member.amountPaid)}</p><p className="mt-1 text-xs text-emerald-600">{paidPercent}% collected</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-rose-600">Balance Due</p><p className="mt-2 text-xl font-black text-rose-800 sm:text-2xl">{currency(member.balanceDue)}</p><p className="mt-1 text-xs text-rose-600">Pending collection</p></div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Days Remaining</p><p className="mt-2 text-xl font-black text-blue-900 sm:text-2xl">{member.status === 'Cancelled' ? '—' : Math.max(0, remainingDays)}</p><p className="mt-1 text-xs text-blue-600">Expires {member.expiryDate}</p></div>
      </section>

      {member.status === 'Frozen' ? <div className="flex flex-col gap-4 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><PauseCircle className="h-7 w-7 shrink-0 text-cyan-700" /><div><h2 className="font-black text-cyan-900">Membership is currently frozen</h2><p className="mt-1 text-sm text-cyan-800">From {member.freezeFrom || '—'}{member.freezeUntil ? ` · expected until ${member.freezeUntil}` : ''}</p><p className="mt-1 text-xs text-cyan-700">{member.freezeReason || 'No reason recorded'}</p></div></div><button onClick={handleResume} disabled={processing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-60"><PlayCircle className="h-5 w-5" /> Resume Now</button></div> : null}
      {member.status === 'Cancelled' ? <div className="flex flex-col gap-4 rounded-3xl border border-slate-300 bg-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><XCircle className="h-7 w-7 shrink-0 text-slate-700" /><div><h2 className="font-black text-slate-900">Membership was cancelled</h2><p className="mt-1 text-sm text-slate-700">{member.cancellationReason || 'No cancellation reason recorded.'}</p><p className="mt-1 text-xs text-slate-500">Renew with new dates, or reactivate the remaining existing period.</p></div></div><div className="flex gap-2"><button onClick={handleReactivate} disabled={processing || remainingDays < 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Reactivate</button><button onClick={openRenewal} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700"><RefreshCw className="h-4 w-4" /> Renew</button></div></div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2">
          {tabs.map(tab => <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`inline-flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.name ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><tab.icon className="h-4 w-4" />{tab.name}{tab.name === 'Payments' ? <span className={`rounded-full px-1.5 text-[10px] ${activeTab === tab.name ? 'bg-white/20' : 'bg-slate-200'}`}>{payments.length}</span> : null}</button>)}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'Overview' ? <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-5"><h3 className="flex items-center gap-2 font-black text-slate-900"><UserRound className="h-5 w-5 text-blue-600" /> Personal information</h3><dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold text-slate-400">Full Name</dt><dd className="mt-1 font-bold text-slate-800">{member.fullName}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Gender</dt><dd className="mt-1 font-bold text-slate-800">{member.gender || '—'}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Date of Birth</dt><dd className="mt-1 font-bold text-slate-800">{member.dateOfBirth || '—'}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Access Shift</dt><dd className="mt-1 font-bold text-slate-800">{member.accessShift || '—'}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Mobile Number</dt><dd className="mt-1 break-all font-bold text-slate-800">{member.mobileNumber || '—'}</dd></div><div><dt className="text-xs font-semibold text-slate-400">Email Address</dt><dd className="mt-1 break-all font-bold text-slate-800">{member.email || '—'}</dd></div></dl></div><div className="rounded-2xl border border-slate-200 p-5"><h3 className="flex items-center gap-2 font-black text-slate-900"><CalendarClock className="h-5 w-5 text-blue-600" /> Membership progress</h3><div className="mt-5 flex items-end justify-between"><div><p className="text-xs font-semibold text-slate-400">Current period</p><p className="mt-1 text-sm font-bold text-slate-800">{member.startDate} → {member.expiryDate}</p></div><span className="text-lg font-black text-blue-700">{progress}%</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${member.status === 'Cancelled' ? 'bg-slate-500' : member.status === 'Frozen' ? 'bg-cyan-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`} style={{ width: `${progress}%` }} /></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Renewals</p><p className="mt-1 text-xl font-black text-slate-900">{member.renewalCount || 0}</p></div><div className="rounded-xl bg-violet-50 p-3"><p className="text-xs text-violet-600">Personal Training</p><p className="mt-1 truncate text-sm font-black text-violet-900">{member.personalTrainingPlanName || 'Not selected'}</p></div></div></div></div> : null}

          {activeTab === 'Membership' ? <div className="space-y-5"><div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Membership controls</p><h3 className="mt-1 text-lg font-black text-blue-950">Manage the complete membership lifecycle</h3></div><div className="flex flex-wrap gap-2"><button onClick={openRenewal} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" /> {member.status === 'Cancelled' ? 'Renew & Reactivate' : 'Renew Membership'}</button>{member.status === 'Frozen' ? <button onClick={handleResume} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white"><PlayCircle className="h-4 w-4" /> Resume</button> : member.status !== 'Cancelled' ? <button onClick={() => { setFreezeData({ from: todayValue(), until: '', reason: '' }); setModal('freeze'); }} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white"><PauseCircle className="h-4 w-4" /> Freeze</button> : null}{member.status !== 'Cancelled' ? <button onClick={() => setModal('cancel')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"><XCircle className="h-4 w-4" /> Cancel</button> : null}</div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{ label: 'Membership Plan', value: member.planType }, { label: 'Access Shift', value: member.accessShift }, { label: 'Start Date', value: member.startDate }, { label: 'Expiry Date', value: member.expiryDate }, { label: 'Membership Fee', value: currency(member.membershipFee) }, { label: 'Personal Training Fee', value: currency(member.personalTrainingFee) }].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-2 font-black text-slate-900">{item.value || '—'}</p></div>)}</div></div> : null}

          {activeTab === 'Payments' ? <div><div className="mb-4 flex items-center justify-between"><div><h3 className="font-black text-slate-900">Payment history</h3><p className="text-xs text-slate-500">Every invoice recorded for this member</p></div><button onClick={() => router.push('/payments/record')} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Record payment</button></div><div className="space-y-3">{sortedPayments.length ? sortedPayments.map(payment => <button key={payment.id} onClick={() => router.push(`/payments/invoice/${payment.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FileText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-black text-slate-900">{payment.invoiceNumber}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${paymentStyle(payment.status)}`}>{payment.status}</span></span><span className="mt-1 block truncate text-xs text-slate-500">{payment.transactionDate} · {payment.paymentMode}</span></span><span className="shrink-0 text-right"><span className="block font-black text-slate-900">{currency(payment.amountPaid)}</span><span className="mt-1 block text-[10px] text-rose-600">Due {currency(payment.balanceDue)}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /></button>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><CreditCard className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No payments recorded</p></div>}</div></div> : null}

          {activeTab === 'Activity' ? <div><h3 className="font-black text-slate-900">Membership activity</h3><p className="mt-1 text-xs text-slate-500">Renewals, freezes, resumes, cancellations and reactivations</p><div className="relative mt-6 space-y-5 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-slate-200">{history.map(event => <div key={event.id} className="relative flex gap-4"><span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white shadow"><Activity className="h-4 w-4" /></span><div className="min-w-0 flex-1 rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="font-black text-slate-900">{event.title}</p><time className="text-xs text-slate-400">{new Date(event.occurredAt).toLocaleString('en-IN')}</time></div><p className="mt-2 text-sm leading-6 text-slate-600">{event.details}</p></div></div>)}</div></div> : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button onClick={openRenewal} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-blue-600 p-3 text-center text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5"><RefreshCw className="h-5 w-5" />{member.status === 'Cancelled' ? 'Renew & Reactivate' : 'Renew Membership'}</button>
        {member.status === 'Frozen' ? <button onClick={handleResume} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-cyan-700 p-3 text-center text-xs font-black text-white shadow-lg"><PlayCircle className="h-5 w-5" />Resume Membership</button> : <button onClick={() => { setFreezeData({ from: todayValue(), until: '', reason: '' }); setModal('freeze'); }} disabled={member.status === 'Cancelled'} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-amber-600 p-3 text-center text-xs font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40"><PauseCircle className="h-5 w-5" />Freeze Membership</button>}
        {member.status === 'Cancelled' ? <button onClick={handleReactivate} disabled={remainingDays < 0} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-700 p-3 text-center text-xs font-black text-white shadow-lg disabled:opacity-40"><RotateCcw className="h-5 w-5" />Reactivate</button> : <button onClick={() => setModal('cancel')} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-red-600 p-3 text-center text-xs font-black text-white shadow-lg"><XCircle className="h-5 w-5" />Cancel Membership</button>}
        <button onClick={() => router.push(`/members/edit/${id}`)} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center text-xs font-black text-slate-700 shadow-sm"><Edit className="h-5 w-5 text-blue-600" />Edit Details</button>
        <button onClick={() => router.push('/payments/record')} className="col-span-2 flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center text-xs font-black text-slate-700 shadow-sm sm:col-span-1"><CircleDollarSign className="h-5 w-5 text-emerald-600" />Record Payment</button>
      </section>

      {modal === 'freeze' ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"><form onSubmit={submitFreeze} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black text-slate-900">Freeze membership</h2><p className="mt-1 text-sm text-slate-500">The member can be resumed before the expected date.</p></div><button type="button" onClick={() => setModal(null)} className="rounded-xl bg-slate-100 p-2"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><label className="block"><span className="text-xs font-bold text-slate-600">Freeze from *</span><input type="date" required value={freezeData.from} onChange={event => setFreezeData(current => ({ ...current, from: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-amber-500" /></label><label className="block"><span className="text-xs font-bold text-slate-600">Expected resume date (optional)</span><input type="date" min={freezeData.from} value={freezeData.until} onChange={event => setFreezeData(current => ({ ...current, until: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-amber-500" /></label><label className="block"><span className="text-xs font-bold text-slate-600">Reason *</span><textarea required rows={4} value={freezeData.reason} onChange={event => setFreezeData(current => ({ ...current, reason: event.target.value }))} placeholder="Medical leave, travel, temporary break..." className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-500" /></label><div className="rounded-xl bg-cyan-50 p-3 text-xs leading-5 text-cyan-800">When resumed, the expiry date is automatically extended by the actual number of paused days.</div></div><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setModal(null)} className="h-11 rounded-xl border border-slate-200 font-bold text-slate-600">Close</button><button type="submit" disabled={processing} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 font-bold text-white disabled:opacity-60">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />} Freeze</button></div></form></div> : null}

      {modal === 'cancel' ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"><form onSubmit={submitCancellation} className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle className="h-6 w-6" /></div><h2 className="mt-4 text-xl font-black text-slate-900">Cancel membership?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Access will stop immediately, but this member remains saved and can be renewed or reactivated later.</p><label className="mt-5 block"><span className="text-xs font-bold text-slate-600">Cancellation reason *</span><textarea required rows={4} value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Enter a clear reason..." className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-red-500" /></label><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setModal(null)} className="h-11 rounded-xl border border-slate-200 font-bold text-slate-600">Keep Active</button><button type="submit" disabled={processing} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white disabled:opacity-60">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel</button></div></form></div> : null}

      {modal === 'renew' ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"><form onSubmit={submitRenewal} className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black text-slate-900">{member.status === 'Cancelled' ? 'Renew and reactivate' : 'Renew membership'}</h2><p className="mt-1 text-sm text-slate-500">Start a clean membership period with new fees.</p></div><button type="button" onClick={() => setModal(null)} className="rounded-xl bg-slate-100 p-2"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><label className="block"><span className="text-xs font-bold text-slate-600">Membership plan *</span><select required value={renewal.planId} onChange={event => updateRenewalPlan(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500"><option value="">Select plan</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} — {plan.duration} — {currency(plan.price)}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label><span className="text-xs font-bold text-slate-600">Start date *</span><input type="date" required value={renewal.startDate} onChange={event => updateRenewalStart(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" /></label><label><span className="text-xs font-bold text-slate-600">New expiry</span><input type="date" readOnly value={renewal.expiryDate} className="mt-1.5 h-11 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 font-bold text-emerald-700" /></label></div><label className="block"><span className="text-xs font-bold text-slate-600">Membership fee</span><input type="number" min="0" value={renewal.membershipFee} onChange={event => setRenewal(current => ({ ...current, membershipFee: Number(event.target.value) }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" /></label>{money(member.personalTrainingFee) > 0 ? <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><input type="checkbox" checked={renewal.keepPersonalTraining} onChange={event => setRenewal(current => ({ ...current, keepPersonalTraining: event.target.checked }))} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-black text-violet-900">Continue personal training</span><span className="mt-1 block text-xs text-violet-700">{member.personalTrainingPlanName} · {currency(member.personalTrainingFee)}</span></span></label> : null}<div className="rounded-2xl bg-slate-950 p-4 text-white"><div className="flex justify-between text-xs text-slate-300"><span>{selectedRenewalPlan?.name || 'New membership'}</span><span>{selectedRenewalPlan?.duration || '—'}</span></div><div className="mt-3 flex items-end justify-between"><span className="text-sm font-semibold text-slate-300">New total fee</span><span className="text-2xl font-black">{currency(renewalTotal)}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-400">Previous payment history remains safe. Current member totals reset for the new period.</p></div></div><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setModal(null)} className="h-11 rounded-xl border border-slate-200 font-bold text-slate-600">Close</button><button type="submit" disabled={processing || !renewal.planId} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-50">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Renew</button></div></form></div> : null}
    </div>
  );
};
