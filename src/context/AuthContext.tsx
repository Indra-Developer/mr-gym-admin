'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../services/firebase';
import { type AdminProfile } from '../services/auth';

interface AuthContextType {
  admin: AdminProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  admin: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, COLLECTIONS.ADMINS, firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setAdmin({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: data?.name || 'Admin',
              role: 'admin',
            });
          } else {
            setAdmin(null);
          }
        } catch {
          setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
