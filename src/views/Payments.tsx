'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, FileText, MessageCircle, ArrowUpRight, ArrowDownRight, Clock, Loader2, Download, Edit, Trash2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPayments, deletePayment, type Payment } from '../services/payments';
import { getMembers, type Member } from '../services/members'; 

export const Payments: React.FC = () => {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // --- REVENUE EXPLORER STATES ---
  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.slice(0, 7);
  const currentYear = new Date().getFullYear();
  
  const [periodType, setPeriodType] = useState<'day' | 'month' | 'year'>('month');
  const [periodValue, setPeriodValue] = useState(monthStr);

  const years = Array.from({length: 5}, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (periodType === 'day') setPeriodValue(todayStr);
    if (periodType === 'month') setPeriodValue(monthStr);
    if (periodType === 'year') setPeriodValue(currentYear.toString());
  }, [periodType, todayStr, monthStr, currentYear]);

  // --- DATA FETCHING ---
  const fetchData = () => {
    setLoading(true);
    Promise.all([getPayments(), getMembers()]).then(([paymentsData, membersData]) => {
      setPayments(paymentsData);
      setMembers(membersData);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  // --- ACTIONS ---
  const handleDelete = async (e: React.MouseEvent, id: string, invoiceNumber: string) => {
    e.stopPropagation(); // Prevent row click
    if (window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`)) {
      await deletePayment(id);
      fetchData(); 
    }
  };

  const handleActionClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation(); // Prevent row click
    router.push(path);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
  };

  const handleExport = () => {
    if (filtered.length === 0) return alert("No data to export.");
    const separator = ',';
    const keys = ['Invoice', 'Member Name', 'Member ID', 'Date', 'Mode', 'Membership Fee', 'Personal Training', 'Personal Training Fee', 'Total Fee', 'Amount Paid', 'Balance Due', 'Status'];
    
    const csvContent = [
      keys.join(separator),
      ...filtered.map(p => [
        p.invoiceNumber, `"${p.memberName}"`, p.membershipId, p.transactionDate,
        p.paymentMode,
        p.membershipFee ?? Math.max(0, p.totalFee - (p.personalTrainingFee || 0)),
        `"${p.personalTrainingPlanName || 'None'}${p.personalTrainingPlanDuration ? ` (${p.personalTrainingPlanDuration})` : ''}"`,
        p.personalTrainingFee || 0,
        p.totalFee,
        p.amountPaid,
        p.balanceDue,
        p.status
      ].join(separator))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MRGYM_Payments_${todayStr}.csv`;
    link.click();
  };

  // --- DYNAMIC STATS CALCULATION ---
  const totalLifetimeCollection = payments.reduce((sum, p) => sum + p.amountPaid, 0);
  const todayCollection = payments.filter(p => p.transactionDate === todayStr).reduce((sum, p) => sum + p.amountPaid, 0);
  const pendingBalance = members.reduce((sum, m) => sum + (m.balanceDue || 0), 0);
  
  const customCollection = payments.filter(p => {
    if (!periodValue) return false;
    if (periodType === 'day') return p.transactionDate === periodValue;
    if (periodType === 'month') return p.transactionDate.startsWith(periodValue);
    if (periodType === 'year') return p.transactionDate.startsWith(periodValue);
    return false;
  }).reduce((sum, p) => sum + p.amountPaid, 0);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN').format(amount);

  const getStatusStyle = (status: string) => {
    if (status === 'Paid') return 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20';
    if (status === 'Partial') return 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20';
    return 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20';
  };

  // --- FILTERING ---
  const filtered = payments.filter(p => {
    const searchLower = search.toLowerCase();
    const member = members.find(m => m.membershipId === p.membershipId);
    const matchSearch = 
      p.memberName.toLowerCase().includes(searchLower) || 
      p.invoiceNumber.toLowerCase().includes(searchLower) ||
      p.membershipId.toLowerCase().includes(searchLower) ||
      (member && member.mobileNumber.includes(searchLower)) ||
      (member && member.email && member.email.toLowerCase().includes(searchLower));

    // "Due" means the member still has an outstanding balance after this payment.
    // This intentionally includes partial payments, because they still require collection.
    const matchFilter = filter === 'All' || (filter === 'Due' ? Number(p.balanceDue) > 0 : p.status === filter);
    return matchSearch && matchFilter;
  });

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Payments</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage all membership payment records</p>
        </div>
      </div>

      {/* --- STAT CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div className="text-xs text-[#6B7280] mb-2 font-medium">Total Lifetime Collection</div>
          <div className="flex justify-between items-end">
            <div className="text-xl sm:text-2xl font-bold text-[#1F2937]">₹{formatCurrency(totalLifetimeCollection)}</div>
            <ArrowUpRight className="text-[#16A34A] h-5 w-5 bg-[#16A34A]/10 p-0.5 rounded" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div className="text-xs text-[#6B7280] mb-2 font-medium">Total Gym Pending Balance</div>
          <div className="flex justify-between items-end">
            <div className="text-xl sm:text-2xl font-bold text-[#DC2626]">₹{formatCurrency(pendingBalance)}</div>
            <ArrowDownRight className="text-[#DC2626] h-5 w-5 bg-[#DC2626]/10 p-0.5 rounded" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div className="text-xs text-[#6B7280] mb-2 font-medium">Today's Collection</div>
          <div className="flex justify-between items-end">
            <div className="text-xl sm:text-2xl font-bold text-[#1F2937]">₹{formatCurrency(todayCollection)}</div>
            <Clock className="text-[#2563EB] h-5 w-5 bg-[#2563EB]/10 p-0.5 rounded" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#2563EB]/30 bg-[#2563EB]/5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
            <select value={periodType} onChange={(e) => setPeriodType(e.target.value as any)} className="min-h-9 text-xs font-bold text-[#2563EB] bg-transparent outline-none cursor-pointer">
              <option value="day">Day Revenue</option>
              <option value="month">Month Revenue</option>
              <option value="year">Year Revenue</option>
            </select>
            
            {periodType === 'day' && <input type="date" value={periodValue} onChange={e=>setPeriodValue(e.target.value)} className="text-xs outline-none bg-white border border-[#2563EB]/20 rounded px-1 text-[#1F2937] py-0.5 cursor-pointer" />}
            {periodType === 'month' && <input type="month" value={periodValue} onChange={e=>setPeriodValue(e.target.value)} className="text-xs outline-none bg-white border border-[#2563EB]/20 rounded px-1 text-[#1F2937] py-0.5 cursor-pointer" />}
            {periodType === 'year' && (
              <select value={periodValue} onChange={e=>setPeriodValue(e.target.value)} className="text-xs outline-none bg-white border border-[#2563EB]/20 rounded px-1.5 text-[#1F2937] py-0.5 cursor-pointer">
                {years.map(y => <option key={y} value={y.toString()}>{y}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-between items-end mt-1">
            <div className="text-xl sm:text-2xl font-bold text-[#2563EB]">₹{formatCurrency(customCollection)}</div>
            <Calendar className="text-[#2563EB] h-5 w-5 opacity-70" />
          </div>
        </div>

      </div>

      {/* --- CONTROLS --- */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
          <input type="text" placeholder="Search by member, ID, mobile, or email..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button onClick={handleExport} className="flex h-11 w-full sm:w-auto px-3 sm:px-4 bg-white text-[#4B5563] border border-[#E5E7EB] rounded-lg items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors"><Download className="h-4 w-4" /> Export CSV</button>
          <button onClick={() => router.push('/payments/record')} className="flex h-11 w-full sm:w-auto px-3 sm:px-4 bg-[#2563EB] text-white rounded-lg items-center justify-center gap-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors"><Plus className="h-4 w-4" /> Record Payment</button>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
        {['All', 'Paid', 'Partial', 'Due'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50'}`}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>
      ) : (
        <>
          {/* --- DESKTOP TABLE --- */}
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm sm:block">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-slate-50/80 px-4 py-2 text-[11px] font-medium text-slate-500">
              <span>Payment records</span>
              <span className="inline-flex items-center gap-1">Scroll horizontally for all details <ChevronRight className="h-3.5 w-3.5" /></span>
            </div>
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain pb-2 [scrollbar-color:#94A3B8_#E2E8F0] [scrollbar-width:thin]">
            <table className="w-full min-w-[1050px] text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Date & Mode</th>
                  <th className="px-4 py-3 font-medium">Amount Paid</th>
                  <th className="px-4 py-3 font-medium">Balance Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {currentData.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6B7280]">No payments found for this criteria.</td></tr>
                ) : null}
                
                {currentData.map(p => {
                  const m = members.find(mbr => mbr.membershipId === p.membershipId);
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => router.push(`/payments/invoice/${p.id}`)} 
                      className="hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[#1F2937]">{p.invoiceNumber}</td>
                      
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {m?.profilePicUrl ? (
                            <img src={m.profilePicUrl} alt={p.memberName} className="h-9 w-9 rounded-full object-cover border border-gray-200 shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] font-bold border border-gray-200 shrink-0">
                              {p.memberName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-[#1F2937]">{p.memberName}</div>
                            <div className="text-xs text-[#6B7280]">{p.membershipId}</div>
                            {(p.personalTrainingFee || 0) > 0 && <div className="text-[11px] text-cyan-700">PT: {p.personalTrainingPlanName || 'Personal Training'}{p.personalTrainingPlanDuration ? ` · ${p.personalTrainingPlanDuration}` : ''}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[#4B5563]"><div>{p.transactionDate}</div><div className="text-xs text-[#6B7280]">{p.paymentMode}</div></td>
                      <td className="px-4 py-3 font-semibold text-[#16A34A]">₹{formatCurrency(p.amountPaid)}</td>
                      <td className="px-4 py-3 font-medium text-[#DC2626]">₹{formatCurrency(p.balanceDue)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-xs font-medium border rounded-md ${getStatusStyle(p.status)}`}>{p.status}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={(e) => handleActionClick(e, `/payments/invoice/${p.id}`)} title="View Invoice" className="p-1.5 text-[#2563EB] bg-[#2563EB]/10 rounded-md hover:bg-[#2563EB]/20"><FileText className="h-4 w-4" /></button>
                          <button onClick={(e) => handleActionClick(e, `/payments/edit/${p.id}`)} title="Edit Payment" className="p-1.5 text-[#6B7280] bg-gray-50 border border-[#E5E7EB] rounded-md hover:text-[#2563EB]"><Edit className="h-4 w-4" /></button>
                          {m?.mobileNumber && (
                            <a href={`https://wa.me/91${m.mobileNumber}?text=Hello ${p.memberName}, your payment for ${p.invoiceNumber} has been recorded.`} target="_blank" rel="noreferrer" onClick={handleWhatsApp} title="WhatsApp" className="p-1.5 text-white bg-[#25D366] rounded-md hover:bg-[#20bd5a]"><MessageCircle className="h-4 w-4" /></a>
                          )}
                          <button onClick={(e) => handleDelete(e, p.id, p.invoiceNumber)} title="Delete Payment" className="p-1.5 text-[#6B7280] bg-gray-50 border border-[#E5E7EB] rounded-md hover:text-[#DC2626]"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-white">
                <div className="text-sm text-[#6B7280]">
                  Showing <span className="font-medium text-[#1F2937]">{startIndex + 1}</span> to <span className="font-medium text-[#1F2937]">{Math.min(startIndex + rowsPerPage, filtered.length)}</span> of <span className="font-medium text-[#1F2937]">{filtered.length}</span> results
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md border border-[#E5E7EB] text-[#4B5563] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md border border-[#E5E7EB] text-[#4B5563] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- MOBILE CARDS --- */}
          <div className="sm:hidden space-y-3">
             {currentData.map(p => {
               const m = members.find(mbr => mbr.membershipId === p.membershipId);
               return (
                <div 
                  key={p.id} 
                  onClick={() => router.push(`/payments/invoice/${p.id}`)}
                  className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col gap-3 active:bg-gray-50 transition-colors"
                >
                   <div className="flex justify-between items-start mb-1">
                     <div className="flex items-center gap-3">
                       {m?.profilePicUrl ? (
                         <img src={m.profilePicUrl} alt={p.memberName} className="h-10 w-10 rounded-full object-cover border border-gray-200 shrink-0" />
                       ) : (
                         <div className="h-10 w-10 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] font-bold text-lg border border-gray-200 shrink-0">
                           {p.memberName.charAt(0).toUpperCase()}
                         </div>
                       )}
                       <div>
                         <h3 className="font-bold text-[#1F2937] text-base">{p.memberName}</h3>
                         <p className="text-xs text-[#6B7280]">{p.invoiceNumber} • {p.transactionDate}</p>
                         {(p.personalTrainingFee || 0) > 0 && <p className="text-[11px] text-cyan-700 mt-0.5">PT: {p.personalTrainingPlanName || 'Personal Training'}{p.personalTrainingPlanDuration ? ` · ${p.personalTrainingPlanDuration}` : ''} · ₹{formatCurrency(p.personalTrainingFee || 0)}</p>}
                       </div>
                     </div>
                     <span className={`px-2 py-0.5 text-xs font-medium border rounded-md ${getStatusStyle(p.status)}`}>{p.status}</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-[#F3F4F6]">
                       <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">Paid</div>
                        <div className="font-bold text-[#1F2937]">₹{formatCurrency(p.amountPaid)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#6B7280]">Balance</div>
                        <div className="font-bold text-[#DC2626]">₹{formatCurrency(p.balanceDue)}</div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                     <button onClick={(e) => handleActionClick(e, `/payments/invoice/${p.id}`)} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#2563EB] bg-[#2563EB]/10 rounded-lg"><FileText className="h-4 w-4" /> Invoice</button>
                     <button onClick={(e) => handleActionClick(e, `/payments/edit/${p.id}`)} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#4B5563] bg-gray-100 rounded-lg"><Edit className="h-4 w-4" /> Edit</button>
                     {m?.mobileNumber ? (
                       <a href={`https://wa.me/91${m.mobileNumber}?text=Hello ${p.memberName}, your payment for ${p.invoiceNumber} has been recorded.`} target="_blank" rel="noreferrer" onClick={handleWhatsApp} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-white bg-[#25D366] rounded-lg"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                     ) : (
                       <button type="button" disabled className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#9CA3AF] bg-gray-100 rounded-lg cursor-not-allowed"><MessageCircle className="h-4 w-4" /> No mobile</button>
                     )}
                     <button onClick={(e) => handleDelete(e, p.id, p.invoiceNumber)} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 rounded-lg"><Trash2 className="h-4 w-4" /> Delete</button>
                   </div>
                </div>
               )
             })}
             
             {currentData.length === 0 && (
                <div className="text-center py-10 bg-white rounded-xl border border-[#E5E7EB] text-[#6B7280]">No payments found.</div>
             )}

             {/* Mobile Pagination Controls */}
             {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-2 mt-4">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] disabled:opacity-50">Prev</button>
                <span className="text-sm font-medium text-[#6B7280]">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] disabled:opacity-50">Next</button>
              </div>
             )}
          </div>
        </>
      )}
      
    </div>
  );
};
