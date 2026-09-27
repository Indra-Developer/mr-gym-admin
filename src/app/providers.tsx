'use client';

import { AuthProvider } from '@/context/AuthContext';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <RegisterServiceWorker />
    </AuthProvider>
  );
}
