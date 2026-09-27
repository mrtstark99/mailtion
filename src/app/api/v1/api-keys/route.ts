import { NextRequest, NextResponse } from "next/server";
import { getApiKeys, createApiKey, deleteApiKey } from "@/lib/mail-service";
import { getCurrentUser } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  return (await getCurrentUser(req))?.role === "admin";
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const keys = getApiKeys();
    return NextResponse.json(keys);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    const key = createApiKey(body.name, body.permissions || "all");
    return NextResponse.json({ success: true, item: key });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    deleteApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
