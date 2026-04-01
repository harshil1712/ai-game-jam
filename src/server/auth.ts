import type { User } from "../types";

const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(
  userId: string,
  secret: string
): Promise<string> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(userId)
  );
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${userId}.${sigBase64}`;
}

export async function verifySession(
  cookie: string,
  secret: string
): Promise<string | null> {
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;
  const key = await importKey(secret);
  try {
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(userId)
    );
    return valid ? userId : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(
  request: Request,
  env: Env
): Promise<User | null> {
  const cookie = request.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1];
  if (!cookie) return null;
  const userId = await verifySession(cookie, env.SESSION_SECRET);
  if (!userId) return null;
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<User>();
  return user;
}
