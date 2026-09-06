import { getOverviewData } from '@/lib/dashboard-data';
import Overview from './_components/overview';

export default async function DashboardPage() {
  const data = await getOverviewData();
  return <Overview data={data} />;
}
