import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
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
  createdAt: unknown;
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

  const result = (await response.json()) as Partial<UploadedProfilePicture> & { error?: string };
  if (!response.ok || !result.url || !result.path) {
    throw new Error(result.error || 'Profile-picture upload failed.');
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

export const getWhatsAppLink = (member: Member) => {
  const phone = member.mobileNumber.length === 10 ? `91${member.mobileNumber}` : member.mobileNumber;
  const personalTrainingLine = member.personalTrainingFee
    ? `\n*Personal Training:* ${member.personalTrainingPlanName || 'Included'}${member.personalTrainingPlanDuration ? ` (${member.personalTrainingPlanDuration})` : ''}\n*Personal Training Fee:* ₹${member.personalTrainingFee}`
    : '';
  const message = `Hello ${member.fullName},\n\nWelcome to MR GYM! Here are your membership details:\n\n*ID:* ${member.membershipId}\n*Plan:* ${member.planType}\n*Shift:* ${member.accessShift}${personalTrainingLine}\n*Total Fee:* ₹${member.totalFee}\n*Expiry Date:* ${member.expiryDate}\n*Balance Due:* ₹${member.balanceDue}\n\nThank you for choosing MR GYM!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
