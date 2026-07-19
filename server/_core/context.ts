import type { User } from "../../drizzle/schema";
import { getLocalSessionUser } from "../localAuth";

export type CookieResponse = {
  headers: Headers;
  cookie(name: string, value: string, options?: Record<string, unknown>): void;
  clearCookie(name: string, options?: Record<string, unknown>): void;
};

export type TrpcContext = {
  req: any;
  res: CookieResponse;
  user: User | null;
};

function serializeCookie(name: string, value: string, options: Record<string, unknown> = {}) {
  const parts = [`${name}=${value}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(Number(options.maxAge) / 1000)}`);
  if (options.path) parts.push(`Path=${String(options.path)}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${String(options.sameSite)}`);
  return parts.join("; ");
}

export function createCookieResponse(headers = new Headers()): CookieResponse {
  return {
    headers,
    cookie(name, value, options = {}) {
      headers.append("Set-Cookie", serializeCookie(name, value, options));
    },
    clearCookie(name, options = {}) {
      headers.append("Set-Cookie", serializeCookie(name, "", { ...options, maxAge: 0 }));
    },
  };
}

export async function createFetchContext(request: Request, responseHeaders = new Headers()): Promise<TrpcContext> {
  const req = {
    headers: { cookie: request.headers.get("cookie") ?? "" },
    protocol: new URL(request.url).protocol.replace(":", ""),
    get(name: string) { return request.headers.get(name); },
  };
  const res = createCookieResponse(responseHeaders);
  let user: User | null = null;
  try { user = await getLocalSessionUser(req as any); } catch { user = null; }
  return { req, res, user };
}

// Kept for the local Express development server.
export async function createContext(opts: any): Promise<TrpcContext> {
  let user: User | null = null;
  try { user = await getLocalSessionUser(opts.req); } catch { user = null; }
  return { req: opts.req, res: opts.res, user };
}
