import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;

    const user = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.recovery_email,
        u.role,
        COALESCE(u.status, 'active') as status,
        COALESCE(u.max_mailboxes, 1) as max_mailboxes,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.id = ?
    `).get(id) as {
      id: string;
      username: string;
      email: string | null;
      recovery_email: string | null;
      role: "admin" | "user";
      status: "active" | "suspended";
      max_mailboxes: number;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const mailboxes = db.prepare(`
      SELECT 
        mb.*,
        COUNT(msg.id) as message_count,
        SUM(CASE WHEN msg.is_read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM mailboxes mb
      LEFT JOIN messages msg ON mb.id = msg.mailbox_id
      WHERE mb.user_id = ?
      GROUP BY mb.id
      ORDER BY mb.is_primary DESC, mb.created_at DESC
    `).all(id);

    return NextResponse.json({
      user,
      mailboxes,
    });
  } catch (error: unknown) {
    console.error("[Admin User GET [id]] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const targetUser = db.prepare(`
      SELECT id, username, email, role, COALESCE(status, 'active') as status
      FROM users
      WHERE id = ?
    `).get(id) as { id: string; username: string; email: string | null; role: string; status: string } | undefined;

    if (!targetUser) {
      return NextResponse.json({ error: "Người dùng không tồn tại" }, { status: 404 });
    }

    let username = body.username !== undefined ? body.username.trim().toLowerCase() : targetUser.username;
    username = username.replace(/@mailtion\.com$/, "").trim();

    const recoveryEmail = body.recoveryEmail !== undefined ? (body.recoveryEmail ? body.recoveryEmail.trim().toLowerCase() : null) : undefined;
    const role = body.role !== undefined ? (body.role === "admin" ? "admin" : "user") : targetUser.role;
    const status = body.status !== undefined ? (body.status === "suspended" ? "suspended" : "active") : targetUser.status;
    const newPassword = body.password?.trim() || "";

    // Security protections
    if (currentUser.id === targetUser.id) {
      if (status === "suspended") {
        return NextResponse.json({ error: "Bạn không thể tự tạm dừng tài khoản đang đăng nhập của chính mình." }, { status: 400 });
      }
      if (role !== "admin") {
        return NextResponse.json({ error: "Bạn không thể tự hủy quyền Admin của chính mình." }, { status: 400 });
      }
    }

    // Validate username if changed
    if (username !== targetUser.username) {
      if (username.length < 3 || !/^[a-z0-9._-]+$/.test(username)) {
        return NextResponse.json({ error: "Tên người dùng mới không hợp lệ (ít nhất 3 ký tự, chỉ gồm a-z, 0-9, ._-)" }, { status: 400 });
      }

      const checkDup = db.prepare(`
        SELECT id FROM users WHERE (lower(username) = ? OR lower(COALESCE(email, '')) = ?) AND id != ?
      `).get(username, `${username}@mailtion.com`, id);

      if (checkDup) {
        return NextResponse.json({ error: "Tên người dùng này đã có người sử dụng" }, { status: 409 });
      }
    }

    // Validate recovery email if provided
    if (recoveryEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recoveryEmail)) {
        return NextResponse.json({ error: "Email khôi phục không hợp lệ" }, { status: 400 });
      }

      const checkRecovery = db.prepare(`
        SELECT id FROM users WHERE lower(recovery_email) = ? AND id != ?
      `).get(recoveryEmail, id);

      if (checkRecovery) {
        return NextResponse.json({ error: "Email khôi phục này đã được sử dụng bởi tài khoản khác. Mỗi email chỉ được đăng ký 1 tài khoản." }, { status: 409 });
      }
    }

    // Begin updates
    const fullEmail = `${username}@mailtion.com`;

    if (username !== targetUser.username) {
      db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(username, fullEmail, id);

      // Update primary mailbox address
      try {
        db.prepare(`
          UPDATE mailboxes 
          SET address = ?, local_part = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND is_primary = 1
        `).run(fullEmail, username, id);
      } catch (e) {
        console.warn("[Admin Edit User] Warning updating primary mailbox address:", e);
      }
    }

    if (recoveryEmail !== undefined) {
      db.prepare(`
        UPDATE users 
        SET recovery_email = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(recoveryEmail, id);
    }

    if (role !== targetUser.role) {
      db.prepare(`
        UPDATE users 
        SET role = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(role, id);
    }

    if (body.maxMailboxes !== undefined) {
      const maxMb = Math.max(1, parseInt(body.maxMailboxes, 10) || 1);
      db.prepare(`
        UPDATE users 
        SET max_mailboxes = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(maxMb, id);
    }

    if (status !== targetUser.status) {
      db.prepare(`
        UPDATE users 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(status, id);

      // If suspended, also pause user's mailboxes
      if (status === "suspended") {
        db.prepare("UPDATE mailboxes SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(id);
      } else {
        db.prepare("UPDATE mailboxes SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_primary = 1").run(id);
      }
    }

    // Optional password reset
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" }, { status: 400 });
      }
      const { hash, salt } = await hashPassword(newPassword);
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(hash, salt, id);
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật thông tin người dùng thành công!"
    });
  } catch (error: unknown) {
    console.error("[Admin User PUT [id]] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;

    if (currentUser.id === id) {
      return NextResponse.json({ error: "Không thể tự xóa tài khoản của chính mình." }, { status: 400 });
    }

    const targetUser = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(id) as { id: string; username: string; role: string } | undefined;
    if (!targetUser) {
      return NextResponse.json({ error: "Người dùng không tồn tại" }, { status: 404 });
    }

    // Prevent deleting the only remaining admin
    if (targetUser.role === "admin") {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
      if (adminCount.count <= 1) {
        return NextResponse.json({ error: "Không thể xóa quản trị viên duy nhất còn lại của hệ thống." }, { status: 400 });
      }
    }

    // Clean up all user mailboxes, messages, and attachments
    const mailboxes = db.prepare("SELECT id FROM mailboxes WHERE user_id = ?").all(id) as { id: string }[];
    const mbIds = mailboxes.map((m) => m.id);

    if (mbIds.length > 0) {
      const placeholders = mbIds.map(() => "?").join(",");
      // Delete messages
      db.prepare(`DELETE FROM messages WHERE mailbox_id IN (${placeholders})`).run(...mbIds);
      // Delete mailboxes
      db.prepare(`DELETE FROM mailboxes WHERE id IN (${placeholders})`).run(...mbIds);
    }

    // Delete user
    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản @${targetUser.username} và toàn bộ dữ liệu thành công!`
    });
  } catch (error: unknown) {
    console.error("[Admin User DELETE [id]] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
