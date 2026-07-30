import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { Role } from '@/models';

export async function DELETE(request, { params }) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const { id } = await params;
  const role = await Role.findByPk(id);
  if (!role) return fail('Role not found', 404);

  await role.destroy();
  return success({ message: 'Role deleted' });
}
