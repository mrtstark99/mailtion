import { NextRequest, NextResponse } from "next/server";
import { getSystemStats } from "@/lib/mail-service";
import { getRequestActor } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const actor = await getRequestActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = actor;
    const stats = getSystemStats(user?.role === "admin" ? undefined : user?.id);
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
