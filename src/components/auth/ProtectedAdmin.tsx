'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !admin) {
      router.replace('/login');
    }
  }, [admin, loading, router]);

  if (loading || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] text-[#6B7280]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return children;
}
