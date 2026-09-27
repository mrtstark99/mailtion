import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

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

    const rows = db.prepare(`
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

    return NextResponse.json({ items: rows });
  } catch (error: unknown) {
    console.error("[Admin User Mailboxes] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
