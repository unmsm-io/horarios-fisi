import type { AppRole } from "@/lib/domain/types";

export const SESSION_COOKIE_NAME = "horarios_session";

export type SessionUser = {
  ldapUid: string;
  email: string;
  name: string;
  role: AppRole;
  institutionalRoles: string[];
  code?: string;
  authUserId?: number;
  authAccountId?: number;
};

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  user: SessionUser;
};

const DEFAULT_SECRET =
  "fisi-horarios-default-session-secret-at-least-32-chars!";

export function getSessionSecret(): string {
  return process.env.AUTH_SESSION_SECRET || DEFAULT_SECRET;
}

export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

export function isTokenExpiringSoon(
  expiresAt: number,
  thresholdSeconds = 120,
): boolean {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt - nowInSeconds <= thresholdSeconds;
}

// Derive a 256-bit AES-GCM CryptoKey from a secret string using SHA-256
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Convert Uint8Array to URL-safe Base64
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Convert URL-safe Base64 to Uint8Array
function fromBase64Url(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Seals SessionData into an encrypted string using AES-GCM with AUTH_SESSION_SECRET.
 */
export async function sealSession(
  data: SessionData,
  secret = getSessionSecret(),
): Promise<string> {
  const key = await getCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData,
  );

  const ivString = toBase64Url(iv);
  const cipherString = toBase64Url(new Uint8Array(cipherBuffer));

  return `${ivString}.${cipherString}`;
}

/**
 * Unseals an encrypted session string, returning SessionData or null if invalid or tampered.
 */
export async function unsealSession(
  sealedToken: string,
  secret = getSessionSecret(),
): Promise<SessionData | null> {
  if (!sealedToken || typeof sealedToken !== "string") {
    return null;
  }

  const parts = sealedToken.split(".");
  if (parts.length !== 2) {
    return null;
  }

  try {
    const [ivString, cipherString] = parts;
    const iv = fromBase64Url(ivString);
    const cipherBytes = fromBase64Url(cipherString);

    const key = await getCryptoKey(secret);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource,
    );

    const decodedText = new TextDecoder().decode(decryptedBuffer);
    const data = JSON.parse(decodedText) as SessionData;

    if (!data.accessToken || !data.user || !data.user.ldapUid) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
