import { cookies } from 'next/headers';
import { success } from '@/lib/api-response';
import { FLASH_COOKIE_NAME } from '@/lib/flash';

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(FLASH_COOKIE_NAME);
  return success({ message: 'Flash cleared' });
}
