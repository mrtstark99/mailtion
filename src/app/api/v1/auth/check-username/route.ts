import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("username") || "";
  return checkUsername(raw);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = body.username || "";
    return checkUsername(raw);
  } catch {
    return NextResponse.json({ available: false, error: "Invalid request" }, { status: 400 });
  }
}

function checkUsername(raw: string) {
  let clean = (raw || "").trim().toLowerCase();
  clean = clean.replace(/@mailtion\.com$/, "").trim();

  if (!clean) {
    return NextResponse.json({ available: false, error: "Please enter a username" }, { status: 400 });
  }

  if (clean.length < 3) {
    return NextResponse.json({ available: false, error: "Username must be at least 3 characters" }, { status: 400 });
  }

  if (!/^[a-z0-9._-]+$/.test(clean)) {
    return NextResponse.json(
      { available: false, error: "Only lowercase letters, numbers, dots, hyphens and underscores allowed" },
      { status: 400 }
    );
  }

  const fullAddress = `${clean}@mailtion.com`;

  const userExists = db.prepare(
    "SELECT id FROM users WHERE lower(username) = ? OR lower(email) = ?"
  ).get(clean, fullAddress);

  if (userExists) {
    return NextResponse.json({ available: false, error: "This username is already taken" });
  }

  const mailboxExists = db.prepare(
    "SELECT id FROM mailboxes WHERE lower(local_part) = ? OR lower(address) = ?"
  ).get(clean, fullAddress);

  if (mailboxExists) {
    return NextResponse.json({ available: false, error: "This username is already in use" });
  }

  return NextResponse.json({ available: true, username: clean, address: fullAddress });
}
