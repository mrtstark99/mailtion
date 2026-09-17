import { NextResponse } from "next/server";
import { getSystemStats } from "@/lib/mail-service";

export async function GET() {
  try {
    const stats = getSystemStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
