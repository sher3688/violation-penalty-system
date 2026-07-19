import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { appealStatuses, caseStatuses, type User } from "../drizzle/schema";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  clearLocalSession,
  hashPassword,
  setLocalSession,
  validatePassword,
  verifyPassword,
} from "./localAuth";
import { removeLocalCasePhoto } from "./localUploads";

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._-]{3,64}$/, "帳號限用 3 至 64 個英數、句點、底線或連字號。");
const householdNoSchema = z.string().trim().min(1, "請輸入戶號。").max(64);
const passwordSchema = z.string().min(10, "密碼至少須為 10 個字元。").max(128);
const publicUser = (user: User | null | undefined) =>
  user
    ? {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        householdNo: user.householdNo,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
      }
    : null;

function throwNotFound(message = "找不到指定資料。") {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

function assertCaseAccess(user: User, householdNo: string) {
  if (user.role !== "admin" && user.householdNo !== householdNo) {
    throw new TRPCError({ code: "FORBIDDEN", message: "您無權檢視或處理此案件。" });
  }
}

function makeNoticeNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `V${date}-${nanoid(6).toUpperCase()}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => publicUser(ctx.user)),
    needsBootstrap: publicProcedure.query(async () => ({
      required: (await db.getActiveLocalAdminCount()) === 0,
    })),

    bootstrap: publicProcedure
      .input(
        z.object({
          username: usernameSchema,
          password: passwordSchema,
          name: z.string().trim().min(1, "請輸入管理員姓名。").max(120),
          email: z.string().email("請輸入有效電子郵件。").optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const admins = await db.getActiveLocalAdminCount();
        if (admins > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "系統已完成初始管理員設定，請使用既有帳號登入。",
          });
        }
        const existing = await db.getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "此帳號名稱已被使用。" });
        }
        const user = await db.createLocalUser({
          username: input.username,
          passwordHash: await hashPassword(input.password),
          name: input.name,
          email: input.email || null,
          role: "admin",
        });
        await setLocalSession(ctx.res, user);
        return publicUser(user);
      }),

    login: publicProcedure
      .input(z.object({ username: usernameSchema, password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByUsername(input.username);
        if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號或密碼錯誤。" });
        }
        await db.recordLocalLogin(user.id);
        const refreshed = (await db.getUserById(user.id)) ?? user;
        await setLocalSession(ctx.res, refreshed);
        return publicUser(refreshed);
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearLocalSession(ctx.res);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    listUsers: adminProcedure.query(async () => db.listLocalUsers()),

    createResident: adminProcedure
      .input(
        z.object({
          username: usernameSchema,
          password: passwordSchema,
          name: z.string().trim().min(1, "請輸入住戶姓名。").max(120),
          householdNo: householdNoSchema,
          email: z.string().email("請輸入有效電子郵件。").optional().or(z.literal("")),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await db.getUserByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "此帳號名稱已被使用。" });
        await db.upsertHousehold({
          householdNo: input.householdNo,
          residentName: input.name,
          contactEmail: input.email || null,
        });
        const resident = await db.createLocalUser({
          username: input.username,
          passwordHash: await hashPassword(input.password),
          name: input.name,
          householdNo: input.householdNo,
          email: input.email || null,
          role: "user",
        });
        return publicUser(resident);
      }),

    setUserActive: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.userId && !input.isActive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "不可停用目前登入的管理員帳號。" });
        }
        await db.setLocalUserActive(input.userId, input.isActive);
        return { success: true } as const;
      }),

    changeOwnPassword: protectedProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }))
      .mutation(async ({ ctx, input }) => {
        const current = await db.getUserById(ctx.user.id);
        if (!current || !(await verifyPassword(input.currentPassword, current.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "目前密碼不正確。" });
        }
        const policyError = validatePassword(input.newPassword);
        if (policyError) throw new TRPCError({ code: "BAD_REQUEST", message: policyError });
        await db.updateLocalUserPassword(current.id, await hashPassword(input.newPassword));
        return { success: true } as const;
      }),
  }),

  households: router({
    list: adminProcedure
      .input(z.object({ search: z.string().trim().max(64).optional() }).optional())
      .query(async ({ input }) => db.listHouseholds(input?.search)),
    upsert: adminProcedure
      .input(
        z.object({
          householdNo: householdNoSchema,
          residentName: z.string().trim().max(120).optional().or(z.literal("")),
          contactEmail: z.string().email("請輸入有效電子郵件。").optional().or(z.literal("")),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.upsertHousehold({
          householdNo: input.householdNo,
          residentName: input.residentName || null,
          contactEmail: input.contactEmail || null,
          isActive: input.isActive,
        });
        return { success: true } as const;
      }),
  }),

  templates: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input, ctx }) =>
        db.listViolationTemplates(ctx.user.role !== "admin" ? true : Boolean(input?.activeOnly))
      ),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "請輸入項目名稱。").max(120),
          defaultDescription: z.string().trim().min(1, "請輸入預設說明。").max(4000),
          defaultPenaltyAmount: z.number().int().min(0).max(10_000_000),
          regulationBasis: z.string().trim().min(1).max(255).default("住戶規約"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await db.createViolationTemplate({ ...input, createdByUserId: ctx.user.id });
        return { id };
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(120).optional(),
          defaultDescription: z.string().trim().min(1).max(4000).optional(),
          defaultPenaltyAmount: z.number().int().min(0).max(10_000_000).optional(),
          regulationBasis: z.string().trim().min(1).max(255).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...changes } = input;
        await db.updateViolationTemplate(id, changes);
        return { success: true } as const;
      }),
  }),

  cases: router({
    list: protectedProcedure
      .input(
        z
          .object({
            householdNo: z.string().trim().max(64).optional(),
            status: z.enum(caseStatuses).optional(),
            keyword: z.string().trim().max(255).optional(),
            from: z.coerce.date().optional(),
            to: z.coerce.date().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const filters = input ?? {};
        if (ctx.user.role !== "admin") {
          if (!ctx.user.householdNo) return [];
          filters.householdNo = ctx.user.householdNo;
        }
        return db.listViolationCases(filters);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const violationCase = await db.getViolationCaseById(input.id);
        if (!violationCase) return throwNotFound();
        assertCaseAccess(ctx.user, violationCase.householdNo);
        return violationCase;
      }),

    create: adminProcedure
      .input(
        z.object({
          householdNo: householdNoSchema,
          templateId: z.number().int().positive().nullable().optional(),
          violationType: z.string().trim().min(1, "請輸入違規類型。").max(120),
          occurredAt: z.coerce.date(),
          location: z.string().trim().min(1, "請輸入違規地點。").max(255),
          description: z.string().trim().min(1, "請輸入違規描述。").max(4000),
          penaltyAmount: z.number().int().min(0).max(10_000_000),
          regulationBasis: z.string().trim().min(1).max(255).default("住戶規約"),
          managementOfficeName: z.string().trim().min(1).max(160).default("社區管理委員會"),
          photos: z
            .array(
              z.object({
                storageKey: z.string().trim().min(1).max(255),
                originalName: z.string().trim().min(1).max(255),
                mimeType: z.string().trim().min(1).max(80),
              })
            )
            .max(2)
            .default([]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertHousehold({ householdNo: input.householdNo });
        const caseId = await db.createViolationCase({
          noticeNo: makeNoticeNo(),
          householdNo: input.householdNo,
          templateId: input.templateId,
          violationType: input.violationType,
          occurredAt: input.occurredAt,
          location: input.location,
          description: input.description,
          penaltyAmount: input.penaltyAmount,
          regulationBasis: input.regulationBasis,
          managementOfficeName: input.managementOfficeName,
          createdByUserId: ctx.user.id,
        });
        await db.addCasePhotos(
          caseId,
          input.photos.map((photo, index) => ({ ...photo, sortOrder: index }))
        );
        return { id: caseId };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          householdNo: householdNoSchema,
          templateId: z.number().int().positive().nullable().optional(),
          violationType: z.string().trim().min(1, "請輸入違規類型。").max(120),
          occurredAt: z.coerce.date(),
          location: z.string().trim().min(1, "請輸入違規地點。").max(255),
          description: z.string().trim().min(1, "請輸入違規描述。").max(4000),
          penaltyAmount: z.number().int().min(0).max(10_000_000),
          regulationBasis: z.string().trim().min(1).max(255),
          managementOfficeName: z.string().trim().min(1).max(160),
          photos: z
            .array(
              z.object({
                storageKey: z.string().trim().min(1).max(255),
                originalName: z.string().trim().min(1).max(255),
                mimeType: z.string().trim().min(1).max(80),
              })
            )
            .max(2)
            .default([]),
        })
      )
      .mutation(async ({ input }) => {
        const violationCase = await db.getViolationCaseById(input.id);
        if (!violationCase) return throwNotFound();
        if (violationCase.photos.length + input.photos.length > 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "每筆案件最多保留 2 張現場照片。" });
        }
        await db.upsertHousehold({ householdNo: input.householdNo });
        await db.updateViolationCase(input.id, {
          householdNo: input.householdNo,
          templateId: input.templateId,
          violationType: input.violationType,
          occurredAt: input.occurredAt,
          location: input.location,
          description: input.description,
          penaltyAmount: input.penaltyAmount,
          regulationBasis: input.regulationBasis,
          managementOfficeName: input.managementOfficeName,
        });
        await db.addCasePhotos(
          input.id,
          input.photos.map((photo, index) => ({ ...photo, sortOrder: violationCase.photos.length + index }))
        );
        return { success: true } as const;
      }),

    deletePhoto: adminProcedure
      .input(z.object({ caseId: z.number().int().positive(), photoId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const photo = await db.deleteCasePhoto(input.caseId, input.photoId);
        if (!photo) return throwNotFound("找不到指定照片。");
        try {
          await removeLocalCasePhoto(photo.storageKey);
        } catch (error) {
          console.warn("[Uploads] 已移除照片資料，但無法清理本機檔案：", error);
        }
        return { success: true } as const;
      }),

    delete: adminProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const deleted = await db.deleteViolationCase(input.caseId);
        if (!deleted) return throwNotFound();

        for (const photo of deleted.photos) {
          try {
            await removeLocalCasePhoto(photo.storageKey);
          } catch (error) {
            console.warn("[Uploads] 已刪除案件資料，但無法清理關聯照片檔案：", error);
          }
        }
        return { success: true } as const;
      }),

    deleteMonth: adminProcedure
      .input(z.object({ from: z.coerce.date(), to: z.coerce.date(), confirmation: z.literal("DELETE_MONTH") }))
      .mutation(async ({ input }) => {
        if (input.from > input.to) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "月份日期範圍不正確。" });
        }
        const deleted = await db.deleteViolationCasesByRange(input.from, input.to);
        for (const photo of deleted.photos) {
          try {
            await removeLocalCasePhoto(photo.storageKey);
          } catch (error) {
            console.warn("[Uploads] 已刪除月份案件資料，但無法清理關聯照片檔案：", error);
          }
        }
        return { success: true, deletedCount: deleted.deletedCount } as const;
      }),


    recordPayment: adminProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          amount: z.number().int().min(0).max(10_000_000),
          paidAt: z.coerce.date(),
          note: z.string().trim().max(2000).optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const violationCase = await db.getViolationCaseById(input.caseId);
        if (!violationCase) return throwNotFound();
        if (violationCase.status !== "pending_payment" && violationCase.status !== "paid") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "此案件目前不可登錄繳款資料。" });
        }
        await db.recordCasePayment({
          ...input,
          note: input.note || null,
          receivedByUserId: ctx.user.id,
        });
        return { success: true } as const;
      }),

    submitAppeal: protectedProcedure
      .input(z.object({ caseId: z.number().int().positive(), content: z.string().trim().min(1).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user") {
          throw new TRPCError({ code: "FORBIDDEN", message: "僅限綁定戶號的住戶可提交申訴。" });
        }
        const violationCase = await db.getViolationCaseById(input.caseId);
        if (!violationCase) return throwNotFound();
        assertCaseAccess(ctx.user, violationCase.householdNo);
        if (violationCase.status === "closed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "已結案的案件不可再提交申訴。" });
        }
        if (violationCase.appeal) {
          throw new TRPCError({ code: "CONFLICT", message: "此案件已有申訴紀錄。" });
        }
        await db.submitCaseAppeal(input);
        return { success: true } as const;
      }),

    decideAppeal: adminProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          status: z.enum([appealStatuses[1], appealStatuses[2]]),
          result: z.string().trim().min(1, "請輸入審核結果。").max(4000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const violationCase = await db.getViolationCaseById(input.caseId);
        if (!violationCase?.appeal || violationCase.appeal.status !== "pending" || violationCase.status !== "appealing") {
          return throwNotFound("找不到待處理的申訴資料。");
        }
        await db.decideCaseAppeal({ ...input, decidedByUserId: ctx.user.id });
        return { success: true } as const;
      }),

    close: adminProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const violationCase = await db.getViolationCaseById(input.caseId);
        if (!violationCase) return throwNotFound();
        if (violationCase.status === "appealing") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "案件有待審核申訴，完成審核後才可結案。" });
        }
        await db.closeViolationCase(input.caseId);
        return { success: true } as const;
      }),
  }),

  reports: router({
    summary: adminProcedure
      .input(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).optional())
      .query(async ({ input }) => db.getReportData(input?.from, input?.to)),
    householdPenaltyStats: adminProcedure
      .input(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).optional())
      .query(async ({ input }) => db.getHouseholdPenaltyStats(input?.from, input?.to)),
  }),
});

export type AppRouter = typeof appRouter;
