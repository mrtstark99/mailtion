import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "-";
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "-";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "vừa xong";
  if (diffMin < 60) return `${diffMin}m trước`;
  if (diffHours < 24) return `${diffHours}h trước`;
  if (diffDays < 7) return `${diffDays}d trước`;

  return date.toLocaleDateString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function extractOtpCode(text: string): string | null {
  if (!text) return null;
  // Patterns like: "mã xác thực: 123456", "OTP: 1234", "code: 123456", or standalone 4-8 digit numbers
  const otpPatterns = [
    /(?:otp|mã|code|verification|xác thực|pin)[\s:=#-]+([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/,
    /\b([0-9]{4,8})\b/,
  ];

  for (const pattern of otpPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}
