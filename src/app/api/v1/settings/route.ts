import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSetting } from "@/lib/mail-service";

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const [key, val] of Object.entries(body)) {
      if (typeof val === "string") {
        updateSetting(key, val);
      } else if (typeof val === "boolean") {
        updateSetting(key, val ? "1" : "0");
      } else if (typeof val === "number") {
        updateSetting(key, val.toString());
      }
    }

    const updated = getSettings();
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
