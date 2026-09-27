import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(
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
      return NextResponse.json({ error: "Không thể tự thay đổi trạng thái của chính mình." }, { status: 400 });
    }

    const targetUser = db.prepare("SELECT id, username, COALESCE(status, 'active') as status FROM users WHERE id = ?").get(id) as {
      id: string;
      username: string;
      status: string;
    } | undefined;

    if (!targetUser) {
      return NextResponse.json({ error: "Người dùng không tồn tại" }, { status: 404 });
    }

    const newStatus = targetUser.status === "suspended" ? "active" : "suspended";

    db.prepare("UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newStatus, id);

    // Update mailboxes accordingly
    if (newStatus === "suspended") {
      db.prepare("UPDATE mailboxes SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(id);
    } else {
      db.prepare("UPDATE mailboxes SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_primary = 1").run(id);
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: newStatus === "active" ? `Đã kích hoạt lại tài khoản @${targetUser.username}` : `Đã tạm dừng tài khoản @${targetUser.username}`
    });
  } catch (error: unknown) {
    console.error("[Admin Toggle Status] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
