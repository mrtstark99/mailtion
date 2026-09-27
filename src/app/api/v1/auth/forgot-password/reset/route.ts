import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let username = (body.username || "").trim().toLowerCase();
    username = username.replace(/@mailtion\.com$/, "").trim();

    const recoveryEmail = (body.recoveryEmail || "").trim().toLowerCase();
    const code = (body.code || body.otp || "").trim();
    const newPassword = body.newPassword || body.password || "";

    if (!username || !recoveryEmail || !code || !newPassword) {
      return NextResponse.json(
        { error: "Please enter all required information" },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const fullAddress = `${username}@mailtion.com`;

    // Find user
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

    // Verify OTP code
    const validCode = db.prepare(`
      SELECT id, expires_at FROM auth_codes
      WHERE email = ? AND code = ? AND type = 'reset_password' AND is_used = 0
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

    // Mark code used
    db.prepare("UPDATE auth_codes SET is_used = 1 WHERE id = ?").run(validCode.id);

    // Update password
    const { hash, salt } = await hashPassword(newPassword);
    db.prepare(`
      UPDATE users
      SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hash, salt, user.id);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (err: unknown) {
    console.error("[ForgotPasswordReset] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
