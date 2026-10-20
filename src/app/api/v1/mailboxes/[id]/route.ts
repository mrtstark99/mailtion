import { NextRequest, NextResponse } from "next/server";
import { deleteMailbox, toggleMailboxStatus } from "@/lib/mail-service";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const mb = db.prepare("SELECT id, user_id, is_primary FROM mailboxes WHERE id = ?").get(id) as {
      id: string;
      user_id?: string;
      is_primary?: number;
    } | undefined;

    if (!mb) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    if (user.role !== "admin" && mb.user_id !== user.id) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    const body = await req.json();

    // Protect primary mailbox: cannot pause
    if (body.status) {
      if (mb.is_primary === 1 && body.status !== "active") {
        return NextResponse.json({ error: "Primary account mailbox cannot be deactivated" }, { status: 403 });
      }
      toggleMailboxStatus(id, body.status);
    }

    // Allow updating display name, tag, and note
    if (body.name !== undefined) {
      db.prepare("UPDATE mailboxes SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        body.name ? body.name.trim() : null,
        id
      );
    }

    if (body.tag !== undefined || body.note !== undefined) {
      if (body.tag !== undefined && body.note !== undefined) {
        db.prepare("UPDATE mailboxes SET tag = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
          body.tag,
          body.note,
          id
        );
      } else if (body.tag !== undefined) {
        db.prepare("UPDATE mailboxes SET tag = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.tag, id);
      } else if (body.note !== undefined) {
        db.prepare("UPDATE mailboxes SET note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.note, id);
      }
    }

    if (body.forwardTo !== undefined) {
      if (body.forwardTo && typeof body.forwardTo === "string" && body.forwardTo.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.forwardTo.trim())) {
          return NextResponse.json({ error: "Invalid backup email address format." }, { status: 400 });
        }
      }
      db.prepare("UPDATE mailboxes SET forward_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        body.forwardTo ? body.forwardTo.trim().toLowerCase() : null,
        id
      );
    }

    if (body.isForwardEnabled !== undefined) {
      db.prepare("UPDATE mailboxes SET is_forward_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        body.isForwardEnabled ? 1 : 0,
        id
      );
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
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const mb = db.prepare("SELECT id, user_id, is_primary FROM mailboxes WHERE id = ?").get(id) as {
      id: string;
      user_id?: string;
      is_primary?: number;
    } | undefined;

    if (!mb) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    if (user.role !== "admin" && mb.user_id !== user.id) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    // Hard block deleting primary mailbox
    if (mb.is_primary === 1) {
      return NextResponse.json({ error: "Cannot delete primary account mailbox" }, { status: 403 });
    }

    deleteMailbox(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
