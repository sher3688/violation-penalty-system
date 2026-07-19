import { randomBytes } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import * as db from "./db";
import { getLocalSessionUser } from "./localAuth";

export const MAX_CASE_PHOTO_SIZE = 8 * 1024 * 1024;
export const MAX_CASE_PHOTOS = 6;
const allowedMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function getUploadDirectory() {
  return path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
}

async function ensureUploadDirectory() {
  const directory = getUploadDirectory();
  await mkdir(directory, { recursive: true });
  return directory;
}

export type LocalCasePhotoInput = Pick<Express.Multer.File, "buffer" | "mimetype" | "originalname" | "size">;

export async function saveLocalCasePhoto(file: LocalCasePhotoInput) {
  const validationError = validateCasePhotoUpload(file);
  if (validationError) throw new Error(validationError);

  const extension = allowedMimeTypes.get(file.mimetype);
  if (!extension) throw new Error("不支援的照片格式。");

  const directory = await ensureUploadDirectory();
  const storageKey = `${Date.now()}-${randomBytes(12).toString("hex")}${extension}`;
  await writeFile(path.join(directory, storageKey), file.buffer, { flag: "wx" });
  return {
    storageKey,
    originalName: file.originalname.slice(0, 255),
    mimeType: file.mimetype,
  };
}

export async function saveLocalCasePhotos(files: LocalCasePhotoInput[]) {
  return Promise.all(files.map(saveLocalCasePhoto));
}

export async function removeLocalCasePhoto(storageKey: string) {
  if (!isSafeStorageKey(storageKey)) throw new Error("照片識別碼格式不正確。");
  try {
    await unlink(path.join(getUploadDirectory(), storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function isSafeStorageKey(value: string) {
  return /^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(value);
}

export function validateCasePhotoUpload(input: { mimetype: string; size: number }): string | null {
  if (!allowedMimeTypes.has(input.mimetype)) return "只接受 JPEG、PNG 或 WebP 格式的照片。";
  if (!Number.isFinite(input.size) || input.size < 0) return "照片大小資料不正確。";
  if (input.size > MAX_CASE_PHOTO_SIZE) return "單張照片不可超過 8 MB。";
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CASE_PHOTO_SIZE, files: MAX_CASE_PHOTOS },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE"));
      return;
    }
    callback(null, true);
  },
});

async function requireLocalAdmin(request: Request, response: Response) {
  const user = await getLocalSessionUser(request);
  if (!user) {
    response.status(401).json({ message: "請先登入。" });
    return null;
  }
  if (user.role !== "admin") {
    response.status(403).json({ message: "只有管理員可上傳案件照片。" });
    return null;
  }
  return user;
}

function asMulterError(error: unknown, _request: Request, response: Response, next: NextFunction) {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "單張照片不可超過 8 MB。" : "照片上傳格式不正確。";
    response.status(400).json({ message });
    return;
  }
  next(error);
}

export function registerLocalUploadRoutes(app: Express) {
  app.post(
    "/api/uploads/case-photos",
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const user = await requireLocalAdmin(request, response);
        if (!user) return;
        next();
      } catch (error) {
        next(error);
      }
    },
    upload.array("photos", MAX_CASE_PHOTOS),
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const files = (request.files as Express.Multer.File[] | undefined) ?? [];
        if (files.length === 0) {
          response.status(400).json({ message: "請至少選擇一張照片。" });
          return;
        }
        const validationError = files.map(validateCasePhotoUpload).find(Boolean);
        if (validationError) {
          response.status(400).json({ message: validationError });
          return;
        }
        const photos = await saveLocalCasePhotos(files);
        response.status(201).json({ photos });
      } catch (error) {
        next(error);
      }
    },
    asMulterError
  );

  app.get("/api/files/:storageKey", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = await getLocalSessionUser(request);
      if (!user) {
        response.status(401).json({ message: "請先登入。" });
        return;
      }
      const storageKey = request.params.storageKey;
      if (!isSafeStorageKey(storageKey)) {
        response.status(400).json({ message: "照片識別碼格式不正確。" });
        return;
      }
      const photo = await db.getCasePhotoAccess(storageKey);
      if (!photo) {
        response.status(404).json({ message: "找不到照片。" });
        return;
      }
      if (user.role !== "admin" && user.householdNo !== photo.householdNo) {
        response.status(403).json({ message: "您無權查看此照片。" });
        return;
      }
      const absolutePath = path.join(getUploadDirectory(), storageKey);
      try {
        await stat(absolutePath);
      } catch {
        response.status(404).json({ message: "照片檔案不存在。" });
        return;
      }
      response.setHeader("Cache-Control", "private, no-store");
      response.type(photo.mimeType);
      response.sendFile(absolutePath);
    } catch (error) {
      next(error);
    }
  });
}
