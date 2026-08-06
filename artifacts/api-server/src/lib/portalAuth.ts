import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, disciplinesTable, usersTable, sessionsTable, type User } from "@workspace/db";

const scrypt = promisify(nodeScrypt);
const SESSION_COOKIE = "portal_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PortalUser = Pick<User, "id" | "name" | "username" | "role" | "active" | "createdAt">;

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalUser;
    }
  }
}

export function publicUser(user: User): PortalUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  if (password.length < 4) throw new Error("Password must be at least 4 characters");
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: number, res: Response) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({
    tokenHash: hashSessionToken(rawToken),
    userId,
    expiresAt,
  });
  res.cookie(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function clearSession(req: Request, res: Response) {
  const rawToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (rawToken) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(rawToken)));
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function authenticatePortalUser(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!rawToken) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(
      eq(sessionsTable.tokenHash, hashSessionToken(rawToken)),
      gt(sessionsTable.expiresAt, new Date()),
      eq(usersTable.active, true),
      isNull(usersTable.deletedAt),
    ))
    .limit(1);
  if (!row) {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }
  req.portalUser = publicUser(row.user);
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.portalUser?.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}

export function requireCurrentUser(req: Request) {
  if (!req.portalUser) throw new Error("Authenticated user missing");
  return req.portalUser;
}

export async function ensurePortalSeed() {
  const [admin] = await db.select().from(usersTable).where(and(eq(usersTable.username, "admin"), isNull(usersTable.deletedAt))).limit(1);
  if (!admin) {
    await db.insert(usersTable).values({
      name: "Administrator",
      username: "admin",
      passwordHash: await hashPassword("admin"),
      role: "admin",
      active: true,
    });
  }
  const defaults = ["architectural", "structural", "mechanical", "electrical", "plumbing", "landscape", "interiors"];
  for (const name of defaults) {
    await db.insert(disciplinesTable).values({ name }).onDuplicateKeyUpdate({ set: { name: sql`${disciplinesTable.name}` } });
  }
}