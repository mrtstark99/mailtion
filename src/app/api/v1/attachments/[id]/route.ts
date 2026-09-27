import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const att = db.prepare("SELECT * FROM attachments WHERE id = ?").get(id) as {
      id: string;
      filename: string;
      content_type: string;
      size: number;
      content: string | null;
    } | undefined;

    if (!att || !att.content) {
      return NextResponse.json({ error: "Attachment not found or has no content" }, { status: 404 });
    }

    const buffer = Buffer.from(att.content, "base64");
    const isDownload = req.nextUrl.searchParams.get("download") === "1";
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
        "Content-Type": att.content_type || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `${disposition}; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load attachment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
