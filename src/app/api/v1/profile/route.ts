import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = db.prepare(`
      SELECT id, username, email, recovery_email, role, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(user.id) as { id: string; username: string; email: string; recovery_email: string; role: string; created_at: string; updated_at: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        recoveryEmail: row.recovery_email,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recoveryEmail, currentPassword, newPassword } = body;

    // Update recovery email
    if (recoveryEmail !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recoveryEmail.trim())) {
        return NextResponse.json(
          { error: "Invalid recovery email address format" },
          { status: 400 }
        );
      }
      db.prepare("UPDATE users SET recovery_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        recoveryEmail.trim(),
        user.id
      );
    }

    // Change password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password" },
          { status: 400 }
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
          { status: 400 }
        );
      }

      const dbUser = db.prepare("SELECT password_hash, salt FROM users WHERE id = ?").get(user.id) as {
        password_hash: string;
        salt: string;
      };

      const isValid = await verifyPassword(currentPassword, dbUser.password_hash, dbUser.salt);
      if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      const { hash, salt } = await hashPassword(newPassword);
      db.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        hash,
        salt,
        user.id
      );
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
