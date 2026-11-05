import argon2 from "argon2";
import type { NextFunction, Request, Response } from "express";
import { adminById, type Admin } from "./db.ts";
import { COPY } from "./schemas.ts";

export const COOKIE_NAME = "wsa_session";
const WINDOW_MS = 15 * 60 * 1000;
const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyHash = "";

export async function prepareAuth(): Promise<void> {
  dummyHash = await argon2.hash("not-a-real-password", argonOptions);
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argonOptions);
}

export async function passwordMatches(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function checkPassword(hash: string | null, password: string): Promise<boolean> {
  return passwordMatches(hash ?? dummyHash, password);
}

type Bucket = { fails: number; start: number; until: number };
const buckets = new Map<string, Bucket>();

export function loginKey(email: string, address: string | undefined): string {
  return `${email.slice(0, 254)}|${address || "unknown"}`;
}

export function loginAllowed(key: string): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return true;
  return Date.now() >= bucket.until;
}

export function loginFailed(key: string): "bad" | "wait" {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || (now >= bucket.until && now - bucket.start > WINDOW_MS)) {
    bucket = { fails: 0, start: now, until: 0 };
  }
  if (now < bucket.until) {
    buckets.set(key, bucket);
    return "wait";
  }
  bucket.fails += 1;
  if (bucket.fails >= 6) {
    bucket.until = now + WINDOW_MS;
    buckets.set(key, bucket);
    return "wait";
  }
  buckets.set(key, bucket);
  return "bad";
}

export function loginSucceeded(key: string): void {
  buckets.delete(key);
}

export function cookieOptions(secretIsProduction: boolean): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secretIsProduction,
  };
}

export function sessionValue(admin: Admin): string {
  return `${admin.id}.${admin.updated_at.getTime()}`;
}

export async function adminFromRequest(req: Request): Promise<Admin | null> {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (typeof raw !== "string") return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const stamp = Number(raw.slice(dot + 1));
  if (!Number.isFinite(stamp)) return null;
  const admin = await adminById(id);
  if (!admin || admin.updated_at.getTime() !== stamp) return null;
  return admin;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const admin = await adminFromRequest(req);
    if (!admin) {
      if (req.originalUrl.startsWith("/api/")) {
        res.status(401).json({ error: COPY.signInRequired });
        return;
      }
      res.redirect("/admin");
      return;
    }
    res.locals.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}

export function rejectCrossSite(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  const origin = req.get("origin");
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (host !== req.get("host")) {
        res.status(403).type("text").send("Forbidden.");
        return;
      }
    } catch {
      res.status(403).type("text").send("Forbidden.");
      return;
    }
  }
  next();
}
