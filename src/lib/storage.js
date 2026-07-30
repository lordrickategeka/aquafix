import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local';
// Kept outside `public/` on purpose: Next.js indexes the public directory at
// server start and won't serve files written into it afterward, so local
// uploads are served through our own route instead (see api/uploads/local).
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');

const CONTENT_TYPES_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

function s3Client() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

function buildKey(filename) {
  return `${crypto.randomUUID()}${path.extname(filename || '')}`;
}

// Laravel's Storage::disk() equivalent: callers always go through this one
// module; STORAGE_DRIVER decides whether bytes end up on local disk or in an
// S3-compatible bucket (AWS S3, Cloudflare R2, MinIO via S3_ENDPOINT).
export async function getUploadTarget({ filename, contentType }) {
  const key = buildKey(filename);

  if (STORAGE_DRIVER === 's3') {
    const uploadUrl = await getSignedUrl(
      s3Client(),
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );
    return { key, uploadUrl };
  }

  return { key, uploadUrl: `/api/uploads/local/${key}` };
}

export function getPublicUrl(key) {
  if (STORAGE_DRIVER === 's3') {
    if (process.env.S3_PUBLIC_URL_BASE) {
      return `${process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, '')}/${key}`;
    }
    return `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;
  }

  return `/api/uploads/local/${key}`;
}

export function guessContentType(key) {
  return CONTENT_TYPES_BY_EXT[path.extname(key).toLowerCase()] || 'application/octet-stream';
}

export async function saveLocalFile(key, buffer) {
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, key), buffer);
}

export async function readLocalFile(key) {
  return readFile(path.join(LOCAL_UPLOAD_DIR, key));
}
