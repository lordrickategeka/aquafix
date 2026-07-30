import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { userHasRole } from '@/lib/rbac';
import { readFlash, FLASH_COOKIE_NAME } from '@/lib/flash';
import FlashToast from '@/components/flash-toast';
import LogoutButton from './logout-button';

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const isAdmin = await userHasRole(user.id, 'admin');
  const cookieStore = await cookies();
  const flash = readFlash(cookieStore.get(FLASH_COOKIE_NAME)?.value);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <FlashToast initial={flash} />
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Logged in as {user.email}</p>
      </div>
      {isAdmin && (
        <Link
          href="/dashboard/admin"
          className="text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Manage users, roles &amp; permissions
        </Link>
      )}
      <LogoutButton />
    </div>
  );
}
