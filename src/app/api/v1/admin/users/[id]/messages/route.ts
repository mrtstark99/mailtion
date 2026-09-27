import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

interface MessageRow {
  id: string;
  mailbox_id: string;
  mailbox_name: string | null;
  mailbox_address: string;
  mailbox_tag: string | null;
  from_addr: string;
  from_name: string | null;
  to_addr: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  raw_headers: string | null;
  is_read: number;
  has_attachments: number;
  otp_code: string | null;
  created_at: string;
}

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
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const mailboxId = searchParams.get("mailboxId") || "";
    const unreadOnly = searchParams.get("unread") === "true";

    const offset = (page - 1) * limit;

    let whereClause = "WHERE mb.user_id = ?";
    const queryParams: (string | number)[] = [id];

    if (mailboxId) {
      whereClause += " AND m.mailbox_id = ?";
      queryParams.push(mailboxId);
    }

    if (unreadOnly) {
      whereClause += " AND m.is_read = 0";
    }

    if (search) {
      whereClause += " AND (lower(m.subject) LIKE ? OR lower(m.from_addr) LIKE ? OR lower(COALESCE(m.from_name, '')) LIKE ? OR lower(COALESCE(m.body_text, '')) LIKE ? OR lower(COALESCE(m.otp_code, '')) LIKE ?)";
      const term = `%${search}%`;
      queryParams.push(term, term, term, term, term);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM messages m
      JOIN mailboxes mb ON m.mailbox_id = mb.id
      ${whereClause}
    `;

    const totalRow = db.prepare(countQuery).get(...queryParams) as unknown as { total: number } | undefined;
    const total = totalRow ? totalRow.total : 0;

    const dataQuery = `
      SELECT 
        m.*,
        mb.name as mailbox_name,
        mb.address as mailbox_address,
        mb.tag as mailbox_tag
      FROM messages m
      JOIN mailboxes mb ON m.mailbox_id = mb.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rawRows = db.prepare(dataQuery).all(...queryParams, limit, offset) as unknown as MessageRow[];
    const rows = rawRows.map((row) => ({
      ...row,
      created_at:
        row.created_at && !row.created_at.includes("Z") && !row.created_at.includes("+")
          ? row.created_at.replace(" ", "T") + "Z"
          : row.created_at,
    }));

    return NextResponse.json({
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error("[Admin User Messages] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
