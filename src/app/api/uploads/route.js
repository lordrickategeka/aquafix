import { getSessionUser } from '@/lib/auth';
import { success, fail } from '@/lib/api-response';
import { validate } from '@/lib/validate';
import { getUploadTarget, getPublicUrl } from '@/lib/storage';

const ALLOWED_CONTENT_TYPES = [/^image\//, /^application\/pdf$/];

export async function POST(request) {
  const session = await getSessionUser();
  if (!session) return fail('Not authenticated', 401);

  const body = await request.json();
  const { valid, errors } = validate(body, { filename: 'required', contentType: 'required' });
  if (!valid) return fail('Validation failed', 422, errors);

  const { filename, contentType } = body;
  if (!ALLOWED_CONTENT_TYPES.some((pattern) => pattern.test(contentType))) {
    return fail('Unsupported file type', 422);
  }

  const { key, uploadUrl } = await getUploadTarget({ filename, contentType });
  return success({ key, uploadUrl, publicUrl: getPublicUrl(key) }, 201);
}
