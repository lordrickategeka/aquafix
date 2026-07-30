import { cookies } from 'next/headers';
import { clearSessionCookie } from '@/lib/auth';
import { success } from '@/lib/api-response';
import { buildFlashCookie } from '@/lib/flash';

export async function POST() {
  await clearSessionCookie();

  const cookieStore = await cookies();
  cookieStore.set(buildFlashCookie('info', "You've been logged out."));

  return success({ message: 'Logged out' });
}
