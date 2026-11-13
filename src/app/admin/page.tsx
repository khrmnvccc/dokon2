import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBranchState } from '@/lib/admin/branch';
import { Alert } from '@/components/ui/kit';
import { PageHeader } from '@/components/admin/ui';
import { DashboardView, type Dashboard } from '@/components/admin/dashboard-view';

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requirePagePermission('dashboard.view');
  const { denied } = await searchParams;
  const supabase = await getServerSupabase();
  const branch = await getBranchState();
  const { data, error } = await supabase.rpc('admin_dashboard_live', { p_branch: branch.current || null });
  const d = data as Dashboard | null;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Bugungi holat, 14 kunlik savdo va oxirgi buyurtmalar" />
      {denied && <Alert tone="warn" className="mb-4">Sizda bu boʻlimga kirish huquqi yoʻq.</Alert>}
      {error || !d ? <Alert>Maʼlumotlarni yuklab boʻlmadi.</Alert> : <DashboardView d={d} perms={[...ctx.permissions]} />}
    </div>
  );
}
