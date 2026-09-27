import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { auth, db, COLLECTIONS } from './firebase';

export interface Member {
  id: string;
  membershipId: string;
  fullName: string;
  profilePicUrl: string | null;
  profilePicPath?: string | null;
  mobileNumber: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  planType: string;
  accessShift: string;
  startDate: string;
  expiryDate: string;
  status: 'Active' | 'Expiring' | 'Expired' | 'Frozen' | 'Cancelled';
  totalFee: number;
  membershipFee?: number;
  personalTrainingPlanId?: string | null;
  personalTrainingPlanName?: string | null;
  personalTrainingPlanDuration?: string | null;
  personalTrainingFee?: number;
  discount: number;
  amountPaid: number;
  balanceDue: number;
  freezeFrom?: string;
  freezeUntil?: string;
  freezeReason?: string;
  frozenAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  lastResumedAt?: string;
  lastRenewedAt?: string;
  renewalCount?: number;
  membershipHistory?: MembershipActivity[];
  createdAt: unknown;
}

export type MembershipActivityType = 'Created' | 'Renewed' | 'Frozen' | 'Resumed' | 'Cancelled' | 'Reactivated';

export interface MembershipActivity {
  id: string;
  type: MembershipActivityType;
  title: string;
  details: string;
  occurredAt: string;
}

export interface RenewMembershipInput {
  planType: string;
  startDate: string;
  expiryDate: string;
  membershipFee: number;
  keepPersonalTraining: boolean;
}

interface UploadedProfilePicture {
  url: string;
  path: string;
}

const dateOnlyTimestamp = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const startOfToday = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
};

const formatDateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const statusForExpiry = (expiryDate: string): Member['status'] => {
  const expiryTimestamp = dateOnlyTimestamp(expiryDate);
  if (expiryTimestamp === null) return 'Active';
  const daysUntilExpiry = Math.ceil((expiryTimestamp - startOfToday()) / 86_400_000);
  if (daysUntilExpiry < 0) return 'Expired';
  if (daysUntilExpiry <= 7) return 'Expiring';
  return 'Active';
};

const activity = (type: MembershipActivityType, title: string, details: string): MembershipActivity => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  type,
  title,
  details,
  occurredAt: new Date().toISOString(),
});

const appendActivity = (member: Partial<Member>, event: MembershipActivity) => {
  const existing = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
  return [...existing.slice(-49), event];
};

const normalizeStatus = (member: Member): Member['status'] => {
  const savedStatus = String(member.status || '').toLowerCase();
  if (savedStatus === 'cancelled' || savedStatus === 'canceled') return 'Cancelled';
  if (savedStatus === 'frozen' || savedStatus === 'freezed') return 'Frozen';

  const expiryTimestamp = dateOnlyTimestamp(member.expiryDate);
  if (expiryTimestamp === null) {
    if (savedStatus === 'expired') return 'Expired';
    if (savedStatus === 'expiring') return 'Expiring';
    return 'Active';
  }

  const daysUntilExpiry = Math.ceil((expiryTimestamp - startOfToday()) / 86_400_000);
  if (daysUntilExpiry < 0) return 'Expired';
  if (daysUntilExpiry <= 7) return 'Expiring';
  return 'Active';
};

const normalizeMember = (member: Member): Member => ({
  ...member,
  status: normalizeStatus(member),
  totalFee: Number(member.totalFee) || 0,
  membershipFee: Number(member.membershipFee) || Math.max(0, (Number(member.totalFee) || 0) - (Number(member.personalTrainingFee) || 0)),
  personalTrainingFee: Number(member.personalTrainingFee) || 0,
  discount: Number(member.discount) || 0,
  amountPaid: Number(member.amountPaid) || 0,
  balanceDue: Number(member.balanceDue) || 0,
});

const createdAtMillis = (value: unknown) => {
  if (!value || typeof value !== 'object') return 0;
  const timestamp = value as { toMillis?: () => number; seconds?: number };
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  return 0;
};

export async function getMembers(): Promise<Member[]> {
  const membersRef = collection(db, COLLECTIONS.MEMBERS);
  const snapshot = await getDocs(membersRef);
  return snapshot.docs
    .map(document => normalizeMember({ id: document.id, ...document.data() } as Member))
    .sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt));
}

export async function getMember(id: string): Promise<Member | null> {
  const documentRef = doc(db, COLLECTIONS.MEMBERS, id);
  const snapshot = await getDoc(documentRef);
  return snapshot.exists() ? normalizeMember({ id: snapshot.id, ...snapshot.data() } as Member) : null;
}

export async function uploadProfilePicture(file: File, membershipId: string): Promise<UploadedProfilePicture> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('You must be signed in to upload a profile picture.');

  const idToken = await currentUser.getIdToken();
  const formData = new FormData();
  formData.append('image', file);
  formData.append('memberId', membershipId);

  const response = await fetch('/api/profile-picture', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });

  const responseText = await response.text();
  let result: Partial<UploadedProfilePicture> & { error?: string } = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText) as Partial<UploadedProfilePicture> & { error?: string };
    } catch {
      result = { error: `The upload server returned an invalid response (${response.status}).` };
    }
  }
  if (!response.ok || !result.url || !result.path) {
    throw new Error(result.error || `Profile-picture upload failed (${response.status}).`);
  }

  return { url: result.url, path: result.path };
}

export async function addMember(
  memberData: Omit<Member, 'id' | 'createdAt'>,
  profilePicFile: File | null,
): Promise<void> {
  let profilePicUrl = memberData.profilePicUrl ?? null;
  let profilePicPath = memberData.profilePicPath ?? null;

  if (profilePicFile) {
    const uploaded = await uploadProfilePicture(profilePicFile, memberData.membershipId);
    profilePicUrl = uploaded.url;
    profilePicPath = uploaded.path;
  }

  const newDocumentRef = doc(collection(db, COLLECTIONS.MEMBERS));
  await setDoc(newDocumentRef, {
    ...memberData,
    profilePicUrl,
    profilePicPath,
    createdAt: Timestamp.now(),
  });
}

export async function updateMember(
  id: string,
  memberData: Partial<Member>,
  profilePicFile: File | null,
): Promise<void> {
  const updatePayload: Partial<Member> = { ...memberData };

  if (profilePicFile && memberData.membershipId) {
    const uploaded = await uploadProfilePicture(profilePicFile, memberData.membershipId);
    updatePayload.profilePicUrl = uploaded.url;
    updatePayload.profilePicPath = uploaded.path;
  }

  await updateDoc(doc(db, COLLECTIONS.MEMBERS, id), updatePayload);
}

export async function deleteMember(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.MEMBERS, id));
}

export async function freezeMembership(
  id: string,
  data: { from: string; until?: string; reason: string },
): Promise<void> {
  const memberRef = doc(db, COLLECTIONS.MEMBERS, id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(memberRef);
    if (!snapshot.exists()) throw new Error('The member no longer exists.');
    const member = snapshot.data() as Member;
    if (String(member.status) === 'Cancelled') throw new Error('Reactivate or renew the cancelled membership before freezing it.');
    if (String(member.status) === 'Frozen') throw new Error('This membership is already frozen.');

    const event = activity(
      'Frozen',
      'Membership frozen',
      data.until ? `${data.from} to ${data.until} · ${data.reason}` : `From ${data.from} · ${data.reason}`,
    );
    transaction.update(memberRef, {
      status: 'Frozen',
      freezeFrom: data.from,
      freezeUntil: data.until || deleteField(),
      freezeReason: data.reason.trim(),
      frozenAt: new Date().toISOString(),
      membershipHistory: appendActivity(member, event),
    });
  });
}

export async function resumeMembership(id: string): Promise<void> {
  const memberRef = doc(db, COLLECTIONS.MEMBERS, id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(memberRef);
    if (!snapshot.exists()) throw new Error('The member no longer exists.');
    const member = snapshot.data() as Member;
    if (String(member.status) !== 'Frozen') throw new Error('Only a frozen membership can be resumed.');

    const freezeStart = dateOnlyTimestamp(member.freezeFrom || member.frozenAt?.slice(0, 10) || '');
    const todayTimestamp = startOfToday();
    const pausedDays = freezeStart === null ? 0 : Math.max(0, Math.ceil((todayTimestamp - freezeStart) / 86_400_000));
    const expiryTimestamp = dateOnlyTimestamp(member.expiryDate);
    const extendedExpiry = expiryTimestamp === null
      ? member.expiryDate
      : formatDateOnly(new Date(expiryTimestamp + pausedDays * 86_400_000));
    const event = activity(
      'Resumed',
      'Membership resumed',
      pausedDays > 0 ? `Resumed after ${pausedDays} paused day${pausedDays === 1 ? '' : 's'}; expiry extended to ${extendedExpiry}.` : 'Membership resumed on the same day.',
    );

    transaction.update(memberRef, {
      status: statusForExpiry(extendedExpiry),
      expiryDate: extendedExpiry,
      freezeFrom: deleteField(),
      freezeUntil: deleteField(),
      freezeReason: deleteField(),
      frozenAt: deleteField(),
      lastResumedAt: new Date().toISOString(),
      membershipHistory: appendActivity(member, event),
    });
  });
}

export async function cancelMembership(id: string, reason: string): Promise<void> {
  const memberRef = doc(db, COLLECTIONS.MEMBERS, id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(memberRef);
    if (!snapshot.exists()) throw new Error('The member no longer exists.');
    const member = snapshot.data() as Member;
    if (String(member.status) === 'Cancelled') throw new Error('This membership is already cancelled.');
    const cleanReason = reason.trim() || 'Cancelled by administrator';
    const event = activity('Cancelled', 'Membership cancelled', cleanReason);
    transaction.update(memberRef, {
      status: 'Cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: cleanReason,
      freezeFrom: deleteField(),
      freezeUntil: deleteField(),
      freezeReason: deleteField(),
      frozenAt: deleteField(),
      membershipHistory: appendActivity(member, event),
    });
  });
}

export async function reactivateMembership(id: string): Promise<void> {
  const memberRef = doc(db, COLLECTIONS.MEMBERS, id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(memberRef);
    if (!snapshot.exists()) throw new Error('The member no longer exists.');
    const member = snapshot.data() as Member;
    if (String(member.status) !== 'Cancelled') throw new Error('Only a cancelled membership can be reactivated.');
    const nextStatus = statusForExpiry(member.expiryDate);
    if (nextStatus === 'Expired') throw new Error('This membership has expired. Use Renew Membership to reactivate it with new dates.');
    const event = activity('Reactivated', 'Membership reactivated', `Original expiry ${member.expiryDate} restored.`);
    transaction.update(memberRef, {
      status: nextStatus,
      cancelledAt: deleteField(),
      cancellationReason: deleteField(),
      membershipHistory: appendActivity(member, event),
    });
  });
}

export async function renewMembership(id: string, input: RenewMembershipInput): Promise<void> {
  const memberRef = doc(db, COLLECTIONS.MEMBERS, id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(memberRef);
    if (!snapshot.exists()) throw new Error('The member no longer exists.');
    const member = snapshot.data() as Member;
    const membershipFee = Math.max(0, Number(input.membershipFee) || 0);
    const personalTrainingFee = input.keepPersonalTraining ? Math.max(0, Number(member.personalTrainingFee) || 0) : 0;
    const totalFee = membershipFee + personalTrainingFee;
    const event = activity(
      'Renewed',
      String(member.status) === 'Cancelled' ? 'Membership renewed and reactivated' : 'Membership renewed',
      `${input.planType}: ${input.startDate} to ${input.expiryDate}; new fee ₹${totalFee}.`,
    );

    transaction.update(memberRef, {
      planType: input.planType,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      status: statusForExpiry(input.expiryDate),
      membershipFee,
      personalTrainingFee,
      personalTrainingPlanId: input.keepPersonalTraining ? member.personalTrainingPlanId || null : null,
      personalTrainingPlanName: input.keepPersonalTraining ? member.personalTrainingPlanName || null : null,
      personalTrainingPlanDuration: input.keepPersonalTraining ? member.personalTrainingPlanDuration || null : null,
      totalFee,
      discount: 0,
      amountPaid: 0,
      balanceDue: totalFee,
      freezeFrom: deleteField(),
      freezeUntil: deleteField(),
      freezeReason: deleteField(),
      frozenAt: deleteField(),
      cancelledAt: deleteField(),
      cancellationReason: deleteField(),
      lastRenewedAt: new Date().toISOString(),
      renewalCount: Math.max(0, Number(member.renewalCount) || 0) + 1,
      membershipHistory: appendActivity(member, event),
    });
  });
}

export const getWhatsAppLink = (member: Member) => {
  const phone = member.mobileNumber.length === 10 ? `91${member.mobileNumber}` : member.mobileNumber;
  const personalTrainingLine = member.personalTrainingFee
    ? `\n*Personal Training:* ${member.personalTrainingPlanName || 'Included'}${member.personalTrainingPlanDuration ? ` (${member.personalTrainingPlanDuration})` : ''}\n*Personal Training Fee:* ₹${member.personalTrainingFee}`
    : '';
  const message = `Hello ${member.fullName},\n\nWelcome to MR GYM! Here are your membership details:\n\n*ID:* ${member.membershipId}\n*Plan:* ${member.planType}\n*Shift:* ${member.accessShift}${personalTrainingLine}\n*Total Fee:* ₹${member.totalFee}\n*Expiry Date:* ${member.expiryDate}\n*Balance Due:* ₹${member.balanceDue}\n\nThank you for choosing MR GYM!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
