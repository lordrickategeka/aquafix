import { requireRole } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { validate } from '@/lib/validate';
import { Permission } from '@/models';

export async function GET() {
  const { response } = await requireRole('admin');
  if (response) return response;

  const permissions = await Permission.findAll({ order: [['id', 'ASC']] });

  return success({
    permissions: permissions.map((permission) => ({
      id: permission.id,
      name: permission.name,
    })),
  });
}

export async function POST(request) {
  const { response } = await requireRole('admin');
  if (response) return response;

  const body = await request.json();
  const { valid, errors } = validate(body, { name: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const existing = await Permission.findOne({ where: { name: body.name } });
  if (existing) return fail('Permission already exists', 400);

  const permission = await Permission.create({ name: body.name });
  return success({ permission: { id: permission.id, name: permission.name } }, 201);
}
