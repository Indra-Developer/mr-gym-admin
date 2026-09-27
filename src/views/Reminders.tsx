'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, CalendarClock, CreditCard, Eye, Loader2, MessageCircle, Search, Snowflake } from 'lucide-react';
import { getMembers } from '../services/members';
import { buildMemberReminders, getReminderWhatsAppLink, type MemberReminder, type ReminderType } from '../services/reminders';

const reminderTypes: ReminderType[] = ['Expiring', 'Expired', 'Payment Due', 'Frozen'];
const filters: Array<'All' | ReminderType> = ['All', ...reminderTypes];

export const Reminders: React.FC = () => {
  const router = useRouter();
  const [reminders, setReminders] = useState<MemberReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | ReminderType>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMembers()
      .then((members) => setReminders(buildMemberReminders(members)))
      .catch((error) => {
        console.error('Failed to load reminders:', error);
        setReminders([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    Expiring: reminders.filter((item) => item.type === 'Expiring').length,
    Expired: reminders.filter((item) => item.type === 'Expired').length,
    'Payment Due': reminders.filter((item) => item.type === 'Payment Due').length,
    Frozen: reminders.filter((item) => item.type === 'Frozen').length,
  }), [reminders]);

  const visibleReminders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reminders.filter((item) => {
      const matchesFilter = filter === 'All' || item.type === filter;
      const matchesSearch = !query || item.fullName.toLowerCase().includes(query) || item.membershipId.toLowerCase().includes(query) || item.mobileNumber.includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, reminders, search]);

  const iconFor = (type: ReminderType) => {
    if (type === 'Payment Due') return CreditCard;
    if (type === 'Frozen') return Snowflake;
    if (type === 'Expired') return AlertTriangle;
    return CalendarClock;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 sm:pb-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">Reminders</h1>
        <p className="text-sm text-[#6B7280] mt-1">Membership, payment, and frozen-account follow-ups</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {reminderTypes.map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`text-left rounded-xl border p-4 transition-colors ${filter === item ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-white hover:border-[#BFDBFE]'}`}>
            <p className="text-xs font-semibold text-[#6B7280]">{item}</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{counts[item]}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[#E5E7EB] flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {filters.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === item ? 'bg-[#2563EB] text-white' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>{item}</button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member, ID, mobile..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#2563EB] text-sm" />
          </div>
        </div>

        {visibleReminders.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280]"><Bell className="h-9 w-9 mx-auto mb-3 text-[#9CA3AF]" />No reminders found.</div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {visibleReminders.map((reminder) => {
              const Icon = iconFor(reminder.type);
              return (
                <div key={reminder.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {reminder.profilePicUrl ? <img src={reminder.profilePicUrl} alt={reminder.fullName} className="h-12 w-12 rounded-full object-cover border border-[#E5E7EB]" /> : <div className="h-12 w-12 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold">{reminder.fullName.charAt(0).toUpperCase()}</div>}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#D97706]" /><span className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">{reminder.type}</span></div>
                      <p className="font-bold text-[#1F2937] truncate">{reminder.fullName}</p>
                      <p className="text-sm text-[#6B7280]">{reminder.membershipId} · {reminder.message}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    <button onClick={() => router.push(`/members/${reminder.memberId}`)} className="h-10 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] flex items-center gap-2 text-sm font-medium hover:bg-gray-50"><Eye className="h-4 w-4" /> View</button>
                    <a href={getReminderWhatsAppLink(reminder)} target="_blank" rel="noreferrer" className="h-10 px-3 rounded-lg bg-[#25D366] text-white flex items-center gap-2 text-sm font-medium hover:bg-[#20bd5a]"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
