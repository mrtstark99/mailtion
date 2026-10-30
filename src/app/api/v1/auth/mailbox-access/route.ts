import { NextRequest, NextResponse } from "next/server";
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { describeMailboxInvite, acceptMailboxInvite, MailboxAccessError } from "@/lib/mailbox-access";

/**
 * Public endpoint behind a shared-mailbox link.
 * { token }           -> describes the invite (mailbox address, whether an account exists)
 * { token, password } -> creates the shared-access account (or resets its password) and signs in
 */
export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, "mailbox-access", 20, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : undefined;

    if (password === undefined) {
      return NextResponse.json(describeMailboxInvite(token));
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const username = acceptMailboxInvite(token, await hashPassword(password));

    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const sessionToken = await createSessionToken({ username, exp });

    const res = NextResponse.json({ success: true, username });
    res.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (error: unknown) {
    if (error instanceof MailboxAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[MailboxAccess] Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
