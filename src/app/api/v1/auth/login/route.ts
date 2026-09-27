import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, "login", 10, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }
    const body = await req.json();
    let account = (body.username || body.account || "").trim().toLowerCase();
    const password = body.password || "";

    if (!account || !password) {
      return NextResponse.json(
        { error: "Please enter both username/email and password" },
        { status: 400 }
      );
    }

    // Normalize account
    if (account.endsWith("@mailtion.com")) {
      account = account.replace(/@mailtion\.com$/, "");
    }

    const user = db.prepare(`
      SELECT id, username, email, password_hash, salt, role, is_verified, recovery_email, COALESCE(status, 'active') as status
      FROM users
      WHERE lower(username) = ? OR lower(email) = ? OR lower(recovery_email) = ?
      LIMIT 1
    `).get(account, `${account}@mailtion.com`, account) as {
      id: string;
      username: string;
      email: string;
      password_hash: string;
      salt: string;
      role: string;
      is_verified: number;
      recovery_email: string;
      status: string;
    } | undefined;

    if (!user) {
      return NextResponse.json(
        { error: "Incorrect account name or password" },
        { status: 401 }
      );
    }

    if (user.status === "suspended") {
      return NextResponse.json(
        { error: "Tài khoản của bạn đã bị tạm dừng. Vui lòng liên hệ quản trị viên để được hỗ trợ." },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect account name or password" },
        { status: 401 }
      );
    }

    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = await createSessionToken({ username: user.username, exp });

    const res = NextResponse.json({
      success: true,
      message: "Sign in successful!",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        recoveryEmail: user.recovery_email,
        role: user.role,
      },
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
    console.error("[Login] Error:", err);
    const errMsg = err instanceof Error ? err.message : "Internal server error during sign in";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
