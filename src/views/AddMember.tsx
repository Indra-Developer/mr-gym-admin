'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { addMember } from '../services/members';
import { getPlans, getPersonalTrainingPlans, type Plan } from '../services/settings';

export const AddMember: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [personalTrainingPlans, setPersonalTrainingPlans] = useState<Plan[]>([]);
  
  const [membershipId, setMembershipId] = useState('');
  
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    email: '',
    dateOfBirth: '',
    gender: 'Male',
    planType: '',
    accessShift: 'Morning',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
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
    setMembershipId(`M-${Math.floor(1000 + Math.random() * 9000)}`);
    Promise.all([getPlans(), getPersonalTrainingPlans()])
      .then(([membershipPlans, trainingPlans]) => {
        if (cancelled) return;
        setPlans(membershipPlans);
        setPersonalTrainingPlans(trainingPlans);
        if (membershipPlans.length > 0) {
          setFormData(previous => ({ ...previous, planType: membershipPlans[0].name, membershipFee: Number(membershipPlans[0].price) || 0 }));
        }
      })
      .catch(error => {
        console.error('Failed to load plans', error);
        if (!cancelled) alert('Membership plans could not be loaded.');
      })
      .finally(() => { if (!cancelled) setPlansLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Handle Profile Pic selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePic(file);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  // Auto-calculate Expiry Date based on Plan Type & Start Date
  useEffect(() => {
    if (!formData.startDate) return;
    const start = new Date(formData.startDate);
    const expiry = new Date(start);
    
    const selectedPlan = plans.find(plan => plan.name === formData.planType);
    const duration = selectedPlan?.duration.toLowerCase() || '1 month';
    const durationValue = Number(duration.match(/\d+/)?.[0] || 1);
    if (duration.includes('year')) expiry.setFullYear(start.getFullYear() + durationValue);
    else if (duration.includes('day')) expiry.setDate(start.getDate() + durationValue);
    else expiry.setMonth(start.getMonth() + durationValue);
    
    setFormData(prev => ({ ...prev, expiryDate: expiry.toISOString().split('T')[0] }));
  }, [formData.startDate, formData.planType, plans]);

  const totalFee = formData.membershipFee + formData.personalTrainingFee;
  const balanceDue = Math.max(0, totalFee - formData.discount - formData.amountPaid);

  const handleMembershipPlanChange = (planName: string) => {
    const plan = plans.find(item => item.name === planName);
    setFormData(previous => ({ ...previous, planType: planName, membershipFee: Number(plan?.price) || 0 }));
  };

  const handlePersonalTrainingChange = (planId: string) => {
    const plan = personalTrainingPlans.find(item => item.id === planId);
    setFormData(previous => ({
      ...previous,
      personalTrainingPlanId: plan?.id || '',
      personalTrainingPlanName: plan?.name || '',
      personalTrainingPlanDuration: plan?.duration || '',
      personalTrainingFee: Number(plan?.price) || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.planType || formData.membershipFee <= 0) return alert('Please select a valid membership plan.');
    if (formData.discount > totalFee) return alert('Discount cannot be greater than the combined fee.');
    if (formData.amountPaid > totalFee - formData.discount) return alert('Amount paid cannot exceed the payable total.');
    setLoading(true);
    try {
      await addMember({
        ...formData,
        membershipId,
        totalFee,
        balanceDue,
        status: 'Active',
        profilePicUrl: null, // <-- FIX: Explicitly pass null for TS validation
      }, profilePic);
      router.push('/members');
    } catch (error) {
      console.error("Error creating member:", error);
      alert("Failed to create member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 sm:pb-8">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/members')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-[#6B7280]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">Add New Member</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Profile Pic Section */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col items-center justify-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-[#F3F4F6] border-2 border-dashed border-[#D1D5DB] flex items-center justify-center overflow-hidden">
              {profilePicPreview ? (
                <img src={profilePicPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-8 w-8 text-[#9CA3AF]" />
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <p className="text-sm font-medium text-[#2563EB] mt-3">Upload Photo (Optional)</p>
        </div>

        {/* Basic Details */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <h2 className="font-bold text-[#1F2937] border-b pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Full Name *</label>
              <input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Phone Number *</label>
              <input type="tel" required value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" placeholder="1234567890" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Email Address</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" placeholder="john@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Date of Birth</label>
                <input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Gender</label>
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-[#2563EB]">
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Membership Details */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <h2 className="font-bold text-[#1F2937] border-b pb-2">Membership Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Membership ID</label>
              <input type="text" readOnly value={membershipId} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] bg-gray-50 text-gray-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Plan</label>
              <select required value={formData.planType} onChange={e => handleMembershipPlanChange(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-[#2563EB]">
                {plans.length === 0 && <option value="">{plansLoading ? 'Loading Plans...' : 'No Plans Available'}</option>}
                {plans.map(plan => <option key={plan.id} value={plan.name}>{plan.name} — ₹{plan.price}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Start Date</label>
              <input type="date" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Expiry Date (Auto)</label>
              <input type="date" readOnly value={formData.expiryDate} className="w-full h-11 px-3 rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 text-[#16A34A] font-medium outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Personal Training (Optional)</label>
              <select value={formData.personalTrainingPlanId} onChange={e => handlePersonalTrainingChange(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-cyan-600">
                <option value="">No Personal Training</option>
                {personalTrainingPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} — {plan.duration} — ₹{plan.price}</option>)}
              </select>
              {personalTrainingPlans.length === 0 && !plansLoading && <p className="mt-1 text-[11px] text-amber-700">Create personal-training plans from Settings.</p>}
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <h2 className="font-bold text-[#1F2937] border-b pb-2">Initial Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Membership Fee (₹)</label>
              <input type="number" readOnly value={formData.membershipFee} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] bg-gray-50 font-medium outline-none" />
            </div>
            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Personal Training Fee (₹)</label><input type="number" readOnly value={formData.personalTrainingFee} className="w-full h-11 px-3 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-800 font-medium outline-none" /></div>
            <div className="sm:col-span-2 rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 p-3 flex justify-between items-center"><span className="text-sm font-medium text-[#2563EB]">Combined Total</span><span className="text-xl font-bold text-[#1F2937]">₹{totalFee}</span></div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Discount (₹)</label>
              <input type="number" value={formData.discount} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Amount Paid (₹)</label>
              <input type="number" required value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: Number(e.target.value)})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Balance Due (₹)</label>
              <input type="number" readOnly value={balanceDue} className={`w-full h-11 px-3 rounded-lg border font-bold outline-none ${balanceDue > 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 bg-gray-50 text-gray-500'}`} />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 sm:justify-end pt-2">
          <button type="button" onClick={() => router.push('/members')} className="flex-1 sm:flex-none h-12 px-6 rounded-lg font-medium text-[#6B7280] border border-[#E5E7EB] bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 sm:flex-none h-12 px-8 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] flex items-center justify-center">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Member'}
          </button>
        </div>

      </form>
    </div>
  );
};
