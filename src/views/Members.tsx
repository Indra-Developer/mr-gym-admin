'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Eye, Edit, Trash2, MessageCircle, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMembers, deleteMember, getWhatsAppLink, type Member } from '../services/members';

export const Members: React.FC = () => {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  type MemberFilter = 'All' | Member['status'];
  const [filter, setFilter] = useState<MemberFilter>('All');
  const [search, setSearch] = useState('');

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fetchMembers = async () => {
    setLoading(true);
    const data = await getMembers();
    setMembers(data);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  // --- ACTIONS ---
  const handleView = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevents row click from firing twice
    router.push(`/members/${id}`);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevents row click
    router.push(`/members/edit/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // Prevents row click
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      await deleteMember(id);
      fetchMembers(); 
    }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents row click
  };

  const handleExport = () => {
    if (filteredMembers.length === 0) return alert("No members to export.");
    const separator = ',';
    const keys = ['Membership ID', 'Full Name', 'Mobile', 'Email', 'Plan', 'Shift', 'Personal Training', 'Personal Training Duration', 'Membership Fee', 'Personal Training Fee', 'Total Fee', 'Start Date', 'Expiry Date', 'Balance Due', 'Status'];
    
    const csvContent = [
      keys.join(separator),
      ...filteredMembers.map(m => [
        m.membershipId, 
        `"${m.fullName}"`, 
        m.mobileNumber, 
        m.email || '', 
        m.planType, 
        m.accessShift,
        `"${m.personalTrainingPlanName || 'None'}"`,
        m.personalTrainingPlanDuration || '',
        m.membershipFee ?? Math.max(0, m.totalFee - (m.personalTrainingFee || 0)),
        m.personalTrainingFee || 0,
        m.totalFee,
        m.startDate, 
        m.expiryDate, 
        m.balanceDue, 
        m.status
      ].join(separator))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MRGYM_Members_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- FILTERING ---
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

  const filteredMembers = members.filter(m => {
    const searchLower = search.trim().toLowerCase();
    const matchesSearch = 
      m.fullName.toLowerCase().includes(searchLower) || 
      m.membershipId.toLowerCase().includes(searchLower) || 
      m.mobileNumber.includes(search.trim()) || 
      (m.email && m.email.toLowerCase().includes(searchLower)); 
      
    const matchesFilter = filter === 'All' || m.status === filter;
    return matchesSearch && matchesFilter;
  });

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredMembers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = filteredMembers.slice(startIndex, startIndex + rowsPerPage);

  // Reusable Avatar Component
  const Avatar = ({ url, name }: { url?: string | null, name: string }) => (
    url ? (
      <img src={url} alt={name} className="h-10 w-10 sm:h-9 sm:w-9 rounded-full object-cover border border-gray-200 shrink-0" />
    ) : (
      <div className="h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] font-bold border border-gray-200 shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
    )
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1F2937]">Members</h1>
            <span className="bg-[#2563EB]/10 text-[#2563EB] text-xs font-bold px-2.5 py-1 rounded-full">
              {filteredMembers.length}
            </span>
          </div>
          <p className="text-sm text-[#6B7280] mt-1">Manage gym memberships and member information</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Search by name, ID, mobile, email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none text-sm transition-shadow" 
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <button onClick={handleExport} className="flex h-11 w-full sm:w-auto px-3 sm:px-4 bg-white border border-[#E5E7EB] text-[#4B5563] rounded-lg items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => router.push('/members/add')} className="flex h-11 w-full sm:w-auto px-3 sm:px-4 bg-[#2563EB] text-white rounded-lg items-center justify-center gap-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors">
              <Plus className="h-4 w-4" /> Add Member
            </button>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
        {(['All', 'Active', 'Expiring', 'Expired', 'Frozen', 'Cancelled'] as MemberFilter[]).map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50'}`}
          >
            {f} ({f === 'All' ? members.length : members.filter(member => member.status === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" /></div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-[#E5E7EB] text-[#6B7280] shadow-sm">
          No members found matching your search.
        </div>
      ) : (
        <>
          {/* --- DESKTOP TABLE --- */}
          <div className="hidden sm:block bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr className="text-[#6B7280]">
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Contact / ID</th>
                    <th className="px-4 py-3 font-medium">Plan / Shift</th>
                    <th className="px-4 py-3 font-medium">Timeline</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {currentData.map(m => (
                    <tr 
                      key={m.id} 
                      onClick={() => router.push(`/members/${m.id}`)} 
                      className="hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar url={m.profilePicUrl} name={m.fullName} />
                          <span className="font-bold text-[#1F2937]">{m.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#4B5563]">
                        <div className="font-medium text-[#1F2937]">{m.membershipId}</div>
                        <div className="text-xs text-[#6B7280]">{m.mobileNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-[#4B5563]">
                        <div className="font-medium">{m.planType}</div>
                        <div className="text-xs text-[#6B7280]">{m.accessShift}</div>
                        {(m.personalTrainingFee || 0) > 0 && <div className="text-[11px] text-cyan-700">PT: {m.personalTrainingPlanName || 'Personal Training'}</div>}
                      </td>
                      <td className="px-4 py-3 text-[#4B5563]">
                        <div className="text-xs">Start: <span className="font-medium">{m.startDate}</span></div>
                        <div className="text-xs">Exp: <span className="font-medium">{m.expiryDate}</span></div>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#1F2937]">₹{m.balanceDue}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium border rounded-md ${getStatusColor(m.status)}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={(e) => handleView(e, m.id)} title="View Member Details" className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-[#2563EB] transition-colors hover:border-blue-300 hover:bg-blue-100"><Eye className="h-4 w-4" /> View details</button>
                          <button onClick={(e) => handleEdit(e, m.id)} title="Edit Member" className="p-1.5 text-[#6B7280] hover:text-[#2563EB] bg-gray-50 rounded-md border border-[#E5E7EB] transition-colors"><Edit className="h-4 w-4" /></button>
                          <a href={getWhatsAppLink(m)} target="_blank" rel="noreferrer" onClick={handleWhatsApp} title="WhatsApp" className="p-1.5 text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-md shadow-sm transition-colors"><MessageCircle className="h-4 w-4" /></a>
                          <button onClick={(e) => handleDelete(e, m.id, m.fullName)} title="Delete Member" className="p-1.5 text-[#6B7280] hover:text-[#DC2626] bg-gray-50 rounded-md border border-[#E5E7EB] transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Desktop Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-white">
                  <div className="text-sm text-[#6B7280]">
                    Showing <span className="font-medium text-[#1F2937]">{startIndex + 1}</span> to <span className="font-medium text-[#1F2937]">{Math.min(startIndex + rowsPerPage, filteredMembers.length)}</span> of <span className="font-medium text-[#1F2937]">{filteredMembers.length}</span> results
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
          </div>

          {/* --- MOBILE CARDS --- */}
          <div className="sm:hidden space-y-3">
             {currentData.map(m => (
              <div 
                key={m.id} 
                onClick={() => router.push(`/members/${m.id}`)}
                className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col gap-3 active:bg-gray-50 transition-colors cursor-pointer"
              >
                 <div className="flex justify-between items-start">
                   <div className="flex items-center gap-3">
                     <Avatar url={m.profilePicUrl} name={m.fullName} />
                     <div>
                       <h3 className="font-bold text-[#1F2937] text-base leading-tight">{m.fullName}</h3>
                       <p className="text-xs text-[#6B7280] font-medium">{m.membershipId}</p>
                     </div>
                   </div>
                   <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold border rounded-md ${getStatusColor(m.status)}`}>
                     {m.status}
                   </span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm bg-[#F9FAFB] p-3 rounded-lg border border-[#F3F4F6]">
                   <div>
                     <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Plan</p>
                     <p className="font-semibold text-[#4B5563] text-xs">{m.planType}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Shift</p>
                     <p className="font-semibold text-[#4B5563] text-xs">{m.accessShift}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Mobile</p>
                     <p className="font-semibold text-[#4B5563] text-xs break-all">{m.mobileNumber}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Start</p>
                     <p className="font-semibold text-[#4B5563] text-xs">{m.startDate}</p>
                   </div>
                   <div className="col-span-2">
                     <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Expiry</p>
                     <p className="font-semibold text-[#4B5563] text-xs">{m.expiryDate}</p>
                   </div>
                   {(m.personalTrainingFee || 0) > 0 && <div className="col-span-2"><p className="text-[10px] uppercase tracking-wider text-cyan-700 font-bold mb-0.5">Personal Training</p><p className="font-semibold text-cyan-800 text-xs">{m.personalTrainingPlanName || 'Personal Training'}{m.personalTrainingPlanDuration ? ` · ${m.personalTrainingPlanDuration}` : ''} · ₹{m.personalTrainingFee}</p></div>}
                 </div>

                 <div className="flex justify-between items-center gap-3 mt-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">Balance</p>
                      <p className={`font-bold ${m.balanceDue > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>₹{m.balanceDue}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#F3F4F6]">
                   <button onClick={(e) => handleView(e, m.id)} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#2563EB] bg-[#2563EB]/10 rounded-lg"><Eye className="h-4 w-4" /> View details</button>
                   <button onClick={(e) => handleEdit(e, m.id)} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#4B5563] bg-gray-100 rounded-lg"><Edit className="h-4 w-4" /> Edit</button>
                   <a href={getWhatsAppLink(m)} target="_blank" rel="noreferrer" onClick={handleWhatsApp} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-white bg-[#25D366] rounded-lg shadow-sm"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                   <button onClick={(e) => handleDelete(e, m.id, m.fullName)} className="h-10 flex items-center justify-center gap-2 text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 rounded-lg"><Trash2 className="h-4 w-4" /> Delete</button>
                 </div>
              </div>
            ))}

            {/* Mobile Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-2 mt-4">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] disabled:opacity-50 shadow-sm">Prev</button>
                <span className="text-sm font-medium text-[#6B7280]">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] disabled:opacity-50 shadow-sm">Next</button>
              </div>
             )}
          </div>
        </>
      )}
      
    </div>
  );
};
