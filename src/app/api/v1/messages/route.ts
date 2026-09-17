import { NextRequest, NextResponse } from "next/server";
import { getMessages, deleteBulkMessages } from "@/lib/mail-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const mailboxId = searchParams.get("mailboxId") || undefined;
    const mailboxAddress = searchParams.get("mailboxAddress") || undefined;
    const search = searchParams.get("search") || undefined;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const result = getMessages({
      page,
      limit,
      mailboxId,
      mailboxAddress,
      search,
      unreadOnly,
    });

    return NextResponse.json(result);
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

    deleteBulkMessages(ids);
    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
