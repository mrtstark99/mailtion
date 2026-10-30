import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequestActor } from "@/lib/session";
import { canReadMailbox } from "@/lib/mail-service";

// Only types browsers render without executing script may be shown inline.
// Everything else (HTML, SVG, XML, JS, ...) is forced to download as opaque bytes.
const INLINE_SAFE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "text/plain",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getRequestActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = actor;

    const { id } = await params;
    const att = db.prepare(`
      SELECT a.id, a.filename, a.content_type, a.size, a.content, m.mailbox_id
      FROM attachments a
      JOIN messages m ON a.message_id = m.id
      WHERE a.id = ?
    `).get(id) as {
      id: string;
      filename: string;
      content_type: string;
      size: number;
      content: string | null;
      mailbox_id: string;
    } | undefined;

    // Respond 404 rather than 403 so attachment IDs owned by others are not confirmed
    if (!att || !att.content || (user && user.role !== "admin" && !canReadMailbox(user.id, att.mailbox_id))) {
      return NextResponse.json({ error: "Attachment not found or has no content" }, { status: 404 });
    }

    const buffer = Buffer.from(att.content, "base64");
    const contentType = (att.content_type || "").split(";")[0].trim().toLowerCase();
    const isInlineSafe = INLINE_SAFE_TYPES.has(contentType);
    const isDownload = req.nextUrl.searchParams.get("download") === "1" || !isInlineSafe;
    const disposition = isDownload ? "attachment" : "inline";

    // RFC 6266 / RFC 5987: ASCII-only fallback filename
    // Remove non-ASCII characters for HTTP header compliance
    const safeAsciiFilename = (att.filename || "file")
      .replace(/["\r\n\\]/g, "")
      .replace(/[^\x20-\x7E]/g, "_");

    // Full filename with Unicode support via RFC 5987 UTF-8 encoding
    const encodedFilename = encodeURIComponent(att.filename || "file");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": isInlineSafe ? contentType : "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `${disposition}; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load attachment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
