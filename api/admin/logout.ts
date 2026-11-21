import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

type ApiRequest = IncomingMessage & { body?: unknown };
type AdminClaims = { sub: string; role: "admin"; iat: number; exp: number };
const SESSION_COOKIE = "animepay_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const attempts = new Map<string, { count: number; resetAt: number }>();

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
function cookieValue(req: IncomingMessage, name: string) {
  const raw = req.headers.cookie || "";
  const pair = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  if (!pair) return "";
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return ""; }
}
function signToken(email: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: email, role: "admin", iat: now, exp: now + SESSION_SECONDS })).toString("base64url");
  const input = header + "." + payload;
  const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(input).digest("base64url");
  return input + "." + sig;
}
function verifyToken(token: string): AdminClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !process.env.SESSION_SECRET) return null;
    const input = parts[0] + "." + parts[1];
    const expected = createHmac("sha256", process.env.SESSION_SECRET).update(input).digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as AdminClaims;
    if (claims.role !== "admin" || !claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}
function setCookie(res: ServerResponse, token: string) {
  res.setHeader("Set-Cookie", SESSION_COOKIE + "=" + encodeURIComponent(token) + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + SESSION_SECONDS);
}
function clearCookie(res: ServerResponse) {
  res.setHeader("Set-Cookie", SESSION_COOKIE + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
}
function sameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function rateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 8;
}

export default async function handler(req: ApiRequest, res: ServerResponse) {
  const method = req.method || "GET";
  const pathname = new URL(req.url || "/", "https://animepay.invalid").pathname;

  if (method === "GET" && pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "animepay-api", mode: "admin-auth-enabled" });
  }
  if (method === "GET" && pathname === "/api/currencies") {
    return json(res, 200, { currencies: ["usdttrc20", "usdterc20", "btc", "eth", "usdc"], source: "demo" });
  }
  if (method === "GET" && pathname === "/api/merchant/summary") {
    return json(res, 200, { mode: "demo", availableBalance: "0.00", pendingBalance: "0.00", totalPayments: 0, successfulPayments: 0, volumeUsd: "0.00", recentPayments: [] });
  }
  if (pathname === "/api/admin/login" && method === "POST") {
    if (!sameOrigin(req)) return json(res, 403, { error: "Cross-origin request blocked." });
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) return json(res, 429, { error: "Too many login attempts. Try again in 15 minutes." });
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as { email?: unknown; password?: unknown };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";
    if (!adminEmail || !passwordHash || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      return json(res, 503, { error: "Admin login is not configured. Check ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET in Vercel." });
    }
    let valid = false;
    try { valid = Boolean(email && password && email === adminEmail && await bcrypt.compare(password, passwordHash)); } catch { valid = false; }
    if (!valid) return json(res, 401, { error: "Invalid email or password." });
    setCookie(res, signToken(adminEmail));
    return json(res, 200, { ok: true, admin: { email: adminEmail, role: "admin" } });
  }
  if (pathname === "/api/admin/logout" && method === "POST") {
    if (!sameOrigin(req)) return json(res, 403, { error: "Cross-origin request blocked." });
    clearCookie(res);
    return json(res, 200, { ok: true });
  }
  if (pathname === "/api/admin/me" && method === "GET") {
    const claims = verifyToken(cookieValue(req, SESSION_COOKIE));
    if (!claims) return json(res, 401, { error: "Admin authentication required." });
    return json(res, 200, { authenticated: true, admin: { email: claims.sub, role: "admin" } });
  }
  if (pathname === "/api/admin/overview" && method === "GET") {
    const claims = verifyToken(cookieValue(req, SESSION_COOKIE));
    if (!claims) return json(res, 401, { error: "Admin authentication required." });
    return json(res, 200, { dataConnected: false, message: "Connect the production database and verified payment provider before enabling financial administration.", payments: [], merchants: [], withdrawals: [], auditEvents: [] });
  }
  if (pathname === "/api/checkout" && method === "POST") {
    return json(res, 501, { error: "Live checkout is not enabled yet. Provider integration and verified IPN handling are required." });
  }
  if (pathname === "/api/withdrawals" && method === "POST") {
    return json(res, 501, { error: "Withdrawals remain disabled until custody, ledger, compliance and approval controls are implemented." });
  }
  return json(res, 404, { error: "API route not found.", path: pathname });
}
