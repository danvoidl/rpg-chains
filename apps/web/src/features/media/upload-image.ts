import { ApiError } from '@/lib/api';
import { config } from '@/lib/config';

type AllowedContentType =
  'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'video/mp4' | 'video/webm';

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  headers: Record<string, string>;
}

/**
 * Presigns an S3 upload URL (image or video) then PUTs the file directly to S3.
 * Returns the `publicUrl` on success; throws on non-2xx responses.
 */
export async function uploadMedia(file: File): Promise<string> {
  const normalizedBase = config.apiUrl.replace(/\/+$/, '');
  const presignRes = await fetch(`${normalizedBase}/api/media/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ contentType: file.type as AllowedContentType, size: file.size }),
  });

  if (!presignRes.ok) {
    let body: unknown;
    try {
      body = await presignRes.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(presignRes.status, body);
  }

  const { uploadUrl, publicUrl, headers } = (await presignRes.json()) as PresignResponse;

  // Upload directly to S3 — no credentials (it's a presigned URL).
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`S3 upload failed with status ${uploadRes.status}`);
  }

  return publicUrl;
}

/** Uploads an image; same flow as {@link uploadMedia}. */
export function uploadImage(file: File): Promise<string> {
  return uploadMedia(file);
}
