import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAuthOtpEmail } from "@/lib/email-sender";
import crypto from "crypto";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, "register-otp", 5, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many verification requests. Please try again later." }, { status: 429 });
    }
    const body = await req.json();
    let username = (body.username || "").trim().toLowerCase();
    username = username.replace(/@mailtion\.com$/, "").trim();

    const recoveryEmail = (body.recoveryEmail || "").trim().toLowerCase();

    if (!username || !recoveryEmail) {
      return NextResponse.json(
        { error: "Please enter both username and recovery email" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9._-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Only lowercase letters, numbers, dots, hyphens and underscores are allowed" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoveryEmail)) {
      return NextResponse.json(
        { error: "Invalid recovery email address format" },
        { status: 400 }
      );
    }

    const fullAddress = `${username}@mailtion.com`;

    // Check if user already exists
    const existingUser = db.prepare(
      "SELECT id FROM users WHERE lower(username) = ? OR lower(email) = ?"
    ).get(username, fullAddress);

    if (existingUser) {
      return NextResponse.json(
        { error: "This username is already taken. Please choose another one." },
        { status: 409 }
      );
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Invalidate old codes
    db.prepare("UPDATE auth_codes SET is_used = 1 WHERE email = ? AND type = 'register'").run(recoveryEmail);

    // Save new code
    const codeId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO auth_codes (id, email, code, type, expires_at, created_at)
      VALUES (?, ?, ?, 'register', ?, CURRENT_TIMESTAMP)
    `).run(codeId, recoveryEmail, otp, expiresAt);

    // Send email
    await sendAuthOtpEmail({
      to: recoveryEmail,
      otp,
      type: "register",
    });

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your recovery email. Please check your inbox.",
    });
  } catch (err: unknown) {
    console.error("[RegisterRequestOTP] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
