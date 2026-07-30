import { getSessionUser } from '@/lib/auth';
import { success, fail } from '@/lib/api-response';
import { User } from '@/models';
import { getUserRoles, getUserPermissions } from '@/lib/rbac';

export async function GET() {
  const session = await getSessionUser();
  if (!session) return fail('Not authenticated', 401);

  const user = await User.findByPk(session.id);
  if (!user) return fail('Not authenticated', 401);

  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);

  return success({ user: { id: user.id, email: user.email, roles, permissions } });
}
