import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { User, Role } from '@/models';
import { removeRoleFromUser } from '@/lib/rbac';

export async function DELETE(request, { params }) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const { id, roleId } = await params;
  const [user, role] = await Promise.all([User.findByPk(id), Role.findByPk(roleId)]);
  if (!user) return fail('User not found', 404);
  if (!role) return fail('Role not found', 404);

  await removeRoleFromUser(user.id, role.id);
  return success({ message: 'Role removed from user' });
}
