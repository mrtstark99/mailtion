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

/**
 * Ensures all hyperlinks inside HTML email content open in a new blank tab (target="_blank" rel="noopener noreferrer").
 * Also injects or normalizes <base target="_blank"> so any dynamically inserted links adhere to target="_blank".
 */
export function ensureLinksOpenInNewTab(html: string): string {
  if (!html) return "";
  let processed = html;

  // 1. Inject or update <base target="_blank">
  if (!/<base\b[^>]*>/i.test(processed)) {
    if (/<head\b[^>]*>/i.test(processed)) {
      processed = processed.replace(/(<head\b[^>]*>)/i, '$1<base target="_blank">');
    } else if (/<html\b[^>]*>/i.test(processed)) {
      processed = processed.replace(/(<html\b[^>]*>)/i, '$1<head><base target="_blank"></head>');
    } else {
      processed = `<base target="_blank">\n` + processed;
    }
  } else {
    processed = processed.replace(/<base([^>]*?)target=["'][^"']*["']/gi, '<base$1target="_blank"');
  }

  // 2. Normalize <a> tags: strip any existing target/rel and set target="_blank" rel="noopener noreferrer"
  processed = processed.replace(/<a\b([^>]*?)>/gi, (_match, attrs) => {
    const cleanAttrs = attrs
      .replace(/\s*target=(['"])[^'"]*\1/gi, "")
      .replace(/\s*rel=(['"])[^'"]*\1/gi, "");
    return `<a target="_blank" rel="noopener noreferrer"${cleanAttrs}>`;
  });

  return processed;
}

/**
 * Converts URLs in plain text into clickable HTML links that open in a new blank tab.
 */
export function formatPlainTextWithLinks(text: string): string {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
  );
}

