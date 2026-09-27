import { NextRequest, NextResponse } from "next/server";
import {
  getMailboxes,
  createMailbox,
  createBulkMailboxes,
  deleteBulkMailboxes
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

    // Regular users can only create single mailbox
    if (user.role !== "admin") {
      if (body.bulk || body.mode || (body.count && parseInt(body.count, 10) > 1)) {
        return NextResponse.json(
          { error: "Standard users can only create one mailbox at a time." },
          { status: 403 }
        );
      }
    }

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
