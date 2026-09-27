import { NextRequest } from "next/server";

type Entry = { count: number; resetAt: number };
const entries = new Map<string, Entry>();

/**
 * Lightweight per-process limiter. Deployments with multiple instances should
 * replace this with a shared store (for example Redis or the platform limiter).
 */
export function isRateLimited(req: NextRequest, bucket: string, limit: number, windowMs: number): boolean {
  const forwarded = req.headers.get("x-forwarded-for");
  const client = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const key = `${bucket}:${client}`;
  const now = Date.now();
  const entry = entries.get(key);

  if (!entry || entry.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
