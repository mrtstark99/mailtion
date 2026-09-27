import { NextRequest, NextResponse } from "next/server";
import { getSystemStats } from "@/lib/mail-service";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const stats = getSystemStats(user?.role === "admin" ? undefined : user?.id);
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
