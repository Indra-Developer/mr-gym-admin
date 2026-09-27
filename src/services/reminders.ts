import type { Member } from './members';

export type ReminderType = 'Expiring' | 'Expired' | 'Payment Due' | 'Frozen';

export interface MemberReminder {
  id: string;
  type: ReminderType;
  memberId: string;
  membershipId: string;
  fullName: string;
  mobileNumber: string;
  profilePicUrl: string | null;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  sortValue: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysFromToday(dateValue: string) {
  const target = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target.getTime() - startOfToday().getTime()) / DAY_MS);
}

export function buildMemberReminders(members: Member[]): MemberReminder[] {
  const reminders: MemberReminder[] = [];

  for (const member of members) {
    if (member.status === 'Cancelled') continue;

    if (member.expiryDate) {
      const days = daysFromToday(member.expiryDate);
      if (days < 0 || member.status === 'Expired') {
        reminders.push({
          id: `${member.id}:expired`,
          type: 'Expired',
          memberId: member.id,
          membershipId: member.membershipId,
          fullName: member.fullName,
          mobileNumber: member.mobileNumber,
          profilePicUrl: member.profilePicUrl,
          title: 'Membership expired',
          message: `Expired ${Math.max(1, Math.abs(days))} day${Math.abs(days) === 1 ? '' : 's'} ago`,
          severity: 'critical',
          sortValue: days,
        });
      } else if (days <= 7 && member.status !== 'Frozen') {
        reminders.push({
          id: `${member.id}:expiring`,
          type: 'Expiring',
          memberId: member.id,
          membershipId: member.membershipId,
          fullName: member.fullName,
          mobileNumber: member.mobileNumber,
          profilePicUrl: member.profilePicUrl,
          title: 'Membership expiring soon',
          message: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`,
          severity: days <= 2 ? 'critical' : 'warning',
          sortValue: days,
        });
      }
    }

    if ((member.balanceDue || 0) > 0) {
      reminders.push({
        id: `${member.id}:payment`,
        type: 'Payment Due',
        memberId: member.id,
        membershipId: member.membershipId,
        fullName: member.fullName,
        mobileNumber: member.mobileNumber,
        profilePicUrl: member.profilePicUrl,
        title: 'Payment pending',
        message: `Balance due: ₹${new Intl.NumberFormat('en-IN').format(member.balanceDue)}`,
        severity: 'warning',
        sortValue: -member.balanceDue,
      });
    }

    if (member.status === 'Frozen') {
      reminders.push({
        id: `${member.id}:frozen`,
        type: 'Frozen',
        memberId: member.id,
        membershipId: member.membershipId,
        fullName: member.fullName,
        mobileNumber: member.mobileNumber,
        profilePicUrl: member.profilePicUrl,
        title: 'Membership frozen',
        message: member.freezeUntil ? `Frozen until ${member.freezeUntil}` : 'Review frozen membership',
        severity: 'info',
        sortValue: member.freezeUntil ? daysFromToday(member.freezeUntil) : 9999,
      });
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
  return reminders.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.sortValue - b.sortValue);
}

export function getReminderWhatsAppLink(reminder: MemberReminder) {
  const phone = reminder.mobileNumber.length === 10 ? `91${reminder.mobileNumber}` : reminder.mobileNumber;
  const message = `Hello ${reminder.fullName},\n\nReminder from MR GYM:\n${reminder.title}\n${reminder.message}\n\nPlease contact us if you need any assistance.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
