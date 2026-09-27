import { NextRequest, NextResponse } from "next/server";
import { getMessageById, markMessageRead, deleteMessage } from "@/lib/mail-service";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;
    const msg = getMessageById(id, user?.role === "admin" ? undefined : user?.id);
    if (!msg) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Auto mark as read when fetched individually
    markMessageRead(id, true);

    return NextResponse.json(msg);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;

    if (user?.role !== "admin") {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const msg = db.prepare(`
        SELECT m.id FROM messages m 
        JOIN mailboxes mb ON m.mailbox_id = mb.id
        WHERE m.id = ? AND mb.user_id = ?
      `).get(id, user.id);
      if (!msg) {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
    }

    const body = await req.json();

    if (body.isRead !== undefined || body.is_read !== undefined) {
      const readVal = body.isRead !== undefined ? Boolean(body.isRead) : Boolean(body.is_read);
      markMessageRead(id, readVal);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;

    if (user?.role !== "admin") {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const msg = db.prepare(`
        SELECT m.id FROM messages m 
        JOIN mailboxes mb ON m.mailbox_id = mb.id
        WHERE m.id = ? AND mb.user_id = ?
      `).get(id, user.id);
      if (!msg) {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
    }

    deleteMessage(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
