import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAuthOtpEmail } from "@/lib/email-sender";
import crypto from "crypto";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, "forgot-password-otp", 5, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many reset requests. Please try again later." }, { status: 429 });
    }
    const body = await req.json();
    let username = (body.username || "").trim().toLowerCase();
    username = username.replace(/@mailtion\.com$/, "").trim();

    const recoveryEmail = (body.recoveryEmail || "").trim().toLowerCase();

    if (!username || !recoveryEmail) {
      return NextResponse.json(
        { error: "Please enter both username and registered recovery email" },
        { status: 400 }
      );
    }

    const fullAddress = `${username}@mailtion.com`;

    // Verify user exists and recovery_email matches
    const user = db.prepare(`
      SELECT id, username, recovery_email
      FROM users
      WHERE (lower(username) = ? OR lower(email) = ?) AND lower(recovery_email) = ?
    `).get(username, fullAddress, recoveryEmail) as {
      id: string;
      username: string;
      recovery_email: string;
    } | undefined;

    if (!user) {
      return NextResponse.json(
        { error: "Account or recovery email does not match our records." },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Invalidate old reset codes
    db.prepare("UPDATE auth_codes SET is_used = 1 WHERE email = ? AND type = 'reset_password'").run(recoveryEmail);

    // Save code
    const codeId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO auth_codes (id, email, code, type, expires_at, created_at)
      VALUES (?, ?, ?, 'reset_password', ?, CURRENT_TIMESTAMP)
    `).run(codeId, recoveryEmail, otp, expiresAt);

    // Send email
    await sendAuthOtpEmail({
      to: recoveryEmail,
      otp,
      type: "forgot_password",
    });

    return NextResponse.json({
      success: true,
      message: "Password reset code has been sent to your recovery email.",
    });
  } catch (err: unknown) {
    console.error("[ForgotPasswordRequestOTP] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
