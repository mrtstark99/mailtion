import { NextRequest, NextResponse } from "next/server";
import { processInboundEmail } from "@/lib/mail-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const to = body.to || "test@mailtion.com";
    const service = body.service || "Google";

    const templates: Record<string, { from: string; fromName: string; subject: string; html: string; text: string }> = {
      Google: {
        from: "no-reply@accounts.google.com",
        fromName: "Google Accounts",
        subject: `Mã xác minh Google của bạn: ${Math.floor(100000 + Math.random() * 900000)}`,
        text: `Mã xác minh tài khoản của bạn là ${Math.floor(100000 + Math.random() * 900000)}. Mã này có hiệu lực trong vòng 10 phút. Không chia sẻ mã này với bất kỳ ai.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a73e8; margin-top: 0;">Xác minh tài khoản</h2>
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đăng nhập tài khoản của bạn. Dưới đây là mã xác thực (OTP):</p>
          <div style="background: #f1f3f4; padding: 16px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #202124; border-radius: 6px; margin: 20px 0;">
            ${Math.floor(100000 + Math.random() * 900000)}
          </div>
          <p style="color: #5f6368; font-size: 13px;">Mã có hiệu lực trong 10 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </div>`
      },
      TikTok: {
        from: "feedback@tiktok.com",
        fromName: "TikTok Security",
        subject: `[TikTok] Mã xác nhận đăng ký: ${Math.floor(100000 + Math.random() * 900000)}`,
        text: `Mã xác nhận TikTok của bạn là: ${Math.floor(100000 + Math.random() * 900000)}. Vui lòng hoàn tất trong 5 phút.`,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; padding: 24px; border: 1px solid #222; background: #000; color: #fff; border-radius: 12px;">
          <h3 style="color: #fe2c55; margin-top: 0;">TikTok Verification</h3>
          <p>Nhập mã này để xác thực địa chỉ email:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #25f4ee; margin: 24px 0; text-align: center;">
            ${Math.floor(100000 + Math.random() * 900000)}
          </div>
          <p style="color: #888; font-size: 12px;">Bảo mật tài khoản của bạn là ưu tiên hàng đầu của chúng tôi.</p>
        </div>`
      },
      Custom: {
        from: body.from || "sender@example.com",
        fromName: body.fromName || "Dịch vụ Test",
        subject: body.subject || `Mã OTP thử nghiệm: ${Math.floor(100000 + Math.random() * 900000)}`,
        text: body.text || `Nội dung thư kiểm thử gửi tới ${to}. Mã OTP: ${Math.floor(100000 + Math.random() * 900000)}`,
        html: body.html || `<p>Nội dung thư kiểm thử gửi tới <b>${to}</b></p><p>Mã OTP: <code>${Math.floor(100000 + Math.random() * 900000)}</code></p>`
      }
    };

    const chosen = templates[service] || templates.Google;

    const result = await processInboundEmail({
      to,
      from: chosen.from,
      fromName: chosen.fromName,
      subject: chosen.subject,
      text: chosen.text,
      html: chosen.html,
      rawHeaders: `From: ${chosen.fromName} <${chosen.from}>\nTo: <${to}>\nSubject: ${chosen.subject}\nDate: ${new Date().toUTCString()}\nMessage-ID: <sim-${Date.now()}@mailtion.com>`
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
