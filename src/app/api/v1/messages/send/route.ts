import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-sender";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Your account does not have permission to compose and send emails." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const to = (body.to || "").trim();
    const subject = (body.subject || "").trim();
    const from = (body.from || "").trim();
    const bodyText = body.bodyText || body.text || "";
    const bodyHtml = body.bodyHtml || body.html || "";

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid recipient email address" },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: "Please enter email subject" },
        { status: 400 }
      );
    }

    if (!bodyText && !bodyHtml) {
      return NextResponse.json(
        { error: "Please enter email content" },
        { status: 400 }
      );
    }

    const data = await sendEmail({
      from: from || undefined,
      to,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully via Resend!",
      data,
    });
  } catch (err: unknown) {
    console.error("[SendMessage] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
