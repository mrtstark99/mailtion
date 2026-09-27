import { NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "./auth";
import { db } from "./db";

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  recovery_email: string | null;
  role: "admin" | "user";
  status: "active" | "suspended";
  created_at: string;
}

export async function getCurrentUser(req: NextRequest): Promise<CurrentUser | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || !session.username) return null;

  try {
    const user = db.prepare(`
      SELECT id, username, email, recovery_email, role, COALESCE(status, 'active') as status, created_at
      FROM users 
      WHERE lower(username) = ? OR lower(email) = ?
    `).get(session.username.toLowerCase(), session.username.toLowerCase()) as CurrentUser | undefined;

    if (!user) return null;

    // Reject session if account has been suspended
    if (user.status === "suspended") {
      return null;
    }

    return user;
  } catch (err) {
    console.error("[Session] Error fetching user:", err);
    return null;
  }
}
