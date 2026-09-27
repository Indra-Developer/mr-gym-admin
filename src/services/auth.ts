import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  // type User // <-- Added 'type' keyword here
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from './firebase';

export interface AdminProfile {
  uid: string;
  email: string;
  name?: string;
  role: 'admin';
}

/**
 * Signs in an admin user and verifies Firestore admin privileges.
 */
export async function loginAdmin(email: string, password: string, rememberMe: boolean): Promise<AdminProfile> {
  // Set persistence depending on Remember Me choice
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = credential.user;

  // Verify the user exists in the 'admins' Firestore collection
  const adminDocRef = doc(db, COLLECTIONS.ADMINS, user.uid);
  const adminSnap = await getDoc(adminDocRef);

  if (!adminSnap.exists()) {
    // Revoke session if user is not an authorized admin
    await signOut(auth);
    throw new Error('Access denied. This account does not have administrative privileges.');
  }

  const adminData = adminSnap.data();
  return {
    uid: user.uid,
    email: user.email || email,
    name: adminData?.name || 'Admin',
    role: 'admin',
  };
}

/**
 * Sends a password reset email via Firebase.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Signs out the current admin.
 */
export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
}