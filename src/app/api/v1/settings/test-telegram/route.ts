import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { token, chatId } = await req.json() as { token?: unknown; chatId?: unknown };
    if (typeof token !== "string" || typeof chatId !== "string" || !token.trim() || !chatId.trim()) {
      return NextResponse.json({ error: "Bot token and chat ID are required" }, { status: 400 });
    }

    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token.trim())}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: "🔔 <b>mailtion.com Test Alert</b>\n\nTelegram Bot notification connection test succeeded!",
        parse_mode: "HTML",
      }),
    });
    const result = await response.json() as { ok?: boolean; description?: string };
    if (!response.ok || !result.ok) {
      return NextResponse.json({ error: result.description || "Telegram rejected the request" }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to connect to Telegram API" }, { status: 502 });
  }
}
