import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/mail-service";
import { getRequestActor } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const actor = await getRequestActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = actor;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const mailboxId = searchParams.get("mailboxId") || undefined;
    const mailboxAddress = searchParams.get("mailboxAddress") || undefined;
    const search = searchParams.get("search") || undefined;
    const unreadOnly = searchParams.get("unread") === "true";

    const requestedUserId = searchParams.get("userId") || undefined;

    const result = getMessages({
      page,
      limit,
      mailboxId,
      mailboxAddress,
      search,
      unreadOnly,
      userId: user?.role === "admin" ? requestedUserId : user?.id,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
