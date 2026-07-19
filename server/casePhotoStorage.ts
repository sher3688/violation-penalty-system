import { getRuntimeEnv } from "./runtimeEnv";
import * as db from "./db";

export const MAX_CASE_PHOTO_SIZE = 8 * 1024 * 1024;
export const MAX_CASE_PHOTOS = 6;

const allowedMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export function extensionForCasePhoto(mimeType: string) {
  return allowedMimeTypes.get(mimeType) ?? null;
}

export function isSafeCasePhotoStorageKey(value: string) {
  return /^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(value);
}

export function validateCasePhotoUpload(input: { mimetype: string; size: number }): string | null {
  if (!allowedMimeTypes.has(input.mimetype)) return "只接受 JPEG、PNG 或 WebP 格式的照片。";
  if (!Number.isFinite(input.size) || input.size < 0) return "照片大小資料不正確。";
  if (input.size > MAX_CASE_PHOTO_SIZE) return "單張照片不可超過 8 MB。";
  return null;
}

export async function removeCasePhoto(storageKey: string) {
  if (!isSafeCasePhotoStorageKey(storageKey)) throw new Error("照片識別碼格式不正確。");

  const bucket = getRuntimeEnv()?.CASE_PHOTOS;
  if (bucket) {
    await bucket.delete(storageKey);
    return;
  }

  if (getRuntimeEnv()) {
    await db.deleteCasePhotoObject(storageKey);
    return;
  }

  // Local Node development fallback. These imports are only evaluated outside Workers.
  const [{ unlink }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
  try {
    await unlink(path.join(uploadDir, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
