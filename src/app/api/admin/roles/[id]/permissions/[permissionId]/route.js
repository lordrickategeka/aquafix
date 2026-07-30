import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { Role, Permission } from '@/models';
import { removePermissionFromRole } from '@/lib/rbac';

export async function DELETE(request, { params }) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const { id, permissionId } = await params;
  const [role, permission] = await Promise.all([
    Role.findByPk(id),
    Permission.findByPk(permissionId),
  ]);
  if (!role) return fail('Role not found', 404);
  if (!permission) return fail('Permission not found', 404);

  await removePermissionFromRole(role.id, permission.id);
  return success({ message: 'Permission removed from role' });
}
