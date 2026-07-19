import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const authMocks = vi.hoisted(() => ({
  getLocalSessionUser: vi.fn(),
}));

const databaseMocks = vi.hoisted(() => ({
  getCasePhotoAccess: vi.fn(),
}));

vi.mock("./localAuth", () => authMocks);
vi.mock("./db", () => databaseMocks);

import {
  MAX_CASE_PHOTO_SIZE,
  registerLocalUploadRoutes,
  removeLocalCasePhoto,
  saveLocalCasePhoto,
  validateCasePhotoUpload,
} from "./localUploads";

const initialUploadDirectory = process.env.UPLOAD_DIR;
let uploadDirectory = "";
let server: Server | undefined;

async function startPhotoServer() {
  const app = express();
  registerLocalUploadRoutes(app);
  server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("無法取得測試伺服器連接埠。");
  return `http://127.0.0.1:${address.port}`;
}

describe("validateCasePhotoUpload", () => {
  it("接受限制內的 JPEG、PNG 與 WebP 照片", () => {
    expect(validateCasePhotoUpload({ mimetype: "image/jpeg", size: 1 })).toBeNull();
    expect(validateCasePhotoUpload({ mimetype: "image/png", size: MAX_CASE_PHOTO_SIZE })).toBeNull();
    expect(validateCasePhotoUpload({ mimetype: "image/webp", size: 2_048 })).toBeNull();
  });

  it("拒絕不支援的格式與超過大小限制的照片", () => {
    expect(validateCasePhotoUpload({ mimetype: "application/pdf", size: 1_024 })).toContain("JPEG、PNG 或 WebP");
    expect(validateCasePhotoUpload({ mimetype: "image/jpeg", size: MAX_CASE_PHOTO_SIZE + 1 })).toContain("8 MB");
    expect(validateCasePhotoUpload({ mimetype: "image/png", size: -1 })).toContain("大小資料");
  });
});

describe("案件照片檔案生命週期", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    uploadDirectory = await mkdtemp(path.join(tmpdir(), "violation-case-photos-"));
    process.env.UPLOAD_DIR = uploadDirectory;
    authMocks.getLocalSessionUser.mockResolvedValue({ role: "admin", householdNo: null });
    databaseMocks.getCasePhotoAccess.mockResolvedValue({ householdNo: "A-101", mimeType: "image/png" });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => server?.close(error => (error ? reject(error) : resolve())));
      server = undefined;
    }
    if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
    if (initialUploadDirectory === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = initialUploadDirectory;
  });

  it("實際寫入的案件照片可經授權路由讀取，刪除後檔案即不可再讀取", async () => {
    const source = Buffer.from("test-png-image-bytes");
    const photo = await saveLocalCasePhoto({
      buffer: source,
      mimetype: "image/png",
      originalname: "現場照片.png",
      size: source.length,
    });
    const storedPath = path.join(uploadDirectory, photo.storageKey);

    expect(await readFile(storedPath)).toEqual(source);

    const baseUrl = await startPhotoServer();
    const readableResponse = await fetch(`${baseUrl}/api/files/${photo.storageKey}`);
    expect(readableResponse.status).toBe(200);
    expect(readableResponse.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await readableResponse.arrayBuffer())).toEqual(source);

    await removeLocalCasePhoto(photo.storageKey);
    await expect(stat(storedPath)).rejects.toMatchObject({ code: "ENOENT" });

    const removedResponse = await fetch(`${baseUrl}/api/files/${photo.storageKey}`);
    expect(removedResponse.status).toBe(404);
  });
});
