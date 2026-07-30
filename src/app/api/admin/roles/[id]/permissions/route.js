import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { validate } from '@/lib/validate';
import { Role, Permission } from '@/models';
import { addPermissionToRole } from '@/lib/rbac';

export async function POST(request, { params }) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const { valid, errors } = validate(body, { permissionId: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const [role, permission] = await Promise.all([
    Role.findByPk(id),
    Permission.findByPk(body.permissionId),
  ]);
  if (!role) return fail('Role not found', 404);
  if (!permission) return fail('Permission not found', 404);

  await addPermissionToRole(role.id, permission.id);
  return success({ message: 'Permission assigned to role' }, 201);
}
