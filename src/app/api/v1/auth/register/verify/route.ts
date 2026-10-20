import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let username = (body.username || "").trim().toLowerCase();
    username = username.replace(/@mailtion\.com$/, "").trim();

    const recoveryEmail = (body.recoveryEmail || "").trim().toLowerCase();
    const code = (body.code || body.otp || "").trim();
    const password = body.password || "";

    if (!username || !recoveryEmail || !code || !password) {
      return NextResponse.json(
        { error: "Please enter all required information" },
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
        { error: "Invalid username format" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const fullAddress = `${username}@mailtion.com`;

    // Double check username availability
    const existingUser = db.prepare(
      "SELECT id FROM users WHERE lower(username) = ? OR lower(email) = ?"
    ).get(username, fullAddress);

    if (existingUser) {
      return NextResponse.json(
        { error: "This username is already taken. Please choose another one." },
        { status: 409 }
      );
    }

    // Double check recovery email uniqueness
    const existingRecovery = db.prepare(
      "SELECT id FROM users WHERE lower(recovery_email) = ?"
    ).get(recoveryEmail);

    if (existingRecovery) {
      return NextResponse.json(
        { error: "This recovery email is already in use by another account. Each recovery email can only be registered once." },
        { status: 409 }
      );
    }

    // Verify OTP code
    const validCode = db.prepare(`
      SELECT id, expires_at FROM auth_codes
      WHERE email = ? AND code = ? AND type = 'register' AND is_used = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(recoveryEmail, code) as { id: string; expires_at: string } | undefined;

    if (!validCode) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    if (new Date(validCode.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark code as used
    db.prepare("UPDATE auth_codes SET is_used = 1 WHERE id = ?").run(validCode.id);

    // Hash password & create user
    const { hash, salt } = await hashPassword(password);
    const userId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, username, email, recovery_email, password_hash, salt, role, is_verified, max_mailboxes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'user', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, username, fullAddress, recoveryEmail, hash, salt);

    // Create default mailbox for user with is_primary = 1
    try {
      const mailboxId = crypto.randomUUID();
      db.prepare(`
        INSERT OR IGNORE INTO mailboxes (id, user_id, name, address, local_part, domain, tag, status, is_primary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'mailtion.com', 'primary', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(mailboxId, userId, username, fullAddress, username);
    } catch (e) {
      console.warn("[RegisterVerify] Warning creating default mailbox:", e);
    }

    // Create session token (7 days)
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = await createSessionToken({ username, exp });

    const res = NextResponse.json({
      success: true,
      message: "Account registered successfully!",
      user: { id: userId, username, email: fullAddress, recoveryEmail, role: "user" },
    });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err: unknown) {
    console.error("[RegisterVerify] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error during registration";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
