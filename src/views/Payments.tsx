'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, ChevronLeft, ChevronRight, CreditCard,
  Download, Edit, FileText, Filter, IndianRupee, Loader2, MessageCircle, Plus, ReceiptIndianRupee,
  RefreshCw, Search, SlidersHorizontal, Trash2, TrendingUp, WalletCards, X,
} from 'lucide-react';
import { deletePayment, getPayments, getPaymentWhatsAppLink, type Payment } from '../services/payments';
import { getMembers, type Member } from '../services/members';

type PaymentFilter = 'All' | 'Paid' | 'Partial' | 'Outstanding';
type TrainingFilter = 'All' | 'With PT' | 'Without PT';
type SortOption = 'newest' | 'oldest' | 'amount-high' | 'amount-low' | 'balance-high' | 'member-asc';

const money = (value: unknown) => Math.max(0, Number(value) || 0);
const currency = (value: unknown) => `₹${new Intl.NumberFormat('en-IN').format(money(value))}`;
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const paymentDate = (value: string) => {
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
const statusStyle = (status: Payment['status']) => {
  if (status === 'Paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Partial') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const Avatar = ({ member, name }: { member?: Member; name: string }) => member?.profilePicUrl ? (
  <img src={member.profilePicUrl} alt={name} className="h-11 w-11 shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm" />
) : (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 font-black text-white shadow-sm">{name.trim().charAt(0).toUpperCase() || 'M'}</div>
);

export const Payments: React.FC = () => {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentFilter>('All');
  const [mode, setMode] = useState('All');
  const [training, setTraining] = useState<TrainingFilter>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const fetchData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [paymentData, memberData] = await Promise.all([getPayments(), getMembers()]);
      setPayments(paymentData);
      setMembers(memberData);
    } catch (fetchError) {
      console.error(fetchError);
      setError('Payment records could not be loaded. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const memberMap = useMemo(() => new Map(members.map(member => [member.membershipId, member])), [members]);
  const modes = useMemo(() => [...new Set(payments.map(payment => payment.paymentMode).filter(Boolean))].sort(), [payments]);
  const counts = useMemo(() => ({
    All: payments.length,
    Paid: payments.filter(payment => payment.status === 'Paid').length,
    Partial: payments.filter(payment => payment.status === 'Partial').length,
    Outstanding: payments.filter(payment => money(payment.balanceDue) > 0).length,
  }), [payments]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const minimum = minAmount === '' ? null : money(minAmount);
    const maximum = maxAmount === '' ? null : money(maxAmount);
    const result = payments.filter(payment => {
      const member = memberMap.get(payment.membershipId);
      const matchesSearch = !term || [payment.memberName, payment.invoiceNumber, payment.membershipId, member?.mobileNumber, member?.email]
        .some(value => String(value || '').toLowerCase().includes(term));
      const hasTraining = money(payment.personalTrainingFee) > 0 || Boolean(payment.personalTrainingPlanId);
      return matchesSearch
        && (status === 'All' || (status === 'Outstanding' ? money(payment.balanceDue) > 0 : payment.status === status))
        && (mode === 'All' || payment.paymentMode === mode)
        && (training === 'All' || (training === 'With PT' ? hasTraining : !hasTraining))
        && (!dateFrom || payment.transactionDate >= dateFrom)
        && (!dateTo || payment.transactionDate <= dateTo)
        && (minimum === null || money(payment.amountPaid) >= minimum)
        && (maximum === null || money(payment.amountPaid) <= maximum);
    });

    return result.sort((a, b) => {
      if (sortBy === 'oldest') return paymentDate(a.transactionDate) - paymentDate(b.transactionDate);
      if (sortBy === 'amount-high') return money(b.amountPaid) - money(a.amountPaid);
      if (sortBy === 'amount-low') return money(a.amountPaid) - money(b.amountPaid);
      if (sortBy === 'balance-high') return money(b.balanceDue) - money(a.balanceDue);
      if (sortBy === 'member-asc') return a.memberName.localeCompare(b.memberName);
      return paymentDate(b.transactionDate) - paymentDate(a.transactionDate);
    });
  }, [dateFrom, dateTo, maxAmount, memberMap, minAmount, mode, payments, search, sortBy, status, training]);

  const activeFilterCount = [status !== 'All', mode !== 'All', training !== 'All', dateFrom, dateTo, minAmount, maxAmount, sortBy !== 'newest'].filter(Boolean).length;
  const summary = useMemo(() => ({
    lifetime: payments.reduce((sum, payment) => sum + money(payment.amountPaid), 0),
    today: payments.filter(payment => payment.transactionDate === today).reduce((sum, payment) => sum + money(payment.amountPaid), 0),
    month: payments.filter(payment => payment.transactionDate.startsWith(thisMonth)).reduce((sum, payment) => sum + money(payment.amountPaid), 0),
    pending: members.reduce((sum, member) => sum + money(member.balanceDue), 0),
  }), [members, payments, thisMonth, today]);
  const filteredCollection = filteredPayments.reduce((sum, payment) => sum + money(payment.amountPaid), 0);

  useEffect(() => { setCurrentPage(1); }, [search, status, mode, training, dateFrom, dateTo, minAmount, maxAmount, sortBy, rowsPerPage]);
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / rowsPerPage));
  useEffect(() => { setCurrentPage(page => Math.min(page, totalPages)); }, [totalPages]);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = filteredPayments.slice(startIndex, startIndex + rowsPerPage);

  const clearFilters = () => {
    setSearch(''); setStatus('All'); setMode('All'); setTraining('All'); setDateFrom(''); setDateTo('');
    setMinAmount(''); setMaxAmount(''); setSortBy('newest');
  };

  const setDatePreset = (preset: 'today' | 'month' | 'clear') => {
    if (preset === 'today') { setDateFrom(today); setDateTo(today); }
    if (preset === 'month') { setDateFrom(`${thisMonth}-01`); setDateTo(today); }
    if (preset === 'clear') { setDateFrom(''); setDateTo(''); }
  };

  const handleDelete = async (event: React.MouseEvent, payment: Payment) => {
    event.stopPropagation();
    if (!window.confirm(`Delete ${payment.invoiceNumber}? Member payment totals will be recalculated.`)) return;
    try {
      await deletePayment(payment.id);
      await fetchData(true);
    } catch (deleteError) {
      console.error(deleteError);
      setError('The payment could not be deleted. Please try again.');
    }
  };

  const handleExport = () => {
    if (!filteredPayments.length) return window.alert('No payments match the selected filters.');
    const headings = ['Invoice', 'Member', 'Membership ID', 'Date', 'Mode', 'Membership Fee', 'Personal Training', 'PT Fee', 'Total Fee', 'Discount', 'Amount Paid', 'Balance Due', 'Status'];
    const rows = filteredPayments.map(payment => [payment.invoiceNumber, payment.memberName, payment.membershipId, payment.transactionDate, payment.paymentMode, payment.membershipFee, payment.personalTrainingPlanName || 'No', payment.personalTrainingFee, payment.totalFee, payment.discount, payment.amountPaid, payment.balanceDue, payment.status].map(csvCell).join(','));
    const blob = new Blob([[headings.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `MRGYM_Payments_${today}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const go = (event: React.MouseEvent, path: string) => { event.stopPropagation(); router.push(path); };

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-700 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-14 -top-20 h-60 w-60 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-100"><ReceiptIndianRupee className="h-3.5 w-3.5" /> Payment workspace</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Track every rupee with clarity.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100">Explore collections, find outstanding invoices and manage every payment from any screen.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => void fetchData(true)} disabled={refreshing} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold backdrop-blur transition hover:bg-white/20 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button><button onClick={handleExport} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold backdrop-blur transition hover:bg-white/20"><Download className="h-4 w-4" /> Export</button><button onClick={() => router.push('/payments/record')} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-emerald-700 shadow-lg transition hover:-translate-y-0.5 sm:col-span-1"><Plus className="h-4 w-4" /> Record payment</button></div></div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Lifetime collected', value: currency(summary.lifetime), icon: TrendingUp, style: 'bg-emerald-50 text-emerald-700' },
        { label: "Today's collection", value: currency(summary.today), icon: IndianRupee, style: 'bg-blue-50 text-blue-700' },
        { label: 'This month', value: currency(summary.month), icon: CalendarDays, style: 'bg-violet-50 text-violet-700' },
        { label: 'Member balances due', value: currency(summary.pending), icon: WalletCards, style: 'bg-rose-50 text-rose-700' },
      ].map(item => <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.style}`}><item.icon className="h-4 w-4" /></div><p className="mt-3 text-lg font-black text-slate-900 sm:text-2xl">{item.value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.label}</p></article>)}</section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search invoice, member, ID, mobile or email..." className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />{search ? <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></button> : null}</div><div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => setShowFilters(value => !value)} className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${showFilters || activeFilterCount ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><SlidersHorizontal className="h-4 w-4" /> Filters {activeFilterCount ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">{activeFilterCount}</span> : null}</button><select value={sortBy} onChange={event => setSortBy(event.target.value as SortOption)} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount-high">Highest paid</option><option value="amount-low">Lowest paid</option><option value="balance-high">Highest due</option><option value="member-asc">Member A–Z</option></select></div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(['All', 'Paid', 'Partial', 'Outstanding'] as PaymentFilter[]).map(item => <button key={item} onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition ${status === item ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700'}`}>{item} <span className={status === item ? 'text-emerald-100' : 'text-slate-400'}>{counts[item]}</span></button>)}</div>
        {showFilters ? <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><div className="mb-3 flex flex-wrap gap-2"><button onClick={() => setDatePreset('today')} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">Today</button><button onClick={() => setDatePreset('month')} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">This month</button><button onClick={() => setDatePreset('clear')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">Any date</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment mode</span><select value={mode} onChange={event => setMode(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none"><option value="All">All modes</option>{modes.map(item => <option key={item}>{item}</option>)}</select></label><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Personal training</span><select value={training} onChange={event => setTraining(event.target.value as TrainingFilter)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none"><option value="All">All records</option><option value="With PT">With PT</option><option value="Without PT">Without PT</option></select></label><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">From date</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none" /></label><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">To date</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none" /></label><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Minimum paid</span><input type="number" min="0" value={minAmount} onChange={event => setMinAmount(event.target.value)} placeholder="₹ 0" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none" /></label><label><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Maximum paid</span><input type="number" min="0" value={maxAmount} onChange={event => setMaxAmount(event.target.value)} placeholder="Any" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none" /></label></div><div className="mt-4 flex flex-col gap-2 border-t border-emerald-100 pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-slate-500"><Filter className="mr-1 inline h-3.5 w-3.5" />{filteredPayments.length} records · {currency(filteredCollection)} collected in result</p><button onClick={clearFilters} className="self-start text-xs font-black text-emerald-700 hover:text-emerald-900">Clear all filters</button></div></div> : null}
      </section>

      {error ? <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={() => void fetchData()} className="rounded-lg bg-rose-100 px-3 py-1.5 font-bold">Retry</button></div> : null}
      {loading ? <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div> : filteredPayments.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><ReceiptIndianRupee className="h-6 w-6 text-slate-400" /></div><h2 className="mt-4 text-lg font-black text-slate-800">No payments found</h2><p className="mt-1 text-sm text-slate-500">Change the search, date or payment filters.</p><button onClick={clearFilters} className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">Reset filters</button></div> : <>
        <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-500"><span>{filteredPayments.length} payment records</span><span className="hidden lg:inline">Table scrolls horizontally on smaller desktop screens</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Invoice</th><th className="px-4 py-4">Member</th><th className="px-4 py-4">Date / Mode</th><th className="px-4 py-4">Fee details</th><th className="px-4 py-4">Paid</th><th className="px-4 py-4">Balance</th><th className="px-4 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{currentData.map(payment => { const member = memberMap.get(payment.membershipId); return <tr key={payment.id} onClick={() => router.push(`/payments/invoice/${payment.id}`)} className="cursor-pointer transition hover:bg-emerald-50/40"><td className="px-5 py-4"><p className="font-black text-slate-900">{payment.invoiceNumber}</p><p className="mt-1 text-xs text-slate-400">{payment.membershipId}</p></td><td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar member={member} name={payment.memberName} /><div><p className="max-w-48 truncate font-bold text-slate-900">{payment.memberName}</p><p className="mt-1 text-xs text-slate-500">{member?.mobileNumber || 'No mobile'}</p></div></div></td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{payment.transactionDate}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500"><CreditCard className="h-3.5 w-3.5" />{payment.paymentMode}</p></td><td className="px-4 py-4"><p className="font-bold text-slate-800">{currency(payment.totalFee)}</p>{money(payment.personalTrainingFee) > 0 ? <p className="mt-1 text-xs font-semibold text-violet-600">PT {currency(payment.personalTrainingFee)}</p> : <p className="mt-1 text-xs text-slate-400">Membership only</p>}</td><td className="px-4 py-4 font-black text-emerald-700">{currency(payment.amountPaid)}</td><td className="px-4 py-4"><p className={`font-black ${money(payment.balanceDue) ? 'text-rose-600' : 'text-emerald-600'}`}>{currency(payment.balanceDue)}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle(payment.status)}`}>{payment.status}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={event => go(event, `/payments/invoice/${payment.id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white"><FileText className="h-3.5 w-3.5" /> Invoice</button><button onClick={event => go(event, `/payments/edit/${payment.id}`)} title="Edit" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-700"><Edit className="h-4 w-4" /></button>{member?.mobileNumber ? <a href={getPaymentWhatsAppLink(payment, member.mobileNumber)} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} title="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white"><MessageCircle className="h-4 w-4" /></a> : null}<button onClick={event => void handleDelete(event, payment)} title="Delete" className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>; })}</tbody></table></div></section>
        <section className="space-y-3 md:hidden">{currentData.map(payment => { const member = memberMap.get(payment.membershipId); return <article key={payment.id} onClick={() => router.push(`/payments/invoice/${payment.id}`)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition active:scale-[0.99]"><div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" /><div className="p-4"><div className="flex items-start gap-3"><Avatar member={member} name={payment.memberName} /><div className="min-w-0 flex-1"><h3 className="truncate font-black text-slate-900">{payment.memberName}</h3><p className="mt-0.5 text-xs font-bold text-emerald-700">{payment.invoiceNumber}</p><p className="mt-1 text-[11px] text-slate-500">{payment.transactionDate} · {payment.paymentMode}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusStyle(payment.status)}`}>{payment.status}</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total</p><p className="mt-1 text-xs font-black text-slate-800">{currency(payment.totalFee)}</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Paid</p><p className="mt-1 text-xs font-black text-emerald-700">{currency(payment.amountPaid)}</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-rose-500">Due</p><p className="mt-1 text-xs font-black text-rose-600">{currency(payment.balanceDue)}</p></div></div>{money(payment.personalTrainingFee) > 0 ? <div className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">PT: {payment.personalTrainingPlanName || 'Personal training'} · {currency(payment.personalTrainingFee)}</div> : null}<div className="mt-4 grid grid-cols-5 gap-2 border-t border-slate-100 pt-4"><button onClick={event => go(event, `/payments/invoice/${payment.id}`)} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black text-white"><FileText className="h-4 w-4" /> View invoice</button><button onClick={event => go(event, `/payments/edit/${payment.id}`)} className="flex h-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Edit className="h-4 w-4" /></button>{member?.mobileNumber ? <a href={getPaymentWhatsAppLink(payment, member.mobileNumber)} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="flex h-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><MessageCircle className="h-4 w-4" /></a> : <button disabled className="flex h-10 items-center justify-center rounded-xl bg-slate-100 text-slate-300"><MessageCircle className="h-4 w-4" /></button>}<button onClick={event => void handleDelete(event, payment)} title="Delete payment" className="flex h-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button></div></div></article>; })}</section>
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span>Showing {startIndex + 1}–{Math.min(startIndex + rowsPerPage, filteredPayments.length)} of {filteredPayments.length}</span><select value={rowsPerPage} onChange={event => setRowsPerPage(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-bold text-slate-700"><option value={10}>10/page</option><option value={20}>20/page</option><option value={50}>50/page</option></select></div><div className="flex items-center justify-between gap-2 sm:justify-end"><button onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button><span className="min-w-24 text-center text-xs font-black text-slate-700">Page {currentPage} of {totalPages}</span><button onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button></div></section>
      </>}
    </div>
  );
};
