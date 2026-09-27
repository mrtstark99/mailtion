import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "-";
  let date: Date;
  if (typeof dateString === "string") {
    let s = dateString.trim();
    if (!s.includes("T") && !s.includes("Z") && !s.includes("+")) {
      s = s.replace(" ", "T") + "Z";
    }
    date = new Date(s);
  } else {
    date = dateString;
  }
  if (isNaN(date.getTime())) return "-";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "-";
  let date: Date;
  if (typeof dateString === "string") {
    let s = dateString.trim();
    if (!s.includes("T") && !s.includes("Z") && !s.includes("+")) {
      s = s.replace(" ", "T") + "Z";
    }
    date = new Date(s);
  } else {
    date = dateString;
  }
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function extractOtpCode(text: string): string | null {
  if (!text) return null;
  // Prefer numbers explicitly labelled as a verification code. A bare six-digit
  // value is a useful fallback; broader 4-8 digit matches capture years and prices.
  const otpPatterns = [
    /(?:otp|code|verification|pin)[\s:=#-]+([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b/,
  ];

  for (const pattern of otpPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}
