import { NextRequest, NextResponse } from "next/server";
import {
  getMailboxes,
  createMailbox,
  createBulkMailboxes,
  deleteBulkMailboxes
} from "@/lib/mail-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const status = searchParams.get("status") || undefined;

    const result = getMailboxes({ page, limit, search, tag, status });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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
      return NextResponse.json({ error: "localPart is required" }, { status: 400 });
    }

    const created = createMailbox({
      name: body.name,
      localPart: body.localPart,
      domain: body.domain,
      tag: body.tag,
      note: body.note,
      expiryHours: body.expiryHours ? parseInt(body.expiryHours, 10) : undefined,
    });

    return NextResponse.json({ success: true, item: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = body.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    deleteBulkMailboxes(ids);
    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
