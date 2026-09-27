import { ProtectedAdmin } from '@/components/auth/ProtectedAdmin';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedAdmin>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedAdmin>
  );
}
