import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      recoveryEmail: user.recovery_email,
      role: user.role,
      status: user.status,
      maxMailboxes: user.max_mailboxes,
      createdAt: user.created_at,
    },
  });
}
