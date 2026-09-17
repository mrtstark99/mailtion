import { NextRequest, NextResponse } from "next/server";
import { processInboundEmail, getSettings } from "@/lib/mail-service";

export async function POST(req: NextRequest) {
  try {
    const settings = getSettings();
    const configuredSecret = settings["webhook_secret"] || process.env.WEBHOOK_SECRET;

    // Check authorization secret
    const incomingSecret = req.headers.get("x-webhook-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (configuredSecret && incomingSecret !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized: Invalid webhook secret" }, { status: 401 });
    }

    const payload = await req.json();

    if (!payload.to || !payload.from) {
      return NextResponse.json({ error: "Missing required fields: 'to' and 'from'" }, { status: 400 });
    }

    const result = await processInboundEmail({
      from: payload.from,
      fromName: payload.fromName,
      to: payload.to,
      subject: payload.subject || "(No subject)",
      text: payload.text,
      html: payload.html,
      rawHeaders: payload.rawHeaders,
      attachments: payload.attachments,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Support GET ping for Cloudflare setup test
export async function GET() {
  return NextResponse.json({
    service: "mailtion-inbound-webhook",
    status: "online",
    timestamp: new Date().toISOString()
  });
}
