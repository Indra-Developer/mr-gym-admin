'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { addMember, getMember, updateMember, type Member } from '../services/members';
import { getPlans, getPersonalTrainingPlans, type Plan } from '../services/settings';

export const MemberForm: React.FC = () => {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [personalTrainingPlans, setPersonalTrainingPlans] = useState<Plan[]>([]);
  
  const [membershipId, setMembershipId] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [savedProfilePicUrl, setSavedProfilePicUrl] = useState<string | null>(null);
  const [removeProfilePic, setRemoveProfilePic] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<Member['status']>('Active');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    fullName: '', mobileNumber: '', email: '', dateOfBirth: '',
    gender: 'Male', planType: '', accessShift: 'Morning',
    startDate: new Date().toISOString().split('T')[0], expiryDate: '',
    membershipFee: 0,
    personalTrainingPlanId: '', personalTrainingPlanName: '', personalTrainingPlanDuration: '', personalTrainingFee: 0,
    discount: 0, amountPaid: 0,
  });

  // Load Database Plans & Member Data
  useEffect(() => {
    let cancelled = false;

    const loadForm = async () => {
      try {
        const [fetchedPlans, fetchedTrainingPlans, member] = await Promise.all([
          getPlans(),
          getPersonalTrainingPlans(),
          isEditMode && id ? getMember(id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setPlans(fetchedPlans);
        setPersonalTrainingPlans(fetchedTrainingPlans);

        if (member) {
          const personalTrainingFee = member.personalTrainingFee || 0;
          const selectedMembershipPlan = fetchedPlans.find(plan => plan.name === member.planType);
          setMembershipId(member.membershipId);
          setOriginalStatus(member.status);
          setProfilePicPreview(member.profilePicUrl);
          setSavedProfilePicUrl(member.profilePicUrl);
          setFormData({
            fullName: member.fullName,
            mobileNumber: member.mobileNumber,
            email: member.email || '',
            dateOfBirth: member.dateOfBirth || '',
            gender: member.gender || 'Male',
            planType: member.planType || '',
            accessShift: member.accessShift || 'Morning',
            startDate: member.startDate || '',
            expiryDate: member.expiryDate || '',
            membershipFee: member.membershipFee ?? selectedMembershipPlan?.price ?? Math.max(0, (member.totalFee || 0) - personalTrainingFee),
            personalTrainingPlanId: member.personalTrainingPlanId || '',
            personalTrainingPlanName: member.personalTrainingPlanName || '',
            personalTrainingPlanDuration: member.personalTrainingPlanDuration || '',
            personalTrainingFee,
            discount: member.discount || 0,
            amountPaid: member.amountPaid || 0,
          });
        } else if (!isEditMode && fetchedPlans.length > 0) {
          setMembershipId(`M-${Math.floor(1000 + Math.random() * 9000)}`);
          setFormData(previous => ({
            ...previous,
            planType: fetchedPlans[0].name,
            membershipFee: Number(fetchedPlans[0].price) || 0,
          }));
        } else if (!isEditMode) {
          setMembershipId(`M-${Math.floor(1000 + Math.random() * 9000)}`);
        }
      } catch (error) {
        console.error('Failed to load member form', error);
        if (!cancelled) alert('Membership plans could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadForm();
    return () => { cancelled = true; };
  }, [id, isEditMode]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePic(file);
      setProfilePicPreview(URL.createObjectURL(file));
      setRemoveProfilePic(false);
    }
  };

  useEffect(() => {
    return () => {
      if (profilePicPreview?.startsWith('blob:')) URL.revokeObjectURL(profilePicPreview);
    };
  }, [profilePicPreview]);

  const handleRemovePhoto = () => {
    setProfilePic(null);
    setProfilePicPreview(null);
    setRemoveProfilePic(Boolean(savedProfilePicUrl));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUndoPhotoRemoval = () => {
    setProfilePic(null);
    setProfilePicPreview(savedProfilePicUrl);
    setRemoveProfilePic(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPlan = plans.find(plan => plan.name === e.target.value);
    setFormData(prev => ({
      ...prev,
      planType: e.target.value,
      membershipFee: Number(selectedPlan?.price) || 0,
    }));
  };

  const handlePersonalTrainingChange = (planId: string) => {
    const selectedPlan = personalTrainingPlans.find(plan => plan.id === planId);
    setFormData(previous => ({
      ...previous,
      personalTrainingPlanId: selectedPlan?.id || '',
      personalTrainingPlanName: selectedPlan?.name || '',
      personalTrainingPlanDuration: selectedPlan?.duration || '',
      personalTrainingFee: Number(selectedPlan?.price) || 0,
    }));
  };

  // Auto-calculate Expiry Date
  useEffect(() => {
    if (!formData.startDate || plans.length === 0) return;
    const start = new Date(formData.startDate);
    const expiry = new Date(start);
    const selectedPlan = plans.find(p => p.name === formData.planType);

    if (selectedPlan && selectedPlan.duration) {
      const durStr = selectedPlan.duration.toLowerCase();
      const numMatch = durStr.match(/\d+/); 
      const num = numMatch ? parseInt(numMatch[0]) : 1;

      if (durStr.includes('year')) expiry.setFullYear(start.getFullYear() + num);
      else if (durStr.includes('day')) expiry.setDate(start.getDate() + num);
      else expiry.setMonth(start.getMonth() + num); 
    } else {
      expiry.setMonth(start.getMonth() + 1); 
    }
    
    setFormData(prev => ({ ...prev, expiryDate: expiry.toISOString().split('T')[0] }));
  }, [formData.startDate, formData.planType, plans]);

  const combinedTotalFee = formData.membershipFee + formData.personalTrainingFee;
  const balanceDue = Math.max(0, combinedTotalFee - formData.discount - formData.amountPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.planType) return alert('Please select a membership plan.');
    if (formData.membershipFee <= 0) return alert('The selected membership plan must have a valid price.');
    if (formData.discount > combinedTotalFee) return alert('Discount cannot be greater than the combined fee.');
    if (formData.amountPaid > combinedTotalFee - formData.discount) return alert('Amount paid cannot be greater than the payable total.');

    setSaving(true);
    try {
      const payload: Partial<Member> = {
        ...formData,
        membershipId,
        totalFee: combinedTotalFee,
        balanceDue,
        status: isEditMode ? originalStatus : 'Active',
      };

      if (removeProfilePic) {
        payload.profilePicUrl = null;
        payload.profilePicPath = null;
      }
      
      if (isEditMode && id) {
        await updateMember(id, payload, profilePic);
        router.push(`/members/${id}`); 
      } else {
        payload.profilePicUrl = null;
        await addMember(payload as Omit<Member, 'id' | 'createdAt'>, profilePic);
        router.push('/members');
      }
    } catch (error) {
      console.error(error);
      alert(`Failed to ${isEditMode ? 'update' : 'create'} member. Check console for details.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-[#6B7280]"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">{isEditMode ? 'Edit Member' : 'Add New Member'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-[#2563EB] via-cyan-400 to-violet-500" />
          <div className="flex flex-col items-center justify-center p-5 sm:flex-row sm:justify-start sm:gap-6 sm:p-6">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#D1D5DB] bg-[#F3F4F6] shadow-inner">
                {profilePicPreview ? <img src={profilePicPreview} alt="Member profile preview" className="h-full w-full object-cover" /> : <Camera className="h-9 w-9 text-[#9CA3AF]" />}
              </div>
              {profilePicPreview ? <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white"><Camera className="h-3.5 w-3.5" /></span> : null}
            </div>

            <div className="mt-5 w-full text-center sm:mt-0 sm:w-auto sm:text-left">
              <h2 className="font-bold text-[#1F2937]">Profile picture</h2>
              <p className="mt-1 text-xs leading-5 text-[#6B7280]">JPEG, PNG or WebP. Use a clear photo under 5 MB.</p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
              <div className="mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:flex">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-xs font-bold text-white transition hover:bg-[#1D4ED8]">
                  <Upload className="h-4 w-4" /> {profilePicPreview ? 'Change photo' : 'Upload photo'}
                </button>
                {profilePicPreview ? <button type="button" onClick={handleRemovePhoto} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-600 transition hover:bg-red-100"><Trash2 className="h-4 w-4" /> Remove photo</button> : null}
                {removeProfilePic && savedProfilePicUrl ? <button type="button" onClick={handleUndoPhotoRemoval} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 min-[390px]:col-span-2"><RotateCcw className="h-4 w-4" /> Undo removal</button> : null}
              </div>
              {profilePic ? <p className="mt-2 max-w-xs truncate text-xs font-medium text-emerald-600">Selected: {profilePic.name}</p> : null}
              {removeProfilePic ? <p className="mt-2 text-xs font-semibold text-red-600">The saved photo will be removed when you save changes.</p> : null}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <h2 className="font-bold text-[#1F2937] border-b pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Full Name *</label><input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Phone Number *</label><input type="tel" required value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Email Address</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Date of Birth</label><input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Gender</label>
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-[#2563EB]"><option>Male</option><option>Female</option><option>Other</option></select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm space-y-4">
          <h2 className="font-bold text-[#1F2937] border-b pb-2">Membership Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Membership ID</label><input type="text" readOnly value={membershipId} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] bg-gray-50 text-gray-500 outline-none" /></div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Plan</label>
                <select value={formData.planType} onChange={handlePlanChange} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-[#2563EB]">
                  {plans.length === 0 ? <option value="">Loading Plans...</option> : null}
                  {plans.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Access Shift</label>
                <select value={formData.accessShift} onChange={e => setFormData({...formData, accessShift: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-[#2563EB]"><option>Morning</option><option>Evening</option><option>General / All Day</option></select>
              </div>
            </div>

            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Start Date</label><input type="date" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB]" /></div>
            <div><label className="block text-xs font-medium text-[#6B7280] mb-1">Expiry Date (Auto)</label><input type="date" readOnly value={formData.expiryDate} className="w-full h-11 px-3 rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 text-[#16A34A] font-medium outline-none" /></div>

            <div className="sm:col-span-2 border-t border-[#E5E7EB] pt-4">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Personal Training (Optional)</label>
              <select value={formData.personalTrainingPlanId} onChange={event => handlePersonalTrainingChange(event.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#E5E7EB] outline-none bg-white focus:border-cyan-600">
                <option value="">No Personal Training</option>
                {formData.personalTrainingPlanId && !personalTrainingPlans.some(plan => plan.id === formData.personalTrainingPlanId) ? <option value={formData.personalTrainingPlanId}>{formData.personalTrainingPlanName || 'Saved Personal Training'}</option> : null}
                {personalTrainingPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} — {plan.duration} — ₹{plan.price}</option>)}
              </select>
              {personalTrainingPlans.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No personal-training plans exist. Create one from Settings.</p>}
            </div>

            <div className="rounded-lg border border-[#E5E7EB] bg-gray-50 p-3">
              <p className="text-xs text-[#6B7280]">Membership Fee</p>
              <p className="text-lg font-bold text-[#1F2937]">₹{formData.membershipFee}</p>
            </div>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-xs text-cyan-700">Personal Training Fee</p>
              <p className="text-lg font-bold text-cyan-800">₹{formData.personalTrainingFee}</p>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 p-4 flex flex-col min-[420px]:flex-row justify-between gap-3">
              <div><p className="text-xs text-[#6B7280]">Combined Total</p><p className="text-2xl font-bold text-[#1F2937]">₹{combinedTotalFee}</p></div>
              <div className="text-left min-[420px]:text-right"><p className="text-xs text-[#6B7280]">Current Balance Due</p><p className={`text-2xl font-bold ${balanceDue > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>₹{balanceDue}</p></div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 sm:justify-end pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 sm:flex-none h-12 px-6 rounded-lg font-medium text-[#6B7280] border border-[#E5E7EB] bg-white hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 sm:flex-none h-12 px-8 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] flex items-center justify-center">
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            {isEditMode ? 'Save Changes' : 'Create Member'}
          </button>
        </div>
      </form>
    </div>
  );
};
