import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Op } from 'sequelize';
import { getSessionUser } from '@/lib/auth';
import { userHasRole } from '@/lib/rbac';
import { readFlash, FLASH_COOKIE_NAME } from '@/lib/flash';
import FlashToast from '@/components/flash-toast';
import { Consumer, Reading, BillingCycle } from '@/models';
import { getSettings } from '@/lib/settings';
import Shell from './_components/shell';

export default async function DashboardLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const isAdmin = await userHasRole(user.id, 'admin');
  const cookieStore = await cookies();
  const flash = readFlash(cookieStore.get(FLASH_COOKIE_NAME)?.value);

  const settings = await getSettings();

  const cycle = await BillingCycle.findOne({
    where: { status: { [Op.in]: ['open', 'locked'] } },
    order: [['period', 'DESC']],
  });

  const [consumers, exceptions, arrears] = await Promise.all([
    Consumer.count({ where: { status: { [Op.in]: ['active', 'new'] } } }),
    cycle
      ? Reading.count({ where: { billing_cycle_id: cycle.id, status: 'pending' } })
      : Promise.resolve(0),
    Consumer.count({ where: { balance: { [Op.gt]: 0 } } }),
  ]);

  return (
    <>
      <FlashToast initial={flash} />
      <Shell
        sidebar={{
          email: user.email,
          isAdmin,
          counts: { consumers, exceptions, arrears },
          org: {
            name: settings.organisation_name,
            initials: settings.organisation_initials,
            tagline: settings.tagline,
          },
        }}
        header={{
          org: settings.organisation_name,
          consumers,
          cycle: cycle ? { period: cycle.period, status: cycle.status } : null,
        }}
      >
        {children}
      </Shell>
    </>
  );
}
