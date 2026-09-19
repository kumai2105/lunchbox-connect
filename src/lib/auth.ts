import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db } from "./db";
import { adminUsers, sessions } from "./db/schema";

/**
 * Minimal, dependency-free admin auth.
 *
 * scrypt password hashing + opaque server-side sessions in the database.
 * No third-party auth provider is used because none is available or needed for a single-owner
 * admin, and shipping owner credentials to an external service would be worse, not better.
 */

const SESSION_COOKIE = "jazeel_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, N, r, p, saltHex, keyHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export interface AdminIdentity {
  id: number;
  email: string;
  name: string;
  role: string;
}

export async function createSession(userId: number): Promise<void> {
  const id = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await db.insert(sessions).values({ id, userId, expiresAt });
  // Opportunistic cleanup of expired rows.
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));

  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  store.delete(SESSION_COOKIE);
}

export async function getAdmin(): Promise<AdminIdentity | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
    })
    .from(sessions)
    .innerJoin(adminUsers, eq(sessions.userId, adminUsers.id))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) throw new Error("UNAUTHORISED");
  return admin;
}

/**
 * Server actions are POSTed by the browser; Next sets Origin on same-origin action requests.
 * Reject anything whose Origin does not match Host — a cheap, dependency-free CSRF guard on
 * top of the SameSite=Lax cookie.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  // A missing Origin used to pass. Next 16 sets it on every same-origin server action, so
  // absence means a non-browser client and the guard should close, not open.
  if (!origin) throw new Error("BAD_ORIGIN");
  try {
    if (new URL(origin).host !== host) throw new Error("BAD_ORIGIN");
  } catch {
    throw new Error("BAD_ORIGIN");
  }
}

/**
 * Deterministic, salted, non-reversible client identifier for rate limiting and audit.
 *
 * The salt has no default in production. It used to fall back to a literal in this file,
 * which meant an unset or empty variable silently turned the stored hashes into a public
 * function of the address: the whole IPv4 space is 2^32 HMACs, so anyone holding a copy of
 * the database could recover every enquirer's real IP. Failing loudly at boot is better
 * than a promise the schema makes and the code quietly breaks.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT?.trim();
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT is not set. Refusing to hash client addresses with a known key.");
    }
    return crypto.createHmac("sha256", "jazeel-dev-only").update(ip).digest("hex").slice(0, 32);
  }
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

/**
 * The client's address, as far as it can be trusted.
 *
 * X-Forwarded-For is a list the client can start: a browser can send its own header and
 * nginx's standard `$proxy_add_x_forwarded_for` appends the real peer rather than replacing
 * it, so the leftmost entry is attacker-chosen. Counting from the right is what is actually
 * verifiable — the last entry was written by our own proxy. TRUSTED_PROXY_HOPS says how
 * many proxies sit in front of the app; the default of 1 matches the documented topology.
 */
export function clientAddress(h: Headers): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1") || 1);
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length > 0) return chain[Math.max(0, chain.length - hops)];
  return h.get("x-real-ip")?.trim() || "unknown";
}

export { SESSION_COOKIE };
