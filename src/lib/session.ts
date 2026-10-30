import { NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "./auth";
import { db } from "./db";
import { validateApiKey } from "./mail-service";

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  recovery_email: string | null;
  role: "admin" | "user" | "multi" | string;
  status: "active" | "suspended";
  max_mailboxes: number;
  mailbox_id: string | null;
  created_at: string;
}

export async function getCurrentUser(req: NextRequest): Promise<CurrentUser | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || !session.username) return null;

  try {
    const user = db.prepare(`
      SELECT 
        id, 
        username, 
        email, 
        recovery_email, 
        role, 
        COALESCE(status, 'active') as status, 
        CASE 
          WHEN role = 'admin' THEN 999999 
          WHEN role = 'multi' AND COALESCE(max_mailboxes, 1) < 100 THEN 100 
          ELSE COALESCE(max_mailboxes, 1) 
        END as max_mailboxes,
        mailbox_id,
        created_at
      FROM users 
      WHERE lower(username) = ? OR lower(email) = ?
    `).get(session.username.toLowerCase(), session.username.toLowerCase()) as CurrentUser | undefined;

    if (!user) return null;

    // Reject session if account has been suspended
    if (user.status === "suspended") {
      return null;
    }

    // Shared-access accounts lose access while the mailbox owner is suspended
    if (user.mailbox_id) {
      const owner = db.prepare(`
        SELECT COALESCE(u.status, 'active') as status
        FROM mailboxes mb JOIN users u ON u.id = mb.user_id
        WHERE mb.id = ?
      `).get(user.mailbox_id) as { status: string } | undefined;
      if (owner?.status === "suspended") {
        return null;
      }
    }

    return user;
  } catch (err) {
    console.error("[Session] Error fetching user:", err);
    return null;
  }
}

/**
 * Resolves who is calling a read endpoint: a signed-in user, or an admin-issued API key
 * (system-wide access, user = null). Returns null for anything else — notably a cookie that
 * still has a valid signature but belongs to a deleted or suspended account, which must not
 * fall through to unscoped queries.
 */
export async function getRequestActor(req: NextRequest): Promise<{ user: CurrentUser | null } | null> {
  const user = await getCurrentUser(req);
  if (user) return { user };

  const authHeader = req.headers.get("authorization");
  if (authHeader && validateApiKey(authHeader)) return { user: null };
  return null;
}
