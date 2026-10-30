import { NextRequest, NextResponse } from "next/server";
import {
  getMailboxes,
  createMailbox,
  createBulkMailboxes,
  deleteBulkMailboxes,
  normalizeForwardTo
} from "@/lib/mail-service";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const status = searchParams.get("status") || undefined;

    const requestedUserId = searchParams.get("userId") || undefined;

    const result = getMailboxes({
      page,
      limit,
      search,
      tag,
      status,
      userId: user?.role === "admin" ? requestedUserId : user?.id,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Multi accounts can create up to 100 mailboxes; standard accounts are limited to 1 primary email
    if (user.role !== "admin") {
      const userRow = db.prepare(
        "SELECT role, COALESCE(max_mailboxes, 1) as max_mailboxes FROM users WHERE id = ?"
      ).get(user.id) as { role: string; max_mailboxes: number } | undefined;

      const isMulti = userRow?.role === "multi" || (userRow?.max_mailboxes !== undefined && userRow.max_mailboxes > 1);
      const maxAllowed = userRow?.role === "multi" ? Math.max(100, userRow.max_mailboxes) : (userRow?.max_mailboxes ?? 1);

      if (!isMulti || maxAllowed <= 1) {
        return NextResponse.json(
          { error: "Standard accounts are limited to 1 primary email address. Contact an administrator to upgrade to a Multi account (up to 100 mailboxes)." },
          { status: 403 }
        );
      }

      const currentCountRow = db.prepare(
        "SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ?"
      ).get(user.id) as { count: number } | undefined;
      const currentCount = currentCountRow?.count || 0;

      const requestedCount = (body.bulk || body.mode) ? (body.count ? parseInt(body.count, 10) : 10) : 1;
      if (currentCount + requestedCount > maxAllowed) {
        return NextResponse.json(
          { error: `Mailbox quota reached. You currently have ${currentCount}/${maxAllowed} mailboxes and cannot create ${requestedCount} more.` },
          { status: 403 }
        );
      }
    }

    const forwardTo = normalizeForwardTo(body.forwardTo);
    if (forwardTo.error) {
      return NextResponse.json({ error: forwardTo.error }, { status: 400 });
    }
    // undefined leaves an existing mailbox's forwarding untouched
    const forwardToValue = body.forwardTo === undefined ? undefined : forwardTo.value;

    // Check if bulk or single
    if (body.bulk || body.mode) {
      const created = createBulkMailboxes({
        mode: body.mode || "random",
        count: body.count ? parseInt(body.count, 10) : 10,
        pattern: body.pattern,
        prefix: body.prefix,
        customList: body.customList,
        domain: body.domain,
        tag: body.tag,
        note: body.note,
        forwardTo: forwardToValue,
        isForwardEnabled: body.isForwardEnabled !== undefined ? Boolean(body.isForwardEnabled) : undefined,
        userId: user.id,
        expiryHours: body.expiryHours ? parseInt(body.expiryHours, 10) : undefined,
      });
      return NextResponse.json({ success: true, count: created.length, items: created });
    }

    // Single creation
    if (!body.localPart) {
      return NextResponse.json({ error: "Mailbox name is required" }, { status: 400 });
    }

    const created = createMailbox({
      name: body.name,
      localPart: body.localPart,
      domain: body.domain,
      tag: body.tag,
      note: body.note,
      forwardTo: forwardToValue,
      isForwardEnabled: body.isForwardEnabled !== undefined ? Boolean(body.isForwardEnabled) : undefined,
      expiryHours: body.expiryHours ? parseInt(body.expiryHours, 10) : undefined,
      userId: user.id,
    });

    return NextResponse.json({ success: true, item: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ids: string[] = body.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    let deletedCount = 0;
    if (user.role !== "admin") {
      const placeholders = ids.map(() => "?").join(",");
      // Always protect primary mailbox from deletion
      const res = db.prepare(
        `DELETE FROM mailboxes WHERE id IN (${placeholders}) AND user_id = ? AND (is_primary IS NULL OR is_primary != 1)`
      ).run(...ids, user.id);
      deletedCount = Number(res.changes);
    } else {
      deleteBulkMailboxes(ids);
      deletedCount = ids.length;
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
