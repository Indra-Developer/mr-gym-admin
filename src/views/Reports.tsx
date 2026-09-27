'use client';

import React, { useEffect, useState } from 'react';
import { Download, Loader2, Eye, Trash2, X, FileText } from 'lucide-react';
import { getMembers, type Member } from '../services/members';
import { getPayments, type Payment } from '../services/payments';
import { getRecentExports, logExport, downloadCSV, deleteExportLog, clearAllExportLogs, type ExportLog } from '../services/reports';
import { useAuth } from '../context/AuthContext';

type ReportType =
  | 'Member Report'
  | 'Payment Report'
  | 'Active Members'
  | 'Expired Members'
  | 'Pending Payments';

type ReportRow = Record<string, string | number>;

type ReportFilters = {
  memberStart: string;
  memberEnd: string;
  memberStatus: string;
  paymentStart: string;
  paymentEnd: string;
  paymentStatus: string;
  activeStart: string;
  activeEnd: string;
  activePlan: string;
  expiredStart: string;
  expiredEnd: string;
  expiredPlan: string;
  pendingStart: string;
  pendingEnd: string;
  pendingRange: string;
};

export const Reports: React.FC = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [exporting, setExporting] = useState<ReportType | null>(null);

  // Live Database Data
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);

  // Preview Modal States
  const [previewData, setPreviewData] = useState<ReportRow[] | null>(null);
  const [previewType, setPreviewType] = useState<ReportType | null>(null);

  // Filter States
  const [filters, setFilters] = useState<ReportFilters>({
    memberStart: '', memberEnd: '', memberStatus: 'All',
    paymentStart: '', paymentEnd: '', paymentStatus: 'All',
    activeStart: '', activeEnd: '', activePlan: 'All',
    expiredStart: '', expiredEnd: '', expiredPlan: 'All',
    pendingStart: '', pendingEnd: '', pendingRange: 'All',
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoadError('');
        const [membersData, paymentsData, logsData] = await Promise.all([
          getMembers(),
          getPayments(),
          getRecentExports(),
        ]);

        if (!cancelled) {
          setMembers(membersData);
          setPayments(paymentsData);
          setExportLogs(logsData);
        }
      } catch (error) {
        console.error('Error loading report data', error);
        if (!cancelled) setLoadError('The report data could not be loaded. Please refresh and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, []);

  const updateFilter = (field: keyof ReportFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // --- STATS CALCULATION ---
  const activeMembersCount = members.filter(m => m.status === 'Active').length;
  const money = (value: unknown) => Math.max(0, Number(value) || 0);
  const totalRevenue = payments.reduce((sum, p) => sum + money(p.amountPaid), 0);
  const pendingBalance = members.reduce((sum, m) => sum + money(m.balanceDue), 0);
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN').format(amount);
  const planOptions = Array.from(new Set(members.map(member => member.planType).filter(Boolean))).sort();

  // --- DATA GENERATOR (Used by both Export and Preview) ---
  const generateReportData = (type: ReportType): ReportRow[] => {
    let data: ReportRow[] = [];
    
    if (type === 'Member Report') {
      data = members.filter(m => {
        const inDate = (!filters.memberStart || m.startDate >= filters.memberStart) && (!filters.memberEnd || m.startDate <= filters.memberEnd);
        const inStatus = filters.memberStatus === 'All' || m.status === filters.memberStatus;
        return inDate && inStatus;
      }).map(m => ({
        'ID': m.membershipId, 'Full Name': m.fullName, 'Mobile': m.mobileNumber, 'Plan': m.planType,
        'Personal Training': m.personalTrainingPlanName || 'None',
        'Personal Training Duration': m.personalTrainingPlanDuration || '',
        'Membership Fee': `₹${formatCurrency(money(m.membershipFee ?? Math.max(0, m.totalFee - (m.personalTrainingFee || 0))))}`,
        'Personal Training Fee': `₹${formatCurrency(money(m.personalTrainingFee))}`,
        'Total Fee': `₹${formatCurrency(money(m.totalFee))}`,
        'Status': m.status, 'Start Date': m.startDate, 'Expiry Date': m.expiryDate, 'Balance Due': `₹${formatCurrency(money(m.balanceDue))}`
      }));
    } 
    else if (type === 'Payment Report') {
      data = payments.filter(p => {
        const inDate = (!filters.paymentStart || p.transactionDate >= filters.paymentStart) && (!filters.paymentEnd || p.transactionDate <= filters.paymentEnd);
        const inStatus = filters.paymentStatus === 'All' || p.status === filters.paymentStatus;
        return inDate && inStatus;
      }).map(p => ({
        'Invoice': p.invoiceNumber, 'Member Name': p.memberName, 'Date': p.transactionDate, 'Mode': p.paymentMode,
        'Membership Fee': `₹${formatCurrency(money(p.membershipFee ?? Math.max(0, p.totalFee - (p.personalTrainingFee || 0))))}`,
        'Personal Training': p.personalTrainingPlanName || 'None',
        'Personal Training Fee': `₹${formatCurrency(money(p.personalTrainingFee))}`,
        'Total Fee': `₹${formatCurrency(money(p.totalFee))}`,
        'Amount Paid': `₹${formatCurrency(money(p.amountPaid))}`, 'Status': p.status
      }));
    }
    else if (type === 'Active Members') {
      data = members.filter(m => {
        const isActive = m.status === 'Active';
        const inDate = (!filters.activeStart || m.expiryDate >= filters.activeStart) && (!filters.activeEnd || m.expiryDate <= filters.activeEnd);
        const inPlan = filters.activePlan === 'All' || m.planType === filters.activePlan;
        return isActive && inDate && inPlan;
      }).map(m => ({
        'ID': m.membershipId, 'Full Name': m.fullName, 'Mobile': m.mobileNumber, 'Plan': m.planType, 'Personal Training': m.personalTrainingPlanName || 'None', 'Expiry Date': m.expiryDate
      }));
    }
    else if (type === 'Expired Members') {
      data = members.filter(m => {
        const isExpired = m.status === 'Expired';
        const inDate = (!filters.expiredStart || m.expiryDate >= filters.expiredStart) && (!filters.expiredEnd || m.expiryDate <= filters.expiredEnd);
        const inPlan = filters.expiredPlan === 'All' || m.planType === filters.expiredPlan;
        return isExpired && inDate && inPlan;
      }).map(m => ({
        'ID': m.membershipId, 'Full Name': m.fullName, 'Mobile': m.mobileNumber, 'Plan': m.planType, 'Personal Training': m.personalTrainingPlanName || 'None', 'Expired On': m.expiryDate
      }));
    }
    else if (type === 'Pending Payments') {
      data = members.filter(member => {
        const balanceDue = money(member.balanceDue);
        const inDate = (!filters.pendingStart || member.expiryDate >= filters.pendingStart) && (!filters.pendingEnd || member.expiryDate <= filters.pendingEnd);
        let inRange = true;
        if (filters.pendingRange === '<₹500') inRange = balanceDue < 500;
        if (filters.pendingRange === '₹500-₹2000') inRange = balanceDue >= 500 && balanceDue <= 2000;
        if (filters.pendingRange === '>₹2000') inRange = balanceDue > 2000;
        return balanceDue > 0 && inDate && inRange;
      }).map(member => ({
        'ID': member.membershipId,
        'Member Name': member.fullName,
        'Mobile': member.mobileNumber,
        'Personal Training': member.personalTrainingPlanName || 'None',
        'Expiry Date': member.expiryDate,
        'Total Fee': `₹${formatCurrency(money(member.totalFee))}`,
        'Amount Paid': `₹${formatCurrency(money(member.amountPaid))}`,
        'Balance Due': `₹${formatCurrency(money(member.balanceDue))}`,
      }));
    }
    
    return data;
  };

  // --- ACTIONS ---
  const getDateRangeError = (type: ReportType) => {
    const dateRangeByType: Record<ReportType, [string, string]> = {
      'Member Report': [filters.memberStart, filters.memberEnd],
      'Payment Report': [filters.paymentStart, filters.paymentEnd],
      'Active Members': [filters.activeStart, filters.activeEnd],
      'Expired Members': [filters.expiredStart, filters.expiredEnd],
      'Pending Payments': [filters.pendingStart, filters.pendingEnd],
    };
    const [start, end] = dateRangeByType[type];
    return start && end && start > end ? 'Start date cannot be later than end date.' : '';
  };

  const handlePreview = (type: ReportType) => {
    const rangeError = getDateRangeError(type);
    if (rangeError) return alert(rangeError);
    const data = generateReportData(type);
    if (data.length === 0) return alert('No data found for the selected filters.');
    setPreviewType(type);
    setPreviewData(data);
  };

  const isReportType = (value: string): value is ReportType => [
    'Member Report',
    'Payment Report',
    'Active Members',
    'Expired Members',
    'Pending Payments',
  ].includes(value);

  const rerunReport = (reportType: string) => {
    if (!isReportType(reportType)) {
      alert('This older export type is no longer available.');
      return;
    }
    handlePreview(reportType);
  };

  const handleExport = async (type: ReportType) => {
    const rangeError = getDateRangeError(type);
    if (rangeError) return alert(rangeError);

    const dataToExport = generateReportData(type);
    if (dataToExport.length === 0) return alert('No data available to export for the selected filters.');

    setExporting(type);
    try {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const fileName = `${type.replace(/\s+/g, '_')}_${dateStr}`;
      const success = downloadCSV(dataToExport, fileName);

      if (!success) throw new Error('The browser could not start the CSV download.');

      await logExport(`${fileName}.csv`, type, admin?.name || 'Admin');
      setExportLogs(await getRecentExports());
    } catch (error) {
      console.error('Error exporting report', error);
      alert(error instanceof Error ? error.message : 'The report could not be exported.');
    } finally {
      setExporting(null);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if(window.confirm("Delete this history record?")) {
      try {
        await deleteExportLog(id);
        setExportLogs(current => current.filter(log => log.id !== id));
      } catch (error) {
        console.error('Error deleting export history', error);
        alert('The export history record could not be deleted.');
      }
    }
  };

  const handleClearAllLogs = async () => {
    if(window.confirm("Are you sure you want to clear ALL export history? This cannot be undone.")) {
      try {
        await clearAllExportLogs();
        setExportLogs([]);
      } catch (error) {
        console.error('Error clearing export history', error);
        alert('The export history could not be cleared.');
      }
    }
  };

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return '-';
    const value = timestamp as { toDate?: () => Date; seconds?: number };
    const d = typeof value.toDate === 'function'
      ? value.toDate()
      : typeof value.seconds === 'number'
        ? new Date(value.seconds * 1000)
        : new Date(timestamp as string | number | Date);
    if (Number.isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>;
  if (loadError) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-red-700">{loadError}</div>;

  return (
    <div className="space-y-6 pb-8">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">Reports & Export</h1>
        <p className="text-sm text-[#6B7280]">Generate and download custom gym data reports</p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <div className="text-sm text-[#6B7280] mb-1">Total Members</div>
          <div className="text-2xl font-bold text-[#1F2937]">{members.length}</div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <div className="text-sm text-[#6B7280] mb-1">Active Members</div>
          <div className="text-2xl font-bold text-[#1F2937]">{activeMembersCount}</div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <div className="text-sm text-[#6B7280] mb-1">Total Revenue (₹)</div>
          <div className="text-2xl font-bold text-[#1F2937]">₹{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
          <div className="text-sm text-[#6B7280] mb-1">Pending Balance (₹)</div>
          <div className="text-2xl font-bold text-[#DC2626]">₹{formatCurrency(pendingBalance)}</div>
        </div>
      </div>

      {/* REPORT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        
        {/* Card 1: Member Report */}
        <div className="min-w-0 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col">
          <h3 className="font-bold text-[#1F2937] mb-4">Member Report</h3>
          <div className="space-y-3 flex-1">
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Start Date</label><input type="date" value={filters.memberStart} onChange={e => updateFilter('memberStart', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">End Date</label><input type="date" value={filters.memberEnd} onChange={e => updateFilter('memberEnd', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Status</label><select value={filters.memberStatus} onChange={e => updateFilter('memberStatus', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none bg-white focus:border-[#2563EB]"><option>All</option><option>Active</option><option>Expiring</option><option>Expired</option><option>Frozen</option><option>Cancelled</option></select></div>
          </div>
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col min-[360px]:flex-row justify-between min-[360px]:items-center gap-3">
            <button onClick={() => handlePreview('Member Report')} className="text-sm font-semibold text-[#2563EB] flex items-center gap-1 hover:underline"><Eye className="w-4 h-4"/> Preview</button>
            <button onClick={() => handleExport('Member Report')} disabled={exporting !== null} className="px-4 py-2 bg-[#1F2937] text-white text-sm rounded-lg font-medium hover:bg-black flex gap-2 items-center transition-colors">
              {exporting === 'Member Report' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Export CSV
            </button>
          </div>
        </div>

        {/* Card 2: Payment Report */}
        <div className="min-w-0 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col">
          <h3 className="font-bold text-[#1F2937] mb-4">Payment Report</h3>
          <div className="space-y-3 flex-1">
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Start Date</label><input type="date" value={filters.paymentStart} onChange={e => updateFilter('paymentStart', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">End Date</label><input type="date" value={filters.paymentEnd} onChange={e => updateFilter('paymentEnd', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Status</label><select value={filters.paymentStatus} onChange={e => updateFilter('paymentStatus', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none bg-white focus:border-[#2563EB]"><option>All</option><option>Paid</option><option>Partial</option><option>Due</option></select></div>
          </div>
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col min-[360px]:flex-row justify-between min-[360px]:items-center gap-3">
            <button onClick={() => handlePreview('Payment Report')} className="text-sm font-semibold text-[#2563EB] flex items-center gap-1 hover:underline"><Eye className="w-4 h-4"/> Preview</button>
            <button onClick={() => handleExport('Payment Report')} disabled={exporting !== null} className="px-4 py-2 bg-[#1F2937] text-white text-sm rounded-lg font-medium hover:bg-black flex gap-2 items-center transition-colors">
              {exporting === 'Payment Report' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Export CSV
            </button>
          </div>
        </div>

        {/* Card 3: Active Members */}
        <div className="min-w-0 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col">
          <h3 className="font-bold text-[#1F2937] mb-4">Active Members</h3>
          <div className="space-y-3 flex-1">
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Expiry Start Date</label><input type="date" value={filters.activeStart} onChange={e => updateFilter('activeStart', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Expiry End Date</label><input type="date" value={filters.activeEnd} onChange={e => updateFilter('activeEnd', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Plan</label><select value={filters.activePlan} onChange={e => updateFilter('activePlan', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none bg-white focus:border-[#2563EB]"><option>All</option>{planOptions.map(plan => <option key={plan} value={plan}>{plan}</option>)}</select></div>
          </div>
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col min-[360px]:flex-row justify-between min-[360px]:items-center gap-3">
            <button onClick={() => handlePreview('Active Members')} className="text-sm font-semibold text-[#2563EB] flex items-center gap-1 hover:underline"><Eye className="w-4 h-4"/> Preview</button>
            <button onClick={() => handleExport('Active Members')} disabled={exporting !== null} className="px-4 py-2 bg-[#1F2937] text-white text-sm rounded-lg font-medium hover:bg-black flex gap-2 items-center transition-colors">
              {exporting === 'Active Members' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Export CSV
            </button>
          </div>
        </div>

        {/* Card 4: Expired Members */}
        <div className="min-w-0 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col">
          <h3 className="font-bold text-[#1F2937] mb-4">Expired Members</h3>
          <div className="space-y-3 flex-1">
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Expiry Start</label><input type="date" value={filters.expiredStart} onChange={e => updateFilter('expiredStart', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Expiry End</label><input type="date" value={filters.expiredEnd} onChange={e => updateFilter('expiredEnd', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Plan</label><select value={filters.expiredPlan} onChange={e => updateFilter('expiredPlan', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none bg-white focus:border-[#2563EB]"><option>All</option>{planOptions.map(plan => <option key={plan} value={plan}>{plan}</option>)}</select></div>
          </div>
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col min-[360px]:flex-row justify-between min-[360px]:items-center gap-3">
            <button onClick={() => handlePreview('Expired Members')} className="text-sm font-semibold text-[#2563EB] flex items-center gap-1 hover:underline"><Eye className="w-4 h-4"/> Preview</button>
            <button onClick={() => handleExport('Expired Members')} disabled={exporting !== null} className="px-4 py-2 bg-[#1F2937] text-white text-sm rounded-lg font-medium hover:bg-black flex gap-2 items-center transition-colors">
              {exporting === 'Expired Members' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Export CSV
            </button>
          </div>
        </div>

        {/* Card 5: Pending Payments */}
        <div className="min-w-0 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col">
          <h3 className="font-bold text-[#1F2937] mb-4">Pending Payments</h3>
          <div className="space-y-3 flex-1">
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Expiry Start</label><input type="date" value={filters.pendingStart} onChange={e => updateFilter('pendingStart', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Expiry End</label><input type="date" value={filters.pendingEnd} onChange={e => updateFilter('pendingEnd', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none focus:border-[#2563EB]" /></div>
            <div><label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1 block">Amount Range</label><select value={filters.pendingRange} onChange={e => updateFilter('pendingRange', e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] text-sm outline-none bg-white focus:border-[#2563EB]"><option>All</option><option>&lt;₹500</option><option>₹500-₹2000</option><option>&gt;₹2000</option></select></div>
          </div>
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col min-[360px]:flex-row justify-between min-[360px]:items-center gap-3">
            <button onClick={() => handlePreview('Pending Payments')} className="text-sm font-semibold text-[#2563EB] flex items-center gap-1 hover:underline"><Eye className="w-4 h-4"/> Preview</button>
            <button onClick={() => handleExport('Pending Payments')} disabled={exporting !== null} className="px-4 py-2 bg-[#1F2937] text-white text-sm rounded-lg font-medium hover:bg-black flex gap-2 items-center transition-colors">
              {exporting === 'Pending Payments' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Export CSV
            </button>
          </div>
        </div>

      </div>

      {/* RECENT EXPORTS TABLE */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[#E5E7EB] flex flex-col min-[420px]:flex-row justify-between min-[420px]:items-center gap-3 bg-gray-50/50">
          <h3 className="font-bold text-[#1F2937]">Recent Export History</h3>
          {exportLogs.length > 0 && (
            <button onClick={handleClearAllLogs} className="text-xs font-semibold text-[#DC2626] hover:underline flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Clear All History
            </button>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr className="text-[#6B7280]">
                <th className="px-4 py-3 font-medium">File Name</th>
                <th className="px-4 py-3 font-medium">Report Type</th>
                <th className="px-4 py-3 font-medium">Generated Date</th>
                <th className="px-4 py-3 font-medium">Generated By</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {exportLogs.length > 0 ? exportLogs.map(log => (
                <tr key={log.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#1F2937] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#9CA3AF]" /> {log.fileName}
                  </td>
                  <td className="px-4 py-3 text-[#4B5563]">{log.reportType}</td>
                  <td className="px-4 py-3 text-[#4B5563]">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3 text-[#4B5563]">{log.generatedBy}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => rerunReport(log.reportType)} title="Run Report Again" className="p-1.5 text-[#2563EB] bg-[#2563EB]/10 rounded-md hover:bg-[#2563EB]/20 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteLog(log.id)} title="Delete Log" className="p-1.5 text-[#6B7280] bg-gray-50 border border-[#E5E7EB] rounded-md hover:text-[#DC2626] transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[#6B7280]">No recent exports found. Generate a report above.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-[#E5E7EB]">
          {exportLogs.length > 0 ? exportLogs.map(log => (
            <div key={log.id} className="p-4 space-y-3">
              <div className="flex items-start gap-2 min-w-0">
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-[#9CA3AF]" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[#1F2937] break-all">{log.fileName}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{log.reportType}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-[#9CA3AF]">Generated</p><p className="text-[#4B5563] mt-0.5">{formatDate(log.createdAt)}</p></div>
                <div><p className="text-[#9CA3AF]">Generated by</p><p className="text-[#4B5563] mt-0.5 break-words">{log.generatedBy}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => rerunReport(log.reportType)} className="h-10 flex items-center justify-center gap-2 rounded-lg bg-[#2563EB]/10 text-xs font-semibold text-[#2563EB]"><Eye className="w-4 h-4" /> Run again</button>
                <button onClick={() => handleDeleteLog(log.id)} className="h-10 flex items-center justify-center gap-2 rounded-lg bg-[#DC2626]/10 text-xs font-semibold text-[#DC2626]"><Trash2 className="w-4 h-4" /> Delete</button>
              </div>
            </div>
          )) : (
            <div className="px-4 py-10 text-center text-sm text-[#6B7280]">No recent exports found. Generate a report above.</div>
          )}
        </div>
      </div>

      {/* --- PREVIEW MODAL --- */}
      {previewData && previewType && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-[#E5E7EB] flex justify-between items-center gap-3 bg-gray-50/50 rounded-t-xl">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#1F2937]">{previewType} Preview</h3>
                <p className="text-sm text-[#6B7280] mt-0.5">Previewing {previewData.length} rows</p>
              </div>
              <button onClick={() => { setPreviewData(null); setPreviewType(null); }} aria-label="Close report preview" className="p-2 shrink-0 text-[#6B7280] hover:text-[#1F2937] hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-2 sm:p-5">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#F9FAFB] sticky top-0 z-10 shadow-sm">
                  <tr>
                    {Object.keys(previewData[0]).map((key, idx) => (
                      <th key={idx} className="px-4 py-3 font-semibold text-[#4B5563] border-b border-[#E5E7EB]">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {previewData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-gray-50">
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 text-[#1F2937]">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 sm:p-4 border-t border-[#E5E7EB] bg-gray-50/50 rounded-b-xl flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button onClick={() => { setPreviewData(null); setPreviewType(null); }} className="h-11 px-5 rounded-lg font-medium text-[#6B7280] bg-white border border-[#E5E7EB] hover:bg-gray-100 transition-colors">Close</button>
              <button onClick={() => {
                setPreviewData(null);
                setPreviewType(null);
                void handleExport(previewType);
              }} className="h-11 px-5 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-[#1D4ED8] flex items-center justify-center gap-2 transition-colors">
                <Download className="w-4 h-4"/> Download Full CSV
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
