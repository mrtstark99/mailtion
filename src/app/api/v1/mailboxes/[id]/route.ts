import { NextRequest, NextResponse } from "next/server";
import { deleteMailbox, toggleMailboxStatus } from "@/lib/mail-service";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.status) {
      toggleMailboxStatus(id, body.status);
    }

    if (body.name !== undefined) {
      db.prepare("UPDATE mailboxes SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.name ? body.name.trim() : null, id);
    }

    if (body.tag !== undefined || body.note !== undefined) {
      if (body.tag !== undefined && body.note !== undefined) {
        db.prepare("UPDATE mailboxes SET tag = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.tag, body.note, id);
      } else if (body.tag !== undefined) {
        db.prepare("UPDATE mailboxes SET tag = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.tag, id);
      } else if (body.note !== undefined) {
        db.prepare("UPDATE mailboxes SET note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.note, id);
      }
    }

    const updated = db.prepare("SELECT * FROM mailboxes WHERE id = ?").get(id);
    return NextResponse.json({ success: true, item: updated });
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
    const { id } = await params;
    deleteMailbox(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
