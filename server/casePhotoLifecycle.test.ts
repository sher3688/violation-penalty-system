import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const databaseMocks = vi.hoisted(() => ({
  getViolationCaseById: vi.fn(),
  upsertHousehold: vi.fn(),
  updateViolationCase: vi.fn(),
  addCasePhotos: vi.fn(),
  deleteCasePhoto: vi.fn(),
  deleteViolationCase: vi.fn(),
}));

vi.mock("./db", () => databaseMocks);

import { saveLocalCasePhoto } from "./localUploads";
import { appRouter } from "./routers";

const initialUploadDirectory = process.env.UPLOAD_DIR;
const now = new Date("2026-07-18T00:00:00.000Z");
let uploadDirectory = "";
let caseDeleted = false;
let caseRecord: {
  id: number;
  householdNo: string;
  status: string;
  appeal: null;
  photos: Array<{ id: number; storageKey: string; originalName: string; mimeType: string; sortOrder: number }>;
};

function adminCaller() {
  const user: User = {
    id: 1,
    openId: "local-admin",
    username: "admin",
    passwordHash: "hash",
    name: "管理員",
    email: null,
    householdNo: null,
    loginMethod: "local-password",
    role: "admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  const ctx = {
    user,
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn(), cookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

function validCaseInput() {
  return {
    householdNo: "A-101",
    violationType: "公共空間堆放雜物",
    occurredAt: now,
    location: "一樓梯廳",
    description: "住戶於公共空間堆放私人物品，影響通行。",
    penaltyAmount: 500,
    regulationBasis: "住戶規約",
    managementOfficeName: "社區管理委員會",
  };
}

describe("案件照片新增與刪除完整生命週期", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    uploadDirectory = await mkdtemp(path.join(tmpdir(), "violation-case-photo-lifecycle-"));
    process.env.UPLOAD_DIR = uploadDirectory;
    caseDeleted = false;
    caseRecord = {
      id: 11,
      householdNo: "A-101",
      status: "pending_payment",
      appeal: null,
      photos: [],
    };

    databaseMocks.getViolationCaseById.mockImplementation(async (id: number) => (!caseDeleted && id === caseRecord.id ? caseRecord : null));
    databaseMocks.upsertHousehold.mockResolvedValue(undefined);
    databaseMocks.updateViolationCase.mockResolvedValue(undefined);
    databaseMocks.addCasePhotos.mockImplementation(async (caseId: number, photos: Array<{ storageKey: string; originalName: string; mimeType: string; sortOrder: number }>) => {
      if (caseId !== caseRecord.id) throw new Error("案件不存在");
      caseRecord.photos.push(...photos.map((photo, index) => ({ id: index + 1, ...photo })));
    });
    databaseMocks.deleteCasePhoto.mockImplementation(async (caseId: number, photoId: number) => {
      if (caseId !== caseRecord.id || caseDeleted) return null;
      const photoIndex = caseRecord.photos.findIndex(photo => photo.id === photoId);
      return photoIndex < 0 ? null : caseRecord.photos.splice(photoIndex, 1)[0];
    });
    databaseMocks.deleteViolationCase.mockImplementation(async (caseId: number) => {
      if (caseId !== caseRecord.id || caseDeleted) return undefined;
      const photos = [...caseRecord.photos];
      caseRecord.photos = [];
      caseDeleted = true;
      return { photos };
    });
  });

  afterEach(async () => {
    if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
    if (initialUploadDirectory === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = initialUploadDirectory;
  });

  it("將新上傳照片建立為案件資料列，並由管理員刪除資料列與實際檔案", async () => {
    const source = Buffer.from("new-case-photo-bytes");
    const uploadedPhoto = await saveLocalCasePhoto({
      buffer: source,
      mimetype: "image/png",
      originalname: "新上傳現場照片.png",
      size: source.length,
    });
    const storedPath = path.join(uploadDirectory, uploadedPhoto.storageKey);
    const caller = adminCaller();

    await expect(caller.cases.update({ id: caseRecord.id, ...validCaseInput(), photos: [uploadedPhoto] })).resolves.toEqual({ success: true });
    expect(caseRecord.photos).toEqual([
      expect.objectContaining({ storageKey: uploadedPhoto.storageKey, originalName: "新上傳現場照片.png", mimeType: "image/png", sortOrder: 0 }),
    ]);
    await expect(stat(storedPath)).resolves.toMatchObject({ isFile: expect.any(Function) });

    const storedPhotoId = caseRecord.photos[0].id;
    await expect(caller.cases.deletePhoto({ caseId: caseRecord.id, photoId: storedPhotoId })).resolves.toEqual({ success: true });

    expect(caseRecord.photos).toHaveLength(0);
    await expect(stat(storedPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("管理員刪除案件時，會一併刪除所有案件照片資料列與實體檔案", async () => {
    const source = Buffer.from("case-delete-photo-bytes");
    const uploadedPhoto = await saveLocalCasePhoto({
      buffer: source,
      mimetype: "image/png",
      originalname: "將隨案件刪除的照片.png",
      size: source.length,
    });
    const storedPath = path.join(uploadDirectory, uploadedPhoto.storageKey);
    const caller = adminCaller();

    await caller.cases.update({ id: caseRecord.id, ...validCaseInput(), photos: [uploadedPhoto] });
    expect(caseRecord.photos).toHaveLength(1);
    await expect(stat(storedPath)).resolves.toBeDefined();

    await expect(caller.cases.delete({ caseId: caseRecord.id })).resolves.toEqual({ success: true });

    expect(caseDeleted).toBe(true);
    expect(caseRecord.photos).toHaveLength(0);
    await expect(stat(storedPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
