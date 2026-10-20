import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  recovery_email: string | null;
  role: "admin" | "user";
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
  mailbox_count: number;
  message_count: number;
  max_mailboxes: number;
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const status = searchParams.get("status") || "all";
    const role = searchParams.get("role") || "all";

    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params: (string | number)[] = [];

    if (search) {
      whereClause += " AND (lower(u.username) LIKE ? OR lower(COALESCE(u.email, '')) LIKE ? OR lower(COALESCE(u.recovery_email, '')) LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status && status !== "all") {
      whereClause += " AND COALESCE(u.status, 'active') = ?";
      params.push(status);
    }

    if (role && role !== "all") {
      whereClause += " AND u.role = ?";
      params.push(role);
    }

    // Total count matching filters
    const totalRow = db.prepare(`SELECT COUNT(*) as total FROM users u ${whereClause}`).get(...params) as unknown as { total: number } | undefined;
    const total = totalRow ? totalRow.total : 0;

    // Fetch users with mailbox count and message count
    const usersQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.recovery_email,
        u.role,
        COALESCE(u.status, 'active') as status,
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM mailboxes mb WHERE mb.user_id = u.id) as mailbox_count,
        (SELECT COUNT(*) FROM messages msg JOIN mailboxes mb ON msg.mailbox_id = mb.id WHERE mb.user_id = u.id) as message_count,
        COALESCE(u.max_mailboxes, 1) as max_mailboxes
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rawUsers = db.prepare(usersQuery).all(...params, limit, offset) as unknown as UserRow[];

    // Summary statistics for dashboard cards
    const statsRow = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN COALESCE(status, 'active') = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN COALESCE(status, 'active') = 'suspended' THEN 1 ELSE 0 END) as suspended_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users
      FROM users
    `).get() as {
      total_users: number;
      active_users: number;
      suspended_users: number;
      admin_users: number;
    } | undefined;

    const totalMessagesRow = db.prepare(`
      SELECT COUNT(*) as total_messages
      FROM messages msg
      JOIN mailboxes mb ON msg.mailbox_id = mb.id
      WHERE mb.user_id IS NOT NULL
    `).get() as { total_messages: number } | undefined;

    return NextResponse.json({
      items: rawUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalUsers: statsRow?.total_users || 0,
        activeUsers: statsRow?.active_users || 0,
        suspendedUsers: statsRow?.suspended_users || 0,
        adminUsers: statsRow?.admin_users || 0,
        totalUserMessages: totalMessagesRow?.total_messages || 0,
      }
    });
  } catch (error: unknown) {
    console.error("[Admin Users GET] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 403 });
    }

    const body = await req.json();
    let username = (body.username || "").trim().toLowerCase();
    username = username.replace(/@mailtion\.com$/, "").trim();

    const password = body.password || "";
    const recoveryEmail = (body.recoveryEmail || "").trim().toLowerCase() || null;
    const role = body.role === "admin" ? "admin" : "user";
    const status = body.status === "suspended" ? "suspended" : "active";
    const maxMailboxes = role === "admin" ? 999999 : (body.maxMailboxes ? Math.max(1, parseInt(body.maxMailboxes, 10) || 1) : 1);

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }

    if (!/^[a-z0-9._-]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only contain lowercase letters, numbers, hyphens, underscores, and dots" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    if (recoveryEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recoveryEmail)) {
        return NextResponse.json({ error: "Invalid recovery email address" }, { status: 400 });
      }

      const existingRecovery = db.prepare(
        "SELECT id FROM users WHERE lower(recovery_email) = ?"
      ).get(recoveryEmail);

      if (existingRecovery) {
        return NextResponse.json(
          { error: "This recovery email is already in use by another account." },
          { status: 409 }
        );
      }
    }

    const fullAddress = `${username}@mailtion.com`;

    // Check availability
    const existing = db.prepare(`
      SELECT id FROM users WHERE lower(username) = ? OR lower(COALESCE(email, '')) = ?
    `).get(username, fullAddress);

    if (existing) {
      return NextResponse.json({ error: "Username is already taken. Please choose another." }, { status: 409 });
    }

    const { hash, salt } = await hashPassword(password);
    const userId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, username, email, recovery_email, password_hash, salt, role, status, is_verified, max_mailboxes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, username, fullAddress, recoveryEmail, hash, salt, role, status, maxMailboxes);

    // Auto-create default primary mailbox
    try {
      const mailboxId = crypto.randomUUID();
      db.prepare(`
        INSERT OR IGNORE INTO mailboxes (id, user_id, name, address, local_part, domain, tag, status, is_primary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'mailtion.com', 'primary', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(mailboxId, userId, username, fullAddress, username, status === "suspended" ? "paused" : "active");
    } catch (e) {
      console.warn("[Admin Create User] Warning creating default mailbox:", e);
    }

    return NextResponse.json({
      success: true,
      message: `User @${username} created successfully!`,
      user: {
        id: userId,
        username,
        email: fullAddress,
        recoveryEmail,
        role,
        status,
      }
    });
  } catch (error: unknown) {
    console.error("[Admin Users POST] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
