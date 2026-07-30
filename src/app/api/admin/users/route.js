import { requireRole } from '@/lib/authorize';
import { success } from '@/lib/api-response';
import { User, Role } from '@/models';

export async function GET() {
  const { response } = await requireRole('admin');
  if (response) return response;

  const users = await User.findAll({
    attributes: ['id', 'email', 'created_at'],
    include: { model: Role, as: 'roles', attributes: ['id', 'name'] },
    order: [['id', 'ASC']],
  });

  return success({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      roles: user.roles.map((role) => ({ id: role.id, name: role.name })),
    })),
  });
}
