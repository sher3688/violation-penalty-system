import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  resetDbForRequest: vi.fn(),
  checkDatabaseHealth: vi.fn(),
}));

vi.mock("./db", () => databaseMocks);

import worker from "../worker/index";

function runtimeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: { fetch: vi.fn() },
    CASE_PHOTOS: { put: vi.fn(), get: vi.fn(), delete: vi.fn() },
    HYPERDRIVE: {
      host: "example.invalid",
      user: "user",
      password: "password",
      database: "violations",
      port: 3306,
    },
    LOCAL_AUTH_SECRET: "a-secure-test-secret-with-at-least-32-characters",
    ...overrides,
  } as any;
}

describe("Cloudflare 上線健康檢查", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.checkDatabaseHealth.mockResolvedValue(true);
  });

  it("所有必要資源可用時回報 ready", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/health"),
      runtimeEnv()
    );

    expect(databaseMocks.resetDbForRequest).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ready: true,
      checks: { database: true, photoStorage: true, assets: true, sessionSecret: true },
    });
  });

  it("資料庫或必要綁定缺少時回報尚未就緒", async () => {
    databaseMocks.checkDatabaseHealth.mockRejectedValue(new Error("offline"));
    const response = await worker.fetch(
      new Request("https://example.com/api/health"),
      runtimeEnv({ CASE_PHOTOS: undefined, LOCAL_AUTH_SECRET: undefined })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ready: false,
      checks: { database: false, photoStorage: false, sessionSecret: false },
    });
  });
});
