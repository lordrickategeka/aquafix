import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { validate } from '@/lib/validate';
import { User, Role } from '@/models';
import { addRoleToUser } from '@/lib/rbac';

export async function POST(request, { params }) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const { valid, errors } = validate(body, { roleId: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const [user, role] = await Promise.all([
    User.findByPk(id),
    Role.findByPk(body.roleId),
  ]);
  if (!user) return fail('User not found', 404);
  if (!role) return fail('Role not found', 404);

  await addRoleToUser(user.id, role.id);
  return success({ message: 'Role assigned to user' }, 201);
}
