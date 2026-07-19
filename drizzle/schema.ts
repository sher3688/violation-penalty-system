import {
  boolean,
  customType,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const mediumBlob = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "mediumblob",
  toDriver: value => Buffer.from(value),
  fromDriver: value => new Uint8Array(value),
});

export const caseStatuses = [
  "pending_payment",
  "paid",
  "appealing",
  "closed",
] as const;

export const appealStatuses = ["pending", "approved", "rejected"] as const;

/**
 * 使用者帳號。保留 openId 以相容既有登入資料；自有主機部署時使用 username 與 passwordHash。
 */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    username: varchar("username", { length: 64 }).unique(),
    passwordHash: varchar("passwordHash", { length: 255 }),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    householdNo: varchar("householdNo", { length: 64 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => [
    index("users_household_idx").on(table.householdNo),
    index("users_role_active_idx").on(table.role, table.isActive),
  ]
);

/** 住戶資料供案件建立、帳號綁定與戶號搜尋使用。 */
export const households = mysqlTable(
  "households",
  {
    id: int("id").autoincrement().primaryKey(),
    householdNo: varchar("householdNo", { length: 64 }).notNull().unique(),
    residentName: varchar("residentName", { length: 120 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("households_active_idx").on(table.isActive, table.householdNo)]
);

/**
 * 管理員可維護的開罰項目範本。案件建立時可調用，但各案仍會保存當下內容。
 */
export const violationTemplates = mysqlTable(
  "violation_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    defaultDescription: text("defaultDescription").notNull(),
    defaultPenaltyAmount: int("defaultPenaltyAmount").default(0).notNull(),
    regulationBasis: varchar("regulationBasis", { length: 255 })
      .default("住戶規約")
      .notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("templates_active_idx").on(table.isActive, table.name),
  ]
);

/** 違規案件的主檔。金額以新臺幣整數儲存。 */
export const violationCases = mysqlTable(
  "violation_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    noticeNo: varchar("noticeNo", { length: 40 }).notNull().unique(),
    householdNo: varchar("householdNo", { length: 64 }).notNull(),
    templateId: int("templateId").references(() => violationTemplates.id, {
      onDelete: "set null",
    }),
    violationType: varchar("violationType", { length: 120 }).notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    location: varchar("location", { length: 255 }).notNull(),
    description: text("description").notNull(),
    penaltyAmount: int("penaltyAmount").default(0).notNull(),
    status: mysqlEnum("status", caseStatuses).default("pending_payment").notNull(),
    regulationBasis: varchar("regulationBasis", { length: 255 })
      .default("住戶規約")
      .notNull(),
    managementOfficeName: varchar("managementOfficeName", { length: 160 })
      .default("社區管理委員會")
      .notNull(),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("cases_household_idx").on(table.householdNo),
    index("cases_template_idx").on(table.templateId),
    index("cases_status_idx").on(table.status),
    index("cases_occurred_at_idx").on(table.occurredAt),
  ]
);

/** 案件現場照片，僅保存檔案識別與中繼資料，不把影像位元組寫入資料庫。 */
export const casePhotos = mysqlTable(
  "case_photos",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => violationCases.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 255 }).notNull().unique(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 80 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("case_photos_case_idx").on(table.caseId, table.sortOrder)]
);

/** 免費部署模式下，照片位元組直接存入 MySQL，避免要求 R2 付款方式。 */
export const casePhotoObjects = mysqlTable("case_photo_objects", {
  storageKey: varchar("storageKey", { length: 255 }).primaryKey(),
  data: mediumBlob("data").notNull(),
  mimeType: varchar("mimeType", { length: 80 }).notNull(),
  size: int("size").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** 每件案件的繳款紀錄。每案至多一筆正式繳款紀錄。 */
export const casePayments = mysqlTable(
  "case_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => violationCases.id, { onDelete: "cascade" }),
    amount: int("amount").notNull(),
    paidAt: timestamp("paidAt").notNull(),
    note: text("note"),
    receivedByUserId: int("receivedByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("case_payments_case_unique").on(table.caseId)]
);

/** 住戶對案件提出的申訴內容與管理員審核結果。 */
export const caseAppeals = mysqlTable(
  "case_appeals",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => violationCases.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: mysqlEnum("status", appealStatuses).default("pending").notNull(),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    result: text("result"),
    decidedAt: timestamp("decidedAt"),
    decidedByUserId: int("decidedByUserId").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("case_appeals_case_unique").on(table.caseId)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Household = typeof households.$inferSelect;
export type ViolationTemplate = typeof violationTemplates.$inferSelect;
export type ViolationCase = typeof violationCases.$inferSelect;
export type CasePhoto = typeof casePhotos.$inferSelect;
export type CasePayment = typeof casePayments.$inferSelect;
export type CaseAppeal = typeof caseAppeals.$inferSelect;
export type CaseStatus = (typeof caseStatuses)[number];
export type AppealStatus = (typeof appealStatuses)[number];
