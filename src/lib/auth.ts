// Web standards compatible auth utilities (works in Edge middleware and Node.js)
const encoder = new TextEncoder();

export const AUTH_COOKIE_NAME = "mailtion_session";
export const DEFAULT_AUTH_SECRET = process.env.AUTH_SECRET || "";

/**
 * Hash password using PBKDF2 with Web Crypto API
 */
export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = saltHex
    ? Uint8Array.from(saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 10000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const saltOut = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { hash: hashHex, salt: saltOut };
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password: string, hashHex: string, saltHex: string): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, saltHex);
  const expected = encoder.encode(hashHex);
  const actual = encoder.encode(computedHash);
  if (expected.byteLength !== actual.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < expected.byteLength; index++) {
    difference |= expected[index] ^ actual[index];
  }
  return difference === 0;
}

/**
 * Sign session token using HMAC-SHA256
 */
export async function createSessionToken(
  payload: { username: string; exp: number },
  secret: string = DEFAULT_AUTH_SECRET
): Promise<string> {
  if (!secret) {
    throw new Error("AUTH_SECRET must be configured before creating sessions");
  }
  const jsonStr = JSON.stringify(payload);
  const data = btoa(unescape(encodeURIComponent(jsonStr)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const sigBytes = new Uint8Array(sigBuffer);
  let binary = "";
  for (let i = 0; i < sigBytes.length; i++) {
    binary += String.fromCharCode(sigBytes[i]);
  }

  const signature = btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

/**
 * Verify session token and return payload if valid
 */
export async function verifySessionToken(
  token: string,
  secret: string = DEFAULT_AUTH_SECRET
): Promise<{ username: string; exp: number } | null> {
  if (!secret) return null;
  if (!token || !token.includes(".")) return null;
  const [data, signature] = token.split(".");

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let b64Sig = signature.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Sig.length % 4) b64Sig += "=";
    const sigBytes = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data));
    if (!valid) return null;

    let b64Data = data.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Data.length % 4) b64Data += "=";
    const jsonStr = decodeURIComponent(escape(atob(b64Data)));
    const payload = JSON.parse(jsonStr);

    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
