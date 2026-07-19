import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../server/routers";
import { createFetchContext } from "../server/_core/context";
import { getLocalSessionUser } from "../server/localAuth";
import * as db from "../server/db";
import { setRuntimeEnv, type WorkerRuntimeEnv } from "../server/runtimeEnv";
import {
  MAX_CASE_PHOTO_SIZE,
  MAX_CASE_PHOTOS,
  extensionForCasePhoto,
  isSafeCasePhotoStorageKey,
  validateCasePhotoUpload,
} from "../server/casePhotoStorage";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

async function requireAdmin(request: Request) {
  const req = { headers: { cookie: request.headers.get("cookie") ?? "" } } as any;
  const user = await getLocalSessionUser(req);
  return user?.role === "admin" ? user : null;
}

async function uploadPhotos(request: Request, env: WorkerRuntimeEnv) {
  const user = await requireAdmin(request);
  if (!user) return json({ message: "只有管理員可上傳案件照片。" }, 403);

  const form = await request.formData();
  const files = form.getAll("photos").filter((v): v is File => v instanceof File);
  if (!files.length) return json({ message: "請至少選擇一張照片。" }, 400);
  if (files.length > MAX_CASE_PHOTOS) return json({ message: `一次最多上傳 ${MAX_CASE_PHOTOS} 張照片。` }, 400);

  const photos = [];
  for (const file of files) {
    const error = validateCasePhotoUpload({ mimetype: file.type, size: file.size });
    if (error) return json({ message: error }, 400);
    if (file.size > MAX_CASE_PHOTO_SIZE) return json({ message: "單張照片不可超過 8 MB。" }, 400);
    const ext = extensionForCasePhoto(file.type);
    if (!ext) return json({ message: "不支援的照片格式。" }, 400);
    const key = `${Date.now()}-${crypto.randomUUID().replaceAll("-", "")}${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (env.CASE_PHOTOS) {
      await env.CASE_PHOTOS.put(key, bytes, {
        httpMetadata: { contentType: file.type },
        customMetadata: { originalName: file.name.slice(0, 255) },
      });
    } else {
      await db.storeCasePhotoObject({ storageKey: key, data: bytes, mimeType: file.type });
    }
    photos.push({ storageKey: key, originalName: file.name.slice(0, 255), mimeType: file.type });
  }
  return json({ photos }, 201);
}

async function servePhoto(request: Request, env: WorkerRuntimeEnv, key: string) {
  if (!isSafeCasePhotoStorageKey(key)) return json({ message: "照片識別碼格式不正確。" }, 400);
  const req = { headers: { cookie: request.headers.get("cookie") ?? "" } } as any;
  const user = await getLocalSessionUser(req);
  if (!user) return json({ message: "請先登入。" }, 401);
  const photo = await db.getCasePhotoAccess(key);
  if (!photo) return json({ message: "找不到照片。" }, 404);
  if (user.role !== "admin" && user.householdNo !== photo.householdNo) return json({ message: "您無權查看此照片。" }, 403);
  if (env.CASE_PHOTOS) {
    const object = await env.CASE_PHOTOS.get(key);
    if (!object) return json({ message: "照片檔案不存在。" }, 404);
    return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || photo.mimeType, "cache-control": "private, no-store" } });
  }
  const object = await db.getCasePhotoObject(key);
  if (!object) return json({ message: "照片檔案不存在。" }, 404);
  return new Response(object.data, { headers: { "content-type": object.mimeType || photo.mimeType, "cache-control": "private, no-store" } });
}

export default {
  async fetch(request: Request, env: WorkerRuntimeEnv): Promise<Response> {
    setRuntimeEnv(env);
    db.resetDbForRequest();
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        await db.ensureDatabaseSchema();
      } catch (error) {
        console.error("[Database] Schema initialization failed:", error);
        return json({ message: "資料庫初始化失敗，請稍後再試。" }, 503);
      }
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      const checks = {
        database: false,
        photoStorage: false,
        assets: Boolean(env.ASSETS),
        sessionSecret: Boolean(env.LOCAL_AUTH_SECRET || env.JWT_SECRET),
      };
      try {
        checks.database = await db.checkDatabaseHealth();
        checks.photoStorage = checks.database;
      } catch (error) {
        console.error("[Health] Database check failed:", error);
      }
      const ready = Object.values(checks).every(Boolean);
      return json({ ready, checks }, ready ? 200 : 503, { "cache-control": "no-store" });
    }

    if (url.pathname.startsWith("/api/trpc")) {
      const responseHeaders = new Headers();
      const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: () => createFetchContext(request, responseHeaders),
      });
      responseHeaders.forEach((value, key) => response.headers.append(key, value));
      return response;
    }

    if (url.pathname === "/api/uploads/case-photos" && request.method === "POST") {
      return uploadPhotos(request, env);
    }

    const fileMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/);
    if (fileMatch && request.method === "GET") return servePhoto(request, env, decodeURIComponent(fileMatch[1]));

    return env.ASSETS.fetch(request);
  },
};
