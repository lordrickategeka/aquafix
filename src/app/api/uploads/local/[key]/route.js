import { getSessionUser } from '@/lib/auth';
import { success, fail } from '@/lib/api-response';
import { saveLocalFile, readLocalFile, guessContentType } from '@/lib/storage';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const SAFE_KEY = /^[a-zA-Z0-9._-]+$/;

export async function PUT(request, { params }) {
  const session = await getSessionUser();
  if (!session) return fail('Not authenticated', 401);

  const { key } = await params;
  if (!SAFE_KEY.test(key)) return fail('Invalid key', 400);

  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) return fail('File too large', 413);

  await saveLocalFile(key, Buffer.from(arrayBuffer));
  return success({ message: 'Uploaded' });
}

// Unauthenticated on purpose: mirrors the S3 driver's public-read URL, so
// behavior is the same regardless of which STORAGE_DRIVER is active.
export async function GET(request, { params }) {
  const { key } = await params;
  if (!SAFE_KEY.test(key)) return fail('Invalid key', 400);

  try {
    const buffer = await readLocalFile(key);
    return new Response(buffer, {
      headers: { 'Content-Type': guessContentType(key) },
    });
  } catch {
    return fail('Not found', 404);
  }
}
