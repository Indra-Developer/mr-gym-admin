'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { getMembers, getMember, type Member } from '../services/members';
import { recordPayment, getPayment, updatePayment, type Payment } from '../services/payments';
import { getPersonalTrainingPlans, type Plan } from '../services/settings';

export const RecordPayment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [personalTrainingPlans, setPersonalTrainingPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('Auto-generated');
  const [originalPaymentAmount, setOriginalPaymentAmount] = useState(0);

  const [formData, setFormData] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash' as Payment['paymentMode'],
    membershipFee: 0,
    personalTrainingPlanId: '',
    personalTrainingPlanName: '',
    personalTrainingPlanDuration: '',
    personalTrainingFee: 0,
    discount: 0,
    amountPaid: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [membersData, trainingPlans] = await Promise.all([getMembers(), getPersonalTrainingPlans()]);
        if (cancelled) return;
        setMembers(membersData);
        setPersonalTrainingPlans(trainingPlans);

        if (isEditMode && id) {
          const payment = await getPayment(id);
          if (!payment || cancelled) return;
          setInvoiceNumber(payment.invoiceNumber);
          setOriginalPaymentAmount(payment.amountPaid || 0);
          setFormData({
            transactionDate: payment.transactionDate,
            paymentMode: payment.paymentMode,
            membershipFee: payment.membershipFee ?? Math.max(0, payment.totalFee - (payment.personalTrainingFee || 0)),
            personalTrainingPlanId: payment.personalTrainingPlanId || '',
            personalTrainingPlanName: payment.personalTrainingPlanName || '',
            personalTrainingPlanDuration: payment.personalTrainingPlanDuration || '',
            personalTrainingFee: payment.personalTrainingFee || 0,
            discount: payment.discount,
            amountPaid: payment.amountPaid,
          });
          const member = await getMember(payment.memberId);
          if (!cancelled && member) setSelectedMember(member);
        }
      } catch (error) {
        console.error('Failed to load payment form', error);
        if (!cancelled) alert('The payment form data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [id, isEditMode]);

  const handleSelectMember = (m: Member) => {
    setSelectedMember(m);
    setSearch('');
    // Auto-fill form with member's actual balance details
    if (!isEditMode) {
      setFormData(prev => ({ 
        ...prev, 
        membershipFee: m.membershipFee ?? Math.max(0, (m.totalFee || 0) - (m.personalTrainingFee || 0)),
        personalTrainingPlanId: m.personalTrainingPlanId || '',
        personalTrainingPlanName: m.personalTrainingPlanName || '',
        personalTrainingPlanDuration: m.personalTrainingPlanDuration || '',
        personalTrainingFee: m.personalTrainingFee || 0,
        discount: m.discount || 0,
        amountPaid: m.balanceDue || 0 // Suggests paying off the exact remaining balance
      }));
    }
  };

  const handlePersonalTrainingChange = (planId: string) => {
    const selectedPlan = personalTrainingPlans.find(plan => plan.id === planId);
    setFormData(previous => {
      const personalTrainingFee = selectedPlan ? Number(selectedPlan.price) || 0 : 0;
      const nextTotalFee = previous.membershipFee + personalTrainingFee;
      const previousPaid = selectedMember
        ? Math.max(0, (selectedMember.amountPaid || 0) - (isEditMode ? originalPaymentAmount : 0))
        : 0;
      const suggestedPayment = Math.max(0, nextTotalFee - previous.discount - previousPaid);
      return {
        ...previous,
        personalTrainingPlanId: selectedPlan?.id || '',
        personalTrainingPlanName: selectedPlan?.name || '',
        personalTrainingPlanDuration: selectedPlan?.duration || '',
        personalTrainingFee,
        amountPaid: isEditMode ? previous.amountPaid : suggestedPayment,
      };
    });
  };

  const totalFee = formData.membershipFee + formData.personalTrainingFee;
  const cumulativePaidBeforeThisPayment = selectedMember
    ? Math.max(0, (selectedMember.amountPaid || 0) - (isEditMode ? originalPaymentAmount : 0))
    : 0;
  const amountDueBeforeThisPayment = Math.max(0, totalFee - formData.discount - cumulativePaidBeforeThisPayment);
  const invoiceBalanceDue = Math.max(0, amountDueBeforeThisPayment - formData.amountPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return alert("Please select a member first.");
    if (totalFee <= 0) return alert('The combined membership and personal-training fee must be greater than zero.');
    if (formData.discount > totalFee) return alert('Discount cannot be greater than the total fee.');
    if (formData.amountPaid <= 0) return alert('Amount Paid must be greater than zero.');
    if (formData.amountPaid > amountDueBeforeThisPayment) {
      return alert(`Amount Paid cannot exceed the current amount due of ₹${amountDueBeforeThisPayment}.`);
    }
    
    setLoading(true);
    try {
      if (isEditMode && id) {
        await updatePayment(id, {
          ...formData,
          totalFee,
        });
        router.push(`/payments/invoice/${id}`);
      } else {
        // 1. Record the Payment
        const paymentId = await recordPayment({
          memberId: selectedMember.id,
          memberName: selectedMember.fullName,
          membershipId: selectedMember.membershipId,
          ...formData,
          totalFee,
        });

        router.push(`/payments/invoice/${paymentId}`); 
      }
    } catch {
      alert(`Failed to ${isEditMode ? 'update' : 'record'} payment`);
    } finally {
      setLoading(false);
    }
  };

  const searchResults = members.filter(m => {
    if (!search) return false;
    const s = search.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(s) || 
      m.membershipId.toLowerCase().includes(s) ||
      m.mobileNumber.includes(s) ||
      (m.email && m.email.toLowerCase().includes(s))
    );
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-[#6B7280]" /></button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">{isEditMode ? 'Edit Payment' : 'Record Payment'}</h1>
          <p className="text-sm text-[#6B7280]">Record membership and optional personal-training charges</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Member Selection */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
            <h3 className="font-bold text-[#1F2937] mb-3">Member Selection</h3>
            
            {!selectedMember ? (
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-[#9CA3AF]" />
                <input type="text" placeholder="Name, ID, Mobile, Email..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-11 pl-10 pr-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB] text-sm" />
                {search && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.length > 0 ? searchResults.map(m => (
                        <button key={m.id} type="button" onClick={() => handleSelectMember(m)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0">
                          <div className="font-medium text-[#1F2937]">{m.fullName}</div>
                          <div className="text-xs text-[#6B7280]">{m.membershipId} • Due: ₹{m.balanceDue}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{m.mobileNumber}</div>
                        </button>
                      )) : <div className="p-4 text-center text-sm text-[#6B7280]">No members found</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg border border-[#E5E7EB] relative">
                {!isEditMode && <button type="button" onClick={() => setSelectedMember(null)} className="absolute top-3 right-3 text-xs text-[#2563EB] font-medium hover:underline">Change</button>}
                <div className="text-sm text-[#6B7280] mb-1">Selected Member:</div>
                <div className="font-bold text-[#1F2937] text-lg">{selectedMember.fullName}</div>
                <div className="text-sm text-[#4B5563] mt-2">Membership ID: <span className="font-medium">{selectedMember.membershipId}</span></div>
                <div className="text-sm text-[#4B5563]">Plan: <span className="font-medium">{selectedMember.planType}</span></div>
                {formData.personalTrainingPlanName && <div className="text-sm text-[#4B5563]">Personal Training: <span className="font-medium text-cyan-700">{formData.personalTrainingPlanName}</span></div>}
                <div className="text-sm text-[#4B5563]">Current Balance: <span className="font-medium text-[#DC2626]">₹{selectedMember.balanceDue}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Payment Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-xl border border-[#E5E7EB] shadow-sm space-y-5">
            <h3 className="font-bold text-[#1F2937] border-b pb-3">Payment Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Invoice Number</label><input type="text" readOnly value={invoiceNumber} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] bg-gray-50 text-[#9CA3AF] outline-none font-medium" /></div>
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Transaction Date</label><input type="date" required value={formData.transactionDate} onChange={e => setFormData({...formData, transactionDate: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
              <div className="sm:col-span-2"><label className="block text-xs font-medium text-[#6B7280] mb-1">Payment Mode</label><select value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value as Payment['paymentMode']})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-[#2563EB]"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option></select></div>
              
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Membership Fee (₹)</label><input type="number" min="0" required value={formData.membershipFee} onChange={e => setFormData({...formData, membershipFee: Number(e.target.value)})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Personal Training</label><select value={formData.personalTrainingPlanId} onChange={e => handlePersonalTrainingChange(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-cyan-600"><option value="">No Personal Training</option>{formData.personalTrainingPlanId && !personalTrainingPlans.some(plan => plan.id === formData.personalTrainingPlanId) ? <option value={formData.personalTrainingPlanId}>{formData.personalTrainingPlanName || 'Saved Personal Training'}</option> : null}{personalTrainingPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} — ₹{plan.price} / {plan.duration}</option>)}</select>{personalTrainingPlans.length === 0 && <p className="mt-1 text-[11px] text-amber-700">Create personal-training plans from Settings first.</p>}</div>
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Personal Training Fee (₹)</label><input type="number" readOnly value={formData.personalTrainingFee} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] bg-cyan-50 text-cyan-800 font-semibold outline-none" /></div>
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Discount (₹)</label><input type="number" min="0" value={formData.discount} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Amount Paid TODAY (₹)</label><input type="number" min="0.01" step="0.01" required value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: Number(e.target.value)})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
              
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 flex flex-col justify-center">
                <div className="text-xs font-medium text-cyan-700 mb-1">Combined Total Fee</div>
                <div className="text-xl font-bold text-[#1F2937]">₹{totalFee}</div>
                <div className="text-[11px] text-[#6B7280]">Membership ₹{formData.membershipFee} + Training ₹{formData.personalTrainingFee}</div>
              </div>
              <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-lg p-3 flex flex-col justify-center">
                <div className="text-xs font-medium text-[#2563EB] mb-1">Remaining Balance Due</div>
                <div className="text-xl font-bold text-[#1F2937]">₹{invoiceBalanceDue}</div>
              </div>
            </div>

            <div className="pt-4 flex gap-3 justify-end border-t border-[#E5E7EB]">
              <button type="button" onClick={() => router.back()} className="h-11 px-6 rounded-lg font-medium text-[#6B7280] border border-[#E5E7EB] hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={loading} className="h-11 px-8 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] flex items-center">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isEditMode ? 'Update Payment' : 'Save Payment')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
