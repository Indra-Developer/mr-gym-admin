'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeIndianRupee, ChevronLeft, ChevronRight, Download, Dumbbell, Edit, Eye, Filter,
  Loader2, MessageCircle, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, UserCheck, Users, X,
} from 'lucide-react';
import { deleteMember, getMembers, getWhatsAppLink, type Member } from '../services/members';

type StatusFilter = 'All' | Member['status'];
type BalanceFilter = 'All' | 'Due' | 'Clear';
type TrainingFilter = 'All' | 'With PT' | 'Without PT';
type SortOption = 'newest' | 'name-asc' | 'name-desc' | 'expiry-soon' | 'balance-high';

const money = (value: unknown) => Math.max(0, Number(value) || 0);
const formatCurrency = (value: unknown) => `₹${new Intl.NumberFormat('en-IN').format(money(value))}`;
const dateTime = (value: string) => {
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
};
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const statusStyle = (status: Member['status']) => {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Expiring') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Expired') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Frozen') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
};

const Avatar = ({ member }: { member: Member }) => member.profilePicUrl ? (
  <img src={member.profilePicUrl} alt={member.fullName} className="h-11 w-11 shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm" />
) : (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 font-black text-white shadow-sm">
    {member.fullName.trim().charAt(0).toUpperCase() || 'M'}
  </div>
);

const SelectField = ({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) => (
  <label className="block min-w-0"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{children}</select></label>
);

export const Members: React.FC = () => {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [gender, setGender] = useState('All');
  const [plan, setPlan] = useState('All');
  const [shift, setShift] = useState('All');
  const [training, setTraining] = useState<TrainingFilter>('All');
  const [balance, setBalance] = useState<BalanceFilter>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchMembers = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setMembers(await getMembers());
    } catch (fetchError) {
      console.error(fetchError);
      setError('Members could not be loaded. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  const genderOptions = useMemo(() => [...new Set(members.map(member => member.gender).filter(Boolean))].sort(), [members]);
  const planOptions = useMemo(() => [...new Set(members.map(member => member.planType).filter(Boolean))].sort(), [members]);
  const shiftOptions = useMemo(() => [...new Set(members.map(member => member.accessShift).filter(Boolean))].sort(), [members]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: members.length };
    members.forEach(member => { counts[member.status] = (counts[member.status] || 0) + 1; });
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = members.filter(member => {
      const matchesSearch = !term || [member.fullName, member.membershipId, member.mobileNumber, member.email]
        .some(value => String(value || '').toLowerCase().includes(term));
      const hasTraining = money(member.personalTrainingFee) > 0 || Boolean(member.personalTrainingPlanId);
      return matchesSearch
        && (status === 'All' || member.status === status)
        && (gender === 'All' || member.gender === gender)
        && (plan === 'All' || member.planType === plan)
        && (shift === 'All' || member.accessShift === shift)
        && (training === 'All' || (training === 'With PT' ? hasTraining : !hasTraining))
        && (balance === 'All' || (balance === 'Due' ? money(member.balanceDue) > 0 : money(member.balanceDue) === 0));
    });
    return result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.fullName.localeCompare(b.fullName);
      if (sortBy === 'name-desc') return b.fullName.localeCompare(a.fullName);
      if (sortBy === 'expiry-soon') return dateTime(a.expiryDate) - dateTime(b.expiryDate);
      if (sortBy === 'balance-high') return money(b.balanceDue) - money(a.balanceDue);
      return 0;
    });
  }, [balance, gender, members, plan, search, shift, sortBy, status, training]);

  const activeFilterCount = [status !== 'All', gender !== 'All', plan !== 'All', shift !== 'All', training !== 'All', balance !== 'All', sortBy !== 'newest'].filter(Boolean).length;
  const summary = useMemo(() => ({
    total: members.length,
    active: members.filter(member => member.status === 'Active').length,
    attention: members.filter(member => ['Expiring', 'Expired'].includes(member.status)).length,
    training: members.filter(member => money(member.personalTrainingFee) > 0 || member.personalTrainingPlanId).length,
    due: members.reduce((sum, member) => sum + money(member.balanceDue), 0),
  }), [members]);

  useEffect(() => { setCurrentPage(1); }, [search, status, gender, plan, shift, training, balance, sortBy, rowsPerPage]);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / rowsPerPage));
  useEffect(() => { setCurrentPage(page => Math.min(page, totalPages)); }, [totalPages]);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = filteredMembers.slice(startIndex, startIndex + rowsPerPage);

  const clearFilters = () => {
    setSearch(''); setStatus('All'); setGender('All'); setPlan('All'); setShift('All');
    setTraining('All'); setBalance('All'); setSortBy('newest');
  };

  const handleDelete = async (event: React.MouseEvent, member: Member) => {
    event.stopPropagation();
    if (!window.confirm(`Delete ${member.fullName}? The member and membership details will be permanently removed.`)) return;
    try {
      await deleteMember(member.id);
      setMembers(current => current.filter(item => item.id !== member.id));
    } catch (deleteError) {
      console.error(deleteError);
      setError('The member could not be deleted. Please try again.');
    }
  };

  const handleExport = () => {
    if (!filteredMembers.length) return window.alert('No members match the selected filters.');
    const headings = ['Membership ID', 'Full Name', 'Gender', 'Mobile', 'Email', 'Plan', 'Shift', 'Personal Training', 'Start Date', 'Expiry Date', 'Total Fee', 'Paid', 'Balance Due', 'Status'];
    const rows = filteredMembers.map(member => [member.membershipId, member.fullName, member.gender, member.mobileNumber, member.email, member.planType, member.accessShift, member.personalTrainingPlanName || 'No', member.startDate, member.expiryDate, money(member.totalFee), money(member.amountPaid), money(member.balanceDue), member.status].map(csvCell).join(','));
    const blob = new Blob([[headings.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `MRGYM_Members_${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const go = (event: React.MouseEvent, path: string) => { event.stopPropagation(); router.push(path); };
  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-blue-100"><Users className="h-3.5 w-3.5" /> Member directory</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Know every member. Act faster.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Search, segment and manage the complete member base from one responsive workspace.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => void fetchMembers(true)} disabled={refreshing} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold backdrop-blur transition hover:bg-white/20 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button><button onClick={handleExport} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold backdrop-blur transition hover:bg-white/20"><Download className="h-4 w-4" /> Export</button><button onClick={() => router.push('/members/add')} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5 sm:col-span-1"><Plus className="h-4 w-4" /> Add member</button></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[{ label: 'All members', value: summary.total, icon: Users, color: 'text-blue-700 bg-blue-50' }, { label: 'Active', value: summary.active, icon: UserCheck, color: 'text-emerald-700 bg-emerald-50' }, { label: 'Need attention', value: summary.attention, icon: RefreshCw, color: 'text-amber-700 bg-amber-50' }, { label: 'Personal training', value: summary.training, icon: Dumbbell, color: 'text-violet-700 bg-violet-50' }, { label: 'Total outstanding', value: formatCurrency(summary.due), icon: BadgeIndianRupee, color: 'text-rose-700 bg-rose-50' }].map((item, index) => <article key={item.label} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${index === 4 ? 'col-span-2 lg:col-span-1' : ''}`}><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.color}`}><item.icon className="h-4 w-4" /></div><p className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">{item.value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.label}</p></article>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, member ID, mobile or email..." className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />{search ? <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></button> : null}</div><div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => setShowFilters(value => !value)} className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${showFilters || activeFilterCount ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><SlidersHorizontal className="h-4 w-4" /> Filters {activeFilterCount ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] text-white">{activeFilterCount}</span> : null}</button><select value={sortBy} onChange={event => setSortBy(event.target.value as SortOption)} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"><option value="newest">Newest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="expiry-soon">Expiry soon</option><option value="balance-high">Highest balance</option></select></div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(['All', 'Active', 'Expiring', 'Expired', 'Frozen', 'Cancelled'] as StatusFilter[]).map(item => <button key={item} onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition ${status === item ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}>{item} <span className={status === item ? 'text-blue-100' : 'text-slate-400'}>{statusCounts[item] || 0}</span></button>)}</div>
        {showFilters ? <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><SelectField label="Gender" value={gender} onChange={setGender}><option value="All">All genders</option>{genderOptions.map(item => <option key={item}>{item}</option>)}</SelectField><SelectField label="Plan" value={plan} onChange={setPlan}><option value="All">All plans</option>{planOptions.map(item => <option key={item}>{item}</option>)}</SelectField><SelectField label="Shift" value={shift} onChange={setShift}><option value="All">All shifts</option>{shiftOptions.map(item => <option key={item}>{item}</option>)}</SelectField><SelectField label="Personal training" value={training} onChange={value => setTraining(value as TrainingFilter)}><option value="All">All members</option><option value="With PT">With PT</option><option value="Without PT">Without PT</option></SelectField><SelectField label="Payment balance" value={balance} onChange={value => setBalance(value as BalanceFilter)}><option value="All">Any balance</option><option value="Due">Balance due</option><option value="Clear">Fully clear</option></SelectField></div><div className="mt-4 flex items-center justify-between"><p className="text-xs font-semibold text-slate-500"><Filter className="mr-1 inline h-3.5 w-3.5" />{filteredMembers.length} members match</p><button onClick={clearFilters} className="text-xs font-black text-blue-700 hover:text-blue-900">Clear all filters</button></div></div> : null}
      </section>

      {error ? <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={() => void fetchMembers()} className="rounded-lg bg-rose-100 px-3 py-1.5 font-bold">Retry</button></div> : null}
      {loading ? <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : filteredMembers.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Search className="h-6 w-6 text-slate-400" /></div><h2 className="mt-4 text-lg font-black text-slate-800">No members found</h2><p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p><button onClick={clearFilters} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Reset filters</button></div> : <>
        <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Member</th><th className="px-4 py-4">Gender / Contact</th><th className="px-4 py-4">Membership</th><th className="px-4 py-4">Timeline</th><th className="px-4 py-4">Financials</th><th className="px-4 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{currentData.map(member => <tr key={member.id} onClick={() => router.push(`/members/${member.id}`)} className="cursor-pointer transition hover:bg-blue-50/40"><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar member={member} /><div className="min-w-0"><p className="max-w-52 truncate font-black text-slate-900">{member.fullName}</p><p className="mt-0.5 text-xs font-semibold text-blue-600">{member.membershipId}</p></div></div></td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{member.gender || 'Not specified'}</p><p className="mt-1 text-xs text-slate-500">{member.mobileNumber}</p></td><td className="px-4 py-4"><p className="font-bold text-slate-800">{member.planType}</p><p className="mt-1 text-xs text-slate-500">{member.accessShift} shift</p>{money(member.personalTrainingFee) > 0 ? <span className="mt-1.5 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">Personal training</span> : null}</td><td className="px-4 py-4"><p className="text-xs text-slate-500">Starts <b className="text-slate-700">{member.startDate}</b></p><p className="mt-1 text-xs text-slate-500">Expires <b className="text-slate-700">{member.expiryDate}</b></p></td><td className="px-4 py-4"><p className="font-black text-slate-900">{formatCurrency(member.totalFee)}</p><p className={`mt-1 text-xs font-bold ${money(member.balanceDue) ? 'text-rose-600' : 'text-emerald-600'}`}>{money(member.balanceDue) ? `${formatCurrency(member.balanceDue)} due` : 'Fully paid'}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle(member.status)}`}>{member.status}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={event => go(event, `/members/${member.id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"><Eye className="h-3.5 w-3.5" /> Details</button><button onClick={event => go(event, `/members/edit/${member.id}`)} title="Edit" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700"><Edit className="h-4 w-4" /></button><a href={getWhatsAppLink(member)} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} title="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white"><MessageCircle className="h-4 w-4" /></a><button onClick={event => void handleDelete(event, member)} title="Delete" className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div></section>
        <section className="space-y-3 md:hidden">{currentData.map(member => <article key={member.id} onClick={() => router.push(`/members/${member.id}`)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition active:scale-[0.99]"><div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-violet-500" /><div className="p-4"><div className="flex items-start gap-3"><Avatar member={member} /><div className="min-w-0 flex-1"><h3 className="truncate font-black text-slate-900">{member.fullName}</h3><p className="mt-0.5 text-xs font-bold text-blue-600">{member.membershipId} · {member.gender || '—'}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusStyle(member.status)}`}>{member.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Plan & shift</p><p className="mt-1 truncate text-xs font-black text-slate-800">{member.planType}</p><p className="mt-0.5 text-[11px] text-slate-500">{member.accessShift}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Expires</p><p className="mt-1 text-xs font-black text-slate-800">{member.expiryDate}</p><p className={`mt-0.5 text-[11px] font-bold ${money(member.balanceDue) ? 'text-rose-600' : 'text-emerald-600'}`}>{money(member.balanceDue) ? `${formatCurrency(member.balanceDue)} due` : 'Payment clear'}</p></div></div>{money(member.personalTrainingFee) > 0 ? <div className="mt-2 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><Dumbbell className="h-4 w-4" /> {member.personalTrainingPlanName || 'Personal training'} · {formatCurrency(member.personalTrainingFee)}</div> : null}<div className="mt-4 grid grid-cols-4 gap-2 border-t border-slate-100 pt-4"><button onClick={event => go(event, `/members/${member.id}`)} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs font-black text-white"><Eye className="h-4 w-4" /> View details</button><button onClick={event => go(event, `/members/edit/${member.id}`)} className="flex h-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Edit className="h-4 w-4" /></button><a href={getWhatsAppLink(member)} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="flex h-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><MessageCircle className="h-4 w-4" /></a></div></div></article>)}</section>
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span>Showing {startIndex + 1}–{Math.min(startIndex + rowsPerPage, filteredMembers.length)} of {filteredMembers.length}</span><select value={rowsPerPage} onChange={event => setRowsPerPage(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-bold text-slate-700"><option value={10}>10/page</option><option value={20}>20/page</option><option value={50}>50/page</option></select></div><div className="flex items-center justify-between gap-2 sm:justify-end"><button onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button><span className="min-w-24 text-center text-xs font-black text-slate-700">Page {currentPage} of {totalPages}</span><button onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button></div></section>
      </>}
    </div>
  );
};
