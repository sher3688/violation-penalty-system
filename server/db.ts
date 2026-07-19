import {
  and,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2/promise";
import {
  caseAppeals,
  casePayments,
  casePhotos,
  casePhotoObjects,
  households,
  type AppealStatus,
  type CaseStatus,
  type InsertUser,
  type User,
  users,
  violationCases,
  violationTemplates,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getRuntimeEnv } from "./runtimeEnv";

let _db: ReturnType<typeof drizzle> | null = null;

/** Cloudflare Hyperdrive connections are request-scoped. */
export function resetDbForRequest() {
  _db = null;
}

export async function getDb() {
  if (_db) return _db;

  try {
    const runtime = getRuntimeEnv();
    if (runtime?.HYPERDRIVE) {
      const connection = await createConnection({
        host: runtime.HYPERDRIVE.host,
        user: runtime.HYPERDRIVE.user,
        password: runtime.HYPERDRIVE.password,
        database: runtime.HYPERDRIVE.database,
        port: runtime.HYPERDRIVE.port,
        disableEval: true,
      });
      // drizzle's overloads expose a Connection-backed and Pool-backed client as
      // different TypeScript types, although the query API used below is the same.
      _db = drizzle(connection) as unknown as ReturnType<typeof drizzle>;
      return _db;
    }

    const databaseUrl = runtime?.DATABASE_URL ?? process.env.DATABASE_URL;
    if (databaseUrl) {
      _db = drizzle(databaseUrl);
    }
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }
  return _db;
}

async function requireDb() {
  const database = await getDb();
  if (!database) throw new Error("資料庫尚未連線，請確認 DATABASE_URL 設定。");
  return database;
}

export async function checkDatabaseHealth() {
  const database = await requireDb();
  await database.execute(sql`SELECT 1 AS ok`);
  return true;
}

export async function storeCasePhotoObject(input: {
  storageKey: string;
  data: Uint8Array;
  mimeType: string;
}) {
  const database = await requireDb();
  await database.insert(casePhotoObjects).values({
    ...input,
    size: input.data.byteLength,
  });
}

export async function getCasePhotoObject(storageKey: string) {
  const database = await requireDb();
  const rows = await database
    .select()
    .from(casePhotoObjects)
    .where(eq(casePhotoObjects.storageKey, storageKey))
    .limit(1);
  return rows[0];
}

export async function deleteCasePhotoObject(storageKey: string) {
  const database = await requireDb();
  await database.delete(casePhotoObjects).where(eq(casePhotoObjects.storageKey, storageKey));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const database = await getDb();
  if (!database) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const fields = [
    "name",
    "email",
    "loginMethod",
    "username",
    "passwordHash",
    "householdNo",
    "role",
    "isActive",
    "lastSignedIn",
  ] as const;

  for (const field of fields) {
    if (user[field] !== undefined) {
      values[field] = user[field] as never;
      updateSet[field] = user[field];
    }
  }

  if (user.role === undefined && user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await database.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0];
}

export async function createLocalUser(input: {
  username: string;
  passwordHash: string;
  name: string;
  householdNo?: string | null;
  role: "admin" | "user";
  email?: string | null;
}): Promise<User> {
  const database = await requireDb();
  await database.insert(users).values({
    openId: `local-${input.username}`,
    username: input.username,
    passwordHash: input.passwordHash,
    name: input.name,
    email: input.email ?? null,
    householdNo: input.householdNo ?? null,
    role: input.role,
    isActive: true,
    loginMethod: "local-password",
    lastSignedIn: new Date(),
  });
  const created = await getUserByUsername(input.username);
  if (!created) throw new Error("帳號建立後無法讀取資料。");
  return created;
}

export function compareHouseholdNo(left?: string | null, right?: string | null) {
  return (left ?? "").localeCompare(right ?? "", "zh-Hant", {
    numeric: true,
    sensitivity: "base",
  });
}

export async function listLocalUsers() {
  const database = await requireDb();
  const result = await database
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      householdNo: users.householdNo,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.loginMethod, "local-password"))
    .orderBy(users.role, users.username);

  return result.sort(
    (left, right) =>
      left.role.localeCompare(right.role) ||
      compareHouseholdNo(left.householdNo, right.householdNo) ||
      (left.username ?? "").localeCompare(right.username ?? "", "zh-Hant")
  );
}

export async function setLocalUserActive(id: number, isActive: boolean) {
  const database = await requireDb();
  await database.update(users).set({ isActive }).where(eq(users.id, id));
}

export async function updateLocalUserPassword(id: number, passwordHash: string) {
  const database = await requireDb();
  await database.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function recordLocalLogin(id: number) {
  const database = await requireDb();
  await database.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function getActiveLocalAdminCount(): Promise<number> {
  const database = await requireDb();
  const result = await database
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.loginMethod, "local-password"),
        eq(users.role, "admin"),
        eq(users.isActive, true)
      )
    );
  return result.length;
}

export async function upsertHousehold(input: {
  householdNo: string;
  residentName?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
}) {
  const database = await requireDb();
  await database
    .insert(households)
    .values({
      householdNo: input.householdNo,
      residentName: input.residentName ?? null,
      contactEmail: input.contactEmail ?? null,
      isActive: input.isActive ?? true,
    })
    .onDuplicateKeyUpdate({
      set: {
        residentName: input.residentName ?? null,
        contactEmail: input.contactEmail ?? null,
        isActive: input.isActive ?? true,
      },
    });
}

export async function listHouseholds(search?: string) {
  const database = await requireDb();
  const filter = search?.trim()
    ? or(
        like(households.householdNo, `%${search.trim()}%`),
        like(households.residentName, `%${search.trim()}%`)
      )
    : undefined;
  const query = database.select().from(households);
  const result = filter ? await query.where(filter) : await query;
  return result.sort((left, right) => compareHouseholdNo(left.householdNo, right.householdNo));
}

export async function createViolationTemplate(input: {
  name: string;
  defaultDescription: string;
  defaultPenaltyAmount: number;
  regulationBasis: string;
  createdByUserId: number;
}) {
  const database = await requireDb();
  const result = await database.insert(violationTemplates).values({
    ...input,
    isActive: true,
  });
  return Number(result[0].insertId);
}

export async function listViolationTemplates(activeOnly = false) {
  const database = await requireDb();
  const query = database.select().from(violationTemplates);
  return activeOnly
    ? query
        .where(eq(violationTemplates.isActive, true))
        .orderBy(violationTemplates.name)
    : query.orderBy(violationTemplates.isActive, violationTemplates.name);
}

export async function updateViolationTemplate(
  id: number,
  input: {
    name?: string;
    defaultDescription?: string;
    defaultPenaltyAmount?: number;
    regulationBasis?: string;
    isActive?: boolean;
  }
) {
  const database = await requireDb();
  await database.update(violationTemplates).set(input).where(eq(violationTemplates.id, id));
}

export type CreateViolationCaseInput = {
  noticeNo: string;
  householdNo: string;
  templateId?: number | null;
  violationType: string;
  occurredAt: Date;
  location: string;
  description: string;
  penaltyAmount: number;
  regulationBasis: string;
  managementOfficeName: string;
  createdByUserId: number;
};

export async function createViolationCase(input: CreateViolationCaseInput) {
  const database = await requireDb();
  const result = await database.insert(violationCases).values({
    ...input,
    templateId: input.templateId ?? null,
    status: "pending_payment",
    issuedAt: new Date(),
  });
  return Number(result[0].insertId);
}

export async function addCasePhotos(
  caseId: number,
  photos: Array<{
    storageKey: string;
    originalName: string;
    mimeType: string;
    sortOrder: number;
  }>
) {
  if (photos.length === 0) return;
  const database = await requireDb();
  await database.insert(casePhotos).values(photos.map(photo => ({ ...photo, caseId })));
}

export type UpdateViolationCaseInput = Omit<CreateViolationCaseInput, "noticeNo" | "createdByUserId">;

export async function updateViolationCase(id: number, input: UpdateViolationCaseInput) {
  const database = await requireDb();
  await database
    .update(violationCases)
    .set({
      ...input,
      templateId: input.templateId ?? null,
    })
    .where(eq(violationCases.id, id));
}

export async function deleteCasePhoto(caseId: number, photoId: number) {
  const database = await requireDb();
  const result = await database
    .select()
    .from(casePhotos)
    .where(and(eq(casePhotos.id, photoId), eq(casePhotos.caseId, caseId)))
    .limit(1);
  const photo = result[0];
  if (!photo) return undefined;
  await database.delete(casePhotos).where(eq(casePhotos.id, photo.id));
  return photo;
}

/**
 * 刪除案件主檔；付款、申訴與照片資料列由資料庫外鍵級聯刪除。
 * 先回傳照片識別資訊，供服務層在主檔刪除成功後清理實體檔案。
 */
export async function deleteViolationCase(id: number) {
  const database = await requireDb();
  const existing = await database.select({ id: violationCases.id }).from(violationCases).where(eq(violationCases.id, id)).limit(1);
  if (!existing[0]) return undefined;

  const photos = await database.select().from(casePhotos).where(eq(casePhotos.caseId, id));
  await database.delete(violationCases).where(eq(violationCases.id, id));
  return { photos };
}


/** 依違規日期批次刪除月份資料，並回傳需同步清除的照片檔。 */
export async function deleteViolationCasesByRange(from: Date, to: Date) {
  const database = await requireDb();
  const matches = await database
    .select({ id: violationCases.id })
    .from(violationCases)
    .where(and(gte(violationCases.occurredAt, from), lte(violationCases.occurredAt, to)));

  const ids = matches.map(item => item.id);
  if (ids.length === 0) return { deletedCount: 0, photos: [] as Array<typeof casePhotos.$inferSelect> };

  const photos = await database.select().from(casePhotos).where(inArray(casePhotos.caseId, ids));
  await database.delete(violationCases).where(inArray(violationCases.id, ids));
  return { deletedCount: ids.length, photos };
}

export type CaseListFilters = {
  householdNo?: string;
  status?: CaseStatus;
  keyword?: string;
  from?: Date;
  to?: Date;
};

function buildCaseFilters(filters: CaseListFilters) {
  const conditions = [];
  if (filters.householdNo?.trim()) {
    conditions.push(like(violationCases.householdNo, `%${filters.householdNo.trim()}%`));
  }
  if (filters.status) conditions.push(eq(violationCases.status, filters.status));
  if (filters.keyword?.trim()) {
    const keyword = `%${filters.keyword.trim()}%`;
    conditions.push(
      or(
        like(violationCases.noticeNo, keyword),
        like(violationCases.violationType, keyword),
        like(violationCases.location, keyword),
        like(violationCases.description, keyword)
      )
    );
  }
  if (filters.from) conditions.push(gte(violationCases.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(violationCases.occurredAt, filters.to));
  return conditions.length ? and(...conditions) : undefined;
}

export async function listViolationCases(filters: CaseListFilters = {}) {
  const database = await requireDb();
  const condition = buildCaseFilters(filters);
  const cases = condition
    ? await database
        .select()
        .from(violationCases)
        .where(condition)
        .orderBy(desc(violationCases.occurredAt))
    : await database.select().from(violationCases).orderBy(desc(violationCases.occurredAt));

  if (cases.length === 0) return [];
  const ids = cases.map(item => item.id);
  const photos = await database
    .select()
    .from(casePhotos)
    .where(inArray(casePhotos.caseId, ids))
    .orderBy(casePhotos.sortOrder);
  const photoMap = new Map<number, typeof photos>();
  for (const photo of photos) {
    photoMap.set(photo.caseId, [...(photoMap.get(photo.caseId) ?? []), photo]);
  }
  return cases.map(item => ({ ...item, photos: photoMap.get(item.id) ?? [] }));
}

export async function getCasePhotoAccess(storageKey: string) {
  const database = await requireDb();
  const result = await database
    .select({
      storageKey: casePhotos.storageKey,
      originalName: casePhotos.originalName,
      mimeType: casePhotos.mimeType,
      householdNo: violationCases.householdNo,
    })
    .from(casePhotos)
    .innerJoin(violationCases, eq(casePhotos.caseId, violationCases.id))
    .where(eq(casePhotos.storageKey, storageKey))
    .limit(1);
  return result[0];
}

export async function getViolationCaseById(id: number) {
  const database = await requireDb();
  const result = await database
    .select()
    .from(violationCases)
    .where(eq(violationCases.id, id))
    .limit(1);
  const violationCase = result[0];
  if (!violationCase) return undefined;

  const [photos, payments, appeals] = await Promise.all([
    database
      .select()
      .from(casePhotos)
      .where(eq(casePhotos.caseId, id))
      .orderBy(casePhotos.sortOrder),
    database.select().from(casePayments).where(eq(casePayments.caseId, id)).limit(1),
    database.select().from(caseAppeals).where(eq(caseAppeals.caseId, id)).limit(1),
  ]);
  return {
    ...violationCase,
    photos,
    payment: payments[0] ?? null,
    appeal: appeals[0] ?? null,
  };
}

export async function recordCasePayment(input: {
  caseId: number;
  amount: number;
  paidAt: Date;
  note?: string | null;
  receivedByUserId: number;
}) {
  const database = await requireDb();
  await database
    .insert(casePayments)
    .values({
      caseId: input.caseId,
      amount: input.amount,
      paidAt: input.paidAt,
      note: input.note ?? null,
      receivedByUserId: input.receivedByUserId,
    })
    .onDuplicateKeyUpdate({
      set: {
        amount: input.amount,
        paidAt: input.paidAt,
        note: input.note ?? null,
        receivedByUserId: input.receivedByUserId,
      },
    });
  await database
    .update(violationCases)
    .set({ status: "paid" })
    .where(eq(violationCases.id, input.caseId));
}

export async function submitCaseAppeal(input: { caseId: number; content: string }) {
  const database = await requireDb();
  await database.insert(caseAppeals).values({
    caseId: input.caseId,
    content: input.content,
    status: "pending",
    submittedAt: new Date(),
  });
  await database
    .update(violationCases)
    .set({ status: "appealing" })
    .where(eq(violationCases.id, input.caseId));
}

export async function decideCaseAppeal(input: {
  caseId: number;
  status: Exclude<AppealStatus, "pending">;
  result: string;
  decidedByUserId: number;
}) {
  const database = await requireDb();
  await database
    .update(caseAppeals)
    .set({
      status: input.status,
      result: input.result,
      decidedAt: new Date(),
      decidedByUserId: input.decidedByUserId,
    })
    .where(eq(caseAppeals.caseId, input.caseId));
  await database
    .update(violationCases)
    .set({ status: input.status === "approved" ? "closed" : "pending_payment" })
    .where(eq(violationCases.id, input.caseId));
}

export async function closeViolationCase(caseId: number) {
  const database = await requireDb();
  await database.update(violationCases).set({ status: "closed" }).where(eq(violationCases.id, caseId));
}

export type ReportCase = {
  status: CaseStatus;
  householdNo: string;
  occurredAt: Date;
};

export function buildReportData(cases: ReportCase[]) {
  const totalCases = cases.length;
  const paidCases = cases.filter(item => item.status === "paid").length;
  const pendingCases = cases.filter(item => item.status === "pending_payment").length;
  const appealingCases = cases.filter(item => item.status === "appealing").length;
  const closedCases = cases.filter(item => item.status === "closed").length;
  const paymentRate = totalCases === 0 ? 0 : Math.round((paidCases / totalCases) * 1000) / 10;

  const householdCounts = new Map<string, number>();
  const monthlyCounts = new Map<string, number>();
  for (const item of cases) {
    householdCounts.set(item.householdNo, (householdCounts.get(item.householdNo) ?? 0) + 1);
    const month = item.occurredAt.toISOString().slice(0, 7);
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
  }

  return {
    summary: { totalCases, paidCases, pendingCases, appealingCases, closedCases, paymentRate },
    byHousehold: Array.from(householdCounts.entries())
      .map(([householdNo, count]) => ({ householdNo, count }))
      .sort((a, b) => b.count - a.count || a.householdNo.localeCompare(b.householdNo, "zh-Hant")),
    monthlyTrend: Array.from(monthlyCounts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export async function getReportData(from?: Date, to?: Date) {
  const database = await requireDb();
  const conditions = [];
  if (from) conditions.push(gte(violationCases.occurredAt, from));
  if (to) conditions.push(lte(violationCases.occurredAt, to));
  const condition = conditions.length ? and(...conditions) : undefined;
  const cases = condition
    ? await database.select().from(violationCases).where(condition)
    : await database.select().from(violationCases);
  return buildReportData(cases);
}

export type HouseholdPenaltySourceRow = {
  householdNo: string;
  caseId: number | null;
  penaltyAmount: number | null;
  paymentAmount: number | null;
};

export type HouseholdPenaltyStat = {
  householdNo: string;
  caseCount: number;
  assessedAmount: number;
  paidCases: number;
  paidAmount: number;
  outstandingCases: number;
  outstandingAmount: number;
};

/**
 * 以戶號彙總違規案件與實際收款資料。來源資料可包含沒有案件的住戶，
 * 因此匯出表能完整呈現所有戶別的零違規與金額統計。
 */
export function buildHouseholdPenaltyStats(sourceRows: HouseholdPenaltySourceRow[]) {
  const stats = new Map<string, HouseholdPenaltyStat>();

  for (const source of sourceRows) {
    const current = stats.get(source.householdNo) ?? {
      householdNo: source.householdNo,
      caseCount: 0,
      assessedAmount: 0,
      paidCases: 0,
      paidAmount: 0,
      outstandingCases: 0,
      outstandingAmount: 0,
    };

    if (source.caseId !== null) {
      const assessedAmount = source.penaltyAmount ?? 0;
      const paidAmount = source.paymentAmount ?? 0;
      const outstandingAmount = Math.max(assessedAmount - paidAmount, 0);

      current.caseCount += 1;
      current.assessedAmount += assessedAmount;
      current.paidAmount += paidAmount;
      if (source.paymentAmount !== null) current.paidCases += 1;
      if (outstandingAmount > 0) {
        current.outstandingCases += 1;
        current.outstandingAmount += outstandingAmount;
      }
    }

    stats.set(source.householdNo, current);
  }

  const rows = Array.from(stats.values()).sort((left, right) =>
    compareHouseholdNo(left.householdNo, right.householdNo)
  );

  return {
    summary: {
      householdCount: rows.length,
      totalCases: rows.reduce((sum, item) => sum + item.caseCount, 0),
      totalAssessedAmount: rows.reduce((sum, item) => sum + item.assessedAmount, 0),
      totalPaidAmount: rows.reduce((sum, item) => sum + item.paidAmount, 0),
      totalOutstandingAmount: rows.reduce((sum, item) => sum + item.outstandingAmount, 0),
    },
    rows,
  };
}

export async function getHouseholdPenaltyStats(from?: Date, to?: Date) {
  const database = await requireDb();
  const caseJoinConditions = [eq(households.householdNo, violationCases.householdNo)];
  if (from) caseJoinConditions.push(gte(violationCases.occurredAt, from));
  if (to) caseJoinConditions.push(lte(violationCases.occurredAt, to));

  const sourceRows = await database
    .select({
      householdNo: households.householdNo,
      caseId: violationCases.id,
      penaltyAmount: violationCases.penaltyAmount,
      paymentAmount: casePayments.amount,
    })
    .from(households)
    .leftJoin(violationCases, and(...caseJoinConditions))
    .leftJoin(casePayments, eq(casePayments.caseId, violationCases.id));

  return buildHouseholdPenaltyStats(sourceRows);
}
