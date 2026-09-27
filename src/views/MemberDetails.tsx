'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit, MessageCircle, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { getMember, getWhatsAppLink, updateMember, type Member } from '../services/members';
import { getPayments, type Payment } from '../services/payments'; // <-- Added to fetch history

export const MemberDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  
  const [member, setMember] = useState<Member | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]); // <-- Store user's payments
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Membership' | 'Payments'>('Overview');
  
  // Modal States
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Freeze Form Data
  const [freezeData, setFreezeData] = useState({
    from: '',
    until: '',
    reason: ''
  });

  const fetchMemberData = useCallback(async () => {
    if (id) {
      const data = await getMember(id);
      setMember(data);

      // Fetch payment history specific to this member
      const allPayments = await getPayments();
      const mPayments = allPayments
        .filter(p => p.memberId === id)
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
      
      setPaymentHistory(mPayments);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  // --- ACTIONS ---
  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !member) return;
    if (freezeData.until < freezeData.from) {
      alert('Freeze Until must be the same as or later than Freeze From.');
      return;
    }
    setProcessing(true);
    try {
      await updateMember(id, {
        status: 'Frozen',
        freezeFrom: freezeData.from,
        freezeUntil: freezeData.until,
        freezeReason: freezeData.reason.trim(),
        frozenAt: new Date().toISOString(),
      }, null);
      await fetchMemberData(); // Refresh data
      setShowFreezeModal(false);
    } catch {
      alert("Failed to freeze membership.");
    }
    setProcessing(false);
  };

  const openFreezeModal = () => {
    setFreezeData({
      from: member?.freezeFrom || new Date().toISOString().split('T')[0],
      until: member?.freezeUntil || '',
      reason: member?.freezeReason || '',
    });
    setShowFreezeModal(true);
  };

  const handleCancel = async () => {
    if (!id || !member) return;
    setProcessing(true);
    try {
      await updateMember(id, { status: 'Cancelled' }, null);
      await fetchMemberData(); // Refresh data
      setShowCancelModal(false);
    } catch {
      alert("Failed to cancel membership.");
    }
    setProcessing(false);
  };

  // --- TIMELINE & CALCS ---
  const getTimelineProgress = () => {
    if (!member?.startDate || !member?.expiryDate) return 0;
    const start = new Date(member.startDate).getTime();
    const end = new Date(member.expiryDate).getTime();
    const now = new Date().getTime();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const totalDuration = end - start;
    const elapsed = now - start;
    return Math.max(0, Math.min((elapsed / totalDuration) * 100, 100));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20';
      case 'Expiring': return 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20';
      case 'Expired': return 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20';
      case 'Frozen': return 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/20';
      case 'Cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>;
  if (!member) return <div className="text-center py-20 text-[#6B7280]">Member not found.</div>;

  // Real-time calculation: Total Paid is always (Fee - Discount - Balance Due)
  const actualAmountPaid = (member.totalFee || 0) - (member.discount || 0) - (member.balanceDue || 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-24 sm:pb-8">
      
      {/* Header Profile Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
          <button onClick={() => router.push('/members')} aria-label="Back to members" className="flex shrink-0 p-2 -ml-2 rounded-full hover:bg-gray-100 text-[#6B7280]"><ArrowLeft className="w-5 h-5" /></button>
          
          {member.profilePicUrl ? (
            <img src={member.profilePicUrl} alt={member.fullName} className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border border-gray-200 shadow-sm" />
          ) : (
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
              {member.fullName.substring(0, 2).toUpperCase()}
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] leading-tight break-words">{member.fullName}</h1>
            <p className="text-sm text-[#4B5563]">ID: {member.membershipId}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`px-2.5 py-0.5 text-xs font-medium border rounded-md ${getStatusColor(member.status)}`}>{member.status}</span>
              <span className="text-sm text-[#6B7280]">Mobile: +91 {member.mobileNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex w-full sm:w-auto flex-col gap-2">
          <button onClick={() => router.push(`/members/edit/${id}`)} className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors shadow-sm">
            <Edit className="w-4 h-4" /> Edit Profile
          </button>
          <a href={getWhatsAppLink(member)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors shadow-sm">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <div className="flex gap-6 overflow-x-auto hide-scrollbar">
          {['Overview', 'Membership', 'Payments'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'border-[#2563EB] text-[#2563EB] font-semibold' : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <button onClick={() => router.push('/payments/record')} className="px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] shadow-sm transition-colors">₹ Record Payment</button>
        <button onClick={() => router.push(`/members/edit/${id}`)} className="px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1D4ED8] shadow-sm transition-colors">↺ Renew Membership</button>
        <button onClick={openFreezeModal} disabled={member.status === 'Frozen' || member.status === 'Cancelled'} className="px-4 py-2.5 bg-[#D97706] text-white rounded-lg text-sm font-medium hover:bg-[#B45309] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">⏸ Freeze Membership</button>
        <button onClick={() => setShowCancelModal(true)} disabled={member.status === 'Cancelled'} className="px-4 py-2.5 bg-[#DC2626] text-white rounded-lg text-sm font-medium hover:bg-[#B91C1C] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">× Cancel Membership</button>
      </div>

      {/* Tab Content Rendering */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Contact Info */}
        {activeTab === 'Overview' && (
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm h-fit">
            <h3 className="font-bold text-[#1F2937] mb-4 text-lg">Contact Information</h3>
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-x-3 gap-y-3 text-sm">
              <div className="text-[#6B7280]">Full Name</div><div className="font-medium text-[#1F2937] text-right">{member.fullName}</div>
              <div className="text-[#6B7280]">DOB</div><div className="font-medium text-[#1F2937] text-right">{member.dateOfBirth || '-'}</div>
              <div className="text-[#6B7280]">Mobile</div><div className="font-medium text-[#1F2937] text-right">+91 {member.mobileNumber}</div>
              <div className="text-[#6B7280]">Email</div><div className="font-medium text-[#1F2937] text-right break-all">{member.email || '-'}</div>
            </div>
          </div>
        )}

        {/* Membership Info */}
        {(activeTab === 'Overview' || activeTab === 'Membership') && (
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm h-fit">
            <h3 className="font-bold text-[#1F2937] mb-4 text-lg">Membership Information</h3>
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-x-3 gap-y-3 text-sm">
              <div className="text-[#6B7280]">Plan Type</div><div className="font-medium text-[#1F2937] text-right">{member.planType}</div>
              <div className="text-[#6B7280]">Shift</div><div className="font-medium text-[#1F2937] text-right">{member.accessShift}</div>
              <div className="text-[#6B7280]">Start Date</div><div className="font-medium text-[#1F2937] text-right">{member.startDate}</div>
              <div className="text-[#6B7280]">Expiry Date</div><div className="font-medium text-[#1F2937] text-right">{member.expiryDate}</div>
              {(member.personalTrainingFee || 0) > 0 && (
                <>
                  <div className="text-[#6B7280]">Personal Training</div><div className="font-medium text-cyan-800 text-right">{member.personalTrainingPlanName || 'Personal Training'}</div>
                  <div className="text-[#6B7280]">Training Duration</div><div className="font-medium text-[#1F2937] text-right">{member.personalTrainingPlanDuration || '-'}</div>
                </>
              )}
              {member.status === 'Frozen' && (
                <>
                  <div className="text-[#6B7280]">Freeze Period</div><div className="font-medium text-[#D97706] text-right">{member.freezeFrom || '-'} to {member.freezeUntil || '-'}</div>
                  <div className="text-[#6B7280]">Freeze Reason</div><div className="font-medium text-[#1F2937] text-right">{member.freezeReason || '-'}</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Payment Summary */}
        {(activeTab === 'Overview' || activeTab === 'Payments') && (
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm h-fit">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1F2937] text-lg">Payment Summary</h3>
              {member.balanceDue === 0 && <span className="px-2 py-0.5 text-xs font-medium bg-[#16A34A]/10 text-[#16A34A] rounded-md">Paid in Full</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Membership Fee</span><span className="font-medium">₹{member.membershipFee ?? Math.max(0, member.totalFee - (member.personalTrainingFee || 0))}</span></div>
                {(member.personalTrainingFee || 0) > 0 && <div className="flex justify-between gap-3"><span className="text-cyan-700">Personal Training</span><span className="font-medium text-cyan-800">₹{member.personalTrainingFee}</span></div>}
                <div className="flex justify-between"><span className="text-[#6B7280]">Total Fee</span><span className="font-medium">₹{member.totalFee}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Discount</span><span className="font-medium">₹{member.discount}</span></div>
              </div>
              <div className="space-y-3 text-sm border-t sm:border-t-0 sm:border-l border-[#F3F4F6] pt-4 sm:pt-0 sm:pl-6">
                {/* Dynamically calculated amount paid */}
                <div className="flex justify-between"><span className="text-[#6B7280]">Amount Paid</span><span className="font-medium text-[#16A34A]">₹{actualAmountPaid}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Balance Due</span><span className={`font-bold ${member.balanceDue > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>₹{member.balanceDue}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Membership Timeline */}
        {(activeTab === 'Overview' || activeTab === 'Membership') && (
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm h-fit">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1F2937] text-lg">Membership Timeline</h3>
              <span className={`px-2 py-0.5 text-xs font-medium border rounded-md ${getStatusColor(member.status)}`}>{member.status}</span>
            </div>
            <div className="relative pt-6 pb-2">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#E5E7EB]">
                <div style={{ width: `${getTimelineProgress()}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#16A34A] transition-all duration-500"></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs font-medium text-[#6B7280]">
                <div>Join Date<br/>{member.startDate}</div>
                <div className="text-center text-[#1F2937]">Current Progress<br/>{Math.round(getTimelineProgress())}%</div>
                <div className="text-right">Expiry Date<br/>{member.expiryDate}</div>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT HISTORY LIST (Only visible on Payments Tab) */}
        {activeTab === 'Payments' && (
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm h-fit lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1F2937] text-lg">Payment History</h3>
            </div>
            
            {paymentHistory.length > 0 ? (
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#F9FAFB] border-y border-[#E5E7EB]">
                      <tr>
                        <th className="py-3 px-4 font-semibold text-[#6B7280]">Invoice Number</th>
                        <th className="py-3 px-4 font-semibold text-[#6B7280]">Date & Mode</th>
                        <th className="py-3 px-4 font-semibold text-[#6B7280]">Amount</th>
                        <th className="py-3 px-4 font-semibold text-[#6B7280] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {paymentHistory.map(p => (
                        <tr key={p.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-3 px-4 font-medium text-[#1F2937]">{p.invoiceNumber}</td>
                          <td className="py-3 px-4 text-[#4B5563]"><div>{p.transactionDate}</div><div className="text-xs text-[#9CA3AF]">{p.paymentMode}</div></td>
                          <td className="py-3 px-4 font-semibold text-[#16A34A]">₹{p.amountPaid}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => router.push(`/payments/invoice/${p.id}`)} className="text-[#2563EB] hover:underline font-medium text-xs flex items-center justify-end gap-1 ml-auto">
                              <FileText className="h-3 w-3" /> View Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile History Cards */}
                <div className="sm:hidden space-y-3">
                  {paymentHistory.map(p => (
                    <div key={p.id} className="border border-[#E5E7EB] rounded-lg p-3 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-semibold text-[#1F2937] text-sm">{p.invoiceNumber}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">{p.transactionDate} • {p.paymentMode}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-[#16A34A] text-sm">₹{p.amountPaid}</span>
                        <button onClick={() => router.push(`/payments/invoice/${p.id}`)} className="text-xs text-[#2563EB] font-medium flex items-center gap-1">
                          <FileText className="h-3 w-3" /> View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-[#6B7280] bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm">
                No individual transactions recorded for this member yet.
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- MODALS --- */}

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleFreeze} className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
            <h3 className="text-xl font-bold text-[#1F2937] mb-4">Freeze Membership</h3>
            
            <div className="mb-4 text-sm text-[#4B5563]">
              <p>Member: <span className="font-medium text-[#1F2937]">{member.fullName}</span></p>
              <p>Membership ID: <span className="font-medium text-[#1F2937]">{member.membershipId}</span></p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Freeze From</label>
                <input type="date" required value={freezeData.from} onChange={e => setFreezeData({...freezeData, from: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#D97706]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Freeze Until</label>
                <input type="date" required value={freezeData.until} onChange={e => setFreezeData({...freezeData, until: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#D97706]" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-[#1F2937] mb-1">Reason</label>
              <textarea rows={3} required value={freezeData.reason} onChange={e => setFreezeData({...freezeData, reason: e.target.value})} className="w-full p-3 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#D97706]"></textarea>
            </div>

            <p className="text-xs text-[#6B7280] mb-6">
              Freezing your membership will pause access and billing for the selected duration. A reactivation fee may apply. Please review our policy.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end">
              <button type="button" onClick={() => setShowFreezeModal(false)} className="px-4 py-2 text-sm rounded-lg font-medium text-[#6B7280] border border-[#E5E7EB] hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={processing} className="px-4 py-2 text-sm bg-[#D97706] text-white rounded-lg font-medium hover:bg-[#B45309] flex items-center">
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Freeze Membership
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl relative text-center sm:text-left max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
            
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-[#DC2626]" />
              <h3 className="text-xl font-bold text-[#1F2937]">Cancel Membership?</h3>
            </div>
            
            <div className="mb-4 text-sm text-[#4B5563]">
              <p>Member: <span className="font-medium text-[#1F2937]">{member.fullName}</span></p>
              <p>Membership ID: <span className="font-medium text-[#1F2937]">{member.membershipId}</span></p>
            </div>

            <p className="text-sm text-[#4B5563] mb-6">
              Are you sure you want to cancel this membership? This action is destructive and will immediately change the membership status to Cancelled. Access and billing will cease.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button type="button" onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm rounded-lg font-medium text-[#6B7280] border border-[#E5E7EB] hover:bg-gray-50">Keep Membership</button>
              <button type="button" onClick={handleCancel} disabled={processing} className="px-4 py-2 text-sm bg-[#DC2626] text-white rounded-lg font-medium hover:bg-[#B91C1C] flex justify-center items-center">
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Cancel Membership
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
