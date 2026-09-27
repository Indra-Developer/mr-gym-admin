import { collection, getDocs, doc, getDoc, query, orderBy, runTransaction, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
// import { getMember } from './members';

export interface Payment {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  membershipId: string;
  transactionDate: string;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  membershipFee?: number;
  personalTrainingPlanId?: string | null;
  personalTrainingPlanName?: string | null;
  personalTrainingPlanDuration?: string | null;
  personalTrainingFee?: number;
  totalFee: number;
  discount: number;
  amountPaid: number;
  balanceDue: number;
  status: 'Paid' | 'Partial' | 'Due';
  createdAt: unknown;
}

const money = (value: unknown) => Math.max(0, Number(value) || 0);

const paymentStatus = (amountPaid: number, balanceDue: number): Payment['status'] => {
  if (amountPaid <= 0) return 'Due';
  return balanceDue === 0 ? 'Paid' : 'Partial';
};

type NewPayment = Omit<Payment, 'id' | 'invoiceNumber' | 'status' | 'createdAt' | 'balanceDue'>;

const normalizePayment = (payment: Payment): Payment => {
  const personalTrainingFee = money(payment.personalTrainingFee);
  const totalFee = money(payment.totalFee);
  return {
    ...payment,
    membershipFee: money(payment.membershipFee ?? Math.max(0, totalFee - personalTrainingFee)),
    personalTrainingFee,
    totalFee,
    discount: money(payment.discount),
    amountPaid: money(payment.amountPaid),
    balanceDue: money(payment.balanceDue),
  };
};

export async function getPayments(): Promise<Payment[]> {
  const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);
  const q = query(paymentsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(document => normalizePayment({ id: document.id, ...document.data() } as Payment));
}

export async function getPayment(id: string): Promise<Payment | null> {
  const docRef = doc(db, COLLECTIONS.PAYMENTS, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) return normalizePayment({ id: snapshot.id, ...snapshot.data() } as Payment);
  return null;
}

export async function recordPayment(data: NewPayment): Promise<string> {
  const paymentRef = doc(collection(db, COLLECTIONS.PAYMENTS));
  const invoiceNumber = `INV-${paymentRef.id.slice(0, 8).toUpperCase()}`;
  const memberRef = doc(db, COLLECTIONS.MEMBERS, data.memberId);

  await runTransaction(db, async (transaction) => {
    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists()) throw new Error('The selected member no longer exists.');

    const member = memberSnapshot.data();
    const personalTrainingFee = money(data.personalTrainingFee);
    const membershipFee = money(data.membershipFee ?? Math.max(0, money(data.totalFee) - personalTrainingFee));
    const totalFee = membershipFee + personalTrainingFee;
    const discount = Math.min(totalFee, money(data.discount));
    const amountPaid = money(data.amountPaid);
    const previousAmountPaid = money(member.amountPaid);
    const cumulativeAmountPaid = previousAmountPaid + amountPaid;
    const balanceDue = Math.max(0, totalFee - discount - cumulativeAmountPaid);
    const status = paymentStatus(amountPaid, balanceDue);

    transaction.set(paymentRef, {
      ...data,
      membershipFee,
      personalTrainingFee,
      personalTrainingPlanId: data.personalTrainingPlanId || null,
      personalTrainingPlanName: data.personalTrainingPlanName || null,
      personalTrainingPlanDuration: data.personalTrainingPlanDuration || null,
      totalFee,
      discount,
      amountPaid,
      balanceDue,
      invoiceNumber,
      status,
      createdAt: Timestamp.now(),
    });
    transaction.update(memberRef, {
      totalFee,
      membershipFee,
      personalTrainingPlanId: data.personalTrainingPlanId || null,
      personalTrainingPlanName: data.personalTrainingPlanName || null,
      personalTrainingPlanDuration: data.personalTrainingPlanDuration || null,
      personalTrainingFee,
      discount,
      amountPaid: cumulativeAmountPaid,
      balanceDue,
    });
  });

  return paymentRef.id;
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<void> {
  const paymentRef = doc(db, COLLECTIONS.PAYMENTS, id);

  await runTransaction(db, async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error('The payment no longer exists.');

    const previousPayment = paymentSnapshot.data() as Payment;
    const memberId = previousPayment.memberId;
    const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists()) throw new Error('The payment member no longer exists.');

    const member = memberSnapshot.data();
    const personalTrainingFee = money(data.personalTrainingFee ?? previousPayment.personalTrainingFee ?? member.personalTrainingFee);
    const membershipFee = money(
      data.membershipFee
      ?? previousPayment.membershipFee
      ?? member.membershipFee
      ?? Math.max(0, money(data.totalFee ?? member.totalFee ?? previousPayment.totalFee) - personalTrainingFee)
    );
    const hasSeparatedFees = data.membershipFee !== undefined
      || data.personalTrainingFee !== undefined
      || previousPayment.membershipFee !== undefined;
    const totalFee = hasSeparatedFees
      ? membershipFee + personalTrainingFee
      : money(data.totalFee ?? member.totalFee ?? previousPayment.totalFee);
    const discount = Math.min(totalFee, money(data.discount ?? member.discount ?? previousPayment.discount));
    const oldPaymentAmount = money(previousPayment.amountPaid);
    const newPaymentAmount = money(data.amountPaid ?? previousPayment.amountPaid);
    const previousCumulativeAmount = money(member.amountPaid);
    const cumulativeAmountPaid = Math.max(0, previousCumulativeAmount - oldPaymentAmount + newPaymentAmount);
    const balanceDue = Math.max(0, totalFee - discount - cumulativeAmountPaid);
    const status = paymentStatus(newPaymentAmount, balanceDue);
    const personalTrainingPlanId = data.personalTrainingPlanId !== undefined
      ? data.personalTrainingPlanId || null
      : previousPayment.personalTrainingPlanId || null;
    const personalTrainingPlanName = data.personalTrainingPlanName !== undefined
      ? data.personalTrainingPlanName || null
      : previousPayment.personalTrainingPlanName || null;
    const personalTrainingPlanDuration = data.personalTrainingPlanDuration !== undefined
      ? data.personalTrainingPlanDuration || null
      : previousPayment.personalTrainingPlanDuration || null;

    transaction.update(paymentRef, {
      ...data,
      memberId,
      membershipFee,
      personalTrainingPlanId,
      personalTrainingPlanName,
      personalTrainingPlanDuration,
      personalTrainingFee,
      totalFee,
      discount,
      amountPaid: newPaymentAmount,
      balanceDue,
      status,
      updatedAt: Timestamp.now(),
    });
    transaction.update(memberRef, {
      totalFee,
      membershipFee,
      personalTrainingPlanId,
      personalTrainingPlanName,
      personalTrainingPlanDuration,
      personalTrainingFee,
      discount,
      amountPaid: cumulativeAmountPaid,
      balanceDue,
    });
  });
}

export async function deletePayment(id: string): Promise<void> {
  const paymentRef = doc(db, COLLECTIONS.PAYMENTS, id);

  await runTransaction(db, async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) return;

    const payment = paymentSnapshot.data() as Payment;
    const memberRef = doc(db, COLLECTIONS.MEMBERS, payment.memberId);
    const memberSnapshot = await transaction.get(memberRef);

    if (memberSnapshot.exists()) {
      const member = memberSnapshot.data();
      const totalFee = money(member.totalFee ?? payment.totalFee);
      const discount = Math.min(totalFee, money(member.discount ?? payment.discount));
      const cumulativeAmountPaid = Math.max(0, money(member.amountPaid) - money(payment.amountPaid));
      const balanceDue = Math.max(0, totalFee - discount - cumulativeAmountPaid);
      transaction.update(memberRef, { amountPaid: cumulativeAmountPaid, balanceDue });
    }

    transaction.delete(paymentRef);
  });
}

export const getPaymentWhatsAppLink = (payment: Payment, phone: string) => {
  const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
  const personalTrainingLine = payment.personalTrainingFee
    ? `\n*Personal Training:* ${payment.personalTrainingPlanName || 'Included'}${payment.personalTrainingPlanDuration ? ` (${payment.personalTrainingPlanDuration})` : ''} (₹${payment.personalTrainingFee})`
    : '';
  const message = `Hello ${payment.memberName},\n\nYour payment of ₹${payment.amountPaid} has been recorded successfully.\n\n*Invoice:* ${payment.invoiceNumber}\n*Date:* ${payment.transactionDate}\n*Mode:* ${payment.paymentMode}\n*Membership Fee:* ₹${payment.membershipFee ?? payment.totalFee}${personalTrainingLine}\n*Total Fee:* ₹${payment.totalFee}\n*Balance Due:* ₹${payment.balanceDue}\n\nThank you for choosing MR GYM.`;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};
