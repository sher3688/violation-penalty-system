import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const databaseMocks = vi.hoisted(() => ({
  listViolationCases: vi.fn(),
  getViolationCaseById: vi.fn(),
  recordCasePayment: vi.fn(),
  submitCaseAppeal: vi.fn(),
  decideCaseAppeal: vi.fn(),
  closeViolationCase: vi.fn(),
  upsertHousehold: vi.fn(),
  createViolationCase: vi.fn(),
  addCasePhotos: vi.fn(),
  updateViolationCase: vi.fn(),
  deleteCasePhoto: vi.fn(),
  deleteViolationCase: vi.fn(),
}));

const uploadMocks = vi.hoisted(() => ({
  removeLocalCasePhoto: vi.fn(),
}));

vi.mock("./db", () => databaseMocks);
vi.mock("./localUploads", () => uploadMocks);

import { appRouter } from "./routers";

const now = new Date("2026-07-18T00:00:00.000Z");

function makeUser(role: "admin" | "user", householdNo: string | null = null): User {
  return {
    id: role === "admin" ? 1 : 2,
    openId: `local-${role}`,
    username: role,
    passwordHash: "hash",
    name: role === "admin" ? "管理員" : "住戶",
    email: null,
    householdNo,
    loginMethod: "local-password",
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function callerFor(user: User) {
  const ctx = {
    user,
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn(), cookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    householdNo: "A-101",
    status: "pending_payment",
    appeal: null,
    ...overrides,
  };
}

function makeValidCaseInput() {
  return {
    householdNo: "A-101",
    violationType: "公共空間堆放雜物",
    occurredAt: now,
    location: "一樓梯廳",
    description: "住戶於公共空間堆放私人物品，影響通行。",
    penaltyAmount: 500,
    regulationBasis: "住戶規約",
    managementOfficeName: "社區管理委員會",
    photos: [],
  };
}

describe("案件授權與狀態流程", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.getViolationCaseById.mockResolvedValue(makeCase());
    databaseMocks.listViolationCases.mockResolvedValue([]);
    databaseMocks.recordCasePayment.mockResolvedValue(undefined);
    databaseMocks.submitCaseAppeal.mockResolvedValue(undefined);
    databaseMocks.decideCaseAppeal.mockResolvedValue(undefined);
    databaseMocks.closeViolationCase.mockResolvedValue(undefined);
    databaseMocks.upsertHousehold.mockResolvedValue(undefined);
    databaseMocks.createViolationCase.mockResolvedValue(12);
    databaseMocks.addCasePhotos.mockResolvedValue(undefined);
    databaseMocks.updateViolationCase.mockResolvedValue(undefined);
    databaseMocks.deleteCasePhoto.mockResolvedValue(undefined);
    databaseMocks.deleteViolationCase.mockResolvedValue({ photos: [] });
    uploadMocks.removeLocalCasePhoto.mockResolvedValue(undefined);
  });

  it("拒絕不完整或不合法的罰單案件輸入，且不寫入資料庫", async () => {
    const caller = callerFor(makeUser("admin"));

    await expect(caller.cases.create({ ...makeValidCaseInput(), violationType: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.cases.create({ ...makeValidCaseInput(), penaltyAmount: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.cases.create({ ...makeValidCaseInput(), occurredAt: "非日期" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.cases.create({
        ...makeValidCaseInput(),
        photos: Array.from({ length: 7 }, () => ({ storageKey: "photo.jpg", originalName: "photo.jpg", mimeType: "image/jpeg" })),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(databaseMocks.upsertHousehold).not.toHaveBeenCalled();
    expect(databaseMocks.createViolationCase).not.toHaveBeenCalled();
  });

  it("完整驗證主要必填欄位、金額上限與日期邊界", async () => {
    const caller = callerFor(makeUser("admin"));
    const invalidInputs = [
      { householdNo: "" },
      { location: "   " },
      { description: "" },
      { regulationBasis: "" },
      { managementOfficeName: "" },
      { penaltyAmount: 10_000_001 },
      { occurredAt: new Date("invalid") },
    ];

    for (const changes of invalidInputs) {
      await expect(caller.cases.create({ ...makeValidCaseInput(), ...changes })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    await expect(caller.cases.create({ ...makeValidCaseInput(), penaltyAmount: 0, occurredAt: new Date("2000-01-01T00:00:00Z") })).resolves.toEqual({ id: 12 });
    await expect(caller.cases.create({ ...makeValidCaseInput(), penaltyAmount: 10_000_000, occurredAt: new Date("2099-12-31T23:59:59Z") })).resolves.toEqual({ id: 12 });
    expect(databaseMocks.createViolationCase).toHaveBeenCalledTimes(2);
  });

  it("拒絕非法案件編號、負數繳款與空白申訴內容", async () => {
    const adminCaller = callerFor(makeUser("admin"));
    const residentCaller = callerFor(makeUser("user", "A-101"));

    await expect(adminCaller.cases.get({ id: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(adminCaller.cases.recordPayment({ caseId: 11, amount: -1, paidAt: now })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(residentCaller.cases.submitAppeal({ caseId: 11, content: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(databaseMocks.getViolationCaseById).not.toHaveBeenCalled();
  });

  it("住戶查詢案件時，後端會強制以其綁定戶號篩選", async () => {
    const caller = callerFor(makeUser("user", "A-101"));

    await caller.cases.list({ householdNo: "B-202", keyword: "雜物" });

    expect(databaseMocks.listViolationCases).toHaveBeenCalledWith(
      expect.objectContaining({ householdNo: "A-101", keyword: "雜物" })
    );
  });

  it("住戶僅能就自己戶號的案件提交申訴", async () => {
    const caller = callerFor(makeUser("user", "A-101"));

    await caller.cases.submitAppeal({ caseId: 11, content: "現場狀況與通知內容不符。" });

    expect(databaseMocks.submitCaseAppeal).toHaveBeenCalledWith({
      caseId: 11,
      content: "現場狀況與通知內容不符。",
    });
  });

  it("管理員可修改案件並以既有照片數量為基準追加照片", async () => {
    databaseMocks.getViolationCaseById.mockResolvedValue(
      makeCase({ photos: [{ id: 41, storageKey: "existing.jpg", originalName: "existing.jpg", mimeType: "image/jpeg" }] })
    );
    const caller = callerFor(makeUser("admin"));
    const newPhoto = { storageKey: "new.jpg", originalName: "new.jpg", mimeType: "image/jpeg" };

    await expect(caller.cases.update({ id: 11, ...makeValidCaseInput(), photos: [newPhoto] })).resolves.toEqual({ success: true });

    expect(databaseMocks.updateViolationCase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ householdNo: "A-101", violationType: "公共空間堆放雜物" })
    );
    expect(databaseMocks.addCasePhotos).toHaveBeenCalledWith(11, [{ ...newPhoto, sortOrder: 1 }]);
  });

  it("拒絕超過案件照片上限的修改，且不寫入案件資料", async () => {
    databaseMocks.getViolationCaseById.mockResolvedValue(
      makeCase({ photos: Array.from({ length: 6 }, (_, index) => ({ id: index + 1, storageKey: `${index}.jpg`, originalName: `${index}.jpg`, mimeType: "image/jpeg" })) })
    );
    const caller = callerFor(makeUser("admin"));

    await expect(
      caller.cases.update({
        id: 11,
        ...makeValidCaseInput(),
        photos: [{ storageKey: "new.jpg", originalName: "new.jpg", mimeType: "image/jpeg" }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(databaseMocks.updateViolationCase).not.toHaveBeenCalled();
  });

  it("僅管理員可刪除案件照片，並在成功後清理本機檔案", async () => {
    const residentCaller = callerFor(makeUser("user", "A-101"));
    await expect(residentCaller.cases.deletePhoto({ caseId: 11, photoId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    databaseMocks.deleteCasePhoto.mockResolvedValue({ id: 41, caseId: 11, storageKey: "existing.jpg" });
    const adminCaller = callerFor(makeUser("admin"));
    await expect(adminCaller.cases.deletePhoto({ caseId: 11, photoId: 41 })).resolves.toEqual({ success: true });
    expect(databaseMocks.deleteCasePhoto).toHaveBeenCalledWith(11, 41);
    expect(uploadMocks.removeLocalCasePhoto).toHaveBeenCalledWith("existing.jpg");
  });

  it("僅管理員可刪除案件，並清理所有關聯照片檔案", async () => {
    const residentCaller = callerFor(makeUser("user", "A-101"));
    await expect(residentCaller.cases.delete({ caseId: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    databaseMocks.getViolationCaseById.mockResolvedValue(makeCase({ id: 12, householdNo: "B-202" }));
    await expect(residentCaller.cases.delete({ caseId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(databaseMocks.deleteViolationCase).not.toHaveBeenCalled();

    databaseMocks.deleteViolationCase.mockResolvedValue({
      photos: [{ storageKey: "scene-a.jpg" }, { storageKey: "scene-b.jpg" }],
    });
    const adminCaller = callerFor(makeUser("admin"));
    await expect(adminCaller.cases.delete({ caseId: 11 })).resolves.toEqual({ success: true });

    expect(databaseMocks.deleteViolationCase).toHaveBeenCalledWith(11);
    expect(uploadMocks.removeLocalCasePhoto).toHaveBeenNthCalledWith(1, "scene-a.jpg");
    expect(uploadMocks.removeLocalCasePhoto).toHaveBeenNthCalledWith(2, "scene-b.jpg");
  });

  it("管理員可審核非本人戶號案件的待處理申訴", async () => {
    databaseMocks.getViolationCaseById.mockResolvedValue(
      makeCase({
        householdNo: "B-202",
        status: "appealing",
        appeal: { id: 7, status: "pending", content: "申訴內容" },
      })
    );
    const caller = callerFor(makeUser("admin"));

    await expect(
      caller.cases.decideAppeal({ caseId: 11, status: "approved", result: "查核後同意申訴並結案。" })
    ).resolves.toEqual({ success: true });

    expect(databaseMocks.decideCaseAppeal).toHaveBeenCalledWith({
      caseId: 11,
      status: "approved",
      result: "查核後同意申訴並結案。",
      decidedByUserId: 1,
    });
  });

  it("管理員不可使用住戶專用的申訴提交流程", async () => {
    const caller = callerFor(makeUser("admin"));

    await expect(caller.cases.submitAppeal({ caseId: 11, content: "不應送出" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(databaseMocks.submitCaseAppeal).not.toHaveBeenCalled();
  });

  it("不可對結案或申訴中的案件直接登錄繳款", async () => {
    databaseMocks.getViolationCaseById.mockResolvedValue(makeCase({ status: "closed" }));
    const caller = callerFor(makeUser("admin"));

    await expect(
      caller.cases.recordPayment({
        caseId: 11,
        amount: 500,
        paidAt: now,
        note: "管理室收款",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(databaseMocks.recordCasePayment).not.toHaveBeenCalled();
  });

  it("有待審核申訴的案件不可直接結案", async () => {
    databaseMocks.getViolationCaseById.mockResolvedValue(makeCase({ status: "appealing" }));
    const caller = callerFor(makeUser("admin"));

    await expect(caller.cases.close({ caseId: 11 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(databaseMocks.closeViolationCase).not.toHaveBeenCalled();
  });
});
