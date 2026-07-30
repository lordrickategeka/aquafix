import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { Permission } from '@/models';

export async function DELETE(request, { params }) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const { id } = await params;
  const permission = await Permission.findByPk(id);
  if (!permission) return fail('Permission not found', 404);

  await permission.destroy();
  return success({ message: 'Permission deleted' });
}
