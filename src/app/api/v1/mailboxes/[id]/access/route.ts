import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getMailboxAccessStatus,
  createMailboxInvite,
  revokeMailboxAccess,
  MailboxAccessError,
} from "@/lib/mailbox-access";

type Params = { params: Promise<{ id: string }> };

// Only the mailbox owner (or an admin) can share a child mailbox; primary mailboxes are the owner's own login
async function loadShareableMailbox(req: NextRequest, params: Params["params"]) {
  const user = await getCurrentUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { id } = await params;
  const mb = db.prepare("SELECT id, user_id, local_part, is_primary FROM mailboxes WHERE id = ?").get(id) as {
    id: string;
    user_id: string | null;
    local_part: string;
    is_primary: number | null;
  } | undefined;

  if (!mb || (user.role !== "admin" && mb.user_id !== user.id)) {
    return { error: NextResponse.json({ error: "Mailbox not found" }, { status: 404 }) };
  }
  if (mb.is_primary === 1) {
    return { error: NextResponse.json({ error: "Primary account mailboxes cannot be shared." }, { status: 403 }) };
  }
  return { user, mailbox: mb };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const result = await loadShareableMailbox(req, params);
    if ("error" in result) return result.error;
    return NextResponse.json(getMailboxAccessStatus(result.mailbox.id));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const result = await loadShareableMailbox(req, params);
    if ("error" in result) return result.error;

    const invite = createMailboxInvite(result.mailbox, result.user.id);
    return NextResponse.json({ success: true, ...invite });
  } catch (error: unknown) {
    if (error instanceof MailboxAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const result = await loadShareableMailbox(req, params);
    if ("error" in result) return result.error;

    revokeMailboxAccess(result.mailbox.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
