import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { parse as parseCookie } from "cookie";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { getUserById } from "./db";

const scrypt = promisify(scryptCallback);

export const LOCAL_SESSION_COOKIE = "violation_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_KEY_LENGTH = 64;

function getSessionSecret(): Uint8Array {
  const secret = process.env.LOCAL_AUTH_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "缺少 LOCAL_AUTH_SECRET；請在部署環境設定至少 32 字元的隨機工作階段密鑰。"
    );
  }
  return new TextEncoder().encode(secret);
}

export function validatePassword(password: string): string | null {
  if (password.length < 10) return "密碼至少須為 10 個字元。";
  if (password.length > 128) return "密碼不得超過 128 個字元。";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const policyError = validatePassword(password);
  if (policyError) throw new Error(policyError);

  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null
): Promise<boolean> {
  if (!passwordHash) return false;
  const [algorithm, salt, storedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export async function createLocalSessionToken(user: User): Promise<string> {
  return new SignJWT({
    role: user.role,
    householdNo: user.householdNo ?? null,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function setLocalSession(
  response: Response,
  user: User
): Promise<void> {
  const token = await createLocalSessionToken(user);
  response.cookie(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearLocalSession(response: Response): void {
  response.clearCookie(LOCAL_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getLocalSessionUser(
  request: Request
): Promise<User | null> {
  const token = parseCookie(request.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;

    const user = await getUserById(userId);
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}
