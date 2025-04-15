import AdminLayout from '@/components/AdminLayout';
import { AdminStats } from '@/components/admin/AdminStats';
import { ViewsChart } from '@/components/admin/ViewsChart';
import { RecentActivity } from '@/components/admin/RecentActivity';
import { SalesChart } from '@/components/admin/SalesChart';
import Head from 'next/head';

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        
        <AdminStats />
        
        <div className="grid lg:grid-cols-2 gap-6">
          <SalesChart />
          <ViewsChart />
          <RecentActivity />
        </div>
      </div>
    </AdminLayout>
  );
}
